import { planSkimmers } from "./engineering";
import { Vector3 } from "three";
import type { SkimmerPlan } from "./engineering";
import { offsetOutline, outlineArea, outlineBounds } from "./geometry";
import { OVERFLOW_GEOMETRY } from "./config";
import { concealedOverflowSection, copingOuterOffset, squareInfinityCopingEnds } from "@/components/pool/three/poolConstruction";
import { POOL_BORDER_PRESET } from "@/configurator/materials/visual-presets";
import { POOL_LIGHTING_DESIGN } from "./lighting";
import type { PoolLightPosition } from "./lighting";
import { classifyOutlineCorners } from "./l-shape";
import type { Outline } from "./types";
import type { PoolVerticalLayout } from "./vertical-layout";
import { clampInfinityEdgeDimensions } from "./infinity-edge";
import type { RectangleInfinityZone } from "./infinity-edge";
import type { SceneLightingPlan } from "./lighting-plan";
import type { ResolvedPoolLayout } from "./resolved-layout";
import { ACCESS_DIMENSIONS, ladderRailCurve, ladderWallContacts, rectangularCornerTread } from "@/components/pool/three/PoolAccessModel";
import { HYDRO_DIMENSIONS, type ComfortElementPlan } from "./comfort-plan";
import type { CoverPlan } from "./cover-plan";
import type { FloorProfileModel } from "./floor-profile";
import { pointInBasin } from "./boundary-placement";

/** The fixed three-quarter angle every overview pose used before this shape
 * awareness was added -- kept as the direction for any outline with no
 * reflex corner (rectangle, custom-but-convex), so a shape that was never
 * the problem never sees a behaviour change. */
const DEFAULT_OVERVIEW_DIRECTION: readonly [number, number] = [1.7, 0.7];

/**
 * The overview camera's horizontal look direction, made shape-aware
 * (Geometry Pass B closure). The fixed `[1.7, 0.7]` direction it replaces
 * only ever happened to look right because it points roughly toward where
 * the L's recess sits under the "se" orientation -- every other orientation
 * turned the concave corner away from the camera, letting the L read as a
 * plain rectangle. Any outline with a reflex (concave) vertex now looks
 * from that vertex's own side of the centroid instead, at the SAME
 * horizontal distance ratio the fixed direction always used -- so the
 * concavity sits in the near half of the frame with both wings receding
 * behind it, for every orientation, continuously (no jump) as recess
 * dimensions are dragged, since the reflex vertex's position is itself a
 * continuous function of those dimensions. A rectangle has no reflex vertex
 * and takes the untouched `else` branch, so this is a zero-risk change for
 * every pre-existing shape. */
function overviewDirection(
  outline: Outline,
  centre: readonly [number, number],
): readonly [number, number] {
  if (outline.length < 5) return DEFAULT_OVERVIEW_DIRECTION;
  const convex = classifyOutlineCorners(outline);
  const concaveIndex = convex.findIndex((isConvex) => !isConvex);
  if (concaveIndex < 0) return DEFAULT_OVERVIEW_DIRECTION;
  const vertex = outline[concaveIndex]!;
  const dx = vertex[0] - centre[0];
  const dz = vertex[1] - centre[1];
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return DEFAULT_OVERVIEW_DIRECTION;
  const horizontalMagnitude = Math.hypot(...DEFAULT_OVERVIEW_DIRECTION);
  return [(dx / length) * horizontalMagnitude, (dz / length) * horizontalMagnitude];
}

export type CameraIntent =
  | "structure"
  | "depth" | "inox" | "shelf" | "hydromassage" | "bench" | "coping"
  | "paving" | "exterior-panel" | "external-stairs" | "pellicano" | "stair-lighting" | "bench-lighting"
  | "top"
  /** Above-ground elevations: the full exterior volume, square to a side,
   * from the ground contact to the coping. */
  | "elevation-long"
  | "elevation-short"
  | "waterline"
  | "overview"
  | "skimmer"
  | "skimmer-detail"
  | "overflow"
  | "overflow-hidden"
  | "overflow-visible"
  | "liner"
  | "access"
  | "mosaic"
  | "features"
  | "review"
  | "cover"
  /** Geometry Pass D (Infinity): frames the selected side from OUTSIDE the
   * basin -- the disappearing lip, the falling cascade and the catch basin
   * -- rather than the inside-looking-at-the-wall framing every other
   * system detail intent uses. Only meaningful with `infinityZone` set;
   * falls back to the plain overview otherwise (see `getCameraPose`). */
  | "infinity";
export type CameraPoint = readonly [number, number, number];

export interface CameraPose {
  position: CameraPoint;
  target: CameraPoint;
  fov?: number;
}

/** Fit a real component envelope, with the same physical margin at every size. */
export function fitComponentCamera(points: readonly CameraPoint[], direction: CameraPoint, fov: number, aspect: number): CameraPose {
  const target = new Vector3(...points[0]!);
  const min = target.clone(), max = target.clone();
  for (const p of points) { min.min(new Vector3(...p)); max.max(new Vector3(...p)); }
  target.copy(min).add(max).multiplyScalar(.5);
  const eye = new Vector3(...direction).normalize();
  const right = new Vector3(0,1,0).cross(eye).normalize(), up = eye.clone().cross(right);
  const tanY = Math.tan(fov*Math.PI/360)*.84, tanX = tanY*Math.max(.2,aspect);
  let distance = 1;
  for (const p of points) {
    const v = new Vector3(...p).sub(target);
    distance = Math.max(distance, v.dot(eye)+Math.max(Math.abs(v.dot(right))/tanX,Math.abs(v.dot(up))/tanY));
  }
  return { target: target.toArray() as [number,number,number], position: target.addScaledVector(eye,distance+.15).toArray() as [number,number,number] };
}

/** Screen-space proportion of a component along its curated viewing axis. */
export function componentCameraAspect(points: readonly CameraPoint[], direction: CameraPoint): number {
  const eye = new Vector3(...direction).normalize();
  const right = new Vector3(0, 1, 0).cross(eye).normalize(), up = eye.clone().cross(right);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const point of points) {
    const p = new Vector3(...point), x = p.dot(right), y = p.dot(up);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return Math.max(0.2, (maxX - minX) / Math.max(0.01, maxY - minY));
}

/** The existing whole-pool overview envelope, shared with UI-frame selection. */
export function overviewCameraSubject(outline: Outline, layout: PoolVerticalLayout,
  options: { outset?: number; accessories?: readonly CameraPoint[]; baseY?: number; entrance?: {x:number;z:number} | null; infinityZone?: RectangleInfinityZone | null; exteriorDirection?: CameraPoint | undefined } = {}): { points: CameraPoint[]; direction: CameraPoint } {
  const bounds = outlineBounds(outline), centre = outlineCentre(outline);
  let [dx, dz] = overviewDirection(outline, centre);
  if (outline.length === 4 && options.entrance) {
    // View the entrance from across the basin, not from outside its wall,
    // which hides all recessed treads even when their bounds fit the frame.
    dx = Math.abs(dx) * (Math.sign(centre[0]-options.entrance.x) || 1);
    dz = Math.abs(dz) * (Math.sign(centre[1]-options.entrance.z) || 1);
  }
  if (options.infinityZone) {
    const [nx,nz]=options.infinityZone.normal;
    // General presentation looks diagonally across the water towards the sea.
    // The separate approved overflow-face detail retains its own low eye line.
    dx=-nx+nz*.4; dz=-nz-nx*.4;
  }
  const points: CameraPoint[] = [...(options.accessories ?? [])];
  const outset = options.outset ?? 1.6;
  for (const x of [bounds.minX - outset, bounds.maxX + outset])
    for (const z of [bounds.minZ - outset, bounds.maxZ + outset])
      for (const y of [options.baseY ?? layout.floorY, layout.copingY]) points.push([x, y, z]);
  return { points, direction: options.exteriorDirection ?? [dx, options.infinityZone ? .8 : .9, dz] };
}

/** Keep the whole-pool eye on the existing photographic site, not far behind
 * its apron. Widen only the general lens when the available UI strip requires
 * it; neither the coastline nor the approved Infinity detail is altered. */
export function fitInfinityOverviewCamera(subject: ReturnType<typeof overviewCameraSubject>, outline: Outline, fov: number, aspect: number): CameraPose {
  const bounds=outlineBounds(outline);
  let pose: CameraPose;
  let lens=fov;
  do {
    pose={...fitComponentCamera(subject.points,subject.direction,lens,aspect),fov:lens};
    const [x,,z]=pose.position;
    const outside=Math.hypot(Math.max(bounds.minX-x,x-bounds.maxX,0),Math.max(bounds.minZ-z,z-bounds.maxZ,0));
    if(outside<=6.5 || lens>=70) return pose;
    lens=Math.min(70,lens+2);
  } while(true);
}

export function pellicanoCameraSubject(p: { x:number; z:number; inward: readonly [number,number] }, layout: PoolVerticalLayout) {
  const [nx,nz]=p.inward, tx=nz,tz=-nx, points: CameraPoint[]=[];
  for(const along of [-.25,1.25])for(const across of [-.45,.45])for(const y of [layout.waterY-.05,layout.copingY+1.15])
    points.push([p.x+nx*along+tx*across,y,p.z+nz*along+tz*across]);
  return {points,direction:[nx+tx*.7,.65,nz+tz*.7] as CameraPoint};
}

/** The same actual shelf, flight and selected furniture drive fit and UI space. */
export function sunShelfCameraSubject(resolved: ResolvedPoolLayout, layout: PoolVerticalLayout, outline: Outline, accessoryEnvelope: readonly CameraPoint[] = []): { points: CameraPoint[]; direction: CameraPoint } | null {
  const element = resolved.comfort.elements.find(part => part.kind === "sunShelf");
  if (!element) return null;
  const parts = [element, ...(element.steps ?? []), ...(element.landing ? [element.landing] : [])];
  const b = outlineBounds(parts.flatMap(part => part.footprint)), pool = outlineBounds(outline);
  const x = (b.minX + b.maxX) / 2, z = (b.minZ + b.maxZ) / 2;
  let nx = (pool.minX + pool.maxX) / 2 - x, nz = (pool.minZ + pool.maxZ) / 2 - z;
  const n = Math.hypot(nx, nz);
  if (n < 0.1) { nx = 1; nz = 0; } else { nx /= n; nz /= n; }
  const tx = nz, tz = -nx, flight = element.steps?.flatMap(step => step.footprint) ?? [];
  const side = flight.length
    ? Math.sign(flight.reduce((sum, [px, pz]) => sum + (px - x) * tx + (pz - z) * tz, 0)) || 1
    : 1;
  const points: CameraPoint[] = [...accessoryEnvelope];
  for (const part of parts) for (const [px, pz] of part.footprint) {
    for (const dx of [-0.12, 0.12]) for (const dz of [-0.12, 0.12]) {
      points.push([px + dx, part.topY - (element.riser ?? 0), pz + dz]);
      points.push([px + dx, part.topY, pz + dz]);
    }
    // Include the rim only where this component really meets the shell,
    // never imaginary rim-height corners above the middle of the flight.
    const touchesWall = outline.some((a, index) => {
      const c = outline[(index + 1) % outline.length]!, vx = c[0] - a[0], vz = c[1] - a[1];
      const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (pz - a[1]) * vz) / Math.max(1e-8, vx * vx + vz * vz)));
      return Math.hypot(px - a[0] - t * vx, pz - a[1] - t * vz) < 0.08;
    });
    if (touchesWall) points.push([px, layout.copingY + 0.08, pz]);
  }
  return { points, direction: [nx + tx * side * 0.35, 0.9, nz + tz * side * 0.35] };
}

/** The actual treads/risers or rail paths, not a full-height bounding cuboid. */
export function accessCameraSubject(plan: SceneLightingPlan["accessPlan"], layout: PoolVerticalLayout, outline: Outline): { points: CameraPoint[]; direction: CameraPoint } | null {
  const p = plan.placement;
  if (!p || !plan.footprint.length || plan.reason) return null;
  const c = Math.cos(p.rotation), s = Math.sin(p.rotation), points: CameraPoint[] = [];
  const place = (x: number, y: number, z: number) => points.push([p.x + c * x + s * z, y, p.z - s * x + c * z]);
  if (plan.ladderDepths.length) {
    const last = plan.ladderDepths.at(-1)!;
    for (const contact of ladderWallContacts(outline, p)) {
      if (!Number.isFinite(contact.z)) continue;
      const curve = ladderRailCurve(plan.ladderAnchorOffset, last, contact.z);
      for (let i = 0; i <= 64; i++) {
        const point = curve.getPointAt(i / 64), r = ACCESS_DIMENSIONS.ladderTubeRadius;
        for (const dx of [-r, r]) for (const dy of [-r, r]) for (const dz of [-r, r])
          place(contact.x + point.x + dx, plan.ladderAnchorY + point.y + dy, point.z + dz);
      }
      for (const dx of [-0.06, 0.06]) for (const dz of [-0.06, 0.06]) for (const y of [0, 0.024])
        place(contact.x + dx, plan.ladderAnchorY + y, -plan.ladderAnchorOffset + dz);
      for (const dx of [-0.034, 0.034]) for (const dy of [-0.034, 0.034]) for (const dz of [0, ACCESS_DIMENSIONS.ladderFootPad])
        place(contact.x + dx, plan.ladderAnchorY - last - ACCESS_DIMENSIONS.ladderFootDrop + dy, contact.z + dz);
    }
    for (const depth of plan.ladderDepths) for (const x of [-ACCESS_DIMENSIONS.ladderWidth / 2, ACCESS_DIMENSIONS.ladderWidth / 2])
      for (const z of [0.32 - 0.065, 0.32 + 0.065]) for (const dy of [-0.0175, 0.023]) place(x, plan.ladderAnchorY - depth + dy, z);
    if (!points.length) return null;
    return { points, direction: [s + c * 0.3, 0.65, c - s * 0.3] };
  }
  for (let i = 0; i < plan.steps; i++) {
    const top = layout.copingY - (i + 1) * plan.rise, lower = top - plan.rise;
    if (plan.corner) {
      const radius = plan.corner.radii[i]!, inner = i ? plan.corner.radii[i - 1]! : 0;
      if (plan.corner.rectangular) {
        for (const [x, z] of rectangularCornerTread(inner, radius)) {
          place(x, top, z);
          if (x === radius || z === radius) place(x, lower, z);
        }
      } else {
        for (let j = 0; j <= 48; j++) {
          const a = j / 48 * Math.PI / 2;
          place(radius * Math.sin(a), top, radius * Math.cos(a));
          place(radius * Math.sin(a), lower, radius * Math.cos(a));
          if (inner) place(inner * Math.sin(a), top, inner * Math.cos(a));
        }
        if (!inner) place(0, top, 0);
      }
    } else {
      for (const x of [-plan.width / 2, plan.width / 2]) {
        place(x, top, i * plan.tread);
        place(x, top, (i + 1) * plan.tread);
        place(x, lower, (i + 1) * plan.tread);
      }
    }
  }
  if (!points.length) return null;
  // The arrival meets the rim; no imaginary rim-height plane above lower treads.
  if (plan.corner) place(0, layout.copingY, 0);
  else for (const x of [-plan.width / 2, plan.width / 2]) place(x, layout.copingY, 0);
  const b = outlineBounds(plan.footprint), x = (b.minX + b.maxX) / 2, z = (b.minZ + b.maxZ) / 2;
  let nx = x - p.x, nz = z - p.z, n = Math.hypot(nx, nz);
  if (n < 0.05) { nx = s; nz = c; n = 1; }
  nx /= n; nz /= n;
  return { points, direction: [nx + nz * 0.25, 0.9, nz - nx * 0.25] };
}

/** Integrated hydro replaces the separate stair plan, not the Access view. */
export function accessFlightCameraSubject(resolved: ResolvedPoolLayout, layout: PoolVerticalLayout, outline: Outline, accessoryEnvelope: readonly CameraPoint[] = []): { points: CameraPoint[]; direction: CameraPoint } | null {
  const standalone = accessCameraSubject(resolved.access, layout, outline);
  if (standalone) return standalone;
  const shelf = sunShelfCameraSubject(resolved, layout, outline, accessoryEnvelope);
  if (shelf) return shelf;
  const hydro = resolved.comfort.elements.find(element => element.kind === "hydromassage" && element.steps?.length && element.landing);
  if (!hydro?.steps?.length || !hydro.landing) return null;
  const parts = [hydro.landing, ...hydro.steps], first = outlineBounds(hydro.steps[0]!.footprint), head = outlineBounds(hydro.landing.footprint);
  let nx = (first.minX + first.maxX - head.minX - head.maxX) / 2, nz = (first.minZ + first.maxZ - head.minZ - head.maxZ) / 2;
  const n = Math.hypot(nx, nz); if (n < 1e-8) return null;
  nx /= n; nz /= n;
  const points: CameraPoint[] = [];
  for (const [index, part] of parts.entries()) {
    const front = Math.max(...part.footprint.map(([x, z]) => x * nx + z * nz));
    const lower = parts[index + 1]?.topY ?? part.topY - (hydro.riser ?? 0);
    for (const [x, z] of part.footprint) {
      points.push([x, part.topY, z]);
      if (front - x * nx - z * nz < 1e-7) points.push([x, lower, z]);
      if (index === 0 && outline.some((a, i) => {
        const b = outline[(i + 1) % outline.length]!, dx = b[0] - a[0], dz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / Math.max(1e-8, dx * dx + dz * dz)));
        return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < 0.08;
      })) points.push([x, layout.copingY, z]);
    }
  }
  const flight = outlineBounds(parts.flatMap(part => part.footprint)), pool = outlineBounds(outline);
  const tx = nz, tz = -nx;
  const side = Math.sign((pool.minX + pool.maxX - flight.minX - flight.maxX) * tx + (pool.minZ + pool.maxZ - flight.minZ - flight.maxZ) * tz) || 1;
  return { points, direction: [nx + tx * side * 0.25, 0.9, nz + tz * side * 0.25] };
}

/** Real seat, partition, footwell, flight and fitting levels of the chosen zone. */
export function comfortCameraSubject(intent: "hydromassage" | "bench", resolved: ResolvedPoolLayout, layout: PoolVerticalLayout, outline: Outline): { points: CameraPoint[]; direction: CameraPoint } | null {
  const element = resolved.comfort.elements.find(e => e.kind === (intent === "bench" ? "integratedBench" : "hydromassage"));
  if (!element) return null;
  const points: CameraPoint[] = [];
  const parts = element.tiers?.length ? element.tiers : [element];
  for (const part of parts) for (const [x, z] of part.footprint) points.push([x, part.topY, z]);
  for (const part of [...(element.steps ?? []), ...(element.landing ? [element.landing] : [])])
    for (const [x, z] of part.footprint) points.push([x, part.topY, z], [x, part.topY - (element.riser ?? 0), z]);
  for (const jet of element.jets ?? []) for (const side of [-1, 1]) for (const dy of [-1, 1]) {
    const r = HYDRO_DIMENSIONS.jetDiameter / 2;
    points.push([jet.x + jet.dir[1] * r * side, jet.y + r * dy, jet.z - jet.dir[0] * r * side]);
  }
  if (!element.tiers?.some(tier => tier.role === "tubFloor"))
    for (const [x, z] of element.footprint) points.push([x, layout.floorY, z]);
  const b = outlineBounds(element.footprint), pool = outlineBounds(outline);
  let nx = (pool.minX + pool.maxX - b.minX - b.maxX) / 2, nz = (pool.minZ + pool.maxZ - b.minZ - b.maxZ) / 2;
  const n = Math.hypot(nx, nz); if (n < 0.1) { nx = 1; nz = 0; } else { nx /= n; nz /= n; }
  return { points, direction: [nx + nz * 0.35, 1, nz - nx * 0.35] };
}

/** One real front-riser module; the separate comfort camera retains the full spa. */
function openBenchMacroSubject(hydro: ComfortElementPlan, head: NonNullable<ComfortElementPlan["spots"]>[number], closeup = false): { points: CameraPoint[]; direction: CameraPoint } | null {
  const [nx, nz] = head.dir, tx = nz, tz = -nx, plane = head.x * nx + head.z * nz, at = head.x * tx + head.z * tz;
  const seat = hydro.tiers?.find(tier => tier.role === "backSeat"), floor = hydro.tiers?.find(tier => tier.role === "tubFloor");
  if (!seat || !floor) return null;
  const edge = seat.footprint.filter(([x, z]) => Math.abs(x * nx + z * nz - plane) < 1e-6);
  const along = edge.map(([x, z]) => x * tx + z * tz);
  const context = closeup ? HYDRO_DIMENSIONS.spotBelowSeat : HYDRO_DIMENSIONS.spotSpacing / 2;
  let segments: [number, number][] = [[Math.max(Math.min(...along), at - context), Math.min(Math.max(...along), at + context)]];
  for (const other of [...(hydro.tiers ?? []), ...(hydro.steps ?? []), ...(hydro.landing ? [hydro.landing] : [])]) {
    if (other === seat || other.topY < seat.topY - 1e-8) continue;
    const normal = other.footprint.map(([x, z]) => x * nx + z * nz);
    if (Math.min(...normal) > plane + 1e-8 || Math.max(...normal) <= plane + 1e-8) continue;
    const projection = other.footprint.map(([x, z]) => x * tx + z * tz), low = Math.min(...projection), high = Math.max(...projection);
    segments = segments.flatMap(([a, b]) => [
      ...(low > a ? [[a, Math.min(b, low)] as [number, number]] : []),
      ...(high < b ? [[Math.max(a, high), b] as [number, number]] : []),
    ]).filter(([a, b]) => b - a > 1e-8);
  }
  const interval = segments.find(([a, b]) => at >= a && at <= b);
  if (!interval) return null;
  const seatBack = Math.max(0, plane - Math.min(...seat.footprint.map(([x, z]) => x * nx + z * nz)));
  const floorForward = Math.max(0, Math.max(...floor.footprint.map(([x, z]) => x * nx + z * nz)) - plane);
  const seatStrip = Math.min(HYDRO_DIMENSIONS.lipThickness, seatBack), floorStrip = Math.min(HYDRO_DIMENSIONS.lipThickness, floorForward);
  const points: CameraPoint[] = [];
  for (const end of interval) {
    const x = head.x + tx * (end - at), z = head.z + tz * (end - at);
    for (const y of [seat.topY, closeup ? Math.max(floor.topY, head.y - HYDRO_DIMENSIONS.spotBelowSeat) : floor.topY]) points.push([x, y, z]);
    points.push([x - nx * seatStrip, seat.topY, z - nz * seatStrip]);
    if (!closeup) points.push([x + nx * floorStrip, floor.topY, z + nz * floorStrip]);
  }
  const r = HYDRO_DIMENSIONS.spotDiameter / 2;
  for (const side of [-1, 1]) for (const dy of [-1, 1])
    points.push([head.x + tx * r * side, head.y + r * dy, head.z + tz * r * side]);
  return { points, direction: [nx, .65, nz] };
}

/** A fitting detail is distinct from the whole-flight or RGB-basin camera. */
export function microLightCameraSubject(intent: "stair-lighting" | "bench-lighting", resolved: ResolvedPoolLayout, layout: PoolVerticalLayout, outline: Outline): { points: CameraPoint[]; direction: CameraPoint; view?: CameraPose; fixtures?: NonNullable<ComfortElementPlan["spots"]>; detailPoints?: CameraPoint[] } | null {
  const hydro = resolved.comfort.elements.find(element => element.kind === "hydromassage");
  const available = intent === "stair-lighting" ? resolved.stairMicroSpots : hydro?.spots ?? [];
  if (!available.length) return null;
  const levels = [...new Set(available.map(spot => spot.y))].sort((a, b) => b - a);
  const selectedLevels = intent === "stair-lighting" ? levels.slice(Math.max(0, Math.floor((levels.length - 3) / 2)), Math.max(0, Math.floor((levels.length - 3) / 2)) + 3) : levels;
  const spots = available.filter(spot => selectedLevels.includes(spot.y)), points: CameraPoint[] = [];
  const low = Math.min(...selectedLevels), high = Math.max(...selectedLevels);
  for (const spot of spots) {
    const r = HYDRO_DIMENSIONS.spotDiameter / 2;
    for (const side of [-1, 1]) for (const dy of [-1, 1]) points.push([spot.x + spot.dir[1] * r * side, spot.y + r * dy, spot.z - spot.dir[0] * r * side]);
  }
  if (intent === "stair-lighting") {
    const access = accessCameraSubject(resolved.access, layout, outline);
    const context = access?.points ?? resolved.comfort.elements.flatMap(element =>
      [...(element.steps ?? []), ...(element.landing ? [element.landing] : [])].flatMap(part =>
        part.footprint.flatMap(([x, z]) => [[x, part.topY, z], [x, part.topY - (element.riser ?? 0), z]] as CameraPoint[])));
    const rise = resolved.access.rise || resolved.comfort.elements.find(element => element.riser)?.riser || 0;
    points.push(...context.filter(point => point[1] >= low - rise * 0.51 && point[1] <= high + rise * 0.51));
  } else if (hydro) {
    const floor = hydro.tiers?.find(tier => tier.role === "tubFloor")?.topY ?? layout.floorY;
    const seats = (hydro.tiers ?? []).filter(tier => ["backSeat", "sideSeat", "innerSideSeat"].includes(tier.role));
    const open = !hydro.tiers?.some(tier => tier.role === "frontWall");
    for (const spot of spots) {
      const [nx, nz] = spot.dir, tx = nz, tz = -nx, plane = spot.x * nx + spot.z * nz;
      const seat = seats.find(tier => Math.abs(Math.max(...tier.footprint.map(([x, z]) => x * nx + z * nz)) - plane) < 1e-6);
      if (!seat) continue;
      const edge = seat.footprint.filter(([x, z]) => Math.abs(x * nx + z * nz - plane) < 1e-6);
      const along = edge.map(([x, z]) => x * tx + z * tz), at = spot.x * tx + spot.z * tz;
      let segments = [[Math.max(Math.min(...along), at - HYDRO_DIMENSIONS.spotSpacing / 2), Math.min(Math.max(...along), at + HYDRO_DIMENSIONS.spotSpacing / 2)]];
      if (open) for (const other of [...(hydro.tiers ?? []), ...(hydro.steps ?? []), ...(hydro.landing ? [hydro.landing] : [])]) {
        if (other === seat || other.topY < seat.topY - 1e-8) continue;
        const normal = other.footprint.map(([x, z]) => x * nx + z * nz);
        if (Math.min(...normal) > plane + 1e-8 || Math.max(...normal) <= plane + 1e-8) continue;
        const projection = other.footprint.map(([x, z]) => x * tx + z * tz), low = Math.min(...projection), high = Math.max(...projection);
        segments = segments.flatMap(([a, b]) => [
          ...(low > a! ? [[a!, Math.min(b!, low)]] : []), ...(high < b! ? [[Math.max(a!, high), b!]] : []),
        ]).filter(([a, b]) => b! - a! > 1e-8);
      }
      for (const [a, b] of segments) for (const end of [a!, b!])
        for (const y of [seat.topY, floor]) points.push([spot.x + tx * (end - at), y, spot.z + tz * (end - at)]);
    }
  }
  if (intent === "bench-lighting" && hydro) {
    const backSeat = hydro.tiers?.find(tier => tier.role === "backSeat");
    const head = spots.find(spot => backSeat && Math.abs(
      Math.max(...backSeat.footprint.map(([x, z]) => x * spot.dir[0] + z * spot.dir[1])) - spot.x * spot.dir[0] - spot.z * spot.dir[1],
    ) < 1e-6);
    if (head && !hydro.tiers?.some(tier => tier.role === "frontWall")) {
      const macro = openBenchMacroSubject(hydro, head);
      const detail = openBenchMacroSubject(hydro, head, true);
      if (macro) return { ...macro, fixtures: [head], ...(detail ? { detailPoints: detail.points } : {}) };
      const view = openBenchLightingView(points, hydro, layout, head.dir);
      if (view) return { points, direction: [view.position[0] - view.target[0], view.position[1] - view.target[1], view.position[2] - view.target[2]], view };
      return { points, direction: [head.dir[0], 0.65, head.dir[1]] };
    }
  }
  let nx = spots.reduce((sum, spot) => sum + spot.dir[0], 0), nz = spots.reduce((sum, spot) => sum + spot.dir[1], 0);
  const n = Math.hypot(nx, nz); if (n < 0.1) { nx = 1; nz = 0; } else { nx /= n; nz /= n; }
  return { points, direction: [nx + nz * 0.2, 0.65, nz - nx * 0.2] };
}

/** Opposing seat faces require an eye at the real free opening, not beyond it. */
function openBenchLightingView(points: readonly CameraPoint[], hydro: ComfortElementPlan, layout: PoolVerticalLayout, head: readonly [number, number]): CameraPose | null {
  const [nx, nz] = head, tx = nz, tz = -nx;
  const front = Math.max(...hydro.footprint.map(([x, z]) => x * nx + z * nz));
  const sides = (hydro.spots ?? []).filter(spot => Math.abs(spot.dir[0] * nx + spot.dir[1] * nz) < 1e-6)
    .map(spot => spot.x * tx + spot.z * tz);
  if (sides.length < 2 || Math.max(...sides) - Math.min(...sides) < 1e-6) return null;
  const middle = (Math.min(...sides) + Math.max(...sides)) / 2;
  const min = new Vector3(...points[0]!), max = min.clone();
  for (const point of points) { min.min(new Vector3(...point)); max.max(new Vector3(...point)); }
  const target = min.add(max).multiplyScalar(0.5).toArray() as [number, number, number];
  const x = nx * front + tx * middle, z = nz * front + tz * middle;
  const h = Math.hypot(x - target[0], z - target[2]);
  const y = target[1] + h * Math.tan(Math.atan2(layout.waterY + 0.4 - target[1], h) + 0.01);
  return { position: [x, y, z], target };
}

/** Focal angle derived from the entire exposed riser ROI at that physical eye. */
function openBenchLightingFov(points: readonly CameraPoint[], view: CameraPose, aspect: number): number | null {
  const eye = new Vector3(...view.position), forward = new Vector3(...view.target).sub(eye).normalize();
  const right = forward.clone().cross(new Vector3(0, 1, 0)).normalize(), up = right.clone().cross(forward);
  let ratio = 0;
  for (const point of points) {
    const v = new Vector3(...point).sub(eye), depth = v.dot(forward);
    if (depth <= 0) return null;
    ratio = Math.max(ratio, Math.abs(v.dot(up)) / depth, Math.abs(v.dot(right)) / (depth * aspect));
  }
  return 2 * Math.atan(ratio / 0.84) * 180 / Math.PI;
}

/** Bench-only finite-ray clearance: retain the real target and plan eye. */
function fitBenchLightingCamera(subject: NonNullable<ReturnType<typeof microLightCameraSubject>>, hydro: ComfortElementPlan, layout: PoolVerticalLayout, fov: number, aspect: number, infinity: boolean): CameraPose {
  const pose = fitComponentCamera(subject.points, subject.direction, fov, aspect), c = pose.target, e = pose.position;
  const h = Math.hypot(e[0] - c[0], e[2] - c[2]), ux = (e[0] - c[0]) / h, uz = (e[2] - c[2]) / h;
  const v0 = e[1] - c[1], d0 = Math.hypot(h, v0);
  let v = v0;
  const parts = [...(hydro.tiers ?? [hydro]), ...(hydro.steps ?? []), ...(hydro.landing ? [hydro.landing] : [])];
  // Actual front faces of the 35 mm bezel and its 23.8 mm lens.
  for (const spot of hydro.spots ?? []) for (const [r, offset] of [[HYDRO_DIMENSIONS.spotDiameter / 2, 0.004], [HYDRO_DIMENSIONS.spotDiameter * 0.34, 0.0055]] as const)
    for (const [side, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const p: CameraPoint = [spot.x + spot.dir[0] * offset + spot.dir[1] * r * side, spot.y + r * dy, spot.z + spot.dir[1] * offset - spot.dir[0] * r * side];
      for (const part of parts) {
        let enter = 0, exit = 1, valid = true;
        for (const axis of [0, 2] as const) {
          const origin = p[axis], delta = e[axis] - origin, values = part.footprint.map(point => point[axis === 0 ? 0 : 1]);
          const low = Math.min(...values), high = Math.max(...values);
          if (Math.abs(delta) < 1e-9) { if (origin < low || origin > high) valid = false; }
          else {
            const a = (low - origin) / delta, b = (high - origin) / delta;
            enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
          }
        }
        if (valid && exit >= enter && enter > 1e-8 && enter < 1)
          v = Math.max(v, p[1] + (part.topY + 1e-5 - p[1]) / enter - c[1]);
      }
    }
  if (infinity) v = Math.max(v, h * Math.tan(Math.atan2(layout.waterY + 0.4 - c[1], h) + 0.01));
  // Changing height must not invalidate the component's original framing.
  // Each perspective constraint excludes a quadratic interval of heights.
  const tanY = Math.tan(fov * Math.PI / 360) * 0.84, tanX = tanY * Math.max(0.2, aspect);
  const intervals: Array<readonly [number, number]> = [];
  const exclude = (a: number, b: number, k: number) => {
    const disc = b * b - 4 * a * k;
    if (disc > 0) { const root = Math.sqrt(disc); intervals.push([(-b - root) / (2 * a), (-b + root) / (2 * a)]); }
  };
  for (const point of subject.points) {
    const a = (point[0] - c[0]) * ux + (point[2] - c[2]) * uz, b = point[1] - c[1];
    const side = Math.abs((point[0] - c[0]) * uz - (point[2] - c[2]) * ux);
    for (const sign of [-1, 1]) exclude(tanY, -tanY * b - sign * a, tanY * (h * h - h * a) + sign * h * b);
    // sqrt(h²+v²) <= d0+(v-v0) for v>=v0: a safe horizontal fit.
    exclude(tanX, -tanX * b - side, tanX * (h * h - h * a) - side * (d0 - v0));
  }
  for (const [low, high] of intervals.sort((a, b) => a[0] - b[0])) if (v > low && v < high) v = high + 1e-6;
  return { position: [e[0], c[1] + v + 1e-6, e[2]], target: c };
}

/** Colour preview holds the real water volume and fixture row from its short end. */
export function lightingCameraSubject(outline: Outline, layout: PoolVerticalLayout, ledRow: readonly PoolLightPosition[]) {
  const points: CameraPoint[] = [];
  for (const [x, z] of outline) for (const y of [layout.floorY, layout.copingY]) points.push([x, y, z]);
  for (const light of ledRow) for (const dx of [-POOL_LIGHTING_DESIGN.fixtureRadius, POOL_LIGHTING_DESIGN.fixtureRadius])
    for (const dy of [-POOL_LIGHTING_DESIGN.fixtureRadius, POOL_LIGHTING_DESIGN.fixtureRadius]) for (const dz of [-POOL_LIGHTING_DESIGN.fixtureRadius, POOL_LIGHTING_DESIGN.fixtureRadius]) points.push([light.x + dx, light.y + dy, light.z + dz]);
  const bounds = outlineBounds(outline), rotation = ledRow[0]?.rotation ?? 0, nx = Math.sin(rotation), nz = Math.cos(rotation);
  const longX = bounds.spanX >= bounds.spanZ, along = longX ? nx : nz, end = Math.abs(along) > 0.5 ? Math.sign(along) : 1;
  return { points, direction: (longX ? [end + nx * 0.18, 0.65, nz * 0.18] : [nx * 0.18, 0.65, end + nz * 0.18]) as CameraPoint };
}

/** The same exterior flight/landing and guard envelope drive pose and UI fit. */
export function externalStairCameraSubject(plan: { footprint: readonly (readonly [number, number])[]; outward: readonly [number, number]; walk: readonly [number, number] }, layout: PoolVerticalLayout) {
  return {
    points: plan.footprint.flatMap(([x, z]) => [layout.groundY, layout.copingY + 1.05].map(y => [x, y, z] as CameraPoint)),
    direction: [plan.outward[0] + plan.walk[0] * 0.5, 0.7, plan.outward[1] + plan.walk[1] * 0.5] as CameraPoint,
  };
}

/** The selected paving patch, in metres, shared by pose and available UI fit. */
export function pavingCameraSubject(outline: Outline, layout: PoolVerticalLayout, skimmers: SkimmerPlan) {
  const reference = getFrontWallReference(outline, skimmers), [x, z] = reference.point;
  const [nx, nz] = reference.inward, [tx, tz] = reference.tangent, points: CameraPoint[] = [];
  for (const along of [-1.5, 1.5]) for (const out of [0.45, 2.25])
    points.push([x - nx * out + tx * along, layout.groundY, z - nz * out + tz * along]);
  return { points, direction: [-nx + tx * 0.55, 1.6, -nz + tz * 0.55] as CameraPoint };
}

/** The complete travel opening keeps the camera stable as the mat deploys. */
export function coverCameraSubject(plan: CoverPlan, layout: PoolVerticalLayout, outline: Outline, copingOffset: number): { points: CameraPoint[]; direction: CameraPoint } | null {
  if (!outline.length || plan.status === "UNAVAILABLE") return null;
  const points: CameraPoint[] = offsetOutline(outline, copingOffset).map(([x, z]) => [x, layout.copingY, z]);
  const { minX, maxX, minZ, maxZ } = plan.footprint;
  for (const x of [minX, maxX]) for (const z of [minZ, maxZ])
    for (const y of [layout.copingY - 0.024, layout.copingY]) points.push([x, y, z]);
  // Housing dimensions come from AutomaticCover; OFF contains no roller.
  if (plan.geometry) for (const x of [plan.housingX - 0.135, plan.housingX + 0.135])
    for (const z of [minZ - 0.075, maxZ + 0.075]) for (const y of [plan.housingY - 0.11, plan.housingY + 0.111]) points.push([x, y, z]);
  return { points, direction: [plan.housingSide === "minX" ? 1.35 : -1.35, 1.35, 0.75] };
}

/** A true Infinity detail near its end closure; the review still fits the full pool. */
export function infinityDetailCameraSubject(outline: Outline, zone: RectangleInfinityZone, layout: PoolVerticalLayout) {
  const bounds = outlineBounds(outline), dims = clampInfinityEdgeDimensions(undefined);
  const across = Math.abs(zone.normal[0]) * bounds.spanX + Math.abs(zone.normal[1]) * bounds.spanZ;
  const innerDepth = Math.min(1.2, across * 0.35);
  const lengths = zone.points.slice(1).map((point, i) => Math.hypot(point[0] - zone.points[i]![0], point[1] - zone.points[i]![1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  // Framing dimensions only, never product dimensions or a geometry crop.
  const span = Math.min(total, dims.dropHeight + dims.catchBasinDepth + innerDepth);
  const startDistance = total - span;
  const samples: Array<{ point: readonly [number, number]; normal: readonly [number, number] }> = [];
  let run = 0;
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i]!;
    if (length > 1e-8 && run + length >= startDistance) {
      if (!samples.length) {
        const t = Math.max(0, Math.min(1, (startDistance - run) / length));
        const a = zone.points[i]!, b = zone.points[i + 1]!, na = zone.pointNormals[i]!, nb = zone.pointNormals[i + 1]!;
        const nx = na[0] + (nb[0] - na[0]) * t, nz = na[1] + (nb[1] - na[1]) * t, n = Math.hypot(nx, nz);
        samples.push({ point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], normal: [nx / n, nz / n] });
      }
      samples.push({ point: zone.points[i + 1]!, normal: zone.pointNormals[i + 1]! });
    }
    run += length;
  }
  const last = samples.at(-1)!, previous = zone.points.at(-2)!;
  const tx = last.point[0] - previous[0], tz = last.point[1] - previous[1], tangentLength = Math.hypot(tx, tz);
  const returnWidth = copingOuterOffset("infinity", "hidden");
  samples.push({ point: [last.point[0] + tx / tangentLength * returnWidth, last.point[1] + tz / tangentLength * returnWidth], normal: last.normal });
  const points: CameraPoint[] = [];
  const receiverOut = dims.lipWidth + dims.catchBasinWidth + dims.wallThickness;
  for (const { point: [x, z], normal: [nx, nz] } of samples) {
    for (const [outward, y] of [[-innerDepth, layout.waterY - 0.08], [0, layout.waterY],
      [dims.lipWidth, layout.waterY], [dims.lipWidth, layout.waterY - dims.dropHeight],
      [receiverOut, layout.waterY - dims.dropHeight + 0.045],
      [receiverOut, layout.waterY - dims.dropHeight - dims.catchBasinDepth]]) {
      for (const dx of [-0.12, 0.12]) for (const dz of [-0.12, 0.12])
        points.push([x + nx * outward! + dx, y!, z + nz * outward! + dz]);
    }
  }
  return { points, direction: [zone.normal[0] - zone.normal[1] * 0.35, 0.45, zone.normal[1] + zone.normal[0] * 0.35] as CameraPoint,
    span, startDistance };
}

/** Real non-overflow coping immediately after the Infinity end closure. */
export function infinityCopingCameraSubject(outline: Outline, zone: RectangleInfinityZone, layout: PoolVerticalLayout) {
  const excluded = new Set(Array.from({ length: zone.points.length - 1 }, (_, i) => (zone.side + i) % outline.length));
  const outer = squareInfinityCopingEnds(outline, offsetOutline(outline, copingOuterOffset("infinity", "hidden")), excluded);
  const start = (zone.side + zone.points.length - 1) % outline.length;
  const a = outline[start]!, b = outline[(start + 1) % outline.length]!, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
  const winding = Math.sign(outline.reduce((sum, p, i) => {
    const q = outline[(i + 1) % outline.length]!; return sum + p[0] * q[1] - q[0] * p[1];
  }, 0)) || 1;
  const nx = -tz * winding, nz = tx * winding, points: CameraPoint[] = [];
  let remaining = 2.4;
  for (let offset = 0; offset < outline.length && remaining > 1e-6; offset++) {
    const i = (start + offset) % outline.length, j = (i + 1) % outline.length;
    if (excluded.has(i)) break;
    const p = outline[i]!, q = outline[j]!, run = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (run < 1e-8) continue;
    const t = Math.min(1, remaining / run);
    for (const u of [0, t]) {
      const x = p[0] + (q[0] - p[0]) * u, z = p[1] + (q[1] - p[1]) * u;
      const ox = outer[i]![0] + (outer[j]![0] - outer[i]![0]) * u, oz = outer[i]![1] + (outer[j]![1] - outer[i]![1]) * u;
      for (const y of [layout.wallTopY, layout.copingY]) points.push([x, y, z], [ox, y, oz]);
      points.push([x + nx * 0.18, layout.waterY, z + nz * 0.18], [ox - nx * 0.12, layout.groundY, oz - nz * 0.12]);
    }
    remaining -= run * t;
  }
  return { points, direction: [-nx + tx * 0.4, 0.8, -nz + tz * 0.4] as CameraPoint };
}

/** The actual grille/slot section and a short water/rim context, not the wall below. */
export function overflowCameraSubject(intent: "overflow-hidden" | "overflow-visible", outline: Outline, layout: PoolVerticalLayout, skimmers: SkimmerPlan) {
  const reference = getFrontWallReference(outline, skimmers), [x, z] = reference.point;
  const [nx, nz] = reference.inward, [tx, tz] = reference.tangent;
  const section = concealedOverflowSection(layout.wallTopY, POOL_BORDER_PRESET.thickness);
  const g = OVERFLOW_GEOMETRY;
  const cross = intent === "overflow-visible"
    ? [[-0.25, layout.waterY], [0, layout.wallTopY], [g.visibleKerbWidth, layout.wallTopY],
      [g.visibleChannelOuterOffset, layout.wallTopY], [g.visibleKerbWidth, layout.wallTopY - g.channelDepth],
      [g.visibleChannelOuterOffset, layout.wallTopY - g.channelDepth]]
    : [[-0.25, layout.waterY], [g.waterEdgeOffset, layout.waterY], [section.copingInnerOffset, section.copingTopY],
      [copingOuterOffset("overflow", "hidden"), section.copingTopY], [section.copingInnerOffset, section.copingBottomY],
      [section.channelOuterOffset, section.channelFloorY]];
  const points: CameraPoint[] = [];
  for (const along of [-1.1, 1.1]) for (const [outward, y] of cross)
    points.push([x - nx * outward! + tx * along, y!, z - nz * outward! + tz * along]);
  return { points, direction: [nx + tx * 0.35, 1.1, nz + tz * 0.35] as CameraPoint };
}

/** World-space orthographic frustum: the actual plan plus paving and labels. */
export function dimensionFrustum(outline: Outline, aspect: number) {
  const b = outlineBounds(outline);
  const safeAspect = Math.max(0.2, aspect);
  const height = Math.max(b.spanZ + 3.8, (b.spanX + 3.8) / safeAspect);
  return { width: height * safeAspect, height, centre: [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2] as const };
}

/** Frames the SAME resolved comfort/ladder geometry used by PoolModel. */
export function contextualAccessCamera(intent: CameraIntent, resolved: ResolvedPoolLayout, layout: PoolVerticalLayout, outline: Outline, fov: number, aspect: number, infinityZone?: RectangleInfinityZone | null, accessoryEnvelope: readonly CameraPoint[] = []): CameraPose | null {
  if (intent === "shelf") {
    const subject = sunShelfCameraSubject(resolved, layout, outline, accessoryEnvelope);
    return subject ? fitComponentCamera(subject.points, subject.direction, fov, aspect) : null;
  }
  if (intent === "stair-lighting" || intent === "bench-lighting") {
    const subject = microLightCameraSubject(intent, resolved, layout, outline);
    if (subject && intent === "bench-lighting") {
      const hydro = resolved.comfort.elements.find(element => element.kind === "hydromassage");
      if (subject.view) {
        const fov = openBenchLightingFov(subject.points, subject.view, aspect);
        if (fov !== null) return { ...subject.view, fov };
      }
      if (hydro) {
        const view = fitBenchLightingCamera(subject, subject.fixtures ? { ...hydro, spots: subject.fixtures } : hydro, layout, fov, aspect, !!infinityZone);
        if (subject.detailPoints?.length) {
          // Keep the physical module's proven eye/clearance; only the lens
          // and aiming point frame the real fixture and surrounding riser.
          const min = new Vector3(...subject.detailPoints[0]!), max = min.clone();
          for (const point of subject.detailPoints) { min.min(new Vector3(...point)); max.max(new Vector3(...point)); }
          const detailView: CameraPose = { position: view.position, target: min.add(max).multiplyScalar(.5).toArray() as [number, number, number] };
          const detailFov = openBenchLightingFov(subject.detailPoints, detailView, aspect);
          if (detailFov !== null) return { ...detailView, fov: detailFov };
        }
        return view;
      }
    }
    return subject ? fitComponentCamera(subject.points, subject.direction, fov, aspect) : null;
  }
  if (intent === "access") {
    const subject = accessFlightCameraSubject(resolved, layout, outline, accessoryEnvelope);
    return subject ? fitComponentCamera(subject.points, subject.direction, fov, aspect) : null;
  }
  if (intent === "inox") {
    const plan = resolved.ladder?.plan ?? (resolved.access.ladderDepths.length ? resolved.access : null);
    return plan?.placement ? getAccessDetailCamera(plan, layout, fov, aspect, !!infinityZone, outline) : null;
  }
  if (!["bench", "hydromassage"].includes(intent)) return null;
  const subject = comfortCameraSubject(intent as "bench" | "hydromassage", resolved, layout, outline);
  return subject ? fitComponentCamera(subject.points, subject.direction, fov, aspect) : null;
}

/** Only subtract UI that really overlaps the canvas; trays below it cost no area. */
export function visibleCameraFrame(canvas: { left: number; top: number; width: number; height: number }, overlays: ReadonlyArray<{ left: number; top: number; width: number; height: number }>, preferredAspect?: number) {
  let candidates = [{ left: 0, top: 0, right: canvas.width, bottom: canvas.height }];
  for (const overlay of overlays) {
    const fullWidth = overlay.width >= canvas.width * 0.55;
    const padding = fullWidth ? 0 : 8;
    const x0 = Math.max(0, overlay.left - canvas.left - padding), y0 = Math.max(0, overlay.top - canvas.top - padding);
    const x1 = Math.min(canvas.width, overlay.left + overlay.width - canvas.left + padding);
    const y1 = Math.min(canvas.height, overlay.top + overlay.height - canvas.top + padding);
    if (x1 <= x0 || y1 <= y0) continue;
    const next = candidates.flatMap(r => x1 <= r.left || x0 >= r.right || y1 <= r.top || y0 >= r.bottom ? [r] : [
      {...r, right: Math.min(r.right,x0)}, {...r, left: Math.max(r.left,x1)},
      {...r, bottom: Math.min(r.bottom,y0)}, {...r, top: Math.max(r.top,y1)},
    ]).filter(r => r.right > r.left && r.bottom > r.top);
    // Retain maximal free rectangles, including beside a badge. Removing an
    // entire HUD row can collapse a short mobile viewport and clip the camera.
    candidates = next.filter((r,i) => !next.some((other,j) => j !== i &&
      other.left <= r.left && other.right >= r.right && other.top <= r.top && other.bottom >= r.bottom &&
      (j < i || other.left < r.left || other.right > r.right || other.top < r.top || other.bottom > r.bottom)));
  }
  const score = (r: typeof candidates[number]) => preferredAspect && preferredAspect > 0
    ? Math.min((r.right - r.left) / preferredAspect, r.bottom - r.top)
    : (r.right - r.left) * (r.bottom - r.top);
  const best = candidates.reduce((a,b) => score(b) > score(a) ? b : a,
    {left:0,top:0,right:1,bottom:1});
  return { left:best.left, top:best.top, width:best.right-best.left, height:best.bottom-best.top };
}

export function cameraFrameFit(fov: number, canvasHeight: number, frame: ReturnType<typeof visibleCameraFrame>) {
  return { verticalFov: 2 * Math.atan(Math.tan(fov * Math.PI / 360) * frame.height / canvasHeight) * 180 / Math.PI,
    aspect: frame.width / frame.height };
}

export function offsetCameraToFrame(pose: CameraPose, fov: number, width: number, height: number, frame: ReturnType<typeof visibleCameraFrame>): CameraPose {
  const eye = new Vector3(...pose.position), target = new Vector3(...pose.target);
  const forward = target.clone().sub(eye).normalize();
  const right = forward.clone().cross(new Vector3(0, 1, 0)).normalize();
  const up = right.clone().cross(forward).normalize();
  const scale = 2 * eye.distanceTo(target) * Math.tan(fov * Math.PI / 360) / height;
  const offset = right.multiplyScalar(-(frame.left + frame.width / 2 - width / 2) * scale)
    .add(up.multiplyScalar((frame.top + frame.height / 2 - height / 2) * scale));
  return { ...pose, position: eye.add(offset).toArray() as [number,number,number], target: target.add(offset).toArray() as [number,number,number] };
}

/** Infinity's photographic ground is a limited capture, not a navigable site. */
export function infinityNavigationLimits(pose: CameraPose, detail: boolean, waterY: number) {
  const dx = pose.position[0] - pose.target[0], dy = pose.position[1] - pose.target[1], dz = pose.position[2] - pose.target[2];
  const distance = Math.hypot(dx, dy, dz), azimuth = Math.atan2(dx, dz);
  const polar = Math.acos(dy / distance), yaw = detail ? 0.32 : 0.18;
  const eyeClearance = waterY + 0.4 - pose.target[1];
  const maxPolarAngle = Math.min(Math.PI / 2.05, polar + 0.1,
    Math.acos(Math.max(-1, Math.min(1, eyeClearance / distance))) - 0.01);
  return { minAzimuthAngle: azimuth - yaw, maxAzimuthAngle: azimuth + yaw,
    minPolarAngle: Math.max(0.12, polar - 0.14), maxPolarAngle,
    minDistance: Math.max(1.2, distance * 0.6, eyeClearance / Math.cos(maxPolarAngle)), maxDistance: distance * (detail ? 1.08 : 1),
  };
}

interface BoundaryFocus {
  point: readonly [number, number];
  inward: readonly [number, number];
  tangent: readonly [number, number];
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function outlineCentre(outline: Outline): readonly [number, number] {
  if (outline.length === 0) return [0, 0];
  return [
    outline.reduce((sum, point) => sum + point[0], 0) / outline.length,
    outline.reduce((sum, point) => sum + point[1], 0) / outline.length,
  ];
}

function detailPose({
  focus,
  targetY,
  cameraY,
  distance,
  tangentAmount,
}: {
  focus: BoundaryFocus;
  targetY: number;
  cameraY: number;
  distance: number;
  tangentAmount: number;
}): CameraPose {
  const targetInset = 0.08;
  return {
    target: [
      focus.point[0] + focus.inward[0] * targetInset,
      targetY,
      focus.point[1] + focus.inward[1] * targetInset,
    ],
    position: [
      focus.point[0] + focus.inward[0] * distance + focus.tangent[0] * tangentAmount,
      cameraY,
      focus.point[1] + focus.inward[1] * distance + focus.tangent[1] * tangentAmount,
    ],
  };
}

/** The existing Skimmer view is the master pose for every front-wall intent. */
function getFrontWallReference(outline: Outline, skimmers: SkimmerPlan): BoundaryFocus {
  const referencePlan =
    skimmers.positions.length > 0
      ? skimmers
      : planSkimmers(outline, Math.max(0.01, outlineArea(outline)), true);
  const reference = referencePlan.positions[Math.floor(referencePlan.positions.length / 2)];
  const point: readonly [number, number] = reference
    ? [reference.x, reference.z]
    : outlineCentre(outline);
  const inward: readonly [number, number] = reference
    ? [Math.sin(reference.rotation), Math.cos(reference.rotation)]
    : [0, 1];
  return { point, inward, tangent: [inward[1], -inward[0]] };
}

/** The existing hydraulic detail's real wall/waterline span, not the basin box. */
export function waterlineCameraSubject(outline: Outline, layout: PoolVerticalLayout, skimmers: SkimmerPlan) {
  const reference = getFrontWallReference(outline, skimmers), bounds = outlineBounds(outline);
  const [x, z] = reference.point, [nx, nz] = reference.inward, [tx, tz] = reference.tangent;
  const tangentSpan = Math.abs(tx) * bounds.spanX + Math.abs(tz) * bounds.spanZ;
  const framedSpan = clamp(tangentSpan * 0.42, 2.2, 3.4), points: CameraPoint[] = [];
  for (const along of [-framedSpan / 2, framedSpan / 2])
    for (const y of [layout.waterY - 0.15, layout.copingY])
      points.push([x + tx * along, y, z + tz * along]);
  return { points, direction: [nx, 0.3, nz] as CameraPoint };
}

/** Look from the water towards the selected crest, not through an exterior wall. */
export function infinityWaterlineCameraSubject(outline: Outline, zone: RectangleInfinityZone, layout: PoolVerticalLayout) {
  const lengths = zone.points.slice(1).map((p, i) => Math.hypot(p[0] - zone.points[i]![0], p[1] - zone.points[i]![1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const sample = (distance: number) => {
    let run = 0;
    for (let i = 0; i < lengths.length; i++) {
      const length = lengths[i]!;
      if (length > 1e-8 && (distance <= run + length || i === lengths.length - 1)) {
        const t = clamp((distance - run) / length, 0, 1), a = zone.points[i]!, b = zone.points[i + 1]!;
        const na = zone.pointNormals[i]!, nb = zone.pointNormals[i + 1]!;
        const nx = na[0] + (nb[0] - na[0]) * t, nz = na[1] + (nb[1] - na[1]) * t, n = Math.hypot(nx, nz);
        return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as const, normal: [nx / n, nz / n] as const };
      }
      run += length;
    }
    return { point: zone.end, normal: zone.pointNormals.at(-1)! };
  };
  const middle = sample(total / 2), [nx, nz] = middle.normal;
  const reference: BoundaryFocus = { point: middle.point, inward: [-nx, -nz], tangent: [-nz, nx] };
  const bounds = outlineBounds(outline), tangentSpan = Math.abs(nz) * bounds.spanX + Math.abs(nx) * bounds.spanZ;
  const framedSpan = Math.min(total, clamp(tangentSpan * 0.42, 2.2, 3.4));
  const start = (total - framedSpan) / 2, end = start + framedSpan, samples = [sample(start)];
  let run = 0;
  for (let i = 0; i < lengths.length; i++) {
    run += lengths[i]!;
    if (run > start && run < end) samples.push({ point: zone.points[i + 1]!, normal: zone.pointNormals[i + 1]! });
  }
  samples.push(sample(end));
  const points: CameraPoint[] = [], lipWidth = clampInfinityEdgeDimensions(undefined).lipWidth;
  for (const { point: [x, z], normal: [outX, outZ] } of samples) {
    points.push([x, layout.waterY - 0.15, z], [x, layout.waterY, z],
      [x + outX * lipWidth, layout.waterY, z + outZ * lipWidth]);
  }
  return { points, direction: [-nx, 0.3, -nz] as CameraPoint, reference, framedSpan };
}

function getFrontWallMasterCamera({
  reference,
  bounds,
  layout,
  depth,
  verticalFov,
  viewportAspect,
  includeExternalStaircase,
}: {
  reference: BoundaryFocus;
  bounds: ReturnType<typeof outlineBounds>;
  layout: PoolVerticalLayout;
  depth: number;
  verticalFov: number;
  viewportAspect: number;
  includeExternalStaircase: boolean;
}): CameraPose {
  const centre: readonly [number, number] = [
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minZ + bounds.maxZ) / 2,
  ];
  const tangentSpan =
    Math.abs(reference.tangent[0]) * bounds.spanX + Math.abs(reference.tangent[1]) * bounds.spanZ;
  const inwardSpan =
    Math.abs(reference.inward[0]) * bounds.spanX + Math.abs(reference.inward[1]) * bounds.spanZ;
  const safeAspect = clamp(viewportAspect, 0.6, 3);
  const verticalFovRadians = (clamp(verticalFov, 20, 75) * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFovRadians / 2) * safeAspect);
  if (includeExternalStaircase) {
    const staircaseHeight = Math.max(0.6, layout.copingY - layout.groundY) + 0.88;
    const staircaseRun =
      clamp(Math.max(0.6, layout.copingY - layout.groundY) * 0.19, 0.27, 0.34) *
      clamp(Math.ceil(Math.max(0.6, layout.copingY - layout.groundY) / 0.2), 3, 10);
    const targetY = layout.groundY + staircaseHeight * 0.5;
    const framingCentre: readonly [number, number] = [
      centre[0] + reference.tangent[0] * tangentSpan * 0.08,
      centre[1] + reference.tangent[1] * tangentSpan * 0.08,
    ];
    const distance =
      Math.max(
        tangentSpan / 2 / Math.tan(horizontalFov / 2),
        staircaseHeight / 2 / Math.tan(verticalFovRadians / 2),
        (inwardSpan + staircaseRun) * 0.92,
      ) * 1.14;
    return {
      target: [framingCentre[0], targetY, framingCentre[1]],
      position: [
        framingCentre[0] - reference.inward[0] * distance,
        targetY + distance * 0.18,
        framingCentre[1] - reference.inward[1] * distance,
      ],
    };
  }
  const distance = Math.max(tangentSpan / 2 / Math.tan(horizontalFov / 2), inwardSpan * 1.2) * 1.12;
  const targetY = layout.wallTopY - depth * 0.12;
  return {
    target: [centre[0], targetY, centre[1]],
    position: [
      centre[0] + reference.inward[0] * distance,
      targetY + distance * 0.28,
      centre[1] + reference.inward[1] * distance,
    ],
  };
}

/** Medium-close frontal view of the same reference wall, framing roughly
 * half the long wall at waterline height instead of the whole basin --
 * close enough that the skimmer openings, overflow edge or grille clearly
 * read, short of the tight material-swatch framing the Liner/Mosaic camera
 * uses. Shared by all three Step 5 System detail poses so they stay
 * consistent in distance and framing philosophy. */
function getSystemDetailCamera({
  reference,
  bounds,
  layout,
  verticalFov,
  viewportAspect,
  overflow,
  framedSpan: spanOverride,
}: {
  reference: BoundaryFocus;
  bounds: ReturnType<typeof outlineBounds>;
  layout: PoolVerticalLayout;
  verticalFov: number;
  viewportAspect: number;
  overflow: boolean;
  framedSpan?: number;
}): CameraPose {
  const tangentSpan =
    Math.abs(reference.tangent[0]) * bounds.spanX + Math.abs(reference.tangent[1]) * bounds.spanZ;
  const inwardSpan =
    Math.abs(reference.inward[0]) * bounds.spanX + Math.abs(reference.inward[1]) * bounds.spanZ;
  const safeAspect = clamp(viewportAspect, 0.6, 3);
  const verticalFovRadians = (clamp(verticalFov, 20, 75) * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFovRadians / 2) * safeAspect);
  // Frame the actual fitting/edge, not the basin centre behind it.
  // A bounded physical span keeps large pools from turning this into an overview.
  const framedSpan = spanOverride ?? clamp(tangentSpan * 0.42, 2.2, 3.4);
  const distance = Math.min(
    framedSpan / 2 / Math.tan(horizontalFov / 2),
    Math.max(1.2, inwardSpan * 0.78),
  );
  return detailPose({
    focus: reference,
    targetY: layout.waterY + 0.03,
    cameraY: layout.waterY + Math.max(0.48, distance * (overflow ? 0.72 : 0.3)),
    distance,
    tangentAmount: 0,
  });
}

/**
 * Geometry Pass D (Infinity): frames the selected side from OUTSIDE the
 * basin, low and close, so the disappearing lip, the falling cascade and
 * the catch basin all read clearly -- the opposite vantage from every other
 * system detail pose (`getSystemDetailCamera`), which looks IN at the wall
 * from inside the water.
 */
function getInfinityDetailCamera({
  outline,
  zone,
  layout,
  verticalFov,
  viewportAspect,
}: {
  outline: Outline;
  zone: RectangleInfinityZone;
  layout: PoolVerticalLayout;
  verticalFov: number;
  viewportAspect: number;
}): CameraPose {
  const subject = infinityDetailCameraSubject(outline, zone, layout);
  // Outward is essential: the former coastal hero stood on the opposite
  // deck and hid the cascade. A restrained lateral offset reveals its face.
  return fitComponentCamera(subject.points, subject.direction, verticalFov, viewportAspect);
}

/** Oblique wall/floor material view, stable while comparing finishes. */
export function interiorFinishCameraSubject(outline: Outline, layout: PoolVerticalLayout, resolved: ResolvedPoolLayout, floorProfile: FloorProfileModel, infinityZone: RectangleInfinityZone | null = null): { points: CameraPoint[]; direction: CameraPoint } | null {
  const winding = Math.sign(outlineArea(outline)) || 1;
  const occupied = resolved.comfort.elements.flatMap(element => [element.footprint,
    ...(element.steps ?? []).map(step => step.footprint), ...(element.landing ? [element.landing.footprint] : [])]);
  if (resolved.access.placement) occupied.push(resolved.access.footprint);
  if (resolved.ladder?.plan.placement) occupied.push(resolved.ladder.plan.footprint);
  const excluded = new Set(infinityZone ? infinityZone.points.slice(1).map((_, i) => (infinityZone.side + i) % outline.length) : []);
  let best: { points: CameraPoint[]; direction: CameraPoint; span: number } | null = null;
  for (let i = 0; i < outline.length; i++) {
    if (excluded.has(i)) continue;
    const a = outline[i]!, b = outline[(i + 1) % outline.length]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length <= .3) continue;
    const tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length, nx = -tz * winding, nz = tx * winding;
    let free: [number, number][] = [[.15, length - .15]];
    for (const polygon of occupied) {
      const normal = polygon.map(([x, z]) => (x - a[0]) * nx + (z - a[1]) * nz);
      if (Math.max(...normal) < -.05) continue;
      const along = polygon.map(([x, z]) => (x - a[0]) * tx + (z - a[1]) * tz);
      const low = Math.min(...along) - .15, high = Math.max(...along) + .15;
      free = free.flatMap(([start, end]) => [
        ...(low > start ? [[start, Math.min(end, low)] as [number, number]] : []),
        ...(high < end ? [[Math.max(start, high), end] as [number, number]] : []),
      ]).filter(([start, end]) => end - start > .3);
    }
    for (const [start, end] of free) {
      const span = Math.min(1.25, end - start), mid = (start + end) / 2;
      const points: CameraPoint[] = [];
      let valid = true;
      for (const along of [mid - span / 2, mid, mid + span / 2]) {
        const x = a[0] + tx * along, z = a[1] + tz * along;
        const fx = x + nx * .75, fz = z + nz * .75;
        if (!pointInBasin(fx, fz, outline)) { valid = false; break; }
        const wallFloor = floorProfile.floorYAt(x, z);
        points.push([x, wallFloor, z], [x, Math.min(layout.wallTopY, wallFloor + .8), z],
          [fx, floorProfile.floorYAt(fx, fz), fz]);
      }
      if (valid && (!best || end - start > best.span)) best = {
        points, direction: [nx + tx * .2, 1, nz + tz * .2], span: end - start,
      };
    }
  }
  return best ? { points: best.points, direction: best.direction } : null;
}

function getInteriorFinishCamera({
  outline,
  reference,
  bounds,
  layout,
  depth,
  verticalFov,
  viewportAspect,
}: {
  outline: Outline;
  reference: BoundaryFocus;
  bounds: ReturnType<typeof outlineBounds>;
  layout: PoolVerticalLayout;
  depth: number;
  verticalFov: number;
  viewportAspect: number;
}): CameraPose {
  const inwardSpan =
    Math.abs(reference.inward[0]) * bounds.spanX + Math.abs(reference.inward[1]) * bounds.spanZ;
  const boundsCentre: readonly [number, number] = [
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minZ + bounds.maxZ) / 2,
  ];
  const centreOffset =
    (boundsCentre[0] - reference.point[0]) * reference.tangent[0] +
    (boundsCentre[1] - reference.point[1]) * reference.tangent[1];
  const wallCentre: readonly [number, number] = outline.length > 4 ? reference.point : [
    reference.point[0] + reference.tangent[0] * centreOffset,
    reference.point[1] + reference.tangent[1] * centreOffset,
  ];
  // Frame a wall/floor patch, not the entire bounding-box span. The old low
  // eye could end up behind the opposite wall of a narrow pool.
  const inset = Math.min(0.7, inwardSpan * 0.22);
  const targetY = layout.wallTopY - depth * 0.48;
  const halfFov = Math.atan(Math.tan(verticalFov * Math.PI / 360) * Math.min(1, Math.max(0.25, viewportAspect)));
  const distance = Math.max(3.1, 1.25 / Math.sin(halfFov));
  const eyeRise = distance * 0.72;
  return {
    target: [wallCentre[0] + reference.inward[0] * inset, targetY, wallCentre[1] + reference.inward[1] * inset],
    position: [
      wallCentre[0] + reference.inward[0] * distance * 0.7 + reference.tangent[0] * distance * 0.22,
      targetY + eyeRise,
      wallCentre[1] + reference.inward[1] * distance * 0.7 + reference.tangent[1] * distance * 0.22,
    ],
  };
}

/** Bounds of the canonical access plan, never a second placement algorithm. */
export function getAccessDetailCamera(plan: SceneLightingPlan["accessPlan"], layout: PoolVerticalLayout, verticalFov: number, aspect: number, _preciseInfinity = false, outline: Outline = plan.footprint): CameraPose | null {
  const subject = accessCameraSubject(plan, layout, outline);
  return subject ? fitComponentCamera(subject.points, subject.direction, verticalFov, aspect) : null;
}

/** Locked, closer "hero" 3/4 view for the Features / Pool Access step: same
 * elevated architectural angle the overview uses, but pulled in roughly
 * twice as close so a selected feature (internal stairs, ladder, lighting)
 * reads clearly while the whole pool and its border stay in frame -- a
 * curated presentation shot rather than the wide establishing overview. */
/**
 * The lighting pose: a swimmer's-eye view of the luminaire wall.
 *
 * The previous pose was a high, distant three-quarter overview, on which a
 * 260 mm luminaire is a handful of pixels: the only thing large enough to
 * read was the patch its beam threw on the liner, so the light appeared to
 * start at the floor. This frames the wall the fixtures are actually mounted
 * on -- `planPoolLighting` always puts its row on the longest straight edge,
 * which is what this looks up -- from inside the basin, low and close, and
 * off to one side so the beam is seen broadside rather than end-on. The lens,
 * the water it lights and the surface it lands on are then all in frame at
 * once, which is the only way the eye connects them.
 */
function getFeaturesCamera({
  outline,
  layout,
  centre,
  radius,
  ledRow,
}: {
  outline: Outline;
  layout: PoolVerticalLayout;
  centre: readonly [number, number];
  radius: number;
  ledRow: readonly PoolLightPosition[];
}): CameraPose {
  const verticalCentre = (layout.floorY + layout.wallTopY) / 2;
  const anchor = ledRow[Math.floor(ledRow.length / 2)];
  if (!anchor) {
    const distance = radius * 1.9;
    const direction: CameraPoint = [1.55, 1.05, 0.62];
    const directionLength = Math.hypot(...direction);
    return {
      target: [centre[0], verticalCentre, centre[1]],
      position: [
        centre[0] + (direction[0] / directionLength) * distance,
        verticalCentre + (direction[1] / directionLength) * distance,
        centre[1] + (direction[2] / directionLength) * distance,
      ],
    };
  }
  // The fixture's own transform: `rotation` is the yaw of its lens normal,
  // which points into the water.
  const normalX = Math.sin(anchor.rotation);
  const normalZ = Math.cos(anchor.rotation);
  const tangentX = normalZ;
  const tangentZ = -normalX;
  const midX = anchor.x;
  const midZ = anchor.z;
  const lensY = anchor.y;
  const wallLength =
    ledRow.length > 1
      ? Math.hypot(
          ledRow[ledRow.length - 1]!.x - ledRow[0]!.x,
          ledRow[ledRow.length - 1]!.z - ledRow[0]!.z,
        )
      : POOL_LIGHTING_DESIGN.maxSpacing;
  // How far the basin actually extends away from this wall. Deriving the
  // stand-off from the outline's own span, rather than from the bounding
  // radius, keeps the camera inside the water: on a long narrow pool the
  // radius is dominated by the length and would put the viewpoint straight
  // through the opposite wall, looking back at the wrong side of the basin.
  const span = outline.reduce(
    (furthest, [x, z]) => Math.max(furthest, (x - midX) * normalX + (z - midZ) * normalZ),
    0,
  );
  // Stand on the far deck rather than in the water: a 34 degree lens needs
  // roughly six metres of stand-off to hold the deck, the waterline, the
  // luminaire wall and the floor in one frame, and a narrow basin cannot
  // give that from the inside. From here the beam is seen broadside, across
  // the full section it actually travels through.
  const back = span + clamp(span * 0.72, 1.8, 3.8);
  const along = clamp(wallLength * 0.45, 1.6, 4.4);
  const eyeY = layout.waterY + 2.75;
  const targetY = lensY - (lensY - layout.floorY) * 0.3;
  return {
    target: [
      midX + normalX * span * 0.45 + tangentX * along * 0.25,
      targetY,
      midZ + normalZ * span * 0.45 + tangentZ * along * 0.25,
    ],
    position: [
      midX + normalX * back + tangentX * along,
      eyeY,
      midZ + normalZ * back + tangentZ * along,
    ],
  };
}

/** Bounds-driven pose shared by in-ground and above-ground installations. */
export function getCameraPose({
  intent,
  outline,
  layout,
  depth,
  skimmers,
  ledRow = [],
  verticalFov = 35,
  viewportAspect = 1.5,
  includeExternalStaircase = false,
  infinityZone = null,
  accessPlan,
  externalStairPlan,
  coverSubject,
  pellicanoPlacement,
  interiorSubject,
  overviewSubject: configuredOverview,
}: {
  intent: CameraIntent;
  accessPlan?: SceneLightingPlan["accessPlan"];
  externalStairPlan?: { footprint: readonly (readonly [number,number])[]; outward: readonly [number,number]; walk: readonly [number,number] } | null;
  coverSubject?: ReturnType<typeof coverCameraSubject>;
  pellicanoPlacement?: { x:number; z:number; inward: readonly [number,number] } | null;
  interiorSubject?: ReturnType<typeof interiorFinishCameraSubject>;
  overviewSubject?: ReturnType<typeof overviewCameraSubject>;
  outline: Outline;
  layout: PoolVerticalLayout;
  depth: number;
  skimmers: SkimmerPlan;
  /** The luminaire row as actually built, so the lighting pose frames it. */
  ledRow?: readonly PoolLightPosition[];
  verticalFov?: number;
  viewportAspect?: number;
  includeExternalStaircase?: boolean;
  /** Geometry Pass D (Infinity): the selected Rectangle side's zone, only
   * meaningful with `intent: "infinity"`. `null` (every pre-Infinity call,
   * and "infinity" intent with no side selected yet) falls back to the
   * plain overview below, never a bogus/degenerate pose. */
  infinityZone?: RectangleInfinityZone | null;
}): CameraPose {
  const bounds = outlineBounds(outline);
  const centre = outlineCentre(outline);
  const safeDepth = Math.max(0.01, depth);
  const radius = Math.max(1, Math.hypot(bounds.spanX, bounds.spanZ, safeDepth) / 2);
  const verticalCentre = (layout.floorY + layout.wallTopY) / 2;
  if (intent === "cover" && coverSubject) return fitComponentCamera(coverSubject.points, coverSubject.direction, verticalFov, viewportAspect);
  if (intent === "stair-lighting" && accessPlan) {
    const pose = getAccessDetailCamera(accessPlan,layout,verticalFov,viewportAspect,false,outline);
    if (pose) return pose;
  }
  if (intent === "external-stairs" && externalStairPlan) {
    const subject = externalStairCameraSubject(externalStairPlan, layout);
    return fitComponentCamera(subject.points, subject.direction, verticalFov, viewportAspect);
  }
  if (intent === "pellicano" && pellicanoPlacement) {
    const subject=pellicanoCameraSubject(pellicanoPlacement,layout);
    return fitComponentCamera(subject.points,subject.direction,verticalFov,viewportAspect);
  }
  if (intent === "paving") {
    const subject = pavingCameraSubject(outline, layout, skimmers);
    return fitComponentCamera(subject.points, subject.direction, verticalFov, viewportAspect);
  }
  if (intent === "exterior-panel") {
    const reference=getFrontWallReference(outline,skimmers), [x,z]=reference.point, [nx,nz]=reference.inward, [tx,tz]=reference.tangent;
    const points:CameraPoint[]=[];
    for(const along of [-1.4,1.4])for(const y of [layout.groundY,layout.copingY+.08])points.push([x-nx*.18+tx*along,y,z-nz*.18+tz*along]);
    return fitComponentCamera(points,[-nx+tx*.35,.32,-nz+tz*.35],verticalFov,viewportAspect);
  }
  if (intent === "top") {
    const extent = Math.max(bounds.spanZ + 4, (bounds.spanX + 4) / Math.max(0.25, viewportAspect));
    const height = extent / (2 * Math.tan(verticalFov * Math.PI / 360));
    return { position: [centre[0], layout.wallTopY + height, centre[1] + 0.001], target: [centre[0], layout.waterY, centre[1]] };
  }
  if (intent === "elevation-long" || intent === "elevation-short") {
    const alongX = bounds.spanX >= bounds.spanZ;
    // Face the long side (looking across the short axis) or the short side.
    const faceZ = intent === "elevation-long" ? alongX : !alongX;
    const across = faceZ ? bounds.spanX : bounds.spanZ;
    const tanY = Math.tan((verticalFov * Math.PI) / 360);
    const tanX = tanY * Math.max(0.25, viewportAspect);
    const height = layout.copingY - layout.groundY;
    const fit = Math.max((across + 3) / 2 / tanX, (height + 2.2) / 2 / tanY);
    const eyeY = layout.groundY + height * 0.55 + 0.35;
    const targetY = layout.groundY + height * 0.45;
    const depthOffset = (faceZ ? bounds.spanZ : bounds.spanX) / 2 + fit;
    return faceZ
      ? { position: [centre[0], eyeY, centre[1] + depthOffset], target: [centre[0], targetY, centre[1]] }
      : { position: [centre[0] + depthOffset, eyeY, centre[1]], target: [centre[0], targetY, centre[1]] };
  }
  if (intent === "waterline") {
    if (infinityZone) {
      const subject = infinityWaterlineCameraSubject(outline, infinityZone, layout);
      return getSystemDetailCamera({ reference: subject.reference, framedSpan: subject.framedSpan,
        bounds, layout, verticalFov, viewportAspect, overflow: false });
    }
    return getSystemDetailCamera({
      reference: getFrontWallReference(outline, skimmers), bounds, layout,
      verticalFov, viewportAspect, overflow: false,
    });
  }
  if (intent === "coping") {
    if (infinityZone) {
      const subject = infinityCopingCameraSubject(outline, infinityZone, layout);
      return fitComponentCamera(subject.points, subject.direction, verticalFov, viewportAspect);
    }
    const reference = getFrontWallReference(outline, skimmers);
    if(!infinityZone) {
      const [x,z]=reference.point,[nx,nz]=reference.inward,[tx,tz]=reference.tangent;
      const points:CameraPoint[]=[];
      for(const along of [-1.2,1.2])for(const out of [-.55,.15])for(const y of [layout.copingY-.12,layout.copingY+.05])points.push([x+nx*out+tx*along,y,z+nz*out+tz*along]);
      return fitComponentCamera(points,[nx+tx*.4,.8,nz+tz*.4],verticalFov,viewportAspect);
    }
    return detailPose({ focus: reference, targetY: layout.copingY, cameraY: layout.copingY + 3.1, distance: 3.8 / Math.min(1, Math.max(0.4, viewportAspect)), tangentAmount: 1.3 });
  }
  if (intent === "access" && accessPlan) {
    const pose = getAccessDetailCamera(accessPlan, layout, verticalFov, viewportAspect, false, outline);
    if (pose) return pose;
  }
  if (
    intent === "skimmer" ||
    intent === "skimmer-detail" ||
    intent === "overflow" ||
    intent === "overflow-hidden" ||
    intent === "overflow-visible" ||
    intent === "liner" ||
    intent === "mosaic"
  ) {
    if ((intent === "liner" || intent === "mosaic") && interiorSubject)
      return fitComponentCamera(interiorSubject.points, interiorSubject.direction, verticalFov, viewportAspect);
    let reference = getFrontWallReference(outline, skimmers);
    if ((intent === "liner" || intent === "mosaic") && outline.length >= 3) {
      // A material detail needs a real lined wall, not the disappearing lip
      // or a bounding-box centre that can fall inside an L-shaped recess.
      const winding = Math.sign(outline.reduce((sum, a, i) => {
        const b = outline[(i + 1) % outline.length]!;
        return sum + a[0] * b[1] - b[0] * a[1];
      }, 0)) || 1;
      const edges = outline.map((a, i) => {
        const b = outline[(i + 1) % outline.length]!;
        return { a, b, i, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
      }).filter((edge) => edge.length > 0.01 && edge.i !== infinityZone?.side).sort((a, b) => b.length - a.length);
      const edge = edges[0];
      if (edge) {
        const tx = (edge.b[0] - edge.a[0]) / edge.length, tz = (edge.b[1] - edge.a[1]) / edge.length;
        reference = { point: [(edge.a[0] + edge.b[0]) / 2, (edge.a[1] + edge.b[1]) / 2], inward: [-tz * winding, tx * winding], tangent: [tx, tz] };
      }
    }
    if (intent === "overflow-hidden" || intent === "overflow-visible") {
      const subject = overflowCameraSubject(intent, outline, layout, skimmers);
      return fitComponentCamera(subject.points, subject.direction, verticalFov, viewportAspect);
    }
    if (intent === "skimmer-detail") {
      return getSystemDetailCamera({
        reference,
        bounds,
        layout,
        verticalFov,
        viewportAspect,
        overflow: intent !== "skimmer-detail",
      });
    }
    const master = getFrontWallMasterCamera({
      reference,
      bounds,
      layout,
      depth: safeDepth,
      verticalFov,
      viewportAspect,
      includeExternalStaircase: intent === "skimmer" && includeExternalStaircase,
    });
    if (intent === "liner" || intent === "mosaic") {
      return getInteriorFinishCamera({
        outline,
        reference,
        bounds,
        layout,
        depth: safeDepth,
        verticalFov,
        viewportAspect,
      });
    }
    return master;
  }

  if (intent === "features") {
    const subject = lightingCameraSubject(outline, layout, ledRow);
    return fitComponentCamera(subject.points, subject.direction, verticalFov, viewportAspect);
  }

  if (intent === "infinity" && infinityZone) {
    return getInfinityDetailCamera({
      outline,
      zone: infinityZone,
      layout,
      verticalFov,
      viewportAspect,
    });
  }

  // Photographic overview only: clear the full coping and view along the
  // basin at a lower elevation. Interaction and all detail poses are unchanged.
  const overviewSubject = configuredOverview ?? overviewCameraSubject(outline, layout);
  if (configuredOverview && (intent === "review" || intent === "overview"))
    return fitComponentCamera(overviewSubject.points,overviewSubject.direction,verticalFov,viewportAspect);
  const [overviewDx, , overviewDz] = overviewSubject.direction;
  const direction: CameraPoint = intent === "structure" ? [overviewDx, 1.6, overviewDz] : intent === "depth" ? [0.45, 1.05, 1.7] : intent === "cover" ? [1.35, 1.35, 0.75] : overviewSubject.direction;
  const directionLength = Math.hypot(...direction);
  // Fit the actual pool + local paving to the canvas, including portrait.
  const eye = direction.map(v => v / directionLength);
  const h = Math.hypot(eye[0]!, eye[2]!);
  const right = [eye[2]! / h, 0, -eye[0]! / h];
  const up = [-eye[0]! * eye[1]! / h, h, -eye[2]! * eye[1]! / h];
  const tanY = Math.tan(verticalFov * Math.PI / 360), tanX = tanY * Math.max(0.25, viewportAspect);
  let distance = radius * 2;
  for (const [x, y, z] of overviewSubject.points) {
    const v = [x - centre[0], y - verticalCentre, z - centre[1]];
    const dot = (a: number[]) => v.reduce((sum, value, i) => sum + value * a[i]!, 0);
    distance = Math.max(distance, dot(eye) + 1.05 * Math.max(Math.abs(dot(right)) / tanX, Math.abs(dot(up)) / tanY));
  }
  return {
    target: [centre[0], verticalCentre, centre[1]],
    position: [
      centre[0] + (direction[0] / directionLength) * distance,
      verticalCentre + (direction[1] / directionLength) * distance,
      centre[1] + (direction[2] / directionLength) * distance,
    ],
  };
}
