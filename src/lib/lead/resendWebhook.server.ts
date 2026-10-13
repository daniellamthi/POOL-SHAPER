import { backendRequest } from "../backend-db.server";
import { notificationStore, type NotificationState } from "./leadNotification.server";

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

export async function verifyResendSignature(body: string, headers: Headers, secret: string, now = Date.now()): Promise<boolean> {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  if (!id || id.length > 128 || !timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || !secret.startsWith("whsec_")) return false;
  try {
    const key = await crypto.subtle.importKey("raw", decodeBase64(secret.slice(6)) as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const data = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
    for (const signature of (headers.get("svix-signature") ?? "").split(" ")) {
      if (!signature.startsWith("v1,")) continue;
      if (await crypto.subtle.verify("HMAC", key, decodeBase64(signature.slice(3)) as BufferSource, data)) return true;
    }
  } catch { return false; }
  return false;
}

export async function resendWebhook(request: Request): Promise<Response> {
  const secret = process.env["RESEND_WEBHOOK_SECRET"];
  if (!secret) return new Response("Webhook unavailable", { status: 503 });
  const reader = request.body?.getReader();
  if (!reader) return new Response("Invalid body", { status: 400 });
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 256_000) { await reader.cancel(); return new Response("Body too large", { status: 413 }); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const body = new TextDecoder().decode(bytes);
  if (!await verifyResendSignature(body, request.headers, secret)) return new Response("Invalid signature", { status: 401 });
  try {
    const event = JSON.parse(body) as { type?: string; created_at?: string; data?: { email_id?: string } };
    const state = event.type?.replace(/^email\./, "");
    const provider = event.data?.email_id;
    if (!state || !["sent", "delivered", "bounced", "failed"].includes(state)) return new Response("Ignored");
    if (!provider || !/^[A-Za-z0-9_-]{1,100}$/.test(provider) || !event.created_at || !Number.isFinite(Date.parse(event.created_at))) return new Response("Invalid event", { status: 400 });
    const tracked = await backendRequest<Array<{ request_id: string }>>(`/rest/v1/lead_notifications?provider_id=eq.${provider}&select=request_id`);
    // Resend can deliver the event before the send response's provider ID is stored.
    // Acknowledge only after association: a 503 asks the signed provider to retry.
    if (!tracked.length) return new Response("Association pending", { status: 503 });
    await notificationStore.event(request.headers.get("svix-id")!, provider, state as NotificationState, event.created_at);
    return new Response("OK");
  } catch { return new Response("Processing unavailable", { status: 503 }); }
}
