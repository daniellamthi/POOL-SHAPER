import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const env=parseEnv(fs.readFileSync('.env.local','utf8'));
const url='https://waetxxqdlsuanqescuye.supabase.co',pub=process.env.BACKEND_QA_PUBLIC_KEY;
assert.equal(env.SUPABASE_URL,url);assert(env.SUPABASE_SERVICE_ROLE_KEY&&pub);
const service={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'};
const call=async(path,options={})=>{const r=await fetch(url+path,{headers:service,...options});if(!r.ok)throw new Error(`QA HTTP ${r.status}`);const body=await r.text();return body?JSON.parse(body):null;};
let userId,token;const requestId=randomUUID(),path=`rls-qa-${randomUUID()}/${randomUUID()}-qa.png`;let checks=0;
try {
  const email=`build2-rls-${randomUUID()}@example.com`,password=randomBytes(32).toString('base64url');
  const user=await call('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email,password,email_confirm:true,app_metadata:{purpose:'build2-final-rls-qa'}})});userId=user.id;
  const session=await call('/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:pub,'Content-Type':'application/json'},body:JSON.stringify({email,password})});token=session.access_token;assert(token&&session.user.id===userId);
  assert((await fetch(url+'/auth/v1/settings',{headers:{apikey:pub}})).ok);
  assert((await fetch(url+'/auth/v1/user',{headers:{apikey:pub,Authorization:`Bearer ${token}`}})).ok);
  const lead={request_id:requestId,idempotency_key:`rls-${requestId}`,project_id:`qa-${requestId}`,schema_version:1,customer_name:'QA',customer_email:'qa@example.com',customer_phone:'000',project_location:'Test',timing:'evaluating',privacy_accepted:true,marketing_consent:false,project_configuration:{},notes:'Original QA'};
  await call('/rest/v1/leads',{method:'POST',body:JSON.stringify(lead)});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHWQAAAAASUVORK5CYII=','base64');
  const uploaded=await fetch(url+'/storage/v1/object/pool-shaper-attachments/'+path,{method:'POST',headers:{...service,'Content-Type':'image/png'},body:png});assert(uploaded.ok);
  assert((await fetch(url+'/storage/v1/object/authenticated/pool-shaper-attachments/'+path,{headers:service})).ok);
  for(const [role,headers] of [['anon',{apikey:pub,'Content-Type':'application/json'}],['authenticated',{apikey:pub,Authorization:`Bearer ${token}`,'Content-Type':'application/json'}]]) {
    for(const [table,key] of [['projects','public_ref'],['attachment_owners','project_id'],['attachment_uploads','id'],['lead_notifications','request_id'],['notification_events','event_id']]) {
      for(const [method,body] of [['GET',null],['POST',{[key]:key==='request_id'||key==='id'?randomUUID():'qa'}],['PATCH',{[key]:key==='request_id'||key==='id'?randomUUID():'qa'}],['DELETE',null]]) {
        const filter=key==='request_id'||key==='id'?randomUUID():'qa';
        const response=await fetch(url+`/rest/v1/${table}`+(method==='POST'?'':`?${key}=eq.${filter}`),{method,headers,...(body?{body:JSON.stringify(body)}:{})});
        const error=await response.json();assert([401,403].includes(response.status)&&error.code==='42501',`${role} ${table} ${method} is denied by Postgres`);checks++;
      }
    }
    const funcs={claim_attachment_owner:{p_project:'qa',p_hash:'0'.repeat(64)},reserve_attachment:{p_project:'qa',p_owner:'0'.repeat(64),p_content:'0'.repeat(64),p_name:'qa.jpg',p_mime:'image/jpeg',p_size:3,p_grant:'0'.repeat(64)},consume_attachment_grant:{p_id:randomUUID(),p_owner:'0'.repeat(64),p_grant:'0'.repeat(64)},release_failed_attachment:{p_id:randomUUID(),p_owner:'0'.repeat(64),p_grant:'0'.repeat(64)},claim_lead_notification:{p_request:requestId,p_lease:randomUUID()},record_notification_event:{p_event:'qa',p_provider:'qa',p_state:'delivered',p_at:new Date().toISOString()}};
    funcs.sync_lead_notification_status={p_request:requestId};
    for(const [name,body] of Object.entries(funcs)) {const r=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(body)});const error=await r.json();assert([401,403].includes(r.status)&&error.code==='42501',`${role} cannot invoke ${name}`);checks++;}
    const read=await fetch(url+`/rest/v1/leads?request_id=eq.${requestId}`,{headers});assert(read.ok&&JSON.stringify(await read.json())==='[]');checks++;
    const insert=await fetch(url+'/rest/v1/leads',{method:'POST',headers,body:JSON.stringify({...lead,request_id:randomUUID(),idempotency_key:randomUUID()})});assert((await insert.json()).code==='42501');checks++;
    for(const method of ['PATCH','DELETE']) {const r=await fetch(url+`/rest/v1/leads?request_id=eq.${requestId}`,{method,headers:{...headers,Prefer:'return=representation'},...(method==='PATCH'?{body:JSON.stringify({notes:'ATTACK'})}:{})});assert(r.ok&&JSON.stringify(await r.json())==='[]');const unchanged=await call(`/rest/v1/leads?request_id=eq.${requestId}&select=notes`);assert.equal(unchanged[0].notes,'Original QA');checks++;}
    const denied=await fetch(url+'/storage/v1/object/authenticated/pool-shaper-attachments/'+path,{headers});assert(!denied.ok,'private object read denied');checks++;
    const overwrite=await fetch(url+'/storage/v1/object/pool-shaper-attachments/'+path,{method:'PUT',headers:{...headers,'Content-Type':'image/png'},body:png});assert(!overwrite.ok,'private object overwrite denied');checks++;
    const remove=await fetch(url+'/storage/v1/object/pool-shaper-attachments',{method:'DELETE',headers,body:JSON.stringify({prefixes:[path]})});
    // Storage may answer 200 with no deleted entries; prove the service-owned object remains.
    assert((await fetch(url+'/storage/v1/object/authenticated/pool-shaper-attachments/'+path,{headers:service})).ok,'unauthorized delete cannot remove object');checks++;
    console.log(`PASS — ${role}: real session; private tables/functions denied, lead read/insert/update/delete protected, private object read/overwrite/delete rejected`);
  }
  console.log(`PASS — ${checks} live authorization/RLS checks`);
} finally {
  await call('/storage/v1/object/pool-shaper-attachments',{method:'DELETE',body:JSON.stringify({prefixes:[path]})});
  await call(`/rest/v1/leads?request_id=eq.${requestId}`,{method:'DELETE'});
  if(token)assert((await fetch(url+'/auth/v1/logout?scope=global',{method:'POST',headers:{apikey:pub,Authorization:`Bearer ${token}`}})).ok);
  if(userId)await call('/auth/v1/admin/users/'+userId,{method:'DELETE'});
  console.log('PASS — final RLS QA user/session/object/lead cleaned');
}
