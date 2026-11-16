import { supportsCopingStyle } from "./coping-style";
import { buildOutline } from "./geometry";
import type { Outline, PoolConfig } from "./types";

export const DEDICATED_POOL_CORNER_RADIUS = .2;
export const POOL_CORNER_ARC_SEGMENTS = 16;

type OutlineConfig = Pick<PoolConfig,
  "shape" | "dimensions" | "controlPoints" | "poolType" | "system" | "overflowType" | "copingStyle" | "copingEdge">;

export function roundedPoolCorners(config: OutlineConfig) {
  return (config.shape === "rectangle" || config.shape === "l-shape") && config.poolType === "in-ground" &&
    (config.system === "skimmer" && config.copingEdge === "rounded" ||
      supportsCopingStyle(config) && config.copingStyle === "dedicated");
}

/** Round the five outer L corners; retain its approved square recess corner. */
function roundedLShapeOutline(outline: Outline): Outline {
  return outline.flatMap((point, index) => {
    const previous = outline[(index + outline.length - 1) % outline.length]!;
    const next = outline[(index + 1) % outline.length]!;
    const inLength = Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    const outLength = Math.hypot(next[0] - point[0], next[1] - point[1]);
    const inX = (point[0] - previous[0]) / inLength, inZ = (point[1] - previous[1]) / inLength;
    const outX = (next[0] - point[0]) / outLength, outZ = (next[1] - point[1]) / outLength;
    const turn = Math.sign(inX * outZ - inZ * outX);
    // A 20 cm reflex fillet would collapse under the wider 32 cm coping offset.
    if (turn < 0) return [point];
    const radius = Math.min(DEDICATED_POOL_CORNER_RADIUS, Math.min(inLength, outLength) / 2 * (1 - 1e-6));
    const first = [point[0] - inX * radius, point[1] - inZ * radius] as const;
    const last = [point[0] + outX * radius, point[1] + outZ * radius] as const;
    const centerX = first[0] - inZ * radius * turn;
    const centerZ = first[1] + inX * radius * turn;
    const angle = Math.atan2(first[1] - centerZ, first[0] - centerX);
    return Array.from({ length: POOL_CORNER_ARC_SEGMENTS + 1 }, (_, i) => {
      if (i === 0) return first;
      if (i === POOL_CORNER_ARC_SEGMENTS) return last;
      const sampleAngle = angle + turn * i / POOL_CORNER_ARC_SEGMENTS * Math.PI / 2;
      return [centerX + radius * Math.cos(sampleAngle), centerZ + radius * Math.sin(sampleAngle)] as const;
    });
  });
}

/** Real corners: selected Skimmer rounding or the dedicated concealed-overflow rim. */
export function configuredOutline(config: OutlineConfig): Outline {
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  if (!roundedPoolCorners(config)) return outline;
  if (config.shape === "l-shape") return roundedLShapeOutline(outline);

  const [minX, minZ] = outline[0]!;
  const [maxX, maxZ] = outline[2]!;
  // Keep a positive straight span even for malformed, sub-metre legacy dimensions.
  const halfSpan = Math.min(maxX - minX, maxZ - minZ) / 2;
  const radius = Math.min(DEDICATED_POOL_CORNER_RADIUS, halfSpan * (1 - 1e-6));
  const corners = [
    { center: [minX + radius, minZ + radius], angle: Math.PI,
      first: [minX, minZ + radius], last: [minX + radius, minZ] },
    { center: [maxX - radius, minZ + radius], angle: Math.PI * 1.5,
      first: [maxX - radius, minZ], last: [maxX, minZ + radius] },
    { center: [maxX - radius, maxZ - radius], angle: 0,
      first: [maxX, maxZ - radius], last: [maxX - radius, maxZ] },
    { center: [minX + radius, maxZ - radius], angle: Math.PI * .5,
      first: [minX + radius, maxZ], last: [minX, maxZ - radius] },
  ] as const;
  return corners.flatMap(corner => Array.from({ length: POOL_CORNER_ARC_SEGMENTS + 1 }, (_, i) => {
    // Exact tangency coordinates keep all four straight sides collinear.
    if (i === 0) return corner.first;
    if (i === POOL_CORNER_ARC_SEGMENTS) return corner.last;
    const angle = corner.angle + i / POOL_CORNER_ARC_SEGMENTS * Math.PI / 2;
    return [corner.center[0] + radius * Math.cos(angle), corner.center[1] + radius * Math.sin(angle)] as const;
  }));
}
