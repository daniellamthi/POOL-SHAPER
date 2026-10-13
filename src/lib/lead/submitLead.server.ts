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
import { getLeadStore } from "./storage";
import { deriveAttachments } from "./deriveAttachments";
import { verifyStoredAttachments } from "./verifyAttachments.server";
import { currentAttachmentOwner } from "./attachmentOwner.server";
import { processLeadNotification, syncLeadNotificationStatus } from "./leadNotification.server";
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
      ...(data.projectReference ? { projectReference: data.projectReference } : {}),
      schemaVersion: data.project.schemaVersion,
      createdAt: new Date().toISOString(),
      customer: data.customer,
      commercial: data.commercial,
      // zod's `.passthrough()` validation only types the fields it checks;
      // the runtime object is still the client's own, already-canonical
      // ProjectConfiguration (see schema.ts's module comment).
      project: data.project as unknown as LeadSubmission["project"],
      privacy: data.privacy,
      attachments: deriveAttachments(data.project),
    };

    await verifyStoredAttachments(submission.projectId, submission.attachments,
      submission.attachments.length ? await currentAttachmentOwner(submission.projectId) : undefined);
    // Persist only verified attachment metadata, never arbitrary upload URLs.
    submission.project = {
      ...submission.project,
      config: { ...submission.project.config, uploads: submission.project.config.uploads
        .filter((upload) => submission.attachments.some((item) => item.storagePath === upload.storagePath))
        .map((upload) => ({ id: upload.id, name: upload.name, type: upload.type, size: upload.size,
          category: upload.category, url: null, storagePath: upload.storagePath ?? null, uploadStatus: "uploaded" as const })) },
    };
    const store = getLeadStore();
    const { stored, existing } = await store.upsertLead(submission, data.idempotencyKey);

    console.log("[lead] submission persisted", {
      requestId: submission.requestId,
      projectId: submission.projectId,
      stored,
    });

    const persistedRequestId = existing?.requestId ?? requestId;
    try {
      const notification = await processLeadNotification(persistedRequestId);
      await syncLeadNotificationStatus(persistedRequestId);
      return {
        success: true,
        requestId: persistedRequestId,
        projectId: submission.projectId,
        stored,
        emailDelivered: notification.delivered,
      };
    } catch (error) {
      // Recovery must not overwrite a newer delivered/bounced webhook with failure.
      await syncLeadNotificationStatus(persistedRequestId).catch(() => undefined);
      if (stored) {
        // The lead survives durably even though the email didn't go out
        // -- honest partial success, not a lost lead.
        return {
          success: true,
          requestId: persistedRequestId,
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
