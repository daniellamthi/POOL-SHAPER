/** Targeted local contract audit. Memory storage is intentionally non-durable;
 * this does not claim cloud persistence, delivery or visual browser coverage. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import QRCode from "qrcode";
import { REFERENCE_FINISHES } from "../src/lib/pool/reference-finishes";
import { LEGACY_COPING_MATERIALS, copingMaterialsForPool } from "../src/lib/pool/coping-materials";
import { PAVING_FORMATS, pavingFormats, pavingLayout, pavingMaterialsForPool } from "../src/lib/pool/presentation";
import { configuratorTesting } from "../src/lib/pool/store";
import { resolveMaterials } from "../src/lib/pool/materials";
import { LINER_COLORS } from "../src/lib/pool/config";
import { parseProjectConfiguration, serializeProjectConfiguration, toProjectConfiguration, createProjectId } from "../src/lib/pool/project";
import { saveProject, loadSharedProject, shareableProject } from "../src/lib/project-delivery/service";
import { MemoryProjectStore } from "../src/lib/project-delivery/store";
import { buildProjectSummary } from "../src/lib/project-delivery/summary-model";
import { buildProjectBook, pdfText } from "../src/lib/project-delivery/projectBook";
import { projectSnapshotFingerprint, projectLinkIsDirty } from "../src/lib/project-delivery/client";
import { createPhotoSceneSpec } from "../src/lib/pool/photo-scene-spec";
import { leadSubmissionInputSchema } from "../src/lib/lead/schema";
import { formatLeadEmail } from "../src/lib/lead/formatLeadEmail";
import { clampInfinityEdgeParams } from "../src/lib/pool/infinity-edge";
import { buildOutline, offsetOutline } from "../src/lib/pool/geometry";
import { createPavingModules } from "../src/components/pool/three/pavingGeometry";
import { studioDeckInnerOffset } from "../src/components/pool/three/studioDeck";
import { translateText } from "../src/lib/i18n";
import type { PoolConfig } from "../src/lib/pool/types";
// The runner loads these exact approved Git objects without checking out or
// editing anything. Baseline id stays stable after the eventual new commit.
import { COPING_MATERIALS as baselineCoping } from "reference-baseline-coping";
import { resolveMaterials as baselineResolveMaterials } from "reference-baseline-materials";
import { PAVING as baselinePaving } from "reference-baseline-presentation";
import { parseProjectConfiguration as baselineParseProject } from "reference-baseline-project";

const APPROVED_HEAD = "b40924f7d1f6e61d79c5f586ec007dc3a33bf2de";
let checks = 0, scenarios = 0, deliveryCases = 0, pdfCases = 0, linerCases = 0;
const equal = (actual: unknown, expected: unknown, message: string) => { checks++; assert.deepEqual(actual, expected, message); };
const ok = (value: unknown, message: string) => { checks++; assert.ok(value, message); };
const sha = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const initial = configuratorTesting.createInitialState();
const store = new MemoryProjectStore();
// Valid synthetic PNG fixture for exercising the existing seventh PDF page;
// it is not a pool screenshot and is never used as visual QA evidence.
const exportFixtureImage = await QRCode.toDataURL("reference-material-export-fixture", { width: 64 });
const baseline: PoolConfig = { ...initial.config, projectType: "new", poolType: "in-ground", shape: "rectangle", shapeSelected: true,
  system: "skimmer", structure: "reinforced-concrete", copingMaterial: "travertine", paving: "gres", pavingFormat: "60x120",
  finish: "liner", features: [], equipment: [], uploads: [], poolAccess: "internalSteps", internalStairType: "linear",
  customer: { ...initial.config.customer, name: "Material QA", email: "material-qa@example.test" } };

equal(LEGACY_COPING_MATERIALS, baselineCoping, "Existing coping catalogue and values unchanged from approved commit");
// Owner-approved in 70ec939: retire Deck Marrone from choices, not from saved
// snapshots. Keep every other original descriptor exact, including WPC/PVC.
equal(copingMaterialsForPool("above-ground"), baselineCoping.filter(material => material.id !== "deck-marrone"),
  "Above-ground retains approved choices after the explicit brown-coping retirement");
ok(LEGACY_COPING_MATERIALS.some(material => material.id === "deck-marrone"), "Retired brown coping still restores historical snapshots");
ok(pavingMaterialsForPool("above-ground").every(finish => !finish.id.startsWith("reference-")), "Above-ground exposes no new reference paving");
equal(pavingMaterialsForPool("above-ground"), baselinePaving, "Every above-ground paving descriptor remains exactly approved");
const materialSource = readFileSync("src/lib/pool/materials.ts", "utf8");
const baselineSource = execFileSync("git", ["show", `${APPROVED_HEAD}:src/lib/pool/materials.ts`], { encoding: "utf8" });
const linerBlock = (source: string) => source.slice(source.indexOf("  // Visible-inox pools"), source.indexOf("    coping:"));
equal(sha(linerBlock(materialSource)), sha(linerBlock(baselineSource)), "Approved liner resolver source block byte-identical");

for (const reference of REFERENCE_FINISHES) {
  // Changing only coping cannot alter any liner selection or resolved shader
  // data: compare every actual liner catalogue entry with the approved code.
  for (const liner of LINER_COLORS) {
    const config = { ...baseline, linerColor: liner.id, copingMaterial: reference.id };
    const { coping: _currentCoping, ...currentInterior } = resolveMaterials(config);
    const { coping: _oldCoping, ...approvedInterior } = baselineResolveMaterials({ ...config, copingMaterial: "travertine" });
    equal(currentInterior, approvedInterior, `${reference.id}/${liner.id}: exact approved liner and water descriptors`);
    linerCases++;
  }
  for (const system of ["skimmer", "overflow", "infinity"] as const)
  for (const [length, width] of [[6, 3], [8, 4], [12, 5]] as const) {
    const config: PoolConfig = { ...baseline, system,
      dimensions: { ...baseline.dimensions, length, width, cornerRadius: 0 },
      ...(system === "infinity" ? { infinityEdge: clampInfinityEdgeParams({ enabled: true, side: 0 }) } : {}) };
    const start = { ...initial, config };
    const selected = configuratorTesting.reducer(start, { type: "setCopingMaterial", value: reference.id });
    equal(selected.config.paving, config.paving, "Coping selection leaves paving independent");
    equal(resolveMaterials(selected.config).coping.id, reference.id, "New coping actually reaches material resolver");
    equal(selected.config.linerColor, config.linerColor, "New coping leaves liner id intact");
    equal(selected.config.features, config.features, "New coping leaves approved options intact");
    for (const format of pavingFormats(reference.id)) {
      const withPaving = configuratorTesting.reducer(selected, { type: "setPaving", value: reference.id });
      const chosen = configuratorTesting.reducer(withPaving, { type: "setPavingFormat", value: format });
      equal(chosen.config.copingMaterial, reference.id, "Paving format never changes coping");
      equal(chosen.config.paving, reference.id, "Format update retains chosen paving");
      equal(chosen.config.pavingFormat, format, "Every compatible reference format is selectable");
      const independent = configuratorTesting.reducer(chosen, { type: "setCopingMaterial", value: "prun" });
      equal([independent.config.paving, independent.config.pavingFormat], [reference.id, format], "Legacy coping and new paving coexist independently");

      const project = toProjectConfiguration(createProjectId(), chosen.config, initial.renovation);
      const sourceSnapshot = serializeProjectConfiguration(project);
      const restored = parseProjectConfiguration(sourceSnapshot);
      equal([restored.config.copingMaterial, restored.config.paving, restored.config.pavingFormat], [reference.id, reference.id, format], "Save/reload preserves both references and format");
      const saved = await saveProject(store, { snapshot: sourceSnapshot });
      equal(saved.durable, false, "Local fixture is explicitly non-durable");
      const shared = await loadSharedProject(store, saved.publicRef);
      const sharedProject = parseProjectConfiguration(shared.snapshot);
      equal(projectSnapshotFingerprint(sharedProject), projectSnapshotFingerprint(shareableProject(restored)), "Actual delivery save/share functions retain exact normalized technical snapshot");
      ok(!shared.snapshot.includes("material-qa@example.test"), "Share strips contact information");
      equal(projectLinkIsDirty({ publicRef: saved.publicRef, editToken: saved.editToken!, savedSnapshot: sourceSnapshot }, restored), false, "Reload of selected references produces no false dirty state");
      const copy = { ...sharedProject, projectId: createProjectId() };
      const copySaved = await saveProject(store, { snapshot: serializeProjectConfiguration(copy) });
      const copyRestored = parseProjectConfiguration((await loadSharedProject(store, copySaved.publicRef)).snapshot);
      equal(copyRestored.config, sharedProject.config, "Saved copy retains exact technical configuration");
      ok(copySaved.publicRef !== saved.publicRef && copyRestored.projectId !== project.projectId, "Saved copy receives separate identities");

      const spec = createPhotoSceneSpec(restored);
      equal(spec.pool.materials.coping.id, reference.id, "Photo Spec carries actual coping descriptor");
      equal(spec.paving.id, reference.id, "Photo Spec carries independent paving material");
      equal(spec.paving.module, PAVING_FORMATS[format].module, "Photo Spec carries real metre-based selected module");
      const label = reference.title;
      for (const locale of ["it", "en"] as const) {
        const model = buildProjectSummary(restored, locale);
        const values = model.sections.flatMap(section => section.rows.map(row => row.value));
        const expectedLabel = locale === "it" ? label : reference.titleEn;
        ok(values.includes(expectedLabel), `${reference.id}/${locale}: premium summary/PDF data contains human-readable selected finish`);
        ok(values.includes(translateText(pavingLayout(reference.id, format).formatLabel, locale)), `${reference.id}/${locale}: summary/PDF data carries exact paving format in selected language`);
      }
      const leadInput = leadSubmissionInputSchema.parse({
        customer: { name: "Material QA", email: "material-qa@example.test", phone: "+39 000 0000000", projectLocation: "Local QA fixture" },
        commercial: { timing: "evaluating", notes: "Local contract test; do not send" }, privacy: { accepted: true, marketingConsent: false },
        website: "", idempotencyKey: `reference-material-test-${deliveryCases}`, projectReference: saved.publicRef, project: restored,
      });
      equal(leadInput.project, restored, "Existing quote server validation passes the identical complete project snapshot");
      const notification = formatLeadEmail({ requestId: createProjectId(), projectId: restored.projectId, projectReference: saved.publicRef,
        schemaVersion: restored.schemaVersion, createdAt: "2026-10-19T10:00:00.000Z", customer: leadInput.customer,
        commercial: leadInput.commercial, privacy: leadInput.privacy, project: leadInput.project, attachments: [] });
      ok(notification.text.includes(label) && notification.text.includes(saved.publicRef), "Quote notification formatter carries finish label and stable Project ID without sending");
      equal(serializeProjectConfiguration(project), sourceSnapshot, "Summary, Photo Spec and quote never mutate source snapshot");
      deliveryCases++;
    }
    const switched = configuratorTesting.reducer({ ...selected, config: { ...selected.config, paving: reference.id } }, { type: "setPoolType", value: "above-ground" });
    equal([switched.config.copingMaterial, switched.config.paving], ["travertine", "gres"], "Changing to above-ground safely drops only unsupported reference finishes");
    const above = { ...initial, config: { ...baseline, poolType: "above-ground" as const, structure: "modular-steel-panels" as const } };
    equal(configuratorTesting.reducer(above, { type: "setCopingMaterial", value: reference.id }), above, "Above-ground reference coping assignment rejected without mutation");
    equal(configuratorTesting.reducer(above, { type: "setPaving", value: reference.id }), above, "Above-ground reference paving assignment rejected without mutation");
    const tampered = parseProjectConfiguration(serializeProjectConfiguration(toProjectConfiguration(createProjectId(), {
      ...above.config, copingMaterial: reference.id, paving: reference.id }, initial.renovation)));
    equal([tampered.config.copingMaterial, tampered.config.paving], ["travertine", "gres"], "Older/tampered above-ground snapshot cannot introduce reference textures");
    scenarios++;
  }
  // Real PDF generation for each finish in both locales. This proves code
  // rendering/export, not browser photographs or printed-layout approval.
  for (const locale of ["it", "en"] as const) {
    const config = { ...baseline, copingMaterial: reference.id, paving: reference.id, pavingFormat: pavingFormats(reference.id)[0]! };
    const project = toProjectConfiguration(createProjectId(), config, initial.renovation);
    const model = buildProjectSummary(project, locale);
    const document = await buildProjectBook({ model, locale, publicRef: "PW-0000-000001", shareUrl: "https://example.test/?p=PW-0000-000001",
      heroDataUrl: exportFixtureImage, presentation: { day: exportFixtureImage, night: exportFixtureImage }, issuedAt: new Date("2026-10-19T10:00:00Z") });
    const pdf = document.output();
    equal(document.getNumberOfPages(), 7, `${reference.id}/${locale}: seven-page Project Book generated`);
    ok(pdf.includes("PW-0000-000001"), "PDF contains public Project ID");
    const text = pdf.replace(/\\([()\\])/g, "$1");
    for (const word of pdfText(locale === "it" ? reference.title : reference.titleEn).split(/\s+/).filter(word => /^[A-Za-z-]{3,}$/.test(word)))
      ok(text.includes(word), `${reference.id}/${locale}: PDF includes selected finish word ${word}`);
    pdfCases++;
  }
}

// Exercise real metric geometry for every compatible module on each size.
// The exact reference mesh must equal the approved legacy mesh for the same
// chosen module: finish changes must never resize or rebuild pool geometry.
let geometryCases = 0;
for (const reference of REFERENCE_FINISHES) for (const format of pavingFormats(reference.id))
for (const [length, width] of [[6, 3], [8, 4], [12, 5]] as const) {
  const layout = pavingLayout(reference.id, format), outline = buildOutline("rectangle", { ...baseline.dimensions, length, width, cornerRadius: 0 });
  const inner = offsetOutline(outline, studioDeckInnerOffset("in-ground", "skimmer", "hidden"));
  const outer = offsetOutline(inner, 1.2);
  const actual = createPavingModules(inner, outer, layout.module, layout);
  const approved = createPavingModules(inner, outer, PAVING_FORMATS[format].module, {
    gap: reference.boards ? .005 : .003, thickness: reference.boards ? .025 : .02, boards: reference.boards,
  });
  equal(sha(Array.from(actual.getAttribute("position").array)), sha(Array.from(approved.getAttribute("position").array)), "New finish cannot change existing slab/board geometry");
  equal(actual.userData["paving"].module, PAVING_FORMATS[format].module, "6×3 / 8×4 / 12×5 retain same physical module");
  ok(Array.from(actual.getAttribute("uv").array).every(Number.isFinite), "Metric UVs finite for real generated paving");
  actual.dispose(); approved.dispose(); geometryCases++;
}

// Valid already-saved above-ground selections retain their exact normalized
// project with no reference-specific schema or catalogue changes.
for (const coping of LEGACY_COPING_MATERIALS) {
  const config = { ...baseline, poolType: "above-ground" as const, structure: "modular-steel-panels" as const, copingMaterial: coping.id,
    features: ["externalStaircase" as const], exteriorPanelFinish: "wpc" as const };
  const project = toProjectConfiguration(createProjectId(), config, initial.renovation);
  const serialized = serializeProjectConfiguration(project);
  equal(parseProjectConfiguration(serialized), baselineParseProject(serialized), "Entire existing above-ground project restores identically to approved parser");
  equal(resolveMaterials(config), baselineResolveMaterials(config), "Entire existing above-ground material descriptor remains identical");
  equal(parseProjectConfiguration(serialized).config.copingMaterial, coping.id, "Existing above-ground coping retains saved choice");
}
console.log(JSON.stringify({ status: "PASS", checks, scenarios, deliveryCases, pdfCases, linerCases, geometryCases,
  storage: "Explicit MemoryProjectStore fixture, non-durable; no cloud or email called", approvedBaselineCommit: APPROVED_HEAD }));
