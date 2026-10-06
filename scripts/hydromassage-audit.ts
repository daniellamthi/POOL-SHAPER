import assert from "node:assert/strict";
import { configuredPoolLayout, comfortFootprints } from "../src/lib/pool/resolved-layout";
import {
  HYDRO_DIMENSIONS,
  normalizeComfortFeatures,
  type ComfortElementPlan,
  type HydroTierRole,
} from "../src/lib/pool/comfort-plan";
import { shelfStairGeometry } from "../src/components/pool/three/PoolComfortModel";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { buildOutline } from "../src/lib/pool/geometry";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { clampInfinityEdgeParams } from "../src/lib/pool/infinity-edge";
import { DEFAULT_CONTROL_POINTS, DEFAULT_DIMENSIONS } from "../src/lib/pool/config";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import { parseProjectConfiguration, serializeProjectConfiguration } from "../src/lib/pool/project";
import type {
  HydromassageVariant,
  Outline,
  PoolConfig,
  PoolFeatureId,
} from "../src/lib/pool/types";

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
const span = (o: Outline) => ({ x: rect(o).maxX - rect(o).minX, z: rect(o).maxZ - rect(o).minZ });
const thin = (o: Outline) => Math.min(span(o).x, span(o).z);
const area = (o: Outline) => span(o).x * span(o).z;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
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
const near = (p: { x: number; z: number }, o: Outline) => {
  const r = rect(o);
  return p.x > r.minX - 0.05 && p.x < r.maxX + 0.05 && p.z > r.minZ - 0.05 && p.z < r.maxZ + 0.05;
};
const tier = (h: ComfortElementPlan, role: HydroTierRole) => h.tiers!.find((t) => t.role === role);
const hydroOf = (l: ReturnType<typeof configuredPoolLayout>) =>
  l.comfort.elements.find((e) => e.kind === "hydromassage");

function config(over: {
  length: number;
  width: number;
  sloped: boolean;
  reversed?: boolean;
  system: PoolConfig["system"];
  features: PoolFeatureId[];
  variant?: HydromassageVariant;
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
    mosaicFinish: DEFAULT_MOSAIC_FINISH_ID,
    features: over.features,
    ledColor: "#ffffff",
    ledIntensity: 0.7,
    poolAccess: "internalSteps",
    internalStairType: "linear",
    equipment: [],
    customer: {} as PoolConfig["customer"],
    uploads: [],
    ...(over.variant ? { hydromassageVariant: over.variant } : {}),
    ...(over.system === "infinity"
      ? { infinityEdge: clampInfinityEdgeParams({ side: over.reversed ? 1 : 3 }) }
      : {}),
  } as PoolConfig;
}

function watertight(geometry: ReturnType<typeof shelfStairGeometry>) {
  const v = geometry.getAttribute("position"),
    edges = new Map<string, number>();
  for (let i = 0; i < v.count; i += 3) {
    const a = [v.getX(i), v.getY(i), v.getZ(i)],
      b = [v.getX(i + 1), v.getY(i + 1), v.getZ(i + 1)],
      c = [v.getX(i + 2), v.getY(i + 2), v.getZ(i + 2)];
    const ux = b.map((t, k) => t - a[k]!),
      vx = c.map((t, k) => t - a[k]!);
    const cross = Math.hypot(
      ux[1]! * vx[2]! - ux[2]! * vx[1]!,
      ux[2]! * vx[0]! - ux[0]! * vx[2]!,
      ux[0]! * vx[1]! - ux[1]! * vx[0]!,
    );
    if (cross < 1e-12) continue;
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

function bbox(parts: Outline[]): Outline {
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

const H = HYDRO_DIMENSIONS;
let built = 0,
  unavailable = 0;
for (const length of [6, 8, 10, 12])
  for (const width of [3, 3.5, 4, 4.5, 5])
    for (const system of ["skimmer", "overflow", "infinity"] as const)
      for (const sloped of [false, true])
        for (const reversed of [false, true]) {
          const tag = `${length}x${width}/${system}/${sloped ? "slope" : "flat"}${reversed ? "/rev" : ""}`;
          const shape = { length, width, sloped, reversed, system };
          const off = configuredPoolLayout(config({ ...shape, features: [] }));
          check(
            off.comfort.elements.length === 0 && off.comfort.displacedVolume === 0,
            `${tag}: OFF leaves zero residual geometry`,
          );
          const offOpen = configuredPoolLayout(config({ ...shape, features: [], variant: "open" }));
          check(offOpen.comfort.elements.length === 0, `${tag}: OFF + open variant leaves nothing`);
          const byDefault = configuredPoolLayout(config({ ...shape, features: ["hydromassage"] }));
          const closedCfg = config({ ...shape, features: ["hydromassage"], variant: "closed" });
          const openCfg = config({ ...shape, features: ["hydromassage"], variant: "open" });
          const lc = configuredPoolLayout(closedCfg),
            lo = configuredPoolLayout(openCfg);
          const hc = hydroOf(lc),
            ho = hydroOf(lo);
          check(same(hydroOf(byDefault), hc), `${tag}: default variant is closed`);
          check(
            same(lc.comfort.availability, lo.comfort.availability) && lc.status === lo.status,
            `${tag}: same compatibility for open and closed`,
          );
          if (!hc || !ho) {
            check(!hc && !ho, `${tag}: both variants unavailable together`);
            check(
              !!lc.comfort.availability.hydromassage.reason || lc.status === "UNAVAILABLE",
              `${tag}: unavailable is explained`,
            );
            unavailable++;
            continue;
          }
          built++;

          // CLOSED: divider top === front wall top, one shared quota.
          const dividerC = tier(hc, "divider")!,
            frontC = tier(hc, "frontWall");
          check(!!frontC, `${tag}: CLOSED has a front wall`);
          check(dividerC.topY === frontC!.topY, `${tag}: CLOSED dividerTop === frontWallTop`);
          check(
            dividerC.topY === lc.comfort.elements[0]!.topY &&
              Math.abs(dividerC.topY - (hc.landing!.topY + 0.22 - H.wallWaterDepth)) < 1e-9,
            `${tag}: wall top is the shared parametric quota`,
          );
          check(Math.abs(thin(frontC!.footprint) - H.lipThickness) < 1e-6, `${tag}: front wall 15 cm`);
          // OPEN: no front wall, nothing left where it stood.
          check(!tier(ho, "frontWall"), `${tag}: OPEN front wall absent`);
          check(!!tier(ho, "innerSideSeat"), `${tag}: OPEN has the opposite short-side seat for a U bench`);
          check(!tier(hc, "innerSideSeat"), `${tag}: CLOSED keeps the L bench clear of its open side`);
          check(
            !ho.tiers!.some((t) => overlap(t.footprint, frontC!.footprint) && t.topY > tier(ho, "backSeat")!.topY),
            `${tag}: OPEN no residual front-wall geometry`,
          );
          // BOTH: same footprint, divider, stairs, seat, jet rule.
          check(same(hc.footprint, ho.footprint), `${tag}: same footprint`);
          check(same(dividerC, tier(ho, "divider")), `${tag}: same divider`);
          check(
            same(hc.steps, ho.steps) && same(hc.landing, ho.landing) && hc.riser === ho.riser,
            `${tag}: same stair integration`,
          );
          check(same(tier(hc, "backSeat"), tier(ho, "backSeat")), `${tag}: same back seat`);
          const sideC = tier(hc, "sideSeat")!,
            sideO = tier(ho, "sideSeat")!;
          check(
            sideC.topY === sideO.topY && Math.abs(thin(sideC.footprint) - thin(sideO.footprint)) < 1e-9,
            `${tag}: same side seat section`,
          );
          const headJets = (h: ComfortElementPlan) =>
            h.jets!.filter((j) => same(j.dir, hc.jets![0]!.dir));
          check(same(headJets(hc), headJets(ho)), `${tag}: same backrest jet layout`);
          check(
            new Set(ho.jets!.map((j) => j.dir.join(","))).size === 3,
            `${tag}: OPEN has jets on all three sides of the U bench`,
          );
          check(
            ho.jets!.length >= hc.jets!.length && ho.jets!.every((j) => j.y === hc.jets![0]!.y),
            `${tag}: same jet height rule, open side runs to its front edge`,
          );

          const outline = buildOutline("rectangle", closedCfg.dimensions, closedCfg.controlPoints);
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
            dimensions: closedCfg.dimensions,
            verticalLayout: vl,
            sunShelf: true,
            infinityEdge: system === "infinity" ? closedCfg.infinityEdge! : null,
          });

          for (const [variant, layout, hydro] of [
            ["closed", lc, hc],
            ["open", lo, ho],
          ] as const) {
            const vtag = `${tag}/${variant}`;
            const divider = tier(hydro, "divider")!,
              back = tier(hydro, "backSeat")!,
              side = tier(hydro, "sideSeat")!,
              innerSideSeat = tier(hydro, "innerSideSeat"),
              tub = tier(hydro, "tubFloor");
            check(Math.abs(thin(divider.footprint) - H.partitionThickness) < 1e-6, `${vtag}: divider 20 cm`);
            check(
              Math.abs(thin(back.footprint) - H.benchDepth - H.wallOverlap) < 1e-6 &&
                Math.abs(thin(side.footprint) - H.benchDepth - H.wallOverlap) < 1e-6,
              `${vtag}: primary seats 45 cm deep`,
            );
            check(
              variant === "open"
                ? !!innerSideSeat && Math.abs(thin(innerSideSeat.footprint) - H.benchDepth) < 1e-6 && innerSideSeat.topY === back.topY
                : !innerSideSeat,
              `${vtag}: ${variant === "open" ? "U bench has opposite short-side seat" : "L bench has no opposite short-side seat"}`,
            );
            check(
              divider.topY > back.topY && back.topY === side.topY && (!tub || tub.topY < back.topY),
              `${vtag}: wall > seat > tub floor`,
            );
            check(
              Math.abs(back.topY - (divider.topY + H.wallWaterDepth - H.seatWaterDepth)) < 1e-9,
              `${vtag}: seat 45 cm under water`,
            );
            check(hydro.width >= H.minInteriorWidth - 1e-9, `${vtag}: ergonomic width`);
            check(
              hydro.steps!.every((st) => Math.abs(thin(st.footprint) - 0.3) < 1e-6) &&
                hydro.riser! >= 0.15 &&
                hydro.riser! <= 0.24,
              `${vtag}: 30 cm treads, riser 15-24 cm`,
            );
            check(
              Math.abs(Math.max(span(divider.footprint).x, span(divider.footprint).z) - hydro.run - H.wallOverlap) <
                1e-6,
              `${vtag}: divider spans the whole flight`,
            );
            const parts = [
              ...hydro.tiers!.map((t) => t.footprint),
              hydro.landing!.footprint,
              ...hydro.steps!.map((st) => st.footprint),
            ];
            for (let i = 0; i < parts.length; i++)
              for (let j = i + 1; j < parts.length; j++)
                check(!overlap(parts[i]!, parts[j]!), `${vtag}: no overlapping parts ${i}/${j}`);
            check(
              !tub || Math.abs(parts.reduce((sum, o) => sum + area(o), 0) - area(bbox(parts))) < 1e-6,
              `${vtag}: no holes in tub + flight`,
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
                    j.y > back.topY &&
                    j.y < divider.topY,
                ),
              `${vtag}: jets in the backrest above the seat`,
            );
            check(
              hydro.spots!.length >= 2 &&
                hydro.spots!.every(
                  (s) =>
                    s.x >= hr.minX - 0.02 &&
                    s.x <= hr.maxX + 0.02 &&
                    s.z >= hr.minZ - 0.02 &&
                    s.z <= hr.maxZ + 0.02 &&
                    s.y < back.topY &&
                    s.y > floor.floorYAt(s.x, s.z),
                ),
              `${vtag}: micro-spots in the seat front face, under the seat edge`,
            );
            const solid = shelfStairGeometry(hydro, floor);
            check(watertight(solid), `${vtag}: watertight`);
            solid.dispose();
            check(
              hydro.tiers!.every((t) => t.footprint.every((p) => t.topY - floor.floorYAt(...p) >= 0.05)),
              `${vtag}: every level stands above the floor`,
            );
            if (sloped) {
              const zone = floor.shelfZone!;
              check(!!zone, `${vtag}: stairs -> landing -> slope hinge`);
              // Same slope start rule: the whole comfort zone sits on the flat shallow floor.
              check(
                parts.every((o) => o.every((p) => Math.abs(floor.floorYAt(...p) - floor.shallowFloorY) < 1e-8)),
                `${vtag}: no ramp under stairs or tub`,
              );
            }
            const feet = comfortFootprints(layout.comfort);
            for (const p of layout.lighting.plan.positions)
              check(!feet.some((f) => near(p, f)), `${vtag}: LED clear of hydromassage`);
            const withInox = configuredPoolLayout({
              ...(variant === "open" ? openCfg : closedCfg),
              features: ["hydromassage", "inoxLadder"],
            });
            if (withInox.ladder?.plan.placement) {
              check(
                !feet.some((f) => overlap(f, withInox.ladder!.plan.footprint)),
                `${vtag}: inox clear of comfort`,
              );
              for (const p of withInox.lighting.plan.positions)
                check(!near(p, withInox.ladder.plan.footprint), `${vtag}: LED clear of inox`);
            } else check(withInox.ladder?.status === "UNAVAILABLE", `${vtag}: inox unavailable explicit`);
            const both = configuredPoolLayout({
              ...(variant === "open" ? openCfg : closedCfg),
              features: ["sunShelf", "hydromassage"],
            });
            check(!hydroOf(both), `${vtag}: shelf XOR hydro`);
            check(layout.comfort.displacedVolume > 0.2, `${vtag}: displaced volume`);
          }
          // Toggle open -> closed -> open is deterministic.
          check(same(hydroOf(configuredPoolLayout(openCfg)), ho), `${tag}: toggle back to open`);
        }
check(built > 40, `enough supported sizes build hydromassage (${built})`);
for (const variant of ["closed", "open"] as const) {
  const narrow = configuredPoolLayout(
    config({ length: 8, width: 2.4, sloped: false, system: "skimmer", features: ["hydromassage"], variant }),
  );
  check(
    !hydroOf(narrow) && !!narrow.comfort.availability.hydromassage.reason && narrow.status === "UNAVAILABLE",
    `${variant}: narrow width is UNAVAILABLE, never compressed`,
  );
}

check(
  normalizeComfortFeatures(["sunShelf", "hydromassage"], "hydromassage").join() === "hydromassage",
  "selecting hydro turns shelf off",
);
check(
  normalizeComfortFeatures(["hydromassage", "sunShelf"], "sunShelf").join() === "sunShelf",
  "selecting shelf turns hydro off",
);
check(
  normalizeComfortFeatures(
    ["sunShelf", "integratedBench", "hydromassage"],
    "hydromassage",
  ).join() === "hydromassage" &&
    normalizeComfortFeatures(["integratedBench"]).length === 0 &&
    normalizeComfortFeatures(["sunShelf", "integratedBench"]).join() === "sunShelf,integratedBench",
  "the bench exists only with the sun shelf: never alone, never with hydromassage",
);
const shelfLayout = configuredPoolLayout(
  config({ length: 8, width: 4, sloped: true, system: "skimmer", features: ["sunShelf"], variant: "open" }),
);
check(
  shelfLayout.comfort.elements[0]?.kind === "sunShelf" && !shelfLayout.comfort.elements[0]?.tiers,
  "sun shelf unchanged by the hydromassage variant",
);

// Persistence: variant survives save/load; unknown values restore as closed; absent stays absent.
const roundTrip = (c: PoolConfig) =>
  parseProjectConfiguration(
    serializeProjectConfiguration({ schemaVersion: 1, projectId: "p", config: c, renovation: {} as never }),
  ).config;
for (const variant of ["closed", "open"] as const) {
  const saved = config({
    length: 8,
    width: 4,
    sloped: false,
    system: "skimmer",
    features: ["hydromassage", "inoxLadder"],
    variant,
  });
  const restored = roundTrip(saved);
  check(restored.hydromassageVariant === variant, `${variant}: variant persists`);
  check(same(restored.features, ["hydromassage", "inoxLadder"]), `${variant}: hydro + inox persist`);
  check(
    same(hydroOf(configuredPoolLayout(restored)), hydroOf(configuredPoolLayout(saved))),
    `${variant}: restored geometry identical`,
  );
  const resized = roundTrip({ ...restored, dimensions: { ...restored.dimensions, length: 12, width: 5 } });
  check(resized.hydromassageVariant === variant, `${variant}: variant survives resize`);
}
const bogus = roundTrip({
  ...config({ length: 8, width: 4, sloped: false, system: "skimmer", features: ["hydromassage"] }),
  hydromassageVariant: "sideways" as never,
});
check(bogus.hydromassageVariant === "closed", "unknown variant restores as closed");
const legacy = roundTrip(
  config({ length: 8, width: 4, sloped: false, system: "skimmer", features: ["hydromassage"] }),
);
check(!("hydromassageVariant" in legacy), "projects without a variant stay unchanged");

for (let w = 2.5; w <= 6; w += 0.25)
  for (const length of [6, 8, 10, 12])
    for (const variant of ["closed", "open"] as const) {
      const l = configuredPoolLayout(
        config({ length, width: w, sloped: true, system: "skimmer", features: ["hydromassage"], variant }),
      );
      const h = hydroOf(l);
      check(
        h ? h.width >= H.minInteriorWidth - 1e-9 : !l.comfort.availability.hydromassage.available,
        `resize ${length}x${w} ${variant}`,
      );
    }
console.log(
  `Hydromassage audit PASS: ${checks} checks; ${built} sizes x 2 variants built, ${unavailable} unavailable.`,
);
