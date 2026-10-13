import assert from "node:assert/strict";
import { backendRequest } from "../src/lib/backend-db.server";
import { getProjectStore } from "../src/lib/project-delivery/store";
import { saveProject, loadSharedProject, shareableProject } from "../src/lib/project-delivery/service";
import { createProjectId, parseProjectConfiguration, serializeProjectConfiguration, type ProjectConfiguration } from "../src/lib/pool/project";
import { projectSnapshotFingerprint } from "../src/lib/project-delivery/client";
import { createEditToken, isPublicRef } from "../src/lib/project-delivery/reference";
const store = getProjectStore();
assert(store.durable && store.kind === "supabase", "live gate never falls back to memory");
if (process.env.RENOVATION_CLOUD_MODE === "prepare") {
  const ref = process.env.RENOVATION_SOURCE!;
  assert(isPublicRef(ref));
  const shared = await loadSharedProject(store, ref);
  const original = parseProjectConfiguration(shared.snapshot);
  assert.equal(original.config.projectType, "renovation");
  assert(original.renovation.existing, "actual browser existing choices must survive cloud storage");
  const snapshot = { ...original, projectId: createProjectId() };
  const saved = await saveProject(store, { snapshot: serializeProjectConfiguration(snapshot) });
  console.log(JSON.stringify({ source: ref, readonly: saved.publicRef, finish: snapshot.config.finish }));
} else {
  const cases = JSON.parse(process.env.RENOVATION_CLOUD_CASES ?? "[]") as Array<{ finish: "liner" | "mosaic"; viewport: string; source: string; copy: string }>;
  assert.equal(cases.length, 6);
  for (const finish of ["liner", "mosaic"]) for (const viewport of ["1440x900", "390x844", "430x932"])
    assert.equal(cases.filter(c => c.finish === finish && c.viewport === viewport).length, 1, "mandatory browser matrix cell");
  for (const item of cases) {
    assert(isPublicRef(item.source) && isPublicRef(item.copy));
    const rows = await backendRequest<Array<{ public_ref: string; project_id: string; snapshot: ProjectConfiguration }>>(
      `/rest/v1/projects?public_ref=in.(${item.source},${item.copy})&select=public_ref,project_id,snapshot`);
    const source = rows.find(r => r.public_ref === item.source)!;
    const copy = rows.find(r => r.public_ref === item.copy)!;
    assert(source && copy, "source and browser Save Copy must really persist");
    assert.notEqual(source.project_id, copy.project_id);
    assert.equal(copy.snapshot.projectId, copy.project_id);
    assert.equal(copy.snapshot.config.finish, item.finish);
    const expected = shareableProject({ ...parseProjectConfiguration(JSON.stringify(source.snapshot)), projectId: copy.project_id });
    assert.equal(projectSnapshotFingerprint(copy.snapshot), projectSnapshotFingerprint(expected), "ZERO copy/saved snapshot mismatches");
    assert.deepEqual(copy.snapshot.renovation.existing, source.snapshot.renovation.existing, "existing conditions cannot be lost");
    const shared = await loadSharedProject(store, item.copy);
    assert(shared.durable && !shared.snapshot.includes("pool-shaper-qa@example.com"), "shared links never disclose customer contact");
    assert.equal(projectSnapshotFingerprint(parseProjectConfiguration(shared.snapshot)), projectSnapshotFingerprint(shareableProject(copy.snapshot)));
    const leads = await backendRequest<Array<{ request_id: string; project_id: string; project_reference: string;
      project_configuration: ProjectConfiguration; customer_name: string; customer_email: string; notes: string; privacy_accepted: boolean; status: string }>>(
      `/rest/v1/leads?project_reference=eq.${item.copy}&select=request_id,project_id,project_reference,project_configuration,customer_name,customer_email,notes,privacy_accepted,status`);
    assert.equal(leads.length, 1, "one browser quote creates one durable lead");
    const lead = leads[0]!;
    assert.equal(lead.customer_email, "pool-shaper-qa@example.com");
    assert(lead.notes.startsWith(`BUILD3 CLOUD QA ${item.finish.toUpperCase()} ${item.viewport.split("x")[0]}`), "synthetic QA only");
    assert.equal(lead.project_id, copy.project_id);
    assert.equal(lead.project_reference, copy.public_ref);
    assert(lead.privacy_accepted && lead.status !== "email_sent");
    assert.equal(projectSnapshotFingerprint(shareableProject(lead.project_configuration)), projectSnapshotFingerprint(shareableProject(copy.snapshot)), "quote is exact saved project");
    const outbox = await backendRequest<Array<{ provider_id: string | null; state: string; error_code: string }>>(
      `/rest/v1/lead_notifications?request_id=eq.${lead.request_id}&select=provider_id,state,error_code`);
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0]!.provider_id, null, "no real email during QA");
    assert.equal(outbox[0]!.state, "failed");
    assert.equal(outbox[0]!.error_code, "EMAIL_NOT_CONFIGURED");
    await assert.rejects(saveProject(store, { publicRef: item.copy, editToken: createEditToken(),
      snapshot: serializeProjectConfiguration(copy.snapshot) }), (e: unknown) => e instanceof Error && "code" in e && e.code === "forbidden");
    console.log(`PASS — ${item.finish} ${item.viewport}: cloud copy/share/quote exact identity, privacy, one lead/outbox, invalid edit token rejected, no email sent.`);
  }
  console.log("PASS — 6 real browser renovation cloud cases; ZERO snapshot mismatches.");
}
