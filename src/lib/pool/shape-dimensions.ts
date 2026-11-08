import { DIMENSION_LIMITS, type DimensionKey } from "./config";
import { clampLShapeDimensions, L_SHAPE_GUARDRAILS } from "./l-shape";
import type { Dimensions, PoolShapeId } from "./types";

/** Keep the controls, stored dimensions and actual L outline in agreement. */
export function normalizeShapeDimensions(shape: PoolShapeId, dimensions: Dimensions): Dimensions {
  if (shape !== "l-shape") return dimensions;
  const l = clampLShapeDimensions({ totalLength: dimensions.length, totalWidth: dimensions.width,
    recessLength: dimensions.lShapeRecessLength, recessWidth: dimensions.lShapeRecessWidth,
    orientation: dimensions.lShapeOrientation });
  return { ...dimensions, length: l.totalLength, width: l.totalWidth,
    lShapeRecessLength: l.recessLength, lShapeRecessWidth: l.recessWidth,
    lShapeOrientation: l.orientation };
}

export function shapeDimensionLimits(shape: PoolShapeId, key: DimensionKey, dimensions: Dimensions) {
  const limits = DIMENSION_LIMITS[key];
  if (shape !== "l-shape") return limits;
  if (key === "length") return { ...limits, min: L_SHAPE_GUARDRAILS.totalLength.min };
  if (key === "width") return { ...limits, min: L_SHAPE_GUARDRAILS.totalWidth.min };
  if (key === "lShapeRecessLength" || key === "lShapeRecessWidth") {
    const span = key === "lShapeRecessLength" ? dimensions.length : dimensions.width;
    return { ...limits, max: Math.max(limits.min, Math.min(limits.max, span - L_SHAPE_GUARDRAILS.minLegWidth)) };
  }
  return limits;
}
