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
import type { Outline, PoolShapeId } from "./types";
import { outlineBounds, outlinePerimeter, pointAtPerimeter } from "./geometry";
import { classifyOutlineCorners } from "./l-shape";
import { ORGANIC_SHAPE_GUARDRAILS } from "./organic-shape";

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
  // negative index, a fraction, or one past the largest outline this module
  // ever samples) -- the same "syntactically plausible, semantically
  // re-checked downstream" contract Rectangle already had, widened first for
  // L-shape's extra two indices and now again for Organic, whose `side` is
  // an outline VERTEX index (0..`ORGANIC_SHAPE_GUARDRAILS.maxPoints` - 1,
  // organic-shape.ts), not a small fixed edge count. Whether a given index is
  // an actual candidate zone for the CURRENT outline is always re-checked
  // where the outline is available (`infinityZonesForOutline`/
  // `computeInfinityEdgeGeometry`), exactly as before.
  const sideRaw = input.side;
  const side =
    typeof sideRaw === "number" &&
    Number.isInteger(sideRaw) &&
    sideRaw >= 0 &&
    sideRaw <= ORGANIC_SHAPE_GUARDRAILS.maxPoints - 1
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
  /** Index of the outline vertex this zone starts at. Rectangle: 0-3.
   * L-shape: 0-5 (see `LShapeInfinitySide`). Organic: 0..outline.length-1 --
   * the field stayed typed as a plain `number` rather than a shape-specific
   * union so this one zone shape keeps serving every outline consumer (3D
   * geometry, camera, mini-plan selector) without a parallel type per
   * shape. */
  side: number;
  /** Outline vertex the zone starts at (== `points[0]`). */
  start: readonly [number, number];
  /** Outline vertex the zone ends at (== `points[points.length - 1]`). */
  end: readonly [number, number];
  /** Real arc length along the outline from `start` to `end` (sum of the
   * segment lengths between consecutive `points`) -- for Rectangle/L-shape
   * a single straight edge, this equals the straight-line `start`-`end`
   * distance; for Organic's multi-point curved arc it is always >= that
   * straight-line distance, and is the figure every physical-size check
   * (`MIN_INFINITY_ZONE_LENGTH`, geometry segment counts, camera framing)
   * means by "how much of the perimeter this zone spans". */
  length: number;
  /** Arc-length-weighted average unit outward normal over the whole zone
   * (away from the outline's interior) -- for a single straight edge this is
   * just that edge's own normal; for a curved arc it is a real local average,
   * not a single endpoint's tangent. Used wherever only one normal is
   * needed (camera framing, the skimmer/LED exclusion axis) -- geometry that
   * must follow the curve itself uses `points`/`pointNormals` instead. */
  normal: readonly [number, number];
  /** Every outline vertex this zone spans, in outline order, `start` first
   * and `end` last inclusive -- always at least 2 points. For Rectangle/
   * L-shape (a single straight edge) this is always exactly `[start, end]`.
   * For Organic it is the real sampled polyline of the selected arc, so the
   * lip/cascade/catch-basin geometry can follow the true curve instead of a
   * straight chord across it. */
  points: readonly (readonly [number, number])[];
  /** One local outward unit normal per `points` entry, same length/order as
   * `points` -- computed by averaging each vertex's two adjacent edge
   * normals (the standard vertex-normal-from-edge-normals technique), so an
   * outward offset built by walking `points`/`pointNormals` together stays
   * perpendicular to the TRUE local curve at every step instead of drifting
   * off a single global normal (which would self-intersect on the inside of
   * a curve and gap open on the outside). For Rectangle/L-shape this is
   * always `[normal, normal]` -- identical to the previous single-normal
   * behaviour, since a straight edge's local normal never varies. */
  pointNormals: readonly (readonly [number, number])[];
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
    zones.push({
      side: i,
      start,
      end,
      length,
      normal,
      points: [start, end],
      pointNormals: [normal, normal],
    });
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
    zones.push({
      side: i,
      start,
      end,
      length,
      normal,
      points: [start, end],
      pointNormals: [normal, normal],
    });
  }
  return zones;
}

/**
 * Every valid candidate zone for WHATEVER outline is passed. Prefers an
 * explicit `shape` when the caller has one in hand (every real call site in
 * this codebase does -- `PoolScene.tsx`'s own `shape: PoolShapeId` prop, the
 * Acqua step's `config.shape`) -- a genuinely shape-aware dispatch rather
 * than inferring the shape from vertex count alone, which would be a latent
 * bug the moment two shapes could ever share a vertex count (Organic's
 * 28-160-point sampled curve never collides with Rectangle's 4 or L-shape's
 * 6 today, but a future "Custom" free-draw outline could easily land on 4 or
 * 6 points and be silently misread as Rectangle/L-shape). Omitting `shape`
 * (legacy/defensive callers) falls back to the original vertex-count
 * heuristic, which stays exactly as correct as it always was for the two
 * shapes it recognises and stays honestly empty for anything else,
 * including Organic and Custom -- never a behaviour change for an existing
 * caller that hasn't been updated to pass `shape` yet.
 */
export function infinityZonesForOutline(
  outline: Outline,
  shape?: PoolShapeId,
): readonly RectangleInfinityZone[] {
  if (shape === "rectangle") return rectangleInfinityZones(outline);
  if (shape === "l-shape") return lShapeInfinityZones(outline);
  if (shape === "organic") return organicInfinityZones(outline);
  if (shape === "custom") return [];
  if (outline.length === 4) return rectangleInfinityZones(outline);
  if (outline.length === 6) return lShapeInfinityZones(outline);
  return [];
}

/** Local, dependency-free circumradius-based curvature radius at one outline
 * vertex -- large/Infinity on a flat run, small at a tight bend. Deliberately
 * a local copy of the identical technique `walls.ts`'s own
 * `localCurvatureRadius` uses (not exported there), mirroring why
 * `lighting.ts` keeps its own local copy of `l-shape.ts`'s corner test: each
 * of these small geometry modules stays safe to reach independently rather
 * than threading a shared internal helper through every consumer. */
function localCurvatureRadius(outline: Outline, index: number): number {
  const n = outline.length;
  const previous = outline[(index - 1 + n) % n]!;
  const current = outline[index]!;
  const next = outline[(index + 1) % n]!;
  const first = Math.hypot(current[0] - previous[0], current[1] - previous[1]);
  const second = Math.hypot(next[0] - current[0], next[1] - current[1]);
  const opposite = Math.hypot(next[0] - previous[0], next[1] - previous[1]);
  const twiceArea = Math.abs(
    (current[0] - previous[0]) * (next[1] - previous[1]) -
      (current[1] - previous[1]) * (next[0] - previous[0]),
  );
  if (twiceArea <= 1e-9) return Infinity;
  return (first * second * opposite) / (2 * twiceArea);
}

/** Outward unit normal at one outline vertex: the average of its two
 * adjacent edges' own perpendiculars, oriented away from the outline's
 * centroid -- the standard "vertex normal from edge normals" technique, used
 * so a curved zone's per-point offset (lip/cascade/catch-basin) stays
 * perpendicular to the TRUE local curve instead of a single global
 * direction. */
function vertexNormal(
  outline: Outline,
  index: number,
  centroidX: number,
  centroidZ: number,
): readonly [number, number] {
  const n = outline.length;
  const previous = outline[(index - 1 + n) % n]!;
  const current = outline[index]!;
  const next = outline[(index + 1) % n]!;
  const edgeNormal = (a: readonly [number, number], b: readonly [number, number]) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (!(len > 1e-9)) return [0, 0] as const;
    return [-dz / len, dx / len] as const;
  };
  const nIn = edgeNormal(previous, current);
  const nOut = edgeNormal(current, next);
  let sumX = nIn[0] + nOut[0];
  let sumZ = nIn[1] + nOut[1];
  let sumLen = Math.hypot(sumX, sumZ);
  if (!(sumLen > 1e-9)) {
    sumX = nOut[0];
    sumZ = nOut[1];
    sumLen = Math.hypot(sumX, sumZ) || 1;
  }
  const candidate: readonly [number, number] = [sumX / sumLen, sumZ / sumLen];
  const toward = candidate[0] * (current[0] - centroidX) + candidate[1] * (current[1] - centroidZ);
  return toward >= 0 ? candidate : ([-candidate[0], -candidate[1]] as const);
}

/** How much tighter than the outline's own FLATTEST local curvature radius
 * (the largest `localCurvatureRadius` found anywhere on the outline -- the
 * near-straight run opposite both the bay and the bulge) a vertex must be
 * before it's treated as part of the "bay"/"bulge" and excluded from every
 * candidate zone -- see `organicInfinityZones`. Deliberately measured
 * against the outline's own MAXIMUM radius, not its median: at high
 * curvature and/or a small overall pool, a genuinely large fraction of the
 * boundary is measurably tighter than the flattest run (the dip and bulge
 * both are, by `organic-shape.ts`'s own `radiusAt` construction, and a small
 * pool has less arc length to "dilute" that fraction with) -- a median-based
 * threshold would then itself sit inside the tight region and fail to
 * exclude it at all. The flattest point on the boundary is always a real,
 * physically-flat reference regardless of how much of the rest of the curve
 * is tight, so a fixed fraction of IT stays meaningful across the whole
 * guardrail range. Verified empirically against every UI-selectable
 * curvature/mirror/length/width combination this module's own audit
 * exercises (`scripts/geometry-audit.ts`) to shrink from the usual 4
 * candidates down to as few as 1 for a small, highly-curved pool, while
 * never reaching 0 for any real (guardrail-clamped) organic outline. */
const ORGANIC_TIGHT_CURVATURE_FACTOR = 0.35;

/** Every valid Infinity candidate zone for an Organic (kidney/freeform)
 * outline. An Organic outline (`buildOrganicShapeOutline`, organic-shape.ts)
 * has no fixed vertex count or straight walls, so "a side" here means a
 * continuous ARC of the sampled perimeter -- identified by arc-length
 * position along the outline, the same convention every other outline
 * consumer (`pointAtPerimeter`, `infinitySideStartT`) already uses, never a
 * fake straight wall drawn across the curve.
 *
 * Candidate selection, purely from the outline's own geometry (no access to
 * the generator's `curvature`/`mirror` params, which this function
 * deliberately never takes -- it must work for any Organic outline,
 * including a hand-edited or future-generator one):
 *  1. Split the outline into the 4 compass quadrants around its own
 *     centroid (same East/West/North/South convention the mini-plan's own
 *     `sideLabel` already uses) -- a small, customer-meaningful number of
 *     named regions rather than raw arbitrary arc-length ranges.
 *  2. Within each quadrant, compute every vertex's local radius of
 *     curvature (`localCurvatureRadius`) and exclude any vertex tighter than
 *     `ORGANIC_TIGHT_CURVATURE_FACTOR` of the outline's own FLATTEST radius --
 *     this is what keeps the kidney's own waist/bay (and, symmetrically, the
 *     narrower compensating bulge on the opposite flank) out of every
 *     candidate: both are, by construction (`organic-shape.ts`'s `radiusAt`),
 *     measurably tighter than the base near-ellipse curvature everywhere
 *     else on the boundary.
 *  3. Take the quadrant's longest surviving contiguous run of vertices. A
 *     run that clears `MIN_INFINITY_ZONE_LENGTH` (the same L-shape uses --
 *     the widest lip + catch basin this module's own dimension clamps ever
 *     allow) becomes a real candidate zone; a quadrant whose only material
 *     is the bay/bulge itself (or too short once trimmed) contributes none.
 *
 * For the shape's usual default curvature this yields exactly the 2
 * genuinely flat long flanks (the ones 90 degrees away from both the bay and
 * the bulge); a near-ellipse (low curvature) outline can clear the length
 * test on all 4 quadrants; a very pronounced bay can leave only 1. Never
 * more than 4 (one per quadrant) -- honestly empty when the outline is too
 * small/malformed to validate at all.
 */
export function organicInfinityZones(outline: Outline): readonly RectangleInfinityZone[] {
  const n = outline.length;
  if (n < 12) return [];
  const bounds = outlineBounds(outline);
  if (!Number.isFinite(bounds.spanX) || !Number.isFinite(bounds.spanZ)) return [];
  if (bounds.spanX <= 0 || bounds.spanZ <= 0) return [];
  const centroidX = (bounds.minX + bounds.maxX) / 2;
  const centroidZ = (bounds.minZ + bounds.maxZ) / 2;

  const radii = outline.map((_, i) => localCurvatureRadius(outline, i));
  const finiteRadii = radii.filter((r) => Number.isFinite(r));
  const flattestRadius = finiteRadii.length ? Math.max(...finiteRadii) : Infinity;
  const tightThreshold = Number.isFinite(flattestRadius)
    ? flattestRadius * ORGANIC_TIGHT_CURVATURE_FACTOR
    : 0;
  const isTight = (i: number) => Number.isFinite(radii[i]) && radii[i]! < tightThreshold;

  // Same quadrant convention as the mini-plan's `sideLabel`: whichever axis
  // a point's offset from the centroid is larger along wins.
  const sectorOf = (point: readonly [number, number]): 0 | 1 | 2 | 3 => {
    const dx = point[0] - centroidX;
    const dz = point[1] - centroidZ;
    if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 0 : 1; // East / West
    return dz >= 0 ? 2 : 3; // South / North
  };

  const zones: RectangleInfinityZone[] = [];
  for (let sector = 0; sector < 4; sector++) {
    const eligible = outline.map((point, i) => sectorOf(point) === sector && !isTight(i));
    // Longest maximal contiguous run of `eligible` indices, circular.
    let bestStart = -1;
    let bestLength = 0;
    for (let start = 0; start < n; start++) {
      if (!eligible[start] || (start > 0 && eligible[start - 1])) continue; // run start only
      let runLength = 0;
      while (runLength < n && eligible[(start + runLength) % n]) runLength++;
      if (runLength > bestLength) {
        bestLength = runLength;
        bestStart = start;
      }
    }
    if (bestStart < 0 || bestLength < 4) continue;
    const points: Array<readonly [number, number]> = [];
    const pointNormals: Array<readonly [number, number]> = [];
    for (let k = 0; k < bestLength; k++) {
      const index = (bestStart + k) % n;
      points.push(outline[index]!);
      pointNormals.push(vertexNormal(outline, index, centroidX, centroidZ));
    }
    let arcLength = 0;
    for (let k = 1; k < points.length; k++) {
      arcLength += Math.hypot(points[k]![0] - points[k - 1]![0], points[k]![1] - points[k - 1]![1]);
    }
    if (!(arcLength >= MIN_INFINITY_ZONE_LENGTH)) continue;
    // Arc-length-weighted average normal (trapezoidal weights) -- a real
    // local average over the arc, not a single endpoint's tangent.
    let normalX = 0;
    let normalZ = 0;
    for (let k = 0; k < points.length; k++) {
      const before =
        k > 0
          ? Math.hypot(points[k]![0] - points[k - 1]![0], points[k]![1] - points[k - 1]![1])
          : 0;
      const after =
        k < points.length - 1
          ? Math.hypot(points[k + 1]![0] - points[k]![0], points[k + 1]![1] - points[k]![1])
          : 0;
      const weight = (before + after) / 2 || 1;
      normalX += pointNormals[k]![0] * weight;
      normalZ += pointNormals[k]![1] * weight;
    }
    const normalLen = Math.hypot(normalX, normalZ) || 1;
    const normal: readonly [number, number] = [normalX / normalLen, normalZ / normalLen];
    zones.push({
      side: bestStart,
      start: points[0]!,
      end: points[points.length - 1]!,
      length: arcLength,
      normal,
      points,
      pointNormals,
    });
  }
  return zones;
}

export interface InfinityEdgeGeometryData {
  side: number;
  /** Lip centreline start/end points, in the outline's real-world XZ. */
  start: readonly [number, number];
  end: readonly [number, number];
  /** Unit tangent along the straight `start` -> `end` chord. For a curved
   * (Organic) zone this is the chord's own direction, not a per-point
   * tangent along the true arc -- callers that must follow the curve use
   * `points`/`pointNormals` instead, the same as every other consumer of a
   * zone. */
  tangent: readonly [number, number];
  /** Unit outward normal (drop direction) -- the zone's own arc-length
   * average, see `RectangleInfinityZone.normal`. */
  normal: readonly [number, number];
  /** Real arc length spanned (see `RectangleInfinityZone.length`) -- NOT
   * necessarily the straight-line `start`-`end` distance for a curved zone. */
  length: number;
  /** The zone's full point/normal polyline, passed through unchanged -- see
   * `RectangleInfinityZone.points`/`pointNormals`. */
  points: readonly (readonly [number, number])[];
  pointNormals: readonly (readonly [number, number])[];
}

/**
 * Lip/edge geometry data for a selected side (Rectangle, L-shape or
 * Organic), given the pool's outline and validated `InfinityEdgeParams`.
 * Returns `null` when the params don't currently select a valid candidate
 * zone for the CURRENT outline (disabled, no side, an index that isn't a
 * real zone for this shape, or an outline with no candidate zones at all) --
 * callers must handle that rather than assuming a selection is always
 * renderable. `shape` is optional and forwarded to `infinityZonesForOutline`
 * -- see that function's own doc for why passing it is preferred.
 */
export function computeInfinityEdgeGeometry(
  outline: Outline,
  params: InfinityEdgeParams,
  shape?: PoolShapeId,
): InfinityEdgeGeometryData | null {
  if (!params.enabled || params.side === null) return null;
  const zones = infinityZonesForOutline(outline, shape);
  const zone = zones.find((z) => z.side === params.side);
  if (!zone) return null;
  if (!(zone.length > 0)) return null;
  // Tangent is normalised by the straight CHORD length between start and
  // end, never by `zone.length` (the real arc length, which for a curved
  // zone is strictly longer than the chord and would otherwise produce a
  // non-unit "tangent") -- a latent bug this pass fixed; byte-identical for
  // Rectangle/L-shape, where chord length and arc length are the same
  // number by construction (a single straight edge).
  const chordLength = Math.hypot(zone.end[0] - zone.start[0], zone.end[1] - zone.start[1]);
  if (!(chordLength > 0)) return null;
  const tangent: readonly [number, number] = [
    (zone.end[0] - zone.start[0]) / chordLength,
    (zone.end[1] - zone.start[1]) / chordLength,
  ];
  return {
    side: zone.side,
    start: zone.start,
    end: zone.end,
    tangent,
    normal: zone.normal,
    length: zone.length,
    points: zone.points,
    pointNormals: zone.pointNormals,
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
 * isn't currently a valid zone for that side) -- callers treat `null` as a
 * complete no-op, identical to before Infinity existed.
 *
 * Rectangle/L-shape zones are always axis-aligned (their two endpoints share
 * exactly one coordinate), an exact exclusion. Organic's curved zone has no
 * single shared coordinate between its endpoints, so this falls back to a
 * best-effort exclusion: the axis the zone's own average `normal` points
 * along most strongly, and the outline's own extreme (min/max) coordinate on
 * that axis WITHIN the zone -- `skimmerWall`/`worstCurvatureNear` (walls.ts)
 * already steer the skimmer/LED wall toward whichever bounding-box extreme
 * is flattest, which is structurally the same extreme an Organic Infinity
 * zone was chosen from (see `organicInfinityZones`), so this reuses that
 * same "extreme coordinate" language rather than inventing a curve-exact
 * exclusion. Documented limitation: because the true zone is curved, not a
 * single coordinate line, a skimmer/LED placement very close to (but not
 * exactly on) that extreme could in principle still land near the zone's
 * shoulder -- deferred, see this pass's report. */
export function infinityExclusion(
  outline: Outline,
  params: InfinityEdgeParams,
  shape?: PoolShapeId,
): { axis: "x" | "z"; coordinate: number } | null {
  const geometry = computeInfinityEdgeGeometry(outline, params, shape);
  if (!geometry) return null;
  const [x1, z1] = geometry.start;
  const [x2, z2] = geometry.end;
  if (Math.abs(x1 - x2) < 1e-6) return { axis: "x", coordinate: x1 };
  if (Math.abs(z1 - z2) < 1e-6) return { axis: "z", coordinate: z1 };
  // Curved (Organic) zone: pick the dominant axis from the average normal,
  // and the extreme coordinate the zone's own points reach along it.
  const axis: "x" | "z" = Math.abs(geometry.normal[0]) >= Math.abs(geometry.normal[1]) ? "x" : "z";
  const axisIndex = axis === "x" ? 0 : 1;
  const sign = geometry.normal[axisIndex] >= 0 ? 1 : -1;
  let coordinate = geometry.points[0]![axisIndex];
  for (const point of geometry.points) {
    if (sign > 0 ? point[axisIndex] > coordinate : point[axisIndex] < coordinate) {
      coordinate = point[axisIndex];
    }
  }
  return { axis, coordinate };
}

/** Re-exported for consumers that want the raw perimeter point rather than
 * the zone data (e.g. positioning a UI marker) -- avoids re-importing
 * `geometry.ts` directly just to stay consistent with this module's t
 * convention. */
export { pointAtPerimeter };
