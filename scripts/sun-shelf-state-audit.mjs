import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";
import { readFileSync } from "node:fs";

const file = join(process.cwd(), "node_modules/.cache/sun-shelf-state-audit.mjs");
await build({
  input: "sun-shelf-state-audit-entry",
  output: { file, format: "esm" },
  platform: "node",
  external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
  resolve: { alias: { "@": join(process.cwd(), "src") } },
  plugins: [
    {
      name: "sun-shelf-state-production-entry",
      resolveId(id) {
        if (id === "sun-shelf-state-audit-entry") return id;
        // The production reducer is real. Its unused browser RPC boundary is
        // isolated, as in the existing state audits, and fails if ever invoked.
        if (id.endsWith("/projectDelivery.server")) return "\0sun-shelf-unused-rpc";
        return null;
      },
      load(id) {
        if (id === "\0sun-shelf-unused-rpc")
          return "export const loadSharedProjectFn = () => { throw new Error('Unexpected network RPC in Sun Shelf state audit'); };";
        if (id !== "sun-shelf-state-audit-entry") return null;
        return `
        export { configuratorTesting } from "${join(process.cwd(), "src/lib/pool/store.tsx")}";
        export { configuredSunShelfLoungers, normalizeSunShelfLoungers } from "${join(process.cwd(), "src/lib/pool/sun-shelf-loungers.ts")}";
        export { parseProjectConfiguration, serializeProjectConfiguration, toProjectConfiguration } from "${join(process.cwd(), "src/lib/pool/project.ts")}";
        export { shareableProject } from "${join(process.cwd(), "src/lib/project-delivery/service.ts")}";
        export { buildProjectSummary } from "${join(process.cwd(), "src/lib/project-delivery/summary-model.ts")}";
        export { SUN_SHELF_LOUNGER_COLORS, sunShelfLoungerColor } from "${join(process.cwd(), "src/lib/pool/sun-shelf-lounger-colors.ts")}";
        export { createPhotoSceneSpec } from "${join(process.cwd(), "src/lib/pool/photo-scene-spec.ts")}";
        export { configuredPoolLayout } from "${join(process.cwd(), "src/lib/pool/resolved-layout.ts")}";
        export { SUN_SHELF_WATER_DEPTH } from "${join(process.cwd(), "src/lib/pool/sun-shelf-model.ts")}";
        export { leadSubmissionInputSchema } from "${join(process.cwd(), "src/lib/lead/schema.ts")}";
      `;
      },
    },
  ],
});

const {
  configuratorTesting,
  configuredSunShelfLoungers,
  normalizeSunShelfLoungers,
  parseProjectConfiguration,
  serializeProjectConfiguration,
  toProjectConfiguration,
  shareableProject,
  buildProjectSummary,
  SUN_SHELF_LOUNGER_COLORS,
  sunShelfLoungerColor,
  createPhotoSceneSpec,
  configuredPoolLayout,
  SUN_SHELF_WATER_DEPTH,
  leadSubmissionInputSchema,
} = await import(pathToFileURL(file).href);
const { reducer, createInitialState } = configuratorTesting;
let checks = 0;
const equal = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  checks++;
};
const check = (value, label) => {
  assert(value, label);
  checks++;
};
const run = (state, actions) => actions.reduce(reducer, state);
const project = (state) => toProjectConfiguration(state.projectId, state.config, state.renovation);
const restore = (state) => parseProjectConfiguration(serializeProjectConfiguration(project(state)));
const withoutCount = (config) => {
  const next = { ...config };
  delete next.sunShelfLoungerCount;
  return next;
};
const loungerRows = (summary) =>
  summary.sections
    .find((section) => section.id === "comfort")
    ?.rows.filter((row) => /Lettini per spiaggetta|Sun shelf loungers/.test(row.value)) ?? [];

const initial = createInitialState();
check(
  !initial.config.features.includes("sunShelfLoungers"),
  "fresh project: immersed loungers OFF",
);
equal(initial.config.sunShelfLoungerCount, undefined, "fresh project: no implicit quantity");
equal(
  configuredSunShelfLoungers(initial.config).count,
  0,
  "fresh project: no rendered immersed loungers",
);
equal(
  reducer(initial, { type: "setSunShelfLoungerCount", value: 2 }),
  initial,
  "quantity cannot enable feature",
);
check(
  !reducer(initial, {
    type: "togglePoolFeature",
    value: "sunShelfLoungers",
  }).config.features.includes("sunShelfLoungers"),
  "cannot enable without shelf",
);

const eligible = run(initial, [
  { type: "setProjectType", value: "new" },
  { type: "setPoolType", value: "in-ground" },
  { type: "setPoolStructure", value: "reinforced-concrete" },
  { type: "setShape", value: "rectangle" },
  { type: "setDimension", key: "length", value: 12 },
  { type: "setDimension", key: "width", value: 5 },
  { type: "setPoolAccess", value: "internalSteps" },
  { type: "togglePoolFeature", value: "sunShelf" },
  { type: "togglePoolFeature", value: "integratedBench" },
  { type: "togglePoolFeature", value: "ledLighting" },
  { type: "togglePoolFeature", value: "stairLighting" },
  { type: "toggleEquipment", value: "loungers" },
  { type: "toggleEquipment", value: "heatPump" },
  { type: "setSceneTime", value: "night" },
  { type: "setCustomerField", key: "name", value: "Sun Shelf audit" },
]);
const capacity = configuredSunShelfLoungers(eligible.config).capacity;
check(capacity >= 2, "12×5 actual shelf supports quantities 1 and 2");
equal(
  configuredSunShelfLoungers(eligible.config).count,
  0,
  "eligible shelf stays OFF until selected",
);
const enabled = reducer(eligible, { type: "togglePoolFeature", value: "sunShelfLoungers" });
equal(
  reducer({ ...eligible, sunShelfNotice: "Lettini rimossi" }, {
    type: "togglePoolFeature", value: "sunShelfLoungers",
  }).sunShelfNotice,
  null,
  "explicit re-add clears an obsolete removal notice",
);
equal(
  enabled.config,
  { ...eligible.config, features: [...eligible.config.features, "sunShelfLoungers"] },
  "enabling modifies only the selected feature",
);
equal(
  configuredSunShelfLoungers(enabled.config).count,
  capacity,
  "omitted count derives automatic actual capacity",
);
equal(enabled.config.sunShelfLoungerCount, undefined, "automatic quantity remains derived");

for (const quantity of [...new Set([1, 2, capacity])]) {
  const selected = reducer(enabled, { type: "setSunShelfLoungerCount", value: quantity });
  equal(
    selected.config,
    { ...enabled.config, sunShelfLoungerCount: quantity },
    `quantity ${quantity}: unrelated state preserved`,
  );
  equal(
    configuredSunShelfLoungers(selected.config).count,
    quantity,
    `quantity ${quantity}: derived scene count`,
  );
  const restored = restore(selected);
  equal(
    restored.config,
    selected.config,
    `quantity ${quantity}: project parse/serialize full round trip`,
  );
  const restoredState = reducer(initial, { type: "restoreProject", value: restored });
  equal(restoredState.config, selected.config, `quantity ${quantity}: actual restore reducer`);
  equal(
    configuredSunShelfLoungers(restoredState.config).count,
    quantity,
    `quantity ${quantity}: restored render count`,
  );
  const publicProject = shareableProject({
    ...restored,
    config: { ...restored.config, auditUnlistedField: "must be removed" },
  });
  equal(
    publicProject.config.sunShelfLoungerCount,
    quantity,
    `quantity ${quantity}: share whitelist retains count`,
  );
  check(
    publicProject.config.features.includes("sunShelfLoungers"),
    `quantity ${quantity}: share retains immersed selection`,
  );
  check(
    publicProject.config.equipment.includes("loungers"),
    `quantity ${quantity}: exterior loungers remain independent`,
  );
  check(
    !Object.hasOwn(publicProject.config, "auditUnlistedField"),
    `quantity ${quantity}: share whitelist is explicit`,
  );
  equal(
    parseProjectConfiguration(serializeProjectConfiguration(publicProject)).config
      .sunShelfLoungerCount,
    quantity,
    `quantity ${quantity}: shared restore count`,
  );
  for (const [locale, label] of [
    ["it", "Lettini per spiaggetta"],
    ["en", "Sun shelf loungers"],
  ]) {
    equal(
      loungerRows(buildProjectSummary(restored, locale)).map((row) => row.value),
      [`${label} · ${quantity} · ${locale === "en" ? "White" : "Bianco"}`],
      `${locale}: summary has one truthful quantity ${quantity}`,
    );
  }
}

for (const [requested, expected] of [
  [0, 1],
  [-8, 1],
  [2.9, 2],
  [999, 999],
]) {
  const state = reducer(enabled, { type: "setSunShelfLoungerCount", value: requested });
  equal(
    state.config.sunShelfLoungerCount,
    expected,
    `live quantity ${requested} clamps to ${expected}`,
  );
  equal(
    configuredSunShelfLoungers(state.config).count,
    requested > capacity ? 0 : expected,
    `clamped quantity ${requested} reaches layout`,
  );
  equal(
    normalizeSunShelfLoungers({ ...enabled.config, sunShelfLoungerCount: requested })
      .sunShelfLoungerCount,
    expected,
    `direct normalize quantity ${requested}`,
  );
  const rawProject = {
    ...project(enabled),
    config: { ...enabled.config, sunShelfLoungerCount: requested },
  };
  equal(
    parseProjectConfiguration(JSON.stringify(rawProject)).config.sunShelfLoungerCount,
    expected,
    `saved quantity ${requested} normalizes through parser`,
  );
}
for (const value of [Number.NaN, Infinity, -Infinity]) {
  equal(
    reducer(enabled, { type: "setSunShelfLoungerCount", value }),
    enabled,
    "non-finite count action is ignored",
  );
}

const explicit = reducer(enabled, { type: "setSunShelfLoungerCount", value: 2 });
equal(
  reducer(explicit, { type: "togglePoolFeature", value: "sunShelfLoungers" }).config,
  eligible.config,
  "explicit OFF removes only child selection and quantity",
);
const smaller = run(explicit, [
  { type: "setDimension", key: "length", value: 8 },
  { type: "setDimension", key: "width", value: 4 },
]);
equal(
  smaller.config,
  { ...explicit.config, dimensions: { ...explicit.config.dimensions, length: 8, width: 4 } },
  "8×4 preserves selected child and independent options",
);
equal(
  configuredSunShelfLoungers(smaller.config).count,
  2,
  "8×4 now has two dimensionally valid immersed chaises",
);
check(smaller.config.features.includes("sunShelfLoungers"), "compatible resize does not remove dependent choice");
equal(
  restore(smaller).config,
  smaller.config,
  "compatible resized selection survives reload",
);
check(
  run(smaller, [
    { type: "setDimension", key: "length", value: 12 },
    { type: "setDimension", key: "width", value: 5 },
  ]).config.features.includes("sunShelfLoungers"),
  "growing again retains the customer's existing furniture selection",
);

const removedShelf = reducer(explicit, { type: "togglePoolFeature", value: "sunShelf" });
equal(
  removedShelf.config,
  withoutCount({
    ...explicit.config,
    features: explicit.config.features.filter(
      (feature) => !["sunShelf", "sunShelfLoungers", "integratedBench"].includes(feature),
    ),
  }),
  "removing shelf clears only shelf-dependent loungers and bench",
);
check(
  removedShelf.config.equipment.includes("loungers") &&
    removedShelf.config.equipment.includes("heatPump"),
  "removing shelf preserves exterior equipment",
);
equal(
  configuredSunShelfLoungers(removedShelf.config).count,
  0,
  "removed shelf produces no immersed furniture",
);
equal(
  restore(removedShelf).config,
  removedShelf.config,
  "removed shelf state survives serialization",
);

const full = reducer(enabled, { type: "setSunShelfLoungerCount", value: capacity });
const narrower = reducer(full, { type: "setDimension", key: "width", value: 4 });
const narrowedCapacity = configuredSunShelfLoungers(narrower.config).capacity;
check(
  narrowedCapacity > 0 && narrowedCapacity < capacity,
  "narrower compatible shelf has smaller derived capacity",
);
equal(
  narrower.config,
  {
    ...full.config,
    dimensions: { ...full.config.dimensions, width: 4 },
    sunShelfLoungerCount: capacity,
  },
  "resize retains requested quantity for explicit resolution",
);
check(
  configuredSunShelfLoungers(narrower.config).adjusted && configuredSunShelfLoungers(narrower.config).count === 0,
  "oversized quantity is unresolved, never a silently capped partial order",
);

for (const config of [
  {
    ...explicit.config,
    features: explicit.config.features.filter((feature) => feature !== "sunShelf"),
  },
  { ...explicit.config, dimensions: { ...explicit.config.dimensions, length: 8, width: 4 } },
]) {
  const normalized = normalizeSunShelfLoungers(config);
  check(
    config.features.includes("sunShelf")
      ? normalized.features.includes("sunShelfLoungers") && normalized.sunShelfLoungerCount === 2
      : !normalized.features.includes("sunShelfLoungers") && normalized.sunShelfLoungerCount === undefined,
    "normalise only explicit parent removal, retain dimensional intent",
  );
  equal(
    normalized.equipment,
    config.equipment,
    "normalize preserves exterior furniture and equipment",
  );
  const parsedExpected = config.features.includes("sunShelf")
    ? normalized
    : {
        ...normalized,
        features: normalized.features.filter((feature) => feature !== "integratedBench"),
      };
  equal(
    parseProjectConfiguration(JSON.stringify({ ...project(explicit), config })).config,
    parsedExpected,
    "parser normalizes immersed loungers and existing shelf-dependent bench",
  );
}

const automaticRestored = restore(enabled);
equal(
  automaticRestored.config.sunShelfLoungerCount,
  undefined,
  "automatic count stays omitted in saved project",
);
equal(
  configuredSunShelfLoungers(automaticRestored.config).count,
  capacity,
  "automatic count recomputes after parse",
);
equal(
  shareableProject(automaticRestored).config.sunShelfLoungerCount,
  undefined,
  "share never fabricates explicit automatic count",
);
for (const locale of ["it", "en"]) {
  equal(
    loungerRows(buildProjectSummary(restore(smaller), locale)).map(row => row.value),
    [`${locale === "en" ? "Sun shelf loungers" : "Lettini per spiaggetta"} · 2 · ${locale === "en" ? "White" : "Bianco"}`],
    `${locale}: compatible resized child retains truthful quantity in summary`,
  );
  equal(
    loungerRows(buildProjectSummary(restore(eligible), locale)),
    [],
    `${locale}: OFF child omitted from summary`,
  );
}
const reset = reducer(explicit, { type: "reset" });
check(
  !reset.config.features.includes("sunShelfLoungers") &&
    reset.config.sunShelfLoungerCount === undefined,
  "reset returns immersed furniture to OFF",
);
// Colour choices are canonical project data, but never alter pool geometry,
// quantity, camera or other equipment. White is the non-mutating legacy default.
equal(sunShelfLoungerColor(initial.config.sunShelfLoungerColor).id, "white", "new projects default to white");
equal(SUN_SHELF_LOUNGER_COLORS.length, 6, "white plus five owner colour references");
equal(reducer(enabled, {type:"setSunShelfLoungerColor", value:"white"}), enabled, "choosing existing default white does not create a dirty change");
equal(reducer(initial, {type:"setSunShelfLoungerColor", value:"aqm"}), initial, "colour cannot enable the optional");
const english = {white:"White",agt:"Lime green",amb:"Taupe grey",aqm:"Aquamarine",fer:"Blue grey",gda:"Light green"};
const leadFor = project => ({customer:{name:"Colour QA",email:"qa@example.invalid",phone:"0000000000",projectLocation:"QA"},
  commercial:{timing:"evaluating",notes:"Offline colour QA"},privacy:{accepted:true,marketingConsent:false},idempotencyKey:"esse-color-local-audit",project});
for (const color of SUN_SHELF_LOUNGER_COLORS) {
  const state = reducer(enabled, {type:"setSunShelfLoungerColor", value:color.id});
  equal(sunShelfLoungerColor(state.config.sunShelfLoungerColor).id, color.id, "accepted colour");
  const {sunShelfLoungerColor:_color, ...selection} = state.config;
  equal(selection, enabled.config, "colour changes no other selections");
  equal(state.visualFocus, enabled.visualFocus, "colour preserves camera intent");
  equal(reducer(state, {type:"setSunShelfLoungerColor", value:color.id}), state, "same colour is a no-op");
  const restored = restore(state);
  check(leadSubmissionInputSchema.safeParse(leadFor(restored)).success, "valid colour accepted by quote server schema");
  equal(sunShelfLoungerColor(restored.config.sunShelfLoungerColor).id, color.id, "saved project round trip retains colour");
  equal(sunShelfLoungerColor(shareableProject(restored).config.sunShelfLoungerColor).id, color.id, "shared read-only snapshot retains colour");
  equal(sunShelfLoungerColor(createPhotoSceneSpec(restored).selection.sunShelfLoungerColor).id, color.id, "Photo Spec retains colour");
  for (const locale of ["it", "en"]) check(loungerRows(buildProjectSummary(restored, locale)).every(row => row.value.endsWith(locale === "en" ? english[color.id] : color.label)), "summary/PDF colour translated");
  const shelf = configuredPoolLayout(restored.config).comfort.elements.find(element => element.kind === "sunShelf");
  check(shelf && Math.abs(shelf.waterDepth - 0.1) < 1e-8, "owner-approved 10 cm water above real platform");
  for (const placement of configuredSunShelfLoungers(restored.config).placements) equal(placement.y, shelf.topY, "all colours stay grounded at new shelf height");
}
for (const invalid of ["unknown", "#ff0000", "", null, 42, {}]) {
  equal(reducer(enabled, {type:"setSunShelfLoungerColor",value:invalid}), enabled, "invalid colour action rejected");
  const raw = project(enabled); raw.config.sunShelfLoungerColor = invalid;
  assert.throws(() => parseProjectConfiguration(JSON.stringify(raw)), /sunShelfLoungerColor/); checks++;
  check(!leadSubmissionInputSchema.safeParse(leadFor(raw)).success, "invalid colour rejected by quote server schema");
}
equal(SUN_SHELF_WATER_DEPTH, 0.1, "actual shelf uses approved water depth, not only copy");
const tray = readFileSync("src/components/pool/wizard/StepTrays.tsx", "utf8");
check(tray.includes('image="/product-previews/esse-white.jpg"') && !tray.includes("lympha-immersed.jpg"), "owner-requested white product photo in wizard");
const picker = readFileSync("src/components/pool/wizard/SunShelfLoungerColorPicker.tsx", "utf8");
check(!picker.includes("<img") && picker.includes("aria-pressed") && picker.includes('size-11'), "accessible colour chips only, with touch-size controls");
console.log(
  `Sun Shelf state PASS: ${checks} checks; actual reducer, 12×5 capacity ${capacity}, quantities/colours, 10 cm immersion, project/shared/Photo Spec round trips, IT/EN summaries and quote schema. Offline; no backend calls.`,
);
