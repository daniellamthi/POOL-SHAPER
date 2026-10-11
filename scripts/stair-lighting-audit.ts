import assert from "node:assert/strict";
import { backendFixture, notificationFixture } from "./backend-fixtures";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { buildOutline } from "../src/lib/pool/geometry";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { POOL_BORDER_PRESET } from "../src/configurator/materials/visual-presets";
import { parseProjectConfiguration, serializeProjectConfiguration } from "../src/lib/pool/project";
import { shareableProject } from "../src/lib/project-delivery/service";
import { buildProjectSummary } from "../src/lib/project-delivery/summary-model";
import { createPhotoSceneSpec } from "../src/lib/pool/photo-scene-spec";
import { formatLeadEmail } from "../src/lib/lead/formatLeadEmail";
import { projectSnapshotFingerprint, projectLinkIsDirty } from "../src/lib/project-delivery/client";
import { createPublicRef, createEditToken } from "../src/lib/project-delivery/reference";
import { describeSelection } from "../src/components/pool/wizard/wizard-model";

let cases = 0, fittings = 0;
for (const scenario of ["A", "B", "C"] as const)
for (const [length, width] of [[6,3],[8,4],[10,4],[12,5]])
for (const stairType of ["linear","corner"] as const)
for (const sloped of [false,true])
for (const mirrored of [false,true])
for (const comfort of [null,"sunShelf","hydromassage"] as const)
for (const side of [0,1,2,3]) {
  if (scenario === "C" && (sloped || comfort)) continue;
  if (scenario !== "B" && side !== 0) continue;
  const project = backendFixture(scenario);
  const config = project.config = { ...project.config,
    internalStairType: stairType, internalStairMirrored: mirrored,
    dimensions: { ...project.config.dimensions, length: length!, width: width!, floorProfile: sloped ? "slope" : "flat", shallowDepth: sloped ? 1.1 : undefined },
    features: ["stairLighting", ...(comfort ? [comfort] : [])],
    ...(scenario === "B" ? { infinityEdge: { ...project.config.infinityEdge!, side } } : {}),
  };
  const before = configuredPoolLayout({ ...config, features: config.features.filter(f => f !== "stairLighting") });
  const layout = configuredPoolLayout(config);
  assert.deepEqual(layout.access, before.access, "fittings cannot move or resize approved access");
  assert.deepEqual(layout.comfort, before.comfort, "fittings cannot change comfort solids");
  assert.deepEqual(layout.lighting, before.lighting, "wall LEDs remain unchanged");
  assert.deepEqual(layout.stairMicroSpots, configuredPoolLayout(config).stairMicroSpots, "deterministic layout");
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const vertical = getPoolVerticalLayout({ poolType: config.poolType!, system: config.system, overflowType: config.overflowType, depth: config.dimensions.depth, copingThickness: POOL_BORDER_PRESET.thickness });
  const floor = buildFloorProfile({ outline, shape: config.shape, poolType: config.poolType!, dimensions: config.dimensions, verticalLayout: vertical, sunShelf: !!comfort, infinityEdge: config.infinityEdge });
  for (const spot of layout.stairMicroSpots) {
    assert([spot.x,spot.y,spot.z,...spot.dir].every(Number.isFinite));
    assert(Math.abs(Math.hypot(...spot.dir)-1)<1e-8, "outward face normal");
    assert(spot.y > floor.floorYAt(spot.x,spot.z)+0.025, "fitting above actual floor");
    assert(spot.y < vertical.copingY-0.05, "fitting on a riser, never coping");
    fittings++;
  }
  assert.equal(new Set(layout.stairMicroSpots.map(s => `${s.x}:${s.y}:${s.z}`)).size, layout.stairMicroSpots.length, "no duplicate fixtures");
  const shared = shareableProject(parseProjectConfiguration(serializeProjectConfiguration(project)));
  assert(shared.config.features.includes("stairLighting"), "share/read-only/copy snapshot preserves optional");
  assert.equal(projectSnapshotFingerprint(shared), projectSnapshotFingerprint(parseProjectConfiguration(serializeProjectConfiguration(shared))));
  cases++;
}
const project = backendFixture("A"); project.config.features = ["stairLighting"];
const layout = configuredPoolLayout(project.config);
assert(layout.stairMicroSpots.length > 0, "corner staircase has riser fittings");
const noSteps = configuredPoolLayout({ ...project.config, poolAccess: null });
assert.equal(noSteps.stairMicroSpots.length, 0, "no floating fittings when access is off");
const ladder = configuredPoolLayout({ ...project.config, poolAccess: "stainlessSteelLadder" });
assert.equal(ladder.stairMicroSpots.length, 0, "never put micro-spots on inox ladder");
const disabledConfig = { ...project.config, features: project.config.features.filter(f => f !== "stairLighting") };
assert(buildProjectSummary(project).sections.some(s => s.rows.some(r => r.value.includes("Micro-spot"))), "Summary/PDF source includes optional");
const spec = createPhotoSceneSpec(project);
assert(spec.lighting.stairMicroSpots.enabled);
assert.deepEqual(spec.lighting.stairMicroSpots.positions, layout.stairMicroSpots);
assert(!createPhotoSceneSpec({ ...project, config: { ...project.config, poolAccess: null } }).lighting.stairMicroSpots.enabled, "unavailable access cannot enable nonexistent fittings");
assert(describeSelection("lighting", { ...project.config, sceneTime: "night" }).includes("micro-spot scale"), "wizard describes micro-spots, not 'without lights'");
const submission = notificationFixture(); submission.project = project;
assert(formatLeadEmail(submission).text.includes("Micro-spot"), "quote email includes selected optional");
for (const poolAccess of [null, "stainlessSteelLadder"] as const) {
  const removed = { ...project, config: { ...project.config, poolAccess } };
  assert(!buildProjectSummary(removed).sections.some(s => s.rows.some(r => r.value.includes("Micro-spot"))), "removed stairs cannot be quoted in Summary/PDF");
  assert(!formatLeadEmail({ ...submission, project: removed }).text.includes("Micro-spot"), "removed stairs cannot be quoted in email");
  assert(!describeSelection("lighting", removed.config).includes("micro-spot"), "removed stairs cannot be advertised by wizard");
}
const link = { publicRef: createPublicRef(), editToken: createEditToken(), savedSnapshot: projectSnapshotFingerprint(project) };
assert(!projectLinkIsDirty(link, parseProjectConfiguration(serializeProjectConfiguration(project))), "reload stays clean");
assert(projectLinkIsDirty(link, { ...project, config: disabledConfig }), "optional edit is genuinely dirty");
console.log(`PASS — ${cases} stair-lighting configurations, ${fittings} riser fittings; unchanged geometry/access/wall LEDs; snapshot, quote, Photo Spec and dirty state`);
