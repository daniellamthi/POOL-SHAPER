/**
 * Canonical Infinity / vanishing-edge waterline domain model (Geometry Pass D
 * -- Rectangle and L-shape; Organic stays a stub, see `organicInfinityZones`).
 * Single source of truth for which side of a pool's outline is a
 * disappearing edge, what the lip/waterfall/catch-basin
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
import { classifyOutlineCorners } from "./l-shape";

/** The 4 candidate sides of an axis-aligned rectangle outline, identified by
 * the index of the outline vertex the side starts at (CCW winding, same
 * convention as every other outline consumer). Domain layer stays
 * coordinate-based; the Acqua step maps these to "LATO INFINITY" labels. */
export type RectangleInfinitySide = 0 | 1 | 2 | 3;

export const RECTANGLE_INFINITY_SIDES: readonly RectangleInfinitySide[] = [0, 1, 2, 3];

/** L-shape's 6-vertex outline has 6 edges (see `buildLShapeOutline`,
 * l-shape.ts); a side is identified the same way a Rectangle side is -- the
 * index of the outline vertex it starts at. Not every index is ever a valid
 * Infinity zone (see `lShapeInfinityZones`), so this is the full domain of
 * indices, not the domain of valid selections. */
export type LShapeInfinitySide = 0 | 1 | 2 | 3 | 4 | 5;

export const L_SHAPE_INFINITY_SIDES: readonly LShapeInfinitySide[] = [0, 1, 2, 3, 4, 5];

export interface InfinityEdgeParams {
  enabled: boolean;
  /** Index of the outline vertex the selected side starts at -- Rectangle
   * (0-3) or L-shape (0-5), whichever the current shape's outline actually
   * has. `null` when nothing is selected, or for Organic, which has no
   * straight "side" to select at all. Real validity (does this index name an
   * actual candidate zone for the CURRENT outline) is always re-checked at
   * the point of use via `infinityZonesForOutline`/`computeInfinityEdgeGeometry`
   * -- this field alone never guarantees a valid selection, the same
   * contract it already had when only Rectangle existed. */
  side: number | null;
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
  // This clamp has no outline in hand, so it can only reject values that
  // could never be a real side for ANY shape this module knows about (a
  // negative index, a fraction, 6+) -- the same "syntactically plausible,
  // semantically re-checked downstream" contract Rectangle already had, now
  // widened to cover L-shape's extra two indices too. Whether a given index
  // is an actual candidate zone for the CURRENT outline is always re-checked
  // where the outline is available (`infinityZonesForOutline`/
  // `computeInfinityEdgeGeometry`), exactly as before.
  const sideRaw = input.side;
  const side =
    typeof sideRaw === "number" && Number.isInteger(sideRaw) && sideRaw >= 0 && sideRaw <= 5
      ? sideRaw
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
  /** Index of the outline vertex this zone's edge starts at. Rectangle:
   * 0-3. L-shape: 0-5 (see `LShapeInfinitySide`) -- the field stayed typed
   * as a plain `number` rather than a shape-specific union so this one zone
   * shape keeps serving every outline consumer (3D geometry, camera,
   * mini-plan selector) without a parallel type per shape. */
  side: number;
  /** Outline vertex the side starts at. */
  start: readonly [number, number];
  /** Outline vertex the side ends at. */
  end: readonly [number, number];
  length: number;
  /** Unit outward normal (away from the outline's interior). */
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
    zones.push({ side: i, start, end, length, normal });
  }
  return zones;
}

/** Minimum real-world length a candidate Infinity zone must have -- below
 * this a run can't physically fit a lip + catch basin outward, with any
 * usable margin. Reuses `INFINITY_EDGE_DIMENSIONS` (this module's own
 * clamped, GLB-referenced structural constants) rather than a fresh guess:
 * the widest lip + catch basin combination the dimension clamps ever allow,
 * so a zone this module hands out is never one its own geometry builders
 * couldn't actually place without the basin's end walls colliding or the
 * assembly reading as a sliver. Rectangle sides never hit this floor (they
 * always span the pool's own length/width guardrail minimums, several
 * metres); it matters for L-shape, where a leg shortened by a large recess
 * could otherwise come close. */
const MIN_INFINITY_ZONE_LENGTH =
  INFINITY_EDGE_DIMENSIONS.lipWidth.max + INFINITY_EDGE_DIMENSIONS.catchBasinWidth.max;

/**
 * Every valid Infinity candidate zone for an L-shape outline (Geometry Pass
 * D, L-shape slice). An L outline (`buildLShapeOutline`, l-shape.ts) always
 * has exactly 6 vertices/edges and exactly one reflex (concave) vertex --
 * `classifyOutlineCorners` is the same reflex detector every other L-shape
 * consumer (`cornerStairPlan`, floor/wall/coping) already uses, never
 * re-derived here.
 *
 * Validity rules (mirrors the task's own numbering):
 *  (a)/(b) The two edges that touch the reflex vertex are always excluded --
 *      both are structurally the recess's own walls, so a catch basin built
 *      outward from either would extend directly into the recess notch
 *      (empty space outside the pool's own footprint), not real open ground.
 *      This also naturally excludes any edge short enough to fail the
 *      `MIN_INFINITY_ZONE_LENGTH` floor, since the recess edges (length ==
 *      `recessWidth`/`recessLength`) are exactly the ones this touches --
 *      still checked explicitly below as defence in depth, not assumed.
 *  (c) The remaining 4 edges are the outline's genuinely long, straight,
 *      convex-corner-bounded runs -- structurally identical to a Rectangle
 *      side (two of them shortened by the recess, but touching it at only
 *      ONE endpoint each, never crossing it), so a catch basin built on any
 *      of them stays entirely within that edge's own start/end span and
 *      outward along its normal, exactly like `rectangleInfinityZones` --
 *      never overlapping the recess, never floating outside the L's own
 *      footprint.
 *
 * Orientation-aware by construction: works from the outline and its own
 * reflex index, never a hardcoded `LShapeOrientation` case.
 */
export function lShapeInfinityZones(outline: Outline): readonly RectangleInfinityZone[] {
  if (outline.length !== 6) return [];
  const bounds = outlineBounds(outline);
  if (!Number.isFinite(bounds.spanX) || !Number.isFinite(bounds.spanZ)) return [];
  if (bounds.spanX <= 0 || bounds.spanZ <= 0) return [];
  const convex = classifyOutlineCorners(outline);
  const reflexIndex = convex.findIndex((isConvex) => !isConvex);
  if (reflexIndex < 0) return []; // Not a real L (defensive -- should never happen).
  const n = outline.length;
  // The two edges incident to the reflex vertex: the one ending there and
  // the one starting there.
  const excludedEdges = new Set<number>([(reflexIndex - 1 + n) % n, reflexIndex]);
  const centroidX = (bounds.minX + bounds.maxX) / 2;
  const centroidZ = (bounds.minZ + bounds.maxZ) / 2;
  const zones: RectangleInfinityZone[] = [];
  for (let i = 0; i < n; i++) {
    if (excludedEdges.has(i)) continue;
    const start = outline[i]!;
    const end = outline[(i + 1) % n]!;
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (!(length >= MIN_INFINITY_ZONE_LENGTH)) continue;
    const midX = (start[0] + end[0]) / 2;
    const midZ = (start[1] + end[1]) / 2;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const candidateA: readonly [number, number] = [-dz / length, dx / length];
    const towardCandidateA =
      candidateA[0] * (midX - centroidX) + candidateA[1] * (midZ - centroidZ);
    const normal = towardCandidateA >= 0 ? candidateA : ([-candidateA[0], -candidateA[1]] as const);
    zones.push({ side: i, start, end, length, normal });
  }
  return zones;
}

/**
 * Every valid candidate zone for WHATEVER outline is passed -- dispatches on
 * vertex count (4 -> Rectangle, 6 -> L-shape) rather than requiring the
 * caller to separately know and pass the shape id, the same "derive it from
 * the outline itself" convention `classifyOutlineCorners` already uses. Any
 * other outline (Organic's curved boundary, or anything malformed) has no
 * straight "side" to select and returns an honestly empty array. Every
 * consumer that used to call `rectangleInfinityZones` directly (the 3D
 * Infinity geometry, the camera pose, the mini-plan selector) now goes
 * through this instead, so none of them has to special-case L-shape
 * separately.
 */
export function infinityZonesForOutline(outline: Outline): readonly RectangleInfinityZone[] {
  if (outline.length === 4) return rectangleInfinityZones(outline);
  if (outline.length === 6) return lShapeInfinityZones(outline);
  return [];
}

/** Organic candidate zones: not built yet (next pass -- a curved boundary
 * has no straight "side" to select at all without a new representation).
 * Correctly typed, honestly empty. */
export function organicInfinityZones(_outline: Outline): readonly RectangleInfinityZone[] {
  return [];
}

export interface InfinityEdgeGeometryData {
  side: number;
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
 * Lip/edge geometry data for a selected side (Rectangle or L-shape), given
 * the pool's outline and validated `InfinityEdgeParams`. Returns `null`
 * when the params don't currently select a valid candidate zone for the
 * CURRENT outline (disabled, no side, an index that isn't a real zone for
 * this shape, or an outline with no candidate zones at all, e.g. Organic) --
 * callers must handle that rather than assuming a selection is always
 * renderable.
 */
export function computeInfinityEdgeGeometry(
  outline: Outline,
  params: InfinityEdgeParams,
): InfinityEdgeGeometryData | null {
  if (!params.enabled || params.side === null) return null;
  const zones = infinityZonesForOutline(outline);
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

/** The excluded axis/coordinate pair `skimmerWall`/`lighting.ts`/
 * `PoolAccessModel.tsx` need to keep every skimmer, ladder/steps and LED
 * placement off the selected Infinity side -- expressed as a plain
 * `{ axis, coordinate }` (see `InfinityExclusion` in walls.ts) rather than a
 * `RectangleInfinitySide`, so those consumers never have to re-derive which
 * of the rectangle's two axes a given side index falls on. Returns `null`
 * whenever there is nothing to exclude (disabled, no side, or the outline
 * isn't currently a valid Rectangle zone for that side) -- callers treat
 * `null` as a complete no-op, identical to before Infinity existed. */
export function infinityExclusion(
  outline: Outline,
  params: InfinityEdgeParams,
): { axis: "x" | "z"; coordinate: number } | null {
  const geometry = computeInfinityEdgeGeometry(outline, params);
  if (!geometry) return null;
  const [x1, z1] = geometry.start;
  const [x2, z2] = geometry.end;
  // A Rectangle side is always axis-aligned: it shares exactly one
  // coordinate between its two endpoints.
  if (Math.abs(x1 - x2) < 1e-6) return { axis: "x", coordinate: x1 };
  if (Math.abs(z1 - z2) < 1e-6) return { axis: "z", coordinate: z1 };
  return null;
}

/** Re-exported for consumers that want the raw perimeter point rather than
 * the zone data (e.g. positioning a UI marker) -- avoids re-importing
 * `geometry.ts` directly just to stay consistent with this module's t
 * convention. */
export { pointAtPerimeter };
