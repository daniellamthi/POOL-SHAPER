import assert from "node:assert/strict";
import { processLeadNotification, type NotificationRow, type NotificationStore } from "../src/lib/lead/leadNotification.server";
import { verifyResendSignature, resendWebhook } from "../src/lib/lead/resendWebhook.server";
import { notificationFixture } from "./backend-fixtures";

const environment = { RESEND_API_KEY: "test-only", LEAD_FROM_EMAIL: "Progetti <progetti@piscinewellness.com>", LEAD_SENDER_DOMAIN_VERIFIED: "true" };
function queue() {
  const submission = notificationFixture();
  let row: NotificationRow = { request_id: submission.requestId, submission, payload: null, state: "pending", attempts: 0, lease_token: null, provider_id: null, first_attempt_at: null };
  const events = new Set<string>();
  const store: NotificationStore = {
    async ensure() { return structuredClone(row); },
    async claim(_, lease) { if (!["pending", "failed"].includes(row.state)) return null; row = { ...row, state: "processing", lease_token: lease, attempts: row.attempts + 1 }; return structuredClone(row); },
    async patch(_, lease, values) { assert.equal(lease,row.lease_token); row={...row,...values} as NotificationRow; },
    async event(id,_,state) { if(events.has(id)) return false; events.add(id); row.state=state; return true; },
  };
  return { store, request: submission.requestId, row: () => row };
}
const q=queue(); let sends=0; let body="", idempotency="";
const provider = (async (url: string | URL | Request, options?: RequestInit) => {
  if (options?.method === "POST") { sends++; body=String(options.body); idempotency=new Headers(options.headers).get("Idempotency-Key") ?? ""; return new Response(JSON.stringify({id:"qa-provider-id"})); }
  return new Response(JSON.stringify({last_event:"delivered"}));
}) as typeof fetch;
await Promise.all(Array.from({length:20},()=>processLeadNotification(q.request,{store:q.store,env:environment,fetcher:provider})));
assert.equal(sends,1,"concurrent workers issue only one provider request");
assert.equal(q.row().state,"accepted");
assert.equal(idempotency,`pool-shaper-lead/${q.request}`);
assert(body.includes(q.row().submission.projectReference!));
assert.deepEqual(JSON.parse(body).to,["info@piscinewellness.com"]);
assert.equal((await processLeadNotification(q.request,{store:q.store,env:environment,fetcher:provider})).delivered,true);
assert.equal(q.row().state,"delivered"); assert.equal(sends,1);
console.log("PASS — email concurrency: 20 workers → one send; stable key, Project ID, business recipient; accepted differs from delivered");

const retry=queue(); let firstBody="",secondBody="", retryKey="";let attempts=0;
const transient=(async (_: unknown,options?: RequestInit)=>{ attempts++; if(attempts===1) {firstBody=String(options?.body);retryKey=new Headers(options?.headers).get("Idempotency-Key")!;return new Response("",{status:503});} secondBody=String(options?.body);assert.equal(new Headers(options?.headers).get("Idempotency-Key"),retryKey);return new Response(JSON.stringify({id:"retry-provider-id"}));}) as typeof fetch;
assert.equal((await processLeadNotification(retry.request,{store:retry.store,env:environment,fetcher:transient})).state,"failed");
assert.equal((await processLeadNotification(retry.request,{store:retry.store,env:environment,fetcher:transient})).state,"accepted");
assert.equal(firstBody,secondBody,"provider retry uses exactly the persisted payload");
const missing=queue(); let called=false;
await processLeadNotification(missing.request,{store:missing.store,env:{},fetcher:(async()=>{called=true;throw new Error();}) as typeof fetch});
assert.equal(called,false); assert.equal(missing.row().state,"failed");
console.log("PASS — provider failure retains queue; retry preserves body/key; missing credentials never send or claim delivery");

const webhookBody=JSON.stringify({type:"email.bounced",created_at:new Date().toISOString(),data:{email_id:"qa-provider-id"}});
const timestamp=String(Math.floor(Date.now()/1000)), eventId="qa-event";
const secretBytes=crypto.getRandomValues(new Uint8Array(32));
const secret="whsec_"+Buffer.from(secretBytes).toString("base64");
const signingKey=await crypto.subtle.importKey("raw",secretBytes,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
const signature=Buffer.from(await crypto.subtle.sign("HMAC",signingKey,new TextEncoder().encode(`${eventId}.${timestamp}.${webhookBody}`))).toString("base64");
const headers=new Headers({"svix-id":eventId,"svix-timestamp":timestamp,"svix-signature":`v1,${signature}`});
assert(await verifyResendSignature(webhookBody,headers,secret));
assert.equal(await verifyResendSignature(webhookBody+"tampered",headers,secret),false);
assert.equal(await verifyResendSignature(webhookBody,headers,secret,Date.now()+600_000),false);
assert.equal(await verifyResendSignature(webhookBody,new Headers(),secret),false);
console.log("PASS — webhook signature valid; tampered body, stale timestamp and unsigned events rejected");

const originalFetch=globalThis.fetch;
const previous={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,webhook:process.env.RESEND_WEBHOOK_SECRET};
try {
  process.env.SUPABASE_URL="https://waetxxqdlsuanqescuye.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY="test-only-never-transmitted";
  process.env.RESEND_WEBHOOK_SECRET=secret;
  let associated=false,recorded=0;
  const uniqueEvents=new Set<string>();
  globalThis.fetch=async(url,options)=>{
    if(String(url).includes("/rpc/record_notification_event")) {
      const id=JSON.parse(String(options?.body)).p_event;
      if(!uniqueEvents.has(id)){uniqueEvents.add(id);recorded++;}
      return new Response(JSON.stringify(true));
    }
    return new Response(JSON.stringify(associated?[{request_id:q.request}]:[]));
  };
  const call=()=>resendWebhook(new Request("http://localhost/api/resend/webhook",{method:"POST",headers,body:webhookBody}));
  assert.equal((await call()).status,503,"early signed event requests provider retry rather than being lost");
  assert.equal(recorded,0);
  associated=true;
  assert.equal((await call()).status,200);assert.equal(recorded,1);
  assert.equal((await call()).status,200);assert.equal(recorded,1,"provider retry does not duplicate event");
  console.log("PASS — early signed webhook is retried after provider association; repeated event remains idempotent");
} finally {
  globalThis.fetch=originalFetch;
  for(const [key,value] of Object.entries({SUPABASE_URL:previous.url,SUPABASE_SERVICE_ROLE_KEY:previous.key,RESEND_WEBHOOK_SECRET:previous.webhook})) {
    if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
}
