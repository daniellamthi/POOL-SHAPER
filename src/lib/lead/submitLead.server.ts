/**
 * Server-only lead submission endpoint (TanStack Start `createServerFn`).
 * Validates the full payload -- including the canonical
 * `ProjectConfiguration` from P1 -- server-side, then hands a human-readable
 * summary to Resend for delivery to Piscine Wellness.
 *
 * KNOWN LIMITATION (see P3 report): there is no database/KV/Durable Object
 * bound to this deployment (no `wrangler.toml` in the repo), so the
 * best-effort rate-limit/idempotency caches below are process-local -- they
 * reset whenever the Workers isolate recycles. That is an honest, disclosed
 * limitation, not a substitute for real persistence.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { leadSubmissionInputSchema } from "./schema";
import { formatLeadEmail } from "./formatLeadEmail";
import type { LeadSubmission, LeadSubmissionErrorCode, LeadSubmissionResult } from "./types";

export class LeadSubmissionError extends Error {
  code: LeadSubmissionErrorCode;
  constructor(code: LeadSubmissionErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "LeadSubmissionError";
  }
}

const MAX_PAYLOAD_BYTES = 200_000;
const RATE_LIMIT_WINDOW_MS = 20_000;
const IDEMPOTENCY_TTL_MS = 5 * 60_000;

// Process-local best-effort caches -- see the module comment above.
const recentSubmissionsByIp = new Map<string, number>();
const resultByIdempotencyKey = new Map<string, { at: number; result: LeadSubmissionResult }>();

function pruneExpired() {
  const now = Date.now();
  for (const [ip, at] of recentSubmissionsByIp) {
    if (now - at > RATE_LIMIT_WINDOW_MS) recentSubmissionsByIp.delete(ip);
  }
  for (const [key, entry] of resultByIdempotencyKey) {
    if (now - entry.at > IDEMPOTENCY_TTL_MS) resultByIdempotencyKey.delete(key);
  }
}

/** Reads deployment secrets. Works as-is for Node/`vite preview` and the
 * local render bridge; on the actual Cloudflare Workers deploy, secrets
 * configured with `wrangler secret put` need `nodejs_compat` (already set
 * per `.output/nitro.json`) for `process.env` to see them -- if that turns
 * out not to hold in production, the fix is reading `getCloudflareContext().env`
 * instead, not changing anything in this file's validation/formatting. */
function getServerEnv(name: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env[name] : undefined;
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

async function sendLeadEmail(submission: LeadSubmission): Promise<void> {
  const apiKey = getServerEnv("RESEND_API_KEY");
  const to = getServerEnv("LEAD_NOTIFY_EMAIL");
  const from = getServerEnv("LEAD_FROM_EMAIL");

  if (!apiKey || !to || !from) {
    throw new LeadSubmissionError(
      "EMAIL_NOT_CONFIGURED",
      "Il servizio di invio email non è configurato per questo ambiente (RESEND_API_KEY / LEAD_NOTIFY_EMAIL / LEAD_FROM_EMAIL).",
    );
  }

  const { subject, text, html } = formatLeadEmail(submission);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      reply_to: submission.customer.email,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[lead] Resend delivery failed", response.status, body);
    throw new LeadSubmissionError(
      "EMAIL_SEND_FAILED",
      "Invio dell'email non riuscito. Riprova tra poco.",
    );
  }
}

export const submitLead = createServerFn({ method: "POST" })
  .validator(leadSubmissionInputSchema)
  .handler(async ({ data }): Promise<LeadSubmissionResult> => {
    pruneExpired();

    if (data.website) {
      // Honeypot tripped -- pretend success without doing any work.
      return { success: true, requestId: crypto.randomUUID(), projectId: data.project.projectId };
    }

    const cached = resultByIdempotencyKey.get(data.idempotencyKey);
    if (cached) return cached.result;

    if (JSON.stringify(data).length > MAX_PAYLOAD_BYTES) {
      throw new LeadSubmissionError("PAYLOAD_TOO_LARGE", "La richiesta è troppo grande.");
    }

    const ip = getRequestIP() ?? "unknown";
    const lastSeen = recentSubmissionsByIp.get(ip);
    if (lastSeen && Date.now() - lastSeen < RATE_LIMIT_WINDOW_MS) {
      throw new LeadSubmissionError(
        "RATE_LIMITED",
        "Richiesta già ricevuta, attendi qualche secondo prima di riprovare.",
      );
    }
    recentSubmissionsByIp.set(ip, Date.now());

    const requestId = crypto.randomUUID();
    const submission: LeadSubmission = {
      requestId,
      projectId: data.project.projectId,
      schemaVersion: data.project.schemaVersion,
      createdAt: new Date().toISOString(),
      customer: data.customer,
      commercial: data.commercial,
      // zod's `.passthrough()` validation only types the fields it checks;
      // the runtime object is still the client's own, already-canonical
      // ProjectConfiguration (see schema.ts's module comment).
      project: data.project as unknown as LeadSubmission["project"],
      privacy: data.privacy,
      attachments: [],
    };

    // Best-effort operational trail even when email delivery is
    // unavailable -- NOT durable storage (see module comment).
    console.log("[lead] submission received", {
      requestId: submission.requestId,
      projectId: submission.projectId,
      customerEmail: submission.customer.email,
    });

    await sendLeadEmail(submission);

    const result: LeadSubmissionResult = {
      success: true,
      requestId,
      projectId: submission.projectId,
    };
    resultByIdempotencyKey.set(data.idempotencyKey, { at: Date.now(), result });
    return result;
  });
