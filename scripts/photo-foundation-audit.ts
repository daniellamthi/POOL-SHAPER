import assert from "node:assert/strict";
import { decisions } from "../src/components/pool/wizard/decisions";
import { readFileSync } from "node:fs";
import { createPhotoSceneSpec } from "../src/lib/pool/photo-scene-spec";
import { parseProjectConfiguration, serializeProjectConfiguration, toProjectConfiguration } from "../src/lib/pool/project";
import { PAVING, PREMIUM_ENVIRONMENTS } from "../src/lib/pool/presentation";
import { POOL_SHAPES, DEFAULT_CUSTOMER } from "../src/lib/pool/config";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { buildOutline, offsetOutline } from "../src/lib/pool/geometry";
import { createPavingModules } from "../src/components/pool/three/StudioPaving";
import { copingOuterOffset } from "../src/components/pool/three/poolConstruction";
import { coastalCamera, coastFrame } from "../src/components/pool/three/coastalLayout";
import { infinityZonesForOutline } from "../src/lib/pool/infinity-edge";
import { resolveAutomaticCover } from "../src/lib/pool/cover-plan";
import type { PoolConfig, RenovationConfig } from "../src/lib/pool/types";

const base: PoolConfig = {
  projectType: "new", poolType: "in-ground", structure: "reinforced-concrete", shape: "rectangle",
  customMode: "draw", controlPoints: [], shapeSelected: true,
  dimensions: { length: 10, width: 4.5, depth: 1.5, cornerRadius: 0 },
  system: "skimmer", overflowType: "hidden", skimmerFinish: "white", skimmerType: "standard",
  finish: "liner", linerColor: "motionSandBeach179", mosaicFinish: DEFAULT_MOSAIC_FINISH_ID,
  copingMaterial: "travertine", features: [], poolAccess: "internalSteps", internalStairType: "linear",
  equipment: [], customer: DEFAULT_CUSTOMER, uploads: [], sceneTime: "day",
};
const renovation: RenovationConfig = { areas: [], currentFinish: "liner", filtrationWorks: [], replaceCoping: null, copingMaterial: "", structureIssues: [], equipmentUpgrades: [] };
for (const position of ["open", "closed"] as const) {
  const config: PoolConfig = { ...base, equipment: ["automaticCover"], coverPosition: position };
  const plan = resolveAutomaticCover(config);
  const spec = createPhotoSceneSpec(toProjectConfiguration("cover-audit", config, renovation));
  assert.equal(spec.pool.cover.requested, true);
  assert.equal(spec.pool.cover.position, plan.position);
  assert.equal(spec.pool.cover.status, plan.status);
  assert.equal(spec.pool.cover.reason, plan.reason);
  assert.deepEqual(spec.pool.cover.geometry, plan.geometry);
}
let checks = 0;
for (const poolType of ["in-ground", "above-ground"] as const) for (const system of ["skimmer", "overflow", "infinity"] as const) {
  const c = { ...base, poolType, system };
  const ids = (step: string) => decisions(step, c).map(d => d.id);
  assert.deepEqual(ids("technology"), ["outdoor", "water", "heat"]);
  assert.deepEqual(ids("shape-dimensions"), ["shape", "plan", "depth"]);
  assert.deepEqual(ids("system"), ["system", "detail"]);
  assert.deepEqual(ids("style"), poolType === "above-ground" ? ["interior", "exterior"] : ["interior"]);
  assert.deepEqual(ids("deck"), poolType === "above-ground" ? ["coping"] : ["coping", "paving"]);
  assert.deepEqual(decisions("deck", { ...c, system: "overflow", overflowType: "visible" }).map(d => d.id), poolType === "above-ground" ? [] : ["paving"]);
  assert.deepEqual(ids("lighting"), ["lighting"]);
  assert.deepEqual(decisions("lighting", { ...c, features: ["ledLighting"] }).map(d => d.id), ["lighting", "color"]);
  assert.deepEqual(ids("review"), ["scene", "summary", "request"]);
  checks += 9;
}
for (const length of [6, 8, 10, 12]) for (const width of [3, 4.5, 5])
for (const system of ["skimmer", "overflow", "infinity"] as const)
for (const floorProfile of ["flat", "slope"] as const)
for (const comfort of [null, "sunShelf", "hydromassage"] as const) {
  const config: PoolConfig = { ...base, system, dimensions: { ...base.dimensions, length, width, depth: 1.8, floorProfile, shallowDepth: 1.2 },
    features: ["ledLighting", "inoxLadder", ...(comfort ? [comfort] : [])], hydromassageVariant: "open",
    ...(system === "infinity" ? { infinityEdge: { enabled: true, side: 0 } } : {}),
  };
  const project = toProjectConfiguration("audit-project", config, renovation);
  const before = JSON.stringify(project);
  const spec = createPhotoSceneSpec(project);
  assert.equal(JSON.stringify(project), before, "spec cannot mutate source");
  assert.equal(JSON.stringify(spec), JSON.stringify(createPhotoSceneSpec(project)), "deterministic spec");
  assert.deepEqual(spec.pool.layout, JSON.parse(JSON.stringify(configuredPoolLayout(config))));
  assert.equal(spec.selection.dimensions.length, length);
  assert.equal(spec.selection.dimensions.width, width);
  assert.equal(spec.pool.materials.coping.id, "travertine");
  assert.equal(spec.lighting.time, "day");
  assert.deepEqual(spec.renovation, renovation);
  assert.equal(spec.sourceSchemaVersion, project.schemaVersion);
  assert.equal(!!spec.pool.infinity?.resolved, system === "infinity");
  if (system === "infinity") {
    const access = spec.pool.technicalConfiguration.infinityAccess;
    assert.ok(access, "Infinity technical configuration retains the selected edge and resolved access");
    assert.ok(access.resolvedAnchors.length > 0, "Infinity access anchors come from the resolved layout");
    assert.ok(access.resolvedAnchors.every(anchor => !anchor.onInfinityEdge),
      `No resolved access or comfort anchor occupies the Infinity overflow edge: ${JSON.stringify({ length, width, floorProfile, comfort, access })}`);
  }
  assert.ok(!("customer" in spec.selection) && !("uploads" in spec.selection));
  for (const environment of PREMIUM_ENVIRONMENTS) {
    const next = createPhotoSceneSpec({ ...project, config: { ...config, premiumEnvironment: environment.id } });
    assert.deepEqual(next.pool, spec.pool, "environment must not redesign pool");
    assert.equal(next.environment.minimumHostSpan[0], spec.environment.poolBounds.spanX + 3);
  }
  checks += 15;
}
for (const paving of PAVING) for (const environment of PREMIUM_ENVIRONMENTS) for (const sceneTime of ["day", "night"] as const) {
  const config = { ...base, paving: paving.id, premiumEnvironment: environment.id, sceneTime };
  const project = toProjectConfiguration("paving-audit", config, renovation);
  const restored = parseProjectConfiguration(serializeProjectConfiguration(project));
  assert.equal(restored.config.paving, paving.id);
  assert.equal(restored.config.premiumEnvironment, environment.id);
  assert.equal(restored.config.sceneTime, sceneTime);
  assert.equal(restored.config.copingMaterial, "travertine");
  assert.equal(createPhotoSceneSpec(restored).pool.materials.coping.id, "travertine");
  assert.equal(createPhotoSceneSpec(restored).paving.id, paving.id);
  checks += 6;
}
for (const shape of ["rectangle", "l-shape", "custom"] as const) for (const length of [6, 12]) for (const paving of PAVING) {
  const outline = buildOutline(shape, { ...base.dimensions, length }, [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]);
  const inner = offsetOutline(outline, copingOuterOffset("skimmer", "hidden"));
  const mesh = createPavingModules(inner, offsetOutline(inner, 1.2), paving.module);
  const p = mesh.getAttribute("position"), n = mesh.getAttribute("normal");
  assert.ok(p.count > 0);
  for (let i = 0; i < p.count; i++) {
    assert.ok(Number.isFinite(p.getX(i)) && Number.isFinite(p.getZ(i)));
    assert.ok(n.getY(i) > .99, `slab faces point upwards: ${shape}/${length}/${paving.id}, vertex ${i}, normal ${n.getY(i)}`);
  }
  mesh.dispose(); checks += 2;
}
assert.ok(!POOL_SHAPES.some(s => s.id === "organic"));
for (const length of [6, 12]) for (const width of [3, 5]) {
  const outline = buildOutline("rectangle", { ...base.dimensions, length, width });
  for (const zone of infinityZonesForOutline(outline, "rectangle")) for (const aspect of [.75, 1.1, 1.8]) {
    const pose = coastalCamera(outline, zone, -.12, aspect, 34), f = coastFrame(zone);
    const projection = outline.map(([x,z]) => (x-f.x)*f.nx+(z-f.z)*f.nz);
    const poolRun = -Math.min(...projection);
    const distance = (f.x-pose.position[0])*f.nx+(f.z-pose.position[2])*f.nz;
    assert.ok(distance <= poolRun + 6.5 + 1e-6, "Curated camera stays within local site apron");
    assert.ok(pose.fov >= 34 && pose.fov <= 78 && pose.position.every(Number.isFinite));
    checks += 2;
  }
}
const retired = { schemaVersion: 1, projectId: "legacy", config: { ...base, shape: "organic" }, renovation };
assert.throws(() => parseProjectConfiguration(JSON.stringify(retired)));
assert.throws(() => toProjectConfiguration("legacy", { ...base, shape: "organic" }, renovation));
const source = readFileSync("src/components/pool/three/PoolScene.tsx", "utf8");
assert.ok(source.slice(source.indexOf('useLayoutEffect(() => {', source.indexOf('const poseKey'))).includes('if (cameraLocked || infinityZone ||'), "Infinity snap belongs in camera layout effect, not quality sampling");
assert.ok(!source.slice(source.indexOf('useFrame((_, delta)'), source.indexOf('const detail =')).includes('cameraLocked || infinityZone'), "Orbit retains adaptive quality");
assert.ok(source.includes('const dusk = sceneTime === "night"'));
assert.ok(source.includes('sceneTime === "night" ? "dark" : "light"'));
const view = readFileSync("src/components/pool/PoolViewport.tsx", "utf8");
assert.ok(!view.includes('var(--viewport)_74%'), "UI theme cannot recolor canvas overlay");
console.log(`PASS: ${checks + 8} foundation checks — exact spec, 6×3/12×5, layout, paving, coping, Day/Night, environment isolation, Organic retirement, module normals, curated camera.`);
