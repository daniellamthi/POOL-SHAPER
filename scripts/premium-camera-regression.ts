/** Offline geometry/state regression. Browser visibility/animation remain separate QA gates. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { TOP_L_RIG, TOP_L_FRUSTUM, TOP_L_EDGES_SHA256 } from "./fixtures/premium-camera-top-l";
import { H_ACCESS_SUBJECT_SOURCE } from "./fixtures/premium-camera-access-h";
import { PAVING_M_RIG } from "./fixtures/premium-camera-paving-m";
import { OVERVIEW_O_RIG, OVERVIEW_O_FIT } from "./fixtures/premium-camera-overview-o";
import { WATERLINE_Q_RIG, WATERLINE_Q_HYDRAULIC } from "./fixtures/premium-camera-waterline-q";
import { INTERIOR_V } from "./fixtures/premium-camera-interior-v";
import { INFINITY_Y } from "./fixtures/premium-camera-infinity-y";
import ts from "typescript";
import { DoubleSide, Group, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, Raycaster, TubeGeometry, Vector3 } from "three";
import { architecturalFrustum } from "../src/components/pool/three/architecturalPlan";
import { cameraFrameFit, componentCameraAspect, contextualAccessCamera, fitComponentCamera, getCameraPose, infinityNavigationLimits, offsetCameraToFrame, sunShelfCameraSubject, visibleCameraFrame, type CameraPoint, type CameraPose } from "../src/lib/pool/camera";
import * as cameraRuntime from "../src/lib/pool/camera";
import { buildOutline, offsetOutline, outlineArea, outlineBounds } from "../src/lib/pool/geometry";
import { concealedOverflowSection, copingOuterOffset, createCopingSlabGeometry, SKIMMER_PROFILES, squareInfinityCopingEnds } from "../src/components/pool/three/poolConstruction";
import { buildOrganicShapeOutline, clampOrganicShapeParams } from "../src/lib/pool/organic-shape";
import { buildLShapeOutline, clampLShapeDimensions, classifyOutlineCorners, L_SHAPE_ORIENTATIONS } from "../src/lib/pool/l-shape";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { ACCESS_DIMENSIONS, ladderRailCurve, ladderWallContacts, rectangularCornerTread, resolveAccessPlan, stairSolid } from "../src/components/pool/three/PoolAccessModel";
import { clampInfinityEdgeDimensions, infinityZonesForOutline, type RectangleInfinityZone } from "../src/lib/pool/infinity-edge";
import { ABOVE_GROUND_STRUCTURE_THICKNESS, getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { claddingFaceOffset } from "../src/lib/pool/above-ground";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { HYDRO_DIMENSIONS, type ComfortElementPlan } from "../src/lib/pool/comfort-plan";
import { shelfStairGeometry } from "../src/components/pool/three/PoolComfortModel";
import { configuredSunShelfLoungers, SUN_SHELF_LOUNGER_MODEL } from "../src/lib/pool/sun-shelf-loungers";
import { DEFAULT_CUSTOMER, OVERFLOW_GEOMETRY, STEPS } from "../src/lib/pool/config";
import { POOL_BORDER_PRESET } from "../src/configurator/materials/visual-presets";
import { SCENE_VISUAL_PRESET } from "../src/configurator/3d/scene/visual-preset";
import { planSkimmers } from "../src/lib/pool/engineering";
import { POOL_LUMINAIRE } from "../src/lib/pool/lighting";
import { projectLinkIsDirty } from "../src/lib/project-delivery/client";
import { reducer } from "../src/lib/pool/store";
import { planExternalStaircase } from "../src/components/pool/three/externalStaircasePlan";
import { createExternalStairEnclosureGeometry } from "../src/components/pool/three/ExternalStaircase";
import { resolveAutomaticCover } from "../src/lib/pool/cover-plan";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import { contextualIntent, focusForAction, nextFocusRequest, wholePoolIntent } from "../src/lib/pool/contextual-camera";
import { parseProjectConfiguration, serializeProjectConfiguration, toProjectConfiguration } from "../src/lib/pool/project";
import type { PoolConfig } from "../src/lib/pool/types";

const base: PoolConfig = {
  projectType: "new", poolType: "in-ground", structure: "reinforced-concrete", shape: "rectangle", shapeSelected: true,
  customMode: "draw", controlPoints: [], dimensions: { length: 8, width: 4, depth: 1.5, cornerRadius: 0 },
  system: "skimmer", overflowType: "hidden", skimmerFinish: "white", skimmerType: "standard", finish: "liner",
  linerColor: "motionSandBeach179", mosaicFinish: DEFAULT_MOSAIC_FINISH_ID, copingMaterial: "travertine",
  features: [], poolAccess: "internalSteps", internalStairType: "linear", equipment: [], customer: DEFAULT_CUSTOMER, uploads: [],
};
const sizes = [[6, 3], [8, 4], [12, 5]] as const;
const shelfSizes = [...sizes, [10, 4.5] as const];
const viewports = [[1440, 900], [390, 844], [430, 932]] as const;
const emptySkimmers = { positions: [], count: 0 } as never;
let checks = 0;
const cases = { infinity: 0, infinityLocal: 0, shelf: 0, shelfAccess: 0, stairs: 0, externalStairs: 0, cover: 0, top: 0, paving: 0, overview: 0, waterline: 0, ladder: 0, hydro: 0, integratedAccess: 0, state: 0, routing: 0, lighting: 0, motion: 0, coping: 0, overflow: 0, interiorFinish: 0, materialEntry: 0 };
const shelfFrameMeasurements: unknown[] = [];
const section = process.argv[2] ?? "all";
assert(["all", "infinity", "infinity-local", "shelf", "shelf-access", "stairs", "external-fog", "external-stairs", "external-lifecycle", "top", "paving", "overview", "waterline", "projection-exit", "cover", "cover-state", "cover-diagnostic", "corner-captured", "micro-captured", "lighting-entry", "interior-finish", "material-entry", "integrated-access", "ladder", "hydro", "state", "routing", "lighting", "lighting-main", "lighting-micro", "motion", "coping", "overflow", "diagnostic", "shape-clearance"].includes(section), `Unknown regression section: ${section}`);
const enabled = (name: string) => section === "all" || section === name;
function ok(value: unknown, message: string) { assert.ok(value, message); checks++; }
function equal(actual: unknown, expected: unknown, message: string) { assert.deepEqual(actual, expected, message); checks++; }
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
function pitch(pose: CameraPose) {
  return Math.atan2(pose.position[1] - pose.target[1], Math.hypot(pose.position[0] - pose.target[0], pose.position[2] - pose.target[2])) * 180 / Math.PI;
}
function frameFor(width: number, height: number, preferredAspect?: number) {
  const captured = capturedMobileUI[width];
  if (captured?.canvas.height === height) return visibleCameraFrame(captured.canvas, captured.overlays, preferredAspect);
  // Deterministic desktop UI envelope; captured mobile rectangles are above.
  return visibleCameraFrame({ left: 0, top: 0, width, height }, [
    { left: 0, top: 0, width, height: 80 },
    { left: 0, top: height - (width < 500 ? 430 : 285), width, height: width < 500 ? 430 : 285 },
    { left: width - 180, top: 88, width: 168, height: 36 },
  ], preferredAspect);
}
type Rect = { left: number; top: number; width: number; height: number };
// Captured by the independent reviewer in the real IAB on 2026-10-15.
// Header/menu/construction badge/full mobile tools/dock are versioned here so
// CI does not depend on ignored screenshot artifacts. No technical panel was
// active in this captured selection; these are viewport emulations, not phones.
const capturedMobileUI: Record<number, { canvas: Rect; overlays: Rect[] }> = {
  390: { canvas: { left: 0, top: 0, width: 390, height: 844 }, overlays: [
    { left: 8, top: 8, width: 374, height: 119 },
    { left: 12, top: 143, width: 131.9140625, height: 36 },
    { left: 209.3515625, top: 143, width: 168.6484375, height: 35.046875 },
    { left: 180.921875, top: 293.515625, width: 193.078125, height: 40 },
    { left: 289, top: 297.515625, width: 32, height: 32 },
    { left: 334, top: 293.515625, width: 40, height: 40 },
    { left: 8, top: 365.515625, width: 374, height: 470.484375 },
  ] },
  430: { canvas: { left: 0, top: 0, width: 430, height: 932 }, overlays: [
    { left: 8, top: 8, width: 414, height: 119 },
    { left: 12, top: 143, width: 131.9140625, height: 36 },
    { left: 249.3515625, top: 143, width: 168.6484375, height: 35.046875 },
    { left: 220.921875, top: 346.3125, width: 193.078125, height: 40 },
    { left: 329, top: 350.3125, width: 32, height: 32 },
    { left: 374, top: 346.3125, width: 40, height: 40 },
    { left: 8, top: 418.3125, width: 414, height: 505.6875 },
  ] },
};
function optimalFreeFrame(canvas: Rect, occluders: readonly Rect[], aspect: number) {
  // Independent finite search over every rectangle bounded by a canvas/UI
  // edge. This oracle does not reuse production's rectangle-subtraction logic.
  const blocked = occluders.map(rect => {
    const padding = rect.width >= canvas.width * .55 ? 0 : 8;
    return { left: Math.max(0, rect.left - canvas.left - padding), right: Math.min(canvas.width, rect.left + rect.width - canvas.left + padding),
      top: Math.max(0, rect.top - canvas.top - padding), bottom: Math.min(canvas.height, rect.top + rect.height - canvas.top + padding) };
  }).filter(rect => rect.right > rect.left && rect.bottom > rect.top);
  const xs = [...new Set([0, canvas.width, ...blocked.flatMap(rect => [rect.left, rect.right])])].sort((a, b) => a - b);
  const ys = [...new Set([0, canvas.height, ...blocked.flatMap(rect => [rect.top, rect.bottom])])].sort((a, b) => a - b);
  let score = 0;
  for (let x0 = 0; x0 < xs.length; x0++) for (let x1 = x0 + 1; x1 < xs.length; x1++) {
    for (let y0 = 0; y0 < ys.length; y0++) for (let y1 = y0 + 1; y1 < ys.length; y1++) {
      const left = xs[x0]!, right = xs[x1]!, top = ys[y0]!, bottom = ys[y1]!;
      if (blocked.some(rect => rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top)) continue;
      score = Math.max(score, Math.min((right - left) / aspect, bottom - top));
    }
  }
  return score;
}
function projectedSpan(points: readonly CameraPoint[], direction: CameraPoint) {
  const eye = new Vector3(...direction).normalize(), right = new Vector3(0, 1, 0).cross(eye).normalize(), up = eye.clone().cross(right);
  const x = points.map(point => new Vector3(...point).dot(right)), y = points.map(point => new Vector3(...point).dot(up));
  return (Math.max(...x) - Math.min(...x)) / (Math.max(...y) - Math.min(...y));
}
function projectedPixelBounds(pose: CameraPose, points: readonly CameraPoint[], width: number, height: number, frame: Rect) {
  const camera = new PerspectiveCamera(34, width / height, .05, 1000);
  camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld();
  camera.setViewOffset(width, height, width / 2 - frame.left - frame.width / 2, height / 2 - frame.top - frame.height / 2, width, height);
  const projected = points.map(point => new Vector3(...point).project(camera));
  const xs = projected.map(point => (point.x + 1) * width / 2), ys = projected.map(point => (1 - point.y) * height / 2);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys), width: w, height: h, area: w * h, viewportAreaRatio: w * h / width / height };
}
function projectInside(pose: CameraPose, points: readonly CameraPoint[], width: number, height: number, label: string,
  frame = frameFor(width, height), opticalOffset = true, localProjection = false) {
  const shifted = opticalOffset ? pose : offsetCameraToFrame(pose, 34, width, height, frame);
  const camera = new PerspectiveCamera(34, width / height, .05, 1000);
  camera.position.set(...shifted.position); camera.lookAt(new Vector3(...shifted.target)); camera.updateMatrixWorld();
  if (opticalOffset) {
    if (localProjection) camera.setViewOffset(frame.width, frame.height, -frame.left, -frame.top, width, height);
    else camera.setViewOffset(width, height, width / 2 - frame.left - frame.width / 2, height / 2 - frame.top - frame.height / 2, width, height);
    equal(camera.position.toArray(), pose.position, `${label}: optical UI fit leaves the physical eye unchanged`);
    const expectedDirection = new Vector3(...pose.target).sub(new Vector3(...pose.position)).normalize();
    ok(camera.getWorldDirection(new Vector3()).distanceTo(expectedDirection) < 1e-10, `${label}: optical UI fit leaves the curated viewing direction unchanged`);
  }
  for (const point of points) {
    const projected = new Vector3(...point).project(camera), x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
    ok(projected.z > -1 && projected.z < 1, `${label}: real near/far clipping ${point}`);
    ok(x > frame.left + frame.width * .02 && x < frame.left + frame.width * .98 && y > frame.top + frame.height * .02 && y < frame.top + frame.height * .98,
      `${label}: selected geometry inside unobscured UI frame (${x}, ${y})`);
  }
}
type AccessPlan = ReturnType<typeof resolveAccessPlan>;
function accessWorld(plan: AccessPlan, x: number, y: number, z: number): CameraPoint {
  const p = plan.placement!, c = Math.cos(p.rotation), s = Math.sin(p.rotation);
  return [p.x + c * x + s * z, y, p.z - s * x + c * z];
}
/** Renderer-faithful walking surfaces and exposed risers, not a full-height
 * column above every footprint vertex. Buried solid bases are not subjects. */
function stairConstructionPoints(plan: AccessPlan, topY: number): CameraPoint[] {
  const points: CameraPoint[] = [];
  if (!plan.placement) return points;
  const local = (x: number, y: number, z: number) => points.push(accessWorld(plan, x, y, z));
  if (plan.corner) {
    plan.corner.radii.forEach((radius, index) => {
      const inner = index ? plan.corner!.radii[index - 1]! : 0;
      const top = topY - (index + 1) * plan.rise, below = top - plan.rise;
      if (plan.corner!.rectangular) {
        for (const [x, z] of rectangularCornerTread(inner, radius)) local(x, top, z);
        for (const [x, z] of [[0, radius], [radius, radius], [radius, 0]]) local(x!, below, z!);
      } else {
        for (let sample = 0; sample <= 48; sample++) {
          const angle = sample / 48 * Math.PI / 2, sx = Math.sin(angle), sz = Math.cos(angle);
          local(radius * sx, top, radius * sz); local(radius * sx, below, radius * sz);
          if (inner) local(inner * sx, top, inner * sz);
        }
        if (!inner) local(0, top, 0);
      }
    });
  } else for (let index = 0; index < plan.steps; index++) {
    const top = topY - (index + 1) * plan.rise, end = (index + 1) * plan.tread;
    for (const x of [-plan.width / 2, plan.width / 2]) {
      local(x, top, index * plan.tread); local(x, top, end); local(x, top - plan.rise, end);
    }
  }
  // The real arrival meets the rim only at the head, never above low treads.
  if (plan.corner) local(0, topY, 0);
  else for (const x of [-plan.width / 2, plan.width / 2]) local(x, topY, 0);
  return points;
}
/** Sample the actual renderer rail tubes and step surfaces in world metres. */
function ladderConstructionPoints(plan: AccessPlan, outline: ReturnType<typeof buildOutline>): CameraPoint[] {
  if (!plan.placement) return [];
  const points: CameraPoint[] = [];
  for (const contact of ladderWallContacts(outline, plan.placement)) {
    const curve = ladderRailCurve(plan.ladderAnchorOffset, plan.ladderDepths.at(-1) ?? .56, contact.z);
    const tube = new TubeGeometry(curve, 64, ACCESS_DIMENSIONS.ladderTubeRadius, 12, false), position = tube.getAttribute("position");
    // Every other ring retains true tube vertices including both end rings.
    for (let ring = 0; ring <= 64; ring += 2) for (let segment = 0; segment <= 12; segment++) {
      const i = ring * 13 + segment;
      points.push(accessWorld(plan, contact.x + position.getX(i), plan.ladderAnchorY + position.getY(i), position.getZ(i)));
    }
    tube.dispose();
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) for (const y of [0, .024])
      points.push(accessWorld(plan, contact.x + Math.cos(angle) * .06, plan.ladderAnchorY + y, -plan.ladderAnchorOffset + Math.sin(angle) * .06));
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) for (const z of [contact.z, contact.z + ACCESS_DIMENSIONS.ladderFootPad])
      points.push(accessWorld(plan, contact.x + Math.cos(angle) * .034, plan.ladderAnchorY - plan.ladderDepths.at(-1)! - ACCESS_DIMENSIONS.ladderFootDrop + Math.sin(angle) * .034, z));
  }
  for (const depth of plan.ladderDepths) for (const x of [-ACCESS_DIMENSIONS.ladderWidth / 2, ACCESS_DIMENSIONS.ladderWidth / 2])
    for (const z of [.32 - .065, .32 + .065]) for (const dy of [-.0175, .0175])
      points.push(accessWorld(plan, x, plan.ladderAnchorY - depth + dy, z));
  for (const depth of plan.ladderDepths) for (const x of [-.2, .2]) for (const z of [.32 - .0525, .32 + .0525]) for (const dy of [.017, .021])
    points.push(accessWorld(plan, x, plan.ladderAnchorY - depth + dy, z));
  return points;
}
/** Actual tier surfaces and nozzle faces, each retaining its own height. */
function hydroConstructionPoints(element: ComfortElementPlan): CameraPoint[] {
  const parts = [...(element.tiers ?? [element]), ...(element.steps ?? []), ...(element.landing ? [element.landing] : [])];
  const points: CameraPoint[] = parts.flatMap(part => part.footprint.map(([x, z]) => [x, part.topY, z] as CameraPoint));
  for (const step of element.steps ?? []) for (const [x, z] of step.footprint) points.push([x, step.topY - (element.riser ?? 0), z]);
  for (const jet of element.jets ?? []) for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const r = HYDRO_DIMENSIONS.jetDiameter / 2, along = Math.cos(angle) * r;
    points.push([jet.x + jet.dir[1] * along, jet.y + Math.sin(angle) * r, jet.z - jet.dir[0] * along]);
  }
  return points;
}
function accessSubjectAspect(plan: AccessPlan, layout: ReturnType<typeof getPoolVerticalLayout>, outline: ReturnType<typeof buildOutline>) {
  const helper = Reflect.get(cameraRuntime, "accessCameraSubject");
  const subject = typeof helper === "function" ? helper(plan, layout, outline) : null;
  return subject ? componentCameraAspect(subject.points, subject.direction) : undefined;
}
function centralRiserSpots<T extends { y: number }>(spots: readonly T[]): readonly T[] {
  const levels = [...new Set(spots.map(spot => Math.round(spot.y * 1e7) / 1e7))].sort((a, b) => b - a);
  const count = Math.min(3, levels.length), first = Math.floor((levels.length - count) / 2), selected = levels.slice(first, first + count);
  return spots.filter(spot => selected.some(y => Math.abs(spot.y - y) < 1e-6));
}
function microFacePoints(spots: readonly { x: number; y: number; z: number; dir: readonly [number, number] }[]): CameraPoint[] {
  return spots.flatMap(spot => [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(angle => {
    const r = HYDRO_DIMENSIONS.spotDiameter / 2, along = Math.cos(angle) * r;
    return [spot.x + spot.dir[1] * along, spot.y + Math.sin(angle) * r, spot.z - spot.dir[0] * along] as CameraPoint;
  }));
}
function infinityEnvelope(zone: RectangleInfinityZone, waterY: number): CameraPoint[] {
  const dims = clampInfinityEdgeDimensions(undefined), points: CameraPoint[] = [];
  zone.points.forEach(([x, z], index) => {
    const [nx, nz] = zone.pointNormals[index]!;
    for (const [outward, y] of [[0, waterY], [dims.lipWidth, waterY], [dims.lipWidth, waterY - dims.dropHeight],
      [dims.lipWidth + dims.catchBasinWidth + dims.wallThickness, waterY - dims.dropHeight + .045], [-.8, waterY - .08]]) {
      points.push([x + nx * outward!, y!, z + nz * outward!]);
    }
  });
  return points;
}
function localInfinityZone(zone: RectangleInfinityZone, across: number) {
  const dims = clampInfinityEdgeDimensions(undefined), innerDepth = Math.min(1.2, across * .35);
  // Z explicitly supersedes the former3–4m camera subject, not its heights.
  const span = Math.min(zone.length, dims.dropHeight + dims.catchBasinDepth + innerDepth);
  const from = zone.length - span, lengths = [0];
  for (let index = 1; index < zone.points.length; index++) lengths.push(lengths[index - 1]! + Math.hypot(zone.points[index]![0] - zone.points[index - 1]![0], zone.points[index]![1] - zone.points[index - 1]![1]));
  let index = 0;
  while (index < lengths.length - 2 && lengths[index + 1]! < from) index++;
  const a = zone.points[index]!, b = zone.points[index + 1]!, t = (from - lengths[index]!) / (lengths[index + 1]! - lengths[index]!);
  const start = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as const;
  const normal = new Vector3(zone.pointNormals[index]![0], 0, zone.pointNormals[index]![1]).lerp(new Vector3(zone.pointNormals[index + 1]![0], 0, zone.pointNormals[index + 1]![1]), t).normalize();
  return { ...zone, length: span, start, points: [start, ...zone.points.slice(index + 1)], pointNormals: [[normal.x, normal.z] as const, ...zone.pointNormals.slice(index + 1)] };
}
function localInfinityEnvelope(zone: RectangleInfinityZone, waterY: number): CameraPoint[] {
  const points = infinityEnvelope(zone, waterY), dims = clampInfinityEdgeDimensions(undefined), a = zone.points.at(-2)!, b = zone.end;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
  const normal = zone.pointNormals.at(-1)!, outset = copingOuterOffset("infinity", "hidden");
  for (const out of [0, dims.lipWidth + dims.catchBasinWidth + dims.wallThickness]) for (const y of [waterY, waterY - dims.dropHeight - dims.catchBasinDepth])
    points.push([b[0] + tx * outset + normal[0] * out, y, b[1] + tz * outset + normal[1] * out]);
  return points;
}
function copingOracle(outline: ReturnType<typeof buildOutline>, zone: RectangleInfinityZone, layout: ReturnType<typeof getPoolVerticalLayout>) {
  const index = (zone.side + zone.points.length - 1) % outline.length, a = outline[index]!, b = outline[(index + 1) % outline.length]!;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
  const winding = Math.sign(outline.reduce((sum, point, i) => { const q = outline[(i + 1) % outline.length]!; return sum + point[0] * q[1] - q[0] * point[1]; }, 0)) || 1;
  const nx = -tz * winding, nz = tx * winding, span = Math.min(2.4, length), outset = copingOuterOffset("infinity", "hidden");
  const excluded = new Set(Array.from({ length: zone.points.length - 1 }, (_, i) => (zone.side + i) % outline.length));
  const outer = squareInfinityCopingEnds(outline, offsetOutline(outline, outset), excluded);
  const geometry = createCopingSlabGeometry(outline, outer, POOL_BORDER_PRESET.thickness, excluded), material = new MeshBasicMaterial({ side: DoubleSide });
  const mesh = new Mesh(geometry, material); mesh.position.y = layout.copingY; mesh.updateMatrixWorld();
  const points: CameraPoint[] = [], ray = new Raycaster();
  // Intersect the real selected slab mesh from both sides. Its eased arris,
  // joints and actual underside, rather than a made-up thickness box, are used.
  for (const along of [.03, span / 2, span - .03]) for (const outward of [.025, outset - .025]) {
    let column: CameraPoint[] | null = null;
    // A nominal station can land exactly in a genuine 2 mm slab joint.
    // Probe at most 12 mm along the same physical section, never across it.
    for (const adjustment of [0, .006, -.006, .012, -.012]) {
      const x = a[0] + tx * (along + adjustment) - nx * outward, z = a[1] + tz * (along + adjustment) - nz * outward;
      const hits: CameraPoint[] = [];
      for (const direction of [-1, 1]) {
        ray.set(new Vector3(x, layout.copingY - direction, z), new Vector3(0, direction, 0));
        const hit = ray.intersectObject(mesh, false)[0];
        if (hit) hits.push(hit.point.toArray() as [number, number, number]);
      }
      if (hits.length === 2) { column = hits; break; }
    }
    ok(column, `Coping oracle sample lies on the actual surviving slab: side${zone.side}, edge${index}, along${along}, out${outward}`);
    points.push(...column!);
  }
  geometry.dispose(); material.dispose();
  return { points, direction: [nx + tx * .4, .8, nz + tz * .4] as CameraPoint, span };
}
function overflowOracle(outline: ReturnType<typeof buildOutline>, layout: ReturnType<typeof getPoolVerticalLayout>, visible: boolean) {
  const plan = planSkimmers(outline, outlineArea(outline), true), anchor = plan.positions[Math.floor(plan.positions.length / 2)]!;
  const nx = Math.sin(anchor.rotation), nz = Math.cos(anchor.rotation), tx = nz, tz = -nx;
  const points: CameraPoint[] = [], section = concealedOverflowSection(layout.wallTopY, POOL_BORDER_PRESET.thickness), g = OVERFLOW_GEOMETRY;
  const cuts = visible ? [[g.visibleKerbWidth, layout.wallTopY], [g.visibleChannelOuterOffset, layout.wallTopY],
    [g.visibleKerbWidth, layout.wallTopY - .025], [g.visibleChannelOuterOffset, layout.wallTopY - .025]]
    : [[g.waterEdgeOffset, layout.waterY], [section.copingInnerOffset, section.copingTopY],
      [section.copingInnerOffset, section.copingBottomY], [section.channelOuterOffset, section.channelFloorY],
      [copingOuterOffset("overflow", "hidden"), section.copingTopY]];
  for (const along of [-1.1, 0, 1.1]) for (const [outward, y] of cuts)
    points.push([anchor.x - nx * outward! + tx * along, y!, anchor.z - nz * outward! + tz * along]);
  return { points, direction: [nx + tx * .35, 1.1, nz + tz * .35] as CameraPoint, skimmers: plan };
}

// The selected Infinity detail must actually reach the detail pose. The former
// routing silently replaced it with the opposite-side whole-pool coastal hero.
if (enabled("infinity")) {
  const scene = readFileSync("src/components/pool/three/PoolScene.tsx", "utf8");
  const coastalHero = scene.match(/const coastalHero\s*=\s*[^;]+;/)?.[0] ?? "";
  ok(coastalHero.length > 0 && !coastalHero.includes('"infinity"'), "Selected Infinity detail must not be replaced by the opposite-side coastal overview");
  ok(coastalHero.includes('"review"') && coastalHero.includes('"overview"'), "Whole-pool review/overview retain their separately fitted coastal composition");
}
if (enabled("shelf")) {
  const viewport = readFileSync("src/components/pool/PoolViewport.tsx", "utf8");
  ok(viewport.includes('data-camera-occluder="mobile-view-tools"'),
    "The entire mobile Reframe/Expand/More wrapper is measured, not just the last two buttons");
}


if (enabled("infinity-local")) {
  const source = readFileSync("src/components/pool/three/PoolScene.tsx", "utf8"), tree = ts.createSourceFile("PoolScene.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  equal(hash(source), INFINITY_Y.sceneSha, "Z preserves every Y scene/PhotoMode/control branch exactly");
  equal(hash(readFileSync("src/lib/pool/camera.ts", "utf8").replace(INFINITY_Y.newSpan, INFINITY_Y.oldSpan)), INFINITY_Y.cameraSha, "The only camera-source delta from verified W2/Y is the explicit Infinity subject span");
  const rig: Record<string, string> = {};
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const name = node.name.getText(tree);
      if (["detail", "localFraming", "opticalDetail", "fitFov", "coastalHero"].includes(name)) rig[name] = node.initializer.getText(tree);
      if (name === "subjectAspect" && ts.isCallExpression(node.initializer)) rig.aspect = node.initializer.arguments[0]!.getText(tree);
    }
    if (ts.isCallExpression(node) && node.expression.getText(tree) === "useLayoutEffect") {
      const cb = node.arguments[0];
      if (cb?.getText(tree).includes('canvas.dataset["cameraProjection"]') && ts.isArrowFunction(cb) && ts.isBlock(cb.body)) {
        const end = cb.body.statements.findIndex(s => s.getText(tree).startsWith("goal.current.set"));
        rig.projection = cb.body.statements.slice(0, end).map(s => s.getText(tree)).join("\n");
      }
    }
    ts.forEachChild(node, visit);
  }; visit(tree);
  const evaluate = (text: string, scope: Record<string, unknown>) => new Function("scope", "with(scope){" + ts.transpileModule("const result=(" + text + ");", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + ";return result;}")(scope);
  const projection = new Function("scope", "with(scope){" + ts.transpileModule(rig.projection!, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + "}");
  const measurements: object[] = [];
  for (const [length, width] of sizes) {
    const outline = buildOutline("rectangle", { length, width, depth: 1.5, cornerRadius: 0 }, []), bounds = outlineBounds(outline);
    const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "infinity", depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
    for (const zone of infinityZonesForOutline(outline, "rectangle")) {
      const config: PoolConfig = { ...base, structure: "modular-steel-panels", finish: "liner", linerColor: "motionBlackStone799",
        dimensions: { length, width, depth: 1.5, cornerRadius: 0, floorProfile: "flat" }, system: "infinity",
        features: ["hydromassage", "inoxLadder"], hydromassageVariant: "open", internalStairType: "corner",
        infinityEdge: { enabled: true, side: zone.side, startT: 0, endT: 1, dropDirection: "outward", wallType: "traditional" } };
      const saved = JSON.stringify(config), resolvedLayout = configuredPoolLayout(config), dims = clampInfinityEdgeDimensions(undefined);
      const across = Math.abs(zone.normal[0]) * bounds.spanX + Math.abs(zone.normal[1]) * bounds.spanZ, inner = Math.min(1.2, across * .35);
      const total = zone.points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - zone.points[i]![0], p[1] - zone.points[i]![1]), 0);
      const span = Math.min(total, dims.dropHeight + dims.catchBasinDepth + inner);
      // Independent oracle: walk BACKWARD from the real closure, whereas
      // production walks forward to the initial sample. Retain every level.
      const samples = [{ point: zone.points.at(-1)!, normal: zone.pointNormals.at(-1)! }];
      let remaining = span;
      for (let i = zone.points.length - 2; i >= 0 && remaining > 1e-9; i--) {
        const a = zone.points[i]!, b = zone.points[i + 1]!, run = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (run <= remaining) { samples.unshift({ point: a, normal: zone.pointNormals[i]! }); remaining -= run; }
        else {
          const t = 1 - remaining / run, na = zone.pointNormals[i]!, nb = zone.pointNormals[i + 1]!, nx = na[0] + (nb[0] - na[0]) * t, nz = na[1] + (nb[1] - na[1]) * t, n = Math.hypot(nx, nz);
          samples.unshift({ point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], normal: [nx / n, nz / n] }); remaining = 0;
        }
      }
      const end = zone.points.at(-1)!, prev = zone.points.at(-2)!, run = Math.hypot(end[0] - prev[0], end[1] - prev[1]), closure = copingOuterOffset("infinity", "hidden");
      samples.push({ point: [end[0] + (end[0] - prev[0]) / run * closure, end[1] + (end[1] - prev[1]) / run * closure], normal: zone.pointNormals.at(-1)! });
      const receiver = dims.lipWidth + dims.catchBasinWidth + dims.wallThickness, oracle: CameraPoint[] = [];
      for (const sample of samples) for (const [out, y] of [[-inner, layout.waterY - .08], [0, layout.waterY], [dims.lipWidth, layout.waterY],
        [dims.lipWidth, layout.waterY - dims.dropHeight], [receiver, layout.waterY - dims.dropHeight + .045], [receiver, layout.waterY - dims.dropHeight - dims.catchBasinDepth]])
        for (const dx of [-.12, .12]) for (const dz of [-.12, .12]) oracle.push([sample.point[0] + sample.normal[0] * out! + dx, y!, sample.point[1] + sample.normal[1] * out! + dz]);
      const subject = cameraRuntime.infinityDetailCameraSubject(outline, zone, layout);
      ok(Math.abs(subject.span - span) < 1e-9 && Math.abs(subject.startDistance - (total - span)) < 1e-9, "Z span derives only from the full real section and actual end arclength");
      equal(subject.points.length, 72, "All72 section/padding vertices remain; no level is removed to fit");
      const coordinates = (points: readonly CameraPoint[]) => points.map(p => p.map(v => Math.round(v * 1e9)).join(",")).sort();
      equal(coordinates(subject.points), coordinates(oracle), "Actual Infinity ROI matches independent full crest/drop/receiver/inside/end-closure oracle");
      equal(subject.direction, [zone.normal[0] - zone.normal[1] * .35, .45, zone.normal[1] + zone.normal[0] * .35], "The approved front/three-quarter axis is unchanged");
      for (const [vw, vh] of viewports) {
        const ui = INFINITY_Y.ui[String(vw) as keyof typeof INFINITY_Y.ui];
        const scope: Record<string, unknown> = { ...cameraRuntime, outlineBounds, focus: "infinity", outline, layout, resolvedLayout, infinityZone: zone,
          skimmers: emptySkimmers, externalStairPlan: null, coverSubject: null, interiorSubject: null, shelfLoungerEnvelope: [], ledRow: resolvedLayout.lighting.plan.positions,
          compactPlan: true, planBounds: outline, SCENE_VISUAL_PRESET, viewportSize: { width: vw, height: vh } };
        const aspect = evaluate("(" + rig.aspect + ")()", scope), frame = visibleCameraFrame(ui.canvas, ui.overlays, aspect); scope.visibleFrame = frame;
        for (const key of ["detail", "localFraming", "opticalDetail", "fitFov", "coastalHero"]) scope[key] = evaluate(rig[key]!, scope);
        ok(scope.localFraming && scope.fitFov === 34 && !scope.coastalHero, "Actual Y/Z Rig gives selected Infinity its local34 lens, not the coastal hero or reduced UI-strip lens");
        const pose = getCameraPose({ intent: "infinity", outline, infinityZone: zone, layout, depth: 1.5, skimmers: emptySkimmers, verticalFov: scope.fitFov as number, viewportAspect: frame.width / frame.height });
        const delta = new Vector3(...pose.position).sub(new Vector3(...pose.target)), distance = delta.length(), polar = Math.acos(delta.y / distance), limits = infinityNavigationLimits(pose, true, layout.waterY);
        ok(delta.x * zone.normal[0] + delta.z * zone.normal[1] > 0, "The physical eye remains on the outward side of the selected crest");
        ok(pitch(pose) >= 12 && pitch(pose) <= 30, "Approved restrained pitch is retained");
        ok(distance >= limits.minDistance - 1e-9 && distance <= limits.maxDistance + 1e-9 && polar >= limits.minPolarAngle - 1e-9 && polar <= limits.maxPolarAngle + 1e-9, "Unmodified real Infinity OrbitControls admit the pose before any clamp");
        const camera = new PerspectiveCamera(34, vw / vh, SCENE_VISUAL_PRESET.camera.near, SCENE_VISUAL_PRESET.camera.far);
        camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true);
        projection({ ...scope, camera, PerspectiveCamera, OrthographicCamera, canvas: { dataset: {} }, planFit: { current: null }, pose });
        equal(camera.position.toArray(), pose.position, "The local inset never translates the physical eye");
        equal(camera.fov, 34, "Actual render and physical-fit lenses agree");
        equal(camera.aspect, frame.width / frame.height, "Actual viewport projection uses the selected real UI frame aspect");
        for (const p of oracle) {
          const q = new Vector3(...p).project(camera), x = (q.x + 1) * vw / 2, y = (1 - q.y) * vh / 2;
          ok(q.z > -1 && q.z < 1, "Full real section remains inside the actual near/far planes");
          ok(x > frame.left + frame.width * .02 && x < frame.left + frame.width * .98 && y > frame.top + frame.height * .02 && y < frame.top + frame.height * .98, "Full crest/drop/receiver/inside/end closure remains within original2% UI tolerance");
        }
        for (const focus of ["review", "overview"] as const) {
          const whole = { ...scope, focus };
          equal(evaluate(rig.localFraming!, whole), false, "Whole-pool Infinity review/overview do not inherit local-detail framing");
          equal(evaluate(rig.coastalHero!, whole), true, "Whole-pool Infinity review/overview retain their original coastal composition");
        }
        const glass = { ...config, infinityEdge: { ...config.infinityEdge!, wallType: "glass" as const } }, glassSnapshot = JSON.stringify(glass);
        equal(config.infinityEdge?.side, glass.infinityEdge.side, "Traditional/glass configurations retain the same real selected side");
        equal(JSON.stringify(config), saved, "Infinity framing never changes the traditional project snapshot");
        equal(JSON.stringify(glass), glassSnapshot, "Infinity framing never changes the glass project snapshot");
        measurements.push({ size: [length, width], side: zone.side, viewport: [vw, vh], span, frame, distance });
        cases.infinityLocal++;
      }
    }
  }
  console.log("Infinity local metrics (not visual or material PASS): " + JSON.stringify(measurements));
}

if (enabled("infinity")) for (const [length, width] of sizes) {
  const config = freeze({ ...base, system: "infinity" as const, dimensions: { ...base.dimensions, length, width } });
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "infinity", depth: config.dimensions.depth, copingThickness: .04 });
  for (const zone of infinityZonesForOutline(outline, config.shape)) for (const wallType of ["traditional", "glass"] as const) for (const [vw, vh] of viewports) {
    const selectedConfig = freeze({ ...config, infinityEdge: { enabled: true, side: zone.side, startT: 0, endT: 1, dropDirection: "outward" as const, wallType } });
    const before = JSON.stringify(selectedConfig);
    const bounds = outlineBounds(outline), across = Math.abs(zone.normal[0]) * bounds.spanX + Math.abs(zone.normal[1]) * bounds.spanZ;
    const local = localInfinityZone(zone, across), helper = Reflect.get(cameraRuntime, "infinityDetailCameraSubject");
    const subject = typeof helper === "function" ? helper(outline, zone, layout) : {
      points: localInfinityEnvelope(local, layout.waterY), direction: [zone.normal[0] - zone.normal[1] * .35, .45, zone.normal[1] + zone.normal[0] * .35] as CameraPoint,
    };
    const frame = frameFor(vw, vh, componentCameraAspect(subject.points, subject.direction)), fit = { verticalFov: 34, aspect: frame.width / frame.height };
    const pose = getCameraPose({ intent: "infinity", outline, infinityZone: zone, layout, depth: config.dimensions.depth,
      skimmers: emptySkimmers, verticalFov: fit.verticalFov, viewportAspect: fit.aspect });
    const midpoint = [(zone.start[0] + zone.end[0]) / 2, (zone.start[1] + zone.end[1]) / 2];
    const dx = pose.position[0] - midpoint[0]!, dz = pose.position[2] - midpoint[1]!;
    const normal = dx * zone.normal[0] + dz * zone.normal[1];
    const rayX = pose.position[0] - pose.target[0], rayZ = pose.position[2] - pose.target[2];
    const rayNormal = rayX * zone.normal[0] + rayZ * zone.normal[1], tangent = rayX * -zone.normal[1] + rayZ * zone.normal[0];
    const targetNormal = (pose.target[0] - midpoint[0]!) * zone.normal[0] + (pose.target[2] - midpoint[1]!) * zone.normal[1];
    const terminalTangent = new Vector3(zone.end[0] - zone.points.at(-2)![0], 0, zone.end[1] - zone.points.at(-2)![1]).normalize();
    const targetAlong = (pose.target[0] - local.start[0]) * terminalTangent.x + (pose.target[2] - local.start[1]) * terminalTangent.z;
    const label = `Infinity ${length}×${width}, side ${zone.side}, ${wallType}, ${vw}×${vh}`;
    ok([...pose.position, ...pose.target].every(Number.isFinite), `${label}: finite pose`);
    ok(normal > .7, `${label}: eye in outward/front semiplane, not opposite bank`);
    ok(Math.abs(tangent / rayNormal) > .15 && Math.abs(tangent / rayNormal) < .8, `${label}: restrained three-quarter viewing ray rather than square-on/sideways`);
    ok(pitch(pose) >= 12 && pitch(pose) <= 30, `${label}: slightly raised view, not plan or grazing (${pitch(pose)}°)`);
    ok(targetNormal > -1.3 && targetNormal < .7, `${label}: target stays on crest/near interior, not whole-pool centre (${targetNormal}m)`);
    // The owner explicitly superseded the former whole-edge detail framing:
    // inspect a terminal segment derived from its full section, not the whole side.
    // Full-pool overview/review coping containment remains in the legacy suite.
    ok(Math.abs(targetAlong - (local.length + copingOuterOffset("infinity", "hidden")) / 2) < .4,
      `${label}: target explains the real terminal construction segment, not a distant whole-edge centre (${targetAlong}m)`);
    projectInside(pose, localInfinityEnvelope(local, layout.waterY), vw, vh, label, frame, true, true);
    equal(JSON.stringify(selectedConfig), before, `${label}: camera never mutates configuration`);
    cases.infinity++;
  }
}

const stairRotations = new Set<number>();
for (const [length, width] of shelfSizes) for (const system of ["skimmer", "overflow", "infinity"] as const) {
  const config = { ...base, system, dimensions: { ...base.dimensions, length, width } };
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const zones = system === "infinity" ? infinityZonesForOutline(outline, config.shape) : [null];
  const layout = getPoolVerticalLayout({ poolType: "in-ground", system, overflowType: "hidden", depth: config.dimensions.depth, copingThickness: .04 });
  if (enabled("shelf")) for (const zone of zones) for (const loungersOn of [false, true]) {
    const shelfConfig = freeze({ ...config, features: loungersOn ? ["sunShelf", "sunShelfLoungers"] as const : ["sunShelf"] as const,
      ...(zone ? { infinityEdge: { enabled: true, side: zone.side, startT: 0, endT: 1, dropDirection: "outward" as const } } : {}) });
    const before = JSON.stringify(shelfConfig), resolved = configuredPoolLayout(shelfConfig), shelf = resolved.comfort.elements.find(element => element.kind === "sunShelf");
    if (!shelf) continue; // Incompatible product geometry is not fabricated for a camera test.
    const loungerPlan = configuredSunShelfLoungers(shelfConfig), accessoryEnvelope: CameraPoint[] = [];
    for (const placement of loungerPlan.placements) for (const [x, z] of placement.footprint) for (const y of [placement.y, placement.y + SUN_SHELF_LOUNGER_MODEL.height]) accessoryEnvelope.push([x, y, z]);
    const points: CameraPoint[] = [shelf, ...(shelf.steps ?? []), ...(shelf.landing ? [shelf.landing] : [])]
      .flatMap(part => part.footprint.map(([x, z]) => [x, part.topY, z] as const));
    const lastTread = shelf.steps?.at(-1);
    if (lastTread) for (const [x, z] of lastTread.footprint) {
      points.push([x, Math.max(layout.floorY, lastTread.topY - (shelf.riser ?? 0)), z]);
    }
    points.push(...accessoryEnvelope);
    const subject = sunShelfCameraSubject(resolved, layout, outline, accessoryEnvelope);
    ok(subject, "Selected shelf has an actual camera subject");
    const preferredAspect = componentCameraAspect(subject!.points, subject!.direction);
    ok(Math.abs(preferredAspect - Math.max(.2, projectedSpan(subject!.points, subject!.direction))) < 1e-9,
      "Projected aspect agrees with independent axis projection of actual geometry");
    for (const [vw, vh] of viewports) {
      const mobileUI = capturedMobileUI[vw];
      const frame = mobileUI ? visibleCameraFrame(mobileUI.canvas, mobileUI.overlays, preferredAspect) : frameFor(vw, vh, preferredAspect);
      if (mobileUI) {
        const score = Math.min(frame.width / preferredAspect, frame.height);
        ok(Math.abs(score - optimalFreeFrame(mobileUI.canvas, mobileUI.overlays, preferredAspect)) < 1e-7,
          "Subject-aware free rectangle maximizes actual projected scale among all UI-free edge-bounded rectangles");
      }
      const fit = cameraFrameFit(34, vh, frame);
      const pose = contextualAccessCamera("shelf", resolved, layout, outline, fit.verticalFov, fit.aspect, zone, accessoryEnvelope);
      const label = `Sun Shelf ${length}×${width}, ${system}, side ${zone?.side ?? "none"}, loungers ${loungersOn}, ${vw}×${vh}`;
      ok(pose, `${label}: selected shelf has dedicated camera`);
      ok(pitch(pose!) >= 25 && pitch(pose!) <= 50, `${label}: raised oblique, neither plan nor grazing (${pitch(pose!)}°)`);
      projectInside(pose!, points, vw, vh, label, frame);
      if (mobileUI && length === 10 && width === 4.5 && system === "infinity" && zone?.side === 2 && loungersOn) {
        const oldFrame = visibleCameraFrame(mobileUI.canvas, mobileUI.overlays), oldFit = cameraFrameFit(34, vh, oldFrame);
        const oldPose = contextualAccessCamera("shelf", resolved, layout, outline, oldFit.verticalFov, oldFit.aspect, zone, accessoryEnvelope)!;
        const before = projectedPixelBounds(oldPose, points, vw, vh, oldFrame), after = projectedPixelBounds(pose!, points, vw, vh, frame);
        if (vw === 390) ok(after.area > before.area * 1.01, "Captured 390 UI: geometry-aware framing improves the visible shelf area over max-area-rectangle baseline");
        shelfFrameMeasurements.push({ viewport: `${vw}×${vh}`, before, after, areaRatio: after.area / before.area, preferredAspect, frame });
      }
      equal(JSON.stringify(shelfConfig), before, `${label}: camera does not alter furniture/lighting/configuration`);
      cases.shelf++;
    }
  }
  if (enabled("stairs")) for (const zone of zones) for (const stairType of ["linear", "corner"] as const) {
    const layout = getPoolVerticalLayout({ poolType: "in-ground", system, overflowType: "hidden", depth: config.dimensions.depth, copingThickness: POOL_BORDER_PRESET.thickness });
    const stairConfig = freeze({ ...config, internalStairType: stairType,
      ...(zone ? { infinityEdge: { enabled: true, side: zone.side, startT: 0, endT: 1, dropDirection: "outward" as const } } : {}) });
    const before = JSON.stringify(stairConfig), resolved = configuredPoolLayout(stairConfig), plan = resolved.access;
    if (!plan.placement) continue;
    stairRotations.add(Math.round(plan.placement.rotation * 180 / Math.PI));
    const points = stairConstructionPoints(plan, layout.copingY), preferredAspect = accessSubjectAspect(plan, layout, outline);
    ok(points.length > 0, "Real selected internal stairs have actual walking surfaces and exposed risers");
    for (const [vw, vh] of viewports) {
      const frame = frameFor(vw, vh, preferredAspect), fit = cameraFrameFit(34, vh, frame);
      const pose = contextualAccessCamera("access", resolved, layout, outline, fit.verticalFov, fit.aspect, zone) ?? getCameraPose({ intent: "access", accessPlan: plan,
        outline, layout, depth: config.dimensions.depth, skimmers: emptySkimmers, verticalFov: fit.verticalFov, viewportAspect: fit.aspect });
      const label = `Stairs ${length}×${width}, ${system}, side ${zone?.side ?? "none"}, ${stairType}, ${vw}×${vh}`;
      ok(pitch(pose) >= 25 && pitch(pose) <= 50, `${label}: an oblique access detail, not a high plan view (${pitch(pose)}°)`);
      projectInside(pose, points, vw, vh, label, frame);
      equal(JSON.stringify(stairConfig), before, "Stair camera preserves selected products and configuration");
      cases.stairs++;
    }
  }
}
if (enabled("stairs")) for (const [length, width] of sizes) {
  // Above-ground exposes only Standard/Mirrored, not four invented UI buttons.
  for (const stairType of ["linear", "corner"] as const) for (const mirrored of [false, true]) {
    const config = freeze({ ...base, poolType: "above-ground" as const, dimensions: { ...base.dimensions, length, width },
      internalStairType: stairType, internalStairMirrored: mirrored });
    const outline = buildOutline(config.shape, config.dimensions, config.controlPoints), resolved = configuredPoolLayout(config), plan = resolved.access;
    if (!plan.placement) { ok(!!plan.reason, "Unavailable mirrored product remains explicitly unavailable"); continue; }
    const layout = getPoolVerticalLayout({ poolType: "above-ground", system: "skimmer", depth: config.dimensions.depth, copingThickness: POOL_BORDER_PRESET.thickness });
    const points = stairConstructionPoints(plan, layout.copingY), preferredAspect = accessSubjectAspect(plan, layout, outline);
    for (const [vw, vh] of viewports) {
      const frame = frameFor(vw, vh, preferredAspect), fit = cameraFrameFit(34, vh, frame);
      const pose = getCameraPose({ intent: "access", accessPlan: plan, outline, layout, depth: config.dimensions.depth, skimmers: emptySkimmers,
        verticalFov: fit.verticalFov, viewportAspect: fit.aspect });
      projectInside(pose, points, vw, vh, `Above-ground ${length}×${width}, ${stairType}, mirrored ${mirrored}, ${vw}×${vh}`, frame);
      cases.stairs++;
    }
  }
  // All four true corner anchors are supported solver positions. These stress
  // camera orientation only; they are not represented as customer UI choices.
  const dimensions = { ...base.dimensions, length, width }, outline = buildOutline("rectangle", dimensions, []);
  const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "skimmer", depth: dimensions.depth, copingThickness: POOL_BORDER_PRESET.thickness });
  const floorProfile = buildFloorProfile({ outline, shape: "rectangle", poolType: "in-ground", dimensions, verticalLayout: layout });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const plan = resolveAccessPlan({ outline, floorProfile, access: "internalSteps", stairType: "corner", topY: layout.copingY,
      mirrorAnchor: { x: sx! * length / 2, z: sz! * width / 2 } });
    ok(plan.placement, "Real corner solver supports fixture anchor without fabricating geometry");
    stairRotations.add(Math.round(plan.placement!.rotation * 180 / Math.PI));
    const points = stairConstructionPoints(plan, layout.copingY), preferredAspect = accessSubjectAspect(plan, layout, outline);
    for (const [vw, vh] of viewports) {
      const frame = frameFor(vw, vh, preferredAspect), fit = cameraFrameFit(34, vh, frame);
      const pose = getCameraPose({ intent: "access", accessPlan: plan, outline, layout, depth: dimensions.depth, skimmers: emptySkimmers,
        verticalFov: fit.verticalFov, viewportAspect: fit.aspect });
      projectInside(pose, points, vw, vh, `Real corner ${length}×${width}, anchor ${sx}/${sz}, ${vw}×${vh}`, frame);
      cases.stairs++;
    }
  }
}
if (enabled("stairs")) ok(stairRotations.size >= 4, `Real supported stair placements exercise all four orientations (${[...stairRotations]})`);

if (enabled("corner-captured")) {
  // Independent review's F-isolated-corner-8x4-390-rects.json: the header is
  // 108 px high, menu/badge top132, not the previous origin's 119/143 fixture.
  const canvas = capturedMobileUI[390]!.canvas;
  const overlays = capturedMobileUI[390]!.overlays.map((rect, i) => i === 0 ? { ...rect, height: 108 }
    : i === 1 || i === 2 ? { ...rect, top: 132 } : rect);
  const config = freeze({ ...base, system: "infinity" as const, structure: "modular-steel-panels" as const,
    dimensions: { ...base.dimensions, length: 8, width: 4, depth: 1.5, floorProfile: "flat" as const },
    internalStairType: "corner" as const, features: ["inoxLadder"] as const,
    infinityEdge: { enabled: true, side: 2, startT: 0, endT: 1, dropDirection: "outward" as const, wallType: "glass" as const } });
  const before = JSON.stringify(config), outline = buildOutline(config.shape, config.dimensions, []), resolved = configuredPoolLayout(config);
  const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "infinity", depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
  const zone = infinityZonesForOutline(outline, config.shape).find(zone => zone.side === 2)!;
  equal(resolved.access.steps, 6, "Captured F corner fixture retains six real treads");
  ok(resolved.ladder?.plan.placement, "Captured F corner fixture retains its optional inox ladder");
  const aspect = accessSubjectAspect(resolved.access, layout, outline), frame = visibleCameraFrame(canvas, overlays, aspect), fit = cameraFrameFit(34, 844, frame);
  const pose = contextualAccessCamera("access", resolved, layout, outline, fit.verticalFov, fit.aspect, zone)!;
  const points = stairConstructionPoints(resolved.access, layout.copingY);
  const limits = infinityNavigationLimits(pose, true, layout.waterY), ray = new Vector3(...pose.position).sub(new Vector3(...pose.target));
  const distance = ray.length(), polar = Math.acos(ray.y / distance), azimuth = Math.atan2(ray.x, ray.z);
  ok(distance >= limits.minDistance && distance <= limits.maxDistance && polar >= limits.minPolarAngle && polar <= limits.maxPolarAngle && azimuth >= limits.minAzimuthAngle && azimuth <= limits.maxAzimuthAngle,
    "The generated actual corner goal lies inside its final Infinity orbit limits; no geometric clamp is needed");
  console.log(`Captured F corner diagnostic, not browser PASS: ${JSON.stringify({ frame, aspect, pose, limits, pixelBounds: projectedPixelBounds(pose, points, 390, 844, frame), placement: resolved.access.placement, treads: resolved.access.steps })}`);
  projectInside(pose, points, 390, 844, "Captured F six-tread corner/UI Lato3/390", frame);
  // Reconstruct the actual six rendered solids, including their full
  // floor-following bases; apply the renderer's group matrix, not a camera
  // envelope or custom projection formula. Values below are the public DEV
  // diagnostic after a single Reframe, not hidden application state.
  const actual = new PerspectiveCamera(34, 390 / 844, .05, 1000);
  actual.up.set(0, 1, 0); actual.position.set(13.40619700690734, 16.022554863007368, 8.8281182041444);
  actual.zoom = 1; actual.setViewOffset(390, 844, 108.5390625, 151.2421875, 390, 844);
  actual.lookAt(-3.039, -.7225, -1.0389999999999997); actual.updateMatrixWorld(true);
  const floor = buildFloorProfile({ outline, shape: config.shape, poolType: "in-ground", dimensions: config.dimensions, verticalLayout: layout, infinityEdge: config.infinityEdge });
  const plan = resolved.access, group = new Group(), material = new MeshBasicMaterial(), renderSamples: Array<{ x: number; y: number; z: number; step: number }> = [];
  group.position.set(plan.placement!.x, 0, plan.placement!.z); group.rotation.y = plan.placement!.rotation;
  const solids = plan.corner!.radii.map((radius, index) => {
    const inner = index ? plan.corner!.radii[index - 1]! : 0;
    const polygon: Array<readonly [number, number]> = [];
    if (plan.corner!.rectangular) polygon.push(...rectangularCornerTread(inner, radius));
    else {
      for (let j = 0; j <= 48; j++) { const a = j / 48 * Math.PI / 2; polygon.push([radius * Math.sin(a), radius * Math.cos(a)]); }
      if (inner) for (let j = 48; j >= 0; j--) { const a = j / 48 * Math.PI / 2; polygon.push([inner * Math.sin(a), inner * Math.cos(a)]); }
      else polygon.push([0, 0]);
    }
    const geometry = stairSolid(polygon, layout.copingY - (index + 1) * plan.rise, plan.placement!, floor);
    const mesh = new Mesh(geometry, material); group.add(mesh); return mesh;
  });
  group.updateMatrixWorld(true);
  for (const [step, mesh] of solids.entries()) {
    const vertices = mesh.geometry.getAttribute("position");
    for (let i = 0; i < vertices.count; i++) {
      const projected = new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).project(actual);
      renderSamples.push({ x: (projected.x + 1) * 390 / 2, y: (1 - projected.y) * 844 / 2, z: projected.z, step });
    }
  }
  const renderedBounds = { left: Math.min(...renderSamples.map(p => p.x)), right: Math.max(...renderSamples.map(p => p.x)), top: Math.min(...renderSamples.map(p => p.y)), bottom: Math.max(...renderSamples.map(p => p.y)) };
  console.log(`Actual THREE camera + all rendered stairSolid vertices: ${JSON.stringify({ renderedBounds, vertices: renderSamples.length, quaternion: actual.quaternion.toArray(), projectionMatrix: actual.projectionMatrix.toArray() })}`);
  for (const point of renderSamples) {
    ok(point.z > -1 && point.z < 1, `Actual rendered tread ${point.step}: near/far clipping`);
    ok(point.x > frame.left + frame.width * .02 && point.x < frame.left + frame.width * .98 && point.y > frame.top + frame.height * .02 && point.y < frame.top + frame.height * .98,
      `Actual rendered tread ${point.step}: THREE.Vector3.project inside actual optical frame (${point.x},${point.y})`);
  }
  for (const mesh of solids) mesh.geometry.dispose(); material.dispose();
  equal(JSON.stringify(config), before, "Actual captured-frame projection never changes selected products");
}

if (enabled("micro-captured")) {
  const config = freeze({ ...base, system: "infinity" as const, structure: "modular-steel-panels" as const,
    dimensions: { ...base.dimensions, length: 8, width: 4, depth: 1.5, floorProfile: "flat" as const }, internalStairType: "corner" as const,
    features: ["hydromassage", "stairLighting", "inoxLadder", "ledLighting"] as const, hydromassageVariant: "closed" as const,
    infinityEdge: { enabled: true, side: 2, startT: 0, endT: 1, dropDirection: "outward" as const, wallType: "glass" as const } });
  const before = JSON.stringify(config), outline = buildOutline(config.shape, config.dimensions, []), resolved = configuredPoolLayout(config);
  const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "infinity", depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
  const floor = buildFloorProfile({ outline, shape: config.shape, poolType: "in-ground", dimensions: config.dimensions, verticalLayout: layout,
    sunShelf: true, infinityEdge: config.infinityEdge });
  const zone = infinityZonesForOutline(outline, config.shape).find(zone => zone.side === 2)!, spots = centralRiserSpots(resolved.stairMicroSpots);
  const hydro = resolved.comfort.elements.find(element => element.kind === "hydromassage")!;
  equal(resolved.effectiveAccess, null, "Hydro B replaces the standalone corner flight; its risers are the actual micro-light context");
  equal(resolved.stairMicroSpots.length, 6, "Captured integrated hydro flight has six actually installed micro-spots");
  equal(new Set(spots.map(spot => Math.round(spot.y * 1e7))).size, 3, "The camera detail selects three real central levels, not every light in the model");
  const parts = [hydro.landing!, ...hydro.steps!], context: CameraPoint[] = [], selectedFaces: unknown[] = [];
  const faceCoordinates: Array<{ level: number; corners: CameraPoint[]; spot: CameraPoint }> = [];
  for (const [index, part] of parts.entries()) {
    const next = parts[index + 1], center = part.footprint.reduce((sum, [x, z]) => [sum[0]! + x / part.footprint.length, sum[1]! + z / part.footprint.length], [0, 0]);
    for (const spot of spots) {
      const lower = next?.topY ?? floor.floorYAt(spot.x, spot.z);
      if (Math.abs((part.topY + lower) / 2 - spot.y) > 1e-7) continue;
      const maximum = Math.max(...part.footprint.map(([x, z]) => x * spot.dir[0] + z * spot.dir[1]));
      const edge = part.footprint.filter(([x, z]) => Math.abs(x * spot.dir[0] + z * spot.dir[1] - maximum) < 1e-7);
      equal(edge.length, 2, "Each selected comfort-light fixture has the two actual full-width front-riser endpoints");
      for (const [x, z] of edge) context.push([x, part.topY, z], [x, lower, z]);
      context.push(...part.footprint.map(([x, z]) => [x, part.topY, z] as CameraPoint));
      selectedFaces.push({ level: spot.y, part: index, top: part.topY, lower, edge, center });
      faceCoordinates.push({ level: spot.y, corners: edge.flatMap(([x, z]) => [[x, part.topY, z], [x, lower, z]] as CameraPoint[]), spot: [spot.x, spot.y, spot.z] });
    }
  }
  equal(selectedFaces.length, 3, "All three selected micro-light levels retain their real complete riser and tread context");
  const canvas = capturedMobileUI[390]!.canvas;
  // F-isolated-stair-spots-390-rects.json: new header/menu, no construction badge.
  const overlays = capturedMobileUI[390]!.overlays.filter((_, i) => i !== 2).map((rect, i) => i === 0 ? { ...rect, height: 108 } : i === 1 ? { ...rect, top: 132 } : rect);
  const helper = Reflect.get(cameraRuntime, "microLightCameraSubject"), subject = helper("stair-lighting", resolved, layout, outline);
  const aspect = componentCameraAspect(subject.points, subject.direction), frame = visibleCameraFrame(canvas, overlays, aspect), fit = cameraFrameFit(34, 844, frame);
  const pose = contextualAccessCamera("stair-lighting", resolved, layout, outline, fit.verticalFov, fit.aspect, zone)!;
  console.log(`Actual Hydro B central-riser context (not browser PASS): ${JSON.stringify({ frame, aspect, pose, spots, selectedFaces, contextBounds: projectedPixelBounds(pose, context, 390, 844, frame) })}`);
  const actual = new PerspectiveCamera(34, 390 / 844, .05, 1000);
  actual.position.set(...pose.position); actual.lookAt(new Vector3(...pose.target)); actual.updateMatrixWorld(true);
  actual.setViewOffset(390, 844, 390 / 2 - frame.left - frame.width / 2, 844 / 2 - frame.top - frame.height / 2, 390, 844);
  const pixels = (point: CameraPoint) => { const p = new Vector3(...point).project(actual); return [(p.x + 1) * 390 / 2, (1 - p.y) * 844 / 2]; };
  console.log(`Geometric pixel identification only; water refraction is not simulated: ${JSON.stringify(faceCoordinates.map(face => ({ level: face.level, center: pixels(face.spot), corners: face.corners.map(pixels) })))}`);
  projectInside(pose, [...context, ...microFacePoints(spots)], 390, 844, "Captured Hydro B three central riser faces and treads/390", frame);
  equal(JSON.stringify(config), before, "A fitting-detail camera preserves all six physical spots, selected access and independent RGB");
}

if (enabled("ladder") || enabled("hydro")) for (const [length, width] of sizes) for (const system of ["skimmer", "overflow", "infinity"] as const) {
  const config = { ...base, system, dimensions: { ...base.dimensions, length, width } }, outline = buildOutline(config.shape, config.dimensions, []);
  const layout = getPoolVerticalLayout({ poolType: "in-ground", system, overflowType: "hidden", depth: config.dimensions.depth, copingThickness: POOL_BORDER_PRESET.thickness });
  const zones = system === "infinity" ? infinityZonesForOutline(outline, config.shape) : [null];
  for (const zone of zones) {
    const edge = zone ? { infinityEdge: { enabled: true, side: zone.side, startT: 0, endT: 1, dropDirection: "outward" as const } } : {};
    if (enabled("ladder")) {
      const selected = freeze({ ...config, ...edge, features: ["inoxLadder"] as const }), before = JSON.stringify(selected), resolved = configuredPoolLayout(selected);
      const plan = resolved.ladder?.plan;
      if (!plan?.placement) { ok(!!plan?.reason, "Unavailable inox access is reported rather than fabricated"); continue; }
      const points = ladderConstructionPoints(plan, outline), preferredAspect = accessSubjectAspect(plan, layout, outline);
      ok(points.length > 0, "Actual selected inox rails and steps provide real camera samples");
      for (const [vw, vh] of viewports) {
        const frame = frameFor(vw, vh, preferredAspect), fit = cameraFrameFit(34, vh, frame);
        const pose = contextualAccessCamera("inox", resolved, layout, outline, fit.verticalFov, fit.aspect, zone);
        const label = `Real inox ${length}×${width}/${system}/side ${zone?.side ?? "none"}/${vw}×${vh}`;
        ok(pose, `${label}: the selected ladder has a dedicated pose`);
        ok(pitch(pose!) >= 20 && pitch(pose!) <= 45, `${label}: an oblique rail-and-tread view, not a high miniature (${pitch(pose!)}°)`);
        projectInside(pose!, points, vw, vh, label, frame);
        equal(JSON.stringify(selected), before, `${label}: camera preserves both selected access products`);
        cases.ladder++;
      }
    }
    if (enabled("hydro")) for (const variant of ["open", "closed"] as const) {
      const selected = freeze({ ...config, ...edge, hydromassageVariant: variant, features: ["hydromassage", "inoxLadder"] as const });
      const before = JSON.stringify(selected), resolved = configuredPoolLayout(selected), element = resolved.comfort.elements.find(part => part.kind === "hydromassage");
      if (!element) { ok(!resolved.comfort.availability.hydromassage.available, "Unavailable hydro geometry stays unavailable, not invented for a camera fixture"); continue; }
      const points = hydroConstructionPoints(element), helper = Reflect.get(cameraRuntime, "comfortCameraSubject");
      const subject = typeof helper === "function" ? helper("hydromassage", resolved, layout, outline) : null;
      const preferredAspect = subject ? componentCameraAspect(subject.points, subject.direction) : undefined;
      ok(!!element.jets?.length, "The hydro fixture includes real nozzle faces, not only an empty volume");
      for (const [vw, vh] of viewports) {
        const frame = frameFor(vw, vh, preferredAspect), fit = cameraFrameFit(34, vh, frame);
        const pose = contextualAccessCamera("hydromassage", resolved, layout, outline, fit.verticalFov, fit.aspect, zone);
        const label = `Real hydro ${variant}/${length}×${width}/${system}/side ${zone?.side ?? "none"}/${vw}×${vh}`;
        ok(pose, `${label}: the selected actual tiers have a dedicated pose`);
        ok(pitch(pose!) >= 25 && pitch(pose!) <= 50, `${label}: an oblique seat-and-nozzle detail, not a top-down overview (${pitch(pose!)}°)`);
        projectInside(pose!, points, vw, vh, label, frame);
        equal(JSON.stringify(selected), before, `${label}: no tier, nozzle, material or optional changes for camera fit`);
        cases.hydro++;
      }
    }
  }
}

if (enabled("waterline")) {
  const path = process.argv.includes("--candidate-q") ? "docs/fullscreen-qa-evidence/premium-live-cameras/PoolScene-q-before-r-20261015.tsx" : "src/components/pool/three/PoolScene.tsx";
  const tree = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const current = { aspect: "", local: "", detail: "", optical: "", fit: "", owner: "", projection: "" };
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const name = node.name.getText(tree), keys = { localFraming: "local", detail: "detail", opticalDetail: "optical", fitFov: "fit" } as const;
      if (name in keys) current[keys[name as keyof typeof keys]] = node.initializer.getText(tree);
      if (name === "subjectAspect" && ts.isCallExpression(node.initializer)) current.aspect = node.initializer.arguments[0]!.getText(tree);
    }
    if (ts.isCallExpression(node) && node.expression.getText(tree) === "useLayoutEffect" && node.arguments[0]) {
      const text = node.arguments[0].getText(tree); if (text.includes("owned.manual = true")) current.owner = text;
      if (text.includes('canvas.dataset["cameraProjection"]') && text.includes("goal.current.set") && ts.isArrowFunction(node.arguments[0]) && ts.isBlock(node.arguments[0].body)) {
        const statements = node.arguments[0].body.statements, end = statements.findIndex(s => s.getText(tree).startsWith("goal.current.set")); current.projection = statements.slice(0, end).map(s => s.getText(tree)).join("\n");
      }
    }
    ts.forEachChild(node, visit);
  }; visit(tree); ok(Object.values(current).every(Boolean), "Read actual waterline routing and projection/ownership callbacks");
  equal(createHash("sha256").update(current.projection).digest("hex"), WATERLINE_Q_RIG.projectionHash, "The proven Q projection/handoff/orthographic/PhotoMode prefix is completely unchanged");
  equal(createHash("sha256").update(current.owner).digest("hex"), WATERLINE_Q_RIG.ownerHash, "Waterline reuses Q's exact scoped ownership lifecycle, without another implementation");
  const functions = new Map<string, (scope: Record<string, unknown>) => any>();
  const evaluate = (text: string, scope: Record<string, unknown>) => {
    if (!functions.has(text)) { const js = ts.transpileModule(`const result = (${text});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; functions.set(text, new Function("scope", `with(scope){${js};return result;}`) as never); }
    return functions.get(text)!(scope);
  };
  const projectionCode = ts.transpileModule(current.projection, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const projectRuntime = (scope: Record<string, unknown>) => new Function("scope", `with(scope){${projectionCode}}`)(scope);
  const hydraulicCode = ts.transpileModule(WATERLINE_Q_HYDRAULIC, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const hydraulic = new Function(`${hydraulicCode};return getSystemDetailCamera;`)() as (args: Record<string, unknown>) => CameraPose;
  const fixtures = process.argv.includes("--mobile-repro") ? [[6, 3, "in-ground", "skimmer", "hidden", "slim", 1440, 900] as const] : sizes.flatMap(([length, width]) => (["in-ground", "above-ground"] as const).flatMap(poolType =>
    ([["skimmer", "hidden", "standard"], ["skimmer", "hidden", "slim"], ["skimmer", "hidden", "highWaterline"], ["skimmer", "hidden", "flush"], ["overflow", "hidden", "slim"], ["overflow", "visible", "slim"]] as const).flatMap(([system, overflowType, skimmerType]) => viewports.map(([vw, vh]) => [length, width, poolType, system, overflowType, skimmerType, vw, vh] as const))));
  const fiberPath = "node_modules/@react-three/fiber/dist/events-156d8d12.esm.js", fiber = ts.createSourceFile(fiberPath, readFileSync(fiberPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let updateText = "", ortho = ""; const readFiber = (node: ts.Node) => { if (ts.isFunctionDeclaration(node) && node.name?.text === "updateCamera") updateText = node.getText(fiber); if (ts.isVariableDeclaration(node) && node.name.getText(fiber) === "isOrthographicCamera" && node.initializer) ortho = node.initializer.getText(fiber); ts.forEachChild(node, readFiber); }; readFiber(fiber);
  ok(updateText && ortho, "Use actual installed R3F updateCamera to check the new local waterline route"); const updateCamera = new Function(`const isOrthographicCamera=${ortho};return(${updateText});`)();
  for (const [length, width, poolType, system, overflowType, skimmerType, vw, vh] of fixtures) {
    const config = freeze({ ...base, structure: "modular-steel-panels" as const, dimensions: { ...base.dimensions, length, width }, poolType, system, overflowType, skimmerType,
      linerColor: "motionBlackStone799" as const, copingMaterial: "prun" as const, paving: "travertine" as const, pavingFormat: "60x120" as const, sceneTime: "day" as const,
      internalStairType: "corner" as const, features: poolType === "in-ground" ? ["inoxLadder"] as const : [], equipment: poolType === "in-ground" ? ["automaticCover"] : [], coverPosition: "closed" as const, coverExtension: 1 });
    const before = JSON.stringify(config), outline = buildOutline(config.shape, config.dimensions, []), bounds = outlineBounds(outline), resolvedLayout = configuredPoolLayout(config), skimmers = planSkimmers(outline, length * width, true);
    const layout = getPoolVerticalLayout({ poolType, system, overflowType, depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness }), anchor = skimmers.positions[Math.floor(skimmers.positions.length / 2)]!;
    const nx = Math.sin(anchor.rotation), nz = Math.cos(anchor.rotation), tx = nz, tz = -nx, tangentSpan = Math.abs(tx) * bounds.spanX + Math.abs(tz) * bounds.spanZ;
    const span = Math.min(3.4, Math.max(2.2, tangentSpan * .42)), points: CameraPoint[] = [];
    for (const along of [-span / 2, span / 2]) for (const y of [layout.waterY - .15, layout.copingY]) points.push([anchor.x + tx * along, y, anchor.z + tz * along]);
    if (system === "skimmer") {
      const profile = SKIMMER_PROFILES[skimmerType];
      for (const along of [-profile.width / 2, profile.width / 2]) for (const y of [layout.wallTopY - profile.drop + profile.center - profile.height / 2, layout.wallTopY - profile.drop + profile.center + profile.height / 2]) for (const into of [0, profile.depth])
        points.push([anchor.x + tx * along + nx * into, y, anchor.z + tz * along + nz * into]);
    } else {
      const section = concealedOverflowSection(layout.wallTopY, POOL_BORDER_PRESET.thickness), g = OVERFLOW_GEOMETRY;
      const cuts = overflowType === "visible" ? [[g.visibleKerbWidth, layout.wallTopY + g.visibleGrateTopOffset], [g.visibleChannelOuterOffset, layout.wallTopY + g.visibleGrateTopOffset], [g.visibleKerbWidth, layout.wallTopY - .025]]
        : [[g.waterEdgeOffset, layout.waterY], [section.copingInnerOffset, section.copingTopY], [section.copingInnerOffset, section.copingBottomY]];
      for (const along of [-1.1, 0, 1.1]) for (const [out, y] of cuts) points.push([anchor.x - nx * out! + tx * along, y!, anchor.z - nz * out! + tz * along]);
    }
    const scope: Record<string, unknown> = { ...cameraRuntime, outlineBounds, focus: "waterline", outline, layout, skimmers, resolvedLayout, infinityZone: null, externalStairPlan: null, coverSubject: null,
      shelfLoungerEnvelope: [], ledRow: resolvedLayout.lighting.plan.positions, compactPlan: true, planBounds: outline, SCENE_VISUAL_PRESET, viewportSize: { width: vw, height: vh } };
    const preferred = evaluate(`(${current.aspect})()`, scope), mobile = capturedMobileUI[vw];
    const frame = mobile ? visibleCameraFrame(mobile.canvas, mobile.overlays.filter((_, i) => i !== 2).map((r, i) => i === 0 ? { ...r, height: 108 } : i === 1 ? { ...r, top: 132 } : r), preferred)
      : visibleCameraFrame({ left: 0, top: 0, width: 1440, height: 900 }, [{ left: 16, top: 12, width: 1408, height: 72 }, { left: 16, top: 96, width: 131.9140625, height: 36 }, { left: 1114.8515625, top: 447.5078125, width: 305.1484375, height: 40 }, { left: 130, top: 515.5078125, width: 1180, height: 368.4921875 }], preferred);
    scope.visibleFrame = frame; scope.localFraming = evaluate(current.local, scope); scope.detail = evaluate(current.detail, scope); scope.opticalDetail = evaluate(current.optical, scope); scope.fitFov = evaluate(current.fit, scope);
    const raw = getCameraPose({ intent: "waterline", outline, layout, depth: 1.5, skimmers, verticalFov: scope.fitFov as number, viewportAspect: frame.width / frame.height }), pose = !scope.localFraming && !scope.opticalDetail ? offsetCameraToFrame(raw, 34, vw, vh, frame) : raw;
    ok(pose.position[1] > layout.groundY && pose.position[1] > layout.waterY, `Waterline eye must remain physically above terrain/water: ${JSON.stringify({ size: [length, width], system, poolType, viewport: [vw, vh], raw, pose, frame, layout })}`);
    ok(pose.target[1] > layout.floorY, "The selected waterline target cannot fall under the actual basin floor");
    equal(pose, raw, "Waterline UI fitting cannot translate the physical camera below ground");
    equal(raw, hydraulic({ reference: { point: [anchor.x, anchor.z], inward: [nx, nz], tangent: [tx, tz] }, bounds, layout, verticalFov: 34, viewportAspect: frame.width / frame.height, overflow: false }), "Waterline reuses the exact proven inside-fitting hydraulic pose, not a new geometry or arbitrary camera");
    for (let sample = 0; sample <= 20; sample++) {
      const t = sample / 20, x = pose.position[0] * (1 - t) + pose.target[0] * t, z = pose.position[2] * (1 - t) + pose.target[2] * t;
      ok(x > bounds.minX && x < bounds.maxX && z > bounds.minZ && z < bounds.maxZ, "Actual eye-to-target ray stays inside the basin rather than traversing the opposite opaque wall");
    }
    const camera = new PerspectiveCamera(34, vw / vh, .05, 1000); camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true);
    Object.assign(scope, { camera, PerspectiveCamera, OrthographicCamera, canvas: { dataset: {} }, pose, planFit: { current: null }, coastalHero: false }); projectRuntime(scope);
    const project = () => { for (const point of points) { const world = new Vector3(...point), q = world.clone().project(camera), x = (q.x + 1) * vw / 2, y = (1 - q.y) * vh / 2;
      ok(q.z > -1 && q.z < 1 && x > frame.left && x < frame.left + frame.width && y > frame.top && y < frame.top + frame.height, `Real waterline/fitting/slot/grille construction is in the unobscured frame: ${JSON.stringify({ system, overflowType, skimmerType, size: [length, width], poolType, viewport: [vw, vh], point, pixel: [x, y], frame, pose })}`);
      ok(-world.applyMatrix4(camera.matrixWorldInverse).z < Math.hypot(length, width) / 2 * 6, "The real selected waterline construction remains before unchanged fogNear");
    } }; project(); ok(scope.localFraming && scope.fitFov === 34, "Only non-Infinity waterline owns the local34-degree physical lens");
    for (const previous of [undefined, false, true]) {
      if (previous !== undefined) (camera as PerspectiveCamera & { manual?: boolean }).manual = previous; else delete (camera as PerspectiveCamera & { manual?: boolean }).manual;
      const cleanup = evaluate(current.owner, scope)(), matrix = camera.projectionMatrix.toArray(), eye = camera.position.toArray(); updateCamera(camera, { width: vw, height: vh });
      equal(camera.projectionMatrix.toArray(), matrix, "Installed R3F camera resize cannot overwrite the waterline-owned inset matrix"); equal(camera.position.toArray(), eye, "Renderer updates do not move the waterline eye"); project(); cleanup?.(); equal((camera as PerspectiveCamera & { manual?: boolean }).manual, previous, "Exiting waterline restores the prior true/false/absent manual property");
    }
    for (const focus of ["access", "inox", "shelf", "hydromassage", "bench", "coping", "infinity", "features", "stair-lighting", "bench-lighting", "top", "depth", "review", "overview", "paving", "exterior-panel", "external-stairs", "pellicano", "liner", "mosaic", "overflow-hidden", "overflow-visible", "skimmer-detail", "cover"]) {
      const values = { ...scope, focus }; equal(evaluate(`(${current.aspect})()`, values), evaluate(`(${WATERLINE_Q_RIG.aspect})()`, values), "All other Q detail/overview/Top subject aspects remain unchanged"); equal(evaluate(current.local, values), evaluate(WATERLINE_Q_RIG.local, values), "All other Q lens ownership decisions remain unchanged");
    }
    if (poolType === "in-ground" && system === "skimmer" && skimmerType === "slim") for (const zone of infinityZonesForOutline(outline, "rectangle")) {
      const infLayout = getPoolVerticalLayout({ poolType, system: "infinity", depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness }), values = { ...scope, infinityZone: zone, layout: infLayout };
      // S explicitly supersedes only the old fixed +X Infinity WATERLINE
      // assumption. Bordo Infinity/overview remain protected separately;
      // the dedicated suite checks actual crest geometry and the UI lens.
      equal(evaluate(current.local, values), true, "Infinity waterline joins the proven local lens rather than reintroducing a below-grade WORLD shift");
      ok(Number.isFinite(evaluate(`(${current.aspect})()`, values)), "Selected Infinity crest supplies a real metric subject aspect");
      const reference = { point: [(zone.start[0] + zone.end[0]) / 2, (zone.start[1] + zone.end[1]) / 2], inward: [-zone.normal[0], -zone.normal[1]], tangent: [(zone.end[0] - zone.start[0]) / zone.length, (zone.end[1] - zone.start[1]) / zone.length] };
      equal(getCameraPose({ intent: "waterline", outline, layout: infLayout, depth: 1.5, skimmers, infinityZone: zone, verticalFov: 34, viewportAspect: frame.width / frame.height }), hydraulic({ reference, bounds, layout: infLayout, verticalFov: 34, viewportAspect: frame.width / frame.height, overflow: false }), "Rectangle Infinity waterline reuses the same hydraulic pose at the actual selected crest");
    }
    equal(JSON.stringify(config), before, "Waterline camera preserves material, geometry, lights, cover request and access configuration");
    if (length === 6 && poolType === "in-ground" && system === "skimmer" && skimmerType === "slim" && vw === 1440) console.log(`Waterline physical/inside-ray diagnostic, not wet visibility PASS: ${JSON.stringify({ frame, pose, layout, noWorldOffset: true })}`);
    cases.waterline++;
  }
}

if (enabled("overview") || section === "projection-exit") {
  const path = process.argv.includes("--candidate-o") ? "docs/fullscreen-qa-evidence/premium-live-cameras/PoolScene-o-before-q-20261015.tsx" : "src/components/pool/three/PoolScene.tsx";
  const tree = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const current = { aspect: "", local: "", detail: "", optical: "", fit: "", owner: "", projection: "" };
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const key = node.name.getText(tree), map = { localFraming: "local", detail: "detail", opticalDetail: "optical", fitFov: "fit" } as const;
      if (key in map) current[map[key as keyof typeof map]] = node.initializer.getText(tree);
      if (key === "subjectAspect" && ts.isCallExpression(node.initializer)) current.aspect = node.initializer.arguments[0]!.getText(tree);
    }
    if (ts.isCallExpression(node) && node.expression.getText(tree) === "useLayoutEffect" && node.arguments[0]) {
      const text = node.arguments[0].getText(tree);
      if (text.includes("owned.manual = true")) current.owner = text;
      if (text.includes('canvas.dataset["cameraProjection"]') && text.includes("goal.current.set") && ts.isArrowFunction(node.arguments[0]) && ts.isBlock(node.arguments[0].body)) {
        const statements = node.arguments[0].body.statements, stop = statements.findIndex(s => s.getText(tree).startsWith("goal.current.set"));
        current.projection = statements.slice(0, stop).map(s => s.getText(tree)).join("\n");
      }
    }
    ts.forEachChild(node, visit);
  }; visit(tree); ok(Object.values(current).every(Boolean), "Execute actual scoped ownership and full projection-prefix statements, not a handwritten camera approximation");
  const expressions = new Map<string, (scope: Record<string, unknown>) => any>();
  const evaluate = (text: string, scope: Record<string, unknown>) => {
    if (!expressions.has(text)) { const js = ts.transpileModule(`const result = (${text});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; expressions.set(text, new Function("scope", `with(scope){${js};return result;}`) as never); }
    return expressions.get(text)!(scope);
  };
  const projectionCode = ts.transpileModule(current.projection, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const applyProjection = (scope: Record<string, unknown>) => new Function("scope", `with(scope){${projectionCode}}`)(scope);
  const oldProjectionCode = ts.transpileModule(OVERVIEW_O_RIG.projection, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const oldProjection = (scope: Record<string, unknown>) => new Function("scope", `with(scope){${oldProjectionCode}}`)(scope);
  const oldFitCode = ts.transpileModule(OVERVIEW_O_FIT, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const previousFit = new Function("outlineBounds", "classifyOutlineCorners", `const DEFAULT_OVERVIEW_DIRECTION=[1.7,.7];${oldFitCode};return previousOverview;`)(outlineBounds, classifyOutlineCorners) as (args: Record<string, unknown>) => CameraPose;
  const fiberPath = "node_modules/@react-three/fiber/dist/events-156d8d12.esm.js", fiber = ts.createSourceFile(fiberPath, readFileSync(fiberPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let updateText = "", ortho = "", subscriberText = "";
  const readFiber = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "updateCamera") updateText = node.getText(fiber);
    if (ts.isVariableDeclaration(node) && node.name.getText(fiber) === "isOrthographicCamera" && node.initializer) ortho = node.initializer.getText(fiber);
    if (ts.isCallExpression(node) && node.expression.getText(fiber) === "rootStore.subscribe" && node.arguments[0]?.getText(fiber).includes("Resize camera and renderer")) subscriberText = node.arguments[0].getText(fiber);
    ts.forEachChild(node, readFiber);
  }; readFiber(fiber); ok(updateText && ortho && subscriberText, "The overview lifecycle executes actual installed R3F updateCamera and DPR/resize subscription");
  const update = new Function(`const isOrthographicCamera=${ortho};return(${updateText});`)();
  const subscribe = (state: unknown) => new Function("rootStore", "updateCamera", `let oldSize=rootStore.getState().size,oldDpr=rootStore.getState().viewport.dpr,oldCamera=rootStore.getState().camera;return(${subscriberText});`)({ getState: () => state }, update);
  const uiFor = (width: number, height: number, preferred?: number) => {
    const mobile = capturedMobileUI[width];
    if (!mobile) return frameFor(width, height, preferred);
    const overlays = mobile.overlays.filter((_, i) => i !== 2).map((rect, i) => i === 0 ? { ...rect, height: 108 } : i === 1 ? { ...rect, top: 132 } : rect);
    return visibleCameraFrame(mobile.canvas, overlays, preferred);
  };
  if (section === "projection-exit" || section === "all") for (const [width, height] of viewports) for (const previous of [undefined, false, true]) {
    const camera = new PerspectiveCamera(34, width / height, .05, 1000) as PerspectiveCamera & { manual?: boolean }; if (previous !== undefined) camera.manual = previous;
    const pavingAspect = componentCameraAspect([[-1.5, 0, -1.95], [-1.5, 0, -3.75], [1.5, 0, -1.95], [1.5, 0, -3.75]], [.55, 1.6, -1]);
    const scope: Record<string, unknown> = { PerspectiveCamera, OrthographicCamera, camera, canvas: { dataset: {} }, planFit: { current: null }, pose: { position: [0, 0, 0], target: [0, 0, -1] }, focus: "paving",
      SCENE_VISUAL_PRESET, viewportSize: { width, height }, visibleFrame: uiFor(width, height, pavingAspect), coastalHero: false, localFraming: true, opticalDetail: true };
    const cleanup = evaluate(current.owner, scope)(); applyProjection(scope);
    ok(camera.aspect !== width / height, "The exit regression really starts with an inset-owned aspect, not an already-correct full canvas");
    cleanup?.(); equal(camera.manual, previous, "Scoped ownership restores the actual prior true/false/absent value");
    // No renderer event is called between cleanup and the actual nonlocal
    // projection. This is distinct from the un-reproduced P paving blank.
    for (const focus of ["structure", "depth"]) {
      Object.assign(scope, { focus, localFraming: false, opticalDetail: false, visibleFrame: uiFor(width, height) }); applyProjection(scope);
      equal(camera.aspect, width / height, "Exiting local framing restores the CURRENT canvas aspect before any DPR/resize event");
      const expected = new PerspectiveCamera(34, width / height, .05, 1000);
      equal(camera.projectionMatrix.toArray(), expected.projectionMatrix.toArray(), "Actual nonlocal clearViewOffset projection exactly matches an ordinary full-canvas camera without waiting for R3F");
      equal(camera.view?.enabled, false, "Ordinary nonlocal projection clears the previous inset");
    }
    const resized = { ...scope, viewportSize: { width: width + 40, height: height + 88 }, visibleFrame: uiFor(width + 40, height + 88) }; applyProjection(resized);
    equal(camera.aspect, (width + 40) / (height + 88), "Exit uses the new canvas dimensions, never a stale aspect captured before resizing");
    const plan = new OrthographicCamera(-4, 4, 3, -3, .1, 1000), oldMatrix = plan.projectionMatrix.toArray();
    applyProjection({ ...scope, camera: plan, focus: "top" }); equal(plan.projectionMatrix.toArray(), oldMatrix, "Perspective aspect restoration cannot alter orthographic Top");
  }
  if (enabled("overview")) for (const [length, width] of process.argv.includes("--mobile-repro") ? [[6, 3] as const] : sizes) {
    const fixtures: PoolConfig[] = [];
    for (const [system, overflowType] of [["skimmer", "hidden"], ["overflow", "hidden"], ["overflow", "visible"]] as const) fixtures.push({ ...base, structure: "modular-steel-panels", dimensions: { ...base.dimensions, length, width }, system, overflowType, internalStairType: "corner", equipment: ["automaticCover"], coverPosition: "closed", coverExtension: 1 });
    fixtures.push({ ...fixtures[0]!, features: ["inoxLadder"] });
    for (const side of ["long", "short"] as const) fixtures.push({ ...base, dimensions: { ...base.dimensions, length, width }, poolType: "above-ground", structure: "modular-steel-panels", features: ["externalStaircase"], externalStairSide: side, externalStairPlatformExtended: true });
    if (process.argv.includes("--mobile-repro")) fixtures.splice(0, fixtures.length, fixtures.find(c => c.features.includes("inoxLadder"))!);
    for (const fixture of fixtures) {
      const config = freeze(fixture), before = JSON.stringify(config), outline = buildOutline(config.shape, config.dimensions, []), resolvedLayout = configuredPoolLayout(config), layout = getPoolVerticalLayout({ poolType: config.poolType ?? "in-ground", system: config.system, overflowType: config.overflowType, depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
      const coverPlan = resolveAutomaticCover(config), coverSubject = cameraRuntime.coverCameraSubject(coverPlan, layout, outline, copingOuterOffset(config.system, config.overflowType));
      if (config.features.includes("inoxLadder")) { equal(coverPlan.status, "UNAVAILABLE", "The actual requested-cover+inox fixture preserves existing product compatibility"); equal(coverPlan.geometry, null, "No phantom cover housing is invented for the overview fit"); }
      const skimmers = planSkimmers(outline, length * width, true), bounds = outlineBounds(outline), points: CameraPoint[] = [];
      for (const x of [bounds.minX - 1.6, bounds.maxX + 1.6]) for (const z of [bounds.minZ - 1.6, bounds.maxZ + 1.6]) for (const y of [layout.floorY, layout.copingY]) points.push([x, y, z]);
      const visibleOverflow = config.system === "overflow" && config.overflowType === "visible", concealed = concealedOverflowSection(layout.wallTopY, POOL_BORDER_PRESET.thickness);
      const rimTop = config.system !== "overflow" ? layout.copingY : visibleOverflow ? layout.wallTopY + OVERFLOW_GEOMETRY.visibleGrateTopOffset : concealed.copingTopY;
      const wallOffset = config.poolType === "above-ground" ? claddingFaceOffset(copingOuterOffset(config.system, config.overflowType)) : visibleOverflow ? OVERFLOW_GEOMETRY.visibleChannelOuterOffset + .025 : ABOVE_GROUND_STRUCTURE_THICKNESS;
      const real: CameraPoint[] = offsetOutline(outline, copingOuterOffset(config.system, config.overflowType)).map(([x, z]) => [x, rimTop, z]);
      real.push(...offsetOutline(outline, wallOffset).flatMap(([x, z]) => [layout.floorY, layout.wallTopY].map(y => [x, y, z] as CameraPoint)));
      if (resolvedLayout.access) real.push(...stairConstructionPoints(resolvedLayout.access, layout.copingY));
      if (resolvedLayout.ladder?.plan) real.push(...ladderConstructionPoints(resolvedLayout.ladder.plan, outline));
      if (coverPlan.geometry) for (const x of [coverPlan.housingX - .135, coverPlan.housingX + .135]) for (const z of [coverPlan.footprint.minZ - .075, coverPlan.footprint.maxZ + .075]) for (const y of [coverPlan.housingY - .11, coverPlan.housingY + .111]) real.push([x, y, z]);
      const externalStairPlan = config.features.includes("externalStaircase") ? planExternalStaircase({ outline, side: config.externalStairSide!, platformExtended: config.externalStairPlatformExtended, accessAnchor: resolvedLayout.lighting.accessPlan.placement,
        copingOffset: copingOuterOffset(config.system, config.overflowType), groundY: layout.groundY, topY: layout.copingY }) : null;
      if (externalStairPlan) { const g = createExternalStairEnclosureGeometry(externalStairPlan), attr = g.getAttribute("position"), mesh = new Mesh(g); mesh.position.set(externalStairPlan.x, layout.groundY, externalStairPlan.z); mesh.rotation.y = externalStairPlan.rotation; mesh.updateMatrixWorld(true);
        for (let i = 0; i < attr.count; i++) real.push(new Vector3().fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld).toArray() as CameraPoint); g.dispose(); }
      for (const intent of process.argv.includes("--mobile-repro") ? ["review" as const] : ["review", "overview"] as const) for (const [vw, vh] of process.argv.includes("--mobile-repro") ? [[430, 932] as const] : viewports) {
        const scope: Record<string, unknown> = { ...cameraRuntime, outlineBounds, PerspectiveCamera, OrthographicCamera, focus: intent, outline, layout, resolvedLayout, skimmers, coverSubject, externalStairPlan, infinityZone: null,
          compactPlan: true, planBounds: outline, shelfLoungerEnvelope: [], ledRow: resolvedLayout.lighting.plan.positions, SCENE_VISUAL_PRESET, viewportSize: { width: vw, height: vh }, coastalHero: false, canvas: { dataset: {} }, planFit: { current: null } };
        const preferred = evaluate(`(${current.aspect})()`, scope), frame = uiFor(vw, vh, preferred); scope.visibleFrame = frame;
        scope.detail = evaluate(current.detail, scope); scope.localFraming = evaluate(current.local, scope); scope.opticalDetail = evaluate(current.optical, scope); scope.fitFov = evaluate(current.fit, scope);
        const args = { intent, outline, layout, depth: 1.5, skimmers, verticalFov: scope.fitFov as number, viewportAspect: frame.width / frame.height }, raw = getCameraPose(args);
        equal(raw, previousFit(args), "Q preserves the exact existing whole-pool points/order/target/radius2/coefficient1.05 fit rather than inventing another overview");
        const pose = !scope.localFraming && !scope.opticalDetail ? offsetCameraToFrame(raw, 34, vw, vh, frame) : raw;
        const camera = new PerspectiveCamera(34, vw / vh, .05, 1000); Object.assign(scope, { camera, pose }); camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true); applyProjection(scope);
        const near = Math.hypot(length, width) / 2 * 6;
        const project = (cam: PerspectiveCamera, W: number, H: number, free: Rect) => { for (const point of [...points, ...real]) {
          const world = new Vector3(...point), q = world.clone().project(cam), x = (q.x + 1) * W / 2, y = (1 - q.y) * H / 2;
          ok(q.z > -1 && q.z < 1 && x > free.left && x < free.left + free.width && y > free.top && y < free.top + free.height, "The real whole configured pool/accessories and original whole-pool subject fit the unobscured review frame");
          // The eight legacy fit columns include points1.6m outside the
          // shell at floor depth, below the lawn. They must fit the frustum,
          // but only actual selected construction is a visible fog subject.
          if (real.includes(point)) {
            const depth = -world.applyMatrix4(cam.matrixWorldInverse).z;
            ok(depth < near, `Real configured pool/accessory stays before unchanged fogNear: ${JSON.stringify({ size: [length, width], poolType: config.poolType, system: config.system, overflowType: config.overflowType, intent, viewport: [vw, vh], point, depth, near, pose, frame })}`);
          }
        } }; project(camera, vw, vh, frame);
        ok(scope.localFraming && scope.fitFov === 34, "Only non-Infinity review/overview uses the existing physical34-degree lens and optical UI inset");
        equal(preferred, componentCameraAspect(points, [1.7, .9, .7]), "Whole-pool frame selection is derived from the existing real metric bounds");
        for (const previous of [undefined, false, true]) {
          if (previous !== undefined) (camera as PerspectiveCamera & { manual?: boolean }).manual = previous; else delete (camera as PerspectiveCamera & { manual?: boolean }).manual;
          const cleanup = evaluate(current.owner, scope)(), matrix = camera.projectionMatrix.toArray(), eye = camera.position.toArray();
          let resized = 0; const state = { camera, size: { width: vw, height: vh }, viewport: { dpr: 1 }, gl: { domElement: {}, setPixelRatio() {}, setSize() { resized++; } }, set() { throw Error("No replacement camera"); } }, resize = subscribe(state);
          for (const dpr of [1.5, 1]) { state.viewport.dpr = dpr; resize(); equal(camera.projectionMatrix.toArray(), matrix, "Actual R3F DPR/idle callback cannot overwrite the settled whole-pool local lens"); equal(camera.position.toArray(), eye, "DPR changes do not move the eye"); project(camera, vw, vh, frame); }
          cleanup?.(); equal((camera as PerspectiveCamera & { manual?: boolean }).manual, previous, "Review scope restores prior ownership when it exits");
          equal(resized, 2, "The renderer's legitimate DPR/size callbacks remain enabled");
        }
        // Full-canvas PhotoMode/clean capture retains its exact O camera pose
        // and projection. No customer geometry or export is changed to fit UI.
        const fullFrame = { left: 0, top: 0, width: vw, height: vh }, fullArgs = { ...args, verticalFov: 34, viewportAspect: vw / vh }, fullPose = getCameraPose(fullArgs);
        equal(fullPose, previousFit(fullArgs), "Full-canvas photographic/clean capture retains the pre-Q pose exactly");
        const photo = new PerspectiveCamera(34, vw / vh, .05, 1000), oldPhoto = photo.clone(), fullScope = { ...scope, camera: photo, pose: fullPose, visibleFrame: fullFrame, photoMode: true };
        applyProjection(fullScope); oldProjection({ ...fullScope, camera: oldPhoto, localFraming: false, opticalDetail: false }); equal(photo.projectionMatrix.toArray(), oldPhoto.projectionMatrix.toArray(), "Full-canvas PhotoMode projection remains identical to pre-Q");
        equal(JSON.stringify(config), before, "Review and all lifecycle/capture checks preserve selected configuration, cover request and optional compatibility");
        if (length === 6 && config.features.includes("inoxLadder") && intent === "review" && vw === 430) console.log(`Review physical/frame diagnostic, not a visual PASS: ${JSON.stringify({ frame, pose, distance: new Vector3(...pose.position).distanceTo(new Vector3(...pose.target)), depth: real.map(p => -new Vector3(...p).applyMatrix4(camera.matrixWorldInverse).z).reduce(([lo, hi], d) => [Math.min(lo!, d), Math.max(hi!, d)], [Infinity, -Infinity]), fogNear: near, unavailableCoverHasGeometry: !!coverPlan.geometry })}`);
        cases.overview++;
      }
      for (const focus of ["access", "inox", "shelf", "hydromassage", "bench", "coping", "infinity", "features", "stair-lighting", "bench-lighting", "top", "depth", "paving", "exterior-panel", "external-stairs", "pellicano", "liner", "mosaic", "overflow-hidden", "overflow-visible", "skimmer-detail", "cover"]) {
        const scope = { ...cameraRuntime, outlineBounds, focus, outline, layout, skimmers, resolvedLayout, coverSubject, externalStairPlan, infinityZone: null, compactPlan: true, planBounds: outline, shelfLoungerEnvelope: [], ledRow: resolvedLayout.lighting.plan.positions };
        equal(evaluate(`(${current.aspect})()`, scope), evaluate(`(${OVERVIEW_O_RIG.aspect})()`, scope), "Other detail/Top metric subjects retain the exact pre-Q aspect"); equal(evaluate(current.local, scope), evaluate(OVERVIEW_O_RIG.local, scope), "Other camera intents retain the exact pre-Q local ownership decision");
      }
      for (const zone of infinityZonesForOutline(outline, "rectangle")) for (const focus of ["review", "overview"] as const) {
        const scope = { ...cameraRuntime, focus, infinityZone: zone, coverSubject, externalStairPlan, outline, layout, skimmers, resolvedLayout };
        equal(evaluate(current.local, scope), false, "The approved Infinity overview never enters the new non-Infinity local branch"); equal(evaluate(`(${current.aspect})()`, scope), evaluate(`(${OVERVIEW_O_RIG.aspect})()`, scope), "Infinity retains its original coastal composition and aspect selection");
        for (const [W, H] of viewports) {
          const a = new PerspectiveCamera(34, 1.25, .05, 1000), b = a.clone(), values = { ...scope, PerspectiveCamera, OrthographicCamera, canvas: { dataset: {} }, planFit: { current: null },
            pose: { position: [0, 0, 0], target: [0, 0, -1] }, viewportSize: { width: W, height: H }, visibleFrame: uiFor(W, H), SCENE_VISUAL_PRESET, localFraming: false, opticalDetail: false, coastalHero: true };
          applyProjection({ ...values, camera: a }); oldProjection({ ...values, camera: b });
          equal(a.projectionMatrix.toArray(), b.projectionMatrix.toArray(), "Actual Infinity coastal projection is bit-for-bit pre-Q, including arrival from a previously inset lens");
          equal(a.view, b.view, "Infinity coastal crop/frame remains the pre-Q photographic fit");
        }
      }
    }
  }
}

if (enabled("paving")) {
  const rigPath = process.argv.includes("--candidate-m") ? "docs/fullscreen-qa-evidence/premium-live-cameras/PoolScene-m-before-o-20261015.tsx" : "src/components/pool/three/PoolScene.tsx";
  const tree = ts.createSourceFile(rigPath, readFileSync(rigPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const expr: Record<string, string> = {}; let aspectText = "", ownerText = "", ownerDeps = "", localView: string[] = [], opticalView: string[] = [], fogArgs: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ["detail", "localFraming", "opticalDetail", "fitFov"].includes(node.name.getText(tree)) && node.initializer) expr[node.name.getText(tree)] = node.initializer.getText(tree);
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "subjectAspect" && node.initializer && ts.isCallExpression(node.initializer)) aspectText = node.initializer.arguments[0]!.getText(tree);
    if (ts.isCallExpression(node) && node.expression.getText(tree) === "useLayoutEffect" && node.arguments[0]?.getText(tree).includes("owned.manual = true")) { ownerText = node.arguments[0].getText(tree); ownerDeps = node.arguments[1]!.getText(tree); }
    if (ts.isIfStatement(node) && ["localFraming", "opticalDetail"].includes(node.expression.getText(tree)) && ts.isBlock(node.thenStatement)) {
      const statement = node.thenStatement.statements.find(s => ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && s.expression.expression.getText(tree) === "camera.setViewOffset") as ts.ExpressionStatement;
      if (statement) { const args = (statement.expression as ts.CallExpression).arguments.map(a => a.getText(tree)); if (node.expression.getText(tree) === "localFraming") localView = args; else opticalView = args; }
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "fog") {
      const attr = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(tree) === "args") as ts.JsxAttribute;
      fogArgs = ((attr.initializer as ts.JsxExpression).expression as ts.ArrayLiteralExpression).elements.slice(1).map(a => a.getText(tree));
    }
    ts.forEachChild(node, visit);
  }; visit(tree);
  ok(aspectText && ownerText && ownerDeps && localView.length === 6 && opticalView.length === 6 && fogArgs.length === 2, "Read actual paving CameraRig callback, both projection branches, scoped ownership and scene fog");
  const executables = new Map<string, (scope: Record<string, unknown>) => any>();
  const evaluate = (text: string, scope: Record<string, unknown>) => {
    if (!executables.has(text)) { const js = ts.transpileModule(`const value = (${text});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; executables.set(text, new Function("scope", `with(scope) { ${js}; return value; }`) as never); }
    return executables.get(text)!(scope);
  };
  const ownerCode = ts.transpileModule(`const owner = ${ownerText};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const ownership = (camera: PerspectiveCamera, localFraming: boolean): undefined | (() => void) => new Function("camera", "localFraming", "PerspectiveCamera", `${ownerCode}; return owner();`)(camera, localFraming, PerspectiveCamera);
  const fiberPath = "node_modules/@react-three/fiber/dist/events-156d8d12.esm.js", fiber = ts.createSourceFile(fiberPath, readFileSync(fiberPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let updateText = "", ortho = "", subscriberText = "";
  const readFiber = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "updateCamera") updateText = node.getText(fiber);
    if (ts.isVariableDeclaration(node) && node.name.getText(fiber) === "isOrthographicCamera" && node.initializer) ortho = node.initializer.getText(fiber);
    if (ts.isCallExpression(node) && node.expression.getText(fiber) === "rootStore.subscribe" && node.arguments[0]?.getText(fiber).includes("Resize camera and renderer")) subscriberText = node.arguments[0].getText(fiber);
    ts.forEachChild(node, readFiber);
  }; readFiber(fiber);
  ok(updateText && ortho && subscriberText, "Execute installed R3F camera and renderer DPR/size callback, not a source-regex proxy");
  const update = new Function(`const isOrthographicCamera = ${ortho}; return (${updateText});`)();
  const subscribe = (state: unknown) => new Function("rootStore", "updateCamera", `let oldSize=rootStore.getState().size,oldDpr=rootStore.getState().viewport.dpr,oldCamera=rootStore.getState().camera; return (${subscriberText});`)({ getState: () => state }, update);
  const fixtures = process.argv.includes("--mobile-repro") ? [[6, 3, "in-ground", "skimmer", "hidden", 390, 844] as const] : sizes.flatMap(([length, width]) => (["in-ground", "above-ground"] as const).flatMap(poolType =>
    ([["skimmer", "hidden"], ["overflow", "hidden"], ["overflow", "visible"]] as const).flatMap(([system, overflowType]) => viewports.map(([vw, vh]) => [length, width, poolType, system, overflowType, vw, vh] as const))));
  for (const [length, width, poolType, system, overflowType, vw, vh] of fixtures) {
    const config = freeze({ ...base, structure: "modular-steel-panels" as const, dimensions: { ...base.dimensions, length, width }, poolType, system, overflowType,
      skimmerType: "slim" as const, internalStairType: "corner" as const, features: poolType === "in-ground" ? ["inoxLadder"] as const : [], copingMaterial: "prun" as const, paving: "travertine" as const, pavingFormat: "60x120" as const });
    const before = JSON.stringify(config), outline = buildOutline(config.shape, config.dimensions, []), resolvedLayout = configuredPoolLayout(config), layout = getPoolVerticalLayout({ poolType, system, overflowType, depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
    const skimmers = planSkimmers(outline, length * width, true), reference = skimmers.positions[Math.floor(skimmers.positions.length / 2)]!;
    ok(reference, "The real engineering plan supplies a boundary reference, not a fabricated pool-centre patch");
    const nx = Math.sin(reference.rotation), nz = Math.cos(reference.rotation), tx = nz, tz = -nx, points: CameraPoint[] = [];
    for (const along of [-1.5, 1.5]) for (const outward of [.45, 2.25]) points.push([reference.x - nx * outward + tx * along, layout.groundY, reference.z - nz * outward + tz * along]);
    const direction: CameraPoint = [-nx + tx * .55, 1.6, -nz + tz * .55];
    const scope: Record<string, unknown> = { ...cameraRuntime, outlineBounds, focus: "paving", outline, layout, skimmers, resolvedLayout, infinityZone: null, coverSubject: null, externalStairPlan: null,
      shelfLoungerEnvelope: [], ledRow: resolvedLayout.lighting.plan.positions, SCENE_VISUAL_PRESET, compactPlan: true, planBounds: outline };
    const preferred = evaluate(`(${aspectText})()`, scope), mobile = capturedMobileUI[vw];
    // Actual N390 capture has no construction badge.430 uses the separately
    // captured same-size mobile controls; desktop remains a deterministic
    // UI fixture, not a claim to have captured N1440's missing DOM dump.
    const overlays = mobile?.overlays.filter((_, i) => i !== 2).map((rect, i) => i === 0 ? { ...rect, height: 108 } : i === 1 ? { ...rect, top: 132 } : rect);
    const frame = mobile ? visibleCameraFrame(mobile.canvas, overlays!, preferred) : frameFor(vw, vh, preferred);
    Object.assign(scope, { visibleFrame: frame, viewportSize: { width: vw, height: vh } });
    for (const name of ["detail", "localFraming", "opticalDetail", "fitFov"]) scope[name] = evaluate(expr[name]!, scope);
    const pose = getCameraPose({ intent: "paving", outline, layout, depth: 1.5, skimmers, verticalFov: scope.fitFov as number, viewportAspect: frame.width / frame.height });
    equal(pose, fitComponentCamera(points, direction, scope.fitFov as number, frame.width / frame.height), "Production paving pose still fits the identical real3×1.8m patch and original direction: no material/geometry workaround");
    const radius = Math.hypot(length, width) / 2, [near] = fogArgs.map(arg => evaluate(arg, { radius })), args = (scope.localFraming ? localView : opticalView).map(arg => evaluate(arg, scope));
    const camera = new PerspectiveCamera(34, vw / vh, .05, 1000); camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true); camera.setViewOffset(args[0], args[1], args[2], args[3], args[4], args[5]);
    const project = (cam: PerspectiveCamera, width: number, height: number, frame: Rect) => { for (const point of points) {
      const world = new Vector3(...point), q = world.clone().project(cam), x = (q.x + 1) * width / 2, y = (1 - q.y) * height / 2;
      ok(q.z > -1 && q.z < 1 && x > frame.left + frame.width * .02 && x < frame.left + frame.width * .98 && y > frame.top + frame.height * .02 && y < frame.top + frame.height * .98, "The real paving patch remains inside the actual UI-adjusted optical frustum");
      ok(-world.applyMatrix4(cam.matrixWorldInverse).z < near, "Selected paving geometry stays in front of actual unchanged fogNear: projected-inside alone cannot certify legibility");
    } }; project(camera, vw, vh, frame);
    ok(scope.localFraming && scope.fitFov === 34, "Only the selected non-Infinity paving detail uses the existing physical34-degree lens");
    equal(preferred, componentCameraAspect(points, direction), "Actual Rig frame selection uses the same metric surface patch, not a whole-pool aspect");
    const snapshot = toProjectConfiguration("paving-camera-lifecycle", config, { areas: [], currentFinish: "liner", filtrationWorks: [], replaceCoping: null, copingMaterial: "", structureIssues: [], equipmentUpgrades: [] }), link = { publicRef: "PW-AAAA-AAAAAA", savedSnapshot: serializeProjectConfiguration(snapshot) };
    for (const previous of [undefined, false, true]) {
      const owned = camera.clone() as PerspectiveCamera & { manual?: boolean }; if (previous !== undefined) owned.manual = previous;
      const cleanup = ownership(owned, !!scope.localFraming), matrix = owned.projectionMatrix.toArray(), eye = owned.position.toArray();
      equal(evaluate(ownerDeps, { camera: owned, localFraming: true }), [owned, true], "Paving ownership observes only camera/local scope, not material changes, DPR or another flight");
      let rendered = 0; const state = { camera: owned, size: { width: vw, height: vh }, viewport: { dpr: 1 }, gl: { domElement: {}, setPixelRatio() {}, setSize() { rendered++; } }, set() { throw new Error("No new camera expected"); } }, resize = subscribe(state);
      for (const dpr of [1.5, 1]) { state.viewport.dpr = dpr; resize(); equal(owned.projectionMatrix.toArray(), matrix, "The installed R3F idle/DPR callback preserves the actual local paving projection"); equal(owned.position.toArray(), eye, "DPR quality changes cannot create a physical camera flight"); project(owned, vw, vh, frame); }
      state.size = { width: vw + 40, height: vh + 88 }; resize(); equal(owned.projectionMatrix.toArray(), matrix, "R3F resize cannot overwrite the owned lens before CameraRig receives the new frame"); equal(rendered, 3, "Paving's ownership does not suppress renderer DPR/size updates");
      const nextFrame = frameFor(state.size.width, state.size.height, preferred), nextScope = { ...scope, visibleFrame: nextFrame, viewportSize: state.size }, nextArgs = localView.map(arg => evaluate(arg, nextScope));
      owned.setViewOffset(nextArgs[0], nextArgs[1], nextArgs[2], nextArgs[3], nextArgs[4], nextArgs[5]); const next = getCameraPose({ intent: "paving", outline, layout, depth: 1.5, skimmers, verticalFov: 34, viewportAspect: nextFrame.width / nextFrame.height });
      owned.position.set(...next.position); owned.lookAt(new Vector3(...next.target)); owned.updateMatrixWorld(true); project(owned, state.size.width, state.size.height, nextFrame);
      cleanup?.(); equal(owned.manual, previous, "Exiting paving restores the previous undefined/false/true manual ownership"); equal(Object.hasOwn(owned, "manual"), previous !== undefined, "Paving cannot leak ownership to another camera");
      equal(JSON.stringify(config), before, "Camera, idle, DPR and resize leave dimensions, material format, access and optional selections untouched"); equal(projectLinkIsDirty(link, toProjectConfiguration(snapshot.projectId, config, snapshot.renovation)), false, "Paving-only camera work cannot create a false unsaved snapshot");
    }
    if (length === 6 && width === 3 && poolType === "in-ground" && system === "skimmer" && vw === 390) console.log(`Paving physical/frustum diagnostic, not texture PASS: ${JSON.stringify({ frame, pose, physicalDistance: new Vector3(...pose.position).distanceTo(new Vector3(...pose.target)), viewDepth: points.map(p => -new Vector3(...p).applyMatrix4(camera.matrixWorldInverse).z), fogNear: near })}`);
    // Every other branch retains M's actual aspect/ownership expression;
    // Infinity paving explicitly stays on its prior optical fitting.
    for (const focus of ["access", "inox", "shelf", "hydromassage", "bench", "coping", "infinity", "features", "stair-lighting", "bench-lighting", "top", "depth", "review", "overview", "exterior-panel", "external-stairs", "pellicano", "liner", "mosaic", "overflow-hidden", "overflow-visible", "skimmer-detail", "cover"]) {
      const values = { ...scope, focus };
      const reviewHelper = Reflect.get(cameraRuntime, "overviewCameraSubject"), review = ["review", "overview"].includes(focus) && typeof reviewHelper === "function" ? reviewHelper(outline, layout) : null;
      equal(evaluate(`(${aspectText})()`, values), review ? componentCameraAspect(review.points, review.direction) : evaluate(`(${PAVING_M_RIG.aspect})()`, values), "Non-paving branches retain approved aspects, including the explicit Q non-Infinity overview subject");
      equal(evaluate(expr.localFraming!, values), review ? true : evaluate(PAVING_M_RIG.local, values), "Non-paving branches retain approved lens ownership, including Q non-Infinity review");
    }
    if (poolType === "in-ground" && system === "skimmer") for (const zone of infinityZonesForOutline(outline, "rectangle")) {
      const infinityLayout = getPoolVerticalLayout({ poolType: "in-ground", system: "infinity", depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
      const values = { ...scope, infinityZone: zone, layout: infinityLayout };
      equal(evaluate(`(${aspectText})()`, values), evaluate(`(${PAVING_M_RIG.aspect})()`, values), "All four Infinity paving orientations keep their actual pre-O aspect callback result"); equal(evaluate(expr.localFraming!, values), false, "Infinity paving is not routed into the new local lens branch");
      const oldFrame = frameFor(vw, vh), fit = cameraFrameFit(34, vh, oldFrame);
      equal(getCameraPose({ intent: "paving", outline, layout: infinityLayout, depth: 1.5, skimmers, infinityZone: zone, verticalFov: fit.verticalFov, viewportAspect: fit.aspect }), fitComponentCamera(points.map(([x, , z]) => [x, infinityLayout.groundY, z]), direction, fit.verticalFov, fit.aspect), "Infinity paving retains exactly the pre-O real patch pose and fit, not a new camera");
    }
    const panelPoints: CameraPoint[] = []; for (const along of [-1.4, 1.4]) for (const y of [layout.groundY, layout.copingY + .08]) panelPoints.push([reference.x - nx * .18 + tx * along, y, reference.z - nz * .18 + tz * along]);
    const oldFit = cameraFrameFit(34, vh, frameFor(vw, vh)); equal(getCameraPose({ intent: "exterior-panel", outline, layout, depth: 1.5, skimmers, verticalFov: oldFit.verticalFov, viewportAspect: oldFit.aspect }), fitComponentCamera(panelPoints, [-nx + tx * .35, .32, -nz + tz * .35], oldFit.verticalFov, oldFit.aspect), "Exterior-panel pose remains precisely the old real panel subject and direction");
    cases.paving++;
  }
}

if (enabled("top")) {
  const originalScenePath = "docs/fullscreen-qa-evidence/premium-live-cameras/PoolScene-l-before-m-20261015.tsx";
  const parseRig = (path: string) => {
    const source = readFileSync(path, "utf8"), tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const result = { bounds: "", aspect: "", compact: "false", frustumArgs: [] as string[], orthoBody: "", upBody: "", pose: "", planView: "", planCamera: "" };
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ["planBounds", "subjectAspect"].includes(node.name.getText(tree)) && node.initializer && ts.isCallExpression(node.initializer)) result[node.name.getText(tree) === "planBounds" ? "bounds" : "aspect"] = node.initializer.arguments[0]!.getText(tree);
      if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "planView" && node.initializer) result.planView = node.initializer.getText(tree);
      if (ts.isJsxAttribute(node) && node.name.getText(tree) === "compactPlan" && node.initializer && ts.isJsxExpression(node.initializer)) result.compact = node.initializer.expression!.getText(tree);
      if (ts.isCallExpression(node) && node.expression.getText(tree) === "architecturalFrustum") result.frustumArgs = node.arguments.map(a => a.getText(tree));
      if (ts.isIfStatement(node) && node.expression.getText(tree) === "camera instanceof OrthographicCamera && planFit.current") result.orthoBody = node.thenStatement.getText(tree);
      if (ts.isBinaryExpression(node) && node.left.getText(tree) === "pose" && ts.isObjectLiteralExpression(node.right) && node.right.getText(tree).includes("layout.copingY + 30")) result.pose = node.right.getText(tree);
      if (ts.isFunctionDeclaration(node) && node.name?.text === "PlanCamera") {
        result.planCamera = node.getText(tree);
        const findUp = (n: ts.Node) => { if (ts.isExpressionStatement(n) && n.getText(tree).startsWith("plan.up.set(")) result.upBody = n.getText(tree); ts.forEachChild(n, findUp); }; findUp(node);
      }
      ts.forEachChild(node, visit);
    }; visit(tree); return result;
  };
  const original = TOP_L_RIG, current = parseRig(process.argv.includes("--candidate-l") ? originalScenePath : "src/components/pool/three/PoolScene.tsx");
  const executableExpressions = new Map<string, (scope: Record<string, unknown>) => any>();
  const evalScope = (expression: string, scope: Record<string, unknown>) => {
    if (!executableExpressions.has(expression)) {
      const code = ts.transpileModule(`const result = (${expression});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      executableExpressions.set(expression, new Function("scope", `with(scope) { ${code}; return result; }`) as never);
    }
    return executableExpressions.get(expression)!(scope);
  };
  const legacyCode = ts.transpileModule(TOP_L_FRUSTUM.replace(/^export\s+/, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const legacyFrustum = new Function(`${legacyCode}; return architecturalFrustum;`)();
  const actualPlanPath = process.argv.includes("--candidate-l") ? "docs/fullscreen-qa-evidence/premium-live-cameras/architectural-plan-l-before-m-20261015.ts" : "src/components/pool/three/architecturalPlan.ts";
  const actualPlanTree = ts.createSourceFile(actualPlanPath, readFileSync(actualPlanPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const edgeText = (tree: ts.SourceFile) => tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "architecturalEdges")!.getText(tree);
  equal(createHash("sha256").update(edgeText(actualPlanTree)).digest("hex"), TOP_L_EDGES_SHA256, "Top framing cannot alter the actual architectural boundary extraction function");
  equal(current.planCamera, original.planCamera, "The real orthographic camera ownership, up vector and restoration lifecycle are unchanged");
  equal(current.planView, original.planView, "Actual PhotoMode exclusion from architectural plan remains unchanged");
  for (const photoMode of [false, true]) for (const focus of ["top", "review", "overview", "cover", "infinity", "access"]) equal(evalScope(current.planView, { focus, photoMode }), focus === "top" && !photoMode, "Only the existing top control, never PhotoMode or another intent, enables plan outlines");
  ok(current.bounds && current.aspect && current.orthoBody && current.pose && current.upBody && current.frustumArgs.length >= 4, "Execute actual Scene plan-bounds/aspect/frustum and orthographic projection statements");
  // All nonzero occluders measured by B on the same candidate-L configuration,
  // not inferred from an earlier phase's differently sized summary panel.
  const topUI: Record<number, { canvas: Rect; overlays: Rect[] }> = {
    1440: { canvas: { left: 0, top: 0, width: 1440, height: 900 }, overlays: [
      { left: 16, top: 12, width: 1408, height: 72 }, { left: 16, top: 96, width: 131.9140625, height: 36 },
      { left: 1114.8515625, top: 447.5078125, width: 305.1484375, height: 40 }, { left: 130, top: 515.5078125, width: 1180, height: 368.4921875 },
    ] },
    ...Object.fromEntries([390, 430].map(width => [width, { canvas: capturedMobileUI[width]!.canvas,
      overlays: capturedMobileUI[width]!.overlays.filter((_, i) => i !== 2).map((rect, i) => i === 0 ? { ...rect, height: 108 } : i === 1 ? { ...rect, top: 132 } : rect) }])),
  };
  const measurements: unknown[] = [];
  for (const [length, width] of sizes) {
    const fixtures: PoolConfig[] = [];
    for (const [system, overflowType] of [["skimmer", "hidden"], ["overflow", "hidden"], ["overflow", "visible"]] as const) for (const cover of [false, true]) fixtures.push({ ...base, structure: "modular-steel-panels", dimensions: { ...base.dimensions, length, width }, system, overflowType, internalStairType: "corner", equipment: cover ? ["automaticCover"] : [], coverPosition: "closed", coverExtension: 1 });
    const plainOutline = buildOutline(base.shape, { ...base.dimensions, length, width }, []);
    for (const zone of infinityZonesForOutline(plainOutline, "rectangle")) fixtures.push({ ...base, dimensions: { ...base.dimensions, length, width }, system: "infinity", infinityEdge: { enabled: true, side: zone.side, startT: 0, endT: 1, dropDirection: "outward" }, internalStairType: "corner" });
    for (const side of ["long", "short"] as const) fixtures.push({ ...base, dimensions: { ...base.dimensions, length, width }, poolType: "above-ground", structure: "modular-steel-panels", features: ["externalStaircase"], externalStairSide: side, externalStairPlatformExtended: true });
    for (const fixture of fixtures) {
      const config = freeze(fixture), before = JSON.stringify(config), outline = buildOutline(config.shape, config.dimensions, []), resolved = configuredPoolLayout(config);
      const layout = getPoolVerticalLayout({ poolType: config.poolType ?? "in-ground", system: config.system, overflowType: config.overflowType, depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
      const infinityZone = config.system === "infinity" ? infinityZonesForOutline(outline, "rectangle").find(z => z.side === config.infinityEdge!.side)! : null;
      const infinityExcluded = infinityZone ? new Set(Array.from({ length: infinityZone.points.length - 1 }, (_, i) => (infinityZone.side + i) % outline.length)) : null;
      const coverPlan = resolveAutomaticCover(config), coverSubject = cameraRuntime.coverCameraSubject(coverPlan, layout, outline, copingOuterOffset(config.system, config.overflowType));
      const externalStairs = config.poolType === "above-ground" && config.features.includes("externalStaircase");
      const externalStairPlan = externalStairs ? planExternalStaircase({ outline, side: config.externalStairSide!, platformExtended: config.externalStairPlatformExtended,
        accessAnchor: resolved.lighting.accessPlan.placement, copingOffset: copingOuterOffset(config.system, config.overflowType), infinityExcluded, groundY: layout.groundY,
        topY: config.system === "overflow" ? layout.waterY - .001 : layout.copingY }) : null;
      const scope: Record<string, unknown> = { ...cameraRuntime, outlineBounds, offsetOutline, copingOuterOffset, planExternalStaircase, clampInfinityEdgeDimensions,
        outline, system: config.system, overflowType: config.overflowType, infinityZone, infinityExcluded, externalStairs, externalStairSide: config.externalStairSide,
        externalStairPlatformExtended: config.externalStairPlatformExtended, lighting: resolved.lighting, verticalLayout: layout, coverPlan, coverSubject, externalStairPlan,
        resolvedLayout: resolved, layout, shelfLoungerEnvelope: [], skimmers: emptySkimmers, ledRow: resolved.lighting.plan.positions };
      const realPoints: CameraPoint[] = offsetOutline(outline, copingOuterOffset(config.system, config.overflowType)).map(([x, z]) => [x, layout.copingY, z]);
      realPoints.push(...(resolved.access ? stairConstructionPoints(resolved.access, layout.copingY) : []));
      if (infinityZone) realPoints.push(...infinityEnvelope(infinityZone, layout.waterY));
      if (externalStairPlan) {
        const geometry = createExternalStairEnclosureGeometry(externalStairPlan), pos = geometry.getAttribute("position"), mesh = new Mesh(geometry);
        mesh.position.set(externalStairPlan.x, layout.groundY, externalStairPlan.z); mesh.rotation.y = externalStairPlan.rotation; mesh.updateMatrixWorld(true);
        for (let i = 0; i < pos.count; i++) realPoints.push(new Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).toArray() as CameraPoint); geometry.dispose();
      }
      if (coverPlan.geometry) for (const x of [coverPlan.housingX - .135, coverPlan.housingX + .135]) for (const z of [coverPlan.footprint.minZ - .075, coverPlan.footprint.maxZ + .075]) realPoints.push([x, coverPlan.housingY + .111, z]);
      for (const showMeasurements of [true, false]) {
        const values = { ...scope, focus: "top", showMeasurements }, compactPlan = evalScope(current.compact, values), planBounds = evalScope(`(${current.bounds})()`, values), oldBounds = evalScope(`(${original.bounds})()`, values);
        const preferred = evalScope(`(${current.aspect})()`, { ...values, compactPlan, planBounds }), oldPreferred = evalScope(`(${original.aspect})()`, { ...values, compactPlan: false, planBounds: oldBounds });
        if (showMeasurements) { equal(planBounds, oldBounds, "Guides ON retains exactly the original construction-plus-annotation bounds"); equal(preferred, oldPreferred, "Guides ON retains exactly the previous max-area free-frame selection"); }
        else {
          const b = outlineBounds(planBounds);
          for (const point of realPoints) ok(point[0] >= b.minX - 1e-7 && point[0] <= b.maxX + 1e-7 && point[2] >= b.minZ - 1e-7 && point[2] <= b.maxZ + 1e-7, "Compact top bounds contain real coping, receiver, stair and active cover housing XZ; no scenery/phantom padding");
        }
        for (const [vw, vh] of viewports) {
          const ui = topUI[vw]!, frame = visibleCameraFrame(ui.canvas, ui.overlays, preferred), oldFrame = visibleCameraFrame(ui.canvas, ui.overlays, oldPreferred);
          const args = current.frustumArgs.map(expr => evalScope(expr, { ...values, compactPlan, planBounds, viewportSize: { width: vw, height: vh }, visibleFrame: frame }));
          const fit = Reflect.apply(architecturalFrustum, undefined, args), oldFit = legacyFrustum(oldBounds, vw, vh, oldFrame);
          if (showMeasurements) { equal(frame, oldFrame, "Guide annotation layout selects the same free rectangle as L"); equal(fit, oldFit, "GuideON frustum and centring are bit-for-bit legacy results"); }
          const camera = new OrthographicCamera(-10, 10, 10, -10, .1, 1000);
          new Function("plan", current.upBody)(camera);
          new Function("camera", "planFit", current.orthoBody)(camera, { current: fit });
          const pose = evalScope(current.pose, { x: fit.centre[0], z: fit.centre[1], layout }); camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true);
          equal(camera.up.toArray(), [0, 0, -1], "Actual plan retains the established architectural orientation");
          ok(camera.getWorldDirection(new Vector3()).distanceTo(new Vector3(0, -1, 0)) < 1e-10, "The actual top camera remains perfectly perpendicular without perspective distortion");
          for (const point of realPoints) { const q = new Vector3(...point).project(camera), x = (q.x + 1) * vw / 2, y = (1 - q.y) * vh / 2;
            ok(q.z > -1 && q.z < 1 && x > frame.left && x < frame.left + frame.width && y > frame.top && y < frame.top + frame.height, "Real configured construction points stay inside the actual unobstructed orthographic UI frame"); }
          if (!showMeasurements) {
            const scale = vw / fit.width, oldScale = vw / oldFit.width;
            ok(scale > oldScale, "Without guides the exact same configured pool gains projected pixels compared with L, not merely a renamed preset");
            if (!coverPlan.geometry && !externalStairs && !infinityZone) equal(planBounds, offsetOutline(outline, copingOuterOffset(config.system, config.overflowType)).filter((_, i) => i === 0 || i === 2), "Unguided OFF-cover bounds stop at the actual coping, not annotation padding or a phantom housing");
            if (length === 6 && config.system === "skimmer" && config.poolType !== "above-ground" && !coverPlan.geometry) measurements.push({ viewport: [vw, vh], frame, oldFrame, oldPoolPixels: [length * oldScale, width * oldScale], poolPixels: [length * scale, width * scale], gain: scale / oldScale });
          }
          equal(JSON.stringify(config), before, "Top framing does not change geometry, materials, cover or saved selections"); cases.top++;
        }
      }
      for (const focus of ["access", "inox", "shelf", "hydromassage", "bench", "coping", "infinity", "features", "stair-lighting", "bench-lighting", "depth", "review", "overview", "paving", "exterior-panel", "external-stairs", "pellicano", "liner", "mosaic", "overflow-hidden", "overflow-visible", "skimmer-detail", "cover"]) {
        const values = { ...scope, focus, compactPlan: true, planBounds: outline };
        const pavingHelper = Reflect.get(cameraRuntime, "pavingCameraSubject");
        const paving = focus === "paving" && !infinityZone && typeof pavingHelper === "function" ? pavingHelper(outline, layout, emptySkimmers) : null;
        const reviewHelper = Reflect.get(cameraRuntime, "overviewCameraSubject"), review = ["review", "overview"].includes(focus) && !infinityZone && typeof reviewHelper === "function" ? reviewHelper(outline, layout) : null;
        const approved = paving ?? review;
        equal(evalScope(`(${current.aspect})()`, values), approved ? componentCameraAspect(approved.points, approved.direction) : evalScope(`(${original.aspect})()`, values),
          "Every non-top detail preserves its approved aspect subject, including the explicit O paving and Q non-Infinity overview subjects");
      }
    }
  }
  console.log(`Actual B Top fixture projected pixels (not a visual/premium PASS): ${JSON.stringify(measurements)}`);
}

if (section === "cover-diagnostic") {
  const source = readFileSync("docs/fullscreen-qa-evidence/premium-live-cameras/PoolScene-k-before-l-20261015.tsx", "utf8"), tree = ts.createSourceFile("PoolScene.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const expressions: Record<string, string> = {};
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ["detail", "localFraming", "opticalDetail", "fitFov"].includes(node.name.getText(tree)) && node.initializer) expressions[node.name.getText(tree)] = node.initializer.getText(tree);
    ts.forEachChild(node, visit);
  }; visit(tree);
  const evaluate = (text: string, scope: Record<string, unknown>) => new Function("scope", `with(scope) { return (${text}); }`)(scope);
  const config = freeze({ ...base, structure: "modular-steel-panels" as const, dimensions: { ...base.dimensions, length: 6, width: 3 }, equipment: ["automaticCover"], coverPosition: "open" as const, coverExtension: 0 });
  const outline = buildOutline(config.shape, config.dimensions, []), layout = getPoolVerticalLayout({ poolType: "in-ground", system: "skimmer", depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
  const viewportSize = { width: 390, height: 844 }, mobile = capturedMobileUI[390]!;
  const overlays = mobile.overlays.filter((_, i) => i !== 2).map((rect, i) => i === 0 ? { ...rect, height: 108 } : i === 1 ? { ...rect, top: 132 } : rect);
  const visibleFrame = visibleCameraFrame(mobile.canvas, overlays), scope: Record<string, unknown> = { focus: "cover", externalStairPlan: null, SCENE_VISUAL_PRESET, viewportSize, visibleFrame, cameraFrameFit };
  for (const name of ["detail", "localFraming", "opticalDetail", "fitFov"]) scope[name] = evaluate(expressions[name]!, scope);
  const radius = Math.hypot(6, 3) / 2, near = radius * 6, far = radius * 20, evidence: unknown[] = [];
  let previous: CameraPose | null = null;
  for (const extension of [0, 1]) {
    const selected = { ...config, coverPosition: extension ? "closed" as const : "open" as const, coverExtension: extension }, plan = resolveAutomaticCover(selected);
    ok(plan.geometry, "The actual 0/100 cover plan is supported, not a fabricated cover state");
    const raw = getCameraPose({ intent: "cover", outline, layout, depth: 1.5, skimmers: emptySkimmers, verticalFov: scope.fitFov as number, viewportAspect: visibleFrame.width / visibleFrame.height });
    const pose = !scope.localFraming && !scope.opticalDetail ? offsetCameraToFrame(raw, 34, 390, 844, visibleFrame) : raw;
    if (previous) equal(pose, previous, "Changing only the real cover extension keeps the same current camera pose"); previous = pose;
    const points: CameraPoint[] = [];
    for (const x of [plan.housingX - .135, plan.housingX + .135]) for (const y of [plan.housingY - .11, plan.housingY + .111])
      for (const z of [plan.footprint.minZ - .075, plan.footprint.maxZ + .075]) points.push([x, y, z]);
    if (extension) for (const x of [plan.footprint.minX + .03, plan.footprint.maxX - .03]) for (const z of [plan.footprint.minZ + .03, plan.footprint.maxZ - .03])
      for (const y of [layout.copingY - .018, layout.copingY]) points.push([x, y, z]);
    const camera = new PerspectiveCamera(34, 390 / 844, .05, 1000); camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true);
    const depths = points.map(point => -new Vector3(...point).applyMatrix4(camera.matrixWorldInverse).z);
    const pixels = points.map(point => { const p = new Vector3(...point).project(camera); return [(p.x + 1) * 390 / 2, (1 - p.y) * 844 / 2]; });
    const fog = depths.map(depth => { const x = Math.min(1, Math.max(0, (depth - near) / (far - near))); return x * x * (3 - 2 * x); });
    evidence.push({ extension, detail: scope.detail, local: scope.localFraming, fitFov: scope.fitFov, frame: visibleFrame, raw, actualAfterWorldOffset: pose,
      viewDepth: [Math.min(...depths), Math.max(...depths)], fogNear: near, fogFar: far, fogBlend: [Math.min(...fog), Math.max(...fog)],
      pixels: { left: Math.min(...pixels.map(p => p[0]!)), right: Math.max(...pixels.map(p => p[0]!)), top: Math.min(...pixels.map(p => p[1]!)), bottom: Math.max(...pixels.map(p => p[1]!)) }, actualCoverGeometry: plan.geometry });
  }
  console.log(`COVER DIAGNOSTIC ONLY, not a camera/visibility PASS: ${JSON.stringify(evidence)}`);
}

if (enabled("cover-state")) {
  const config = { ...base, structure: "modular-steel-panels" as const, equipment: ["automaticCover"], coverPosition: "open" as const, coverExtension: 0 };
  const project = toProjectConfiguration("cover-camera-state", config, { areas: [], currentFinish: "liner", filtrationWorks: [], replaceCoping: null, copingMaterial: "", structureIssues: [], equipmentUpgrades: [] });
  const link = { publicRef: "PW-AAAA-AAAAAA", savedSnapshot: serializeProjectConfiguration(project) };
  let state: Parameters<typeof reducer>[0] = { config, renovation: project.renovation, projectId: project.projectId, step: 8, visualFocus: { focus: "COVER", revision: 3 } };
  const request = state.visualFocus, original = JSON.stringify(config);
  for (const value of [.5, 1, 0]) {
    state = reducer(state, { type: "setCoverExtension", value });
    equal(state.visualFocus, request, "Actual slider reducer retains the existing COVER request: deployment cannot restart or override a manual camera");
    equal(state.config.coverExtension, value, "The real cover slider still changes its quoted physical deployment");
    equal(state.config.coverPosition, value >= .5 ? "closed" : "open", "The actual quote position follows extension without a second camera request");
    if (value !== 0) equal(projectLinkIsDirty(link, toProjectConfiguration(state.projectId, state.config, state.renovation)), true, "Changing cover deployment legitimately dirties the product configuration, unlike DPR/camera-only changes");
  }
  equal(JSON.stringify(state.config), original, "Returning the cover to its saved deployment restores the original configuration");
  equal(projectLinkIsDirty(link, toProjectConfiguration(state.projectId, state.config, state.renovation)), false, "Returning to the saved cover state is clean");
  for (const value of ["closed", "open"] as const) { state = reducer(state, { type: "setCoverPosition", value }); equal(state.visualFocus, request, "Open/closed presets preserve an existing cover camera exactly like the slider"); }
  state = { ...state, visualFocus: { focus: "LIGHTING", revision: 7 } };
  state = reducer(state, { type: "setCoverExtension", value: .5 });
  equal(state.visualFocus, { focus: "COVER", revision: 8 }, "Changing deployment from another detail enters the real cover camera once");
  const entered = state.visualFocus;
  state = reducer(state, { type: "setCoverExtension", value: .6 }); equal(state.visualFocus, entered, "The next slider update does not create another flight");
  // Manual orbit is ephemeral: the last semantic focus remains COVER. A new
  // equipment choice must still issue a new revision, not globally stabilise it.
  for (const enabled of [false, true, false, true]) {
    const previous = state.visualFocus!;
    state = reducer(state, { type: "toggleEquipment", value: "automaticCover" });
    equal(state.config.equipment.includes("automaticCover"), enabled, "Equipment ON/OFF remains a real product selection");
    equal(state.visualFocus, { focus: "COVER", revision: previous.revision + 1 }, "Cover toggle always reframes the new equipment decision even after a manual orbit");
    equal(!!resolveAutomaticCover(state.config).geometry, enabled, "OFF has no phantom cover geometry; ON restores the existing real model");
  }
  equal(state.projectId, project.projectId, "Cover camera/deployment keeps project identity");
  equal(state.step, 8, "Cover interaction does not navigate the wizard");
}

if (enabled("cover")) {
  const scenePath = process.argv.includes("--candidate-k") ? "docs/fullscreen-qa-evidence/premium-live-cameras/PoolScene-k-before-l-20261015.tsx" : "src/components/pool/three/PoolScene.tsx";
  const source = readFileSync(scenePath, "utf8"), tree = ts.createSourceFile(scenePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const expressions: Record<string, string> = {}; let aspectText = "", ownerText = "", ownerDeps = "", localView: string[] = [], opticalView: string[] = [], fogArgs: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ["detail", "localFraming", "opticalDetail", "fitFov"].includes(node.name.getText(tree)) && node.initializer) expressions[node.name.getText(tree)] = node.initializer.getText(tree);
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "subjectAspect" && node.initializer && ts.isCallExpression(node.initializer)) aspectText = node.initializer.arguments[0]!.getText(tree);
    if (ts.isCallExpression(node) && node.expression.getText(tree) === "useLayoutEffect" && node.arguments[0]?.getText(tree).includes("owned.manual = true")) { ownerText = node.arguments[0].getText(tree); ownerDeps = node.arguments[1]!.getText(tree); }
    if (ts.isIfStatement(node) && ["localFraming", "opticalDetail"].includes(node.expression.getText(tree)) && ts.isBlock(node.thenStatement)) {
      const call = node.thenStatement.statements.find(item => ts.isExpressionStatement(item) && ts.isCallExpression(item.expression) && item.expression.expression.getText(tree) === "camera.setViewOffset") as ts.ExpressionStatement;
      if (call) { const args = (call.expression as ts.CallExpression).arguments.map(arg => arg.getText(tree)); if (node.expression.getText(tree) === "localFraming") localView = args; else opticalView = args; }
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "fog") {
      const args = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(tree) === "args") as ts.JsxAttribute;
      fogArgs = ((args.initializer as ts.JsxExpression).expression as ts.ArrayLiteralExpression).elements.slice(1).map(e => e.getText(tree));
    }
    ts.forEachChild(node, visit);
  }; visit(tree);
  ok(aspectText && ownerText && ownerDeps && localView.length === 6 && fogArgs.length === 2, "Execute actual cover CameraRig aspect, projection, scoped ownership and unchanged fog expressions");
  const evalScope = (expression: string, scope: Record<string, unknown>) => new Function("scope", `with(scope) { return (${expression}); }`)(scope);
  const compiled = ts.transpileModule(`const owner = ${ownerText};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const ownership = (camera: PerspectiveCamera, localFraming: boolean): undefined | (() => void) => new Function("camera", "localFraming", "PerspectiveCamera", `${compiled}; return owner();`)(camera, localFraming, PerspectiveCamera);
  const fiber = readFileSync("node_modules/@react-three/fiber/dist/events-156d8d12.esm.js", "utf8"), fiberTree = ts.createSourceFile("fiber.js", fiber, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let updateText = "", ortho = "", subscriberText = "";
  const readFiber = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "updateCamera") updateText = node.getText(fiberTree);
    if (ts.isVariableDeclaration(node) && node.name.getText(fiberTree) === "isOrthographicCamera" && node.initializer) ortho = node.initializer.getText(fiberTree);
    if (ts.isCallExpression(node) && node.expression.getText(fiberTree) === "rootStore.subscribe" && node.arguments[0]?.getText(fiberTree).includes("Resize camera and renderer")) subscriberText = node.arguments[0].getText(fiberTree);
    ts.forEachChild(node, readFiber);
  }; readFiber(fiberTree);
  ok(updateText && ortho && subscriberText, "Use installed R3F updateCamera and actual DPR/size subscription for cover too");
  const updateCamera = new Function(`const isOrthographicCamera=${ortho}; return (${updateText});`)();
  const subscriber = (state: unknown) => new Function("rootStore", "updateCamera", `let oldSize=rootStore.getState().size,oldDpr=rootStore.getState().viewport.dpr,oldCamera=rootStore.getState().camera; return (${subscriberText});`)({ getState: () => state }, updateCamera);
  const model = readFileSync("src/components/pool/three/AutomaticCover.tsx", "utf8"), modelTree = ts.createSourceFile("AutomaticCover.tsx", model, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), constants: Record<string, number> = {};
  const readConstants = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && /^[A-Z_]+$/.test(node.name.getText(modelTree)) && node.initializer && ts.isNumericLiteral(node.initializer)) constants[node.name.getText(modelTree)] = Number(node.initializer.text); ts.forEachChild(node, readConstants); }; readConstants(modelTree);
  function actualCoverPoints(plan: ReturnType<typeof resolveAutomaticCover>, rimTop: number): CameraPoint[] {
    if (!plan.geometry) return [];
    const points: CameraPoint[] = [], { minX, maxX, minZ, maxZ } = plan.footprint, span = maxZ - minZ, midZ = (minZ + maxZ) / 2;
    const box = (cx: number, cy: number, cz: number, w: number, h: number, d: number) => { for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) points.push([cx + w * x, cy + h * y, cz + d * z]); };
    // The actual five housing box argument/position expressions, not the
    // camera subject's bounding box. The end-cap mesh repeats for +/-side.
    const housing = modelTree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "RollerHousing")!;
    const meshes: ts.JsxElement[] = []; const collect = (node: ts.Node) => { if (ts.isJsxElement(node) && node.openingElement.tagName.getText(modelTree) === "mesh") meshes.push(node); ts.forEachChild(node, collect); }; collect(housing);
    for (const mesh of meshes) {
      const geometry = mesh.children.find(n => ts.isJsxSelfClosingElement(n) && n.tagName.getText(modelTree) === "boxGeometry") as ts.JsxSelfClosingElement | undefined; if (!geometry) continue;
      const attr = (properties: ts.NodeArray<ts.JsxAttributeLike>, name: string) => { const a = properties.find(p => ts.isJsxAttribute(p) && p.name.getText(modelTree) === name) as ts.JsxAttribute; return (a.initializer as ts.JsxExpression).expression!.getText(modelTree); };
      const position = attr(mesh.openingElement.attributes.properties, "position"), args = attr(geometry.attributes.properties, "args");
      for (const side of position.includes("side") ? [-1, 1] : [0]) {
        const scope = { span, side, backSign: plan.housingSide === "minX" ? -1 : 1 }, p = evalScope(position, scope), size = evalScope(args, scope);
        box(plan.housingX + p[0], plan.housingY + p[1], midZ + p[2], size[0], size[1], size[2]);
      }
    }
    const radius = constants.ROLL_RADIUS_OPEN! + (constants.ROLL_RADIUS_CLOSED! - constants.ROLL_RADIUS_OPEN!) * plan.extension;
    for (let i = 0; i < 32; i++) for (const z of [minZ - .05, maxZ + .05]) points.push([plan.housingX + Math.cos(i * Math.PI / 16) * radius, plan.housingY + Math.sin(i * Math.PI / 16) * radius, z]);
    const run = maxX - minX - 2 * constants.END_CLEARANCE!, width = span - 2 * constants.END_CLEARANCE!, count = Math.max(1, Math.ceil(run / constants.NOMINAL_SLAT_PITCH!)), pitch = run / count;
    const deployed = Math.round(count * plan.extension), direction = plan.housingSide === "minX" ? 1 : -1, start = direction === 1 ? minX + constants.END_CLEARANCE! : maxX - constants.END_CLEARANCE!;
    for (let i = 0; i < deployed; i++) box(start + direction * (i + .5) * pitch, rimTop - constants.SLAT_THICKNESS! / 2, midZ, Math.max(.001, pitch - constants.SLAT_GAP!), constants.SLAT_THICKNESS!, width);
    if (deployed) box(start + direction * (deployed * pitch + .009), rimTop - constants.LEADING_BAR_THICKNESS! / 2, midZ, .018, constants.LEADING_BAR_THICKNESS!, width);
    return points;
  }
  const tests = process.argv.includes("--mobile-repro") ? [[6, 3, "skimmer", "hidden", 390, 844] as const]
    : sizes.flatMap(([l, w]) => ([["skimmer", "hidden"], ["overflow", "hidden"], ["overflow", "visible"]] as const).flatMap(([system, overflow]) => viewports.map(([vw, vh]) => [l, w, system, overflow, vw, vh] as const)));
  for (const [length, width, system, overflowType, vw, vh] of tests) {
    let onPose: CameraPose | null = null;
    for (const extension of [null, 0, .5, 1]) {
      const config = freeze({ ...base, structure: "modular-steel-panels" as const, dimensions: { ...base.dimensions, length, width }, system, overflowType,
        equipment: extension === null ? [] : ["automaticCover"], coverPosition: extension && extension >= .5 ? "closed" as const : "open" as const, coverExtension: extension ?? 0 });
      const before = JSON.stringify(config), plan = resolveAutomaticCover(config), outline = buildOutline(config.shape, config.dimensions, []);
      const layout = getPoolVerticalLayout({ poolType: "in-ground", system, overflowType, depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
      ok(plan.status !== "UNAVAILABLE", "Every cover camera fixture respects actual product compatibility"); equal(!!plan.geometry, extension !== null, "The actual resolver contains housing geometry only when cover is ON");
      const helper = Reflect.get(cameraRuntime, "coverCameraSubject"), coverSubject = typeof helper === "function" ? helper(plan, layout, outline, copingOuterOffset(system, overflowType)) : null;
      const scope: Record<string, unknown> = { ...cameraRuntime, focus: "cover", coverSubject, externalStairPlan: null, resolvedLayout: configuredPoolLayout(config), layout, outline, shelfLoungerEnvelope: [], infinityZone: null, skimmers: emptySkimmers, ledRow: [], SCENE_VISUAL_PRESET };
      const preferred = evalScope(`(${aspectText})()`, scope), mobile = capturedMobileUI[vw];
      // Exact 390 DOM was captured at K cover selection. At430 use the same
      // independent captured mobile controls at the isolated-origin header row.
      const overlays = mobile?.overlays.filter((_, i) => i !== 2).map((rect, i) => i === 0 ? { ...rect, height: 108 } : i === 1 ? { ...rect, top: 132 } : rect);
      const frame = mobile ? visibleCameraFrame(mobile.canvas, overlays!, preferred) : frameFor(vw, vh, preferred);
      Object.assign(scope, { viewportSize: { width: vw, height: vh }, visibleFrame: frame });
      for (const name of ["detail", "localFraming", "opticalDetail", "fitFov"]) scope[name] = evalScope(expressions[name]!, scope);
      const raw = getCameraPose({ intent: "cover", outline, layout, depth: 1.5, skimmers: emptySkimmers, verticalFov: scope.fitFov as number, viewportAspect: frame.width / frame.height, coverSubject });
      const pose = !scope.localFraming && !scope.opticalDetail ? offsetCameraToFrame(raw, 34, vw, vh, frame) : raw;
      const camera = new PerspectiveCamera(34, vw / vh, .05, 1000); camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true);
      const viewArgs = (scope.localFraming ? localView : scope.opticalDetail ? opticalView : []).map(expr => evalScope(expr, scope));
      if (viewArgs.length) camera.setViewOffset(viewArgs[0], viewArgs[1], viewArgs[2], viewArgs[3], viewArgs[4], viewArgs[5]);
      const rimTop = system === "skimmer" ? layout.copingY : overflowType === "hidden" ? concealedOverflowSection(layout.wallTopY, POOL_BORDER_PRESET.thickness).copingTopY : layout.wallTopY + OVERFLOW_GEOMETRY.visibleGrateTopOffset;
      const points = actualCoverPoints(plan, rimTop);
      // Constructive rim boundaries and full travel, no floor/deck padding.
      points.push(...offsetOutline(outline, copingOuterOffset(system, overflowType)).map(([x, z]) => [x, rimTop, z] as CameraPoint), ...outline.map(([x, z]) => [x, rimTop, z] as CameraPoint));
      const radius = Math.hypot(length, width) / 2, [near] = fogArgs.map(expr => evalScope(expr, { radius }));
      const checkProjection = (cam: PerspectiveCamera, width: number, height: number, free: Rect, message: string) => { for (const point of points) {
        const world = new Vector3(...point), q = world.clone().project(cam), x = (q.x + 1) * width / 2, y = (1 - q.y) * height / 2;
        ok(q.z > -1 && q.z < 1 && x > free.left + free.width * .02 && x < free.left + free.width * .98 && y > free.top + free.height * .02 && y < free.top + free.height * .98, message);
        ok(-world.applyMatrix4(cam.matrixWorldInverse).z < near, "Actual cover travel/housing/rim stays before unchanged scene fogNear, including OFF: projected-inside alone is not enough");
      } };
      checkProjection(camera, vw, vh, frame, "Actual renderer slat, leading-bar and housing vertices plus constructive rim fit the current unobstructed frame");
      ok(scope.localFraming && scope.fitFov === 34, "Cover has a true local 34-degree physical lens, not the old distant world-translated overview");
      if (extension !== null) { if (onPose) equal(pose, onPose, "Full travel subject produces exactly the same pose for0/50/100% deployment"); else onPose = pose; }
      if (extension === null) ok(coverSubject && coverSubject.points.every((p: CameraPoint) => p[1] <= layout.copingY), "OFF frames the real rim/opening without inventing a raised roller");
      const snapshot = toProjectConfiguration("cover-lifecycle", config, { areas: [], currentFinish: "liner", filtrationWorks: [], replaceCoping: null, copingMaterial: "", structureIssues: [], equipmentUpgrades: [] }), link = { publicRef: "PW-AAAA-AAAAAA", savedSnapshot: serializeProjectConfiguration(snapshot) };
      for (const previous of [undefined, false, true]) {
        const owned = camera.clone() as PerspectiveCamera & { manual?: boolean }; if (previous !== undefined) owned.manual = previous;
        const cleanup = ownership(owned, !!scope.localFraming), eye = owned.position.toArray(), projection = owned.projectionMatrix.toArray();
        equal(evalScope(ownerDeps, { camera: owned, localFraming: true }), [owned, true], "Cover ownership depends only on actual camera/local mode, not deployment or DPR");
        let resizeCalls = 0; const state = { camera: owned, size: { width: vw, height: vh }, viewport: { dpr: 1 }, gl: { domElement: {}, setPixelRatio() {}, setSize() { resizeCalls++; } }, set() { throw new Error("No replacement camera expected"); } }, resize = subscriber(state);
        for (const dpr of [1.5, 1]) { state.viewport.dpr = dpr; resize(); equal(owned.projectionMatrix.toArray(), projection, "Actual installed R3F idle/DPR callback preserves settled cover inset projection"); equal(owned.position.toArray(), eye, "Cover idle/DPR updates do not create a physical flight"); checkProjection(owned, vw, vh, frame, "All actual cover vertices remain visible in the UI frame after R3F DPR callback"); }
        state.size = { width: vw + 40, height: vh + 88 }; resize(); equal(owned.projectionMatrix.toArray(), projection, "R3F size update cannot overwrite the owned cover matrix before CameraRig reframes");
        equal(resizeCalls, 3, "Manual camera ownership does not disable renderer DPR/size changes");
        const nextFrame = frameFor(state.size.width, state.size.height, preferred), nextScope = { ...scope, viewportSize: state.size, visibleFrame: nextFrame }, args = localView.map(expr => evalScope(expr, nextScope));
        owned.setViewOffset(args[0], args[1], args[2], args[3], args[4], args[5]);
        const nextPose = getCameraPose({ intent: "cover", outline, layout, depth: 1.5, skimmers: emptySkimmers, verticalFov: 34, viewportAspect: nextFrame.width / nextFrame.height, coverSubject });
        owned.position.set(...nextPose.position); owned.lookAt(new Vector3(...nextPose.target)); owned.updateMatrixWorld(true); checkProjection(owned, state.size.width, state.size.height, nextFrame, "Cover's real geometry remains fitted after legitimate resize");
        cleanup?.(); equal(owned.manual, previous, "Leaving cover restores prior true/false/undefined camera ownership"); equal(Object.hasOwn(owned, "manual"), previous !== undefined, "Cover ownership never leaks an absent manual property into other intents");
        equal(JSON.stringify(config), before, "Camera/lifecycle changes preserve all material, geometry and optional data"); equal(projectLinkIsDirty(link, toProjectConfiguration(snapshot.projectId, config, snapshot.renovation)), false, "View-only cover lifecycle changes do not falsely dirty the canonical project");
      }
      cases.cover++;
    }
  }
}

if (enabled("external-stairs") || section === "external-fog" || section === "external-lifecycle") {
  const scenePath = process.argv.includes("--scene-j") ? "docs/fullscreen-qa-evidence/premium-live-cameras/PoolScene-j-before-k-20261015.tsx"
    : process.argv.includes("--candidate-i") ? "docs/fullscreen-qa-evidence/premium-live-cameras/PoolScene-i-before-j-20261015.tsx" : "src/components/pool/three/PoolScene.tsx";
  const sceneSource = readFileSync(scenePath, "utf8"), tree = ts.createSourceFile("PoolScene.tsx", sceneSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let aspectCallback = "", radiusExpression = "", localExpression = "false", fitExpression = "", ownershipCallback = "", ownershipDeps = "", localViewArgs: string[] = [], opticalViewArgs: string[] = [], fogExpressions: string[] = [];
  const find = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "subjectAspect" && node.initializer && ts.isCallExpression(node.initializer)) aspectCallback = node.initializer.arguments[0]!.getText(tree);
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "radius" && node.initializer?.getText(tree).includes("Math.hypot(length, width)")) radiusExpression = node.initializer.getText(tree);
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "localFraming" && node.initializer) localExpression = node.initializer.getText(tree);
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "fitFov" && node.initializer) fitExpression = node.initializer.getText(tree);
    if (ts.isCallExpression(node) && node.expression.getText(tree) === "useLayoutEffect" && node.arguments[0]?.getText(tree).includes("owned.manual = true")) {
      ownershipCallback = node.arguments[0].getText(tree); ownershipDeps = node.arguments[1]!.getText(tree);
    }
    if (ts.isIfStatement(node) && ["localFraming", "opticalDetail"].includes(node.expression.getText(tree)) && ts.isBlock(node.thenStatement)) {
      const statement = node.thenStatement.statements.find(item => ts.isExpressionStatement(item) && ts.isCallExpression(item.expression) && item.expression.expression.getText(tree) === "camera.setViewOffset") as ts.ExpressionStatement;
      if (statement) {
        const args = (statement.expression as ts.CallExpression).arguments.map(arg => arg.getText(tree));
        if (node.expression.getText(tree) === "localFraming") localViewArgs = args; else opticalViewArgs = args;
      }
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "fog") {
      const args = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(tree) === "args") as ts.JsxAttribute;
      const expression = (args.initializer as ts.JsxExpression).expression as ts.ArrayLiteralExpression;
      fogExpressions = expression.elements.slice(1).map(element => element.getText(tree));
    }
    ts.forEachChild(node, find);
  }; find(tree);
  ok(aspectCallback && radiusExpression && fitExpression && fogExpressions.length === 2, "Read actual CameraRig aspect, local lens and scene fog/radius expressions");
  const actualAspect = new Function("scope", `with(scope) { return (${aspectCallback})(); }`);
  let executeOwnership: (camera: PerspectiveCamera, local: boolean) => undefined | (() => void) = () => undefined;
  let makeResizeSubscriber: ((state: () => unknown) => () => void) | undefined;
  if (section === "external-lifecycle") {
    if (ownershipCallback) {
      const compiled = ts.transpileModule(`const owner = ${ownershipCallback};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      executeOwnership = new Function("camera", "localFraming", "PerspectiveCamera", `${compiled}; return owner();`).bind(null) as never;
      const execute = executeOwnership as unknown as (camera: PerspectiveCamera, local: boolean, constructor: typeof PerspectiveCamera) => undefined | (() => void);
      executeOwnership = (camera, local) => execute(camera, local, PerspectiveCamera);
      const deps = new Function("camera", "localFraming", `return ${ownershipDeps};`), testCamera = new PerspectiveCamera();
      equal(deps(testCamera, true), [testCamera, true], "Real ownership effect depends on camera/local framing only, not DPR, colour or new flights");
      for (const focus of ["access", "inox", "shelf", "hydromassage", "bench", "coping", "infinity", "features", "stair-lighting", "bench-lighting", "top", "depth", "review", "overview", "paving", "exterior-panel", "pellicano", "liner", "mosaic", "overflow-hidden", "overflow-visible", "skimmer-detail"]) {
        // O/Q intentionally add non-Infinity paving/review/overview. Their
        // dedicated regressions cover these routes; protected Infinity
        // versions must retain their previous no-ownership behaviour here.
        const local = new Function("focus", "externalStairPlan", "coverSubject", "infinityZone", `return ${localExpression};`)(focus, {}, null, ["paving", "review", "overview"].includes(focus) ? {} : null);
        for (const previous of [undefined, false, true]) {
          const other = new PerspectiveCamera() as PerspectiveCamera & { manual?: boolean }; if (previous !== undefined) other.manual = previous;
          const cleanup = executeOwnership(other, local);
          equal(other.manual, previous, "Actual ownership callback leaves every other approved camera intent unchanged");
          equal(cleanup, undefined, "A non-external camera has no manual-ownership cleanup to disturb it");
        }
      }
    }
    const fiberSource = readFileSync("node_modules/@react-three/fiber/dist/events-156d8d12.esm.js", "utf8"), fiberTree = ts.createSourceFile("fiber.js", fiberSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    let updateText = "", orthoExpression = "", subscriberText = "";
    const findFiber = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === "updateCamera") updateText = node.getText(fiberTree);
      if (ts.isVariableDeclaration(node) && node.name.getText(fiberTree) === "isOrthographicCamera" && node.initializer) orthoExpression = node.initializer.getText(fiberTree);
      if (ts.isCallExpression(node) && node.expression.getText(fiberTree) === "rootStore.subscribe" && node.arguments[0]?.getText(fiberTree).includes("Resize camera and renderer")) subscriberText = node.arguments[0].getText(fiberTree);
      ts.forEachChild(node, findFiber);
    }; findFiber(fiberTree);
    ok(updateText && orthoExpression && subscriberText, "Execute the actual installed R3F camera update and DPR/size subscription, not a hand-written approximation");
    const update = new Function(`const isOrthographicCamera = ${orthoExpression}; return (${updateText});`)();
    makeResizeSubscriber = getState => new Function("rootStore", "updateCamera", `let oldSize=rootStore.getState().size,oldDpr=rootStore.getState().viewport.dpr,oldCamera=rootStore.getState().camera; return (${subscriberText});`)({ getState }, update);
  }
  if (!process.argv.includes("--candidate-i")) {
    const local = new Function("focus", "externalStairPlan", "coverSubject", "infinityZone", `return ${localExpression};`);
    for (const focus of ["access", "inox", "shelf", "hydromassage", "bench", "coping", "infinity", "features", "stair-lighting", "bench-lighting", "top", "depth", "review", "overview", "paving", "exterior-panel", "pellicano", "liner", "mosaic", "overflow-hidden", "overflow-visible", "skimmer-detail"])
      equal(local(focus, {}, null, ["paving", "review", "overview"].includes(focus) ? {} : null), false, "The local physical-camera branch cannot change other approved intents or protected Infinity paving/review/overview");
    equal(local("external-stairs", null), false, "No fabricated external-camera branch when the actual stair plan is absent");
  }
  const tests = section === "external-fog" || process.argv.includes("--mobile-repro") ? [[6, 3, "long", 390, 844] as const]
    : sizes.flatMap(([l, w]) => (["long", "short"] as const).flatMap(side => viewports.map(([vw, vh]) => [l, w, side, vw, vh] as const)));
  for (const [length, width, side, vw, vh] of tests) {
    const config = freeze({ ...base, poolType: "above-ground" as const, structure: "modular-steel-panels" as const,
      dimensions: { ...base.dimensions, length, width, depth: 1.5 }, skimmerType: "slim" as const, internalStairType: "corner" as const,
      features: ["externalStaircase"] as const, externalStairSide: side, externalStairPlatformExtended: true });
    const before = JSON.stringify(config), outline = buildOutline(config.shape, config.dimensions, []), resolved = configuredPoolLayout(config);
    const savedProject = section === "external-lifecycle" ? toProjectConfiguration("external-lifecycle-fixture", config, { areas: [], currentFinish: "liner", filtrationWorks: [], replaceCoping: null, copingMaterial: "", structureIssues: [], equipmentUpgrades: [] }) : null;
    const savedLink = savedProject ? { publicRef: "PW-AAAA-AAAAAA", savedSnapshot: serializeProjectConfiguration(savedProject) } : null;
    const layout = getPoolVerticalLayout({ poolType: "above-ground", system: "skimmer", depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
    const plan = planExternalStaircase({ outline, side, platformExtended: true, accessAnchor: resolved.lighting.accessPlan.placement,
      groundY: layout.groundY, topY: layout.copingY, copingOffset: copingOuterOffset("skimmer", "hidden") });
    ok(plan, "The actual selected above-ground staircase exists");
    const p = plan!, points = p.footprint.flatMap(([x, z]) => [layout.groundY, layout.copingY + 1.05].map(y => [x, y, z] as CameraPoint));
    const direction: CameraPoint = [p.outward[0] + p.walk[0] * .5, .7, p.outward[1] + p.walk[1] * .5];
    const preferred = actualAspect({ ...cameraRuntime, focus: "external-stairs", resolvedLayout: resolved, outline, layout, externalStairPlan: p,
      shelfLoungerEnvelope: [], infinityZone: null, skimmers: emptySkimmers, ledRow: [] });
    const mobile = capturedMobileUI[vw];
    // The saved external JSON omitted the construction badge. Use the prior
    // real captured badge conservatively at the newer menu-row top132; this
    // is explicitly not labelled a complete new external DOM acquisition.
    const overlays = mobile?.overlays.map((rect, i) => i === 0 ? { ...rect, height: 108 } : i === 1 || i === 2 ? { ...rect, top: 132 } : rect);
    const frame = mobile ? visibleCameraFrame(mobile.canvas, overlays!, preferred) : frameFor(vw, vh, preferred);
    const scope = { ...cameraRuntime, focus: "external-stairs", externalStairPlan: p, SCENE_VISUAL_PRESET, viewportSize: { width: vw, height: vh }, visibleFrame: frame };
    const evaluate = (expression: string, values: Record<string, unknown>) => new Function("scope", `with(scope) { return (${expression}); }`)(values);
    const localFraming = evaluate(localExpression, scope), localFov = evaluate(fitExpression, { ...scope, localFraming });
    const pose = getCameraPose({ intent: "external-stairs", outline, layout, externalStairPlan: p, depth: 1.5, skimmers: emptySkimmers, verticalFov: localFov, viewportAspect: frame.width / frame.height });
    const radius = new Function("length", "width", `return ${radiusExpression};`)(length, width), [near, far] = fogExpressions.map(expr => new Function("radius", `return ${expr};`)(radius));
    const camera = new PerspectiveCamera(34, vw / vh, .05, 1000); camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true);
    const viewArgs = (localFraming ? localViewArgs : opticalViewArgs).map(expression => evaluate(expression, scope));
    equal(viewArgs.length, 6, "Execute all six actual runtime inset/optical view-offset arguments");
    camera.setViewOffset(viewArgs[0], viewArgs[1], viewArgs[2], viewArgs[3], viewArgs[4], viewArgs[5]);
    const geometry = createExternalStairEnclosureGeometry(p), position = geometry.getAttribute("position"), mesh = new Mesh(geometry);
    mesh.position.set(p.x, layout.groundY, p.z); mesh.rotation.y = p.rotation; mesh.updateMatrixWorld(true);
    const depths: number[] = [], actualPoints: Vector3[] = [];
    for (let i = 0; i < position.count; i++) {
      const world = new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      depths.push(-world.clone().applyMatrix4(camera.matrixWorldInverse).z); actualPoints.push(world);
    }
    const properFrame = mobile ? visibleCameraFrame(mobile.canvas, overlays!, componentCameraAspect(points, direction)) : frameFor(vw, vh, componentCameraAspect(points, direction));
    const properFit = cameraFrameFit(34, vh, properFrame), alternative = fitComponentCamera(points, direction, properFit.verticalFov, properFit.aspect);
    if (section === "external-fog" || length === 6 && side === "long" && vw === 390) console.log(`External staircase fog diagnostic: ${JSON.stringify({ size: [length, width], side, viewport: [vw, vh], frame, preferred, localFraming, localFov, near, far,
      poseDistance: new Vector3(...pose.position).distanceTo(new Vector3(...pose.target)), actualMeshViewDepth: [Math.min(...depths), Math.max(...depths)], allMeshBeyondFogFar: depths.every(d => d >= far),
      subjectAspectFrame: properFrame, subjectAspectDistance: new Vector3(...alternative.position).distanceTo(new Vector3(...alternative.target)) })}`);
    for (const world of [...actualPoints, ...points.map(p => new Vector3(...p))]) {
      const projected = world.clone().project(camera), x = (projected.x + 1) * vw / 2, y = (1 - projected.y) * vh / 2;
      ok(projected.z > -1 && projected.z < 1 && x > frame.left + frame.width * .02 && x < frame.left + frame.width * .98 && y > frame.top + frame.height * .02 && y < frame.top + frame.height * .98,
        "Actual enclosure vertices and conservative full guard envelope project into the real runtime view-offset frame");
      ok(-world.clone().applyMatrix4(camera.matrixWorldInverse).z < near, "The selected physical staircase/guard detail remains before the scene's unchanged fogNear, not a made-up opacity threshold");
    }
    ok(localFraming && localFov <= SCENE_VISUAL_PRESET.camera.fov, "The actual exterior-detail branch uses a local lens no wider than the existing 34-degree preset");
    equal(JSON.stringify(config), before, "Camera framing does not change staircase, platform, dimensions or selected materials");
    if (section === "external-lifecycle") {
      for (const previous of [undefined, false, true]) {
        const controlled = camera.clone() as PerspectiveCamera & { manual?: boolean };
        if (previous === undefined) delete controlled.manual; else controlled.manual = previous;
        const cleanup = executeOwnership(controlled, true), eye = controlled.position.toArray(), projection = controlled.projectionMatrix.toArray();
        let dprCalls = 0, rendererResizes = 0;
        const store = { camera: controlled, size: { width: vw, height: vh }, viewport: { dpr: 1 },
          gl: { domElement: {}, setPixelRatio() { dprCalls++; }, setSize() { rendererResizes++; } }, set() { throw new Error("No replacement camera or viewport is expected"); } };
        const resize = makeResizeSubscriber!(() => store);
        for (const dpr of [1.5, 1]) {
          store.viewport.dpr = dpr; resize();
          equal(controlled.aspect, frame.width / frame.height, "After real DPR/idle resize, the actual inset aspect must not become full-canvas aspect");
          equal(controlled.projectionMatrix.toArray(), projection, "Idle quality DPR changes preserve the actual settled projection matrix");
          equal(controlled.position.toArray(), eye, "DPR changes cannot move the eye or create another flight");
          for (const world of actualPoints) {
            const q = world.clone().project(controlled), x = (q.x + 1) * vw / 2, y = (1 - q.y) * vh / 2;
            ok(x > frame.left + frame.width * .02 && x < frame.left + frame.width * .98 && y > frame.top + frame.height * .02 && y < frame.top + frame.height * .98,
              "Actual rendered enclosure remains inside the UI frame after the installed idle/DPR camera callback");
          }
        }
        store.size = { width: vw + 40, height: vh + 88 }; store.viewport.dpr = 2; resize();
        equal(controlled.projectionMatrix.toArray(), projection, "The renderer size callback cannot overwrite the owned projection before CameraRig applies its new frame");
        equal(dprCalls, 3, "All three real DPR/size renderer callbacks still run; the fix does not suppress renderer resizing");
        equal(rendererResizes, 3, "Canvas size updates remain functional with manual camera ownership");
        const nextFrame = frameFor(store.size.width, store.size.height, preferred), nextScope = { ...scope, visibleFrame: nextFrame, viewportSize: store.size };
        const nextArgs = localViewArgs.map(expression => evaluate(expression, nextScope));
        controlled.setViewOffset(nextArgs[0], nextArgs[1], nextArgs[2], nextArgs[3], nextArgs[4], nextArgs[5]);
        const nextPose = getCameraPose({ intent: "external-stairs", outline, layout, externalStairPlan: p, depth: 1.5, skimmers: emptySkimmers, verticalFov: 34, viewportAspect: nextFrame.width / nextFrame.height });
        controlled.position.set(...nextPose.position); controlled.lookAt(new Vector3(...nextPose.target)); controlled.updateMatrixWorld(true);
        for (const world of actualPoints) {
          const q = world.clone().project(controlled), x = (q.x + 1) * store.size.width / 2, y = (1 - q.y) * store.size.height / 2;
          ok(x > nextFrame.left + nextFrame.width * .02 && x < nextFrame.left + nextFrame.width * .98 && y > nextFrame.top + nextFrame.height * .02 && y < nextFrame.top + nextFrame.height * .98,
            "Actual enclosure also fits after a legitimate CameraRig size reframe");
          ok(-world.clone().applyMatrix4(controlled.matrixWorldInverse).z < near, "Legitimate resizing keeps the real staircase in front of unchanged fogNear");
        }
        cleanup?.();
        equal(controlled.manual, previous, "Exiting external detail restores the previous true/false/absent manual value");
        equal(Object.hasOwn(controlled, "manual"), previous !== undefined, "Absent manual ownership is deleted rather than leaked into other camera intents");
        equal(JSON.stringify(config), before, "Ownership, DPR, idle and resize change no saved project or light/furniture state");
        const canonical = toProjectConfiguration(savedProject!.projectId, config, savedProject!.renovation);
        equal(projectLinkIsDirty(savedLink, canonical), false,
          "The existing canonical saved-snapshot predicate stays clean after view-only DPR/resize/ownership changes");
        if (previous !== true) { store.size = { width: vw, height: vh }; store.viewport.dpr = 1; resize(); equal(controlled.aspect, vw / vh, "After cleanup, ordinary R3F camera resizing is restored"); }
      }
    }
    geometry.dispose();
    cases.externalStairs++;
  }
}

if (enabled("shelf-access")) {
  const rigPath = process.argv.includes("--candidate-h") ? "docs/fullscreen-qa-evidence/premium-live-cameras/PoolScene-h-before-i-20261015.tsx" : "src/components/pool/three/PoolScene.tsx";
  const rigSource = readFileSync(rigPath, "utf8"), rigTree = ts.createSourceFile(rigPath, rigSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback = "";
  const find = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && node.name.getText(rigTree) === "subjectAspect" && node.initializer && ts.isCallExpression(node.initializer)) callback = node.initializer.arguments[0]!.getText(rigTree); ts.forEachChild(node, find); }; find(rigTree);
  ok(callback, "Execute the actual Access/Shelf CameraRig aspect callback, including selected furniture");
  const aspectFor = new Function("scope", `with(scope) { return (${callback})(); }`);
  for (const [length, width] of sizes) for (const system of ["skimmer", "overflow", "infinity"] as const) {
    const dimensions = { ...base.dimensions, length, width }, outline = buildOutline(base.shape, dimensions, []);
    const layout = getPoolVerticalLayout({ poolType: "in-ground", system, overflowType: "hidden", depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
    for (const zone of system === "infinity" ? infinityZonesForOutline(outline, base.shape) : [null]) {
      const edge = zone ? { infinityEdge: { enabled: true, side: zone.side, startT: 0, endT: 1, dropDirection: "outward" as const } } : {};
      const possible = configuredSunShelfLoungers({ ...base, ...edge, system, dimensions, features: ["sunShelf", "sunShelfLoungers"] });
      // Enumerate only quantities actually allowed by the fixed-size model.
      for (let quantity = 0; quantity <= possible.capacity; quantity++) {
        const config = freeze({ ...base, ...edge, system, dimensions, features: quantity ? ["sunShelf", "sunShelfLoungers"] as const : ["sunShelf"] as const,
          ...(quantity ? { sunShelfLoungerCount: quantity } : {}) });
        const before = JSON.stringify(config), resolved = configuredPoolLayout(config), shelf = resolved.comfort.elements.find(part => part.kind === "sunShelf");
        ok(shelf, "Compatible real shelf geometry is present for Access");
        equal(resolved.effectiveAccess, null, "The real shelf flight replaces standalone access");
        equal(resolved.access.placement, null, "No fabricated standalone placement is supplied for a shelf camera");
        const loungers = configuredSunShelfLoungers(config), envelope: CameraPoint[] = [];
        equal(loungers.count, quantity, "The selected lounger quantity is genuinely allowed, with no rescaling or invented capacity");
        for (const placement of loungers.placements) for (const [x, z] of placement.footprint) for (const y of [placement.y, placement.y + SUN_SHELF_LOUNGER_MODEL.height]) envelope.push([x, y, z]);
        const parts = [shelf!, ...(shelf!.steps ?? []), ...(shelf!.landing ? [shelf!.landing] : [])];
        const points: CameraPoint[] = parts.flatMap(part => part.footprint.map(([x, z]) => [x, part.topY, z] as CameraPoint));
        for (const step of shelf!.steps ?? []) for (const [x, z] of step.footprint) points.push([x, step.topY - (shelf!.riser ?? 0), z]);
        points.push(...envelope);
        const scope = { ...cameraRuntime, resolvedLayout: resolved, layout, outline, infinityZone: zone, shelfLoungerEnvelope: envelope, skimmers: emptySkimmers, ledRow: [] };
        const shelfAspect = aspectFor({ ...scope, focus: "shelf" }), accessAspect = aspectFor({ ...scope, focus: "access" });
        equal(accessAspect, shelfAspect, "Actual Access and Shelf optical framing receive the same real selected-lounger envelope");
        for (const [vw, vh] of viewports) {
          const frame = frameFor(vw, vh, shelfAspect), fit = cameraFrameFit(34, vh, frame);
          const expected = contextualAccessCamera("shelf", resolved, layout, outline, fit.verticalFov, fit.aspect, zone, envelope);
          const pose = contextualAccessCamera("access", resolved, layout, outline, fit.verticalFov, fit.aspect, zone, envelope);
          const label = `Access/Shelf ${length}×${width}/${system}/side ${zone?.side ?? "none"}/loungers${quantity}/${vw}×${vh}`;
          ok(pose, `${label}: Access must not fall back to pool overview when a shelf replaces the internal plan`);
          equal(pose, expected, `${label}: the approved shelf composition is reused exactly, not rebuilt`);
          projectInside(pose!, points, vw, vh, label, frame);
          equal(JSON.stringify(config), before, `${label}: no furniture, access, shape or selected optional is changed`);
          cases.shelfAccess++;
        }
      }
    }
  }
  // Execute H's exact preserved resolver on non-shelf inputs to prove that I
  // keeps both standalone and Hydro H subjects byte-for-data equivalent.
  const js = ts.transpileModule(`const oldAccess = ${H_ACCESS_SUBJECT_SOURCE.replace(/^export /, "")};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const scope = { ...cameraRuntime, outlineBounds }, previous = new Function(...Object.keys(scope), `${js}; return oldAccess;`)(...Object.values(scope));
  for (const features of [[], ["hydromassage"]] as const) for (const variant of ["open", "closed"] as const) {
    const config = { ...base, features, hydromassageVariant: variant }, outline = buildOutline(config.shape, config.dimensions, []), resolved = configuredPoolLayout(config);
    const layout = getPoolVerticalLayout({ poolType: "in-ground", system: config.system, depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
    const current = Reflect.get(cameraRuntime, "accessFlightCameraSubject");
    equal(current(resolved, layout, outline, []), previous(resolved, layout, outline), "Standalone and Hydro A/B preserve the exact H subject when no shelf is selected");
  }
}

if (enabled("integrated-access")) {
  const rigPath = process.argv.includes("--candidate-g") ? "docs/fullscreen-qa-evidence/premium-live-cameras/PoolScene-g-before-h-20261015.tsx" : "src/components/pool/three/PoolScene.tsx";
  const rigSource = readFileSync(rigPath, "utf8"), rigTree = ts.createSourceFile(rigPath, rigSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let aspectCallback = "";
  const findAspect = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(rigTree) === "subjectAspect" && node.initializer && ts.isCallExpression(node.initializer))
      aspectCallback = node.initializer.arguments[0]!.getText(rigTree);
    ts.forEachChild(node, findAspect);
  }; findAspect(rigTree);
  ok(aspectCallback, "The actual CameraRig subject-aspect callback is executable");
  const actualAspect = new Function("scope", `with(scope) { return (${aspectCallback})(); }`);
  for (const [length, width] of sizes) for (const system of ["skimmer", "overflow", "infinity"] as const) {
    const dimensions = { ...base.dimensions, length, width, depth: 1.5 }, outline = buildOutline(base.shape, dimensions, []);
    const layout = getPoolVerticalLayout({ poolType: "in-ground", system, depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
    for (const zone of system === "infinity" ? infinityZonesForOutline(outline, base.shape) : [null]) for (const variant of ["open", "closed"] as const) {
      const config = freeze({ ...base, system, dimensions, hydromassageVariant: variant, internalStairType: "corner" as const,
        features: ["hydromassage", "inoxLadder"] as const,
        ...(zone ? { infinityEdge: { enabled: true, side: zone.side, startT: 0, endT: 1, dropDirection: "outward" as const } } : {}) });
      const before = JSON.stringify(config), resolved = configuredPoolLayout(config), hydro = resolved.comfort.elements.find(part => part.kind === "hydromassage");
      if (!hydro) { ok(!resolved.comfort.availability.hydromassage.available, "Unavailable actual hydro geometry is not fabricated for the Access test"); continue; }
      equal(resolved.effectiveAccess, null, "The real hydro flight replaces standalone access, not a fabricated internal stair plan");
      equal(resolved.access.placement, null, "Access routing must handle a genuinely absent standalone placement");
      const parts = [hydro.landing!, ...hydro.steps!], points: CameraPoint[] = [];
      ok(parts.length > 1, "Both hydro variants include an actual landing and descending flight");
      const center = (part: typeof parts[number]) => part.footprint.reduce((sum, [x, z]) => [sum[0]! + x / part.footprint.length, sum[1]! + z / part.footprint.length], [0, 0]);
      const start = center(parts[0]!), next = center(parts[1]!);
      const dx = next[0]! - start[0]!, dz = next[1]! - start[1]!;
      const dir = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
      for (const [index, part] of parts.entries()) {
        points.push(...part.footprint.map(([x, z]) => [x, part.topY, z] as CameraPoint));
        const front = Math.max(...part.footprint.map(([x, z]) => x * dir[0]! + z * dir[1]!));
        const lower = parts[index + 1]?.topY ?? part.topY - hydro.riser!;
        for (const [x, z] of part.footprint) if (Math.abs(x * dir[0]! + z * dir[1]! - front) < 1e-7) points.push([x, lower, z]);
      }
      const bounds = outlineBounds(parts.flatMap(part => part.footprint)), helper = Reflect.get(cameraRuntime, "accessFlightCameraSubject");
      const subject = typeof helper === "function" ? helper(resolved, layout, outline) : null;
      const preferredAspect = actualAspect({ ...cameraRuntime, focus: "access", resolvedLayout: resolved, layout, outline, infinityZone: zone,
        shelfLoungerEnvelope: [], skimmers: emptySkimmers, ledRow: [] });
      equal(preferredAspect, subject ? componentCameraAspect(subject.points, subject.direction) : undefined,
        "The actual production CameraRig uses the integrated flight's projected aspect, not an absent standalone plan");
      for (const [vw, vh] of viewports) {
        const frame = frameFor(vw, vh, preferredAspect), fit = cameraFrameFit(34, vh, frame);
        const pose = contextualAccessCamera("access", resolved, layout, outline, fit.verticalFov, fit.aspect, zone);
        const label = `Real integrated Access ${variant}/${system}/${length}×${width}/side ${zone?.side ?? "none"}/${vw}×${vh}`;
        ok(pose, `${label}: selecting Access must return the actual hydro flight, not null and a pool-overview fallback`);
        ok(pose!.target[0] >= bounds.minX && pose!.target[0] <= bounds.maxX && pose!.target[2] >= bounds.minZ && pose!.target[2] <= bounds.maxZ,
          `${label}: target lies on the real flight/landing rather than the pool centre`);
        ok(pitch(pose!) >= 25 && pitch(pose!) <= 50, `${label}: real oblique riser-and-tread composition`);
        projectInside(pose!, points, vw, vh, label, frame);
        equal(JSON.stringify(config), before, `${label}: the camera never changes hydro, stored access or inox selections`);
        cases.integratedAccess++;
      }
    }
  }
  for (const stairType of ["linear", "corner"] as const) {
    const config = { ...base, internalStairType: stairType }, resolved = configuredPoolLayout(config), outline = buildOutline(config.shape, config.dimensions, []);
    const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "skimmer", depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
    const helper = Reflect.get(cameraRuntime, "accessFlightCameraSubject"), original = Reflect.get(cameraRuntime, "accessCameraSubject");
    ok(typeof helper === "function", "The selected Access subject resolver exists");
    equal(helper(resolved, layout, outline), original(resolved.access, layout, outline), "Standalone straight/corner Access keeps the exact existing subject rather than being rebuilt for the hydro fix");
  }
}


if (enabled("interior-finish")) {
  const source = readFileSync("src/components/pool/three/PoolScene.tsx", "utf8"), tree = ts.createSourceFile("PoolScene.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rig: Record<string, string> = {};
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const name = node.name.getText(tree);
      if (["detail", "localFraming", "opticalDetail", "fitFov"].includes(name)) rig[name] = node.initializer.getText(tree);
      if (["subjectAspect", "interiorSubject"].includes(name) && ts.isCallExpression(node.initializer)) rig[name] = node.initializer.arguments[0]!.getText(tree);
    }
    if (ts.isCallExpression(node) && node.expression.getText(tree) === "useLayoutEffect") {
      const cb = node.arguments[0];
      if (cb?.getText(tree).includes('canvas.dataset["cameraProjection"]') && ts.isArrowFunction(cb) && ts.isBlock(cb.body)) {
        const end = cb.body.statements.findIndex(s => s.getText(tree).startsWith("goal.current.set"));
        rig.projection = cb.body.statements.slice(0, end).map(s => s.getText(tree)).join("\n");
      }
    }
    ts.forEachChild(node, visit);
  }; visit(tree);
  const evaluate = (text: string, scope: Record<string, unknown>) => new Function("scope", "with(scope){" + ts.transpileModule("const result=(" + text + ");", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + ";return result;}")(scope);
  const project = new Function("scope", "with(scope){" + ts.transpileModule(rig.projection!, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + "}");
  const cameraTree = ts.createSourceFile("camera.ts", readFileSync("src/lib/pool/camera.ts", "utf8"), ts.ScriptTarget.Latest, true);
  for (const node of cameraTree.statements) if (ts.isFunctionDeclaration(node) && node.name && node.name.text in INTERIOR_V.functions) {
    const original = INTERIOR_V.functions[node.name.text as keyof typeof INTERIOR_V.functions];
    const text = node.name.text === "getCameraPose" ? node.getText(cameraTree)
      .replace("\n  interiorSubject,", "")
      .replace("\n  interiorSubject?: ReturnType<typeof interiorFinishCameraSubject>;", "")
      .replace('\n    if ((intent === "liner" || intent === "mosaic") && interiorSubject)\n      return fitComponentCamera(interiorSubject.points, interiorSubject.direction, verticalFov, viewportAspect);', "")
      : node.getText(cameraTree).replace(INFINITY_Y.newSpan, INFINITY_Y.oldSpan);
    equal(createHash("sha256").update(text).digest("hex"), original, "W preserves existing camera algorithms outside its explicit optional interior-subject branch");
  }
  const inPolygon = (x: number, z: number, polygon: readonly (readonly [number, number])[]) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i]!, b = polygon[j]!;
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
  // W390 actual DOM; other viewports reuse the versioned camera UI fixtures.
  // These are viewport emulations, never hardware/performance certification.
  const uiFor = (width: number, height: number, preferred?: number) => width === 390
    ? visibleCameraFrame({ left: 0, top: 0, width, height }, [
      { left: 8, top: 8, width: 374, height: 108 }, { left: 12, top: 132, width: 131.9140625, height: 36 },
      { left: 210.9296875, top: 132, width: 167.0703125, height: 35.046875 },
      { left: 180.921875, top: 293.515625, width: 193.078125, height: 40 }, { left: 289, top: 297.515625, width: 32, height: 32 },
      { left: 334, top: 293.515625, width: 40, height: 40 }, { left: 8, top: 365.515625, width: 374, height: 470.484375 },
    ], preferred) : frameFor(width, height, preferred);
  const fixtures: Array<{ length: number; width: number; system: "skimmer" | "infinity"; side?: number }> = sizes.map(([length, width]) => ({ length, width, system: "skimmer" }));
  fixtures.push({ length: 8, width: 4, system: "infinity", side: 2 });
  for (const { length, width, system, side } of fixtures) {
    const outline = buildOutline("rectangle", { length, width, depth: 1.5, cornerRadius: 0 }, []);
    const zone = side === undefined ? null : infinityZonesForOutline(outline, "rectangle").find(zone => zone.side === side)!;
    ok(side === undefined || zone, "The representative Infinity side is an actual supported zone");
    const config: PoolConfig = { ...base, structure: "reinforced-concrete", finish: "mosaic", skimmerType: "slim",
      dimensions: { length, width, depth: 1.5, cornerRadius: 0, floorProfile: "flat" }, system,
      features: ["sunShelf", "inoxLadder"], internalStairType: "corner",
      ...(zone ? { infinityEdge: { enabled: true, side: zone.side, startT: 0, endT: 1, dropDirection: "outward" as const } } : {}) };
    const initial = JSON.stringify(config), resolvedLayout = configuredPoolLayout(config), layout = getPoolVerticalLayout({ poolType: "in-ground", system, overflowType: config.overflowType, depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
    const floorProfile = buildFloorProfile({ outline, shape: "rectangle", poolType: "in-ground", dimensions: config.dimensions, verticalLayout: layout, sunShelf: true, infinityEdge: config.infinityEdge });
    const material = new MeshBasicMaterial({ side: DoubleSide }), meshes = resolvedLayout.comfort.elements.map(element => new Mesh(shelfStairGeometry(element, floorProfile), material));
    meshes.forEach(mesh => mesh.updateMatrixWorld(true));
    const occupied = resolvedLayout.comfort.elements.flatMap(element => [element.footprint, ...(element.steps ?? []).map(part => part.footprint), ...(element.landing ? [element.landing.footprint] : [])]);
    if (resolvedLayout.access.placement) occupied.push(resolvedLayout.access.footprint);
    if (resolvedLayout.ladder?.plan.placement) occupied.push(resolvedLayout.ladder.plan.footprint);
    for (const [vw, vh] of viewports) {
      const scope: Record<string, unknown> = { ...cameraRuntime, outlineBounds, outline, layout, resolvedLayout, floorProfile, infinityZone: zone, focus: "mosaic",
        skimmers: planSkimmers(outline, length * width, system === "skimmer"), externalStairPlan: null, coverSubject: null, shelfLoungerEnvelope: [],
        ledRow: resolvedLayout.lighting.plan.positions, planBounds: outline, compactPlan: true, SCENE_VISUAL_PRESET, viewportSize: { width: vw, height: vh } };
      const subject = evaluate("(" + rig.interiorSubject + ")()", scope) as NonNullable<ReturnType<typeof cameraRuntime.interiorFinishCameraSubject>>;
      ok(subject, "Each selected fixture has a real material subject; null is not a skipped PASS");
      scope.interiorSubject = subject;
      const preferred = evaluate("(" + rig.subjectAspect + ")()", scope), frame = uiFor(vw, vh, preferred);
      scope.visibleFrame = frame;
      for (const name of ["detail", "localFraming", "opticalDetail", "fitFov"]) scope[name] = evaluate(rig[name]!, scope);
      ok(scope.localFraming && scope.fitFov === 34, "Actual materials Rig uses local34 only when its real subject exists");
      const pose = getCameraPose({ intent: "mosaic", outline, layout, depth: 1.5, skimmers: scope.skimmers as never, verticalFov: scope.fitFov as number, viewportAspect: frame.width / frame.height, infinityZone: zone, interiorSubject: subject });
      equal(getCameraPose({ intent: "liner", outline, layout, depth: 1.5, skimmers: scope.skimmers as never, verticalFov: 34, viewportAspect: frame.width / frame.height, infinityZone: zone, interiorSubject: subject }), pose, "Liner/mosaic identity does not move the shared real material patch");
      ok(inPolygon(pose.position[0], pose.position[2], outline), "Material eye is within the basin, not behind the opposite wall");
      ok(!occupied.some(polygon => inPolygon(pose.position[0], pose.position[2], polygon)), "Material eye is free from actual comfort/access/ladder footprints");
      const camera = new PerspectiveCamera(34, vw / vh, .05, 1000); camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true);
      project({ ...scope, pose, camera, PerspectiveCamera, OrthographicCamera, canvas: { dataset: {} }, coastalHero: false, planFit: { current: null } });
      equal(camera.aspect, frame.width / frame.height, "Actual projection callback preserves material inset aspect");
      for (let i = 0; i < subject.points.length; i += 3) {
        const wall = subject.points[i]!, top = subject.points[i + 1]!, floor = subject.points[i + 2]!;
        ok(outline.some((a, j) => {
          const b = outline[(j + 1) % outline.length]!, dx = b[0] - a[0], dz = b[1] - a[1], t = ((wall[0] - a[0]) * dx + (wall[2] - a[1]) * dz) / (dx * dx + dz * dz);
          return t >= 0 && t <= 1 && Math.hypot(wall[0] - a[0] - t * dx, wall[2] - a[1] - t * dz) < 1e-7 && (!zone || j !== zone.side);
        }), "Wall samples lie on real non-Infinity shell edges");
        equal(wall[1], floorProfile.floorYAt(wall[0], wall[2]), "Wall bottom uses the real floor profile");
        equal(top[1], Math.min(layout.wallTopY, wall[1] + .8), "Wall patch height is derived from its floor");
        ok(Math.abs(Math.hypot(floor[0] - wall[0], floor[2] - wall[2]) - .75) < 1e-9 && inPolygon(floor[0], floor[2], outline), "Floor patch extends .75m inside the real basin");
        equal(floor[1], floorProfile.floorYAt(floor[0], floor[2]), "Floor samples use actual elevations");
      }
      ok(new Vector3(...subject.points[0]!).distanceTo(new Vector3(...subject.points[6]!)) <= 1.25 + 1e-9, "Material subject is a local1.25m patch, not the whole pool");
      for (const point of subject.points) {
        const v = new Vector3(...point), q = v.clone().project(camera), x = (q.x + 1) * vw / 2, y = (1 - q.y) * vh / 2;
        ok(q.z > -1 && q.z < 1 && x > frame.left && x < frame.left + frame.width && y > frame.top && y < frame.top + frame.height, "Every real wall/floor point fits the free optical frame");
        if (system !== "infinity") ok(-v.clone().applyMatrix4(camera.matrixWorldInverse).z < Math.hypot(length, width) / 2 * 6, "Real material points remain before unchanged fogNear");
        const distance = camera.position.distanceTo(v), hits = new Raycaster(camera.position, v.clone().sub(camera.position).normalize(), 0, distance - 1e-5).intersectObjects(meshes, false);
        ok(hits.length === 0, "Actual merged comfort geometry does not hide the patch");
      }
      for (const focus of ["infinity", "coping", "waterline", "review", "access", "inox", "shelf", "features", "stair-lighting", "bench-lighting", "top", "paving", "exterior-panel"] as const)
        equal(evaluate("(" + rig.interiorSubject + ")()", { ...scope, focus }), null, "Other intents cannot inherit the material subject");
      equal(JSON.stringify(config), initial, "Material framing preserves all saved values");
      cases.interiorFinish++;
    }
    meshes.forEach(mesh => mesh.geometry.dispose()); material.dispose();
  }
}


if (enabled("material-entry")) {
  const path = "src/components/pool/PoolConfigurator.tsx", tree = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let focusText = "", resetText = "", resetDeps = "";
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === "focus" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression?.getText(tree).includes("inspectionView")) focusText = node.initializer.expression.getText(tree);
    if (ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect" && node.arguments[0]?.getText(tree) === "() => setInspectionView(null)") {
      resetText = node.arguments[0]!.getText(tree); resetDeps = node.arguments[1]!.getText(tree);
    }
    ts.forEachChild(node, visit);
  }; visit(tree);
  ok(focusText && resetText && resetDeps, "Read actual render focus and inspection-reset callback/dependencies");
  const evaluate = (text: string, scope: Record<string, unknown>) => new Function(...Object.keys(scope), "return (" + text + ");")(...Object.values(scope));
  for (const system of ["skimmer", "infinity"] as const) for (const finish of ["mosaic", "liner", "none"] as const) {
    const config = freeze({ ...base, system, finish });
    const project = toProjectConfiguration("material-entry-fixture", config, { areas: [], currentFinish: "liner", filtrationWorks: [], replaceCoping: null, copingMaterial: "", structureIssues: [], equipmentUpgrades: [] });
    let state: Parameters<typeof reducer>[0] = { config, projectId: project.projectId, renovation: project.renovation, step: STEPS.findIndex(step => step.id === "review"), visualFocus: null };
    let inspectionView: string | null = null, previousDeps: unknown[] | undefined;
    const scope = (extra: Record<string, unknown> = {}) => ({ config: state.config, visualFocus: state.visualFocus, step: state.step,
      activeStepId: STEPS[state.step]?.id, decision: { id: "interior" }, inspectionView, cleanCapture: false, dayNightCapture: false,
      renovationWorkflow: false, technicalView: false, cameraFocus: "review", wholePoolIntent, contextualIntent,
      setInspectionView: (value: string | null) => { inspectionView = value; }, ...extra });
    const commit = () => { const values = scope(), deps = evaluate(resetDeps, values) as unknown[]; if (!previousDeps || deps.some((v, i) => !Object.is(v, previousDeps![i]))) evaluate(resetText, values)(); previousDeps = deps; };
    const selected = finish === "mosaic" ? "mosaic" : "liner", initial = JSON.stringify(config), style = STEPS.findIndex(step => step.id === "style");
    commit(); state = reducer(state, { type: "goToStep", value: style }); commit();
    equal(state.visualFocus, null, "Real wizard navigation clears only ephemeral focus");
    equal(evaluate(INTERIOR_V.focusExpression, scope()), "review", "Portable V oracle reproduces entry-without-reselection defect");
    equal(evaluate(focusText, scope()), selected, "Style/interior frames the saved finish without choosing it again");
    equal(JSON.stringify(state.config), initial, "Entering the decision does not mutate configuration");
    const colourAction = finish === "mosaic" ? { type: "setMosaicFinish" as const, value: state.config.mosaicFinish } : { type: "setLinerColor" as const, value: state.config.linerColor };
    state = reducer(state, colourAction); commit();
    equal(evaluate(focusText, scope()), selected, "First actual material action keeps the relevant detail");
    inspectionView = "top"; const stableFocus = state.visualFocus;
    state = reducer(state, colourAction); commit();
    equal(state.visualFocus, stableFocus, "Repeating the same colour preserves stable focus identity");
    equal(evaluate(focusText, scope()), "top", "Repeated selection preserves deliberate manual inspection");
    equal(evaluate(focusText, scope({ visualFocus: { focus: "INOX", revision: 12 }, inspectionView: null })), "inox", "Inox access inspection is not confused with steel interior finish");
    equal(evaluate(focusText, scope({ inspectionView: null, technicalView: true })), system === "infinity" ? "top" : "review", "Technical-view priority remains ahead of material entry");
    equal(evaluate(focusText, scope({ cleanCapture: true })), "review", "Clean exports retain whole-pool review");
    for (const extra of [{ activeStepId: "style", decision: { id: "exterior" }, visualFocus: null, inspectionView: null }, { activeStepId: "deck", visualFocus: null, inspectionView: null }])
      equal(evaluate(focusText, scope(extra)), evaluate(INTERIOR_V.focusExpression, scope(extra)), "Exterior and unrelated navigation retain the previous resolver");
    const saved = serializeProjectConfiguration(toProjectConfiguration(state.projectId, state.config, state.renovation)), link = { publicRef: "PW-AAAA-AAAAAA", savedSnapshot: saved };
    state = reducer(state, { type: "goToStep", value: STEPS.findIndex(step => step.id === "review") }); commit();
    state = reducer(state, { type: "goToStep", value: style }); commit();
    equal(evaluate(focusText, scope()), selected, "Summary to Style returns to saved material detail");
    equal(projectLinkIsDirty(link, toProjectConfiguration(state.projectId, state.config, state.renovation)), false, "Camera/navigation creates no false dirty-state change");
    equal(JSON.stringify(state.config), initial, "Repeated colour/camera decisions preserve all selections");
    cases.materialEntry++;
  }
}

if (enabled("lighting-entry")) {
  // Parse the actual callbacks and dependency arrays, then execute them in
  // declaration order with React-style Object.is dependency scheduling.
  // This is an effect/state contract test, not a browser-event timing claim.
  const sourcePath = process.argv.includes("--candidate-f")
    ? "docs/fullscreen-qa-evidence/premium-live-cameras/PoolConfigurator-f-before-g-20261015.tsx"
    : "src/components/pool/PoolConfigurator.tsx";
  const source = readFileSync(sourcePath, "utf8"), tree = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const traySource = readFileSync("src/components/pool/wizard/StepTrays.tsx", "utf8"), trayTree = ts.createSourceFile("StepTrays.tsx", traySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function nodes(root: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node[] {
    const result: ts.Node[] = []; const visit = (node: ts.Node) => { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); }; visit(root); return result;
  }
  const effects = nodes(tree, node => ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect")
    .map(node => node as ts.CallExpression).filter(call => call.arguments[0]?.getText(tree).includes("setInspectionView") &&
      /(?:step|activeStepId)/.test(call.arguments[1]?.getText(tree) ?? ""))
    .map(call => ({ callback: call.arguments[0]!.getText(tree), deps: call.arguments[1]!.getText(tree) }));
  ok(effects.length >= 2, "The real inspection-reset and decision effects are parsed, not replaced by a source-presence assertion");
  const focusNode = nodes(tree, node => ts.isJsxAttribute(node) && node.name.getText(tree) === "focus" &&
    !!node.initializer && ts.isJsxExpression(node.initializer) && !!node.initializer.expression && node.initializer.expression.getText(tree).includes("inspectionView"))[0] as ts.JsxAttribute;
  ok(focusNode && focusNode.initializer && ts.isJsxExpression(focusNode.initializer) && focusNode.initializer.expression, "The actual viewport focus expression is executable");
  const focusText = (focusNode.initializer as ts.JsxExpression).expression!.getText(tree);
  const lightTray = nodes(trayTree, node => ts.isFunctionDeclaration(node) && node.name?.text === "LightTray")[0]!;
  const nightEffect = (nodes(lightTray, node => ts.isCallExpression(node) && node.expression.getText(trayTree) === "useEffect" &&
    node.arguments[0]?.getText(trayTree).includes('tab === "color"'))[0] as ts.CallExpression).arguments[0]!.getText(trayTree);
  const tabChange = nodes(lightTray, node => ts.isJsxAttribute(node) && node.name.getText(trayTree) === "onChange" &&
    !!node.initializer && node.initializer.getText(trayTree).includes("setTab(next)"))[0] as ts.JsxAttribute;
  const changeText = (tabChange.initializer as ts.JsxExpression).expression!.getText(trayTree);
  const evaluate = (expression: string, scope: Record<string, unknown>) => new Function(...Object.keys(scope), `return (${expression});`)(...Object.values(scope));
  for (const system of ["skimmer", "overflow", "infinity"] as const) for (const previous of ["STAIR_LIGHTING", "BENCH_LIGHTING"] as const) {
    const config = freeze({ ...base, system, sceneTime: "night" as const, ledColor: "#ff0000", ledIntensity: .6,
      features: ["ledLighting", "stairLighting", "hydromassage", "hydromassageBenchLighting"] as const,
      ...(system === "infinity" ? { infinityEdge: { enabled: true, side: 2, startT: 0, endT: 1, dropDirection: "outward" as const } } : {}) });
    const project = toProjectConfiguration("camera-entry-fixture", config, { areas: [], currentFinish: "liner", filtrationWorks: [], replaceCoping: null,
      copingMaterial: "", structureIssues: [], equipmentUpgrades: [] });
    let state: Parameters<typeof reducer>[0] = { config, renovation: project.renovation, projectId: project.projectId, step: 7,
      visualFocus: { focus: previous, revision: 2 } };
    const initial = JSON.stringify(state.config), savedSnapshot = serializeProjectConfiguration(project), link = { publicRef: "PW-AAAA-AAAAAA", savedSnapshot };
    let inspectionView: string | null = null, decisionId = "lighting", reframes = 0, nightDispatches = 0;
    const reframe = () => { reframes++; }, previousDeps: unknown[][] = [];
    const scope = () => ({ step: state.step, visualFocus: state.visualFocus, activeStepId: "lighting", decision: { id: decisionId }, config: state.config,
      reframe, setInspectionView: (value: string | null) => { inspectionView = value; }, inspectionView, cleanCapture: false,
      dayNightCapture: false, renovationWorkflow: false, technicalView: false, wholePoolIntent, contextualIntent, cameraFocus: "features" });
    const commitParentEffects = () => {
      const render = scope();
      for (const [index, effect] of effects.entries()) {
        const deps = evaluate(effect.deps, render) as unknown[], old = previousDeps[index];
        previousDeps[index] = deps;
        if (!old || deps.some((value, i) => !Object.is(value, old[i]))) evaluate(effect.callback, render)();
      }
    };
    const actualFocus = () => evaluate(focusText, scope());
    const setSceneTime = (value: "day" | "night") => { nightDispatches++; state = reducer(state, { type: "setSceneTime", value }); };
    commitParentEffects();
    equal(actualFocus(), previous === "STAIR_LIGHTING" ? "stair-lighting" : "bench-lighting", "Fixture begins with the real independent micro-light camera");
    evaluate(changeText, { setTab: (id: string) => { decisionId = id; }, setSceneTime, hasLed: true })("color");
    commitParentEffects();
    equal(actualFocus(), "features", `${system}/${previous}: entering the colour decision focuses main RGB without choosing a new colour`);
    // The actual child mount/tab effect dispatches Night a second time in a
    // later commit. It preserves the micro-focus but creates a new revision.
    evaluate(nightEffect, { tab: decisionId, hasLed: true, setSceneTime })();
    commitParentEffects();
    equal(nightDispatches, 2, "Both actual LightTray night-preview dispatch paths were executed");
    equal(actualFocus(), "features", `${system}/${previous}: the later Night commit cannot clear main-colour inspection back to micro-light focus`);
    equal(JSON.stringify(state.config), initial, "Opening colour from an already-night micro preview changes no technical, material, colour or light selection");
    equal(state.projectId, project.projectId, "Opening a camera decision preserves project identity");
    equal(state.step, 7, "Opening a camera decision does not navigate the wizard");
    equal(projectLinkIsDirty(link, toProjectConfiguration(state.projectId, state.config, state.renovation)), false, "The real saved-snapshot dirty predicate remains false without a product change");
    state = reducer(state, { type: "setLedColor", value: "#0000ff" }); commitParentEffects();
    equal(actualFocus(), "features", "The first actual main RGB selection can leave micro focus");
    const stableFocus = state.visualFocus, settledFrames = reframes;
    inspectionView = "access"; // User deliberately chooses another inspection after colour settles.
    state = reducer(state, { type: "setLedColor", value: "#00ffff" }); commitParentEffects();
    equal(state.visualFocus, stableFocus, "Subsequent RGB colours retain the actual stable LIGHTING focus request");
    equal(reframes, settledFrames, "A colour-only comparison does not restart framing");
    equal(actualFocus(), "access", "A later colour-only update preserves a deliberate manual inspection");
    equal(state.config.features, config.features, "Main RGB comparisons preserve stair, bench and main light optional selections");
  }
}

if (enabled("state")) {
const project = toProjectConfiguration("premium-camera-state", base, { areas: [], currentFinish: "liner", filtrationWorks: [], replaceCoping: null,
  copingMaterial: "", structureIssues: [], equipmentUpgrades: [] });
const saved = serializeProjectConfiguration(project), restored = parseProjectConfiguration(saved);
for (const focus of ["SUN_SHELF", "INFINITY", "STAIRS", "INOX", "HYDROMASSAGE", "SKIMMER", "OVERFLOW", "INTERIOR_FINISH", "COPING", "PAVING", "LIGHTING", "STAIR_LIGHTING", "EXTERIOR_PANEL", "EXTERNAL_STAIRS", "PELLICANO", "COVER"] as const) {
  const snapshot = JSON.stringify(restored.config), request = nextFocusRequest({ focus: "SUN_SHELF", revision: 1 }, focus);
  equal(request?.focus, focus, "New focus replaces previous semantic selection; it does not queue an old request");
  equal(JSON.stringify(restored.config), snapshot, "Ephemeral camera request leaves canonical configuration unchanged");
  equal(serializeProjectConfiguration(restored), serializeProjectConfiguration(parseProjectConfiguration(saved)), "Camera request cannot create a dirty canonical snapshot");
  cases.state++;
}
const previous = { focus: "HYDROMASSAGE" as const, revision: 3 };
equal(nextFocusRequest(previous, focusForAction({ type: "setSceneTime", preserveCamera: true }, restored.config)), previous, "Preserved day/night preference does not change camera focus or revision");
ok(!Object.hasOwn(restored, "visualFocus") && !Object.hasOwn(restored.config, "visualFocus") && !Object.hasOwn(restored.config, "camera"),
  "No camera pose/focus is persisted into technical project data");
}
if (enabled("routing")) {
  for (const system of ["skimmer", "overflow", "infinity"] as const) {
    const config = freeze({ ...base, system, features: ["ledLighting", "stairLighting", "sunShelf"] as const });
    const decisions = [["INTERIOR_FINISH", "liner"], ["COPING", "coping"], ["PAVING", "paving"], ["LIGHTING", "features"],
      ["STAIR_LIGHTING", "stair-lighting"], ["BENCH_LIGHTING", "bench-lighting"], ["SUN_SHELF", "shelf"], ["HYDROMASSAGE", "hydromassage"], ["INOX", "inox"],
      ["PELLICANO", "pellicano"]] as const;
    for (const [focus, intent] of decisions) {
      equal(contextualIntent(focus, config), intent, `${system}: selection maps to its real element, not Infinity overview`);
      for (const step of ["system", "access", "style", "lighting", "deck", "technology"]) {
        equal(wholePoolIntent(intent, step, system), intent, `${system}/${step}: selected detail cannot be silently replaced by review`);
      }
      equal(wholePoolIntent(intent, "review", system), "review", `${system}: final summary still shows the whole pool`);
      cases.routing++;
    }
    equal(contextualIntent("INTERIOR_FINISH", { ...config, finish: "mosaic" }), "mosaic", `${system}: mosaic uses the interior material detail`);
  }
  equal(focusForAction({ type: "setInfinityWall", value: "glass" }, { ...base, system: "infinity" }), "INFINITY",
    "Choosing the real glass/traditional wall re-frames the selected Infinity edge");
  for (const focus of ["DIMENSIONS_TOP", "DEPTH", "INTERIOR_FINISH", "COPING", "PAVING", "LIGHTING"] as const) {
    const previous = { focus, revision: 7 };
    equal(nextFocusRequest(previous, focus), previous, `${focus}: same-detail colour/format edits do not queue a fresh camera reframe`);
    equal(nextFocusRequest(previous, "SUN_SHELF"), { focus: "SUN_SHELF", revision: 8 }, `${focus}: a different object still requests a new immediate target`);
  }
  for (const system of ["skimmer", "overflow", "infinity"] as const) {
    const lit = { ...base, system, features: ["ledLighting", "stairLighting", "hydromassage", "hydromassageBenchLighting"] as const };
    for (const [feature, focus] of [["stairLighting", "STAIR_LIGHTING"], ["hydromassageBenchLighting", "BENCH_LIGHTING"]] as const) {
      equal(focusForAction({ type: "togglePoolFeature", value: feature }, lit), focus, `${system}: micro-light optional has its own detail`);
      equal(focusForAction({ type: "setSceneTime", value: "night" }, lit, focus), focus, `${system}: the contextual night action cannot overwrite ${focus} with RGB overview`);
      equal(focusForAction({ type: "setSceneTime", value: "day", preserveCamera: true }, lit, focus), undefined, `${system}: global day/night never overrides a deliberately preserved camera`);
    }
    equal(focusForAction({ type: "setSceneTime", value: "night" }, { ...lit, features: ["stairLighting"] }), "STAIR_LIGHTING", `${system}: stair-only night preview targets actual risers`);
    equal(focusForAction({ type: "setSceneTime", value: "night" }, { ...lit, features: ["hydromassage", "hydromassageBenchLighting"] }), "BENCH_LIGHTING", `${system}: bench-only night preview targets actual seat-front fittings`);
    equal(focusForAction({ type: "setLedColor", value: "#ff0000" }, lit, "BENCH_LIGHTING"), "LIGHTING", `${system}: choosing main RGB is allowed to leave the micro-light detail`);
  }
}
if (enabled("coping")) {
  for (const [length, width] of sizes) {
    const config = { ...base, dimensions: { ...base.dimensions, length, width } }, outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
    const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "infinity", depth: config.dimensions.depth, copingThickness: POOL_BORDER_PRESET.thickness });
    for (const zone of infinityZonesForOutline(outline, config.shape)) {
      const oracle = copingOracle(outline, zone, layout);
      const helper = Reflect.get(cameraRuntime, "infinityCopingCameraSubject");
      const runtimeSubject = typeof helper === "function" ? helper(outline, zone, layout) : oracle;
      const aspect = componentCameraAspect(runtimeSubject.points, runtimeSubject.direction);
      for (const [vw, vh] of viewports) {
        // The real failed coping capture has no construction-stage badge.
        // The 430 fixture remains the captured, more conservative full UI.
        const mobile = capturedMobileUI[vw], overlays = vw === 390 ? mobile!.overlays.filter((_, index) => index !== 2) : mobile?.overlays;
        const frame = mobile ? visibleCameraFrame(mobile.canvas, overlays!, aspect) : frameFor(vw, vh, aspect), fit = cameraFrameFit(34, vh, frame);
        const pose = getCameraPose({ intent: "coping", outline, infinityZone: zone, layout, depth: config.dimensions.depth, skimmers: emptySkimmers,
          verticalFov: fit.verticalFov, viewportAspect: fit.aspect });
        const label = `Infinity coping actual slab ${length}×${width}/side ${zone.side}/${vw}×${vh}`;
        ok(pose.position[1] > layout.copingY, `${label}: the eye is above the real coping, not below its fascia`);
        projectInside(pose, oracle.points, vw, vh, label, frame);
        cases.coping++;
      }
    }
  }
}
if (enabled("overflow")) {
  for (const [length, width] of sizes) for (const overflowType of ["hidden", "visible"] as const) {
    const config = { ...base, dimensions: { ...base.dimensions, length, width } }, outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
    const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "overflow", overflowType, depth: config.dimensions.depth, copingThickness: POOL_BORDER_PRESET.thickness });
    const oracle = overflowOracle(outline, layout, overflowType === "visible"), intent = overflowType === "visible" ? "overflow-visible" : "overflow-hidden";
    const helper = Reflect.get(cameraRuntime, "overflowCameraSubject");
    const runtimeSubject = typeof helper === "function" ? helper(intent, outline, layout, emptySkimmers) : oracle;
    const aspect = componentCameraAspect(runtimeSubject.points, runtimeSubject.direction);
    for (const [vw, vh] of viewports) {
      const frame = frameFor(vw, vh, aspect), fit = cameraFrameFit(34, vh, frame);
      const pose = getCameraPose({ intent, outline, layout, depth: config.dimensions.depth, skimmers: emptySkimmers,
        verticalFov: fit.verticalFov, viewportAspect: fit.aspect });
      const light = oracle.skimmers.positions[Math.floor(oracle.skimmers.positions.length / 2)]!, nx = Math.sin(light.rotation), nz = Math.cos(light.rotation);
      const rx = pose.position[0] - pose.target[0], rz = pose.position[2] - pose.target[2], normal = rx * nx + rz * nz, tangent = rx * nz - rz * nx;
      const label = `${intent} actual slot/grille ${length}×${width}/${vw}×${vh}`;
      ok(Math.abs(tangent / normal) > .2 && Math.abs(tangent / normal) < .7, `${label}: real oblique boundary view, not a frontal wall portrait`);
      ok(pitch(pose) > 30 && pitch(pose) < 60, `${label}: raised angle explains the top slot/grille, not just the vertical wall`);
      projectInside(pose, oracle.points, vw, vh, label, frame);
      cases.overflow++;
    }
  }
}
if (enabled("lighting") || section === "lighting-main" || section === "lighting-micro") {
  for (const [length, width] of sizes) for (const system of ["skimmer", "overflow", "infinity"] as const) {
    const config = { ...base, system, dimensions: { ...base.dimensions, length, width } }, outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
    const zones = system === "infinity" ? infinityZonesForOutline(outline, config.shape) : [null];
    const layout = getPoolVerticalLayout({ poolType: "in-ground", system, overflowType: "hidden", depth: config.dimensions.depth, copingThickness: POOL_BORDER_PRESET.thickness });
    for (const zone of zones) {
      const edge = zone ? { infinityEdge: { enabled: true, side: zone.side, startT: 0, endT: 1, dropDirection: "outward" as const } } : {};
      const lit = freeze({ ...config, ...edge, features: ["ledLighting"] as const }), before = JSON.stringify(lit), resolved = configuredPoolLayout(lit), row = resolved.lighting.plan.positions;
      ok(row.length > 0, "The selected fixture has real RGB luminaires; the camera does not invent them");
      const mainHelper = Reflect.get(cameraRuntime, "lightingCameraSubject"), mainSubject = typeof mainHelper === "function" ? mainHelper(outline, layout, row) : null;
      const mainAspect = mainSubject ? componentCameraAspect(mainSubject.points, mainSubject.direction) : undefined;
      if (section !== "lighting-micro") for (const [vw, vh] of viewports) {
        const frame = frameFor(vw, vh, mainAspect), fit = cameraFrameFit(34, vh, frame);
        const pose = getCameraPose({ intent: "features", outline, infinityZone: zone, layout, depth: config.dimensions.depth, skimmers: emptySkimmers,
          ledRow: row, verticalFov: fit.verticalFov, viewportAspect: fit.aspect });
        const direction = new Vector3(...pose.position).sub(new Vector3(...pose.target));
        const bounds = outlineBounds(outline), longX = bounds.spanX >= bounds.spanZ;
        ok(longX ? Math.abs(direction.x) > Math.abs(direction.z) * 2 : Math.abs(direction.z) > Math.abs(direction.x) * 2,
          `${system}/${length}×${width}: main LED view is from the actual short side, not the long wall`);
        const points: CameraPoint[] = row.flatMap(light => [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(angle => {
          const r = POOL_LUMINAIRE.diameter / 2;
          return [light.x + Math.cos(light.rotation) * Math.cos(angle) * r, light.y + Math.sin(angle) * r,
            light.z - Math.sin(light.rotation) * Math.cos(angle) * r] as CameraPoint;
        }));
        points.push(...outline.flatMap(([x, z]) => [[x, layout.floorY, z], [x, layout.copingY, z]] as CameraPoint[]));
        projectInside(pose, points, vw, vh, `${system}/main LED row/${length}×${width}/side ${zone?.side ?? "none"}/${vw}×${vh}`, frame);
        for (const color of ["#ff0000", "#0000ff", "#ffffff", "#00ff00", "#00ffff", "#ff00ff", "#ffbf00"]) {
          const colored = { ...lit, ledColor: color };
          equal(configuredPoolLayout(colored).lighting.plan.positions, row, "RGB colour never moves/adds/removes real luminaires");
          equal(nextFocusRequest({ focus: "LIGHTING", revision: 4 }, focusForAction({ type: "setLedColor", value: color }, colored)),
            { focus: "LIGHTING", revision: 4 }, "RGB colour does not restart a completed camera transition");
        }
        equal(JSON.stringify(lit), before, "LED camera cannot change selected lights, day/night, geometry or technical state");
        cases.lighting++;
      }
      if (section !== "lighting-main") for (const variant of ["open", "closed"] as const) for (const kind of ["stair-lighting", "bench-lighting"] as const) {
        const microConfig = freeze({ ...config, ...edge, features: ["hydromassage", "stairLighting", "hydromassageBenchLighting"] as const, hydromassageVariant: variant });
        const micro = configuredPoolLayout(microConfig), spots = kind === "stair-lighting" ? micro.stairMicroSpots
          : micro.comfort.elements.find(element => element.kind === "hydromassage")?.spots ?? [];
        if (!spots.length) continue;
        const detailSpots = kind === "stair-lighting" ? centralRiserSpots(spots) : spots;
        const detailLevels = new Set(detailSpots.map(spot => Math.round(spot.y * 1e7) / 1e7));
        if (kind === "stair-lighting") equal(detailLevels.size, Math.min(3, new Set(spots.map(spot => Math.round(spot.y * 1e7) / 1e7)).size), "Micro-light detail selects three consecutive real risers; all treads remain covered by Access");
        else equal(detailSpots.length, spots.length, "Bench-light detail retains every actually installed under-seat spot");
        const helper = Reflect.get(cameraRuntime, "microLightCameraSubject"), subject = typeof helper === "function" ? helper(kind, micro, layout, outline) : null;
        const preferredAspect = subject ? componentCameraAspect(subject.points, subject.direction) : undefined;
        const beforeMicro = JSON.stringify(microConfig);
        for (const [vw, vh] of viewports) {
          const frame = frameFor(vw, vh, preferredAspect), fit = cameraFrameFit(34, vh, frame);
          const localBench = kind === "bench-lighting";
          const pose = contextualAccessCamera(kind, micro, layout, outline, localBench ? 34 : fit.verticalFov, fit.aspect, zone);
          ok(pose, `${kind}: actual selected fittings have a dedicated resolved camera`);
          if (kind === "stair-lighting") ok(pitch(pose!) >= 20 && pitch(pose!) <= 45, `${kind}: the selected stair risers retain their approved oblique view (${pitch(pose!)}°)`);
          else {
            // U supersedes T's rejected head-only closed-bench pose. The
            // vertical solution is verified against real opaque geometry
            // by PC13; do not replace that with another arbitrary pitch cap.
            const hydro = micro.comfort.elements.find(element => element.kind === "hydromassage")!, back = hydro.tiers!.find(tier => tier.role === "backSeat")!;
            const head = spots.find(spot => Math.abs(Math.max(...back.footprint.map(([x, z]) => x * spot.dir[0] + z * spot.dir[1])) - spot.x * spot.dir[0] - spot.z * spot.dir[1]) < 1e-7)!.dir;
            const front = hydro.tiers!.find(tier => tier.role === "frontWall"), sx = spots.reduce((sum, spot) => sum + spot.dir[0], 0), sz = spots.reduce((sum, spot) => sum + spot.dir[1], 0), norm = Math.hypot(sx, sz);
            const expected = front ? new Vector3(sx / norm + sz / norm * .2, 0, sz / norm - sx / norm * .2).normalize() : new Vector3(head[0], 0, head[1]);
            const direction = new Vector3(pose!.position[0] - pose!.target[0], 0, pose!.position[2] - pose!.target[2]).normalize();
            ok(direction.distanceTo(expected) < 1e-9, "Closed/open bench retains its exact geometry-based horizontal axis while actual ray clearance derives eye height");
            const footwell = hydro.tiers!.find(tier => tier.role === "tubFloor")!, bounds = outlineBounds(footwell.footprint);
            ok(pose!.target[0] > bounds.minX && pose!.target[0] < bounds.maxX && pose!.target[2] > bounds.minZ && pose!.target[2] < bounds.maxZ, "Bench target belongs to the real footwell, not an arbitrary whole-pool centre");
          }
          const points = microFacePoints(detailSpots);
          if (localBench) {
            const camera = new PerspectiveCamera(34, vw / vh, .05, 1000); camera.position.set(...pose!.position); camera.lookAt(new Vector3(...pose!.target)); camera.updateMatrixWorld(true);
            camera.setViewOffset(frame.width, frame.height, -frame.left, -frame.top, vw, vh);
            equal(camera.position.toArray(), pose!.position, "Local bench UI projection leaves the physical eye unchanged");
            ok(camera.getWorldDirection(new Vector3()).distanceTo(new Vector3(...pose!.target).sub(new Vector3(...pose!.position)).normalize()) < 1e-10, "Local bench UI projection leaves the selected viewing direction unchanged");
            for (const point of points) {
              const q = new Vector3(...point).project(camera), x = (q.x + 1) * vw / 2, y = (1 - q.y) * vh / 2;
              ok(q.z > -1 && q.z < 1, "Actual bench fittings retain real near/far clearance");
              ok(x > frame.left + frame.width * .02 && x < frame.left + frame.width * .98 && y > frame.top + frame.height * .02 && y < frame.top + frame.height * .98, "Actual bench fittings retain the original2% unobscured UI framing margin with the local optical lens");
            }
          } else projectInside(pose!, points, vw, vh, `${system}/${kind}/${length}×${width}/${variant}/side ${zone?.side ?? "none"}/${vw}×${vh}`, frame);
          const main = getCameraPose({ intent: "features", outline, infinityZone: zone, layout, depth: config.dimensions.depth, skimmers: emptySkimmers,
            ledRow: micro.lighting.plan.positions, verticalFov: fit.verticalFov, viewportAspect: fit.aspect });
          ok(JSON.stringify(pose) !== JSON.stringify(main), "Riser/bench fitting view is not the main RGB basin overview");
          equal(JSON.stringify(microConfig), beforeMicro, "Micro-light camera never changes independent light selections");
          cases.lighting++;
        }
      }
      if (section !== "lighting-main") for (const stairType of ["linear", "corner"] as const) {
        const selected = freeze({ ...config, ...edge, internalStairType: stairType, features: ["stairLighting"] as const });
        const before = JSON.stringify(selected), micro = configuredPoolLayout(selected), allSpots = micro.stairMicroSpots;
        if (!allSpots.length) { ok(!!micro.access.reason, "Unavailable standalone riser lights are not fabricated"); continue; }
        const spots = centralRiserSpots(allSpots), helper = Reflect.get(cameraRuntime, "microLightCameraSubject");
        const subject = typeof helper === "function" ? helper("stair-lighting", micro, layout, outline) : null;
        const preferredAspect = subject ? componentCameraAspect(subject.points, subject.direction) : undefined;
        equal(new Set(spots.map(spot => Math.round(spot.y * 1e7) / 1e7)).size,
          Math.min(3, new Set(allSpots.map(spot => Math.round(spot.y * 1e7) / 1e7)).size), "Standalone micro detail retains all real fittings on three central consecutive risers");
        for (const [vw, vh] of viewports) {
          const frame = frameFor(vw, vh, preferredAspect), fit = cameraFrameFit(34, vh, frame);
          const pose = contextualAccessCamera("stair-lighting", micro, layout, outline, fit.verticalFov, fit.aspect, zone);
          const label = `Standalone ${stairType} micro/${system}/${length}×${width}/side ${zone?.side ?? "none"}/${vw}×${vh}`;
          ok(pose, `${label}: actual selected riser lights have a dedicated pose`);
          ok(pitch(pose!) >= 20 && pitch(pose!) <= 45, `${label}: circular fittings remain oblique, not a distant plan view (${pitch(pose!)}°)`);
          projectInside(pose!, microFacePoints(spots), vw, vh, label, frame);
          equal(JSON.stringify(selected), before, `${label}: camera never removes the other real riser lights`);
          cases.lighting++;
        }
      }
    }
  }
}
if (enabled("motion")) {
  // Execute the actual production frame callback with lightweight mutable
  // camera/control objects. This is an animation-state unit test, NOT proof
  // of browser frame pacing, pointer handling or perceived smoothness.
  const scene = readFileSync("src/components/pool/three/PoolScene.tsx", "utf8");
  const marker = "useFrame((_, delta) => {", frameStart = scene.lastIndexOf(marker), frameEnd = scene.indexOf("\n  });", frameStart);
  ok(frameStart > 0 && frameEnd > frameStart, "Production camera-flight callback is identifiable");
  const frameBody = scene.slice(frameStart + marker.length, frameEnd);
  const refs = "camera,controls,goal,lookAt,startPosition,startTarget,elapsed,duration,flying,navigationLimits,photoMode,radius";
  const frame = new Function("scope", "delta", `const {${refs}}=scope; ${frameBody}`);
  const resetStart = scene.indexOf("goal.current.set(...pose.position);"), resetEnd = scene.indexOf("    const control = controls.current;", resetStart);
  const elapsedReset = scene.slice(resetEnd).match(/elapsed\.current = 0;/)?.[0];
  ok(elapsedReset, "Every new production selection resets its animation timer");
  const retarget = new Function("scope", "pose", `const {${refs}}=scope; ${scene.slice(resetStart, resetEnd)} ${elapsedReset}`);
  const durationExpression = scene.match(/duration\.current = ([^;]+);/)?.[1];
  ok(durationExpression, "Duration comes from the actual production selection effect");
  const chooseDuration = new Function("reducedMotion", "largeMove", "detail", `return ${durationExpression}`);
  const preferenceExpression = scene.match(/const reducedMotion = ([^;]+);/)?.[1];
  ok(preferenceExpression, "Production duration reads the actual reduced-motion preference");
  const readPreference = new Function("window", `return ${preferenceExpression}`);
  for (const matches of [false, true]) equal(readPreference({ matchMedia(query: string) {
    equal(query, "(prefers-reduced-motion: reduce)", "The camera reads the proper user-preference media query"); return { matches };
  } }), matches, "Reduced-motion preference reaches the production animation decision");
  const snapGuard = scene.slice(scene.indexOf("renderQualityState.locked = cameraLocked;")).match(/if \(([^\n]+)\) \{/)?.[1];
  ok(snapGuard, "Immediate-projection guard comes from the actual production effect");
  const mustSnap = new Function("cameraLocked", "infinityZone", "focus", `return ${snapGuard}`);
  for (const focus of ["infinity", "shelf", "access", "inox", "hydromassage", "bench-lighting", "stair-lighting", "features", "coping", "paving", "liner", "mosaic"]) {
    equal(mustSnap(false, {}, focus), false, `${focus}: an Infinity context alone must not force a snap`);
    equal(chooseDuration(false, true, true), .24, `${focus}: even a large detail-to-detail move lasts 240 ms`);
    equal(chooseDuration(true, true, true), 0, `${focus}: reduced motion completes without animated travel`);
    cases.motion++;
  }
  const openAssignment = scene.match(/Object\.assign\(control, (\{ minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity, minDistance: 0\.05,[\s\S]+?\})\);/)?.[1];
  ok(openAssignment, "Flight explicitly releases the old/destination orbit limits before interpolation");
  const openLimits = new Function(`return (${openAssignment})`)();
  equal([openLimits.minAzimuthAngle, openLimits.maxAzimuthAngle, openLimits.minPolarAngle, openLimits.maxPolarAngle],
    [-Infinity, Infinity, 0, Math.PI], "The interpolated path cannot be clamped by a destination-only azimuth/polar window");
  const destinationLimits = { minAzimuthAngle: .1, maxAzimuthAngle: .5, minDistance: 2, maxDistance: 20, minPolarAngle: .5, maxPolarAngle: 1.4 };
  const manualMarker = "const handleStart = () => {", manualIndex = scene.indexOf(manualMarker), manualEnd = scene.indexOf("\n    };", manualIndex);
  ok(manualIndex > 0 && manualEnd > manualIndex && scene.includes('control.addEventListener("start", handleStart)'), "The real manual-start handler is wired to OrbitControls");
  // Remove TypeScript tuple assertions only; execute the handler unchanged.
  const manualBody = scene.slice(manualIndex + manualMarker.length, manualEnd).replaceAll(" as [number, number, number]", "");
  const interrupt = new Function("scope", "infinityNavigationLimits", `const {interacting,flying,navigationLimits,camera,controls,infinityZone,layout}=scope; const control=controls.current; ${manualBody}`);
  function scopeFor() {
    const camera = { position: new Vector3(3, 3, 8) }, control = { target: new Vector3(0, 0, 0), updates: 0,
      ...openLimits, update() { this.updates++; } };
    return { camera, controls: { current: control }, goal: { current: new Vector3(7, 4, 2) }, lookAt: { current: new Vector3(1, -.1, 0) },
      startPosition: { current: camera.position.clone() }, startTarget: { current: control.target.clone() }, elapsed: { current: 0 },
      duration: { current: .24 }, flying: { current: true }, navigationLimits: { current: destinationLimits }, photoMode: false, radius: 5,
      interacting: { current: false }, infinityZone: {}, layout: { waterY: -.0005 } };
  }
  const scope = scopeFor();
  frame(scope, .08);
  ok(scope.flying.current && scope.elapsed.current > 0 && scope.elapsed.current < .24, "A normal detail flight has an intermediate state rather than snapping");
  ok(scope.camera.position.distanceTo(scope.startPosition.current) > 0 && scope.camera.position.distanceTo(scope.goal.current) > 0, "Intermediate rendered eye lies between start and destination");
  equal(scope.controls.current.maxAzimuthAngle, Infinity, "Destination limits do not constrain intermediate frames");
  const interruptedEye = scope.camera.position.clone(), interruptedTarget = scope.controls.current.target.clone();
  const latest = { position: [-4, 2.5, 5], target: [-1, -.2, .3] } as const;
  retarget(scope, latest);
  equal(scope.startPosition.current.toArray(), interruptedEye.toArray(), "New selection starts from the actual interpolated eye, not the previous goal");
  equal(scope.startTarget.current.toArray(), interruptedTarget.toArray(), "New selection starts from the actual interpolated target");
  equal(scope.goal.current.toArray(), latest.position, "The latest selection replaces the old destination; no animation queue exists");
  equal(scope.elapsed.current, 0, "The production retarget resets elapsed time, not merely the goal coordinates");
  for (let tick = 0; tick < 6; tick++) frame(scope, .05);
  equal(scope.camera.position.toArray(), latest.position, "Interrupted flight finishes exactly at the newest eye");
  equal(scope.controls.current.target.toArray(), latest.target, "Interrupted flight finishes exactly at the newest target");
  equal(scope.flying.current, false, "Completed flight no longer fights manual camera rotation");
  equal(scope.controls.current.maxAzimuthAngle, destinationLimits.maxAzimuthAngle, "Goal navigation limits are restored only after completion");
  const manualEye = [9, 3, -5] as const; scope.camera.position.set(...manualEye); frame(scope, .05);
  equal(scope.camera.position.toArray(), manualEye, "Idle frame preserves a manually chosen eye");
  const reduced = scopeFor(); reduced.duration.current = chooseDuration(true, true, true); frame(reduced, .016);
  equal(reduced.camera.position.toArray(), reduced.goal.current.toArray(), "Reduced motion reaches the exact eye in one frame");
  equal(reduced.flying.current, false, "Reduced motion leaves no pending flight");
  const manual = scopeFor(); frame(manual, .05); const manualStart = manual.camera.position.clone();
  const expectedManualLimits = infinityNavigationLimits({ position: manual.camera.position.toArray() as [number, number, number],
    target: manual.controls.current.target.toArray() as [number, number, number] }, true, manual.layout.waterY);
  interrupt(manual, infinityNavigationLimits); frame(manual, .05);
  equal(manual.camera.position.toArray(), manualStart.toArray(), "The real manual handler cancels further interpolation immediately");
  equal(manual.interacting.current, true, "The real manual handler records user interaction");
  equal(manual.flying.current, false, "The real manual handler clears the scripted flight");
  equal(manual.controls.current.minAzimuthAngle, expectedManualLimits.minAzimuthAngle, "Manual Infinity interruption uses limits around its actual eye, not the unfinished goal");
  const frozen = scopeFor(); frozen.photoMode = true; frame(frozen, .05);
  equal(frozen.elapsed.current, 0, "Photo Mode accumulation still freezes camera motion");
  equal(frozen.camera.position.toArray(), frozen.startPosition.current.toArray(), "Photo Mode does not move the eye mid-accumulation");
}
if (enabled("shape-clearance")) {
  // Reuse only the former geometry audit's camera fixtures/invariants. No
  // geometry/backend/material audit is executed by this targeted regression.
  const fixtures = [
    ...L_SHAPE_ORIENTATIONS.map(orientation => ({ name: `L/${orientation}`, shape: "l-shape" as const,
      outline: buildLShapeOutline(clampLShapeDimensions({ totalLength: 10, totalWidth: 7, recessLength: 4, recessWidth: 3, orientation })) })),
    ...[
      { length: 12, width: 7, curvature: .5, mirror: false }, { length: 12, width: 7, curvature: .5, mirror: true },
      { length: 18, width: 4, curvature: .9, mirror: false }, { length: 18, width: 4, curvature: .9, mirror: true },
      { length: 6, width: 5, curvature: .15, mirror: false }, { length: 20, width: 14, curvature: 1, mirror: false },
    ].map(params => ({ name: `Organic/${JSON.stringify(params)}`, shape: "organic" as const, outline: buildOrganicShapeOutline(clampOrganicShapeParams(params)) })),
  ];
  const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "infinity", depth: 1.5, copingThickness: .04 });
  let shapeCases = 0;
  for (const fixture of fixtures) {
    const bounds = outlineBounds(fixture.outline), zones = infinityZonesForOutline(fixture.outline, fixture.shape);
    ok(zones.length > 0, `${fixture.name}: real compatible Infinity zones exist`);
    for (const zone of zones) {
      const legacyPose = getCameraPose({ intent: "infinity", outline: fixture.outline, infinityZone: zone, layout, depth: 1.5, skimmers: emptySkimmers });
      ok([...legacyPose.position, ...legacyPose.target].every(Number.isFinite), `${fixture.name}/side ${zone.side}: original default pose remains finite`);
      ok(legacyPose.position[0] < bounds.minX - .5 || legacyPose.position[0] > bounds.maxX + .5 || legacyPose.position[2] < bounds.minZ - .5 || legacyPose.position[2] > bounds.maxZ + .5,
        `${fixture.name}/side ${zone.side}: ORIGINAL default-FOV camera-outside-bbox invariant`);
      ok(legacyPose.position[1] > layout.groundY, `${fixture.name}/side ${zone.side}: original default pose above ground`);
      shapeCases++;
      for (const [vw, vh] of viewports) {
      const across = Math.abs(zone.normal[0]) * bounds.spanX + Math.abs(zone.normal[1]) * bounds.spanZ, local = localInfinityZone(zone, across);
      const helper = Reflect.get(cameraRuntime, "infinityDetailCameraSubject");
      const subject = typeof helper === "function" ? helper(fixture.outline, zone, layout) : {
        points: localInfinityEnvelope(local, layout.waterY), direction: [zone.normal[0] - zone.normal[1] * .35, .45, zone.normal[1] + zone.normal[0] * .35] as CameraPoint,
      };
      const frame = frameFor(vw, vh, componentCameraAspect(subject.points, subject.direction)), fit = cameraFrameFit(34, vh, frame);
      const pose = getCameraPose({ intent: "infinity", outline: fixture.outline, infinityZone: zone, layout, depth: 1.5,
        skimmers: emptySkimmers, verticalFov: fit.verticalFov, viewportAspect: fit.aspect });
      const label = `${fixture.name}/side ${zone.side}/${vw}×${vh}`;
      ok([...pose.position, ...pose.target].every(Number.isFinite), `${label}: legacy finite camera invariant`);
      ok(pose.position[0] < bounds.minX - .5 || pose.position[0] > bounds.maxX + .5 || pose.position[2] < bounds.minZ - .5 || pose.position[2] > bounds.maxZ + .5,
        `${label}: legacy camera-outside-bbox clearance remains enforced`);
      ok(pose.position[1] > layout.groundY, `${label}: camera is above physical ground, not merely above the catch-basin floor`);
      // Only the detail ROI changed. The original default/viewport bbox
      // clearance assertions above remain intact; whole-pool review is separate.
      projectInside(pose, localInfinityEnvelope(local, layout.waterY), vw, vh, label, frame, true);
      shapeCases++;
      }
    }
  }
  console.log(`Shape clearance: ${shapeCases} existing L/Organic camera fixture cases checked, including 20×14 maximum curvature.`);
}
if (section === "diagnostic") {
  const rows: unknown[] = [];
  for (const [length, width] of sizes) {
    const config = { ...base, system: "infinity" as const, dimensions: { ...base.dimensions, length, width } };
    const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
    const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "infinity", depth: config.dimensions.depth, copingThickness: .04 });
    for (const zone of infinityZonesForOutline(outline, config.shape)) for (const [vw, vh] of viewports) {
      const frame = vw === 1440 ? { left: 0, top: 0, width: vw, height: vh } : frameFor(vw, vh), fit = cameraFrameFit(34, vh, frame);
      const raw = getCameraPose({ intent: "infinity", outline, infinityZone: zone, layout, depth: config.dimensions.depth,
        skimmers: emptySkimmers, verticalFov: fit.verticalFov, viewportAspect: fit.aspect });
      const shifted = offsetCameraToFrame(raw, 34, vw, vh, frame), limits = infinityNavigationLimits(shifted, true, layout.waterY);
      const distance = Math.hypot(...shifted.position.map((value, index) => value - shifted.target[index]!));
      const polar = Math.acos((shifted.position[1] - shifted.target[1]) / distance);
      const round = (value: number) => Math.round(value * 1000) / 1000;
      rows.push({ size: `${length}×${width}`, side: zone.side, viewport: `${vw}×${vh}`, rawEyeY: round(raw.position[1]), shiftedEyeY: round(shifted.position[1]),
        deltaY: round(shifted.position[1] - raw.position[1]), rawTargetY: round(raw.target[1]), shiftedTargetY: round(shifted.target[1]),
        waterY: layout.waterY, groundY: layout.groundY, eyeBelowGround: shifted.position[1] < layout.groundY,
        eyeBelowWater: shifted.position[1] < layout.waterY, controlsWillClamp: distance < limits.minDistance || polar > limits.maxPolarAngle,
        raw: { eye: raw.position, target: raw.target }, shifted: { eye: shifted.position, target: shifted.target }, frame });
    }
  }
  console.log(`DIAGNOSTIC ONLY (not a visual PASS): ${JSON.stringify(rows)}`);
} else console.log(`${section === "cover-diagnostic" ? "DIAGNOSTIC ONLY" : "PASS"} (${section}): ${checks} premium camera geometry/state assertions; cases ${JSON.stringify(cases)}; actual stair rotations ${[...stairRotations].sort((a, b) => a - b)}. Transition timing, UI behaviour and visibility require the separate real-browser gate.`);
if (shelfFrameMeasurements.length) console.log(`Sun Shelf projected pixel bounds (diagnostic, not a premium visual PASS): ${JSON.stringify(shelfFrameMeasurements)}`);
