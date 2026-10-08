import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { constructionPresentation, structureFamily } from "../src/lib/pool/construction-presentation";
import { DEFAULT_CUSTOMER, DEFAULT_CONTROL_POINTS, STEPS, STEP_GROUPS } from "../src/lib/pool/config";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import { buildOutline, computeMetrics } from "../src/lib/pool/geometry";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { createPhotoSceneSpec } from "../src/lib/pool/photo-scene-spec";
import { parseProjectConfiguration, serializeProjectConfiguration, toProjectConfiguration } from "../src/lib/pool/project";
import { buildTechnicalPlan } from "../src/lib/pool/technical-plan";
import { planSkimmers } from "../src/lib/pool/engineering";
import { focusForAction, contextualIntent } from "../src/lib/pool/contextual-camera";
import type { PoolConfig, RenovationConfig } from "../src/lib/pool/types";
import { CUSTOMER_STRUCTURES, customerStructureOf } from "../src/lib/pool/config";
import { isStepSkipped } from "../src/components/pool/wizard/wizard-model";
import {
  finishDescription,
  allowedFinishesForStructure,
  normaliseFinishForStructure,
  normalisePoolStructure,
} from "../src/lib/pool/structure-finish";

let checks = 0;
const equal = (a: unknown, b: unknown, message?: string) => { assert.deepEqual(a, b, message); checks++; };
const ok = (value: unknown, message: string) => { assert.ok(value, message); checks++; };
const renovation: RenovationConfig = { areas: [], currentFinish: "liner", filtrationWorks: [], replaceCoping: null, copingMaterial: "", structureIssues: [], equipmentUpgrades: [] };
const base: PoolConfig = {
  projectType: "new", poolType: "in-ground", structure: "reinforced-concrete", shape: "rectangle", shapeSelected: true,
  customMode: "draw", controlPoints: DEFAULT_CONTROL_POINTS, dimensions: { length: 8, width: 4, depth: 1.5, cornerRadius: 0 },
  system: "skimmer", overflowType: "hidden", skimmerFinish: "white", skimmerType: "standard",
  finish: "liner", linerColor: "motionSandBeach179", mosaicFinish: DEFAULT_MOSAIC_FINISH_ID,
  copingMaterial: "travertine", features: [], poolAccess: "internalSteps", internalStairType: "linear",
  equipment: [], customer: DEFAULT_CUSTOMER, uploads: [], sceneTime: "night",
};
equal(STEP_GROUPS.length, 7);
ok(STEPS.findIndex(s => s.id === "structure") < STEPS.findIndex(s => s.id === "shape-dimensions"), "Structure before shape");
ok(STEPS.findIndex(s => s.id === "access") < STEPS.findIndex(s => s.id === "style"), "Built-ins before finish");
equal(focusForAction({ type: "setPoolStructure" }, base), "STRUCTURE_OVERVIEW");
equal(contextualIntent("STRUCTURE_OVERVIEW", base), "structure");
equal(structureFamily(null), null);
equal(normalisePoolStructure("modular-steel-structure"), "modular-steel-panels", "Legacy above-ground steel migrates without becoming visible inox");
equal(structureFamily("visible-stainless-steel"), "VISIBLE_STAINLESS_STEEL");
equal(allowedFinishesForStructure("reinforced-concrete"), ["liner", "mosaic"]);
equal(allowedFinishesForStructure("modular-steel-panels"), ["liner"]);
equal(allowedFinishesForStructure("visible-stainless-steel"), []);
equal(normaliseFinishForStructure("modular-steel-panels", "mosaic"), "liner");
equal(normaliseFinishForStructure("visible-stainless-steel", "liner"), "none");
equal(normaliseFinishForStructure("reinforced-concrete", "none"), "liner");
for (const structure of ["modular-steel-panels", "reinforced-concrete", "visible-stainless-steel"] as const)
for (const length of [6, 8, 10, 12]) for (const width of [3, 4, 5])
for (const shape of ["rectangle", "l-shape", "custom"] as const)
for (const system of ["skimmer", "overflow", "infinity"] as const)
for (const floorProfile of ["flat", "slope"] as const)
for (const comfort of [null, "sunShelf", "hydromassage"] as const) {
  const config: PoolConfig = { ...base, structure, shape, system,
    finish: normaliseFinishForStructure(structure, base.finish),
    dimensions: { ...base.dimensions, length, width, floorProfile, shallowDepth: 1.1 },
    features: ["ledLighting", "inoxLadder", ...(comfort ? [comfort] : [])],
    ...(system === "infinity" ? { infinityEdge: { enabled: true, side: 0 } } : {}),
  };
  const before = JSON.stringify(config);
  const layoutBefore = configuredPoolLayout(config);
  for (const id of ["structure", "shape-dimensions", "system", "access", "style", "lighting", "review", "structure"]) {
    const state = constructionPresentation(config, id);
    equal(state.structure, structureFamily(structure));
    equal(state.raw, !["style", "lighting", "review"].includes(id));
    equal(state.showWater, ["lighting", "review"].includes(id));
    equal(state.showLighting, state.showWater);
  }
  equal(JSON.stringify(config), before, "Presentation is never a configuration mutation");
  equal(configuredPoolLayout(config), layoutBefore, "Back/Next do not remove shelf/landing geometry");
  const project = toProjectConfiguration("structural-audit", config, renovation);
  const restored = parseProjectConfiguration(serializeProjectConfiguration(project));
  equal(restored.config.structure, structure, "Snapshot/save/share retain canonical construction ID");
  equal(restored.config.sceneTime, "night", "Dry inspection must not overwrite chosen Day/Night");
  equal(restored.config.finish, config.finish);
  const spec = createPhotoSceneSpec(restored);
  equal(spec.structureType, structureFamily(structure));
  equal(spec.selection.structure, structure);
  equal(spec.pool.layout, JSON.parse(JSON.stringify(configuredPoolLayout(restored.config))));
  ok(!("stage" in restored.config), "Transient presentation stage is not persisted");
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const metrics = computeMetrics(outline, config.dimensions.depth);
  const technical = buildTechnicalPlan({ config, outline, metrics, layout: layoutBefore,
    skimmers: planSkimmers(outline, metrics.waterSurface, system === "skimmer") });
  equal(technical.structure, structure);
}
for (const [structure, requested, expected] of [
  ["modular-steel-panels", "mosaic", "liner"],
  ["visible-stainless-steel", "liner", "none"],
  ["reinforced-concrete", "none", "liner"],
] as const) {
  const invalid = { ...base, structure, finish: requested } as PoolConfig;
  const restored = parseProjectConfiguration(JSON.stringify({
    schemaVersion: 1,
    projectId: `invalid-${structure}`,
    config: invalid,
    renovation,
  }));
  equal(restored.config.finish, expected, `${structure} removes an invalid persisted finish`);
}
equal(constructionPresentation(base, "review", true).raw, true, "Technical View reveals the selected structure");
for (const id of STEPS.map(s => s.id)) equal(constructionPresentation({ ...base, projectType: "renovation" }, id).stage, "water", "Renovation unchanged");
// Progressive reveal: decking from Bordo e decking, lifestyle context only late.
for (const id of STEPS.map((s) => s.id)) {
  const late = STEPS.findIndex((s) => s.id === id) >= STEPS.findIndex((s) => s.id === "deck");
  equal(
    constructionPresentation(base, id).showDecking,
    late,
    `${id}: decking appears only from Bordo e decking`,
  );
  equal(
    constructionPresentation(base, id).showEnvironment,
    ["technology", "review"].includes(id),
    `${id}: lifestyle context only late`,
  );
  equal(
    constructionPresentation({ ...base, projectType: null } as never, id).showEnvironment,
    false,
    `${id}: no context before a project type`,
  );
}
const model = readFileSync("src/components/pool/three/PoolModel.tsx", "utf8");
ok(model.includes('structureFamily === "VISIBLE_STAINLESS_STEEL"'), "Visible inox remains the final interior material");
ok(model.includes("interiorShellKind"), "Shell, floor, stairs and comfort share one structure material resolver");
ok(model.includes('if (!showWater) return;'), "Dry final finish cannot receive submerged optics");
ok(model.includes('key={showWater ? "wet" : "dry"}'), "Changing water state recompiles dry/wet materials");
equal((model.match(/depth-aware-underwater-optics-v8-\$\{LED_TRANSPORT_CACHE_KEY\}-\$\{showWater\}/g) ?? []).length, 4, "All finished surfaces keep separate dry/wet shader programs");
const infinity = readFileSync("src/components/pool/three/InfinityEdge.tsx", "utf8");
ok(infinity.includes('{showWater ? <>'), "Infinity sheet, crest and receiver dry-stage gate");
ok(infinity.includes('rawStructure ? <RawShellMaterial kind={rawKind}'), "Raw Infinity containment uses the selected construction finish");
// Summary, technical panel and Project Book PDF all render summary-model.ts (Build 2).
for (const file of ["src/lib/project-delivery/summary-model.ts", "src/lib/lead/formatLeadEmail.ts"])
  ok(readFileSync(file, "utf8").includes("STRUCTURE_LABEL["), `${file} presents canonical structure`);
// --- Customer-facing Structure -> Interior Finish (steel finish selection) ---
equal(CUSTOMER_STRUCTURES.map((s) => s.title), ["Cemento armato", "Acciaio"], "two customer structures only");
equal(CUSTOMER_STRUCTURES.filter((s) => s.poolTypes.includes("above-ground")).map((s) => s.id), ["steel"]);
equal(customerStructureOf("reinforced-concrete"), "concrete");
equal(customerStructureOf("modular-steel-panels"), "steel");
equal(customerStructureOf("visible-stainless-steel"), "steel");
for (const structure of ["reinforced-concrete", "modular-steel-panels", "visible-stainless-steel"] as const)
  equal(isStepSkipped("style", { ...base, structure }), false, `finish step offered for ${structure}`);
// Transitions never keep an invalid finish.
const transitions: Array<[PoolConfig["structure"], PoolConfig["finish"], PoolConfig["finish"]]> = [
  ["visible-stainless-steel", "mosaic", "none"], // concrete+mosaic -> steel a vista
  ["modular-steel-panels", "none", "liner"], // steel a vista -> steel + liner
  ["visible-stainless-steel", "liner", "none"], // steel + liner -> steel a vista
  ["reinforced-concrete", "none", "liner"], // steel a vista -> concrete
  ["modular-steel-panels", "mosaic", "liner"], // concrete+mosaic -> steel (lined)
];
for (const [structure, from, to] of transitions)
  equal(normaliseFinishForStructure(structure, from), to, `${from} -> ${structure}`);
equal(finishDescription("visible-stainless-steel", "none"), "Acciaio a vista · inox satinato");
equal(finishDescription("modular-steel-panels", "liner"), "Liner / PVC");
// Snapshot identity and downstream: same geometry, only structure/finish differ.
for (const variant of [
  { structure: "visible-stainless-steel" as const, finish: "none" as const },
  { structure: "modular-steel-panels" as const, finish: "liner" as const },
]) {
  const cfg: PoolConfig = { ...base, ...variant, features: ["sunShelf"] };
  const restored = parseProjectConfiguration(serializeProjectConfiguration(toProjectConfiguration("steel-audit", cfg, renovation)));
  equal(restored.config.structure, variant.structure, "snapshot keeps steel variant");
  equal(restored.config.finish, variant.finish, "snapshot keeps steel finish");
  const { length, width, depth } = restored.config.dimensions;
  equal({ length, width, depth }, { length: 8, width: 4, depth: 1.5 }, "steel finish switch preserves geometry");
}
{
  const shelf = (structure: PoolConfig["structure"]) =>
    JSON.stringify(configuredPoolLayout({ ...base, structure, features: ["sunShelf"] }).comfort);
  equal(shelf("visible-stainless-steel"), shelf("modular-steel-panels"), "Sun Shelf geometry identical across steel finishes");
}
const steelSpec = createPhotoSceneSpec(toProjectConfiguration("steel-a", { ...base, structure: "visible-stainless-steel", finish: "none" }, renovation));
const linedSpec = createPhotoSceneSpec(toProjectConfiguration("steel-b", { ...base, structure: "modular-steel-panels", finish: "liner" }, renovation));
ok(JSON.stringify(steelSpec) !== JSON.stringify(linedSpec), "photo scene spec follows steel finish");
const shell = readFileSync("src/components/pool/three/RawShellMaterial.tsx", "utf8");
ok(shell.includes('kind === "stainless" ? 150'), "visible steel is satin grey, not near-white");

console.log(`PASS: ${checks} structural progression checks — stage, snapshot, dry/wet, shape/resize, comfort, technical, photo and downstream identity.`);
