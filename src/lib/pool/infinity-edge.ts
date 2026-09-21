/**
 * Canonical Infinity / vanishing-edge waterline domain model (Geometry Pass D
 * -- first slice, Rectangle only). Single source of truth for which side of a
 * pool's outline is a disappearing edge, what the lip/waterfall/catch-basin
 * dimensions are, and the 3D geometry data (points, tangent, length) a
 * consumer derives from a selection. No other module may re-derive Infinity
 * side selection or dimension clamping -- `walls.ts`/`lighting.ts`/the R3F
 * components and the "Acqua" wizard step all read this file.
 *
 * Coordinate layer only: this module works in the same real-world (metre),
 * CCW-wound XZ outline every other shape module (`l-shape.ts`,
 * `organic-shape.ts`, `geometry.ts`) already uses. Customer-friendly side
 * naming ("Lato Nord", "Lato Sud" or similar) is a UI-layer concern, not
 * this one's -- see the Acqua step component, which maps a
 * `RectangleInfinitySide` to a label and a mini-plan diagram.
 *
 * Real-world proportions referenced below come from inspecting the supplied
 * `INFINITY_POOL.glb` reference model (mesh bounding boxes only -- the file
 * itself is never imported into the app or read at runtime). The GLB's
 * accessor units resolve to inches; converted to millimetres for the
 * comments below. Two figures (waterfall drop height) could not be reliably
 * isolated from the flat node/accessor list the GLB exposes (no baked
 * per-node transform hierarchy was present to separate the cascade sheet
 * from its parent), so that one constant instead uses a documented
 * industry-typical residential range -- called out explicitly, not
 * presented as GLB-measured.
 */
import type { Outline } from "./types";
import { outlineBounds, outlinePerimeter, pointAtPerimeter } from "./geometry";

/** The 4 candidate sides of an axis-aligned rectangle outline, identified by
 * the index of the outline vertex the side starts at (CCW winding, same
 * convention as every other outline consumer). Domain layer stays
 * coordinate-based; the Acqua step maps these to "LATO INFINITY" labels. */
export type RectangleInfinitySide = 0 | 1 | 2 | 3;

export const RECTANGLE_INFINITY_SIDES: readonly RectangleInfinitySide[] = [0, 1, 2, 3];

export interface InfinityEdgeParams {
  enabled: boolean;
  /** Rectangle only, this pass. `null` once L-shape/Organic candidate zones
   * exist and the selection is expressed some other shape-specific way. */
  side: RectangleInfinitySide | null;
  /** Arc-length-normalised [0, 1) start/end along the *selected side only*
   * (not the whole perimeter) -- lets a future pass allow a partial-width
   * disappearing edge without changing this type. This pass always clamps
   * both to the full side (0 and 1). */
  startT: number;
  endT: number;
  /** Which way water falls off the lip: away from the outline's interior
   * (the only physically sane choice for a convex rectangle side, but kept
   * explicit/typed rather than assumed so L-shape's concave corner case has
   * somewhere to express "into the recess" is never valid, in the next pass). */
  dropDirection: "outward";
}

export function defaultInfinityEdgeParams(): InfinityEdgeParams {
  return { enabled: false, side: null, startT: 0, endT: 1, dropDirection: "outward" };
}

/**
 * Normalise arbitrary (possibly malformed, legacy, or hand-edited) input
 * into valid `InfinityEdgeParams`. Every other function in this module, and
 * every consumer (config, persistence, the R3F components, the Acqua step),
 * assumes its input already passed through here.
 */
export function clampInfinityEdgeParams(
  input: Partial<InfinityEdgeParams> | undefined,
): InfinityEdgeParams {
  const fallback = defaultInfinityEdgeParams();
  if (!input) return fallback;
  const side = RECTANGLE_INFINITY_SIDES.includes(input.side as RectangleInfinitySide)
    ? (input.side as RectangleInfinitySide)
    : null;
  const enabled = input.enabled === true && side !== null;
  const startTRaw = Number.isFinite(input.startT) ? (input.startT as number) : 0;
  const endTRaw = Number.isFinite(input.endT) ? (input.endT as number) : 1;
  // This pass only ever builds a full-side edge; clamp any partial value
  // back to [0, 1] full coverage rather than silently building a shorter
  // lip a later pass didn't actually implement yet.
  const startT = Math.min(0, Math.max(0, startTRaw)) === 0 ? 0 : 0;
  const endT = Math.max(1, Math.min(1, endTRaw)) === 1 ? 1 : 1;
  return { enabled, side, startT, endT, dropDirection: "outward" };
}

/**
 * Structural dimension constants, real-world (metres), with residential/
 * luxury-pool-plausible clamps. Each has a one-line comment citing the
 * GLB-derived reference value (or, where the GLB didn't expose it reliably,
 * the industry-typical range used instead -- see file header).
 */
export const INFINITY_EDGE_DIMENSIONS = {
  /** Disappearing-edge lip cap width (the coping-equivalent cap the water
   * sheets over). GLB reference: the catch-basin assembly's outer envelope
   * extends ~0.50m beyond the main basin's coping line on the drop side
   * (9002mm vs 8502mm outer length) -- the lip itself is the inner slice of
   * that overhang, budgeted at 0.15m here (rest is catch-basin clearance). */
  lipWidth: { min: 0.08, max: 0.3, default: 0.15 },
  /** Exterior vertical drop / waterfall cascade sheet height, lip to catch
   * basin water level. Not reliably isolable from the inspected GLB's flat
   * node list (no exposed transform hierarchy separated the cascade mesh
   * from its parent) -- uses the documented residential-infinity-pool
   * typical range (6-12in / ~150-300mm) instead of a GLB-measured figure. */
  dropHeight: { min: 0.1, max: 0.4, default: 0.2 },
  /** Catch basin / receiving channel width (horizontal, outward from the
   * lip). GLB reference: catch-basin assembly width exceeds the main basin
   * width by ~0.25m per side (4500mm vs 4250mm outer envelope). */
  catchBasinWidth: { min: 0.3, max: 1.2, default: 0.5 },
  /** Catch basin depth (below the lip's waterline). GLB reference: the
   * catch-basin structural node's Z span is ~0.60m (1879mm - 1279mm). */
  catchBasinDepth: { min: 0.25, max: 0.9, default: 0.6 },
  /** Structural wall thickness of the lip/catch-basin assembly. GLB
   * reference: ~0.25m offset between the main basin's outer wall face and
   * the catch-basin assembly's own outer face (250mm). */
  wallThickness: { min: 0.15, max: 0.4, default: 0.25 },
} as const;

function clampDim(
  value: number | undefined,
  spec: { min: number; max: number; default: number },
): number {
  if (!Number.isFinite(value)) return spec.default;
  return Math.min(spec.max, Math.max(spec.min, value as number));
}

export interface InfinityEdgeDimensions {
  lipWidth: number;
  dropHeight: number;
  catchBasinWidth: number;
  catchBasinDepth: number;
  wallThickness: number;
}

export function clampInfinityEdgeDimensions(
  input: Partial<InfinityEdgeDimensions> | undefined,
): InfinityEdgeDimensions {
  return {
    lipWidth: clampDim(input?.lipWidth, INFINITY_EDGE_DIMENSIONS.lipWidth),
    dropHeight: clampDim(input?.dropHeight, INFINITY_EDGE_DIMENSIONS.dropHeight),
    catchBasinWidth: clampDim(input?.catchBasinWidth, INFINITY_EDGE_DIMENSIONS.catchBasinWidth),
    catchBasinDepth: clampDim(input?.catchBasinDepth, INFINITY_EDGE_DIMENSIONS.catchBasinDepth),
    wallThickness: clampDim(input?.wallThickness, INFINITY_EDGE_DIMENSIONS.wallThickness),
  };
}

export interface RectangleInfinityZone {
  side: RectangleInfinitySide;
  /** Outline vertex the side starts at. */
  start: readonly [number, number];
  /** Outline vertex the side ends at. */
  end: readonly [number, number];
  length: number;
  /** Unit outward normal (away from the rectangle's interior). */
  normal: readonly [number, number];
}

/**
 * Every valid Infinity candidate zone for a Rectangle outline -- one per
 * side, always 4 for a well-formed axis-aligned rectangle outline (4
 * vertices). Returns an empty array for anything that isn't recognisably a
 * 4-vertex rectangle (defensive: this module never fabricates a zone for an
 * outline it can't actually validate).
 */
export function rectangleInfinityZones(outline: Outline): readonly RectangleInfinityZone[] {
  if (outline.length !== 4) return [];
  const bounds = outlineBounds(outline);
  if (!Number.isFinite(bounds.spanX) || !Number.isFinite(bounds.spanZ)) return [];
  if (bounds.spanX <= 0 || bounds.spanZ <= 0) return [];
  const centroidX = (bounds.minX + bounds.maxX) / 2;
  const centroidZ = (bounds.minZ + bounds.maxZ) / 2;
  const zones: RectangleInfinityZone[] = [];
  for (let i = 0; i < outline.length; i++) {
    const start = outline[i]!;
    const end = outline[(i + 1) % outline.length]!;
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (length <= 0) return [];
    const midX = (start[0] + end[0]) / 2;
    const midZ = (start[1] + end[1]) / 2;
    // Perpendicular to the side, pointing away from the rectangle centroid.
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const candidateA: readonly [number, number] = [-dz / length, dx / length];
    const towardCandidateA =
      candidateA[0] * (midX - centroidX) + candidateA[1] * (midZ - centroidZ);
    const normal = towardCandidateA >= 0 ? candidateA : ([-candidateA[0], -candidateA[1]] as const);
    zones.push({ side: i as RectangleInfinitySide, start, end, length, normal });
  }
  return zones;
}

/** L-shape candidate zones: not built yet (next pass -- concave corners
 * need real validity rules, not a guess). Correctly typed, honestly empty. */
export function lShapeInfinityZones(_outline: Outline): readonly RectangleInfinityZone[] {
  return [];
}

/** Organic candidate zones: not built yet (next pass -- a curved boundary
 * has no straight "side" to select at all without a new representation).
 * Correctly typed, honestly empty. */
export function organicInfinityZones(_outline: Outline): readonly RectangleInfinityZone[] {
  return [];
}

export interface InfinityEdgeGeometryData {
  side: RectangleInfinitySide;
  /** Lip centreline start/end points, in the outline's real-world XZ. */
  start: readonly [number, number];
  end: readonly [number, number];
  /** Unit tangent along the lip, start -> end. */
  tangent: readonly [number, number];
  /** Unit outward normal (drop direction). */
  normal: readonly [number, number];
  length: number;
}

/**
 * Lip/edge geometry data for a selected Rectangle side, given the pool's
 * outline and validated `InfinityEdgeParams`. Returns `null` when the
 * params don't currently select a valid Rectangle side (disabled, no side,
 * or the outline isn't a 4-vertex rectangle) -- callers must handle that
 * rather than assuming a selection is always renderable.
 */
export function computeInfinityEdgeGeometry(
  outline: Outline,
  params: InfinityEdgeParams,
): InfinityEdgeGeometryData | null {
  if (!params.enabled || params.side === null) return null;
  const zones = rectangleInfinityZones(outline);
  const zone = zones.find((z) => z.side === params.side);
  if (!zone) return null;
  const length = zone.length;
  if (!(length > 0)) return null;
  const tangent: readonly [number, number] = [
    (zone.end[0] - zone.start[0]) / length,
    (zone.end[1] - zone.start[1]) / length,
  ];
  return {
    side: zone.side,
    start: zone.start,
    end: zone.end,
    tangent,
    normal: zone.normal,
    length,
  };
}

/** True only while every wall/skimmer/access/LED placement using the same
 * "excluded side" convention as `skimmerWall`/`lighting.ts` should treat
 * `side` as off-limits. Mirrors the shape of those existing exclusion
 * checks rather than inventing a second convention. */
export function isRectangleSideExcludedByInfinity(
  params: InfinityEdgeParams,
  side: RectangleInfinitySide,
): boolean {
  return params.enabled && params.side === side;
}

/** Sanity/debug helper: the perimeter fraction (`pointAtPerimeter`-style
 * arc-length t, [0,1)) at which the selected side begins, for a Rectangle
 * outline. Used by tests to prove side selection round-trips through the
 * same arc-length convention every other outline consumer uses. */
export function infinitySideStartT(outline: Outline, side: RectangleInfinitySide): number {
  const perimeter = outlinePerimeter(outline);
  if (!(perimeter > 0)) return 0;
  let accumulated = 0;
  for (let i = 0; i < side; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    accumulated += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return accumulated / perimeter;
}

/** Re-exported for consumers that want the raw perimeter point rather than
 * the zone data (e.g. positioning a UI marker) -- avoids re-importing
 * `geometry.ts` directly just to stay consistent with this module's t
 * convention. */
export { pointAtPerimeter };
