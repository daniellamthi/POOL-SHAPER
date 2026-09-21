import { planSkimmers } from "./engineering";
import type { SkimmerPlan } from "./engineering";
import { outlineArea, outlineBounds } from "./geometry";
import { POOL_LIGHTING_DESIGN } from "./lighting";
import type { PoolLightPosition } from "./lighting";
import { classifyOutlineCorners } from "./l-shape";
import type { Outline } from "./types";
import type { PoolVerticalLayout } from "./vertical-layout";
import type { RectangleInfinityZone } from "./infinity-edge";

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
    cameraY: layout.waterY + Math.max(0.48, distance * (overflow ? 0.58 : 0.3)),
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
  zone,
  layout,
  verticalFov,
  viewportAspect,
}: {
  zone: RectangleInfinityZone;
  layout: PoolVerticalLayout;
  verticalFov: number;
  viewportAspect: number;
}): CameraPose {
  const midpoint: readonly [number, number] = [
    (zone.start[0] + zone.end[0]) / 2,
    (zone.start[1] + zone.end[1]) / 2,
  ];
  const safeAspect = clamp(viewportAspect, 0.6, 3);
  const verticalFovRadians = (clamp(verticalFov, 20, 75) * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFovRadians / 2) * safeAspect);
  const framedSpan = clamp(zone.length * 0.75, 2.6, 5.5);
  const distance = Math.max(
    2.2,
    Math.min(framedSpan / 2 / Math.tan(horizontalFov / 2), zone.length * 0.9),
  );
  // Just above the catch-basin floor, looking slightly up across the
  // cascade -- the vantage that actually shows the waterfall as a sheet
  // rather than foreshortened from directly above.
  const cameraY = layout.floorY + Math.max(0.35, (layout.wallTopY - layout.floorY) * 0.28);
  const targetY = layout.waterY - 0.15;
  return {
    target: [midpoint[0] + zone.normal[0] * 0.6, targetY, midpoint[1] + zone.normal[1] * 0.6],
    position: [
      midpoint[0] + zone.normal[0] * distance,
      cameraY,
      midpoint[1] + zone.normal[1] * distance,
    ],
  };
}

/** Close, perpendicular material view of the same Skimmer reference wall. */
function getInteriorFinishCamera({
  reference,
  bounds,
  layout,
  depth,
  verticalFov,
  viewportAspect,
  isLiner,
}: {
  reference: BoundaryFocus;
  bounds: ReturnType<typeof outlineBounds>;
  layout: PoolVerticalLayout;
  depth: number;
  verticalFov: number;
  viewportAspect: number;
  /** Liner gets a slightly pulled-back, more architectural composition than
   * the tight material-swatch framing Mosaic keeps -- more of the pool
   * interior in frame while the liner texture itself stays clearly legible. */
  isLiner: boolean;
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
  const wallCentre: readonly [number, number] = [
    reference.point[0] + reference.tangent[0] * centreOffset,
    reference.point[1] + reference.tangent[1] * centreOffset,
  ];
  const maximumInteriorDistance = Math.max(1.7, inwardSpan * 0.82) * (isLiner ? 1.65 : 1);
  const baseDistance = clamp(
    Math.max(1.6, inwardSpan * 0.64, depth * 1.35),
    1.6,
    maximumInteriorDistance,
  );
  const distance = isLiner ? baseDistance * 1.65 : baseDistance;
  const targetY = layout.wallTopY - depth * 0.3;
  const cameraY =
    layout.waterY + clamp(depth * (isLiner ? 0.3 : 0.18), 0.22, isLiner ? 0.56 : 0.38);
  return {
    target: [wallCentre[0], targetY, wallCentre[1]],
    position: [
      wallCentre[0] + reference.inward[0] * distance,
      cameraY,
      wallCentre[1] + reference.inward[1] * distance,
    ],
  };
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
}: {
  intent: CameraIntent;
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
  if (
    intent === "skimmer" ||
    intent === "skimmer-detail" ||
    intent === "overflow" ||
    intent === "overflow-hidden" ||
    intent === "overflow-visible" ||
    intent === "liner" ||
    intent === "mosaic"
  ) {
    const reference = getFrontWallReference(outline, skimmers);
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
        reference,
        bounds,
        layout,
        depth: safeDepth,
        verticalFov,
        viewportAspect,
        // Compare all finishes from the same existing architectural pose.
        isLiner: true,
      });
    }
    return master;
  }

  if (intent === "features") {
    return getFeaturesCamera({ outline, layout, centre, radius, ledRow });
  }

  if (intent === "infinity" && infinityZone) {
    return getInfinityDetailCamera({ zone: infinityZone, layout, verticalFov, viewportAspect });
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
