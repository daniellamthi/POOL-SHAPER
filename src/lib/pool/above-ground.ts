/**
 * Above-ground pool: the exterior architecture that the in-ground pool does
 * not have. Pure planning only (no Three.js), shared by the 3D scene, the
 * wizard, the summary and the audits.
 *
 * Construction model, outward from the water:
 *   basin wall (ABOVE_GROUND_STRUCTURE_THICKNESS) -> sub-frame -> cladding
 *   panels -> coping slab flush with the finished panel face.
 * The interior (liner or visible stainless) is never part of this cladding,
 * so panel joints never appear on wet surfaces.
 */
import type { Outline, PoolConfig } from "./types";
import { ABOVE_GROUND_STRUCTURE_THICKNESS } from "./vertical-layout";

/** Exterior panel finishes. Every entry maps onto a material that already
 * exists in the configurator -- nothing here is an invented commercial line. */
export const EXTERIOR_PANEL_FINISHES = [
  {
    id: "steel-satin",
    title: "Acciaio satinato",
    description: "Pannelli in acciaio inox spazzolato, grigio neutro satinato.",
  },
  {
    id: "composite-light",
    title: "Composito chiaro",
    description: "Pannelli compositi chiari a finitura opaca.",
  },
  {
    id: "gres",
    title: "Gres porcellanato",
    description: "Lastre in gres effetto cemento, greige caldo opaco.",
  },
] as const;

export type ExteriorPanelFinishId = (typeof EXTERIOR_PANEL_FINISHES)[number]["id"];
export const DEFAULT_EXTERIOR_PANEL_FINISH: ExteriorPanelFinishId = "steel-satin";

export function exteriorPanelFinish(value: unknown): ExteriorPanelFinishId {
  return EXTERIOR_PANEL_FINISHES.some((finish) => finish.id === value)
    ? (value as ExteriorPanelFinishId)
    : DEFAULT_EXTERIOR_PANEL_FINISH;
}

export function exteriorPanelFinishTitle(config: Pick<PoolConfig, "exteriorPanelFinish">) {
  const id = exteriorPanelFinish(config.exteriorPanelFinish);
  return EXTERIOR_PANEL_FINISHES.find((finish) => finish.id === id)!.title;
}

export const CLADDING = {
  /** Flush cap, as in the installation references: no projecting shelf. */
  copingOverhang: 0,
  /** Panel thickness (a real cladding board on its sub-frame). */
  thickness: 0.03,
  /** Target panel width; every side is divided into equal panels. */
  module: 1.0,
  /** Joint between two panels, metres. */
  joint: 0.004,
  /** Panels stop just above the ground (a recessed plinth shadow line). */
  plinth: 0.012,
} as const;

export type ExternalStairSide = "long" | "short";
export function externalStairSide(value: unknown): ExternalStairSide {
  return value === "long" ? "long" : "short";
}

/** Outer face of the panels, metres outward from the water's edge: just
 * inside the coping's outer edge, and always clear of the basin wall plus a
 * minimal sub-frame. */
export function claddingFaceOffset(copingOuterOffset: number) {
  return Math.max(
    ABOVE_GROUND_STRUCTURE_THICKNESS + 0.02 + CLADDING.thickness,
    copingOuterOffset - CLADDING.copingOverhang,
  );
}

export interface PanelSide {
  /** Start and end of the panel face along this side (x, z). */
  a: readonly [number, number];
  b: readonly [number, number];
  /** Unit outward normal of the face. */
  normal: readonly [number, number];
  length: number;
  /** Panel spans along the side, in metres from `a`. */
  panels: ReadonlyArray<{ from: number; to: number }>;
}

function inside(x: number, z: number, polygon: Outline) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i]!,
      [xj, zj] = polygon[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/** Unit normal of segment a->b pointing out of `polygon`. */
function outwardNormal(
  a: readonly [number, number],
  b: readonly [number, number],
  polygon: Outline,
): readonly [number, number] {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = [(b[1] - a[1]) / length, -(b[0] - a[0]) / length] as const;
  const mx = (a[0] + b[0]) / 2,
    mz = (a[1] + b[1]) / 2;
  return inside(mx + n[0] * 1e-3, mz + n[1] * 1e-3, polygon) ? ([-n[0], -n[1]] as const) : n;
}

function signedArea(outline: Outline) {
  let area = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!,
      b = outline[(i + 1) % outline.length]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

/**
 * Equal-width vertical panels on every side of the cladding face. At each
 * convex corner the longer side runs through to the corner and the shorter
 * one stops a board thickness short of it, so the long board's edge closes
 * the corner: no gap, no two boards fighting for the same face. A side is
 * never split into a sliver, because all panels of a side share one width.
 */
export function planCladding(
  face: Outline,
  module: number = CLADDING.module,
  thickness: number = CLADDING.thickness,
): PanelSide[] {
  const n = face.length;
  const ccw = signedArea(face) > 0;
  const lengthOf = (i: number) => {
    const a = face[i]!,
      b = face[(i + 1) % n]!;
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  };
  const convexAt = (i: number) => {
    // Corner at vertex i, between side i-1 and side i.
    const p = face[(i - 1 + n) % n]!,
      c = face[i]!,
      q = face[(i + 1) % n]!;
    const cross = (c[0] - p[0]) * (q[1] - c[1]) - (c[1] - p[1]) * (q[0] - c[0]);
    return ccw ? cross > 0 : cross < 0;
  };
  // At a convex corner, the shorter of the two sides yields (ties: odd side).
  const yields = (side: number, other: number) => {
    const ls = lengthOf(side),
      lo = lengthOf(other);
    return Math.abs(ls - lo) < 1e-6 ? side % 2 === 1 : ls < lo;
  };
  return face.map((a, i) => {
    const b = face[(i + 1) % n]!;
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const full = Math.hypot(dx, dz);
    const tx = dx / full,
      tz = dz / full;
    const trimStart = convexAt(i) && yields(i, (i - 1 + n) % n) ? thickness : 0;
    const trimEnd = convexAt((i + 1) % n) && yields(i, (i + 1) % n) ? thickness : 0;
    const start = [a[0] + tx * trimStart, a[1] + tz * trimStart] as const;
    const end = [b[0] - tx * trimEnd, b[1] - tz * trimEnd] as const;
    const length = full - trimStart - trimEnd;
    const count = Math.max(1, Math.round(length / module));
    const width = length / count;
    return {
      a: start,
      b: end,
      normal: outwardNormal(a, b, face),
      length,
      panels: Array.from({ length: count }, (_, k) => ({ from: k * width, to: (k + 1) * width })),
    };
  });
}

/** The pellicano (stainless water blade) stands on the coping at the middle
 * of a short side, preferring the side farthest from the given access
 * points (internal stair, external stair) so the water never falls on them. */
export function planPellicano(
  outline: Outline,
  avoid: ReadonlyArray<{ x: number; z: number }>,
): { x: number; z: number; inward: readonly [number, number] } | null {
  if (outline.length < 3) return null;
  const edges = outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    const mid = { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2 };
    const out = outwardNormal(a, b, outline);
    const inward = [-out[0], -out[1]] as const;
    const clearance = avoid.length
      ? Math.min(...avoid.map((p) => Math.hypot(p.x - mid.x, p.z - mid.z)))
      : 0;
    return { length, mid, inward, clearance };
  });
  const usable = edges.filter((edge) => edge.length >= 1.2);
  if (!usable.length) return null;
  const shortest = Math.min(...usable.map((edge) => edge.length));
  const candidates = usable.filter((edge) => edge.length <= shortest + 0.05);
  candidates.sort((p, q) => q.clearance - p.clearance);
  const pick = candidates[0]!;
  return { x: pick.mid.x, z: pick.mid.z, inward: pick.inward };
}

/** Selections that only exist above ground, removed when the pool goes in
 * the ground so nothing stale reaches the scene, summary or quote. */
export function withoutAboveGroundOnly(config: PoolConfig): PoolConfig {
  const equipment = config.equipment.filter((id) => id !== "pellicano");
  if (equipment.length === config.equipment.length && config.exteriorPanelFinish === undefined && config.externalStairSide === undefined && config.externalStairPlatformExtended === undefined && config.internalStairMirrored === undefined)
    return config;
  const { exteriorPanelFinish: _panels, externalStairSide: _stairSide, externalStairPlatformExtended: _platform, internalStairMirrored: _mirror, ...rest } = config;
  return { ...rest, equipment };
}
