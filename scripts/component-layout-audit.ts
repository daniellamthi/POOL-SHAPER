import assert from "node:assert/strict";
import { resolvePoolLayout, comfortFootprints } from "../src/lib/pool/resolved-layout";
import { buildOutline, computeMetrics } from "../src/lib/pool/geometry";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { planSkimmers } from "../src/lib/pool/engineering";
import { DEFAULT_CONTROL_POINTS, DEFAULT_DIMENSIONS } from "../src/lib/pool/config";
import {
  clearsLightingExclusions,
  POOL_LUMINAIRE,
  POOL_LIGHTING_DESIGN,
} from "../src/lib/pool/lighting";
import { copingOuterOffset } from "../src/components/pool/three/poolConstruction";
import { skimmerServicePosition, SKIMMER_SERVICE_LID } from "../src/lib/pool/skimmer-service";
import { infinityExclusion, clampInfinityEdgeParams } from "../src/lib/pool/infinity-edge";
import type { Outline, PoolFeatureId } from "../src/lib/pool/types";

let checks = 0,
  adjusted = 0;
const check = (value: unknown, message: string) => {
  assert(value, message);
  checks++;
};
const overlap = (a: Outline, b: Outline) => {
  const bounds = (p: Outline) => [
    Math.min(...p.map((v) => v[0])),
    Math.max(...p.map((v) => v[0])),
    Math.min(...p.map((v) => v[1])),
    Math.max(...p.map((v) => v[1])),
  ];
  const x = bounds(a),
    y = bounds(b);
  return (
    x[1]! > y[0]! + 1e-7 && x[0]! < y[1]! - 1e-7 && x[3]! > y[2]! + 1e-7 && x[2]! < y[3]! - 1e-7
  );
};
for (const length of [6, 8, 10, 12])
  for (const width of [2, 2.4, 3, 4.5, 6, 12])
    for (const depth of [0.8, 1.5, 2.4])
      for (const system of ["skimmer", "overflow", "infinity"] as const)
        for (const overflowType of ["visible", "hidden"] as const)
          for (const slope of [false, true])
            for (const shelf of [false, true])
              for (const bench of [false, true])
                for (const stair of ["linear", "corner", "inox"] as const) {
                  const dimensions = {
                    ...DEFAULT_DIMENSIONS,
                    length,
                    width,
                    depth,
                    shallowDepth: Math.min(1.05, depth),
                    floorProfile: slope ? ("slope" as const) : ("flat" as const),
                  };
                  const outline = buildOutline("rectangle", dimensions, DEFAULT_CONTROL_POINTS);
                  const layout = getPoolVerticalLayout({
                    poolType: "in-ground",
                    system,
                    overflowType,
                    depth,
                    copingThickness: 0.035,
                  });
                  const edge = clampInfinityEdgeParams(outline, { side: 3 }, "rectangle");
                  const floorProfile = buildFloorProfile({
                    outline,
                    shape: "rectangle",
                    poolType: "in-ground",
                    dimensions,
                    verticalLayout: layout,
                    sunShelf: shelf,
                    infinityEdge: system === "infinity" ? edge : null,
                  });
                  const features: PoolFeatureId[] = [
                    ...(shelf ? ["sunShelf" as const] : []),
                    ...(bench ? ["integratedBench" as const] : []),
                  ];
                  const input = {
                    outline,
                    layout,
                    floorProfile,
                    shape: "rectangle" as const,
                    poolType: "in-ground" as const,
                    system,
                    overflowType,
                    features,
                    access:
                      stair === "inox"
                        ? ("stainlessSteelLadder" as const)
                        : ("internalSteps" as const),
                    stairType: stair === "corner" ? ("corner" as const) : ("linear" as const),
                    skimmers: planSkimmers(
                      outline,
                      computeMetrics(outline, 1.5).waterSurface,
                      system === "skimmer",
                    ),
                    infinityExcluded:
                      system === "infinity" ? infinityExclusion(outline, edge, "rectangle") : null,
                  };
                  const plan = resolvePoolLayout(input),
                    label = JSON.stringify({
                      length,
                      width,
                      depth,
                      system,
                      overflowType,
                      slope,
                      shelf,
                      bench,
                      stair,
                    });
                  check(
                    JSON.stringify(plan) === JSON.stringify(resolvePoolLayout(input)),
                    "determinism " + label,
                  );
                  if (plan.status === "AUTO_ADJUSTED") adjusted++;
                  const parts = comfortFootprints(plan.comfort);
                  parts.forEach((p, i) =>
                    parts
                      .slice(i + 1)
                      .forEach((q) => check(!overlap(p, q), "comfort collision " + label)),
                  );
                  if (plan.access.placement)
                    parts.forEach((p) =>
                      check(!overlap(p, plan.access.footprint), "access collision " + label),
                    );
                  else if (plan.effectiveAccess)
                    check(
                      plan.status === "UNAVAILABLE",
                      "missing access must be explicit " + label,
                    );
                  const sun = plan.comfort.elements.find((e) => e.kind === "sunShelf");
                  if (sun) {
                    check(!!sun.steps?.length, "shelf requires stairs " + label);
                    check(
                      (sun.riser ?? 0) >= 0.15 && (sun.riser ?? 1) <= 0.24,
                      "regular rise " + label,
                    );
                  }
                  if (sun && floorProfile.sloped)
                    check(!!floorProfile.shelfZone, "shelf has reserved landing " + label);
                  const exclusions = parts
                    .concat(plan.access.placement ? [plan.access.footprint] : [])
                    .map((polygon) => ({ kind: "access" as const, polygon, clearance: 0.2 }));
                  for (const light of plan.lighting.plan.positions) {
                    check(
                      clearsLightingExclusions(light.x, light.z, exclusions),
                      "LED collision " + label,
                    );
                    check(
                      light.y > floorProfile.floorYAt(light.x, light.z) + 0.2,
                      "LED floor clearance " + label,
                    );
                  }
                  check(
                    plan.lighting.plan.count ===
                      Math.min(
                        plan.lighting.plan.requestedCount,
                        POOL_LIGHTING_DESIGN.maxRenderedCount,
                      ),
                    "LED allocation fills existing rendering budget " + label,
                  );
                  if (plan.lighting.plan.requestedCount > POOL_LIGHTING_DESIGN.maxRenderedCount)
                    check(
                      plan.lighting.plan.warnings.length > 0,
                      "budget limit remains explicit " + label,
                    );
                  const off = resolvePoolLayout({ ...input, features: [] });
                  check(off.comfort.elements.length === 0, "toggle leaves no comfort " + label);
                  const lid = skimmerServicePosition(
                    copingOuterOffset(system, overflowType),
                    layout.groundY - 0.002,
                  );
                  check(
                    -lid.z - SKIMMER_SERVICE_LID.depth / 2 >
                      copingOuterOffset(system, overflowType),
                    "lid clears coping " + label,
                  );
                  check(Number.isFinite(lid.y), "lid deck elevation " + label);
                }
check(adjusted > 0, "auto-adjust exercised");
check(POOL_LUMINAIRE.diameter === 0.16, "fixed 160 mm body independent of output");
console.log(`Component layout PASS: ${checks} checks; ${adjusted} adjusted cases.`);
