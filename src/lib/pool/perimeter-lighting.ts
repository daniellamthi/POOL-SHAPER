import { buildOutline } from "./geometry";
import { configuredOutline } from "./configured-outline";
import { signedWaterArea } from "./boundary-placement";
import { infinityExclusion } from "./infinity-edge";
import { getPoolVerticalLayout } from "./vertical-layout";
import { POOL_BORDER_PRESET } from "@/configurator/materials/visual-presets";
import type { Outline, PoolConfig } from "./types";

export type PoolLedType = "underwater" | "perimeter";
export interface PerimeterLightSide {
  id: number;
  available: boolean;
  length: number;
  points: ReadonlyArray<readonly [number, number, number]>;
  inward: readonly [number, number];
}
export interface PerimeterLightingPlan {
  sides: ReadonlyArray<PerimeterLightSide>;
  selected: ReadonlyArray<PerimeterLightSide>;
  length: number;
  signature: string;
}

export const poolLedType = (value: unknown): PoolLedType =>
  value === "perimeter" ? "perimeter" : "underwater";
export const isPoolLedType = (value: unknown): value is PoolLedType =>
  value === "underwater" || value === "perimeter";
export const isPerimeterSideSelection = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length <= 64 &&
  value.every((id) => Number.isSafeInteger(id) && id >= 0 && id < 1024) &&
  new Set(value).size === value.length;

function distanceToEdge(p: readonly number[], a: readonly number[], b: readonly number[]) {
  const dx = b[0]! - a[0]!,
    dz = b[1]! - a[1]!;
  const t = Math.max(
    0,
    Math.min(1, ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(p[0]! - a[0]! - t * dx, p[1]! - a[1]! - t * dz);
}

/** Keep logical side IDs on the unrounded design; mount on the ACTUAL wall
 * polyline, including its approved corner fillets. No chord across the basin. */
export function configuredPerimeterLights(config: PoolConfig): PerimeterLightingPlan {
  const logical = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const outline: Outline = configuredOutline(config);
  const winding = Math.sign(signedWaterArea(outline)) || 1;
  const vertical = getPoolVerticalLayout({
    poolType: config.poolType ?? "in-ground",
    system: config.system,
    overflowType: config.overflowType,
    depth: config.dimensions.depth,
    copingThickness: POOL_BORDER_PRESET.thickness,
    ...(config.copingStyle ? { copingStyle: config.copingStyle } : {}),
  });
  const y = Math.min(
    vertical.wallTopY - 0.02,
    vertical.copingY - POOL_BORDER_PRESET.thickness - 0.02,
  );
  const excluded =
    config.system === "infinity" && config.infinityEdge?.enabled
      ? infinityExclusion(outline, config.infinityEdge, config.shape)
      : null;
  const edgeSides = outline.map((a, index) => {
    const b = outline[(index + 1) % outline.length]!;
    const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let side = 0,
      distance = Infinity;
    logical.forEach((start, id) => {
      const current = distanceToEdge(middle, start, logical[(id + 1) % logical.length]!);
      if (current < distance) {
        side = id;
        distance = current;
      }
    });
    return side;
  });
  const insetPoint = (index: number): readonly [number, number, number] => {
    const p = outline[index]!,
      before = outline[(index - 1 + outline.length) % outline.length]!,
      after = outline[(index + 1) % outline.length]!;
    const dx = after[0] - before[0],
      dz = after[1] - before[1],
      length = Math.hypot(dx, dz) || 1;
    return [p[0] - (dz / length) * winding * 0.004, y, p[1] + (dx / length) * winding * 0.004];
  };
  const sides = logical.map((a, id): PerimeterLightSide => {
    const b = logical[(id + 1) % logical.length]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const indices = edgeSides.flatMap((side, index) => (side === id ? [index] : []));
    const start =
      indices.find((index) => edgeSides[(index - 1 + outline.length) % outline.length] !== id) ??
      indices[0];
    const ordered =
      start === undefined
        ? []
        : Array.from({ length: indices.length }, (_, i) => (start + i) % outline.length);
    const axis = excluded?.axis === "x" ? 0 : 1;
    const blocked = indices.some(
      (index) =>
        excluded?.edgeIndices?.includes(index) ||
        (excluded &&
          !excluded.edgeIndices &&
          Math.abs(outline[index]![axis] - excluded.coordinate) < 1e-5 &&
          Math.abs(outline[(index + 1) % outline.length]![axis] - excluded.coordinate) < 1e-5),
    );
    const points = ordered.map(insetPoint);
    if (ordered.length)
      points.push(insetPoint((ordered[ordered.length - 1]! + 1) % outline.length));
    const stripLength = points
      .slice(1)
      .reduce(
        (sum, point, index) =>
          sum + Math.hypot(point[0] - points[index]![0], point[2] - points[index]![2]),
        0,
      );
    return {
      id,
      available: !blocked && points.length > 1 && length > 0.1,
      length: stripLength,
      points,
      inward: [
        (-(b[1] - a[1]) / (length || 1)) * winding,
        ((b[0] - a[0]) / (length || 1)) * winding,
      ],
    };
  });
  const defaults = [...sides]
    .filter((side) => side.available)
    .sort((a, b) => b.length - a.length)
    .slice(0, 1)
    .map((side) => side.id);
  const requested = config.ledPerimeterSides ?? defaults;
  const selected = sides.filter((side) => side.available && requested.includes(side.id));
  return {
    sides,
    selected,
    length: selected.reduce((sum, side) => sum + side.length, 0),
    signature: JSON.stringify(selected.map((side) => [side.id, side.points])),
  };
}
