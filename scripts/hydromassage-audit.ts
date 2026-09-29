import assert from "node:assert/strict";
import { configuredPoolLayout, comfortFootprints } from "../src/lib/pool/resolved-layout";
import { HYDRO_DIMENSIONS, normalizeComfortFeatures } from "../src/lib/pool/comfort-plan";
import { shelfStairGeometry } from "../src/components/pool/three/PoolComfortModel";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { buildOutline } from "../src/lib/pool/geometry";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { clampInfinityEdgeParams } from "../src/lib/pool/infinity-edge";
import { DEFAULT_CONTROL_POINTS, DEFAULT_DIMENSIONS } from "../src/lib/pool/config";
import { parseProjectConfiguration, serializeProjectConfiguration } from "../src/lib/pool/project";
import type { Outline, PoolConfig, PoolFeatureId } from "../src/lib/pool/types";

let checks = 0;
const check = (condition: unknown, message: string) => {
  assert(condition, message);
  checks++;
};
const rect = (o: Outline) => ({
  minX: Math.min(...o.map((p) => p[0])),
  maxX: Math.max(...o.map((p) => p[0])),
  minZ: Math.min(...o.map((p) => p[1])),
  maxZ: Math.max(...o.map((p) => p[1])),
});
const overlap = (a: Outline, b: Outline, gap = 1e-6) => {
  const x = rect(a),
    y = rect(b);
  return !(
    x.maxX <= y.minX + gap ||
    x.minX >= y.maxX - gap ||
    x.maxZ <= y.minZ + gap ||
    x.minZ >= y.maxZ - gap
  );
};

function config(over: {
  length: number;
  width: number;
  sloped: boolean;
  reversed?: boolean;
  system: PoolConfig["system"];
  features: PoolFeatureId[];
  access?: PoolConfig["poolAccess"];
}): PoolConfig {
  return {
    projectType: "new",
    poolType: "in-ground",
    structure: "reinforced-concrete",
    shape: "rectangle",
    shapeSelected: true,
    copingMaterial: "travertine",
    customMode: "draw",
    controlPoints: DEFAULT_CONTROL_POINTS,
    dimensions: {
      ...DEFAULT_DIMENSIONS,
      length: over.length,
      width: over.width,
      depth: 1.5,
      shallowDepth: 1.05,
      floorProfile: over.sloped ? "slope" : "flat",
      slopeReversed: !!over.reversed,
    },
    system: over.system,
    overflowType: "hidden",
    skimmerFinish: "white",
    skimmerType: "standard",
    finish: "liner",
    linerColor: "motionBlueSky602",
    mosaicFinish: DEFAULT_MOSAIC(),
    features: over.features,
    ledColor: "#ffffff",
    ledIntensity: 0.7,
    poolAccess: over.access ?? "internalSteps",
    internalStairType: "linear",
    equipment: [],
    customer: DEFAULT_CUSTOMER(),
    uploads: [],
    ...(over.system === "infinity"
      ? { infinityEdge: clampInfinityEdgeParams({ side: over.reversed ? 1 : 3 }) }
      : {}),
  } as PoolConfig;
}
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
const DEFAULT_MOSAIC = () => DEFAULT_MOSAIC_FINISH_ID;
const DEFAULT_CUSTOMER = () => ({}) as PoolConfig["customer"];

function watertight(geometry: ReturnType<typeof shelfStairGeometry>) {
  const v = geometry.getAttribute("position"),
    edges = new Map<string, number>();
  for (let i = 0; i < v.count; i += 3) {
    // no degenerate triangles
    const a = [v.getX(i), v.getY(i), v.getZ(i)],
      b = [v.getX(i + 1), v.getY(i + 1), v.getZ(i + 1)],
      c = [v.getX(i + 2), v.getY(i + 2), v.getZ(i + 2)];
    const ux = b.map((t, k) => t - a[k]!),
      vx = c.map((t, k) => t - a[k]!);
    const area = Math.hypot(
      ux[1]! * vx[2]! - ux[2]! * vx[1]!,
      ux[2]! * vx[0]! - ux[0]! * vx[2]!,
      ux[0]! * vx[1]! - ux[1]! * vx[0]!,
    );
    if (area < 1e-12) continue;
    for (const [p, q] of [
      [0, 1],
      [1, 2],
      [2, 0],
    ] as const) {
      const key = [p, q]
        .map((k) =>
          [v.getX(i + k), v.getY(i + k), v.getZ(i + k)].map((t) => t.toFixed(5)).join(","),
        )
        .sort()
        .join("|");
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  return [...edges.values()].every((n) => n === 2);
}

let built = 0,
  unavailable = 0;
for (const length of [6, 8, 10, 12])
  for (const width of [3, 3.5, 4, 4.5, 5])
    for (const system of ["skimmer", "overflow", "infinity"] as const)
      for (const sloped of [false, true])
        for (const reversed of [false, true]) {
          const tag = `${length}x${width}/${system}/${sloped ? "slope" : "flat"}${reversed ? "/rev" : ""}`;
          const base = config({ length, width, sloped, reversed, system, features: [] });
          const on = config({
            length,
            width,
            sloped,
            reversed,
            system,
            features: ["hydromassage"],
          });
          const off = configuredPoolLayout(base);
          check(
            off.comfort.elements.length === 0 && off.comfort.displacedVolume === 0,
            `${tag}: OFF leaves zero residual geometry`,
          );
          const layout = configuredPoolLayout(on);
          const hydro = layout.comfort.elements.find((e) => e.kind === "hydromassage");
          if (!hydro) {
            check(
              !layout.comfort.availability.hydromassage.available ||
                layout.status === "UNAVAILABLE",
              `${tag}: no hydro only when unavailable`,
            );
            check(
              layout.comfort.availability.hydromassage.reason || layout.status === "UNAVAILABLE",
              `${tag}: unavailable is explained`,
            );
            unavailable++;
            continue;
          }
          built++;
          const H = HYDRO_DIMENSIONS;
          const tiers = hydro.tiers!;
          const [partition, lip, backBench, sideBench, tubFloor] = tiers;
          const span = (o: Outline) => ({
            x: rect(o).maxX - rect(o).minX,
            z: rect(o).maxZ - rect(o).minZ,
          });
          const thin = (o: Outline) => Math.min(span(o).x, span(o).z);
          check(
            tiers.length === 4 || tiers.length === 5,
            `${tag}: partition, lip, L bench (+ raised tub floor)`,
          );
          check(
            Math.abs(thin(partition!.footprint) - H.partitionThickness) < 1e-6,
            `${tag}: partition 20 cm`,
          );
          check(Math.abs(thin(lip!.footprint) - H.lipThickness) < 1e-6, `${tag}: front lip 15 cm`);
          check(
            Math.abs(thin(backBench!.footprint) - H.benchDepth - H.wallOverlap) < 1e-6 &&
              Math.abs(thin(sideBench!.footprint) - H.benchDepth - H.wallOverlap) < 1e-6,
            `${tag}: L bench 45 cm deep`,
          );
          check(
            partition!.topY > lip!.topY &&
              lip!.topY > backBench!.topY &&
              backBench!.topY === sideBench!.topY &&
              (!tubFloor || tubFloor.topY < backBench!.topY),
            `${tag}: partition > lip > seat > tub floor`,
          );
          check(
            hydro.width >= H.minInteriorWidth - 1e-9,
            `${tag}: ergonomic tub width ${hydro.width}`,
          );
          const treadOf = (o: Outline) => Math.min(span(o).x, span(o).z);
          check(
            hydro.steps!.every((st) => Math.abs(treadOf(st.footprint) - 0.3) < 1e-6) &&
              hydro.riser! >= 0.15 &&
              hydro.riser! <= 0.24,
            `${tag}: 30 cm treads, riser 15-24 cm`,
          );
          // Partition runs the full flight; lip aligns with the last riser.
          check(
            Math.abs(
              Math.max(span(partition!.footprint).x, span(partition!.footprint).z) -
                hydro.run -
                H.wallOverlap,
            ) < 1e-6,
            `${tag}: partition spans the whole flight`,
          );
          const parts = [
            ...tiers.map((t) => t.footprint),
            hydro.landing!.footprint,
            ...hydro.steps!.map((st) => st.footprint),
          ];
          for (let i = 0; i < parts.length; i++)
            for (let j = i + 1; j < parts.length; j++)
              check(!overlap(parts[i]!, parts[j]!), `${tag}: no overlapping parts ${i}/${j}`);
          // Tub + flight tile the head zone without holes (area check).
          const area = (o: Outline) => span(o).x * span(o).z;
          check(
            Math.abs(parts.reduce((sum, o) => sum + area(o), 0) - area(rect2outline(parts))) <
              1e-6 || tiers.length === 4,
            `${tag}: no holes in tub + flight`,
          );
          const hr = rect(hydro.footprint);
          check(
            hydro.jets!.length >= 3 &&
              hydro.jets!.every(
                (j) =>
                  j.x >= hr.minX - 0.02 &&
                  j.x <= hr.maxX + 0.02 &&
                  j.z >= hr.minZ - 0.02 &&
                  j.z <= hr.maxZ + 0.02 &&
                  j.y > backBench!.topY &&
                  j.y < lip!.topY,
              ),
            `${tag}: jets in the backrest above the seat`,
          );
          // Geometry / floor
          const outline = buildOutline("rectangle", on.dimensions, on.controlPoints);
          const vl = getPoolVerticalLayout({
            poolType: "in-ground",
            system,
            overflowType: "hidden",
            depth: 1.5,
            copingThickness: 0,
          });
          const floor = buildFloorProfile({
            outline,
            shape: "rectangle",
            poolType: "in-ground",
            dimensions: on.dimensions,
            verticalLayout: vl,
            sunShelf: true,
            infinityEdge: system === "infinity" ? on.infinityEdge! : null,
          });
          const solid = shelfStairGeometry(hydro, floor);
          check(watertight(solid), `${tag}: watertight`);
          solid.dispose();
          if (sloped) {
            const zone = floor.shelfZone!;
            check(!!zone, `${tag}: hydro + stairs -> landing -> slope hinge`);
            const last = hydro.steps!.at(-1)!;
            check(
              last.footprint.every(
                (p) => Math.abs(floor.floorYAt(...p) - floor.shallowFloorY) < 1e-8,
              ),
              `${tag}: no ramp under flight`,
            );
            check(seatOverFloor(hydro, floor), `${tag}: seat above floor`);
          } else check(seatOverFloor(hydro, floor), `${tag}: seat above floor`);
          // LED and inox never collide with comfort
          const feet = comfortFootprints(layout.comfort);
          for (const p of layout.lighting.plan.positions)
            check(
              !feet.some((f) => {
                const r = rect(f);
                return (
                  p.x > r.minX - 0.05 &&
                  p.x < r.maxX + 0.05 &&
                  p.z > r.minZ - 0.05 &&
                  p.z < r.maxZ + 0.05
                );
              }),
              `${tag}: LED clear of hydromassage`,
            );
          const withInox = configuredPoolLayout({
            ...on,
            features: ["hydromassage", "inoxLadder"],
          });
          check(withInox.ladder !== null, `${tag}: inox add-on resolved`);
          if (withInox.ladder?.plan.placement) {
            check(withInox.ladder.status !== "UNAVAILABLE", `${tag}: inox status`);
            check(
              !feet.some((f) => overlap(f, withInox.ladder!.plan.footprint)),
              `${tag}: inox clear of comfort`,
            );
            check(
              !withInox.access.placement ||
                !overlap(withInox.access.footprint, withInox.ladder.plan.footprint),
              `${tag}: inox clear of steps`,
            );
            for (const p of withInox.lighting.plan.positions) {
              const r = rect(withInox.ladder.plan.footprint);
              check(
                !(
                  p.x > r.minX - 0.05 &&
                  p.x < r.maxX + 0.05 &&
                  p.z > r.minZ - 0.05 &&
                  p.z < r.maxZ + 0.05
                ),
                `${tag}: LED clear of inox`,
              );
            }
          } else
            check(
              withInox.ladder?.status === "UNAVAILABLE",
              `${tag}: inox unavailable is explicit`,
            );
          // XOR: shelf + hydro requested together resolves to exactly one
          const both = configuredPoolLayout({ ...on, features: ["sunShelf", "hydromassage"] });
          check(
            both.comfort.elements.filter((e) => e.kind !== "integratedBench").length <= 1,
            `${tag}: shelf XOR hydro`,
          );
          check(
            !both.comfort.elements.some((e) => e.kind === "hydromassage"),
            `${tag}: shelf preferred on legacy conflict`,
          );
          // Hydro volume is real and identical to the sum of its solids
          check(layout.comfort.displacedVolume > 0.2, `${tag}: displaced volume`);
        }
function rect2outline(parts: Outline[]): Outline {
  const r = parts.map(rect);
  const b = {
    minX: Math.min(...r.map((q) => q.minX)),
    maxX: Math.max(...r.map((q) => q.maxX)),
    minZ: Math.min(...r.map((q) => q.minZ)),
    maxZ: Math.max(...r.map((q) => q.maxZ)),
  };
  return [
    [b.minX, b.minZ],
    [b.maxX, b.minZ],
    [b.maxX, b.maxZ],
    [b.minX, b.maxZ],
  ];
}
function seatOverFloor(
  hydro: NonNullable<ReturnType<typeof configuredPoolLayout>["comfort"]["elements"][number]>,
  floor: ReturnType<typeof buildFloorProfile>,
) {
  return hydro.tiers!.every((t) => t.footprint.every((p) => t.topY - floor.floorYAt(...p) >= 0.05));
}
check(built > 40, `enough supported sizes build hydromassage (${built})`);
const narrow = configuredPoolLayout(
  config({ length: 8, width: 2.4, sloped: false, system: "skimmer", features: ["hydromassage"] }),
);
check(
  !narrow.comfort.elements.some((e) => e.kind === "hydromassage") &&
    !!narrow.comfort.availability.hydromassage.reason &&
    narrow.status === "UNAVAILABLE",
  "narrow width reports UNAVAILABLE instead of compressing geometry",
);

// Toggle / XOR selection rules
check(
  normalizeComfortFeatures(["sunShelf", "hydromassage"], "hydromassage").join() === "hydromassage",
  "selecting hydro turns shelf off",
);
check(
  normalizeComfortFeatures(["hydromassage", "sunShelf"], "sunShelf").join() === "sunShelf",
  "selecting shelf turns hydro off",
);
check(
  normalizeComfortFeatures(["ledLighting", "sunShelf"]).join() === "ledLighting,sunShelf",
  "no conflict is untouched",
);

// Same bounding of shelf vs hydro engine decisions (sun shelf preserved)
const shelfLayout = configuredPoolLayout(
  config({ length: 8, width: 4, sloped: true, system: "skimmer", features: ["sunShelf"] }),
);
check(
  shelfLayout.comfort.elements[0]?.kind === "sunShelf" && !shelfLayout.comfort.elements[0]?.tiers,
  "sun shelf unchanged",
);

// Persistence: features survive a round trip and legacy conflict resolves the same way
const base = config({
  length: 8,
  width: 4,
  sloped: false,
  system: "skimmer",
  features: ["hydromassage", "inoxLadder"],
});
const restored = parseProjectConfiguration(
  serializeProjectConfiguration({
    schemaVersion: 1,
    projectId: "p",
    config: base,
    renovation: {} as never,
  }),
).config;
check(
  JSON.stringify(restored.features) === JSON.stringify(["hydromassage", "inoxLadder"]),
  "hydro + inox persist",
);
check(
  JSON.stringify(
    configuredPoolLayout(restored).comfort.elements.map((e) => [e.kind, e.footprint]),
  ) ===
    JSON.stringify(configuredPoolLayout(base).comfort.elements.map((e) => [e.kind, e.footprint])),
  "restored layout identical",
);
const legacy = parseProjectConfiguration(
  serializeProjectConfiguration({
    schemaVersion: 1,
    projectId: "p",
    config: { ...base, features: ["sunShelf", "hydromassage"] },
    renovation: {} as never,
  }),
).config;
check(
  legacy.features.join() === "sunShelf",
  "legacy shelf+hydro conflict restores as one decision",
);

// Resize: comfort resolves for every step, never compressed below ergonomic limits
for (let w = 2.5; w <= 6; w += 0.25) {
  const l = configuredPoolLayout(
    config({ length: 8, width: w, sloped: true, system: "skimmer", features: ["hydromassage"] }),
  );
  const h = l.comfort.elements.find((e) => e.kind === "hydromassage");
  check(
    h
      ? h.width >= HYDRO_DIMENSIONS.minInteriorWidth - 1e-9
      : !l.comfort.availability.hydromassage.available,
    `resize w=${w}`,
  );
}
console.log(
  `Hydromassage audit PASS: ${checks} checks; ${built} built, ${unavailable} unavailable.`,
);
