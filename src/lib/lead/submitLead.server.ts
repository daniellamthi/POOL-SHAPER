/**
 * Server-only lead submission endpoint (TanStack Start `createServerFn`).
 * Validates the full payload -- including the canonical
 * `ProjectConfiguration` from P1 -- server-side, durably persists it
 * (see storage.ts), then hands a human-readable summary to Resend for
 * delivery to Piscine Wellness.
 *
 * Transaction order (P6A): validate -> persist -> attempt email -> update
 * delivery status -> return a truthful result. A lead that is durably
 * stored is never lost just because email delivery fails -- that comes
 * back as success with `emailDelivered: false`, not an error. Only when
 * there is no durable store at all (this environment's current state --
 * see the P6A report) does an email failure become a hard error, because
 * in that case nothing else exists to remember the lead by.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { leadSubmissionInputSchema } from "./schema";
import { formatLeadEmail } from "./formatLeadEmail";
import { getLeadStore } from "./storage";
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

// Process-local best-effort rate limit -- see the module comment; this is
// a throttle, not the idempotency guarantee (that now lives in
// storage.ts's upsertLead, durable whenever a real store is configured).
const recentSubmissionsByIp = new Map<string, number>();

function pruneExpiredRateLimits() {
  const now = Date.now();
  for (const [ip, at] of recentSubmissionsByIp) {
    if (now - at > RATE_LIMIT_WINDOW_MS) recentSubmissionsByIp.delete(ip);
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
    pruneExpiredRateLimits();

    if (data.website) {
      // Honeypot tripped -- pretend success without doing any work.
      return {
        success: true,
        requestId: crypto.randomUUID(),
        projectId: data.project.projectId,
        stored: false,
        emailDelivered: false,
      };
    }

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

    const store = getLeadStore();
    const { stored, existing } = await store.upsertLead(submission, data.idempotencyKey);

    if (existing) {
      // Same idempotency key as a previous attempt -- return its outcome
      // instead of creating (or re-emailing) a second lead.
      return {
        success: true,
        requestId: existing.requestId,
        projectId: submission.projectId,
        stored,
        emailDelivered: existing.status === "email_sent",
      };
    }

    console.log("[lead] submission persisted", {
      requestId: submission.requestId,
      projectId: submission.projectId,
      customerEmail: submission.customer.email,
      stored,
    });

    try {
      await sendLeadEmail(submission);
      await store.updateEmailStatus(requestId, "email_sent");
      return {
        success: true,
        requestId,
        projectId: submission.projectId,
        stored,
        emailDelivered: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await store.updateEmailStatus(requestId, "email_failed", message);
      if (stored) {
        // The lead survives durably even though the email didn't go out
        // -- honest partial success, not a lost lead.
        return {
          success: true,
          requestId,
          projectId: submission.projectId,
          stored: true,
          emailDelivered: false,
        };
      }
      // No durable copy and the email failed: nothing preserved this
      // lead, so this genuinely is an error the customer should retry.
      throw error;
    }
  });
