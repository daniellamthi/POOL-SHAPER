/**
 * Durable lead storage adapter. `getLeadStore()` picks the real
 * (Supabase-backed) implementation when `SUPABASE_URL` +
 * `SUPABASE_SERVICE_ROLE_KEY` are configured, and otherwise falls back to
 * an in-process, non-durable store -- so this deployment never crashes or
 * fakes success, it's just honest that nothing survives an isolate
 * recycle until real credentials are added. See the P6A report for the
 * exact blocker in this environment (Supabase account project quota).
 *
 * Talks to Supabase over its REST (PostgREST) API via plain `fetch` --
 * no `@supabase/supabase-js` dependency, matching the same
 * fetch-only pattern `submitLead.server.ts` already uses for Resend.
 * See supabase/migrations/0001_create_leads_table.sql for the schema this
 * expects.
 */
import type { LeadSubmission, LeadSubmissionErrorCode } from "./types";

export interface LeadRecordStatus {
  requestId: string;
  status: "pending" | "email_sent" | "email_failed";
}

export interface LeadStore {
  readonly kind: "supabase" | "memory";
  /** Durable upsert keyed by `idempotencyKey`: a retried/duplicated
   * request returns the row that already exists instead of inserting a
   * second lead. `stored: false` on the memory fallback means this was
   * never actually durable -- callers must not treat it as safely
   * persisted. */
  upsertLead(
    submission: LeadSubmission,
    idempotencyKey: string,
  ): Promise<{ stored: boolean; existing: LeadRecordStatus | null }>;
  updateEmailStatus(
    requestId: string,
    status: "email_sent" | "email_failed",
    emailError?: string,
  ): Promise<void>;
}

export class LeadStorageError extends Error {
  code: LeadSubmissionErrorCode;
  constructor(code: LeadSubmissionErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "LeadStorageError";
  }
}

function getServerEnv(name: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env[name] : undefined;
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

class SupabaseLeadStore implements LeadStore {
  readonly kind = "supabase" as const;
  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string,
  ) {}

  private headers(extra?: Record<string, string>) {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  async upsertLead(
    submission: LeadSubmission,
    idempotencyKey: string,
  ): Promise<{ stored: boolean; existing: LeadRecordStatus | null }> {
    const row = {
      request_id: submission.requestId,
      idempotency_key: idempotencyKey,
      project_id: submission.projectId,
      schema_version: submission.schemaVersion,
      customer_name: submission.customer.name,
      customer_email: submission.customer.email,
      customer_phone: submission.customer.phone,
      project_location: submission.customer.projectLocation,
      timing: submission.commercial.timing,
      notes: submission.commercial.notes || null,
      privacy_accepted: submission.privacy.accepted,
      marketing_consent: submission.privacy.marketingConsent,
      project_configuration: submission.project,
      attachments: submission.attachments,
      status: "pending",
    };

    const response = await fetch(`${this.url}/rest/v1/leads?on_conflict=idempotency_key`, {
      method: "POST",
      headers: this.headers({
        Prefer: "return=representation,resolution=ignore-duplicates",
      }),
      body: JSON.stringify(row),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new LeadStorageError(
        "STORAGE_UNAVAILABLE",
        `Supabase insert failed (${response.status}): ${body}`,
      );
    }
    const inserted = (await response.json()) as Array<{ request_id: string; status: string }>;
    if (inserted.length > 0) {
      // Fresh insert -- this is a new lead.
      return { stored: true, existing: null };
    }

    // Empty array with 2xx + ignore-duplicates means the idempotency key
    // already existed -- fetch the existing row's status instead of
    // silently creating a second lead.
    const existingResponse = await fetch(
      `${this.url}/rest/v1/leads?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=request_id,status`,
      { headers: this.headers() },
    );
    if (!existingResponse.ok) {
      throw new LeadStorageError("STORAGE_UNAVAILABLE", "Supabase idempotency lookup failed");
    }
    const rows = (await existingResponse.json()) as Array<{ request_id: string; status: string }>;
    const existing = rows[0];
    return {
      stored: true,
      existing: existing
        ? { requestId: existing.request_id, status: existing.status as LeadRecordStatus["status"] }
        : null,
    };
  }

  async updateEmailStatus(
    requestId: string,
    status: "email_sent" | "email_failed",
    emailError?: string,
  ): Promise<void> {
    await fetch(`${this.url}/rest/v1/leads?request_id=eq.${encodeURIComponent(requestId)}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({
        status,
        email_error: emailError ?? null,
        email_sent_at: status === "email_sent" ? new Date().toISOString() : null,
      }),
    }).catch((error: unknown) => {
      // Best-effort status update -- the lead row itself is already
      // durably stored, so a failure here degrades to a stale `status`
      // column, not data loss.
      console.error("[lead] Supabase status update failed", error);
    });
  }
}

/** Process-local, non-durable fallback -- identical in shape to the real
 * store so `submitLead.server.ts` never has to branch on which one it
 * got, but `stored` is always false: nothing here survives an isolate
 * recycle. This is what P3 originally shipped with. */
class MemoryLeadStore implements LeadStore {
  readonly kind = "memory" as const;
  private byIdempotencyKey = new Map<string, { at: number; status: LeadRecordStatus }>();
  private readonly ttlMs = 5 * 60_000;

  private prune() {
    const now = Date.now();
    for (const [key, entry] of this.byIdempotencyKey) {
      if (now - entry.at > this.ttlMs) this.byIdempotencyKey.delete(key);
    }
  }

  upsertLead(
    submission: LeadSubmission,
    idempotencyKey: string,
  ): Promise<{ stored: boolean; existing: LeadRecordStatus | null }> {
    this.prune();
    const existing = this.byIdempotencyKey.get(idempotencyKey);
    if (existing) return Promise.resolve({ stored: false, existing: existing.status });
    const status: LeadRecordStatus = { requestId: submission.requestId, status: "pending" };
    this.byIdempotencyKey.set(idempotencyKey, { at: Date.now(), status });
    return Promise.resolve({ stored: false, existing: null });
  }

  updateEmailStatus(
    requestId: string,
    status: "email_sent" | "email_failed",
    _emailError?: string,
  ): Promise<void> {
    for (const entry of this.byIdempotencyKey.values()) {
      if (entry.status.requestId === requestId) entry.status.status = status;
    }
    return Promise.resolve();
  }
}

const memoryStore = new MemoryLeadStore();

export function getLeadStore(): LeadStore {
  const url = getServerEnv("SUPABASE_URL");
  const serviceRoleKey = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (url && serviceRoleKey) return new SupabaseLeadStore(url, serviceRoleKey);
  return memoryStore;
}
