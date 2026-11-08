import type { CatalogueSetting } from "./catalogue-architecture";
import type { Outline } from "./types";

/** Owner-approved catalogue scope, not a construction or GPU performance limit. */
export function catalogueIndoorAvailable(outline: Outline): boolean {
  if (outline.length < 3 || outline.some(point => !point.every(Number.isFinite))) return false;
  const xs = outline.map(point => point[0]), zs = outline.map(point => point[1]);
  const spanX = Math.max(...xs) - Math.min(...xs), spanZ = Math.max(...zs) - Math.min(...zs);
  const length = Math.max(spanX, spanZ), width = Math.min(spanX, spanZ);
  // Allow only floating-point roundoff at the inclusive boundary.
  return length >= 1 && width >= 1 && length <= 12 + 1e-8 && width <= 6 + 1e-8;
}

/** Also used before rendering, so a newly oversized pool never mounts an indoor scene. */
export function resolveCatalogueSetting(
  setting: CatalogueSetting,
  infinity: boolean,
  indoorAvailable: boolean,
): CatalogueSetting {
  if (infinity) return setting === "infinity-villa" ? setting : "garden";
  if (setting === "infinity-villa" || (!indoorAvailable && setting.startsWith("spa-"))) return "garden";
  return setting;
}
