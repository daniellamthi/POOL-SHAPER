import assert from "node:assert/strict";
import { DEFAULT_CONTROL_POINTS, DEFAULT_CUSTOMER, DEFAULT_DIMENSIONS } from "../src/lib/pool/config";
import { buildOutline, computeMetrics } from "../src/lib/pool/geometry";
import { planSkimmers } from "../src/lib/pool/engineering";
import { clampInfinityEdgeParams, computeInfinityEdgeGeometry } from "../src/lib/pool/infinity-edge";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { buildTechnicalPlan } from "../src/lib/pool/technical-plan";
import type { PoolConfig, PoolMetrics } from "../src/lib/pool/types";

const base: PoolConfig = {
  projectType: "new", poolType: "in-ground", structure: "reinforced-concrete",
  shape: "rectangle", customMode: "draw", controlPoints: DEFAULT_CONTROL_POINTS,
  dimensions: DEFAULT_DIMENSIONS, system: "skimmer", overflowType: "hidden",
  skimmerFinish: "white", skimmerType: "standard", finish: "liner",
  linerColor: "motionSandBeach179", mosaicFinish: "mosaic-001",
  features: [], poolAccess: "internalSteps", internalStairType: "linear",
  equipment: [], customer: DEFAULT_CUSTOMER, uploads: [],
};

function planFor(config: PoolConfig, metricsOverride?: PoolMetrics) {
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const metrics = metricsOverride ?? computeMetrics(outline, config.dimensions.depth);
  const skimmers = planSkimmers(outline, metrics.waterSurface, config.system === "skimmer");
  const layout = configuredPoolLayout(config);
  const input = { config, outline, metrics, skimmers, layout };
  const before = JSON.stringify(input);
  const plan = buildTechnicalPlan(input);
  assert.equal(JSON.stringify(input), before, "technical plan must not mutate its inputs");
  assert.deepEqual(plan, buildTechnicalPlan(input), "same resolved input must give same result");
  assert.equal(plan.waterVolume.value, metrics.waterVolume, "reuse provided comfort-aware volume");
  assert.equal(plan.internalSurface.value, metrics.internalSurface, "reuse provided inner surface");
  assert.equal(plan.finishArea.value, metrics.internalSurface, "finish proxy is labeled, not recalculated");
  assert.equal(plan.finishArea.provenance, "ESTIMATED");
  const ledsEnabled = config.features.includes("ledLighting");
  assert.equal(plan.leds.count.value, ledsEnabled ? layout.lighting.plan.positions.length : 0);
  assert.deepEqual(plan.leds.positions, ledsEnabled ? layout.lighting.plan.positions : []);
  assert.equal(plan.returns.positions.length, 0, "no fictitious hydraulic returns");
  assert.equal(plan.drains.positions.length, 0, "no fictitious suction drains");
  assert.equal(plan.returns.provenance, "NOT_AVAILABLE");
  assert.equal(plan.drains.provenance, "NOT_AVAILABLE");
  assert.equal(plan.compensation.volume.value, null, "tank volume needs engineering");
  return { plan, outline, metrics, skimmers };
}

let checks = 0;
for (const length of [6, 8, 10, 12]) {
  for (const feature of [null, "sunShelf", "hydromassage"] as const) {
    const config: PoolConfig = {
      ...base,
      dimensions: { ...base.dimensions, length },
      features: feature ? [feature] : [],
    };
    const { plan, skimmers } = planFor(config);
    assert.equal(plan.skimmers.count.value, skimmers.positions.length, "show placed, not target skimmers");
    assert.deepEqual(plan.skimmers.positions, skimmers.positions);
    assert.equal(plan.skimmers.count.provenance, "RULE_BASED");
    assert.equal(plan.overflow, null, "skimmer has no overflow assembly");
    assert.equal(plan.compensation.required, false);
    checks += 15;
  }
}

for (const overflowType of ["visible", "hidden"] as const) {
  const { plan, metrics } = planFor({ ...base, system: "overflow", overflowType });
  assert.equal(plan.overflow?.kind, overflowType === "visible" ? "VISIBLE_CHANNEL" : "HIDDEN_SLOT");
  assert.equal(plan.overflow?.collectionLength.value, metrics.perimeter);
  assert.equal(plan.skimmers.count.value, null, "overflow has no skimmer count");
  assert.equal(plan.skimmers.positions.length, 0);
  assert.equal(plan.compensation.required, true);
  checks += 5;
}

for (const side of [0, 1, 2, 3]) {
  const config: PoolConfig = {
    ...base, system: "infinity", infinityEdge: clampInfinityEdgeParams({ enabled: true, side }),
  };
  const { plan, outline } = planFor(config);
  const geometry = computeInfinityEdgeGeometry(outline, config.infinityEdge!, config.shape);
  assert(geometry);
  assert.equal(plan.overflow?.kind, "INFINITY_EDGE");
  assert.equal(plan.overflow?.selectedSide, side);
  assert.equal(plan.overflow?.collectionLength.value, geometry.length);
  assert.deepEqual(plan.overflow?.start, geometry.start);
  assert.deepEqual(plan.overflow?.end, geometry.end);
  assert.deepEqual(plan.overflow?.dropDirection, geometry.normal);
  const safe = plan.overflow?.preferredOppositeSide;
  assert(safe);
  const axis = safe.axis === "x" ? 0 : 1;
  assert(Math.abs(safe.coordinate - geometry.start[axis]) > 0.1,
    "safe access coordinate must differ from vanishing edge");
  assert.equal(plan.compensation.required, true);
  assert.equal(plan.compensation.volume.provenance, "NOT_AVAILABLE", "Infinity tank needs validation");
  checks += 10;
}

const override = { ...computeMetrics(buildOutline(base.shape, base.dimensions, base.controlPoints), 1.5), waterVolume: 19.75 };
assert.equal(planFor(base, override).plan.waterVolume.value, 19.75, "no second volume model");
checks++;
const lit = planFor({ ...base, features: ["ledLighting"] }).plan;
assert(lit.leds.count.value !== null && lit.leds.count.value > 0, "selected LEDs use resolved placements");
assert.equal(lit.leds.positions.length, lit.leds.count.value);
checks += 2;
console.log(`Technical plan audit PASS (${checks} checks)`);
