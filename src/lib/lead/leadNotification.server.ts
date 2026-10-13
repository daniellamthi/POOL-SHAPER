import { backendRequest, backendRpc } from "../backend-db.server";
import { formatLeadEmail } from "./formatLeadEmail";
import type { LeadSubmission } from "./types";

export type NotificationState = "pending" | "processing" | "accepted" | "sent" | "delivered" | "bounced" | "failed" | "blocked";
export interface NotificationRow {
  request_id: string; submission: LeadSubmission; payload: Record<string, unknown> | null;
  state: NotificationState; attempts: number; lease_token: string | null;
  provider_id: string | null; first_attempt_at: string | null;
}
export interface NotificationStore {
  ensure(requestId: string): Promise<NotificationRow>;
  claim(requestId: string, lease: string): Promise<NotificationRow | null>;
  patch(requestId: string, lease: string, values: Record<string, unknown>): Promise<void>;
  event(eventId: string, providerId: string, state: NotificationState, at: string): Promise<boolean>;
}

export const notificationStore: NotificationStore = {
  async ensure(requestId) {
    const existing = await backendRequest<NotificationRow[]>(`/rest/v1/lead_notifications?request_id=eq.${requestId}&select=*`);
    if (existing[0]) return existing[0];
    const rows = await backendRequest<Array<Record<string, unknown>>>(`/rest/v1/leads?request_id=eq.${requestId}&select=*`);
    const row = rows[0];
    if (!row) throw new Error("Richiesta non trovata.");
    // Recover from interruption between lead persistence and queue creation using the stored record.
    const submission = {
      requestId, projectId: row["project_id"], projectReference: row["project_reference"] ?? undefined,
      schemaVersion: row["schema_version"], createdAt: row["created_at"],
      customer: { name: row["customer_name"], email: row["customer_email"], phone: row["customer_phone"], projectLocation: row["project_location"] },
      commercial: { timing: row["timing"], notes: row["notes"] ?? "" },
      privacy: { accepted: row["privacy_accepted"], marketingConsent: row["marketing_consent"] },
      project: row["project_configuration"], attachments: row["attachments"] ?? [],
    };
    await backendRequest("/rest/v1/lead_notifications?on_conflict=request_id", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ request_id: requestId, submission,
        ...(row["status"] === "email_sent" ? { state: "blocked", retryable: false, error_code: "LEGACY_NOTIFICATION_ALREADY_SENT" } : {}) }),
    });
    const saved = await backendRequest<NotificationRow[]>(`/rest/v1/lead_notifications?request_id=eq.${requestId}&select=*`);
    if (!saved[0]) throw new Error("Notifica non disponibile.");
    return saved[0];
  },
  async claim(requestId, lease) {
    const claimed = await backendRpc<NotificationRow | null>("claim_lead_notification", { p_request: requestId, p_lease: lease });
    await syncLeadNotificationStatus(requestId);
    return claimed;
  },
  async patch(requestId, lease, values) {
    const rows = await backendRequest<Array<{ request_id: string }>>(`/rest/v1/lead_notifications?request_id=eq.${requestId}&lease_token=eq.${lease}`, {
      method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }),
    });
    if (rows.length !== 1) throw new Error("Notifica già in elaborazione.");
    await syncLeadNotificationStatus(requestId);
  },
  event: (eventId, providerId, state, at) => backendRpc("record_notification_event", { p_event: eventId, p_provider: providerId, p_state: state, p_at: at }),
};

export async function syncLeadNotificationStatus(requestId: string): Promise<void> {
  await backendRpc("sync_lead_notification_status", { p_request: requestId });
}

const recipient = "info@piscinewellness.com";
function canonicalJson(value: unknown): string {
  const order = (input: unknown): unknown => Array.isArray(input) ? input.map(order) : input && typeof input === "object"
    ? Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, order(item)])) : input;
  return JSON.stringify(order(value));
}
function providerConfiguration(env: Record<string, string | undefined>) {
  const key = env["RESEND_API_KEY"]?.trim();
  const from = env["LEAD_FROM_EMAIL"]?.trim();
  const address = from?.match(/(?:<)?([^\s<>]+@[^\s<>]+)(?:>)?$/)?.[1];
  if (!key || !from || !address || !/@(?:[a-z0-9-]+\.)*piscinewellness\.com$/i.test(address) ||
      env["LEAD_SENDER_DOMAIN_VERIFIED"] !== "true" ||
      (env["LEAD_NOTIFY_EMAIL"] && env["LEAD_NOTIFY_EMAIL"] !== recipient)) return null;
  return { key, from };
}

/** Provider acceptance is not delivery. Only authenticated provider evidence marks delivered. */
export async function processLeadNotification(requestId: string, options: {
  store?: NotificationStore; env?: Record<string, string | undefined>; fetcher?: typeof fetch;
} = {}): Promise<{ state: NotificationState; delivered: boolean }> {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error("Richiesta non valida.");
  const store = options.store ?? notificationStore;
  const fetcher = options.fetcher ?? fetch;
  const env = options.env ?? process.env;
  const current = await store.ensure(requestId);
  const configuration = providerConfiguration(env);
  if (current.provider_id && configuration && ["accepted", "sent"].includes(current.state)) {
    const response = await fetcher(`https://api.resend.com/emails/${encodeURIComponent(current.provider_id)}`, {
      headers: { Authorization: `Bearer ${configuration.key}` }, signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      const info = await response.json() as { last_event?: string };
      const state = info.last_event;
      if (state && ["sent", "delivered", "bounced", "failed"].includes(state)) {
        await store.event(`poll:${current.provider_id}:${state}`, current.provider_id, state as NotificationState, new Date().toISOString());
        return { state: state as NotificationState, delivered: state === "delivered" };
      }
    }
  }
  if (["accepted", "sent", "delivered", "bounced", "blocked"].includes(current.state)) return { state: current.state, delivered: current.state === "delivered" };
  const lease = crypto.randomUUID();
  const claimed = await store.claim(requestId, lease);
  if (!claimed) {
    const fresh = await store.ensure(requestId);
    return { state: fresh.state, delivered: fresh.state === "delivered" };
  }
  if (!configuration || env["LEAD_NOTIFICATIONS_QA_DISABLED"] === "true") {
    await store.patch(requestId, lease, { state: "failed", retryable: true, error_code: "EMAIL_NOT_CONFIGURED", lease_until: null, next_attempt_at: new Date(Date.now() + 60_000).toISOString() });
    return { state: "failed", delivered: false };
  }
  try {
    const message = formatLeadEmail(claimed.submission);
    const payload = claimed.payload ?? { from: configuration.from, to: [recipient], reply_to: claimed.submission.customer.email, ...message };
    if (!claimed.payload) await store.patch(requestId, lease, { payload });
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${configuration.key}`, "Content-Type": "application/json", "Idempotency-Key": `pool-shaper-lead/${requestId}` },
      body: canonicalJson(payload), signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500 || response.status === 409;
      await store.patch(requestId, lease, { state: "failed", retryable, error_code: `PROVIDER_HTTP_${response.status}`, lease_until: null,
        next_attempt_at: new Date(Date.now() + Math.min(3600, 30 * 2 ** claimed.attempts) * 1000).toISOString() });
      return { state: "failed", delivered: false };
    }
    const result = await response.json() as { id?: string };
    if (!result.id || !/^[A-Za-z0-9_-]{1,100}$/.test(result.id)) throw new Error("Provider response invalid");
    await store.patch(requestId, lease, { state: "accepted", provider_id: result.id, error_code: null, lease_until: null, retryable: false });
    return { state: "accepted", delivered: false };
  } catch {
    await store.patch(requestId, lease, { state: "failed", retryable: true, error_code: "PROVIDER_UNCERTAIN", lease_until: null,
      next_attempt_at: new Date(Date.now() + 60_000).toISOString() });
    return { state: "failed", delivered: false };
  }
}
