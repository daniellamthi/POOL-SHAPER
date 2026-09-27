import { planSkimmers } from "./engineering";
import type { SkimmerPlan } from "./engineering";
import { outlineArea, outlineBounds } from "./geometry";
import { POOL_LIGHTING_DESIGN } from "./lighting";
import type { PoolLightPosition } from "./lighting";
import { classifyOutlineCorners } from "./l-shape";
import type { Outline } from "./types";
import type { PoolVerticalLayout } from "./vertical-layout";
import { clampInfinityEdgeDimensions } from "./infinity-edge";
import type { RectangleInfinityZone } from "./infinity-edge";
import type { SceneLightingPlan } from "./lighting-plan";

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
}: {
  reference: BoundaryFocus;
  bounds: ReturnType<typeof outlineBounds>;
  layout: PoolVerticalLayout;
  verticalFov: number;
  viewportAspect: number;
  overflow: boolean;
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
  const framedSpan = clamp(tangentSpan * 0.42, 2.2, 3.4);
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
  const midpoint: readonly [number, number] = [
    (zone.start[0] + zone.end[0]) / 2,
    (zone.start[1] + zone.end[1]) / 2,
  ];
  // Expanded portrait phones can be narrower than 0.6. Respect their
  // actual horizontal field of view instead of cropping the end closures.
  const safeAspect = clamp(viewportAspect, 0.2, 3);
  const verticalFovRadians = (clamp(verticalFov, 20, 75) * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFovRadians / 2) * safeAspect);
  const bounds = outlineBounds(outline);
  // Fit the architecture, not a cropped two-metre section of the crest.
  // Include the two-metre usable deck on each side, not just the water
  // outline: its end returns were clipped on narrow portrait viewports.
  const framedSpan = Math.hypot(bounds.maxX - bounds.minX + 4, bounds.maxZ - bounds.minZ + 4) * 1.04;
  let distance = Math.max(
    1.8,
    framedSpan / 2 / Math.tan(Math.min(horizontalFov, verticalFovRadians) / 2),
  );
  // A Rectangle/L-shape zone's `start`/`end` always sit exactly at the
  // outline's own bounding-box extreme on the SAME axis its (always
  // axis-aligned) `normal` points along, so stepping out along that normal
  // by even a couple of metres always clears that axis -- the fixed
  // `framedSpan`-driven distance above was never observed to under-clear
  // for either shape. An Organic zone's own local point can sit well inside
  // the bbox on one axis while only marginally past the other (a diagonal
  // compass-quadrant normal on a highly eccentric, highly curved outline),
  // so the same short standoff can leave the camera still inside the
  // bounding box on BOTH axes -- a real "camera stuck near the basin"
  // defect found via this pass's own geometry audit (extreme 20x14,
  // curvature=1 case), not a hypothetical. Floor `distance` at whatever is
  // actually needed to clear the NEARER of the two axis bounds along this
  // zone's own normal direction (never less than the framing distance
  // above, so a well-behaved near-axis-aligned zone -- every Rectangle/
  // L-shape zone, and most Organic ones -- never regresses).
  // Apply the clearance to the actual oblique viewing ray, not just the wall normal.
  const viewX = (zone.normal[0] - zone.normal[1] * 0.65) / Math.hypot(1, 0.65);
  const viewZ = (zone.normal[1] + zone.normal[0] * 0.65) / Math.hypot(1, 0.65);
  const clearanceMargin = 0.6;
  const axisCandidates: number[] = [];
  if (viewX > 1e-6) {
    axisCandidates.push((bounds.maxX + clearanceMargin - midpoint[0]) / viewX);
  } else if (viewX < -1e-6) {
    axisCandidates.push((bounds.minX - clearanceMargin - midpoint[0]) / viewX);
  }
  if (viewZ > 1e-6) {
    axisCandidates.push((bounds.maxZ + clearanceMargin - midpoint[1]) / viewZ);
  } else if (viewZ < -1e-6) {
    axisCandidates.push((bounds.minZ - clearanceMargin - midpoint[1]) / viewZ);
  }
  const positiveAxisCandidates = axisCandidates.filter((d) => Number.isFinite(d) && d > 0);
  if (positiveAxisCandidates.length > 0) {
    distance = Math.max(distance, Math.min(...positiveAxisCandidates));
  }
  // Eye-level, just outside the pool, looking down and across the lip into
  // the cascade and catch basin. The catch basin itself is a genuinely
  // shallow structure right at grade (lipTopY down by dropHeight +
  // catchBasinDepth -- mirrors InfinityEdge.tsx's own lipTopY/basinFloorY
  // maths exactly), but the camera's XZ position (up to `distance`, which
  // can be several metres along the normal for a long side) lands well
  // outside the basin's own ~lipWidth+catchBasinWidth footprint -- ordinary
  // open deck/grade out there, not basin interior. A `cameraY` derived from
  // the basin floor (as this used to be, and before that `layout.floorY`,
  // the *main pool's* much deeper floor) put the camera underground/
  // embedded in the surrounding terrain at that distance, producing a
  // broken, flat-banded, backface-only view instead of the lip/cascade/
  // basin. Eye height above grade is correct everywhere along the normal,
  // not just directly over the basin.
  const dims = clampInfinityEdgeDimensions(undefined);
  const lipTopY = layout.waterY;
  const cameraY = layout.wallTopY + Math.max(1.8, distance * 0.4);
  const targetY = lipTopY - dims.dropHeight * 0.5;
  // Centred on the catch basin's own footprint (lip, then basin width),
  // not just 0.6m past the wall -- keeps the whole assembly (lip, cascade,
  // basin far wall) in frame instead of cropping past it.
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  return {
    target: [midpoint[0] * 0.35 + centerX * 0.65, targetY, midpoint[1] * 0.35 + centerZ * 0.65],
    position: [midpoint[0] + viewX * distance, cameraY, midpoint[1] + viewZ * distance],
  };
}

/** Oblique wall/floor material view, stable while comparing finishes. */
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
export function getAccessDetailCamera(plan: SceneLightingPlan["accessPlan"], layout: PoolVerticalLayout, verticalFov: number, aspect: number): CameraPose | null {
  const p = plan.placement;
  if (!p || !plan.footprint.length) return null;
  const ladder = plan.ladderDepths.length > 0;
  const points = [...plan.footprint];
  if (ladder) points.push([p.x - Math.sin(p.rotation) * plan.ladderAnchorOffset, p.z - Math.cos(p.rotation) * plan.ladderAnchorOffset]);
  const bounds = outlineBounds(points);
  const low = ladder ? plan.ladderAnchorY - plan.ladderDepths.at(-1)! - 0.15 : layout.copingY - plan.rise * plan.riseCount;
  const high = ladder ? plan.ladderAnchorY + 0.82 : layout.copingY;
  const target: CameraPoint = [(bounds.minX + bounds.maxX) / 2, (low + high) / 2, (bounds.minZ + bounds.maxZ) / 2];
  let nx = target[0] - p.x, nz = target[2] - p.z;
  const n = Math.hypot(nx, nz);
  if (n < 0.05 || ladder) { nx = Math.sin(p.rotation); nz = Math.cos(p.rotation); }
  else { nx /= n; nz /= n; }
  const radius = Math.hypot(bounds.spanX + 0.35, bounds.spanZ + 0.35, high - low + 0.25) / 2;
  const halfFov = Math.atan(Math.tan(verticalFov * Math.PI / 360) * Math.min(1, Math.max(0.2, aspect)));
  const distance = radius / Math.sin(halfFov) * 1.12;
  const elevation = ladder ? 0.72 : 1.5;
  const length = Math.hypot(1, elevation);
  return { target, position: [target[0] + nx * distance / length, target[1] + elevation * distance / length, target[2] + nz * distance / length] };
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
}: {
  intent: CameraIntent;
  accessPlan?: SceneLightingPlan["accessPlan"];
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
  if (intent === "access" && accessPlan) {
    const pose = getAccessDetailCamera(accessPlan, layout, verticalFov, viewportAspect);
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
    if (
      intent === "skimmer-detail" ||
      intent === "overflow-hidden" ||
      intent === "overflow-visible"
    ) {
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
    return getFeaturesCamera({ outline, layout, centre, radius, ledRow });
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
  const distance = radius * 3.4;
  const [overviewDx, overviewDz] = overviewDirection(outline, centre);
  const direction: CameraPoint = [overviewDx, 0.9, overviewDz];
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
