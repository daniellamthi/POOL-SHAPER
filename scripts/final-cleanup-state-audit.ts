import assert from "node:assert/strict";
import { configuratorTesting } from "../src/lib/pool/store";
import { SELECTABLE_SKIMMER_TYPES, SKIMMER_TYPES, POOL_FEATURES, STEPS } from "../src/lib/pool/config";
import { parseProjectConfiguration, serializeProjectConfiguration, toProjectConfiguration } from "../src/lib/pool/project";
import { buildOutline, outlineBounds } from "../src/lib/pool/geometry";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";

const { reducer, createInitialState } = configuratorTesting;
const reviewIndex = STEPS.findIndex(step => step.id === "review");
assert(reviewIndex >= 0, "canonical presentation/review step exists");
type Action = Parameters<typeof reducer>[1];
type State = ReturnType<typeof createInitialState>;
let checks = 0;
const equal = (actual: unknown, expected: unknown, label: string) => {
  assert.deepEqual(actual, expected, label); checks++;
};
const run = (state: State, actions: Action[]) => actions.reduce(reducer, state);
const restore = (state: State) => parseProjectConfiguration(serializeProjectConfiguration(
  toProjectConfiguration(state.projectId, state.config, state.renovation),
));

equal(SELECTABLE_SKIMMER_TYPES.map(item => item.id), ["slim", "highWaterline"], "two selectable skimmers");
equal(SKIMMER_TYPES.map(item => item.id), ["standard", "slim", "highWaterline", "flush"], "four readable legacy skimmers");
equal(POOL_FEATURES.map(item => item.id), ["ledLighting", "stairLighting", "hydromassage", "sunShelf", "integratedBench"], "complete generic feature catalog");

const base = run(createInitialState(), [
  { type: "setProjectType", value: "new" },
  { type: "setPoolType", value: "in-ground" },
  { type: "setPoolStructure", value: "reinforced-concrete" },
  { type: "setShape", value: "rectangle" },
  { type: "setDimension", key: "length", value: 8 },
  { type: "setDimension", key: "width", value: 4 },
  { type: "setSkimmerType", value: "highWaterline" },
  { type: "setSkimmerFinish", value: "steel" },
  { type: "setFinish", value: "mosaic" },
  { type: "setCopingMaterial", value: "prun" },
  { type: "setPaving", value: "limestone" },
  { type: "setPavingFormat", value: "60x120" },
  { type: "setPoolAccess", value: "internalSteps" },
  { type: "setInternalStairType", value: "corner" },
  { type: "togglePoolFeature", value: "ledLighting" },
  { type: "togglePoolFeature", value: "stairLighting" },
  { type: "toggleEquipment", value: "heatPump" },
  { type: "setLedColor", value: "#3fa8ff" },
  { type: "setLedIntensity", value: 0.75 },
  { type: "setSceneTime", value: "night" },
  { type: "setCustomerField", key: "name", value: "State audit" },
]);
for (const { id } of SKIMMER_TYPES) {
  const legacy = reducer(base, { type: "setSkimmerType", value: id });
  equal(restore(legacy).config.skimmerType, id, `legacy ${id} restores unchanged`);
}

for (const label of ["skimmer", "overflow-hidden", "overflow-visible", "infinity"] as const) {
  const system = label.startsWith("overflow") ? "overflow" : label === "infinity" ? "infinity" : "skimmer";
  let state = reducer(base, { type: "setSystem", value: system });
  if (system === "overflow") state = reducer(state, { type: "setOverflowType", value: label === "overflow-visible" ? "visible" : "hidden" });
  // Establish the same canonical saved config that restoration gives the UI.
  state = reducer(state, { type: "restoreProject", value: restore(state) });
  state = reducer(state, { type: "goToStep", value: reviewIndex });
  const before = structuredClone(state.config);
  const projectId = state.projectId, renovation = structuredClone(state.renovation);
  state = reducer(state, { type: "goToStep", value: 0 });
  equal(state.config, before, `${label}: step 7 -> 1 preserves full config`);
  state = reducer(state, { type: "setDimension", key: "length", value: 12 });
  state = reducer(state, { type: "goToStep", value: reviewIndex });
  equal(state.step, reviewIndex, `${label}: returned to presentation (macro step 7)`);
  equal(state.config, { ...before, dimensions: { ...before.dimensions, length: 12 } }, `${label}: only requested dimension changes`);
  equal(state.projectId, projectId, `${label}: project identity preserved`);
  equal(state.renovation, renovation, `${label}: renovation data preserved`);
  equal(restore(state).config, state.config, `${label}: full updated snapshot round-trips`);
  const bounds = outlineBounds(buildOutline(state.config.shape, state.config.dimensions, state.config.controlPoints));
  equal([bounds.spanX, bounds.spanZ], [12, 4], `${label}: dependent geometry uses new dimension`);
  const layout = configuredPoolLayout(state.config);
  assert(layout.access.placement && !layout.access.reason, `${label}: dependent stairs remain available`); checks++;
}

let above = run(createInitialState(), [
  { type: "setProjectType", value: "new" },
  { type: "setPoolType", value: "above-ground" },
  { type: "setPoolStructure", value: "modular-steel-panels" },
  { type: "setCopingMaterial", value: "limestone" },
  { type: "setPaving", value: "travertine" },
  { type: "setLinerColor", value: "motionBlackStone799" },
  { type: "togglePoolFeature", value: "externalStaircase" },
  { type: "toggleEquipment", value: "pellicano" },
  { type: "toggleInternalSteps" },
]);
const beforeWpc = structuredClone(above.config);
above = reducer(above, { type: "setExteriorPanelFinish", value: "wpc" });
equal(above.config, { ...beforeWpc, exteriorPanelFinish: "wpc" }, "WPC changes only exterior panels");
equal(reducer(above, { type: "setPoolType", value: "above-ground" }).config, above.config, "reselecting above-ground preserves entire configuration, including stairs OFF");
equal(above.config.poolAccess, null, "stairs OFF is explicit");
equal(reducer(above, { type: "setCopingMaterial", value: "travertine" }).config,
  { ...above.config, copingMaterial: "travertine" }, "coping independent of WPC");
equal(reducer(above, { type: "setPaving", value: "limestone" }).config,
  { ...above.config, paving: "limestone" }, "paving independent of WPC");
equal(restore(above).config.exteriorPanelFinish, "wpc", "WPC persists");
above = reducer(above, { type: "restoreProject", value: restore(above) });
above = reducer(above, { type: "goToStep", value: reviewIndex });
const aboveBefore = structuredClone(above.config);
const aboveProjectId = above.projectId, aboveRenovation = structuredClone(above.renovation);
above = reducer(above, { type: "goToStep", value: 0 });
equal(above.config, aboveBefore, "above-ground: presentation -> start preserves full config");
above = reducer(above, { type: "setDimension", key: "length", value: 12 });
above = reducer(above, { type: "goToStep", value: reviewIndex });
equal(above.step, reviewIndex, "above-ground: returned to presentation (macro step 7)");
equal(above.config, { ...aboveBefore, dimensions: { ...aboveBefore.dimensions, length: 12 } }, "above-ground: only requested dimension changes");
equal(above.projectId, aboveProjectId, "above-ground: project identity preserved");
equal(above.renovation, aboveRenovation, "above-ground: renovation data preserved");
equal(restore(above).config, above.config, "above-ground: full updated snapshot round-trips");
const aboveBounds = outlineBounds(buildOutline(above.config.shape, above.config.dimensions, above.config.controlPoints));
equal([aboveBounds.spanX, aboveBounds.spanZ], [12, aboveBefore.dimensions.width], "above-ground: dependent geometry uses new dimension");
equal(configuredPoolLayout(above.config).effectiveAccess, null, "above-ground: disabled stairs remain disabled after resize");
console.log(`Final cleanup state PASS: ${checks} checks; two selectable/four legacy skimmers, full feature catalog, four-system and above-ground presentation -> start -> dimension -> presentation full snapshots (review index ${reviewIndex}), above-ground reselection and WPC independence.`);
