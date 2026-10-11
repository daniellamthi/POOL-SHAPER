import assert from "node:assert/strict";
import { backendRequest } from "../src/lib/backend-db.server";
import { getLeadStore } from "../src/lib/lead/storage";
import { notificationStore, processLeadNotification, syncLeadNotificationStatus } from "../src/lib/lead/leadNotification.server";
import { notificationFixture } from "./backend-fixtures";
import { dueNotificationIds } from "../src/lib/lead/notificationQueue.server";

const requests:string[]=[];
const environment={RESEND_API_KEY:"fake-qa-never-transmitted",LEAD_FROM_EMAIL:"Progetti <progetti@piscinewellness.com>",LEAD_SENDER_DOMAIN_VERIFIED:"true"};
const make=async()=>{const submission=notificationFixture();requests.push(submission.requestId);assert((await getLeadStore().upsertLead(submission,`notification-qa-${submission.requestId}`)).stored);return submission.requestId;};
try {
  const request=await make();let posts=0,payload="",key="",event="sent";
  const provider=(async (_:unknown,options?:RequestInit)=>{
    if(options?.method==="POST") {posts++;payload=String(options.body);key=new Headers(options.headers).get("Idempotency-Key")!;return new Response(JSON.stringify({id:`qa-${request}`}));}
    return new Response(JSON.stringify({last_event:event}));
  }) as typeof fetch;
  const all=await Promise.all(Array.from({length:20},()=>processLeadNotification(request,{env:environment,fetcher:provider})));
  assert.equal(posts,1);assert(all.every(result=>!result.delivered));assert(payload.includes("PW-0000-000000"));assert.equal(key,`pool-shaper-lead/${request}`);
  event="delivered";assert((await processLeadNotification(request,{env:environment,fetcher:provider})).delivered);
  const duplicate=await notificationStore.event(`poll:qa-${request}:delivered`,`qa-${request}`,"delivered",new Date().toISOString());assert.equal(duplicate,false);
  assert.equal(posts,1);
  await Promise.all(Array.from({length:20},()=>syncLeadNotificationStatus(request)));
  assert.equal((await backendRequest<Array<{status:string}>>(`/rest/v1/leads?request_id=eq.${request}&select=status`))[0]?.status,"email_sent","late worker sync cannot overwrite delivered webhook");
  console.log("PASS — live queue: lead exists first; 20 workers → one mocked provider send; accepted/sent/delivered distinct; webhook duplicate ignored");

  const retry=await make();let count=0;const bodies:string[]=[];
  const flaky=(async (_:unknown,options?:RequestInit)=>{count++;bodies.push(String(options?.body));return count===1?new Response("",{status:503}):new Response(JSON.stringify({id:`qa-${retry}`}));}) as typeof fetch;
  await processLeadNotification(retry,{env:environment,fetcher:flaky});
  await processLeadNotification(retry,{env:environment,fetcher:flaky});assert.equal(count,1,"backoff blocks early retry");
  await backendRequest(`/rest/v1/lead_notifications?request_id=eq.${retry}`,{method:"PATCH",body:JSON.stringify({next_attempt_at:new Date(0).toISOString()})});
  assert.equal((await processLeadNotification(retry,{env:environment,fetcher:flaky})).state,"accepted");assert.equal(bodies[0],bodies[1]);
  await notificationStore.event(`bounce-${retry}`,`qa-${retry}`,"bounced",new Date().toISOString());
  assert.equal((await notificationStore.ensure(retry)).state,"bounced");
  await syncLeadNotificationStatus(retry);
  assert.equal((await backendRequest<Array<{status:string}>>(`/rest/v1/leads?request_id=eq.${retry}&select=status`))[0]?.status,"email_failed","CRM lead mirrors bounce state");
  console.log("PASS — live queue: persisted retry/backoff and identical payload; bounce tracked independently");

  const expired=await make();await notificationStore.ensure(expired);
  await backendRequest(`/rest/v1/lead_notifications?request_id=eq.${expired}`,{method:"PATCH",body:JSON.stringify({state:"processing",first_attempt_at:new Date(Date.now()-24*3600_000).toISOString(),lease_until:new Date(0).toISOString()})});
  let called=false;
  const blocked=await processLeadNotification(expired,{env:environment,fetcher:(async()=>{called=true;throw new Error();}) as typeof fetch});
  assert.equal(called,false);assert.equal(blocked.state,"blocked");
  const unconfigured=await make();await processLeadNotification(unconfigured,{env:{},fetcher:(async()=>{called=true;throw new Error();}) as typeof fetch});assert.equal(called,false);
  assert.equal((await backendRequest<unknown[]>(`/rest/v1/leads?request_id=eq.${unconfigured}&select=request_id`)).length,1);
  console.log("PASS — live queue: uncertain requests beyond 23h never resent; missing credentials retain the lead, no provider call");
  const terminal = await Promise.all(Array.from({length:26},async()=>{const id=await make();await notificationStore.ensure(id);await backendRequest(`/rest/v1/lead_notifications?request_id=eq.${id}`,{method:"PATCH",body:JSON.stringify({state:"blocked",retryable:false,next_attempt_at:new Date(0).toISOString()})});return id;}));
  const next=await make();await notificationStore.ensure(next);await backendRequest(`/rest/v1/lead_notifications?request_id=eq.${next}`,{method:"PATCH",body:JSON.stringify({next_attempt_at:new Date(1).toISOString()})});
  const due=await dueNotificationIds();assert(due.includes(next));assert(terminal.every(id=>!due.includes(id)));
  console.log("PASS — live worker: 26 older terminal records cannot starve a newer due notification");
  const leased=await Promise.all(Array.from({length:25},async()=>{const id=await make();await notificationStore.ensure(id);await backendRequest(`/rest/v1/lead_notifications?request_id=eq.${id}`,{method:"PATCH",body:JSON.stringify({state:"processing",lease_until:new Date(Date.now()+60_000).toISOString(),next_attempt_at:new Date(0).toISOString()})});return id;}));
  const afterLeases=await dueNotificationIds();assert(afterLeases.includes(next));assert(leased.every(id=>!afterLeases.includes(id)));
  console.log("PASS — live worker: 25 active leases do not starve pending records; late status sync preserves delivered/bounced evidence");
} finally {
  for(const request of requests) {
    await backendRequest(`/rest/v1/notification_events?provider_id=eq.qa-${request}`,{method:"DELETE"});
    await backendRequest(`/rest/v1/lead_notifications?request_id=eq.${request}`,{method:"DELETE"});
    await backendRequest(`/rest/v1/leads?request_id=eq.${request}`,{method:"DELETE"});
  }
  console.log("PASS — notification QA records cleaned; no email sent to customers or business recipient");
}
