import assert from "node:assert/strict";
import { buildOutline, computeMetrics } from "../src/lib/pool/geometry";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { planSkimmers } from "../src/lib/pool/engineering";
import { clampInfinityEdgeParams, infinityExclusion, infinityZonesForOutline } from "../src/lib/pool/infinity-edge";
import { clearOfInfinityEdge, INFINITY_ACCESS_CLEARANCE, oppositeInfinityCoordinate } from "../src/lib/pool/infinity-access";
import { comfortFootprints, resolvePoolLayout } from "../src/lib/pool/resolved-layout";
import { resolveAccessPlan } from "../src/components/pool/three/PoolAccessModel";
import { shelfStairGeometry } from "../src/components/pool/three/PoolComfortModel";
import { DEFAULT_CONTROL_POINTS, DEFAULT_DIMENSIONS } from "../src/lib/pool/config";
import type { Outline, PoolFeatureId, PoolShapeId } from "../src/lib/pool/types";

let checks = 0;
const check = (condition: unknown, message: string) => { assert(condition, message); checks++; };
const rectangleClear = (footprint: Outline, axis: "x" | "z", coordinate: number) =>
  footprint.every(point => Math.abs(point[axis === "x" ? 0 : 1] - coordinate) >= INFINITY_ACCESS_CLEARANCE - 1e-8);

function setup(length: number, width: number, side: number, features: PoolFeatureId[] = [], shape: PoolShapeId = "rectangle", sloped = false) {
  const dimensions = { ...DEFAULT_DIMENSIONS, length, width, depth: 1.5,
    shallowDepth: 1.05, floorProfile: sloped ? "slope" as const : "flat" as const };
  const outline = buildOutline(shape, dimensions, DEFAULT_CONTROL_POINTS);
  const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "infinity", depth: 1.5, copingThickness: 0.06 });
  const infinityExcluded = infinityExclusion(outline, clampInfinityEdgeParams({ side, enabled: true }), shape);
  check(!!infinityExcluded, `side ${side}: exclusion exists`);
  return {
    outline, layout, infinityExcluded,
    floorProfile: buildFloorProfile({ outline, shape, poolType: "in-ground", dimensions,
      verticalLayout: layout, sunShelf: features.includes("sunShelf") || features.includes("hydromassage"),
      infinityEdge: clampInfinityEdgeParams({ side, enabled: true }) }),
    shape,
    poolType: "in-ground" as const,
    system: "infinity" as const,
    overflowType: "hidden" as const,
    skimmers: planSkimmers(outline, computeMetrics(outline, 1.5).waterSurface, false),
    features,
  };
}

for (const shape of ["l-shape", "custom", "organic"] as const) {
  const outline = buildOutline(shape, { ...DEFAULT_DIMENSIONS, length: 10, width: 4.5, depth: 1.5 }, DEFAULT_CONTROL_POINTS);
  for (const zone of infinityZonesForOutline(outline, shape)) {
    for (const [access, stairType] of [
      ["internalSteps", "linear"], ["internalSteps", "corner"], ["stainlessSteelLadder", "linear"],
    ] as const) {
      const input = setup(10, 4.5, zone.side, [], shape);
      const resolved = resolvePoolLayout({ ...input, access, stairType });
      const plan = resolved.access;
      check(plan.placement ? clearOfInfinityEdge(input.outline, input.infinityExcluded, plan.footprint)
        : !!plan.reason && resolved.status === "UNAVAILABLE",
      `${shape} side ${zone.side}: ${access}/${stairType} clear or unavailable`);
    }
  }
}

const zones = infinityZonesForOutline(setup(10, 4.5, 0).outline, "rectangle");
for (const zone of zones) {
  for (const [access, stairType] of [
    ["internalSteps", "linear"], ["internalSteps", "corner"], ["stainlessSteelLadder", "linear"],
  ] as const) {
    const input = setup(10, 4.5, zone.side);
    const resolved = resolvePoolLayout({ ...input, access, stairType });
    const plan = resolved.access;
    check(!!plan.placement && !plan.reason, `side ${zone.side}: ${access}/${stairType} available`);
    check(clearOfInfinityEdge(input.outline, input.infinityExcluded, plan.footprint) &&
      rectangleClear(plan.footprint, input.infinityExcluded!.axis, input.infinityExcluded!.coordinate),
      `side ${zone.side}: ${access}/${stairType} whole footprint clear`);
    const axis = input.infinityExcluded!.axis === "x" ? 0 : 1;
    const opposite = oppositeInfinityCoordinate(input.outline, input.infinityExcluded!);
    check(plan.footprint.some(point => Math.abs(point[axis] - opposite) < 0.03),
      `side ${zone.side}: ${access}/${stairType} mounts opposite Infinity`);
  }

  for (const feature of ["sunShelf", "hydromassage"] as const) {
    const input = setup(10, 4.5, zone.side, [feature]);
    const resolved = resolvePoolLayout({ ...input, access: "internalSteps", stairType: "linear" });
    const element = resolved.comfort.elements.find(item => item.kind === feature);
    check(!!element && resolved.comfort.availability[feature].available,
      `side ${zone.side}: ${feature} with integrated steps available`);
    for (const footprint of comfortFootprints(resolved.comfort))
      check(clearOfInfinityEdge(input.outline, input.infinityExcluded, footprint) &&
        rectangleClear(footprint, input.infinityExcluded!.axis, input.infinityExcluded!.coordinate),
        `side ${zone.side}: ${feature} complete assembly clear`);
    if (input.infinityExcluded!.axis === "x") {
      const opposite = oppositeInfinityCoordinate(input.outline, input.infinityExcluded!);
      check(element!.landing!.footprint.some(point => Math.abs(point[0] - opposite) < 0.05),
        `side ${zone.side}: ${feature} enters from opposite head wall`);
    }
    const withLadder = setup(10, 4.5, zone.side, [feature, "inoxLadder"]);
    const addon = resolvePoolLayout({ ...withLadder, access: "internalSteps", stairType: "linear" }).ladder;
    check(!!addon, `side ${zone.side}: ${feature} optional inox resolves`);
    check(!addon?.plan.placement || (clearOfInfinityEdge(withLadder.outline, withLadder.infinityExcluded, addon.plan.footprint) &&
      rectangleClear(addon.plan.footprint, withLadder.infinityExcluded!.axis, withLadder.infinityExcluded!.coordinate)),
      `side ${zone.side}: ${feature} optional inox stays clear`);

    const sloped = setup(10, 4.5, zone.side, [feature], "rectangle", true);
    const slopedPlan = resolvePoolLayout({ ...sloped, access: "internalSteps", stairType: "linear" });
    const slopedElement = slopedPlan.comfort.elements.find(item => item.kind === feature);
    check(!!slopedElement && !!sloped.floorProfile.shelfZone,
      `side ${zone.side}: ${feature} retains stepped landing on slope`);
    for (const footprint of comfortFootprints(slopedPlan.comfort))
      check(clearOfInfinityEdge(sloped.outline, sloped.infinityExcluded, footprint) &&
        rectangleClear(footprint, sloped.infinityExcluded!.axis, sloped.infinityExcluded!.coordinate),
        `side ${zone.side}: sloped ${feature} assembly clear`);
    if (slopedElement) {
      const geometry = shelfStairGeometry(slopedElement, sloped.floorProfile);
      check(geometry.getAttribute("position").count > 0 &&
        Array.from(geometry.getAttribute("position").array).every(Number.isFinite),
      `side ${zone.side}: sloped ${feature} mesh remains finite`);
      geometry.dispose();
    }
  }
}

for (const feature of ["sunShelf", "hydromassage"] as const) {
  const input = setup(8, 2.4, 0, [feature]);
  const resolved = resolvePoolLayout({ ...input, access: "internalSteps", stairType: "linear" });
  check(resolved.status === "UNAVAILABLE" && !resolved.comfort.availability[feature].available &&
    !resolved.comfort.elements.some(item => item.kind === feature),
    `${feature}: narrow lateral fallback is unavailable`);
}

const fallback = setup(10, 4.5, 0);
const opposite = oppositeInfinityCoordinate(fallback.outline, fallback.infinityExcluded!);
const lateral = resolveAccessPlan({ ...fallback, access: "internalSteps", stairType: "linear",
  topY: fallback.layout.copingY,
  reservedFootprints: [[[ -5, opposite - 0.5 ], [5, opposite - 0.5], [5, opposite + 0.5], [-5, opposite + 0.5]]] });
check(!!lateral.placement && clearOfInfinityEdge(fallback.outline, fallback.infinityExcluded, lateral.footprint),
  "blocked opposite wall permits a clear lateral fallback");
check(!lateral.footprint.some(point => Math.abs(point[1] - opposite) < 0.03),
  "lateral fallback is used only after opposite is blocked");
const impossible = resolveAccessPlan({ ...fallback, access: "internalSteps", stairType: "linear",
  topY: fallback.layout.copingY, reservedFootprints: [[[-10, -10], [10, -10], [10, 10], [-10, 10]]] });
check(!impossible.placement && !!impossible.reason, "no safe access remains explicitly unavailable");

const edge: Outline = [[0, 0], [10, 0], [10, 4.5], [0, 4.5]];
check(!clearOfInfinityEdge(edge, { axis: "z", coordinate: 0, edgeIndices: [0] },
  [[3, 0.3], [4, 0.3], [4, 1], [3, 1]]), "clearance rejects an assembly near the lip");
console.log(`Infinity access safety audit: ${checks} checks passed.`);
