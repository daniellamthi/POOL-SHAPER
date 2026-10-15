import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";

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
      [`${label} · ${quantity}`],
      `${locale}: summary has one truthful quantity ${quantity}`,
    );
  }
}

for (const [requested, expected] of [
  [0, 1],
  [-8, 1],
  [2.9, 2],
  [999, capacity],
]) {
  const state = reducer(enabled, { type: "setSunShelfLoungerCount", value: requested });
  equal(
    state.config.sunShelfLoungerCount,
    expected,
    `live quantity ${requested} clamps to ${expected}`,
  );
  equal(
    configuredSunShelfLoungers(state.config).count,
    expected,
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
  { ...eligible.config, dimensions: { ...eligible.config.dimensions, length: 8, width: 4 } },
  "8×4 removes only unsupported dependent and count; shelf, bench, external loungers and other selections survive",
);
equal(
  configuredSunShelfLoungers(smaller.config).count,
  0,
  "8×4 has no immersed furniture geometry",
);
check(
  typeof smaller.sunShelfNotice === "string" && smaller.sunShelfNotice.length > 0,
  "resize explains dependent removal",
);
equal(
  restore(smaller).config,
  smaller.config,
  "unsupported resized selection stays removed after reload",
);
check(
  !run(smaller, [
    { type: "setDimension", key: "length", value: 12 },
    { type: "setDimension", key: "width", value: 5 },
  ]).config.features.includes("sunShelfLoungers"),
  "growing again never silently re-enables furniture",
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
    sunShelfLoungerCount: narrowedCapacity,
  },
  "compatible resize only updates width and caps explicit count",
);
check(
  typeof narrower.sunShelfNotice === "string" && narrower.sunShelfNotice.length > 0,
  "compatible quantity adjustment has notice",
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
    !normalized.features.includes("sunShelfLoungers") &&
      normalized.sunShelfLoungerCount === undefined,
    "normalize removes impossible dependent/count",
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
    loungerRows(buildProjectSummary(restore(smaller), locale)),
    [],
    `${locale}: unavailable child omitted from summary`,
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
console.log(
  `Sun Shelf state PASS: ${checks} checks; actual reducer, 12×5 capacity ${capacity}, explicit/automatic counts, resize and dependencies, project/shared round trips, IT/EN summaries. Offline; no backend calls.`,
);
