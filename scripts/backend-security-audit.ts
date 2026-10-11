import assert from 'node:assert/strict';
import { checkAttachment, matchesAttachmentSignature } from '../src/lib/lead/attachmentPolicy';
import { verifyStoredAttachments } from '../src/lib/lead/verifyAttachments.server';
import { getAttachmentStore } from '../src/lib/lead/attachmentStorage';
import { getProjectStore } from '../src/lib/project-delivery/store';
import { getLeadStore } from '../src/lib/lead/storage';

const originalFetch = globalThis.fetch;
const originalUrl = process.env['SUPABASE_URL'];
const originalKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
try {
  delete process.env['SUPABASE_URL']; delete process.env['SUPABASE_SERVICE_ROLE_KEY'];
  assert.throws(getProjectStore); assert.throws(getLeadStore);
  process.env['SUPABASE_URL'] = 'https://invalid.example';
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-only';
  for (const factory of [getProjectStore, getLeadStore, getAttachmentStore]) assert.throws(factory);
  process.env['SUPABASE_URL'] = 'https://waetxxqdlsuanqescuye.supabase.co';
  assert.equal(checkAttachment({name:'photo.jpg',type:'application/pdf',size:12}).ok,false);
  assert.equal(checkAttachment({name:'photo.jpg',type:'image/jpeg',size:NaN}).ok,false);
  assert.equal(matchesAttachmentSignature(new Uint8Array([1,2,3]),'image/jpeg'),false);
  assert.equal(matchesAttachmentSignature(new Uint8Array([255,216,255]),'image/jpeg'),true);
  const item = {name:'qa.jpg',storagePath:'qa-project/12345678-1234-1234-1234-123456789abc-qa.jpg',mimeType:'image/jpeg',size:3};
  let calls=0;
  const ownerHash='a'.repeat(64);
  globalThis.fetch = async (url) => {calls++; return new Response(JSON.stringify(String(url).includes('attachment_owners') ? [{project_id:'qa-project'}] : String(url).includes('attachment_uploads') ? [{size:3,mime_type:'image/jpeg'}] : {size:3,content_type:'image/jpeg'}));};
  await verifyStoredAttachments('qa-project',[item],ownerHash);
  assert.equal(calls,3);
  await assert.rejects(verifyStoredAttachments('other-project',[item],ownerHash));
  assert.equal(calls,4, 'cross-project path rejected before object request');
  await assert.rejects(verifyStoredAttachments('qa-project',[{...item,size:4}],ownerHash));
  await assert.rejects(verifyStoredAttachments('qa-project',[item,item],ownerHash));
  globalThis.fetch = async () => new Response('',{status:404});
  await assert.rejects(verifyStoredAttachments('qa-project',[item],ownerHash));
  await assert.rejects(verifyStoredAttachments('qa-project',[item]));
  globalThis.fetch = async () => new Response('',{status:503});
  await assert.rejects(getAttachmentStore().upload({name:'qa.jpg',type:'image/jpeg',bytes:new Uint8Array([255,216,255])},{projectId:'qa-project',ownerHash}));
  await assert.rejects(getAttachmentStore().upload({name:'qa.jpg',type:'image/jpeg',bytes:new Uint8Array([255,216,255])},{projectId:'../escape',ownerHash}));
  console.log('PASS — backend security: target lock, fail-closed storage, MIME/signature, stored-object validation, missing/forged/cross-project/duplicate attachments, failed quota lookup, traversal');
} finally {
  globalThis.fetch=originalFetch;
  if(originalUrl===undefined) delete process.env['SUPABASE_URL']; else process.env['SUPABASE_URL']=originalUrl;
  if(originalKey===undefined) delete process.env['SUPABASE_SERVICE_ROLE_KEY']; else process.env['SUPABASE_SERVICE_ROLE_KEY']=originalKey;
}
