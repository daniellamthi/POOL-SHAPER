import assert from 'node:assert/strict';
import { getAttachmentStore, ATTACHMENT_BUCKET } from '../src/lib/lead/attachmentStorage';
import { verifyStoredAttachments } from '../src/lib/lead/verifyAttachments.server';
import { assertPoolShaperTarget } from '../src/lib/supabase-target.server';
import { backendRpc, sha256, privateToken, backendRequest } from '../src/lib/backend-db.server';
const url=process.env['SUPABASE_URL'] ?? '';
const key=process.env['SUPABASE_SERVICE_ROLE_KEY'];
assertPoolShaperTarget(url); assert(key);
const projectId=`build2-qa-${crypto.randomUUID()}`;
const bytes=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHWQAAAAASUVORK5CYII=','base64'));
const ownerHash=await sha256(privateToken());
assert(await backendRpc('claim_attachment_owner',{p_project:projectId,p_hash:ownerHash}));
const object=await getAttachmentStore().upload({name:'qa.png',type:'image/png',bytes},{projectId,ownerHash});
try {
  await verifyStoredAttachments(projectId,[object],ownerHash);
  await assert.rejects(verifyStoredAttachments('other-project',[object],ownerHash));
  await assert.rejects(verifyStoredAttachments(projectId,[{...object,size:1}],ownerHash));
  const publicRead=await fetch(`${url}/storage/v1/object/public/${ATTACHMENT_BUCKET}/${object.storagePath}`);
  assert(!publicRead.ok,'private object must not be publicly downloadable');
  console.log('PASS — real private attachment: upload, stored metadata, project binding, forged size rejection, public read denied');
} finally {
  const removed=await fetch(`${url}/storage/v1/object/${ATTACHMENT_BUCKET}`,{method:'DELETE',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[object.storagePath]})});
  assert(removed.ok,'QA object cleanup failed');
  await backendRequest(`/rest/v1/attachment_uploads?project_id=eq.${projectId}`,{method:'DELETE'});
  await backendRequest(`/rest/v1/attachment_owners?project_id=eq.${projectId}`,{method:'DELETE'});
  console.log('PASS — disposable QA attachment removed');
}
