import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";
import { Mesh, MeshBasicMaterial, DoubleSide, Raycaster, Vector3 } from "three";

const file = join(process.cwd(), "node_modules/.cache/sun-shelf-loungers-audit.mjs");
await build({
  input: "sun-shelf-loungers-audit-entry",
  output: { file, format: "esm" },
  platform: "node",
  external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
  resolve: { alias: { "@": join(process.cwd(), "src") } },
  plugins: [
    {
      name: "sun-shelf-audit-entry",
      resolveId: (id) => (id === "sun-shelf-loungers-audit-entry" ? id : null),
      load: (id) =>
        id === "sun-shelf-loungers-audit-entry"
          ? `
      export * from "${join(process.cwd(), "src/lib/pool/sun-shelf-loungers.ts")}";
      export { createSunShelfChaiseGeometry } from "${join(process.cwd(), "src/components/pool/three/SunShelfLoungers.tsx")}";
      export { createLymphaFrameGeometry, createLymphaCushionGeometry } from "${join(process.cwd(), "src/components/pool/three/LymphaChaiseGeometry.ts")}";
      export { DECK_CHAISE_MODEL } from "${join(process.cwd(), "src/lib/pool/sun-shelf-model.ts")}";
      export { DEFAULT_DIMENSIONS, DEFAULT_CONTROL_POINTS, DEFAULT_CUSTOMER } from "${join(process.cwd(), "src/lib/pool/config.ts")}";
      export { configuredPoolLayout } from "${join(process.cwd(), "src/lib/pool/resolved-layout.ts")}";
      export { buildOutline } from "${join(process.cwd(), "src/lib/pool/geometry.ts")}";
      export { clampInfinityEdgeParams, infinityExclusion } from "${join(process.cwd(), "src/lib/pool/infinity-edge.ts")}";
      export { clearOfInfinityEdge } from "${join(process.cwd(), "src/lib/pool/infinity-access.ts")}";
    `
          : null,
    },
  ],
});
const {
  SUN_SHELF_LOUNGER_MODEL: model,
  SUN_SHELF_LOUNGER_LAYOUT: margins,
  configuredSunShelfLoungers,
  normalizeSunShelfLoungers,
  resolveSunShelfLoungers,
  createSunShelfChaiseGeometry,
  createLymphaFrameGeometry,
  createLymphaCushionGeometry,
  DECK_CHAISE_MODEL,
  DEFAULT_DIMENSIONS,
  DEFAULT_CONTROL_POINTS,
  DEFAULT_CUSTOMER,
  configuredPoolLayout,
  buildOutline,
  clampInfinityEdgeParams,
  infinityExclusion,
  clearOfInfinityEdge,
} = await import(pathToFileURL(file).href);
let checks = 0;
const check = (value, message) => {
  assert(value, message);
  checks++;
};
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const bounds = (outline) => ({
  minX: Math.min(...outline.map((p) => p[0])),
  maxX: Math.max(...outline.map((p) => p[0])),
  minZ: Math.min(...outline.map((p) => p[1])),
  maxZ: Math.max(...outline.map((p) => p[1])),
});
const overlaps = (a, b) =>
  a.minX < b.maxX - 1e-7 &&
  a.maxX > b.minX + 1e-7 &&
  a.minZ < b.maxZ - 1e-7 &&
  a.maxZ > b.minZ + 1e-7;
const base = {
  projectType: "new",
  poolType: "in-ground",
  structure: "concrete",
  shape: "rectangle",
  customMode: "draw",
  controlPoints: DEFAULT_CONTROL_POINTS,
  dimensions: DEFAULT_DIMENSIONS,
  system: "skimmer",
  overflowType: "hidden",
  skimmerFinish: "white",
  skimmerType: "slim",
  finish: "liner",
  linerColor: "motionBlueSky602",
  mosaicFinish: "white",
  features: ["sunShelf", "sunShelfLoungers"],
  poolAccess: "internalSteps",
  internalStairType: "linear",
  equipment: [],
  customer: DEFAULT_CUSTOMER,
  uploads: [],
};

const capacityReport = [];
for (const [length, width] of [
  [6, 3],
  [8, 4],
  [12, 5],
  [4, 8],
  [25, 12],
]) {
  const config = { ...base, dimensions: { ...DEFAULT_DIMENSIONS, length, width } };
  const plan = configuredSunShelfLoungers(config);
  const shelf = configuredPoolLayout(config).comfort.elements.find((e) => e.kind === "sunShelf");
  capacityReport.push({
    size: `${length}×${width}`,
    shelf: shelf ? bounds(shelf.footprint) : null,
    capacity: plan.capacity,
    reason: plan.reason,
  });
  check(
    JSON.stringify(plan) === JSON.stringify(configuredSunShelfLoungers(config)),
    "deterministic " + length + "×" + width,
  );
  for (const placement of plan.placements) {
    const footprint = bounds(placement.footprint),
      platform = bounds(shelf.footprint);
    check(
      footprint.minX >= platform.minX + margins.edgeInset - 1e-7 &&
        footprint.maxX <= platform.maxX - margins.edgeInset + 1e-7 &&
        footprint.minZ >= platform.minZ + margins.edgeInset - 1e-7 &&
        footprint.maxZ <= platform.maxZ - margins.edgeInset + 1e-7,
      "entire envelope on shelf",
    );
    for (const obstacle of [...(shelf.steps ?? []), ...(shelf.landing ? [shelf.landing] : [])]) {
      const block = bounds(obstacle.footprint);
      for (const key of ["minX", "minZ"]) block[key] -= margins.accessBuffer;
      for (const key of ["maxX", "maxZ"]) block[key] += margins.accessBuffer;
      check(!overlaps(footprint, block), "stair and landing buffer");
    }
    const alongX = length >= width;
    check(
      Math.abs(
        (alongX ? footprint.maxX - footprint.minX : footprint.maxZ - footprint.minZ) - model.length,
      ) < 1e-7,
      "fixed length",
    );
    check(
      Math.abs(
        (alongX ? footprint.maxZ - footprint.minZ : footprint.maxX - footprint.minX) - model.width,
      ) < 1e-7,
      "fixed width",
    );
    check(placement.y === shelf.topY, "base rests on shelf");
  }
  check(
    configuredSunShelfLoungers({ ...config, features: ["sunShelf"] }).count === 0,
    "off by default",
  );
  check(
    configuredSunShelfLoungers({ ...config, features: ["sunShelfLoungers"] }).count === 0,
    "requires shelf",
  );
  const excessive = normalizeSunShelfLoungers({ ...config, sunShelfLoungerCount: 99 });
  check(
    excessive.sunShelfLoungerCount === 99 && excessive.features.includes("sunShelfLoungers") && configuredSunShelfLoungers(excessive).count === 0,
    "retain excessive intent while rendering no unsafe partial order",
  );
}
for (const [length, width] of [
  [12, 5],
  [5, 12],
]) {
  for (const system of ["skimmer", "overflow", "infinity"]) {
    for (const floorProfile of ["flat", "slope"]) {
      for (const bench of [false, true]) {
        for (const side of system === "infinity" ? [0, 1, 2, 3] : [0]) {
          const dimensions = {
            ...DEFAULT_DIMENSIONS,
            length,
            width,
            floorProfile,
            shallowDepth: 0.95,
          };
          const outline = buildOutline("rectangle", dimensions, DEFAULT_CONTROL_POINTS);
          const infinityEdge = clampInfinityEdgeParams(outline, { side }, "rectangle");
          const config = {
            ...base,
            dimensions,
            system,
            infinityEdge,
            features: [...base.features, ...(bench ? ["integratedBench"] : [])],
          };
          const layout = configuredPoolLayout(config),
            plan = configuredSunShelfLoungers(config);
          const shelf = layout.comfort.elements.find((e) => e.kind === "sunShelf");
          const obstacles = layout.comfort.elements.flatMap((element) => [
            ...(element === shelf ? [] : [element.footprint]),
            ...(element.steps ?? []).map((step) => step.footprint),
            ...(element.landing ? [element.landing.footprint] : []),
          ]);
          const label = JSON.stringify({ length, width, system, floorProfile, bench, side });
          check(plan.available === plan.capacity > 0, "capacity availability " + label);
          for (const placement of plan.placements) {
            for (const obstacle of obstacles)
              check(
                !overlaps(bounds(placement.footprint), bounds(obstacle)),
                "no comfort collision " + label,
              );
            check(
              clearOfInfinityEdge(
                outline,
                system === "infinity"
                  ? infinityExclusion(outline, infinityEdge, "rectangle")
                  : null,
                placement.footprint,
              ),
              "actual infinity side clearance " + label,
            );
          }
        }
      }
    }
  }
}
const comfort = {
  elements: [
    {
      kind: "sunShelf",
      footprint: rect(-5, -2, -0.8, 2),
      landing: { footprint: rect(-5,-4,-2,-0.8), topY:-0.2 },
      topY: -0.2,
      waterDepth: 0.2,
      width: 2.8,
      run: 3,
    },
  ],
  availability: {
    sunShelf: { available: true },
    integratedBench: { available: true },
    hydromassage: { available: true },
  },
  displacedVolume: 0,
};
const input = { comfort, outline: rect(-5, 5, -2, 2), waterY: 0, enabled: true };
check(resolveSunShelfLoungers(input).capacity > 0, "supported flat shelf depth");
check(
  resolveSunShelfLoungers({ ...input, waterY: 0.009 }).capacity === 0,
  "reject depth beyond manufacturer 20 cm",
);
check(resolveSunShelfLoungers({ ...input, quantity: 1 }).count === 1, "requested one");
check(
  resolveSunShelfLoungers({ ...input, accessFootprints: [comfort.elements[0].footprint] }).count ===
    0,
  "access collision",
);
const infinity = resolveSunShelfLoungers({
  ...input,
  infinityExcluded: { axis: "z", coordinate: 2 },
});
check(
  infinity.placements.every((p) => Math.max(...p.footprint.map((v) => v[1])) <= 2 - 0.45 + 1e-7),
  "infinity clearance",
);
const missing = normalizeSunShelfLoungers({
  ...base,
  features: ["hydromassage", "sunShelfLoungers"],
  sunShelfLoungerCount: 2,
});
check(
  !missing.features.includes("sunShelfLoungers") && missing.sunShelfLoungerCount === undefined,
  "clear dependent selection",
);
const geometry = createSunShelfChaiseGeometry(),
  box = geometry.boundingBox;
check(
  Math.abs(box.max.x - box.min.x - model.width) < 1e-6 &&
    Math.abs(box.max.y - box.min.y - model.height) < 1e-6 &&
    Math.abs(box.max.z - box.min.z - model.length) < 1e-6 &&
    Math.abs(box.min.y) < 1e-7,
  "fixed mesh envelope rests at zero",
);
const positions = geometry.getAttribute("position");
check(Array.from(positions.array).every(Number.isFinite), "finite mesh");
const triangles=(geometry.index?.count ?? positions.count)/3;
check(triangles < 8000, "lightweight mesh budget, including real inner shell and openings");
const material = new MeshBasicMaterial({ side: DoubleSide });
const mesh = new Mesh(geometry, material);
mesh.updateMatrixWorld();
const ray = new Raycaster(new Vector3(0, 1, -0.4375), new Vector3(0, -1, 0));
check(ray.intersectObject(mesh).length === 0, "hand slot is an actual through opening");
ray.set(new Vector3(0.29, 1, -0.4375), new Vector3(0, -1, 0));
check(ray.intersectObject(mesh).length > 0, "solid shell remains beside the hand slot");
for (const [name, part] of [["frame", createLymphaFrameGeometry()], ["cushion", createLymphaCushionGeometry()]]) {
  const b = part.boundingBox;
  check(b.min.y >= -1e-7, name + " does not penetrate the paving");
  check(b.max.y <= DECK_CHAISE_MODEL.height + DECK_CHAISE_MODEL.cushionAllowance, name + " within reserved camera envelope");
  check(b.min.x >= -model.width / 2 && b.max.x <= model.width / 2 && b.min.z >= -model.length / 2 && b.max.z <= model.length / 2, name + " within reserved footprint");
  check(Array.from(part.getAttribute("position").array).every(Number.isFinite), name + " finite vertices");
  part.dispose();
}
material.dispose();
geometry.dispose();
console.log(
  JSON.stringify({ checks, meshTriangles: triangles, capacityReport }, null, 2),
);
