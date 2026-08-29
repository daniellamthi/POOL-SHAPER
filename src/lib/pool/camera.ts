import { planSkimmers } from "./engineering";
import type { SkimmerPlan } from "./engineering";
import { outlineArea, outlineBounds } from "./geometry";
import type { Outline } from "./types";
import type { PoolVerticalLayout } from "./vertical-layout";

export type CameraIntent = "overview" | "skimmer" | "overflow" | "liner" | "mosaic" | "review";
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

/** Close, perpendicular material view of the same Skimmer reference wall. */
function getInteriorFinishCamera({
  reference,
  bounds,
  layout,
  depth,
  verticalFov,
  viewportAspect,
}: {
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
  const wallCentre: readonly [number, number] = [
    reference.point[0] + reference.tangent[0] * centreOffset,
    reference.point[1] + reference.tangent[1] * centreOffset,
  ];
  const maximumInteriorDistance = Math.max(1.7, inwardSpan * 0.82);
  const distance = clamp(
    Math.max(1.6, inwardSpan * 0.64, depth * 1.35),
    1.6,
    maximumInteriorDistance,
  );
  const targetY = layout.wallTopY - depth * 0.3;
  const cameraY = layout.waterY + clamp(depth * 0.18, 0.22, 0.38);
  return {
    target: [wallCentre[0], targetY, wallCentre[1]],
    position: [
      wallCentre[0] + reference.inward[0] * distance,
      cameraY,
      wallCentre[1] + reference.inward[1] * distance,
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
  verticalFov = 35,
  viewportAspect = 1.5,
  includeExternalStaircase = false,
}: {
  intent: CameraIntent;
  outline: Outline;
  layout: PoolVerticalLayout;
  depth: number;
  skimmers: SkimmerPlan;
  verticalFov?: number;
  viewportAspect?: number;
  includeExternalStaircase?: boolean;
}): CameraPose {
  const bounds = outlineBounds(outline);
  const centre = outlineCentre(outline);
  const safeDepth = Math.max(0.01, depth);
  const radius = Math.max(1, Math.hypot(bounds.spanX, bounds.spanZ, safeDepth) / 2);
  const verticalCentre = (layout.floorY + layout.wallTopY) / 2;
  if (intent === "skimmer" || intent === "overflow" || intent === "liner" || intent === "mosaic") {
    const reference = getFrontWallReference(outline, skimmers);
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
      });
    }
    return master;
  }

  const distance = radius * (intent === "review" ? 2.25 : 2.45);
  const direction: CameraPoint = intent === "review" ? [0.72, 0.7, 0.92] : [0.86, 0.76, 1.04];
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
