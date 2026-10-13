import assert from "node:assert/strict";
import {
  resolveAccessPlan, rectangularCornerTread, stairBackfillOutline, stairSolid,
} from "../src/components/pool/three/PoolAccessModel";
import { buildOutline, computeMetrics, outlineBounds } from "../src/lib/pool/geometry";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { DEFAULT_CONTROL_POINTS, DEFAULT_DIMENSIONS } from "../src/lib/pool/config";
import { L_SHAPE_ORIENTATIONS } from "../src/lib/pool/l-shape";
import { planSkimmers } from "../src/lib/pool/engineering";
import { resolvePoolLayout } from "../src/lib/pool/resolved-layout";
import type { Dimensions, Outline, PoolShapeId, PoolType } from "../src/lib/pool/types";

// PoolAccessModel seats corner solids 14 mm into each adjoining wall.
// Their shared corner is therefore sqrt(2) * 14 mm outside the wet polygon.
// This audit explicitly counts that embedding; it does not claim zero exterior vertices.
const WALL_EMBED = 0.014;
const EPSILON = 1e-6;
let cases = 0, unavailableMirrors = 0, vertices = 0, triangles = 0, embeddedSamples = 0, maxEmbed = 0;

function boundaryDistance(outline: Outline, x: number, z: number) {
  return Math.min(...outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
  }));
}

function inside(outline: Outline, x: number, z: number) {
  let hit = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!, b = outline[j]!;
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

function setup(length: number, width: number, shape: PoolShapeId, poolType: PoolType = "in-ground", extra: Partial<Dimensions> = {}) {
  const dimensions = { ...DEFAULT_DIMENSIONS, length, width, ...extra };
  const outline = buildOutline(shape, dimensions, DEFAULT_CONTROL_POINTS);
  const layout = getPoolVerticalLayout({ poolType, system: "skimmer", depth: dimensions.depth, copingThickness: 0.06 });
  const floorProfile = buildFloorProfile({ outline, shape, poolType, dimensions, verticalLayout: layout });
  return {
    outline, floorProfile, layout, shape, poolType,
    system: "skimmer" as const, overflowType: "hidden" as const,
    features: [], access: "internalSteps" as const,
    skimmers: planSkimmers(outline, computeMetrics(outline, dimensions.depth).waterSurface, true),
  };
}

function audit(input: ReturnType<typeof setup>, plan: ReturnType<typeof resolveAccessPlan>, label: string) {
  assert(plan.placement && !plan.reason, `${label}: expected available stairs: ${plan.reason}`);
  const placement = plan.placement;
  const c = Math.cos(placement.rotation), s = Math.sin(placement.rotation);
  const tolerance = plan.corner ? Math.SQRT2 * WALL_EMBED + EPSILON : EPSILON;
  const check = (x: number, z: number, kind: string) => {
    const worldX = placement.x + c * x + s * z;
    const worldZ = placement.z - s * x + c * z;
    if (inside(input.outline, worldX, worldZ)) return;
    const distance = boundaryDistance(input.outline, worldX, worldZ);
    assert(distance <= tolerance, `${label}: ${kind} outside true basin by ${distance} m at ${worldX},${worldZ}`);
    if (distance > EPSILON) { embeddedSamples++; maxEmbed = Math.max(maxEmbed, distance); }
  };
  const patches: { points: Outline; topY: number }[] = [];
  for (let i = 0; i < plan.steps; i++) {
    let points: Outline;
    if (plan.corner) {
      const radius = plan.corner.radii[i]!, inner = i ? plan.corner.radii[i - 1]! : 0;
      if (plan.corner.rectangular) points = rectangularCornerTread(inner, radius);
      else {
        // Same local quarter-sector vertices as PoolAccessModel's rendered geometry.
        const sector: [number, number][] = [];
        for (let j = 0; j <= 48; j++) {
          const angle = j * Math.PI / 96;
          sector.push([radius * Math.sin(angle), radius * Math.cos(angle)]);
        }
        if (inner) for (let j = 48; j >= 0; j--) {
          const angle = j * Math.PI / 96;
          sector.push([inner * Math.sin(angle), inner * Math.cos(angle)]);
        }
        else sector.push([0, 0]);
        points = sector;
      }
    } else points = [
      [-plan.width / 2, i * plan.tread], [plan.width / 2, i * plan.tread],
      [plan.width / 2, (i + 1) * plan.tread], [-plan.width / 2, (i + 1) * plan.tread],
    ];
    patches.push({ points, topY: input.layout.copingY - (i + 1) * plan.rise });
  }
  if (!plan.corner) {
    const points = stairBackfillOutline(input.outline, placement, plan.width);
    if (points.length >= 3) patches.push({ points, topY: input.layout.copingY - plan.rise });
  }
  for (const patch of patches) {
    const geometry = stairSolid(patch.points, patch.topY, placement, input.floorProfile);
    try {
      const position = geometry.getAttribute("position"), index = geometry.getIndex();
      for (let i = 0; i < position.count; i++) { check(position.getX(i), position.getZ(i), "vertex"); vertices++; }
      const count = index?.count ?? position.count;
      for (let i = 0; i < count; i += 3) {
        const ids = [0, 1, 2].map(offset => index ? index.getX(i + offset) : i + offset);
        check(ids.reduce((sum, id) => sum + position.getX(id), 0) / 3,
          ids.reduce((sum, id) => sum + position.getZ(id), 0) / 3, "triangle centroid");
        triangles++;
      }
    } finally { geometry.dispose(); }
  }
  cases++;
}

for (const [length, width] of [[6, 3], [8, 4], [12, 5]] as const) {
  // Actual four-option UI: Angolare POOL SHAPE, ordered SW/SE/NE/NW.
  for (const orientation of L_SHAPE_ORIENTATIONS) {
    const input = setup(length, width, "l-shape", "in-ground", { lShapeOrientation: orientation });
    if (width === 3) assert.equal(outlineBounds(input.outline).spanZ, 4, "existing L width clamp: 6x3 becomes 6x4");
    for (const stairType of ["linear", "corner"] as const) {
      const normal = resolvePoolLayout({ ...input, stairType }).access;
      assert.deepEqual(resolvePoolLayout({ ...input, stairType, stairMirrored: true }).access, normal,
        "in-ground UI has no mirror selector; stored mirror is intentionally ignored");
      audit(input, normal, `UI L ${length}x${width} ${orientation} ${stairType}`);
    }
  }
  // Actual rectangular UI: in-ground automatic anchor, above-ground Standard/Speculare.
  for (const poolType of ["in-ground", "above-ground"] as const) {
    const input = setup(length, width, "rectangle", poolType);
    for (const stairType of ["linear", "corner"] as const) for (const stairMirrored of [false, true]) {
      const resolved = resolvePoolLayout({ ...input, stairType, stairMirrored });
      if (poolType === "above-ground" && stairMirrored && !resolved.access.placement) {
        // StepTrays filters unavailable mirror options; no mesh is rendered.
        assert(resolved.access.reason && resolved.status === "UNAVAILABLE");
        assert.equal(resolved.access.corner, null);
        unavailableMirrors++;
        continue;
      }
      audit(input, resolved.access, `UI rectangle ${length}x${width} ${poolType} ${stairType} mirror=${stairMirrored}`);
    }
  }
  // Stress all four corner anchors; these are solver inputs, NOT four in-ground UI buttons.
  const input = setup(length, width, "rectangle");
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (const rectangularCorner of [false, true]) {
    const plan = resolveAccessPlan({ ...input, topY: input.layout.copingY, stairType: "corner", rectangularCorner,
      mirrorAnchor: { x: sx! * length / 2, z: sz! * width / 2 } });
    audit(input, plan, `forced rectangle ${length}x${width} corner=${sx},${sz} rectilinear=${rectangularCorner}`);
  }
}

// Ensure the oracle detects a point in an L recess despite being inside its bounding box.
const concave = setup(8, 4, "l-shape", "in-ground", { lShapeOrientation: "ne" }).outline;
assert(!inside(concave, 3.5, 1.5));
assert(boundaryDistance(concave, 3.5, 1.5) > Math.SQRT2 * WALL_EMBED);
assert(embeddedSamples > 0 && maxEmbed > WALL_EMBED, "intentional wall embedding must be observed explicitly");
console.log(`Stair containment PASS: ${cases} available cases, ${unavailableMirrors} explicitly unavailable mirrors, ${vertices} transformed vertices, ${triangles} triangle centroids; ${embeddedSamples} intentional wall-embedded samples, max ${(maxEmbed * 1000).toFixed(3)} mm (14 mm per wall).`);
