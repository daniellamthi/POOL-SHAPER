import assert from "node:assert/strict";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { buildOutline } from "../src/lib/pool/geometry";
import { resolveComfortPlan } from "../src/lib/pool/comfort-plan";
import { clampInfinityEdgeParams, infinityExclusion, infinityZonesForOutline } from "../src/lib/pool/infinity-edge";
import { DEFAULT_CONTROL_POINTS, DEFAULT_DIMENSIONS } from "../src/lib/pool/config";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import type { Dimensions, Outline } from "../src/lib/pool/types";

let checks = 0;
const check = (condition: unknown, message: string) => {
  assert(condition, message);
  checks++;
};

function setup(dimensions: Dimensions) {
  const outline = buildOutline("rectangle", dimensions, DEFAULT_CONTROL_POINTS);
  const layout = getPoolVerticalLayout({
    poolType: "in-ground",
    system: "infinity",
    overflowType: "hidden",
    depth: dimensions.depth,
    copingThickness: 0,
  });
  const floor = buildFloorProfile({
    outline,
    shape: "rectangle",
    poolType: "in-ground",
    dimensions,
    verticalLayout: layout,
  });
  return { outline, layout, floor };
}

function rectBounds(outline: Outline) {
  const xs = outline.map((p) => p[0]);
  const zs = outline.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

function overlap(a: Outline, b: Outline) {
  const x = rectBounds(a), y = rectBounds(b);
  return !(x.maxX <= y.minX || x.minX >= y.maxX || x.maxZ <= y.minZ || x.minZ >= y.maxZ);
}

const standard = setup({ ...DEFAULT_DIMENSIONS, length: 10, width: 4.5, depth: 1.5 });
const standardPlan = resolveComfortPlan({
  outline: standard.outline,
  shape: "rectangle",
  poolType: "in-ground",
  system: "skimmer",
  floorProfile: standard.floor,
  waterY: standard.layout.waterY,
  enabled: ["sunShelf", "integratedBench"],
});
check(standardPlan.elements.length === 2, "standard pool builds both comfort elements");
check(standardPlan.elements[0]?.waterDepth === 0.22, "sun shelf keeps 22 cm water");
check(standardPlan.elements[1]?.waterDepth === 0.48, "bench keeps 48 cm seat depth");
check(!overlap(standardPlan.elements[0]!.footprint, standardPlan.elements[1]!.footprint), "comfort footprints never overlap");
check(standardPlan.displacedVolume > 0 && standardPlan.displacedVolume < 20, "volume displacement is finite and plausible");

const slope = setup({
  ...DEFAULT_DIMENSIONS,
  length: 8,
  width: 3,
  depth: 1.5,
  floorProfile: "slope",
  shallowDepth: 1.05,
});
const slopePlan = resolveComfortPlan({
  outline: slope.outline,
  shape: "rectangle",
  poolType: "in-ground",
  system: "overflow",
  floorProfile: slope.floor,
  waterY: slope.layout.waterY,
  enabled: ["sunShelf", "integratedBench"],
});
check(slopePlan.elements.length === 2, "8x3 sloped pool remains compatible");
check(slopePlan.displacedVolume > 0, "sloped floor displacement remains positive");
check(
  slopePlan.elements.every((element) =>
    element.footprint.every(([x, z]) => element.topY > slope.floor.floorYAt(x, z) + 0.02),
  ),
  "closed solids remain above the local sloped floor",
);

for (const zone of infinityZonesForOutline(standard.outline, "rectangle")) {
  const plan = resolveComfortPlan({
    outline: standard.outline,
    shape: "rectangle",
    poolType: "in-ground",
    system: "infinity",
    floorProfile: standard.floor,
    waterY: standard.layout.waterY,
    enabled: ["sunShelf", "integratedBench"],
    infinityExcluded: infinityExclusion(
      standard.outline,
      clampInfinityEdgeParams({ side: zone.side }),
      "rectangle",
    ),
  });
  check(plan.elements.length === 2, `Infinity side ${zone.side + 1} keeps two valid elements`);
}

const unsupported = resolveComfortPlan({
  outline: standard.outline,
  shape: "rectangle",
  poolType: "above-ground",
  system: "skimmer",
  floorProfile: standard.floor,
  waterY: standard.layout.waterY,
  enabled: ["sunShelf", "integratedBench"],
});
check(unsupported.elements.length === 0, "above-ground is explicitly unavailable");

console.log(`Comfort geometry PASS: ${checks} parametric checks.`);
