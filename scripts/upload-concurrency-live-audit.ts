import assert from "node:assert/strict";
import { backendRequest, backendRpc, sha256, privateToken } from "../src/lib/backend-db.server";
import { getAttachmentStore, ATTACHMENT_BUCKET } from "../src/lib/lead/attachmentStorage";
import { verifyStoredAttachments } from "../src/lib/lead/verifyAttachments.server";
import { createPublicRef } from "../src/lib/project-delivery/reference";

const projects: string[] = [];
const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHWQAAAAASUVORK5CYII=", "base64"));
const makeOwner = async () => {
  const projectId = `build2-concurrent-${crypto.randomUUID()}`;
  const ownerHash = await sha256(privateToken()); projects.push(projectId);
  assert(await backendRpc<boolean>("claim_attachment_owner", { p_project: projectId, p_hash: ownerHash }));
  return { projectId, ownerHash };
};
const file = (n: number) => ({ name: `qa-${n}.png`, type: "image/png", bytes: new Uint8Array([...png, n]) });
const store = getAttachmentStore();
try {
  const owner = await makeOwner();
  assert.equal(await backendRpc("claim_attachment_owner", { p_project: owner.projectId, p_hash: "b".repeat(64) }), false, "another caller cannot claim existing owner");
  await assert.rejects(store.upload(file(80), { ...owner, ownerHash: "b".repeat(64) }));
  const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => store.upload(file(i), owner)));
  const successes = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof store.upload>>> => r.status === "fulfilled");
  assert.equal(successes.length, 8, "12 concurrent distinct requests must create exactly 8 files");
  const ledger = await backendRequest<Array<{ id: string; content_hash: string; storage_path: string; state: string }>>(`/rest/v1/attachment_uploads?project_id=eq.${owner.projectId}&select=id,content_hash,storage_path,state`);
  assert.equal(ledger.length, 8); assert(ledger.every((item) => item.state === "complete"));
  const firstIndex = results.findIndex((item) => item.status === "fulfilled");
  const replay = await Promise.all(Array.from({ length: 8 }, () => store.upload(file(firstIndex), owner)));
  assert(replay.every((item) => item.storagePath === successes[0]!.value.storagePath), "replay returns the same completed attachment");
  await verifyStoredAttachments(owner.projectId, [replay[0]!], owner.ownerHash);
  await assert.rejects(verifyStoredAttachments(owner.projectId, [replay[0]!], "b".repeat(64)));
  const interrupted = ledger[0]!;
  await backendRequest(`/rest/v1/attachment_uploads?id=eq.${interrupted.id}`, { method: "PATCH", body: JSON.stringify({ state: "failed" }) });
  const interruptedIndex = await (async () => { for (let i=0;i<12;i++) if(await sha256(file(i).bytes) === interrupted.content_hash) return i; throw new Error("Fixture missing"); })();
  const recovered = await store.upload(file(interruptedIndex), owner);
  assert.equal(recovered.storagePath, interrupted.storage_path, "recovery uses the prior immutable object");
  assert.equal((await backendRequest<unknown[]>(`/rest/v1/attachment_uploads?project_id=eq.${owner.projectId}&select=id`)).length,8);
  console.log("PASS — live: 12 concurrent requests → exactly 8, owner rejection, 8 replays → one object, interrupted upload recovery without duplicates");

  const grantOwner = await makeOwner();
  const grant = await sha256(privateToken());
  const entry = await backendRpc<{ id: string }>("reserve_attachment", { p_project: grantOwner.projectId, p_owner: grantOwner.ownerHash, p_content: await sha256(file(90).bytes), p_name: "qa.png", p_mime: "image/png", p_size: file(90).bytes.length, p_grant: grant });
  assert(await backendRpc("consume_attachment_grant", { p_id: entry.id, p_owner: grantOwner.ownerHash, p_grant: grant }));
  assert.equal(await backendRpc("consume_attachment_grant", { p_id: entry.id, p_owner: grantOwner.ownerHash, p_grant: grant }),false, "grant consumed only once");
  await backendRequest(`/rest/v1/attachment_uploads?id=eq.${entry.id}`,{method:"PATCH",body:JSON.stringify({state:"reserved",granted_until:new Date(Date.now()-60_000).toISOString()})});
  assert.equal(await backendRpc("consume_attachment_grant", { p_id: entry.id, p_owner: grantOwner.ownerHash, p_grant: grant }),false, "expired grant rejected");
  console.log("PASS — live: one-time grant replay rejected; five-minute grant expiry enforced by database");

  const failureOwner = await makeOwner();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url, options) => String(url).includes("/storage/v1/object/") && options?.method === "POST"
      ? new Response("", { status: 413 }) : originalFetch(url, options)) as typeof fetch;
    for (let n=100;n<108;n++) await assert.rejects(store.upload(file(n),failureOwner));
  } finally { globalThis.fetch=originalFetch; }
  assert.equal((await backendRequest<unknown[]>(`/rest/v1/attachment_uploads?project_id=eq.${failureOwner.projectId}&select=id`)).length,0,"eight definitive failures must release all slots");
  const validAfterFailure=await store.upload(file(110),failureOwner);assert(validAfterFailure.storagePath);
  const uncertainOwner=await makeOwner();
  try {
    globalThis.fetch=(async(url,options)=>{if(String(url).includes("/storage/v1/object/")&&options?.method==="POST")throw new Error("Simulated interrupted transport");return originalFetch(url,options);}) as typeof fetch;
    await assert.rejects(store.upload(file(111),uncertainOwner));
  } finally {globalThis.fetch=originalFetch;}
  assert.equal((await backendRequest<unknown[]>(`/rest/v1/attachment_uploads?project_id=eq.${uncertainOwner.projectId}&select=id`)).length,1,"uncertain failure retains recoverable reservation");
  await store.upload(file(111),uncertainOwner);
  assert.equal((await backendRequest<unknown[]>(`/rest/v1/attachment_uploads?project_id=eq.${uncertainOwner.projectId}&select=id&state=eq.complete`)).length,1);
  console.log("PASS — live ledger: eight definitive rejections release slots; uncertain interruption retains reservation and safely recovers");

  const recoveryOwner = await makeOwner();
  const publicRef = createPublicRef(), editHash = await sha256(privateToken()), replacementHash = await sha256(privateToken());
  await backendRequest("/rest/v1/projects",{method:"POST",body:JSON.stringify({public_ref:publicRef,project_id:recoveryOwner.projectId,edit_token_hash:editHash,snapshot_version:1,snapshot:{}})});
  try {
    const forgedRef=createPublicRef(), forgedHash=await sha256(privateToken());
    await backendRequest("/rest/v1/projects",{method:"POST",body:JSON.stringify({public_ref:forgedRef,project_id:recoveryOwner.projectId,edit_token_hash:forgedHash,snapshot_version:1,snapshot:{}})});
    try { assert.equal(await backendRpc("claim_attachment_owner",{p_project:recoveryOwner.projectId,p_hash:replacementHash,p_ref:forgedRef,p_edit_hash:forgedHash}),false,"a fabricated extra save with same ID must not recover owner"); }
    finally { await backendRequest(`/rest/v1/projects?public_ref=eq.${forgedRef}`,{method:"DELETE"}); }
    assert.equal(await backendRpc("claim_attachment_owner",{p_project:recoveryOwner.projectId,p_hash:replacementHash,p_ref:publicRef,p_edit_hash:"0".repeat(64)}),false);
    assert(await backendRpc("claim_attachment_owner",{p_project:recoveryOwner.projectId,p_hash:replacementHash,p_ref:publicRef,p_edit_hash:editHash}));
    await assert.rejects(store.upload(file(91),recoveryOwner));
    console.log("PASS — live: only the saved-project edit token recovers upload ownership; previous capability revoked");
  } finally { await backendRequest(`/rest/v1/projects?public_ref=eq.${publicRef}`,{method:"DELETE"}); }
} finally {
  for (const projectId of projects) {
    const entries=await backendRequest<Array<{storage_path:string}>>(`/rest/v1/attachment_uploads?project_id=eq.${projectId}&select=storage_path`);
    if(entries.length) await backendRequest(`/storage/v1/object/${ATTACHMENT_BUCKET}`,{method:"DELETE",body:JSON.stringify({prefixes:entries.map(item=>item.storage_path)})});
    await backendRequest(`/rest/v1/attachment_uploads?project_id=eq.${projectId}`,{method:"DELETE"});
    await backendRequest(`/rest/v1/attachment_owners?project_id=eq.${projectId}`,{method:"DELETE"});
  }
  console.log("PASS — disposable concurrency files and ownership records cleaned");
}
