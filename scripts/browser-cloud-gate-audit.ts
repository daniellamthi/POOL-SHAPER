import assert from "node:assert/strict";
import { backendRequest } from "../src/lib/backend-db.server";
import { getProjectStore } from "../src/lib/project-delivery/store";
import { loadSharedProject, saveProject, shareableProject } from "../src/lib/project-delivery/service";
import { createEditToken, isPublicRef } from "../src/lib/project-delivery/reference";
import { parseProjectConfiguration, serializeProjectConfiguration, type ProjectConfiguration } from "../src/lib/pool/project";
import { projectSnapshotFingerprint } from "../src/lib/project-delivery/client";

type BrowserCase = { scenario: "A" | "B" | "C"; viewport: string; source: string; copy: string };
const cases = JSON.parse(process.env.BROWSER_GATE_CASES ?? "[]") as BrowserCase[];
assert.equal(cases.length, 9, "all three projects at all three viewports are required");
assert.equal(new Set(cases.map(c => `${c.scenario}/${c.viewport}`)).size, 9);
for (const scenario of ["A", "B", "C"]) for (const viewport of ["1440x900", "390x844", "430x932"])
  assert(cases.some(c => c.scenario === scenario && c.viewport === viewport), "required matrix cell missing");
const store = getProjectStore();
const disposableLeads: string[] = [];
assert.equal(store.kind, "supabase");
assert.equal(store.durable, true, "never count memory as a live pass");
for (const item of cases) {
  assert(isPublicRef(item.source) && isPublicRef(item.copy));
  const rows = await backendRequest<Array<{ public_ref: string; project_id: string; snapshot_version: number; snapshot: ProjectConfiguration }>>(
    `/rest/v1/projects?public_ref=in.(${item.source},${item.copy})&select=public_ref,project_id,snapshot_version,snapshot`);
  const source = rows.find(row => row.public_ref === item.source)!;
  const copy = rows.find(row => row.public_ref === item.copy)!;
  assert(source && copy, "both records must really persist");
  assert.notEqual(copy.project_id, source.project_id, "Save Copy creates a new identity");
  assert.equal(copy.snapshot_version, copy.snapshot.schemaVersion);
  assert.equal(copy.snapshot.projectId, copy.project_id);
  const expected = shareableProject({ ...parseProjectConfiguration(JSON.stringify(source.snapshot)), projectId: copy.project_id });
  assert.equal(projectSnapshotFingerprint(copy.snapshot), projectSnapshotFingerprint(expected), "exact copied configuration: no stale state or option mismatch");
  const shared = await loadSharedProject(store, item.copy);
  assert(shared.durable);
  assert.equal(projectSnapshotFingerprint(parseProjectConfiguration(shared.snapshot)), projectSnapshotFingerprint(shareableProject(copy.snapshot)));
  assert(!shared.snapshot.includes("pool-shaper-qa@example.com"), "public shares exclude lead contacts");
  const leads = await backendRequest<Array<{ request_id: string; project_id: string; project_reference: string; project_configuration: ProjectConfiguration; status: string; privacy_accepted: boolean; marketing_consent: boolean; customer_name: string; customer_email: string; notes: string }>>(
    `/rest/v1/leads?project_reference=eq.${item.copy}&select=request_id,project_id,project_reference,project_configuration,status,privacy_accepted,marketing_consent,customer_name,customer_email,notes`);
  assert.equal(leads.length, 1, "one browser submission creates exactly one lead");
  const lead = leads[0]!;
  assert.equal(lead.customer_name, "POOL-SHAPER QA CLOUD");
  assert.equal(lead.customer_email, "pool-shaper-qa@example.com");
  assert(lead.notes.startsWith(`BUILD2 CLOUD QA ${item.scenario} ${item.viewport.split("x")[0]} `), "only synthetic QA leads may be verified/cleaned here");
  disposableLeads.push(lead.request_id);
  assert.equal(lead.project_id, copy.project_id);
  assert.equal(lead.project_reference, copy.public_ref);
  assert.equal(projectSnapshotFingerprint(shareableProject(lead.project_configuration)), projectSnapshotFingerprint(shareableProject(copy.snapshot)), "quote snapshot matches the saved project");
  assert(lead.privacy_accepted && !lead.marketing_consent);
  assert.notEqual(lead.status, "email_sent", "QA cannot claim real email delivery");
  const outbox = await backendRequest<Array<{ provider_id: string | null; state: string; error_code: string }>>(`/rest/v1/lead_notifications?request_id=eq.${lead.request_id}&select=provider_id,state,error_code`);
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0]!.provider_id, null, "no real provider send during QA");
  assert.equal(outbox[0]!.state, "failed", "missing sender configuration cannot claim accepted/sent/delivered");
  assert.equal(outbox[0]!.error_code, "EMAIL_NOT_CONFIGURED", "missing email configuration is explicit and recoverable");
  await assert.rejects(saveProject(store, { publicRef: item.copy, editToken: createEditToken(), snapshot: serializeProjectConfiguration({ ...copy.snapshot, config: { ...copy.snapshot.config, sceneTime: copy.snapshot.config.sceneTime === "night" ? "day" : "night" } }) }), (error: unknown) => error instanceof Error && "code" in error && error.code === "forbidden");
  const unchanged = await loadSharedProject(store, item.copy);
  assert.equal(unchanged.snapshot, shared.snapshot, "invalid edit token never changes persisted data");
  console.log(`PASS — live browser ${item.scenario} ${item.viewport}: exact copy/quote/share identity, one lead/outbox, privacy, invalid token rejected`);
}
console.log("PASS — 9 live browser cases, ZERO snapshot/identity mismatches; no email sent");
if (process.env.BROWSER_GATE_CLEANUP_LEADS === "1") {
  for (const requestId of disposableLeads) {
    await backendRequest(`/rest/v1/lead_notifications?request_id=eq.${requestId}`, { method: "DELETE" });
    await backendRequest(`/rest/v1/leads?request_id=eq.${requestId}`, { method: "DELETE" });
    assert.equal((await backendRequest<unknown[]>(`/rest/v1/leads?request_id=eq.${requestId}&select=request_id`)).length, 0);
  }
  console.log("PASS — only the 9 verified synthetic QA leads/outboxes cleaned; no future customer/business email can be triggered by them");
}
