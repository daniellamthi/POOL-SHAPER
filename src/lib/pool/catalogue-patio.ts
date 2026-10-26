import type { Outline } from "./types";

export type PatioFinish = "plaster" | "wood" | "cap" | "gravel" | "reveal";
export interface PatioPart {
  finish: PatioFinish;
  position: [number, number, number];
  size: [number, number, number];
}
export interface PatioPlan {
  parts: PatioPart[];
  protectedBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}
/** Illustrative architecture outside the actual terrace AND selected accessories.
 * Bounds are mirrored behind the established overview direction; pool coordinates
 * and all existing deck geometry remain untouched. Units are metres. */
export function planCataloguePatio(
  terrace: Outline,
  occupied: readonly (readonly [number, number, number])[],
  direction: readonly [number, number, number],
): PatioPlan | null {
  if (terrace.length < 3 || !direction.every(Number.isFinite)) return null;
  const points = [...terrace, ...occupied.map(([x, , z]) => [x, z] as const)];
  if (points.some((p) => !p.every(Number.isFinite))) return null;
  const sx = Math.sign(direction[0]) || 1,
    sz = Math.sign(direction[2]) || 1;
  const us = points.map(([x]) => x * sx),
    vs = points.map(([, z]) => z * sz);
  const minU = Math.min(...us),
    maxU = Math.max(...us),
    minV = Math.min(...vs),
    maxV = Math.max(...vs);
  if (maxU - minU > 150 || maxV - minV > 150) return null;
  const parts: PatioPart[] = [];
  const box = (
    finish: PatioFinish,
    u: number,
    y: number,
    v: number,
    width: number,
    height: number,
    depth: number,
  ) => {
    if (width <= 0 || height <= 0 || depth <= 0) return;
    parts.push({ finish, position: [u * sx, y, v * sz], size: [width, height, depth] });
  };
  const left = minU - 2,
    right = maxU + 1.5,
    back = minV - 2;
  const width = right - left,
    centre = (left + right) / 2;
  const screenWidth = Math.min(4.2, width * 0.35),
    screenCentre = left + screenWidth / 2 + 0.6;
  const screenStart = screenCentre - screenWidth / 2,
    screenEnd = screenCentre + screenWidth / 2;
  const wallHeight = 2.25;
  box(
    "plaster",
    (left + screenStart) / 2,
    wallHeight / 2,
    back,
    screenStart - left,
    wallHeight,
    0.24,
  );
  box(
    "plaster",
    (screenEnd + right) / 2,
    wallHeight / 2,
    back,
    right - screenEnd,
    wallHeight,
    0.24,
  );
  box("reveal", screenCentre, wallHeight / 2, back - 0.06, screenWidth, wallHeight, 0.06);
  const count = Math.ceil(screenWidth / 0.14),
    pitch = screenWidth / count;
  for (let i = 0; i < count; i++)
    box("wood", screenStart + (i + 0.5) * pitch, 1.11, back + 0.025, pitch * 0.58, 2.18, 0.12);
  box("cap", centre, wallHeight + 0.035, back, width + 0.06, 0.07, 0.3);
  box("reveal", centre, 0.035, back + 0.128, width, 0.07, 0.016);
  // A low return keeps oblique views open instead of enclosing the pool in a box.
  const returnLength = Math.min(7, (maxV - minV) * 0.55 + 2);
  const returnCentre = back + returnLength / 2;
  box("plaster", left, 0.62, returnCentre, 0.24, 1.24, returnLength);
  box("cap", left, 1.275, returnCentre, 0.3, 0.07, returnLength + 0.06);
  box("reveal", left + 0.128, 0.035, returnCentre, 0.016, 0.07, returnLength);
  // A small freestanding seat completes the patio, outside the circulation strip.
  const seatLength = Math.min(3, returnLength - 1.5);
  const seatV = returnCentre + 0.25;
  for (let i = 0; i < 4; i++)
    box("wood", left + 0.23 + i * 0.12, 0.46, seatV, 0.105, 0.07, seatLength);
  for (const end of [-1, 1])
    box("reveal", left + 0.41, 0.22, seatV + end * (seatLength / 2 - 0.22), 0.43, 0.44, 0.045);
  // Gravel margins stay beyond a clear strip around the configured deck.
  box("gravel", centre, 0.006, back + 0.72, width, 0.018, 1.12);
  box(
    "gravel",
    left + 0.72,
    0.006,
    returnCentre + 0.6,
    1.12,
    0.018,
    Math.max(0.1, returnLength - 1.2),
  );
  return {
    parts,
    protectedBounds: {
      minX: Math.min(...points.map((p) => p[0])),
      maxX: Math.max(...points.map((p) => p[0])),
      minZ: Math.min(...points.map((p) => p[1])),
      maxZ: Math.max(...points.map((p) => p[1])),
    },
  };
}
