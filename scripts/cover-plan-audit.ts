import assert from "node:assert/strict";
import { DEFAULT_CONTROL_POINTS, DEFAULT_CUSTOMER, DEFAULT_DIMENSIONS } from "../src/lib/pool/config";
import { resolveAutomaticCover } from "../src/lib/pool/cover-plan";
import { buildOutline } from "../src/lib/pool/geometry";
import { planSkimmers } from "../src/lib/pool/engineering";
import type { PoolConfig } from "../src/lib/pool/types";

const base: PoolConfig = {
  projectType: "new", poolType: "in-ground", structure: "reinforced-concrete",
  shape: "rectangle", customMode: "draw", controlPoints: DEFAULT_CONTROL_POINTS,
  dimensions: DEFAULT_DIMENSIONS, system: "skimmer", overflowType: "hidden",
  skimmerFinish: "white", skimmerType: "standard", finish: "liner",
  linerColor: "motionSandBeach179", mosaicFinish: "mosaic-001",
  features: [], poolAccess: "internalSteps", internalStairType: "linear",
  equipment: ["automaticCover"], customer: DEFAULT_CUSTOMER, uploads: [],
};

let checks = 0;
for (const length of [6, 8, 10, 12]) for (const width of [3, 4.5, 6]) {
  for (const floorProfile of ["flat", "sloped"] as const) {
    for (const feature of [null, "sunShelf", "hydromassage"] as const) {
      for (const system of ["skimmer", "overflow"] as const) {
        const config: PoolConfig = { ...base, system,
          dimensions: { ...base.dimensions, length, width, floorProfile },
          features: feature ? [feature] : [],
        };
        const plan = resolveAutomaticCover(config);
        assert.notEqual(plan.status, "UNAVAILABLE", `expected fit for ${length}×${width} ${system} ${feature}`);
        assert.ok(plan.geometry, "valid selected cover needs geometry");
        assert.equal(plan.footprint.maxX - plan.footprint.minX, length);
        assert.equal(plan.footprint.maxZ - plan.footprint.minZ, width);
        assert.ok(plan.slatRun > 0);
        assert.ok(plan.housingY > plan.waterY);
        if (system === "skimmer") {
          const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
          const positions = planSkimmers(outline, length * width, true).positions;
          const wallX = plan.housingSide === "minX" ? plan.footprint.minX : plan.footprint.maxX;
          assert.ok(positions.every((point) => Math.abs(point.x - wallX) >= 0.36), "roller must not share a skimmer wall");
        }
        const closed = resolveAutomaticCover({ ...config, coverPosition: "closed" });
        assert.equal(closed.position, "closed");
        assert.deepEqual(closed.geometry, plan.geometry, "open/closed use the same basin footprint and roller");
        checks += 8;
      }
    }
  }
}
for (const config of [
  { ...base, system: "infinity" as const },
  { ...base, poolType: "above-ground" as const },
  { ...base, shape: "l-shape" as const },
  { ...base, features: ["inoxLadder"] as PoolConfig["features"] },
  { ...base, dimensions: { ...base.dimensions, length: 4 } },
  { ...base, dimensions: { ...base.dimensions, length: 6, width: 8 } },
]) {
  const plan = resolveAutomaticCover(config);
  assert.equal(plan.status, "UNAVAILABLE");
  assert.equal(plan.geometry, null);
  assert.ok(plan.reason);
  checks += 3;
}
const legacy = resolveAutomaticCover({ ...base, poolType: null, coverPosition: undefined });
assert.equal(legacy.position, "open");
assert.ok(legacy.geometry);
const none = resolveAutomaticCover({ ...base, equipment: [], coverPosition: "closed" });
assert.equal(none.enabled, false);
assert.equal(none.position, "open");
assert.equal(none.geometry, null);
checks += 5;
console.log(`Automatic cover compatibility audit: ${checks} checks passed.`);
