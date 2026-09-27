import assert from "node:assert/strict";
import {
  ACCESS_DIMENSIONS,
  resolveAccessPlan,
  stairSolid,
  ladderWallContacts,
  ladderRailCurve,
} from "../src/components/pool/three/PoolAccessModel";
import { buildOutline } from "../src/lib/pool/geometry";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { DEFAULT_DIMENSIONS, DEFAULT_CONTROL_POINTS } from "../src/lib/pool/config";
import { planSkimmers } from "../src/lib/pool/engineering";
import {
  infinityExclusion,
  infinityZonesForOutline,
  clampInfinityEdgeParams,
} from "../src/lib/pool/infinity-edge";
import { accessMounting } from "../src/lib/pool/access-plan";
import type { Dimensions, PoolShapeId, Outline } from "../src/lib/pool/types";

// Internal design criteria, deliberately not a compliance/certification test.
function setup(
  length: number,
  width: number,
  depth: number,
  shape: PoolShapeId = "rectangle",
  extra: Partial<Dimensions> = {},
) {
  const dimensions = { ...DEFAULT_DIMENSIONS, length, width, depth, ...extra };
  const outline = buildOutline(shape, dimensions, DEFAULT_CONTROL_POINTS);
  const layout = getPoolVerticalLayout({
    poolType: "in-ground",
    system: "skimmer",
    depth,
    copingThickness: 0.06,
  });
  const floorProfile = buildFloorProfile({
    outline,
    shape,
    poolType: "in-ground",
    dimensions,
    verticalLayout: layout,
  });
  return { outline, floorProfile, topY: layout.copingY, layout };
}
let checks = 0;
for (const shape of ["rectangle", "l-shape", "custom", "organic"] as const) {
  for (const [length, width, depth] of [
    [6, 3, 0.8],
    [10, 4.5, 1.2],
    [15, 4.5, 1.5],
  ]) {
    const input = setup(length!, width!, depth!, shape);
    for (const stairType of ["linear", "corner"] as const) {
      const plan = resolveAccessPlan({
        ...input,
        access: "internalSteps",
        stairType,
        obstacles: planSkimmers(input.outline, length! * width!, true).positions,
      });
      assert.deepEqual(
        plan,
        resolveAccessPlan({
          ...input,
          access: "internalSteps",
          stairType,
          obstacles: planSkimmers(input.outline, length! * width!, true).positions,
        }),
        "deterministic position",
      );
      if (plan.reason) {
        assert.equal(plan.placement, null);
        continue;
      }
      assert.equal(plan.steps, plan.riseCount - 1);
      assert(plan.rise >= ACCESS_DIMENSIONS.minRise && plan.rise <= ACCESS_DIMENSIONS.maxRise);
      assert(
        Math.abs(input.topY - input.floorProfile.deepFloorY - plan.rise * plan.riseCount) < 1e-8,
      );
      if (stairType === "corner") {
        assert(plan.corner, "never silently substitute linear");
        plan.corner.radii
          .slice(1)
          .forEach((r, i) => assert(Math.abs(r - plan.corner!.radii[i]! - 0.3) < 1e-9));
      } else assert.equal(plan.tread, 0.3);
      checks++;
    }
    const ladder = resolveAccessPlan({ ...input, access: "stainlessSteelLadder" });
    assert(ladder.placement, "ladder fits supported pool sizes");
    for (const d of ladder.ladderDepths)
      assert(d <= input.topY - input.floorProfile.shallowFloorY - 0.18);
    assert(ladder.ladderDepths.length >= 2);
    checks++;
  }
}
for (const reversed of [false, true]) {
  const input = setup(10, 4.5, 1.5, "rectangle", {
    floorProfile: "slope",
    shallowDepth: 1.0,
    slopeReversed: reversed,
  });
  const plan = resolveAccessPlan({ ...input, access: "internalSteps" });
  assert(plan.placement && !plan.reason);
  for (const [x, z] of plan.footprint.slice(2))
    assert(
      Math.abs(input.topY - plan.rise * plan.riseCount - input.floorProfile.floorYAt(x, z)) < 1e-8,
      "final rise across full width",
    );
  const pos = plan.placement;
  for (let i = 0; i < plan.steps; i++) {
    const points: Outline = [
      [-plan.width / 2, i * 0.3],
      [plan.width / 2, i * 0.3],
      [plan.width / 2, (i + 1) * 0.3],
      [-plan.width / 2, (i + 1) * 0.3],
    ];
    const top = input.topY - (i + 1) * plan.rise;
    const mesh = stairSolid(points, top, pos, input.floorProfile);
    const vertices = mesh.getAttribute("position");
    for (let v = 0; v < vertices.count; v++) {
      const x = vertices.getX(v),
        z = vertices.getZ(v),
        y = vertices.getY(v);
      const floor = input.floorProfile.floorYAt(
        pos.x + Math.cos(pos.rotation) * x + Math.sin(pos.rotation) * z,
        pos.z - Math.sin(pos.rotation) * x + Math.cos(pos.rotation) * z,
      );
      assert(
        Math.abs(y - top) < 1e-6 || Math.abs(y - floor) < 1e-6,
        "every base vertex meets actual slope",
      );
    }
    mesh.dispose();
  }
  const curved = resolveAccessPlan({ ...input, access: "internalSteps", stairType: "corner" });
  assert(curved.reason.includes("inclinato") && !curved.placement, "no curved uneven final rise");
  checks++;
}
const short = resolveAccessPlan({ ...setup(6, 3, 1.2), access: "internalSteps" });
const long = resolveAccessPlan({ ...setup(15, 3, 1.2), access: "internalSteps" });
assert.equal(short.steps, long.steps, "length cannot determine number of risers");
const tight = setup(3, 2, 1.5);
assert(
  resolveAccessPlan({ ...tight, access: "internalSteps", stairType: "corner" }).reason,
  "3×2 deep basin must preserve a clear landing beyond the curved last tread",
);
tight.outline = [
  [-0.4, -0.4],
  [0.4, -0.4],
  [0.4, 0.4],
  [-0.4, 0.4],
];
for (const stairType of ["linear", "corner"] as const) {
  const plan = resolveAccessPlan({ ...tight, access: "internalSteps", stairType });
  assert(plan.reason && !plan.placement, "insufficient space must disable, never squeeze");
}
const basin = setup(10, 4.5, 1.5);
for (const zone of infinityZonesForOutline(basin.outline, "rectangle")) {
  const exclusion = infinityExclusion(
    basin.outline,
    clampInfinityEdgeParams({ side: zone.side }),
    "rectangle",
  );
  for (const access of ["internalSteps", "stainlessSteelLadder"] as const) {
    const plan = resolveAccessPlan({ ...basin, access, infinityExcluded: exclusion });
    assert(plan.placement && !plan.reason);
    checks++;
  }
}
const visible = accessMounting("overflow", "visible", basin.layout);
for (const shape of ["rectangle", "l-shape", "custom", "organic"] as const) {
  const input = setup(10, 4.5, 1.2, shape);
  const plan = resolveAccessPlan({ ...input, access: "stainlessSteelLadder" });
  assert(plan.placement);
  const p = plan.placement,
    c = Math.cos(p.rotation),
    s = Math.sin(p.rotation);
  for (const contact of ladderWallContacts(input.outline, p)) {
    assert(Number.isFinite(contact.z), "each ladder return must locate its real wall");
    const wx = p.x + c * contact.x + s * contact.z,
      wz = p.z - s * contact.x + c * contact.z;
    const distance = Math.min(
      ...input.outline.map((a, i) => {
        const b = input.outline[(i + 1) % input.outline.length]!;
        const dx = b[0] - a[0],
          dz = b[1] - a[1];
        const t = Math.max(
          0,
          Math.min(1, ((wx - a[0]) * dx + (wz - a[1]) * dz) / (dx * dx + dz * dz)),
        );
        return Math.hypot(wx - a[0] - t * dx, wz - a[1] - t * dz);
      }),
    );
    assert(distance < 1e-7, "pad contacts actual boundary, not bounding box");
    const depth = plan.ladderDepths.at(-1)!;
    const curve = ladderRailCurve(0.2, depth, contact.z);
    const tip = curve.getPoint(1);
    assert(Math.abs(tip.z - contact.z - ACCESS_DIMENSIONS.ladderFootPad) < 1e-7);
    for (const point of curve.getPoints(200)) {
      assert(Number.isFinite(point.y) && Number.isFinite(point.z));
      assert(
        point.y >= -depth - ACCESS_DIMENSIONS.ladderFootDrop - 1e-6,
        "lower bend never overshoots towards floor",
      );
    }
  }
}
const narrow = setup(6, 2.2, 1.8);
assert(
  resolveAccessPlan({ ...narrow, access: "internalSteps", stairType: "corner" }).reason,
  "exact outer arc must never protrude beyond a narrow basin",
);
assert(visible.ladderAnchorOffset > 0.4 && visible.ladderAnchorY === 0);
assert.equal(
  accessMounting("overflow", "visible", { ...basin.layout, wallTopY: 1.5 }).ladderDeckAvailable,
  false,
);
console.log(
  `Parametric stairs PASS: ${checks} valid plans; constant treads, full-width final rise, slope solids, deterministic positions, Infinity exclusion, overflow mounting, insufficient-space guard.`,
);
