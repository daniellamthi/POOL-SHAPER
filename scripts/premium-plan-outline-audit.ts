import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BufferGeometry, Float32BufferAttribute, Matrix4 } from "three";
import { architecturalEdges, architecturalLineWeight, mergeArchitecturalEdges, type PlanPoint } from "../src/components/pool/three/architecturalPlan";
import { createSurfaceGeometry, createRingGeometry } from "../src/components/pool/three/poolGeometry";
import { shelfStairGeometry } from "../src/components/pool/three/PoolComfortModel";
import { stairSolid } from "../src/components/pool/three/PoolAccessModel";
import { createInfinityContainmentGeometry } from "../src/components/pool/three/infinityContainment";
import { clampInfinityEdgeDimensions, infinityZonesForOutline } from "../src/lib/pool/infinity-edge";
import { buildOutline, offsetOutline } from "../src/lib/pool/geometry";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { visibleCameraFrame } from "../src/lib/pool/camera";
import { DEFAULT_CUSTOMER } from "../src/lib/pool/config";
import type { PoolConfig } from "../src/lib/pool/types";

let checks = 0;
const check = (condition: unknown, message: string) => { assert.ok(condition, message); checks++; };
const close = (a: number, b: number) => Math.abs(a - b) < 1e-5;

// Existing perspective consumers keep their area-based frame. Only the
// explicitly supplied plan aspect favours the matching pool proportions.
const hud = [
  { left: 0, top: 0, width: 1000, height: 80 },
  { left: 0, top: 600, width: 1000, height: 100 },
  { left: 800, top: 490, width: 200, height: 110 },
];
const canvas = { left: 0, top: 0, width: 1000, height: 700 };
const legacyFrame = visibleCameraFrame(canvas, hud);
const planFrame = visibleCameraFrame(canvas, hud, 2);
check(legacyFrame.width === 792 && legacyFrame.height === 520, "camera helper without aspect preserves the legacy free rectangle");
check(planFrame.width === 1000 && planFrame.height === 402, "plan aspect selects the wider region fitting the configured pool");
check(Math.min(planFrame.width / 2, planFrame.height) > Math.min(legacyFrame.width / 2, legacyFrame.height), "preferred frame measurably increases usable metric plan scale");

/** Three top-face patches share a large-to-small T junction. They are a single
 * continuous slab: its subdivision must never turn into a construction line. */
function joinedTopPatches() {
  const vertices: number[] = [];
  const quad = (x0: number, z0: number, x1: number, z1: number) => vertices.push(
    x0, 0, z0, x0, 0, z1, x1, 0, z1,
    x0, 0, z0, x1, 0, z1, x1, 0, z0,
  );
  quad(-1, -1, 0, 1);
  quad(0, -1, 1, 0);
  quad(0, 0, 1, 1);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  return geometry;
}

for (const matrix of [new Matrix4(), new Matrix4().makeTranslation(8, 2, 4)]) {
  const geometry = joinedTopPatches();
  const points = architecturalEdges(geometry, matrix);
  const x0 = matrix.elements[12]!, z0 = matrix.elements[14]!;
  check(points.length === 8, "coplanar T junction has four outer edges, no subdivision strokes");
  for (let i = 0; i < points.length; i += 2) {
    const a = points[i]!, b = points[i + 1]!;
    check(close(a[0], b[0]) || close(a[2], b[2]), "no triangle diagonals");
    check(close(Math.abs(a[0] - x0), 1) && close(Math.abs(b[0] - x0), 1)
      || close(Math.abs(a[2] - z0), 1) && close(Math.abs(b[2] - z0), 1), "only real perimeter");
    check(a.every(Number.isFinite) && b.every(Number.isFinite), "finite world-space contour");
  }
  geometry.dispose();
}

const segmentKey = (a: PlanPoint, b: PlanPoint) => [a, b]
  .map(point => `${Math.round(point[0] * 1e5)},${Math.round(point[2] * 1e5)}`).sort().join("|");
function uniqueProjection(points: PlanPoint[]) {
  const keys = new Set<string>();
  for (let i = 0; i < points.length; i += 2) {
    const a = points[i]!, b = points[i + 1]!;
    const key = segmentKey(a, b);
    check(!keys.has(key), "projected construction edge occurs once");
    check(a.every(Number.isFinite) && b.every(Number.isFinite), "finite outline points");
    check(Math.hypot(a[0] - b[0], a[2] - b[2]) > 1e-5, "no zero-length strokes");
    keys.add(key);
  }
}

// The same construction edge shared by two heights and two meshes is drawn
// once at the higher physical surface. Adjacent partial strokes remain whole.
const merged = mergeArchitecturalEdges([
  { weight: "secondary", points: [[0, -1, 0], [2, -1, 0]] },
  { weight: "primary", points: [[0, 0, 0], [1, 0, 0], [1, 0, 0], [2, 0, 0]] },
  { weight: "secondary", points: [[1, 0, 0], [0, 0, 0]] },
  { weight: "secondary", points: [[0, -0.3, 0.02], [2, -0.3, 0.02]] },
]);
check(merged.primary.length === 2, "contiguous primary boundary becomes one stroke");
check(merged.primary.every(point => close(point[1], 0)), "highest configured surface owns coincident edge");
check(merged.secondary.length === 2 && merged.secondary.every(point => close(point[2], 0.02)), "real parallel edges do not collapse");
uniqueProjection([...merged.primary, ...merged.secondary]);

check(architecturalLineWeight("plan-coping") === "primary", "primary external and inner coping contours");
check(architecturalLineWeight("infinity-glass-wall") === "primary", "real glass-panel top edges included");
check(architecturalLineWeight("pool-comfort-hydromassage") === "secondary", "bench boundaries have secondary hierarchy");
check(architecturalLineWeight("", "pool-access-internalSteps-corner") === "secondary", "individual radial treads included");
for (const name of ["overflow-grille", "infinity-crest-water", "pool-hydro-spot", "grass", "floor-reflection"])
  check(architecturalLineWeight(name) === null, `${name} excluded from technical strokes`);

// A whole radial flight has two real top edges at every shared riser in
// projection. Keep the higher one; drawing the lower edge against the next
// tread would let the depth test clip half its screen-space stroke.
for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
  const radii = [0.3, 0.6, 0.9, 1.2, 1.5, 1.8];
  const matrix = new Matrix4().makeRotationY(rotation).setPosition(2, 0, 3);
  const sets = radii.map((radius, i) => {
    const inner = radii[i - 1] ?? 0;
    const points: [number, number][] = [];
    for (let j = 0; j <= 48; j++) points.push([radius * Math.sin(j / 48 * Math.PI / 2), radius * Math.cos(j / 48 * Math.PI / 2)]);
    if (inner) for (let j = 48; j >= 0; j--) points.push([inner * Math.sin(j / 48 * Math.PI / 2), inner * Math.cos(j / 48 * Math.PI / 2)]);
    else points.push([0, 0]);
    const geometry = stairSolid(points, -(i + 1) * 0.2, { x: 0, z: 0, rotation: 0 }, { floorYAt: () => -1.5 } as never);
    const edges = architecturalEdges(geometry, matrix);
    geometry.dispose();
    return { points: edges, weight: "secondary" as const };
  });
  const points = mergeArchitecturalEdges(sets).secondary;
  for (const [i, radius] of radii.entries()) {
    let arcSegments = 0;
    for (let j = 0; j < points.length; j += 2) {
      const a = points[j]!, b = points[j + 1]!;
      if (Math.abs(Math.hypot(a[0] - 2, a[2] - 3) - radius) > 1e-5
        || Math.abs(Math.hypot(b[0] - 2, b[2] - 3) - radius) > 1e-5) continue;
      check(close(a[1], -(i + 1) * 0.2 + 0.006) && close(b[1], a[1]), `shared radial boundary ${rotation}/${radius}: expected ${-(i + 1) * 0.2 + 0.006}, got ${a[1]}/${b[1]} at ${a}/${b}`);
      arcSegments++;
    }
    check(arcSegments === 48, "each complete quarter-round riser is represented exactly once");
  }
}

const base: PoolConfig = { projectType: "new", poolType: "in-ground", structure: "reinforced-concrete",
  shape: "rectangle", shapeSelected: true, customMode: "draw", controlPoints: [],
  dimensions: { length: 8, width: 4, depth: 1.5, cornerRadius: 0 }, system: "skimmer", overflowType: "visible",
  skimmerFinish: "white", skimmerType: "standard", finish: "liner", linerColor: "motionSandBeach179",
  mosaicFinish: "mosaic-001", copingMaterial: "travertine", features: [], poolAccess: "internalSteps",
  internalStairType: "linear", equipment: [], customer: DEFAULT_CUSTOMER, uploads: [] };

for (const [length, width] of [[6, 3], [8, 4], [12, 5]]) {
  const config: PoolConfig = { ...base, dimensions: { ...base.dimensions, length: length!, width: width! } };
  const outline = buildOutline(config.shape, config.dimensions, []);
  const floor = createSurfaceGeometry(outline), coping = createRingGeometry(outline, offsetOutline(outline, 0.35));
  const perimeter = mergeArchitecturalEdges([
    { weight: "secondary", points: architecturalEdges(floor, new Matrix4().makeTranslation(0, -1.5, 0)) },
    { weight: "primary", points: architecturalEdges(coping, new Matrix4().makeTranslation(0, 0.04, 0)) },
  ]);
  check(perimeter.primary.length === 16 && !perimeter.secondary.length, "actual coping and basin boundaries share one projected outline");
  uniqueProjection(perimeter.primary);
  floor.dispose(); coping.dispose();

  for (const poolType of ["in-ground", "above-ground"] as const)
  for (const system of ["skimmer", "overflow", "infinity"] as const)
  for (const feature of ["sunShelf", "hydromassage"] as const) {
    if (poolType === "above-ground" && system === "infinity") continue;
    const state: PoolConfig = { ...config, poolType, system, features: [feature], hydromassageVariant: "closed",
      ...(system === "infinity" ? { infinityEdge: { enabled: true, side: 2, startT: 0, endT: 1, dropDirection: "outward", wallType: "glass" } } : {}) };
    const before = JSON.stringify(state);
    const layout = configuredPoolLayout(state);
    const sets = layout.comfort.elements.map(element => {
      const geometry = shelfStairGeometry(element, { floorYAt: () => poolType === "above-ground" ? 0 : -1.5 } as never);
      const points = architecturalEdges(geometry);
      geometry.dispose();
      check(points.length > 0, `${poolType} ${system} ${feature}: actual comfort boundaries`);
      return { points, weight: "secondary" as const };
    });
    const lines = mergeArchitecturalEdges(sets);
    uniqueProjection([...lines.primary, ...lines.secondary]);
    check(JSON.stringify(state) === before, "outline extraction preserves configuration and above-ground geometry");
  }

  // Use the real tread solid builder and a genuine annular sector. The top
  // contour follows its two radial boundaries and its circular arcs, never
  // the triangulation fan used to fill the sector.
  const points: [number, number][] = [];
  for (let j = 0; j <= 48; j++) points.push([1.2 * Math.sin(j / 48 * Math.PI / 2), 1.2 * Math.cos(j / 48 * Math.PI / 2)]);
  for (let j = 48; j >= 0; j--) points.push([0.9 * Math.sin(j / 48 * Math.PI / 2), 0.9 * Math.cos(j / 48 * Math.PI / 2)]);
  const tread = stairSolid(points, -0.3, { x: 0, z: 0, rotation: 0 }, { floorYAt: () => -1.5 } as never);
  const radial = architecturalEdges(tread);
  check(radial.length === 196, "annular tread has only its 98 real boundary segments");
  uniqueProjection(radial);
  tread.dispose();

  for (const wallType of ["traditional", "glass"] as const) {
    const zone = infinityZonesForOutline(outline, "rectangle")[2]!;
    const geometry = createInfinityContainmentGeometry(zone, clampInfinityEdgeDimensions(undefined), -0.02, 0.35, 0.04,
      outline, wallType === "glass" ? "glass" : "all");
    const points = architecturalEdges(geometry);
    check(points.length > 0, `real ${wallType} Infinity construction has top boundaries`);
    uniqueProjection(mergeArchitecturalEdges([{ points, weight: "primary" }]).primary);
    geometry.dispose();
  }
}

const scene = readFileSync("src/components/pool/three/PoolScene.tsx", "utf8");
check(scene.includes('focus === "top" && !photoMode'), "overlay stays scoped to existing top-view camera");
check(scene.includes("if (outlines) outlines.visible = false;"), "photorealistic capture omits outlines");
check(scene.includes("showBackdrop={!planView}"), "architectural plan hides only the visible sky backdrop");
const environment = readFileSync("src/components/pool/three/DaylightEnvironment.tsx", "utf8");
check(environment.includes("showBackdrop = true"), "existing perspective views retain their backdrop by default");
check(environment.indexOf("<Environment map={sky}") < environment.indexOf("{showBackdrop ?"),
  "reflection environment is retained independently from visible plan backdrop");
const overlay = readFileSync("src/components/pool/three/ArchitecturalOutline.tsx", "utf8");
check(overlay.includes("!heroCaptureState.pending"), "pending export cannot capture technical lines");
check(overlay.includes("alphaToCoverage") && overlay.includes("depthWrite={false}"), "antialiased lines do not write competing depth");

console.log(`PASS: ${checks} premium architectural outline checks`);
