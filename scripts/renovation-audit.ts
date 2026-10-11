import assert from "node:assert/strict";
import { backendFixture } from "./backend-fixtures";
import { configuratorTesting } from "../src/lib/pool/store";
import { POOL_SHAPES, RENOVATION_STEPS } from "../src/lib/pool/config";
import { cleanRenovation, isRenovationConfig, renovationPreviewConfig, renovationDecisions,
  renovationStepComplete, renovationMacroReachable, renovationMosaicLabel } from "../src/lib/pool/renovation";
import { parseProjectConfiguration, serializeProjectConfiguration, toProjectConfiguration } from "../src/lib/pool/project";
import { projectGeometry } from "../src/lib/pool/project-metrics";
import { configuredAccessPlan } from "../src/lib/pool/access-plan";
import { projectSnapshotFingerprint } from "../src/lib/project-delivery/client";
import { shareableProject } from "../src/lib/project-delivery/service";
import { buildProjectSummary } from "../src/lib/project-delivery/summary-model";
import { formatLeadEmail } from "../src/lib/lead/formatLeadEmail";
import { leadSubmissionInputSchema } from "../src/lib/lead/schema";
import { MOSAIC_FINISHES } from "../src/configurator/materials/interior-textures";
import type { RenovationConfig } from "../src/lib/pool/types";

let checks = 0;
function check(value: unknown, message: string) { assert(value, message); checks++; }
const base = backendFixture("A");
const renovation: RenovationConfig = {
  areas: ["interiorFinish", "filtration", "coping", "structure", "equipment"],
  currentFinish: "liner", filtrationWorks: ["pump", "overflow"], replaceCoping: true,
  copingMaterial: "prun", structureIssues: ["waterproofing"], equipmentUpgrades: ["heatPump"],
  existing: { poolType: "in-ground", structure: "reinforced-concrete", system: "skimmer",
    finish: "liner", linerColor: "motionBlueSky602", mosaicFinish: MOSAIC_FINISHES[0]!.id,
    copingMaterial: "travertine", poolAccess: "internalSteps", internalStairType: "corner" },
};
const config = { ...base.config, projectType: "renovation" as const, features: [],
  finish: "mosaic" as const, mosaicFinish: MOSAIC_FINISHES[1]!.id };
const customer = { ...config.customer, name: "QA", email: "qa@example.com", phone: "+39 000 0000000", city: "Test", country: "Italia" };
check(RENOVATION_STEPS.every(s => !/Scope|Customer|Details|Review|Renovation/.test(s.title)), "Italian phase titles");
check(isRenovationConfig(renovation), "complete valid renovation");
check(!isRenovationConfig({}), "malformed object rejected");
check(!isRenovationConfig({ ...renovation, areas: ["invented"] }), "invented work rejected");
check(!isRenovationConfig({ ...renovation, existing: { ...renovation.existing, structure: "modular-steel-panels", finish: "mosaic" } }), "panel mosaic incompatible");
check(!isRenovationConfig({ ...renovation, existing: { ...renovation.existing, poolType: "above-ground" } }), "incompatible above-ground structure rejected");
check(isRenovationConfig(base.renovation), "Build 2 valid legacy renovation preserved");
check(renovationPreviewConfig(base.config, renovation) === base.config, "New Pool has exact no-op input identity");
for (const shape of POOL_SHAPES) for (const length of [6, 8, 10, 12]) for (const width of [3, 4, 5])
  for (const floorProfile of ["flat", "slope"] as const) for (const system of ["skimmer", "overflow"] as const) {
    const r = { ...renovation, existing: { ...renovation.existing, system, ...(system === "overflow" ? { overflowType: "visible" as const } : {}) } };
    const c = { ...config, shape: shape.id, dimensions: { ...config.dimensions, length, width, floorProfile, shallowDepth: 1 }, customer };
    const before = renovationPreviewConfig(c, r, true);
    const after = renovationPreviewConfig(c, r);
    check(before.finish === "liner" && before.linerColor === "motionBlueSky602", "existing material retains texture identity");
    check(before.copingMaterial === "travertine" && after.copingMaterial === "prun", "before/proposed coping separated");
    check(before.system === system && after.system === "overflow", "hydraulic proposal actually updates renderer input");
    check(after.finish === "mosaic" && after.mosaicFinish === c.mosaicFinish, "mosaic proposal renderer input");
    const metrics = projectGeometry(after).metrics;
    check(Number.isFinite(metrics.waterVolume) && metrics.waterVolume > 0 && metrics.internalSurface > 0, "finite geometry and calculated metrics");
    if (shape.id === "rectangle" && floorProfile === "flat") check(Math.abs(metrics.waterVolume - length * width * 1.5) < 0.001, "exact rectangular base volume");
    const project = toProjectConfiguration(base.projectId, after, r);
    const restored = parseProjectConfiguration(serializeProjectConfiguration(project));
    check(projectSnapshotFingerprint(project) === projectSnapshotFingerprint(restored), "save/reload exact snapshot");
    check(projectSnapshotFingerprint(shareableProject(project)) === projectSnapshotFingerprint(shareableProject(restored)), "share exact snapshot and privacy");
    check(renovationStepComplete(2, after, r) === !configuredAccessPlan(before).reason, "existing access gate matches rendered compatibility");
    check(renovationStepComplete(3, after, r), "valid selected proposals complete Details phase");
  }
const cleaned = cleanRenovation({ ...renovation, areas: ["interiorFinish"] });
check(cleaned.filtrationWorks.length === 0 && cleaned.structureIssues.length === 0 && cleaned.equipmentUpgrades.length === 0 &&
  cleaned.replaceCoping === null && cleaned.copingMaterial === "", "deselected scopes cannot leak works");
const retained = renovationPreviewConfig(config, { ...renovation, areas: [] });
check(retained.finish === "liner" && retained.system === "skimmer" && retained.copingMaterial === "travertine", "no unselected proposed geometry");
const above = cleanRenovation({ ...renovation, existing: { ...renovation.existing, poolType: "above-ground", poolAccess: "stainlessSteelLadder" } });
const aboveConfig = renovationPreviewConfig({ ...config, dimensions: { ...config.dimensions, floorProfile: "slope", shallowDepth: 1 } }, above);
check(isRenovationConfig(above) && aboveConfig.finish === "liner" && aboveConfig.poolAccess === null && aboveConfig.dimensions.floorProfile === "flat", "above-ground renovation compatibility");
check(!renovationMacroReachable(4, 1, i => i !== 1), "cannot bypass missing scope through macro navigation");
check(!renovationStepComplete(2, config, { ...renovation, existing: undefined } as unknown as RenovationConfig), "missing existing decisions cannot be skipped");
check(!renovationStepComplete(3, config, { ...renovation, replaceCoping: null }), "coping decision explicit, no silent skip");
check(!renovationStepComplete(4, config, renovation), "contacts validated before Review");
check(!renovationStepComplete(2, { ...config, dimensions: { ...config.dimensions, floorProfile: "slope", shallowDepth: 1 } }, renovation),
  "corner steps on slope rejected rather than silently missing in 3D");
check(renovationDecisions("renovation-details", cleaned).map(d => d.id).join() === "interiorFinish", "only requested subcategories");
check(renovationDecisions("renovation-details", { ...renovation, areas: ["complete"] }).length === 5, "complete renovation asks all subcategories");
const project = toProjectConfiguration(base.projectId, renovationPreviewConfig({ ...config, customer }, renovation), renovation);
const summary = buildProjectSummary(project);
check(JSON.stringify(shareableProject(project).renovation.existing) === JSON.stringify(renovation.existing), "share/save projection retains all existing conditions");
const text = JSON.stringify(summary);
for (const label of ["Piscina esistente", "Lavori proposti e optional", "Impermeabilizzazione", "Pompa di calore", "Pietra di Prun"])
  check(text.includes(label), "summary includes selected work: " + label);
check(!text.includes(MOSAIC_FINISHES[1]!.id), "human-readable mosaic name, no raw ID");
const submission = { requestId: crypto.randomUUID(), projectId: project.projectId, projectReference: "PW-0000-000000", schemaVersion: 1 as const,
  createdAt: new Date().toISOString(), project, attachments: [], customer: { name: "QA", email: "qa@example.com", phone: "+39 000 0000000", projectLocation: "Test" },
  commercial: { timing: "evaluating" as const, notes: "Solo test tecnico" }, privacy: { accepted: true, marketingConsent: false } };
const email = formatLeadEmail(submission);
check(email.text.includes(project.projectId) && email.text.includes("Impermeabilizzazione") && email.text.includes(renovationMosaicLabel(MOSAIC_FINISHES[1]!.id)) &&
  !email.text.includes(MOSAIC_FINISHES[1]!.id), "email shares complete Italian proposal without technical material IDs");
const input = { ...submission, website: "", idempotencyKey: crypto.randomUUID() };
check(leadSubmissionInputSchema.safeParse(input).success, "same Build 2 lead validation accepts renovation");
check(!leadSubmissionInputSchema.safeParse({ ...input, project: { ...project, renovation: {} } }).success, "server rejects malformed renovation before email");
const initial = configuratorTesting.createInitialState();
const dirtyNew = { ...initial, config: { ...base.config, features: ["sunShelf" as const], equipment: ["heatPump" as const] } };
const reset = configuratorTesting.transitionReducer(dirtyNew, { type: "setProjectType", value: "renovation" });
check(reset.config.features.length === 0 && reset.config.equipment.length === 0 && reset.renovation.areas.length === 0 && reset.projectId === dirtyNew.projectId, "New-to-Renovation resets stale selections without losing project identity");
const mapped = configuratorTesting.transitionReducer({ ...reset, config: { ...config, customer }, renovation },
  { type: "updateRenovation", value: { areas: ["interiorFinish"] } });
check(mapped.config.system === "skimmer" && mapped.renovation.filtrationWorks.length === 0, "actual reducer normalizes proposal after scope change");
for (const poolType of ["in-ground", "above-ground"] as const) {
  const panels = configuratorTesting.transitionReducer({ ...reset, renovation: { ...reset.renovation, areas: ["interiorFinish"] } },
    { type: "updateRenovation", value: { existing: { poolType, structure: "modular-steel-panels", finish: "liner" } } });
  const changed = configuratorTesting.transitionReducer(panels, { type: "setLinerColor", value: "motionSandBeach179" });
  check(panels.renovation.existing?.linerColor === reset.config.linerColor, "auto-selected panel liner captures existing catalogue color");
  check(renovationPreviewConfig(changed.config, changed.renovation, true).linerColor === reset.config.linerColor &&
    changed.config.linerColor === "motionSandBeach179", "proposed panel liner never changes existing material");
}
check(!renovationStepComplete(2, config, { ...renovation, existing: { ...renovation.existing, linerColor: undefined } }),
  "existing material without persisted catalogue selection cannot pass");
console.log(`PASS — ${checks} renovation checks: geometry/configuration, isolated existing/proposed, navigation, persistence, summary, email and lead validation.`);
