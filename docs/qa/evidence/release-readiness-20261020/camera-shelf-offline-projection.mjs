import * as THREE from "three";
import { PerspectiveCamera, Vector3 } from "three";
import { writeFileSync } from "node:fs";
//#region \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
//#endregion
//#region src/lib/pool/config.ts
const DEFAULT_CUSTOMER = {
	name: "",
	surname: "",
	company: "",
	email: "",
	phone: "",
	city: "",
	country: "",
	notes: ""
};
[
	{
		id: "standard",
		title: "Standard raffinato",
		description: "Cornice stampata con profilo rialzato ben visibile e proporzioni classiche."
	},
	{
		id: "slim",
		title: "Slim Moderno",
		description: "Cornice sottile a basso profilo, bordo minimo, apertura più ampia."
	},
	{
		id: "highWaterline",
		title: "Livello Acqua Alto",
		description: "Corpo basso posizionato in alto contro il bordo, per un livello quasi a filo."
	},
	{
		id: "flush",
		title: "Filo parete architettonico",
		description: "Piastra senza cornice, quasi a filo, con una sottile fessura d'ombra nella parete."
	}
].filter(({ id }) => id === "slim" || id === "highWaterline");
const OVERFLOW_GEOMETRY = {
	waterEdgeOffset: .055,
	hiddenChannelOffset: .105,
	/**
	* Outer edge of the VISIBLE overflow perimeter. Built, not styled: it is the
	* kerb plus the grille, and the audit enforces that identity rather than
	* letting the three numbers drift apart.
	*/
	visibleChannelOuterOffset: .355,
	/**
	* The constructed kerb (muretto) between the basin and the grille. 110 mm is
	* a real finished kerb -- a block or cast upstand with its cladding -- not
	* the 62 mm decorative strip this started as, which read as a trim bead
	* rather than as structure.
	*/
	visibleKerbWidth: .11,
	/**
	* Flush overflow crest: the reference grille and lip share the wall-top
	* datum. The water film overtops it; there is no skimmer-like dry upstand.
	*/
	visibleKerbRise: 0,
	/**
	* Overflow grille width. 245 mm is a stock section (the common residential
	* size between 195 and 295), so the grille is proportioned like a product
	* that exists rather than to whatever was left over from the channel band.
	*/
	visibleGrateWidth: .245,
	visibleWaterFilmWidth: .02,
	hiddenWaterChannelClearance: .015,
	visibleGrateTopOffset: 0,
	visibleWaterAboveLip: .001,
	hiddenWaterTopClearance: 5e-4,
	surfaceMovementAmplitude: 25e-5,
	/** Channel below the grille -- a real perimeter gutter, not a slot. */
	channelDepth: .22,
	grateSlatPitch: .075
};
/** Distance from the coping top down to the waterline, in metres.
* Sized so the skimmer-pool waterline sits ~mid-mouth on the skimmer opening. */
const FREEBOARD = .143;
//#endregion
//#region src/lib/pool/l-shape.ts
const L_SHAPE_ORIENTATIONS = [
	"sw",
	"se",
	"ne",
	"nw"
];
/** Guardrails: never let a leg thin out to a corridor, never let the recess
* collapse to a sliver, never let overall dimensions leave the pool's
* existing rectangle range. Mirrors the spirit of the rectangle's own
* dimension clamps (see PoolShapeStep.tsx / config.ts) rather than
* inventing a parallel policy. */
const L_SHAPE_GUARDRAILS = {
	totalLength: {
		min: 5,
		max: 25
	},
	totalWidth: {
		min: 4,
		max: 15
	},
	/** The narrowest a remaining leg (on either axis) may ever be -- both the
	* straight leg opposite the recess and the "foot" leg beside it. Below
	* this a leg reads as a corridor, not a usable swimming lane. */
	minLegWidth: 2,
	/** The smallest the recess itself may be -- below this it's not a
	* legible L, just a rectangle with a notch. */
	minRecess: 1.5
};
function clampNumber$1(value, min, max, fallback) {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, value));
}
/**
* Normalise arbitrary (possibly partial, possibly out-of-range, possibly
* NaN) input into a set of L-shape dimensions that can never produce a
* zero-width leg, a self-intersecting outline, or a degenerate recess.
* Every other function in this module assumes its `LShapeDimensions` input
* already passed through here -- callers (the UI, persistence) must too.
*/
function clampLShapeDimensions(input) {
	const totalLength = clampNumber$1(input?.totalLength ?? 10, L_SHAPE_GUARDRAILS.totalLength.min, L_SHAPE_GUARDRAILS.totalLength.max, 10);
	const totalWidth = clampNumber$1(input?.totalWidth ?? 7, L_SHAPE_GUARDRAILS.totalWidth.min, L_SHAPE_GUARDRAILS.totalWidth.max, 7);
	const maxRecessLength = Math.max(L_SHAPE_GUARDRAILS.minRecess, totalLength - L_SHAPE_GUARDRAILS.minLegWidth);
	const maxRecessWidth = Math.max(L_SHAPE_GUARDRAILS.minRecess, totalWidth - L_SHAPE_GUARDRAILS.minLegWidth);
	return {
		totalLength,
		totalWidth,
		recessLength: clampNumber$1(input?.recessLength ?? totalLength * .4, L_SHAPE_GUARDRAILS.minRecess, maxRecessLength, Math.min(maxRecessLength, totalLength * .4)),
		recessWidth: clampNumber$1(input?.recessWidth ?? totalWidth * .4, L_SHAPE_GUARDRAILS.minRecess, maxRecessWidth, Math.min(maxRecessWidth, totalWidth * .4)),
		orientation: L_SHAPE_ORIENTATIONS.includes(input?.orientation) ? input.orientation : "se"
	};
}
/**
* The real-world (metre), CCW-wound, 6-vertex L outline. Matches the
* winding convention `unitRectangle()` (geometry.ts) already uses --
* positive shoelace sum -- so every generic outline consumer (offsetOutline,
* skimmerWall, createSurfaceGeometry, floor-profile) sees the same
* orientation it already expects from every other shape.
*
* Each of the four orientations is the outer rectangle's 4 corners with one
* corner replaced by a 3-point inward step -- always exactly one reflex
* (concave) vertex, at the inner corner of the L, and five ordinary convex
* corners. Dimensions must already be `clampLShapeDimensions`-normalised;
* this function does no further validation.
*/
function buildLShapeOutline(dimensions) {
	const { totalLength: length, totalWidth: width, recessLength: rl, recessWidth: rw } = dimensions;
	const x0 = -length / 2;
	const x1 = length / 2;
	const z0 = -width / 2;
	const z1 = width / 2;
	const a = [x0, z0];
	const b = [x1, z0];
	const c = [x1, z1];
	const d = [x0, z1];
	switch (dimensions.orientation) {
		case "se": return [
			a,
			[x1 - rl, z0],
			[x1 - rl, z0 + rw],
			[x1, z0 + rw],
			c,
			d
		];
		case "sw": return [
			[x0, z0 + rw],
			[x0 + rl, z0 + rw],
			[x0 + rl, z0],
			b,
			c,
			d
		];
		case "ne": return [
			a,
			b,
			[x1, z1 - rw],
			[x1 - rl, z1 - rw],
			[x1 - rl, z1],
			d
		];
		case "nw": return [
			a,
			b,
			c,
			[x0 + rl, z1],
			[x0 + rl, z1 - rw],
			[x0, z1 - rw]
		];
	}
}
/** Per-vertex convex/reflex classification, generic over any simple,
* consistently-wound polygon -- not L-specific, so `cornerStairPlan` and
* anything else that must never treat the inner concave corner of an L (or
* any future concave shape) as a normal convex pool corner can reuse this
* instead of re-deriving the same cross-product test locally. Winding-aware:
* works for either CW or CCW input. */
function classifyOutlineCorners(outline) {
	if (outline.length < 3) return outline.map(() => true);
	let signedAreaSum = 0;
	for (let i = 0; i < outline.length; i++) {
		const [x1, z1] = outline[i];
		const [x2, z2] = outline[(i + 1) % outline.length];
		signedAreaSum += x1 * z2 - x2 * z1;
	}
	const ccw = signedAreaSum >= 0;
	return outline.map((point, i) => {
		const previous = outline[(i - 1 + outline.length) % outline.length];
		const next = outline[(i + 1) % outline.length];
		const inX = point[0] - previous[0];
		const inZ = point[1] - previous[1];
		const outX = next[0] - point[0];
		const cross = inX * (next[1] - point[1]) - inZ * outX;
		return ccw ? cross >= -1e-9 : cross <= 1e-9;
	});
}
//#endregion
//#region src/lib/pool/organic-shape.ts
const ORGANIC_SHAPE_GUARDRAILS = {
	length: {
		min: 4,
		max: 20
	},
	width: {
		min: 3,
		max: 14
	},
	curvature: {
		min: 0,
		max: 1
	},
	/** Target arc-length spacing between sampled points, metres -- the "15-25cm
	* resolution" the outline is sampled at. */
	targetResolution: .2,
	/** Never sample so sparsely the curve reads as faceted. */
	minPoints: 28,
	/** Hard cap so a very large organic pool never produces an unbounded point
	* count for downstream geometry (offsetOutline, createSurfaceGeometry). */
	maxPoints: 160,
	/** Below this, the basin reads as degenerate regardless of length/width. */
	minArea: 4
};
function clampNumber(value, min, max, fallback) {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, value));
}
function angularDelta(a, b) {
	let d = (a - b) % (Math.PI * 2);
	if (d > Math.PI) d -= Math.PI * 2;
	if (d < -Math.PI) d += Math.PI * 2;
	return d;
}
/** Bay depth / opposite-side fullness as fractions of the base radius, at
* curvature === 1. Kept well inside (0, 1) so `radiusAt` can never reach or
* cross zero for any curvature in [0, 1] -- the structural guarantee that
* makes self-intersection impossible by construction.
*
* These were originally 0.34 / 0.12 with wide (0.62 / 0.9 rad) Gaussians --
* mathematically a real dip, but so shallow and so spread out relative to
* the base ellipse that it rendered as visually indistinguishable from a
* plain oval at both the default curvature (0.5) and near the max (0.95):
* area only moved ~2% across the whole range, and a symmetric bulge that
* grew in lockstep with the dip actively clawed most of that area back at
* high curvature.
*
* A first pass over-corrected to a very narrow (0.35 rad), very deep (72%)
* Gaussian: visually dramatic, but its local radius of curvature at the
* bottom of the bay got tight enough that `offsetOutline` (geometry.ts),
* used for every real outward offset a customer actually sees (coping,
* hidden/visible overflow channels -- up to ~0.425 m outward), would
* self-intersect and get pruned by `removeOffsetLoops`, throwing
* `createCopingSlabGeometry`'s "Mismatched coping outlines" guard. Widened
* back out (still much deeper/narrower than the original) to a combination
* verified, by direct probe against the real `offsetOutline`, to never
* shrink the point count for any real outward offset up to 0.45 m across
* the full guardrail range of length/width/curvature/mirror -- see the
* `copingSafeAtOffset` guardrail below, which also catches the rare
* remaining extreme-aspect-ratio edge case by shrinking curvature exactly
* the way the area-floor guardrail already does. At curvature=1 the bay
* still cuts the local radius by 55% (a dramatic waist); the safety
* boundary only constrains the CONCAVE (dip) side -- an outward offset of a
* convex bulge never self-intersects -- so the opposite side's bulge is
* free to be both narrower and deeper (25%) than the dip's own angular
* width without touching coping-safety at all. That asymmetry (a wide,
* gentle waist against a narrower, fuller far side) is what makes the
* silhouette actually read as a kidney/bean rather than a lopsided oval:
* verified visually (Playwright screenshots at curvature 0.5 and 1) as well
* as by the area-divergence and bay/opposite-side notch-depth assertions
* below. 1 - MAX_DIP_FRACTION (0.45) is `radiusAt`'s own worst case --
* still comfortably clear of zero. */
const MAX_DIP_FRACTION = .55;
const MAX_BULGE_FRACTION = .25;
const DIP_ANGULAR_WIDTH = 1.3;
const BULGE_ANGULAR_WIDTH = .8;
/** The largest real outward offset any consumer of an organic outline ever
* applies -- see `copingOuterOffset` (poolConstruction.ts: 0.32 m skimmer,
* 0.32 + `OVERFLOW_GEOMETRY.hiddenChannelOffset` (0.105 m) = 0.425 m hidden
* overflow) and `OVERFLOW_GEOMETRY.visibleChannelOuterOffset` (0.355 m) --
* rounded up for margin. Used only by the `copingSafeAtOffset` guardrail
* below; not itself a rendering constant. */
const MAX_REAL_OUTWARD_OFFSET = .45;
function radiusAt(theta, curvature, mirror) {
	const bayCentre = mirror ? -Math.PI / 2 : Math.PI / 2;
	const dipDelta = angularDelta(theta, bayCentre);
	const dip = MAX_DIP_FRACTION * curvature * Math.exp(-(dipDelta * dipDelta) / (2 * DIP_ANGULAR_WIDTH * DIP_ANGULAR_WIDTH));
	const bulgeDelta = angularDelta(theta, bayCentre + Math.PI);
	const bulge = MAX_BULGE_FRACTION * curvature * Math.exp(-(bulgeDelta * bulgeDelta) / (2 * BULGE_ANGULAR_WIDTH * BULGE_ANGULAR_WIDTH));
	return 1 - dip + bulge;
}
function sampleAtCount(params, count) {
	const rx = params.length / 2;
	const rz = params.width / 2;
	const points = [];
	for (let i = 0; i < count; i++) {
		const theta = i / count * Math.PI * 2;
		const r = radiusAt(theta, params.curvature, params.mirror);
		points.push([Math.cos(theta) * rx * r, Math.sin(theta) * rz * r]);
	}
	return points;
}
/** Local, dependency-free segment-intersection test -- deliberately not
* imported from geometry.ts's internal (unexported) equivalent, mirroring
* why `lighting.ts` keeps its own local copy of `l-shape.ts`'s corner test:
* this module must stay safe to reach from either the bundler graph or a
* Node-native script without relying on internals another module doesn't
* export. */
function orientation2(a, b, c) {
	return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function segmentsIntersect$2(a, b, c, d) {
	const abC = orientation2(a, b, c);
	const abD = orientation2(a, b, d);
	const cdA = orientation2(c, d, a);
	const cdB = orientation2(c, d, b);
	return abC * abD < -1e-9 && cdA * cdB < -1e-9;
}
/** True if the outline is not a simple polygon. Real, exercised safety net
* (see module docs) -- not merely decorative -- called by
* `buildOrganicShapeOutline` on every build, and independently by the audit
* scripts. Only checks non-adjacent edge pairs, same convention as
* geometry.ts's own equivalent. */
function outlineSelfIntersects(outline) {
	for (let first = 0; first < outline.length; first++) {
		const firstNext = (first + 1) % outline.length;
		for (let second = first + 2; second < outline.length; second++) {
			const secondNext = (second + 1) % outline.length;
			if (first === secondNext || firstNext === second) continue;
			if (segmentsIntersect$2(outline[first], outline[firstNext], outline[second], outline[secondNext])) return true;
		}
	}
	return false;
}
/** CCW-positive shoelace winding check -- true when the outline winds the
* same way `unitRectangle()`/`buildLShapeOutline()` already do (geometry.ts),
* so every generic outline consumer sees one consistent convention. */
function outlineWindsCcw(outline) {
	let sum = 0;
	for (let i = 0; i < outline.length; i++) {
		const [x1, z1] = outline[i];
		const [x2, z2] = outline[(i + 1) % outline.length];
		sum += x1 * z2 - x2 * z1;
	}
	return sum >= 0;
}
function validateOrganicOutline(outline) {
	const selfIntersecting = outlineSelfIntersects(outline);
	const ccw = outlineWindsCcw(outline);
	const area = outlineArea(outline);
	return {
		valid: !selfIntersecting && ccw && area >= ORGANIC_SHAPE_GUARDRAILS.minArea,
		selfIntersecting,
		ccw,
		area
	};
}
/**
* Normalise arbitrary (possibly partial, out-of-range, or NaN) input into
* safe organic-shape params, mirroring `clampLShapeDimensions`'s contract:
* every other function in this module assumes its input already passed
* through here. Curvature is additionally reduced (never increased) if the
* requested value would leave the basin below the minimum real area for the
* requested length/width -- the same "shrink until safe" guardrail spirit
* `clampLShapeDimensions` uses for its recess.
*/
function clampOrganicShapeParams(input) {
	const length = clampNumber(input?.length ?? 10, ORGANIC_SHAPE_GUARDRAILS.length.min, ORGANIC_SHAPE_GUARDRAILS.length.max, 10);
	const width = clampNumber(input?.width ?? 6, ORGANIC_SHAPE_GUARDRAILS.width.min, ORGANIC_SHAPE_GUARDRAILS.width.max, 6);
	const requestedCurvature = clampNumber(input?.curvature ?? .5, ORGANIC_SHAPE_GUARDRAILS.curvature.min, ORGANIC_SHAPE_GUARDRAILS.curvature.max, .5);
	const mirror = input?.mirror === true;
	const copingSafeAtOffset = (outline) => {
		return offsetOutline(outline, MAX_REAL_OUTWARD_OFFSET).length === outline.length;
	};
	let low = 0;
	let high = requestedCurvature;
	const probe = (curvature) => {
		const outline = sampleAtCount({
			length,
			width,
			curvature,
			mirror
		}, 128);
		return outlineArea(outline) >= ORGANIC_SHAPE_GUARDRAILS.minArea && copingSafeAtOffset(outline);
	};
	if (!probe(high)) {
		for (let iteration = 0; iteration < 20; iteration++) {
			const mid = (low + high) / 2;
			if (probe(mid)) low = mid;
			else high = mid;
		}
		return {
			length,
			width,
			curvature: low,
			mirror
		};
	}
	return {
		length,
		width,
		curvature: requestedCurvature,
		mirror
	};
}
/**
* The real-world (metre), CCW-wound outline: a deterministic, bounded-length
* sample of the smooth closed curve described in the module docs. Params
* must already be `clampOrganicShapeParams`-normalised; this function
* defensively re-derives a safe curvature via `validateOrganicOutline`
* anyway (falling back toward a plain ellipse, never throwing and never
* producing a self-intersecting or degenerate outline) so a caller that
* skipped normalisation can still never reach broken geometry downstream.
*/
function buildOrganicShapeOutline(params) {
	const safe = clampOrganicShapeParams(params);
	const perimeter = outlinePerimeter(sampleAtCount(safe, 128));
	const targetCount = Math.min(ORGANIC_SHAPE_GUARDRAILS.maxPoints, Math.max(ORGANIC_SHAPE_GUARDRAILS.minPoints, Math.round(perimeter / ORGANIC_SHAPE_GUARDRAILS.targetResolution)));
	const outline = sampleAtCount(safe, targetCount);
	const validation = validateOrganicOutline(outline);
	const copingSafe = offsetOutline(outline, MAX_REAL_OUTWARD_OFFSET).length === outline.length;
	if (validation.valid && copingSafe) return outline;
	return sampleAtCount({
		...safe,
		curvature: 0
	}, targetCount);
}
//#endregion
//#region src/lib/pool/geometry.ts
/**
* Normalised outline generators. Every generator returns points inside the
* [-0.5, 0.5] unit square so that scaling by length/width keeps the geometry
* perfectly proportional for any dimension combination.
*/
const unitRectangle = () => [
	[-.5, -.5],
	[.5, -.5],
	[.5, .5],
	[-.5, .5]
];
/**
* Corner-cutting subdivision converges to a smooth C1 closed curve and stays
* inside the control polygon, avoiding the overshoot of interpolating splines.
*/
function smoothClosedPolygon(points) {
	let current = points;
	while (current.length < 256) {
		const next = [];
		for (let index = 0; index < current.length; index++) {
			const a = current[index];
			const b = current[(index + 1) % current.length];
			next.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
		}
		current = next;
	}
	return normalise$1(current);
}
/** Smooth closed curve constrained by the user's valid control polygon. */
const unitFromControlPoints = (controlPoints, _tension = .5) => {
	if (!isValidControlPolygon(controlPoints)) return unitRectangle();
	return smoothClosedPolygon(controlPoints);
};
const orientation = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function segmentsIntersect$1(a, b, c, d) {
	const epsilon = 1e-8;
	const abC = orientation(a, b, c);
	const abD = orientation(a, b, d);
	const cdA = orientation(c, d, a);
	const cdB = orientation(c, d, b);
	const onSegment = (start, end, point) => point[0] >= Math.min(start[0], end[0]) - epsilon && point[0] <= Math.max(start[0], end[0]) + epsilon && point[1] >= Math.min(start[1], end[1]) - epsilon && point[1] <= Math.max(start[1], end[1]) + epsilon;
	if (abC * abD < -1e-8 && cdA * cdB < -1e-8) return true;
	return Math.abs(abC) <= epsilon && onSegment(a, b, c) || Math.abs(abD) <= epsilon && onSegment(a, b, d) || Math.abs(cdA) <= epsilon && onSegment(c, d, a) || Math.abs(cdB) <= epsilon && onSegment(c, d, b);
}
function isValidControlPolygon(points) {
	if (points.length < 3 || points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return false;
	if (outlineArea(points) < .02) return false;
	for (let i = 0; i < points.length; i++) {
		const a = points[i];
		const b = points[(i + 1) % points.length];
		if (Math.hypot(b[0] - a[0], b[1] - a[1]) < .035) return false;
		for (let j = i + 1; j < points.length; j++) {
			if (j === i || j === i + 1 || i === 0 && j === points.length - 1) continue;
			if (segmentsIntersect$1(a, b, points[j], points[(j + 1) % points.length])) return false;
		}
	}
	return true;
}
/** Rescale any point cloud so its bounding box is exactly the unit square. */
function normalise$1(points) {
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const [x, y] of points) {
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minY = Math.min(minY, y);
		maxY = Math.max(maxY, y);
	}
	const spanX = maxX - minX || 1;
	const spanY = maxY - minY || 1;
	const cx = (minX + maxX) / 2;
	const cy = (minY + maxY) / 2;
	return points.map(([x, y]) => [(x - cx) / spanX, (y - cy) / spanY]);
}
/** Build the real-world outline (metres) for a shape + dimensions pair. */
function buildOutline(shape, dimensions, controlPoints) {
	if (shape === "l-shape") return buildLShapeOutline(clampLShapeDimensions({
		totalLength: dimensions.length,
		totalWidth: dimensions.width,
		recessLength: dimensions.lShapeRecessLength,
		recessWidth: dimensions.lShapeRecessWidth,
		orientation: dimensions.lShapeOrientation
	}));
	if (shape === "organic") return buildOrganicShapeOutline(clampOrganicShapeParams({
		length: dimensions.length,
		width: dimensions.width,
		curvature: dimensions.organicCurvature,
		mirror: dimensions.organicMirror
	}));
	const unit = shape === "rectangle" ? unitRectangle() : unitFromControlPoints(controlPoints);
	const length = Number.isFinite(dimensions.length) ? Math.max(.01, dimensions.length) : 1;
	const width = Number.isFinite(dimensions.width) ? Math.max(.01, dimensions.width) : 1;
	return unit.map(([x, y]) => [x * length, y * width]);
}
/** Signed-area (shoelace) magnitude in square metres. */
function outlineArea(outline) {
	let sum = 0;
	for (let i = 0; i < outline.length; i++) {
		const [x1, y1] = outline[i];
		const [x2, y2] = outline[(i + 1) % outline.length];
		sum += x1 * y2 - x2 * y1;
	}
	return Math.abs(sum) / 2;
}
/**
* Exact area centroid (signed shoelace formula) of a simple polygon -- NOT
* the mean of its vertices, which is wrong for any non-regular polygon (an
* L-shape or a densely-sampled organic curve most of all, since extra
* vertices along a nearly-straight run would silently drag a vertex-average
* off-centre). Used by `computeSlopeMetrics` (floor-profile.ts): because a
* single-axis planar ramp's elevation is an affine function of (x, z), the
* exact integral of that elevation over the polygon equals the elevation
* evaluated at this centroid, times the area -- a real closed-form identity,
* not an approximation, and it is what makes sloped-floor volume correct for
* a non-constant-cross-width basin (L-shape, organic) instead of only a
* constant-width rectangle. */
function outlineCentroid(outline) {
	let signedAreaSum = 0;
	let cx = 0;
	let cz = 0;
	for (let i = 0; i < outline.length; i++) {
		const [x1, z1] = outline[i];
		const [x2, z2] = outline[(i + 1) % outline.length];
		const cross = x1 * z2 - x2 * z1;
		signedAreaSum += cross;
		cx += (x1 + x2) * cross;
		cz += (z1 + z2) * cross;
	}
	const signedArea = signedAreaSum / 2;
	if (Math.abs(signedArea) < 1e-12) {
		const n = Math.max(1, outline.length);
		return outline.reduce((sum, [x, z]) => [sum[0] + x / n, sum[1] + z / n], [0, 0]);
	}
	return [cx / (6 * signedArea), cz / (6 * signedArea)];
}
function outlinePerimeter(outline) {
	let total = 0;
	for (let i = 0; i < outline.length; i++) {
		const [x1, y1] = outline[i];
		const [x2, y2] = outline[(i + 1) % outline.length];
		total += Math.hypot(x2 - x1, y2 - y1);
	}
	return total;
}
function outlineBounds(outline) {
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;
	for (const [x, z] of outline) {
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minZ = Math.min(minZ, z);
		maxZ = Math.max(maxZ, z);
	}
	return {
		minX,
		maxX,
		minZ,
		maxZ,
		spanX: maxX - minX,
		spanZ: maxZ - minZ
	};
}
const signedArea = (outline) => {
	let sum = 0;
	for (let index = 0; index < outline.length; index++) {
		const a = outline[index];
		const b = outline[(index + 1) % outline.length];
		sum += a[0] * b[1] - b[0] * a[1];
	}
	return sum / 2;
};
const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
function lineIntersection(firstPoint, firstDirection, secondPoint, secondDirection) {
	const denominator = cross2(firstDirection, secondDirection);
	if (Math.abs(denominator) < 1e-9) return null;
	const delta = [secondPoint[0] - firstPoint[0], secondPoint[1] - firstPoint[1]];
	const amount = cross2(delta, secondDirection) / denominator;
	return [firstPoint[0] + firstDirection[0] * amount, firstPoint[1] + firstDirection[1] * amount];
}
function segmentIntersectionPoint(a, b, c, d) {
	const firstDirection = [b[0] - a[0], b[1] - a[1]];
	const secondDirection = [d[0] - c[0], d[1] - c[1]];
	const denominator = cross2(firstDirection, secondDirection);
	if (Math.abs(denominator) < 1e-9) return null;
	const delta = [c[0] - a[0], c[1] - a[1]];
	const firstAmount = cross2(delta, secondDirection) / denominator;
	const secondAmount = cross2(delta, firstDirection) / denominator;
	const epsilon = 1e-7;
	if (firstAmount <= epsilon || firstAmount >= .9999999 || secondAmount <= epsilon || secondAmount >= .9999999) return null;
	return [a[0] + firstDirection[0] * firstAmount, a[1] + firstDirection[1] * firstAmount];
}
/** Remove loops created when an outward offset closes a narrow concavity. */
function removeOffsetLoops(points) {
	let cleaned = [...points];
	for (let pass = 0; pass < points.length && cleaned.length >= 3; pass++) {
		let repaired = false;
		for (let first = 0; first < cleaned.length && !repaired; first++) {
			const firstNext = (first + 1) % cleaned.length;
			for (let second = first + 2; second < cleaned.length; second++) {
				const secondNext = (second + 1) % cleaned.length;
				if (first === secondNext || firstNext === second) continue;
				const intersection = segmentIntersectionPoint(cleaned[first], cleaned[firstNext], cleaned[second], cleaned[secondNext]);
				if (!intersection) continue;
				const firstCandidate = [
					...cleaned.slice(0, first + 1),
					intersection,
					...cleaned.slice(second + 1)
				];
				const secondCandidate = [intersection, ...cleaned.slice(first + 1, second + 1)];
				cleaned = outlineArea(firstCandidate) >= outlineArea(secondCandidate) ? firstCandidate : secondCandidate;
				repaired = true;
				break;
			}
		}
		if (!repaired) break;
	}
	return cleaned;
}
/**
* Offset a closed outline by an exact world-space distance in metres. Each
* edge is translated along its outward unit normal and adjacent translated
* lines are intersected, so concave shapes retain a constant-width coping.
*/
function offsetOutline(outline, distance) {
	const cleaned = removeOffsetLoops(rawOffsetOutline(outline, distance));
	return signedArea(cleaned) * signedArea(outline) < 0 ? [...cleaned].reverse() : cleaned;
}
function rawOffsetOutline(outline, distance) {
	if (outline.length < 3 || Math.abs(distance) < 1e-12) return [...outline];
	const winding = signedArea(outline) >= 0 ? 1 : -1;
	const result = [];
	for (let index = 0; index < outline.length; index++) {
		const previous = outline[(index - 1 + outline.length) % outline.length];
		const current = outline[index];
		const next = outline[(index + 1) % outline.length];
		const previousDelta = [current[0] - previous[0], current[1] - previous[1]];
		const nextDelta = [next[0] - current[0], next[1] - current[1]];
		const previousLength = Math.hypot(...previousDelta);
		const nextLength = Math.hypot(...nextDelta);
		if (previousLength < 1e-9 || nextLength < 1e-9) continue;
		const previousDirection = [previousDelta[0] / previousLength, previousDelta[1] / previousLength];
		const nextDirection = [nextDelta[0] / nextLength, nextDelta[1] / nextLength];
		const previousNormal = [winding * previousDirection[1], -winding * previousDirection[0]];
		const nextNormal = [winding * nextDirection[1], -winding * nextDirection[0]];
		const intersection = lineIntersection([current[0] + previousNormal[0] * distance, current[1] + previousNormal[1] * distance], previousDirection, [current[0] + nextNormal[0] * distance, current[1] + nextNormal[1] * distance], nextDirection);
		if (intersection && intersection.every(Number.isFinite)) result.push(intersection);
		else {
			const averageNormal = [previousNormal[0] + nextNormal[0], previousNormal[1] + nextNormal[1]];
			const normalLength = Math.hypot(...averageNormal) || 1;
			result.push([current[0] + averageNormal[0] / normalLength * distance, current[1] + averageNormal[1] / normalLength * distance]);
		}
	}
	return signedArea(result) * signedArea(outline) < 0 ? [...result].reverse() : result;
}
/** All derived quantities for the current basin. */
function computeMetrics(outline, depth) {
	const safeDepth = Number.isFinite(depth) ? Math.max(0, depth) : 0;
	const floorSurface = outlineArea(outline);
	const perimeter = outlinePerimeter(outline);
	const wallSurface = perimeter * safeDepth;
	return {
		floorSurface,
		waterSurface: floorSurface,
		perimeter,
		wallSurface,
		internalSurface: floorSurface + wallSurface,
		waterVolume: floorSurface * safeDepth
	};
}
//#endregion
//#region src/lib/pool/comfort-selection.ts
/** Pure comfort-selection rules (no three/React) shared by store, persistence and the engine. */
/** Sun shelf and hydromassage are alternatives for the same comfort zone. The
* option selected last wins (`prefer`); with no preference the shelf is kept.
* The integrated bench belongs to the sun shelf: without the shelf (no
* comfort, or hydromassage) a previously chosen bench is dropped. */
function normalizeComfortFeatures(features, prefer) {
	const ids = features;
	const drop = ids.includes("sunShelf") && ids.includes("hydromassage") ? prefer === "hydromassage" ? "sunShelf" : "hydromassage" : null;
	const resolved = features.filter((id) => id !== drop);
	return resolved.includes("sunShelf") ? resolved : resolved.filter((id) => id !== "integratedBench" && id !== "sunShelfLoungers");
}
/** Single source of truth for every vertical pool elevation, in metres. */
function getPoolVerticalLayout({ poolType, system, overflowType = "hidden", depth, copingThickness }) {
	const safeDepth = Number.isFinite(depth) ? Math.max(.01, depth) : .01;
	const wallTopY = poolType === "above-ground" ? 0 + safeDepth : 0;
	return {
		groundY: 0,
		floorY: poolType === "above-ground" ? 0 : 0 - safeDepth,
		wallTopY,
		waterY: system === "skimmer" ? wallTopY - FREEBOARD : overflowType === "visible" ? wallTopY + OVERFLOW_GEOMETRY.visibleGrateTopOffset + OVERFLOW_GEOMETRY.visibleWaterAboveLip : wallTopY - OVERFLOW_GEOMETRY.hiddenWaterTopClearance,
		copingY: wallTopY + copingThickness
	};
}
//#endregion
//#region src/lib/pool/infinity-edge.ts
/**
* Structural design defaults in metres; indicative visualization dimensions,
* not construction certification or manufacturer specifications.
*/
/** Structural crest below the millimetric flowing water film, not coping. */
const infinityCrestY = (waterY) => waterY - .006;
const INFINITY_EDGE_DIMENSIONS = {
	/** Width of the water-covered structural crest. */
	lipWidth: {
		min: .08,
		max: .3,
		default: .2
	},
	/** Architectural drop to a shallow receiving trough, independent of basin depth. */
	dropHeight: {
		min: .1,
		max: .9,
		default: .55
	},
	/** Receiving channel clear width, measured outward from the crest. */
	catchBasinWidth: {
		min: .3,
		max: 1.2,
		default: .35
	},
	/** Receiving channel depth below its own water level. */
	catchBasinDepth: {
		min: .25,
		max: .9,
		default: .25
	},
	/** Nominal structural wall thickness. */
	wallThickness: {
		min: .15,
		max: .4,
		default: .15
	}
};
/**
* Every valid Infinity candidate zone for a Rectangle outline -- one per
* side, always 4 for a well-formed axis-aligned rectangle outline (4
* vertices). Returns an empty array for anything that isn't recognisably a
* 4-vertex rectangle (defensive: this module never fabricates a zone for an
* outline it can't actually validate).
*/
function rectangleInfinityZones(outline) {
	if (outline.length !== 4) return [];
	const bounds = outlineBounds(outline);
	if (!Number.isFinite(bounds.spanX) || !Number.isFinite(bounds.spanZ)) return [];
	if (bounds.spanX <= 0 || bounds.spanZ <= 0) return [];
	const centroidX = (bounds.minX + bounds.maxX) / 2;
	const centroidZ = (bounds.minZ + bounds.maxZ) / 2;
	const zones = [];
	for (let i = 0; i < outline.length; i++) {
		const start = outline[i];
		const end = outline[(i + 1) % outline.length];
		const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
		if (length <= 0) return [];
		const midX = (start[0] + end[0]) / 2;
		const midZ = (start[1] + end[1]) / 2;
		const dx = end[0] - start[0];
		const candidateA = [-(end[1] - start[1]) / length, dx / length];
		const normal = candidateA[0] * (midX - centroidX) + candidateA[1] * (midZ - centroidZ) >= 0 ? candidateA : [-candidateA[0], -candidateA[1]];
		zones.push({
			side: i,
			start,
			end,
			length,
			normal,
			points: [start, end],
			pointNormals: [normal, normal]
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
const MIN_INFINITY_ZONE_LENGTH = INFINITY_EDGE_DIMENSIONS.lipWidth.max + INFINITY_EDGE_DIMENSIONS.catchBasinWidth.max;
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
function lShapeInfinityZones(outline) {
	if (outline.length !== 6) return [];
	const bounds = outlineBounds(outline);
	if (!Number.isFinite(bounds.spanX) || !Number.isFinite(bounds.spanZ)) return [];
	if (bounds.spanX <= 0 || bounds.spanZ <= 0) return [];
	const reflexIndex = classifyOutlineCorners(outline).findIndex((isConvex) => !isConvex);
	if (reflexIndex < 0) return [];
	const n = outline.length;
	const excludedEdges = /* @__PURE__ */ new Set([(reflexIndex - 1 + n) % n, reflexIndex]);
	const centroidX = (bounds.minX + bounds.maxX) / 2;
	const centroidZ = (bounds.minZ + bounds.maxZ) / 2;
	const zones = [];
	for (let i = 0; i < n; i++) {
		if (excludedEdges.has(i)) continue;
		const start = outline[i];
		const end = outline[(i + 1) % n];
		const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
		if (!(length >= MIN_INFINITY_ZONE_LENGTH)) continue;
		const midX = (start[0] + end[0]) / 2;
		const midZ = (start[1] + end[1]) / 2;
		const dx = end[0] - start[0];
		const candidateA = [-(end[1] - start[1]) / length, dx / length];
		const normal = candidateA[0] * (midX - centroidX) + candidateA[1] * (midZ - centroidZ) >= 0 ? candidateA : [-candidateA[0], -candidateA[1]];
		zones.push({
			side: i,
			start,
			end,
			length,
			normal,
			points: [start, end],
			pointNormals: [normal, normal]
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
function infinityZonesForOutline(outline, shape) {
	if (shape === "rectangle") return rectangleInfinityZones(outline);
	if (shape === "l-shape") return lShapeInfinityZones(outline);
	if (shape === "organic") return organicInfinityZones(outline);
	if (shape === "custom") return customInfinityZones(outline);
	if (outline.length === 4) return rectangleInfinityZones(outline);
	if (outline.length === 6) return lShapeInfinityZones(outline);
	return [];
}
/** Custom candidates are real supporting edges of the outline, not bounds.
* Recess edges are excluded: every pool vertex must remain on the basin side. */
function customInfinityZones(outline) {
	if (outline.length < 3) return [];
	if (outline.length >= 12) return organicInfinityZones(outline).filter((zone) => zone.points.every((p, i) => outline.every((q) => (q[0] - p[0]) * zone.pointNormals[i][0] + (q[1] - p[1]) * zone.pointNormals[i][1] <= .03)));
	const winding = Math.sign(outline.reduce((sum, a, i) => {
		const b = outline[(i + 1) % outline.length];
		return sum + a[0] * b[1] - b[0] * a[1];
	}, 0));
	if (!winding) return [];
	return outline.flatMap((start, side) => {
		const end = outline[(side + 1) % outline.length];
		const dx = end[0] - start[0], dz = end[1] - start[1], length = Math.hypot(dx, dz);
		if (length < MIN_INFINITY_ZONE_LENGTH) return [];
		const normal = [winding * dz / length, -winding * dx / length];
		if (outline.some((p) => (p[0] - start[0]) * normal[0] + (p[1] - start[1]) * normal[1] > 1e-6)) return [];
		return [{
			side,
			start,
			end,
			length,
			normal,
			points: [start, end],
			pointNormals: [normal, normal]
		}];
	});
}
/** Local, dependency-free circumradius-based curvature radius at one outline
* vertex -- large/Infinity on a flat run, small at a tight bend. Deliberately
* a local copy of the identical technique `walls.ts`'s own
* `localCurvatureRadius` uses (not exported there), mirroring why
* `lighting.ts` keeps its own local copy of `l-shape.ts`'s corner test: each
* of these small geometry modules stays safe to reach independently rather
* than threading a shared internal helper through every consumer. */
function localCurvatureRadius$1(outline, index) {
	const n = outline.length;
	const previous = outline[(index - 1 + n) % n];
	const current = outline[index];
	const next = outline[(index + 1) % n];
	const first = Math.hypot(current[0] - previous[0], current[1] - previous[1]);
	const second = Math.hypot(next[0] - current[0], next[1] - current[1]);
	const opposite = Math.hypot(next[0] - previous[0], next[1] - previous[1]);
	const twiceArea = Math.abs((current[0] - previous[0]) * (next[1] - previous[1]) - (current[1] - previous[1]) * (next[0] - previous[0]));
	if (twiceArea <= 1e-9) return Infinity;
	return first * second * opposite / (2 * twiceArea);
}
/** Outward unit normal at one outline vertex: the average of its two
* adjacent edges' own perpendiculars, oriented away from the outline's
* centroid -- the standard "vertex normal from edge normals" technique, used
* so a curved zone's per-point offset (lip/cascade/catch-basin) stays
* perpendicular to the TRUE local curve instead of a single global
* direction. */
function vertexNormal(outline, index, centroidX, centroidZ) {
	const n = outline.length;
	const previous = outline[(index - 1 + n) % n];
	const current = outline[index];
	const next = outline[(index + 1) % n];
	const edgeNormal = (a, b) => {
		const dx = b[0] - a[0];
		const dz = b[1] - a[1];
		const len = Math.hypot(dx, dz);
		if (!(len > 1e-9)) return [0, 0];
		return [-dz / len, dx / len];
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
	const candidate = [sumX / sumLen, sumZ / sumLen];
	return candidate[0] * (current[0] - centroidX) + candidate[1] * (current[1] - centroidZ) >= 0 ? candidate : [-candidate[0], -candidate[1]];
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
const ORGANIC_TIGHT_CURVATURE_FACTOR = .35;
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
function organicInfinityZones(outline) {
	const n = outline.length;
	if (n < 12) return [];
	const bounds = outlineBounds(outline);
	if (!Number.isFinite(bounds.spanX) || !Number.isFinite(bounds.spanZ)) return [];
	if (bounds.spanX <= 0 || bounds.spanZ <= 0) return [];
	const centroidX = (bounds.minX + bounds.maxX) / 2;
	const centroidZ = (bounds.minZ + bounds.maxZ) / 2;
	const radii = outline.map((_, i) => localCurvatureRadius$1(outline, i));
	const finiteRadii = radii.filter((r) => Number.isFinite(r));
	const flattestRadius = finiteRadii.length ? Math.max(...finiteRadii) : Infinity;
	const tightThreshold = Number.isFinite(flattestRadius) ? flattestRadius * ORGANIC_TIGHT_CURVATURE_FACTOR : 0;
	const isTight = (i) => Number.isFinite(radii[i]) && radii[i] < tightThreshold;
	const sectorOf = (point) => {
		const dx = point[0] - centroidX;
		const dz = point[1] - centroidZ;
		if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 0 : 1;
		return dz >= 0 ? 2 : 3;
	};
	const zones = [];
	for (let sector = 0; sector < 4; sector++) {
		const eligible = outline.map((point, i) => sectorOf(point) === sector && !isTight(i));
		let bestStart = -1;
		let bestLength = 0;
		for (let start = 0; start < n; start++) {
			if (!eligible[start] || start > 0 && eligible[start - 1]) continue;
			let runLength = 0;
			while (runLength < n && eligible[(start + runLength) % n]) runLength++;
			if (runLength > bestLength) {
				bestLength = runLength;
				bestStart = start;
			}
		}
		if (bestStart < 0 || bestLength < 4) continue;
		const points = [];
		const pointNormals = [];
		for (let k = 0; k < bestLength; k++) {
			const index = (bestStart + k) % n;
			points.push(outline[index]);
			pointNormals.push(vertexNormal(outline, index, centroidX, centroidZ));
		}
		let arcLength = 0;
		for (let k = 1; k < points.length; k++) arcLength += Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]);
		if (!(arcLength >= MIN_INFINITY_ZONE_LENGTH)) continue;
		let normalX = 0;
		let normalZ = 0;
		for (let k = 0; k < points.length; k++) {
			const weight = ((k > 0 ? Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]) : 0) + (k < points.length - 1 ? Math.hypot(points[k + 1][0] - points[k][0], points[k + 1][1] - points[k][1]) : 0)) / 2 || 1;
			normalX += pointNormals[k][0] * weight;
			normalZ += pointNormals[k][1] * weight;
		}
		const normalLen = Math.hypot(normalX, normalZ) || 1;
		const normal = [normalX / normalLen, normalZ / normalLen];
		zones.push({
			side: bestStart,
			start: points[0],
			end: points[points.length - 1],
			length: arcLength,
			normal,
			points,
			pointNormals
		});
	}
	return zones;
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
function computeInfinityEdgeGeometry(outline, params, shape) {
	if (!params.enabled || params.side === null) return null;
	const zone = infinityZonesForOutline(outline, shape).find((z) => z.side === params.side);
	if (!zone) return null;
	if (!(zone.length > 0)) return null;
	const chordLength = Math.hypot(zone.end[0] - zone.start[0], zone.end[1] - zone.start[1]);
	if (!(chordLength > 0)) return null;
	const tangent = [(zone.end[0] - zone.start[0]) / chordLength, (zone.end[1] - zone.start[1]) / chordLength];
	return {
		side: zone.side,
		start: zone.start,
		end: zone.end,
		tangent,
		normal: zone.normal,
		length: zone.length,
		points: zone.points,
		pointNormals: zone.pointNormals
	};
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
function infinityExclusion(outline, params, shape) {
	const geometry = computeInfinityEdgeGeometry(outline, params, shape);
	if (!geometry) return null;
	const edgeIndices = Array.from({ length: geometry.points.length - 1 }, (_, i) => (geometry.side + i) % outline.length);
	const [x1, z1] = geometry.start;
	const [x2, z2] = geometry.end;
	if (Math.abs(x1 - x2) < 1e-6) return {
		axis: "x",
		coordinate: x1,
		edgeIndices
	};
	if (Math.abs(z1 - z2) < 1e-6) return {
		axis: "z",
		coordinate: z1,
		edgeIndices
	};
	const axis = Math.abs(geometry.normal[0]) >= Math.abs(geometry.normal[1]) ? "x" : "z";
	const axisIndex = axis === "x" ? 0 : 1;
	const sign = geometry.normal[axisIndex] >= 0 ? 1 : -1;
	let coordinate = geometry.points[0][axisIndex];
	for (const point of geometry.points) if (sign > 0 ? point[axisIndex] > coordinate : point[axisIndex] < coordinate) coordinate = point[axisIndex];
	return {
		axis,
		coordinate,
		edgeIndices
	};
}
//#endregion
//#region src/lib/pool/sun-shelf-model.ts
/** Published envelope; original procedural illustration, not manufacturer CAD
* or installation approval. Layout reserves full length, not just contact area. */
const SUN_SHELF_LOUNGER_MODEL = {
	id: "immersed-resin-chaise",
	reference: "Lyxo Esse · LT302-0001M1",
	source: "https://lyxodesign.com/prod/esse/",
	specification: "https://www.lyxodesign.com/wp-content/uploads/2025/04/Catalogo_Lyxo_2025.pdf",
	installation: "https://lyxodesign.com/prod/esse/",
	length: 1.85,
	width: .73,
	height: .57,
	seatHeight: .11,
	kneeHeight: .25,
	maxWaterDepth: .2,
	supportLength: 1.2
};
const SUN_SHELF_WATER_DEPTH = .2;
/** Owner's preliminary layout criteria, not certified installation clearances.
* The real stair/landing strip is reserved separately from these margins. */
const SUN_SHELF_LOUNGER_LAYOUT = {
	edgeInset: .25,
	between: .24,
	accessBuffer: .3,
	minimumCapacity: 2,
	minimumAccessWidth: .9,
	backPassage: .9
};
const SUN_SHELF_MIN_RUN = SUN_SHELF_LOUNGER_MODEL.length + SUN_SHELF_LOUNGER_LAYOUT.backPassage + SUN_SHELF_LOUNGER_LAYOUT.edgeInset + .035;
//#endregion
//#region src/lib/pool/floor-profile.ts
/**
* Single source of truth for floor-profile geometry (Geometry Pass A: flat vs
* sloped floor). Every consumer that needs a floor elevation, a local water
* depth, or the slope-aware metrics formulas -- rendering, metrics, stairs,
* lighting, water, measurements -- reads it from here, never re-derives its
* own copy.
*
* Scope: slope is offered for a rectangular, L-shaped or Organic, in-ground
* pool (Geometry Pass B extends the rectangle-only Pass A scope to the L;
* Geometry Pass C extends it again to Organic). All three have a real,
* deterministic principal axis -- the outline's own longer bounding-box
* span, exactly the rule `skimmerWall()` (walls.ts) already uses to decide
* which wall the skimmer run sits on, so "the principal axis" means the same
* thing everywhere it is asked: here, for the slope; in walls.ts, for the
* skimmer/ladder run; and in lighting.ts (via `skimmerWall`), for which wall
* the LED row faces. Custom (arbitrary-polygon) shapes have no single
* deterministic "principal axis" to slope along without guessing, and
* above-ground pools are shipped as constant-height modular kits, so both
* are kept flat regardless of `dimensions.floorProfile` -- `buildFloorProfile`
* normalises that itself rather than trusting every call site to remember
* the restriction.
*/
/** Shared shelf/flight dimensions; metres, not a pool-size-specific offset. */
function shelfStairDimensions(span, topY, floorY, minimumRun = 0, requestedRun) {
	const tread = .3;
	const shelfRun = Math.min(2.2, Math.max(1.2, span * .2), span - 2.4);
	for (let rises = 2; rises <= 16; rises++) {
		const riser = (topY - floorY) / rises;
		const run = (rises - 1) * tread;
		const landingRun = minimumRun ? SUN_SHELF_LOUNGER_LAYOUT.backPassage + .035 : 1.5 * tread;
		const requiredRun = Math.max(shelfRun, minimumRun, run + landingRun);
		const totalRun = requestedRun ?? requiredRun;
		if (Number.isFinite(totalRun) && totalRun >= requiredRun - 1e-7 && riser >= .15 && riser <= .24 && totalRun + 2.4 <= span + 1e-7) return {
			rises,
			riser,
			run,
			totalRun,
			tread
		};
	}
	return null;
}
/** Minimum shallow/deep elevation difference for a slope to be meaningful --
* guards against a near-zero-gradient "slope" that is really just numerical
* noise (no NaN, no zero-difference slope). */
const MIN_SLOPE_DIFFERENCE = .2;
/** Clamp a requested shallow depth into the range that keeps the slope real:
* never below the absolute minimum pool depth, never within
* `MIN_SLOPE_DIFFERENCE` of the deep depth. */
function clampShallowDepth(shallowDepth, depth, minDepth) {
	const maxAllowed = depth - MIN_SLOPE_DIFFERENCE;
	if (!Number.isFinite(shallowDepth)) return Math.max(minDepth, Math.min(maxAllowed, depth * .8));
	return Math.min(maxAllowed, Math.max(minDepth, shallowDepth));
}
function flatModel(deepFloorY) {
	return {
		sloped: false,
		deepFloorY,
		shallowFloorY: deepFloorY,
		elevationDrop: 0,
		axis: "x",
		shallowAtMin: true,
		axisMin: 0,
		axisMax: 0,
		shallowPoint: [0, 0],
		deepPoint: [0, 0],
		floorYAt: () => deepFloorY,
		depthAt: (_x, _z, waterY) => waterY - deepFloorY
	};
}
function buildFloorProfile(params) {
	const { outline, shape, poolType, dimensions, verticalLayout } = params;
	const deepFloorY = verticalLayout.floorY;
	if (!(dimensions.floorProfile === "slope" && (shape === "rectangle" || shape === "l-shape" || shape === "organic") && poolType === "in-ground" && Number.isFinite(dimensions.shallowDepth) && outline.length >= 4)) return flatModel(deepFloorY);
	const { minX, maxX, minZ, maxZ, spanX, spanZ } = outlineBounds(outline);
	const axis = spanX >= spanZ ? "x" : "z";
	const axisMin = axis === "x" ? minX : minZ;
	const axisMax = axis === "x" ? maxX : maxZ;
	const span = axisMax - axisMin;
	if (!Number.isFinite(axisMin) || !Number.isFinite(axisMax) || span < 1e-6) return flatModel(deepFloorY);
	const depth = Math.max(.01, dimensions.depth);
	const shallowFloorY = 0 - clampShallowDepth(Number.isFinite(dimensions.shallowDepth) ? dimensions.shallowDepth : depth, depth, .01);
	const elevationDrop = shallowFloorY - deepFloorY;
	if (!(elevationDrop > 0)) return flatModel(deepFloorY);
	let shallowAtMin = !dimensions.slopeReversed;
	const exclusion = params.infinityEdge ? infinityExclusion(outline, params.infinityEdge, shape) : null;
	if (params.sunShelf && exclusion?.axis === axis) shallowAtMin = Math.abs(exclusion.coordinate - axisMax) < .08;
	const flight = params.sunShelf && shape === "rectangle" && Math.min(spanX, spanZ) >= 2.4 ? shelfStairDimensions(span, verticalLayout.waterY - (params.twoLoungerShelf ? SUN_SHELF_WATER_DEPTH : .22), shallowFloorY, params.twoLoungerShelf ? SUN_SHELF_MIN_RUN : 0, params.twoLoungerShelf ? dimensions.sunShelfRun : void 0) : null;
	const end = (shallowAtMin ? axisMin : axisMax) + (shallowAtMin ? 1 : -1) * (flight?.totalRun ?? 0);
	const slopeStart = end + (shallowAtMin ? 1 : -1) * (flight?.tread ?? 0);
	const shelfZone = flight ? {
		end,
		slopeStart,
		atMin: shallowAtMin,
		flight
	} : void 0;
	const centreOfOtherAxis = outline.reduce((sum, point) => sum + (axis === "x" ? point[1] : point[0]), 0) / outline.length;
	const floorYAt = (x, z) => {
		const coordinate = axis === "x" ? x : z;
		const rampMin = shelfZone && shallowAtMin ? slopeStart : axisMin;
		const rampMax = shelfZone && !shallowAtMin ? slopeStart : axisMax;
		const t = Math.min(1, Math.max(0, (coordinate - rampMin) / (rampMax - rampMin)));
		const shallowFraction = shallowAtMin ? 1 - t : t;
		return deepFloorY + shallowFraction * elevationDrop;
	};
	const pointAt = (coordinate) => axis === "x" ? [coordinate, centreOfOtherAxis] : [centreOfOtherAxis, coordinate];
	return {
		sloped: true,
		...shelfZone ? { shelfZone } : {},
		deepFloorY,
		shallowFloorY,
		elevationDrop,
		axis,
		shallowAtMin,
		axisMin,
		axisMax,
		shallowPoint: pointAt(shallowAtMin ? axisMin : axisMax),
		deepPoint: pointAt(shallowAtMin ? axisMax : axisMin),
		floorYAt,
		depthAt: (x, z, waterY) => waterY - floorYAt(x, z)
	};
}
/** Clip at the actual profile hinge, so no triangle bridges two floor planes. */
function splitFloorOutline(outline, axis, cut) {
	const k = axis === "x" ? 0 : 1;
	return [-1, 1].map((sign) => {
		const result = [];
		outline.forEach((a, i) => {
			const b = outline[(i + 1) % outline.length];
			if (sign * (a[k] - cut) >= -1e-9) result.push([a[0], a[1]]);
			if ((a[k] - cut) * (b[k] - cut) < -1e-12) {
				const t = (cut - a[k]) / (b[k] - a[k]);
				result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
			}
		});
		return result;
	}).filter((piece) => piece.length >= 3);
}
//#endregion
//#region src/lib/pool/infinity-access.ts
/** Interior clearance from the disappearing edge for every access footprint. */
const INFINITY_ACCESS_CLEARANCE = .45;
function oppositeInfinityCoordinate(outline, exclusion) {
	const axis = exclusion.axis === "x" ? 0 : 1;
	const values = outline.map((point) => point[axis]);
	const min = Math.min(...values), max = Math.max(...values);
	return Math.abs(exclusion.coordinate - min) <= Math.abs(exclusion.coordinate - max) ? max : min;
}
function pointSegmentDistance(point, a, b) {
	const dx = b[0] - a[0], dz = b[1] - a[1];
	const lengthSquared = dx * dx + dz * dz;
	const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSquared)) : 0;
	return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz);
}
function segmentsIntersect(a, b, c, d) {
	const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
	const abC = cross(a, b, c), abD = cross(a, b, d);
	const cdA = cross(c, d, a), cdB = cross(c, d, b);
	return abC * abD <= 0 && cdA * cdB <= 0 && Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <= Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) && Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <= Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]));
}
/** Checks the whole polygon, including edges crossing a curved Infinity arc. */
function clearOfInfinityEdge(outline, exclusion, footprint) {
	if (!exclusion || footprint.length === 0) return true;
	const infinityEdges = exclusion.edgeIndices?.length ? exclusion.edgeIndices.map((index) => [outline[index], outline[(index + 1) % outline.length]]) : outline.map((a, index) => [a, outline[(index + 1) % outline.length]]).filter(([a, b]) => {
		const axis = exclusion.axis === "x" ? 0 : 1;
		return Math.abs(a[axis] - exclusion.coordinate) < 1e-6 && Math.abs(b[axis] - exclusion.coordinate) < 1e-6;
	});
	for (const [a, b] of infinityEdges) for (let index = 0; index < footprint.length; index++) {
		const c = footprint[index], d = footprint[(index + 1) % footprint.length];
		if (segmentsIntersect(a, b, c, d) || pointSegmentDistance(a, c, d) < .44999999 || pointSegmentDistance(b, c, d) < .44999999 || pointSegmentDistance(c, a, b) < .44999999 || pointSegmentDistance(d, a, b) < .44999999) return false;
	}
	return true;
}
//#endregion
//#region src/configurator/materials/visual-presets.ts
/** P1-B/P0 approved water baseline. Kept intact as the reversible fallback. */
const WATER_BASELINE_PRESET = {
	surfaceColor: "#ffffff",
	opacity: .29,
	roughness: .12,
	metalness: 0,
	transmission: .26,
	thickness: .035,
	ior: 1.333,
	clearcoat: .24,
	clearcoatRoughness: .3,
	reflectivity: .1,
	specularIntensity: .18,
	specularColor: "#e5f4f3",
	normalStrength: .016,
	attenuationColor: "#e8fffb",
	attenuationDistance: 1.8,
	absorption: [
		.36,
		.065,
		.025
	],
	scatteringColor: [
		.2,
		.72,
		.82
	],
	scatteringStrength: .5,
	maxOpticalPath: 3.5,
	caustics: {
		strength: .018,
		scale: 22,
		speed: .35
	},
	waves: {
		speed: [.0015, .001],
		drift: [.006, .005],
		driftFrequency: [.071, .053]
	},
	environmentIntensity: {
		day: .24,
		night: .15
	}
};
/** P1-C correction: stronger water cues without changing surface colour or opacity. */
const WATER_CONFIGURATION_PRESET = {
	...WATER_BASELINE_PRESET,
	opacity: .42,
	roughness: .095,
	transmission: .54,
	thickness: .06,
	clearcoat: .18,
	clearcoatRoughness: .22,
	reflectivity: .12,
	specularIntensity: .28,
	normalStrength: .012,
	attenuationDistance: 2.4,
	caustics: {
		strength: .016,
		scale: 18,
		speed: .28
	},
	waves: {
		speed: [.00115, 72e-5],
		drift: [.004, .0035],
		driftFrequency: [.061, .047]
	},
	environmentIntensity: {
		day: .34,
		night: .18
	},
	opacity: 1,
	transmission: 1,
	thickness: .32,
	roughness: .035,
	clearcoat: 0,
	clearcoatRoughness: .12,
	reflectivity: .5,
	specularIntensity: 1,
	normalStrength: .016,
	depthDensity: 1.08,
	scatteringContribution: .16,
	maxScatteringEnergy: .06,
	scatteringDepthStart: .18,
	causticVisibility: .75,
	caustics: {
		strength: .027,
		scale: 20,
		speed: .28
	},
	normals: {
		large: {
			scale: 1.65,
			strength: .08,
			rotation: .24
		},
		micro: {
			scale: 1.15,
			strength: .024,
			rotation: -.68
		}
	},
	waves: {
		speed: [.0013, 86e-5],
		drift: [.0045, .0038],
		driftFrequency: [.067, .051]
	},
	environmentIntensity: {
		day: .83,
		night: .28
	}
};
const WATER_QUALITY_PRESETS = {
	baseline: {
		...WATER_BASELINE_PRESET,
		depthDensity: 1,
		scatteringContribution: 1,
		maxScatteringEnergy: 1,
		scatteringDepthStart: 0,
		causticVisibility: 1,
		normals: {
			large: {
				scale: 1,
				strength: WATER_BASELINE_PRESET.normalStrength,
				rotation: 0
			},
			micro: {
				scale: 1,
				strength: 0,
				rotation: 0
			}
		}
	},
	configuration: WATER_CONFIGURATION_PRESET,
	experience: WATER_CONFIGURATION_PRESET
};
/** Internal one-line fallback; intentionally not exposed in the configurator UI. */
const ACTIVE_WATER_RENDERING = "premium";
const selectWaterPreset = (mode) => mode === "legacy" ? WATER_QUALITY_PRESETS.baseline : WATER_QUALITY_PRESETS.configuration;
selectWaterPreset(ACTIVE_WATER_RENDERING);
/** Fixed presentation border; coping choices remain quotation-only options. */
const POOL_BORDER_PRESET = {
	color: "#cbc7bf",
	roughness: .62,
	thickness: .055
};
//#endregion
//#region src/lib/pool/sun-shelf-loungers.ts
const EPSILON = 1e-7;
function bounds(points) {
	return {
		minX: Math.min(...points.map(([x]) => x)),
		maxX: Math.max(...points.map(([x]) => x)),
		minZ: Math.min(...points.map(([, z]) => z)),
		maxZ: Math.max(...points.map(([, z]) => z))
	};
}
function rectangle(rect) {
	return [
		[rect.minX, rect.minZ],
		[rect.maxX, rect.minZ],
		[rect.maxX, rect.maxZ],
		[rect.minX, rect.maxZ]
	];
}
function inset(rect, margin) {
	return {
		minX: rect.minX + margin,
		maxX: rect.maxX - margin,
		minZ: rect.minZ + margin,
		maxZ: rect.maxZ - margin
	};
}
function isRectangle(points, rect) {
	if (points.length !== 4 || points.some((point) => point.some((value) => !Number.isFinite(value)))) return false;
	return rectangle(rect).every(([x, z]) => points.some(([px, pz]) => Math.abs(px - x) < EPSILON && Math.abs(pz - z) < EPSILON));
}
/** Pure derived layout shared by controls, renderer and exports. Never persists
* placements or scales furniture to fit a changed pool dimension. */
function resolveSunShelfLoungers({ comfort, outline, waterY, enabled = false, quantity, accessFootprints = [], infinityExcluded = null }) {
	const unavailable = (reason) => ({
		available: false,
		enabled: false,
		capacity: 0,
		count: 0,
		adjusted: false,
		reason,
		placements: []
	});
	const shelf = comfort.elements.find((element) => element.kind === "sunShelf");
	if (!shelf) return unavailable("Richiede una Sun Shelf disponibile.");
	if (!Number.isFinite(waterY) || !Number.isFinite(shelf.topY) || waterY - shelf.topY <= 0 || waterY - shelf.topY > SUN_SHELF_LOUNGER_MODEL.maxWaterDepth + EPSILON) return unavailable("Questo lettino immerso richiede una piattaforma piana con acqua fino a 20 cm e zavorramento secondo il produttore.");
	const shelfBounds = bounds(shelf.footprint);
	if (!isRectangle(shelf.footprint, shelfBounds) || outline.length < 3 || outline.some((point) => point.some((value) => !Number.isFinite(value)))) return unavailable("Piattaforma rettangolare regolare necessaria per verificare gli ingombri.");
	const pool = bounds(outline);
	const alongX = pool.maxX - pool.minX >= pool.maxZ - pool.minZ;
	const atMin = alongX ? shelfBounds.minX + shelfBounds.maxX < pool.minX + pool.maxX : shelfBounds.minZ + shelfBounds.maxZ < pool.minZ + pool.maxZ;
	const rotation = alongX ? atMin ? Math.PI / 2 : -Math.PI / 2 : atMin ? 0 : Math.PI;
	const landing = shelf.landing && bounds(shelf.landing.footprint);
	const passageWidth = landing && (alongX ? landing.maxZ - landing.minZ : landing.maxX - landing.minX);
	const landingRun = landing && (alongX ? landing.maxX - landing.minX : landing.maxZ - landing.minZ);
	if (!passageWidth || !landingRun || passageWidth < SUN_SHELF_LOUNGER_LAYOUT.minimumAccessWidth - EPSILON || landingRun < SUN_SHELF_LOUNGER_LAYOUT.backPassage - EPSILON) return unavailable("Passaggio di accesso alla spiaggetta insufficiente: richiesti almeno 90 cm liberi.");
	const obstacles = [
		...(shelf.steps ?? []).map((step) => step.footprint),
		...shelf.landing ? [shelf.landing.footprint] : [],
		...comfort.elements.filter((element) => element !== shelf).flatMap((element) => [
			element.footprint,
			...(element.steps ?? []).map((step) => step.footprint),
			...element.landing ? [element.landing.footprint] : []
		]),
		...accessFootprints
	].filter((footprint) => footprint.length >= 3).map((footprint) => inset(bounds(footprint), -SUN_SHELF_LOUNGER_LAYOUT.accessBuffer));
	const safe = inset(shelfBounds, SUN_SHELF_LOUNGER_LAYOUT.edgeInset);
	if (alongX) {
		if (atMin) safe.minX = shelfBounds.minX + SUN_SHELF_LOUNGER_LAYOUT.backPassage;
		else safe.maxX = shelfBounds.maxX - SUN_SHELF_LOUNGER_LAYOUT.backPassage;
	} else if (atMin) safe.minZ = shelfBounds.minZ + SUN_SHELF_LOUNGER_LAYOUT.backPassage;
	else safe.maxZ = shelfBounds.maxZ - SUN_SHELF_LOUNGER_LAYOUT.backPassage;
	const route = {
		minX: Math.min(shelfBounds.minX, landing.minX),
		maxX: Math.max(shelfBounds.maxX, landing.maxX),
		minZ: Math.min(shelfBounds.minZ, landing.minZ),
		maxZ: Math.max(shelfBounds.maxZ, landing.maxZ)
	};
	if (alongX) {
		if (atMin) route.maxX = route.minX + SUN_SHELF_LOUNGER_LAYOUT.backPassage;
		else route.minX = route.maxX - SUN_SHELF_LOUNGER_LAYOUT.backPassage;
	} else if (atMin) route.maxZ = route.minZ + SUN_SHELF_LOUNGER_LAYOUT.backPassage;
	else route.minZ = route.maxZ - SUN_SHELF_LOUNGER_LAYOUT.backPassage;
	const { length, width } = SUN_SHELF_LOUNGER_MODEL;
	const { between } = SUN_SHELF_LOUNGER_LAYOUT;
	const start = alongX ? safe.minX : safe.minZ, end = alongX ? safe.maxX : safe.maxZ;
	const alongStart = atMin ? start : end - length, alongEnd = alongStart + length;
	let free = end - start >= length - EPSILON ? [[alongX ? safe.minZ : safe.minX, alongX ? safe.maxZ : safe.maxX]] : [];
	for (const obstacle of obstacles) {
		const oStart = alongX ? obstacle.minX : obstacle.minZ, oEnd = alongX ? obstacle.maxX : obstacle.maxZ;
		if (oStart >= alongEnd - EPSILON || oEnd <= alongStart + EPSILON) continue;
		const cStart = alongX ? obstacle.minZ : obstacle.minX, cEnd = alongX ? obstacle.maxZ : obstacle.maxX;
		free = free.flatMap(([a, b]) => {
			if (cStart >= b - EPSILON || cEnd <= a + EPSILON) return [[a, b]];
			return [[a, Math.max(a, cStart)], [Math.min(b, cEnd), b]].filter(([lo, hi]) => hi - lo > EPSILON);
		});
	}
	const candidates = [];
	for (const [crossStart, crossEnd] of free) {
		const count = Math.floor((crossEnd - crossStart + between + EPSILON) / (width + between));
		const occupiedWidth = count * width + Math.max(0, count - 1) * between;
		const first = (crossStart + crossEnd - occupiedWidth + width) / 2;
		const along = (alongStart + alongEnd) / 2;
		for (let index = 0; index < count; index++) {
			const cross = first + index * (width + between);
			const x = alongX ? along : cross, z = alongX ? cross : along;
			const footprint = rectangle({
				minX: x - (alongX ? length : width) / 2,
				maxX: x + (alongX ? length : width) / 2,
				minZ: z - (alongX ? width : length) / 2,
				maxZ: z + (alongX ? width : length) / 2
			});
			if (clearOfInfinityEdge(outline, infinityExcluded, footprint)) candidates.push({
				x,
				y: shelf.topY,
				z,
				rotation,
				footprint
			});
		}
	}
	if (candidates.length < SUN_SHELF_LOUNGER_LAYOUT.minimumCapacity) return unavailable("Spazio insufficiente per due lettini da 185 × 73 cm con margini di 25 cm e accesso libero.");
	candidates.sort((a, b) => {
		const center = alongX ? (shelfBounds.minZ + shelfBounds.maxZ) / 2 : (shelfBounds.minX + shelfBounds.maxX) / 2;
		return Math.abs((alongX ? a.z : a.x) - center) - Math.abs((alongX ? b.z : b.x) - center) || a.x - b.x || a.z - b.z;
	});
	const requested = quantity !== void 0 && Number.isFinite(quantity) ? Math.max(1, Math.trunc(quantity)) : candidates.length;
	const adjusted = enabled && requested > candidates.length;
	const count = enabled && !adjusted ? requested : 0;
	return {
		available: true,
		enabled: count > 0,
		capacity: candidates.length,
		count,
		adjusted,
		...adjusted ? { reason: "Quantità lettini non compatibile con lo spazio attuale. Riduci la quantità o ripristina le dimensioni." } : {},
		placements: candidates.slice(0, count),
		passage: rectangle(route)
	};
}
/** Reconstruct from the same comfort/access geometry used by the pool scene. */
function configuredSunShelfLoungers(config) {
	const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
	const resolved = configuredPoolLayout(config);
	const layout = getPoolVerticalLayout({
		poolType: config.poolType ?? "in-ground",
		system: config.system,
		overflowType: config.overflowType,
		depth: config.dimensions.depth,
		copingThickness: POOL_BORDER_PRESET.thickness
	});
	return resolveSunShelfLoungers({
		comfort: resolved.comfort,
		outline,
		waterY: layout.waterY,
		enabled: config.features.some((feature) => feature === "sunShelfLoungers"),
		quantity: config.sunShelfLoungerCount,
		accessFootprints: [...resolved.access.placement ? [resolved.access.footprint] : [], ...resolved.ladder?.plan.placement ? [resolved.ladder.plan.footprint] : []],
		infinityExcluded: config.system === "infinity" && config.infinityEdge ? infinityExclusion(outline, config.infinityEdge, config.shape) : null
	});
}
//#endregion
//#region src/lib/pool/comfort-plan.ts
/** Real in-pool spa dimensions (metres), read from the reference: a sunken
* tub beside the straight flight, a divider wall towards the stairs and, in the
* closed variant, a front wall. The open variant adds the opposite short seat,
* forming a U while leaving the volume visually open to the main pool. */
const HYDRO_DIMENSIONS = {
	partitionThickness: .2,
	lipThickness: .15,
	/** One shared top for divider and front wall: no step where they meet. */
	wallWaterDepth: .1,
	benchDepth: .45,
	seatWaterDepth: .45,
	tubWaterDepth: .95,
	minInteriorWidth: 1.2,
	minLegroom: .5,
	minSeatHeight: .35,
	jetSpacing: .5,
	jetAboveSeat: .22,
	jetDiameter: .06,
	/** LED micro-spots in the seat front face, this far below the seat edge. */
	spotBelowSeat: .12,
	spotSpacing: .6,
	spotDiameter: .035,
	/** Solids run this far into the wall so no seam can open at the tile line. */
	wallOverlap: .01
};
const CLEARANCE = .3;
const EDGE_INSET = .035;
function rectOutline(rect) {
	return [
		[rect.minX, rect.minZ],
		[rect.maxX, rect.minZ],
		[rect.maxX, rect.maxZ],
		[rect.minX, rect.maxZ]
	];
}
function boundsOf(outline) {
	const b = outlineBounds(outline);
	return {
		minX: b.minX,
		maxX: b.maxX,
		minZ: b.minZ,
		maxZ: b.maxZ
	};
}
function expanded(rect, amount) {
	return {
		minX: rect.minX - amount,
		maxX: rect.maxX + amount,
		minZ: rect.minZ - amount,
		maxZ: rect.maxZ + amount
	};
}
function overlaps(a, b) {
	return !(a.maxX <= b.minX || a.minX >= b.maxX || a.maxZ <= b.minZ || a.minZ >= b.maxZ);
}
function excludedWall(exclusion, axis, coordinate) {
	return !!exclusion && exclusion.axis === axis && Math.abs(exclusion.coordinate - coordinate) < .08;
}
function elementVolume(element, floor) {
	if (floor.shelfZone) return splitFloorOutline(element.footprint, floor.axis, floor.shelfZone.slopeStart).reduce((sum, piece) => {
		const [x, z] = outlineCentroid(piece);
		return sum + outlineArea(piece) * Math.max(0, element.topY - floor.floorYAt(x, z));
	}, 0);
	const rect = boundsOf(element.footprint);
	const x = (rect.minX + rect.maxX) / 2;
	const z = (rect.minZ + rect.maxZ) / 2;
	return Math.max(0, (rect.maxX - rect.minX) * (rect.maxZ - rect.minZ) * (element.topY - floor.floorYAt(x, z)));
}
/** One deterministic plan drives selectors, geometry and hydraulic volume. */
function resolveComfortPlan({ outline, shape, poolType, system, floorProfile, waterY, enabled, accessFootprint = [], infinityExcluded = null, infinityWallType = "traditional", hydromassageVariant = "closed", separateHydroAccess = false, nominalWidth, sunShelfRun }) {
	const unsupported = poolType !== "in-ground" ? "Disponibile per piscine interrate." : shape !== "rectangle" ? "Disponibile per la forma rettangolare in questa versione." : null;
	const unavailable = {
		sunShelf: {
			available: false,
			...unsupported ? { reason: unsupported } : {}
		},
		integratedBench: {
			available: false,
			...unsupported ? { reason: unsupported } : {}
		},
		hydromassage: {
			available: false,
			...unsupported ? { reason: unsupported } : {}
		}
	};
	if (unsupported) return {
		elements: [],
		availability: unavailable,
		displacedVolume: 0
	};
	const bounds = boundsOf(outline);
	const spanX = bounds.maxX - bounds.minX;
	const spanZ = bounds.maxZ - bounds.minZ;
	const longX = spanX >= spanZ;
	const shortSpan = longX ? spanZ : spanX;
	const longSpan = longX ? spanX : spanZ;
	if (shortSpan < 2.4 || longSpan < 4.8) {
		const reason = "Spazio insufficiente per mantenere passaggi e proporzioni reali.";
		return {
			elements: [],
			availability: {
				sunShelf: {
					available: false,
					reason
				},
				integratedBench: {
					available: false,
					reason
				},
				hydromassage: {
					available: false,
					reason
				}
			},
			displacedVolume: 0
		};
	}
	const accessRect = accessFootprint.length >= 3 ? expanded(boundsOf(accessFootprint), CLEARANCE) : null;
	const selectedRects = [];
	const elements = [];
	const availability = {
		sunShelf: { available: true },
		integratedBench: { available: true },
		hydromassage: { available: true }
	};
	const wantsShelf = enabled.includes("sunShelf");
	const wantsHydro = enabled.includes("hydromassage") && !wantsShelf;
	const crossAxis = longX ? "z" : "x";
	const crossMin = longX ? bounds.minZ : bounds.minX;
	const crossMax = longX ? bounds.maxZ : bounds.maxX;
	const infinityAtCrossMin = excludedWall(infinityExcluded, crossAxis, crossMin);
	const infinityAtCrossMax = excludedWall(infinityExcluded, crossAxis, crossMax);
	const safeCrossMin = infinityAtCrossMin ? crossMin + INFINITY_ACCESS_CLEARANCE + HYDRO_DIMENSIONS.wallOverlap : crossMin + EDGE_INSET;
	const safeCrossMax = infinityAtCrossMax ? crossMax - INFINITY_ACCESS_CLEARANCE - HYDRO_DIMENSIONS.wallOverlap : crossMax - EDGE_INSET;
	const valid = (rect, wallAxis, wallCoordinate) => !excludedWall(infinityExcluded, wallAxis, wallCoordinate) && (!accessRect || !overlaps(expanded(rect, CLEARANCE), accessRect)) && !selectedRects.some((other) => overlaps(expanded(rect, .15), other));
	const shelfRun = Math.min(2.2, Math.max(1.2, longSpan * .2), longSpan - 2.4);
	const shelfCandidates = longX ? [{
		rect: {
			minX: bounds.minX + EDGE_INSET,
			maxX: bounds.minX + shelfRun,
			minZ: safeCrossMin,
			maxZ: safeCrossMax
		},
		axis: "x",
		coordinate: bounds.minX
	}, {
		rect: {
			minX: bounds.maxX - shelfRun,
			maxX: bounds.maxX - EDGE_INSET,
			minZ: safeCrossMin,
			maxZ: safeCrossMax
		},
		axis: "x",
		coordinate: bounds.maxX
	}] : [{
		rect: {
			minX: safeCrossMin,
			maxX: safeCrossMax,
			minZ: bounds.minZ + EDGE_INSET,
			maxZ: bounds.minZ + shelfRun
		},
		axis: "z",
		coordinate: bounds.minZ
	}, {
		rect: {
			minX: safeCrossMin,
			maxX: safeCrossMax,
			minZ: bounds.maxZ - shelfRun,
			maxZ: bounds.maxZ - EDGE_INSET
		},
		axis: "z",
		coordinate: bounds.maxZ
	}];
	const stairWidth = Math.min(1.2, shortSpan - 1.2);
	const withSteps = (candidate, minimumRun) => {
		if ((infinityAtCrossMin || infinityAtCrossMax) && safeCrossMax - safeCrossMin < stairWidth + 1.2) return null;
		const positive = candidate.coordinate === (longX ? bounds.minX : bounds.minZ);
		const zone = floorProfile.shelfZone;
		if (zone && positive !== zone.atMin) return null;
		const direction = positive ? 1 : -1;
		const crossMin = longX ? candidate.rect.minZ : candidate.rect.minX;
		const crossMax = longX ? candidate.rect.maxZ : candidate.rect.maxX;
		const stairAtMin = !excludedWall(infinityExcluded, longX ? "z" : "x", longX ? bounds.minZ : bounds.minX);
		const center = stairAtMin ? crossMin + stairWidth / 2 : crossMax - stairWidth / 2;
		const topY = waterY - (minimumRun ? SUN_SHELF_WATER_DEPTH : .22);
		for (let rises = 2; rises <= 16; rises++) {
			if (zone && rises !== zone.flight.rises) continue;
			const run = (rises - 1) * .3;
			const landingRun = minimumRun ? SUN_SHELF_LOUNGER_LAYOUT.backPassage + EDGE_INSET : .45;
			const requiredRun = Math.max(shelfRun, minimumRun, run + landingRun);
			const totalRun = minimumRun && sunShelfRun !== void 0 ? sunShelfRun : zone?.flight.totalRun ?? requiredRun;
			if (!Number.isFinite(totalRun) || totalRun < requiredRun - 1e-7) continue;
			if (totalRun + 2.4 > longSpan + 1e-7) continue;
			const end = candidate.coordinate + direction * totalRun;
			const start = end - direction * run;
			const riser = (topY - (longX ? floorProfile.floorYAt(end, center) : floorProfile.floorYAt(center, end))) / rises;
			if (riser < .15 || riser > .24) continue;
			const steps = Array.from({ length: rises - 1 }, (_, index) => {
				const a = start + direction * index * .3;
				const b = start + direction * (index + 1) * .3;
				return {
					footprint: rectOutline(longX ? {
						minX: Math.min(a, b),
						maxX: Math.max(a, b),
						minZ: center - stairWidth / 2,
						maxZ: center + stairWidth / 2
					} : {
						minX: center - stairWidth / 2,
						maxX: center + stairWidth / 2,
						minZ: Math.min(a, b),
						maxZ: Math.max(a, b)
					}),
					topY: topY - (index + 1) * riser
				};
			});
			if (steps.some((step) => step.footprint.some(([x, z]) => step.topY <= floorProfile.floorYAt(x, z) + .01))) continue;
			const flight = boundsOf(steps.flatMap((step) => [...step.footprint]));
			if (!valid(flight, candidate.axis, candidate.coordinate) || !clearOfInfinityEdge(outline, infinityExcluded, rectOutline(flight))) continue;
			const back = candidate.coordinate + direction * EDGE_INSET;
			const whole = longX ? {
				...candidate.rect,
				minX: Math.min(back, end),
				maxX: Math.max(back, end)
			} : {
				...candidate.rect,
				minZ: Math.min(back, end),
				maxZ: Math.max(back, end)
			};
			if (!valid(whole, candidate.axis, candidate.coordinate) || !clearOfInfinityEdge(outline, infinityExcluded, rectOutline(whole))) continue;
			const rect = longX ? {
				...whole,
				minZ: stairAtMin ? flight.maxZ : whole.minZ,
				maxZ: stairAtMin ? whole.maxZ : flight.minZ
			} : {
				...whole,
				minX: stairAtMin ? flight.maxX : whole.minX,
				maxX: stairAtMin ? whole.maxX : flight.minX
			};
			const landing = {
				topY,
				footprint: rectOutline(longX ? {
					minX: Math.min(back, start),
					maxX: Math.max(back, start),
					minZ: flight.minZ,
					maxZ: flight.maxZ
				} : {
					minX: flight.minX,
					maxX: flight.maxX,
					minZ: Math.min(back, start),
					maxZ: Math.max(back, start)
				})
			};
			return {
				...candidate,
				rect,
				steps,
				riser,
				flight,
				landing,
				totalRun
			};
		}
		return null;
	};
	const flightCandidate = (minimumRun) => shelfCandidates.filter((candidate) => valid(candidate.rect, candidate.axis, candidate.coordinate) && clearOfInfinityEdge(outline, infinityExcluded, rectOutline(candidate.rect))).map((candidate) => withSteps(candidate, minimumRun)).find((candidate) => candidate !== null);
	const shelf = flightCandidate(SUN_SHELF_MIN_RUN);
	if (!shelf) availability.sunShelf = {
		available: false,
		reason: sunShelfRun !== void 0 ? "Lunghezza della spiaggetta non compatibile con gradini, accessi e spazio residuo. Modifica la misura o ripristina le dimensioni della piscina." : "Nessuna testata libera da scala, accessi o bordo Infinity."
	};
	else {
		const rect = shelf.rect;
		const joinShell = (points) => system !== "infinity" ? points : points.map(([x, z]) => {
			const snap = (v, min, max) => Math.abs(v - (min + EDGE_INSET)) < 1e-6 ? min : Math.abs(v - (max - EDGE_INSET)) < 1e-6 ? max : v;
			return [snap(x, bounds.minX, bounds.maxX), snap(z, bounds.minZ, bounds.maxZ)];
		});
		const element = {
			kind: "sunShelf",
			footprint: joinShell(rectOutline(rect)),
			topY: waterY - SUN_SHELF_WATER_DEPTH,
			waterDepth: SUN_SHELF_WATER_DEPTH,
			width: longX ? rect.maxZ - rect.minZ : rect.maxX - rect.minX,
			run: shelf.totalRun,
			steps: shelf.steps.map((step) => ({
				...step,
				footprint: joinShell(step.footprint)
			})),
			riser: shelf.riser,
			landing: {
				...shelf.landing,
				footprint: joinShell(shelf.landing.footprint)
			}
		};
		const loungers = resolveSunShelfLoungers({
			comfort: {
				elements: [element],
				availability,
				displacedVolume: 0
			},
			outline,
			waterY,
			infinityExcluded,
			accessFootprints: accessFootprint.length >= 3 ? [accessFootprint] : []
		});
		if (!loungers.available) availability.sunShelf = {
			available: false,
			reason: loungers.reason ?? "Non disponibile per questa configurazione."
		};
		else if (wantsShelf) {
			elements.push(element);
			selectedRects.push(rect);
			selectedRects.push(shelf.flight);
			selectedRects.push(boundsOf(shelf.landing.footprint));
		}
	}
	{
		const shelf = flightCandidate(0);
		if ((nominalWidth ?? shortSpan) <= 3) availability.hydromassage = {
			available: false,
			reason: "L’idromassaggio integrato richiede una larghezza nominale superiore a 3,00 m e spazio utile compatibile."
		};
		else if (!shelf) availability.hydromassage = {
			available: false,
			reason: "Nessuna testata libera per scala rettilinea e vasca idromassaggio."
		};
		else {
			const H = HYDRO_DIMENSIONS;
			const direction = shelf.coordinate === (longX ? bounds.minX : bounds.minZ) ? 1 : -1;
			const flightMin = longX ? shelf.flight.minZ : shelf.flight.minX;
			const flightMax = longX ? shelf.flight.maxZ : shelf.flight.maxX;
			const wallMin = longX ? bounds.minZ : bounds.minX;
			const wallMax = longX ? bounds.maxZ : bounds.maxX;
			const flightAtMin = Math.abs(flightMin - (wallMin + EDGE_INSET)) < 1e-6;
			const side = flightAtMin ? 1 : -1;
			const partition0 = flightAtMin ? flightMax : flightMin;
			const inner = partition0 + side * H.partitionThickness;
			const outerPoolWall = flightAtMin ? wallMax : wallMin;
			const outerIsInfinity = excludedWall(infinityExcluded, crossAxis, outerPoolWall);
			const outerWall = outerPoolWall;
			const outer = outerWall + (outerIsInfinity ? 0 : side * H.wallOverlap);
			const end = shelf.totalRun;
			const lip = end - H.lipThickness;
			const box = (a0, a1, c0, c1) => {
				const p = shelf.coordinate + direction * a0, q = shelf.coordinate + direction * a1;
				return longX ? {
					minX: Math.min(p, q),
					maxX: Math.max(p, q),
					minZ: Math.min(c0, c1),
					maxZ: Math.max(c0, c1)
				} : {
					minX: Math.min(c0, c1),
					maxX: Math.max(c0, c1),
					minZ: Math.min(p, q),
					maxZ: Math.max(p, q)
				};
			};
			const back = -H.wallOverlap;
			const seatBack = outerWall;
			const benchInner = seatBack - side * H.benchDepth;
			const interiorWidth = Math.abs(seatBack - inner);
			const seatTop = waterY - H.seatWaterDepth;
			const whole = box(back, end, partition0, outer);
			const corners = rectOutline(whole);
			const floorUnder = Math.max(...corners.map(([x, z]) => floorProfile.floorYAt(x, z)));
			const tubFloor = waterY - H.tubWaterDepth;
			const raisedFloor = tubFloor > floorUnder + .05;
			if (!outerIsInfinity && !clearOfInfinityEdge(outline, infinityExcluded, rectOutline(whole))) availability.hydromassage = {
				available: false,
				reason: "Spazio insufficiente per tenere la vasca lontana dal bordo Infinity."
			};
			else if (interiorWidth < H.minInteriorWidth || lip - H.benchDepth < H.minLegroom) availability.hydromassage = {
				available: false,
				reason: "Spazio insufficiente per vasca, panca e scala rettilinea con misure ergonomiche."
			};
			else if (seatTop - Math.max(floorUnder, tubFloor) < H.minSeatHeight) availability.hydromassage = {
				available: false,
				reason: "Profondità insufficiente per una seduta sommersa reale."
			};
			else if (wantsHydro) {
				const frontWall = hydromassageVariant === "closed";
				const front = frontWall ? lip : end;
				const innerBenchEdge = inner + side * H.benchDepth;
				const clearGlassSide = outerIsInfinity && infinityWallType === "glass";
				const outerSeat = !clearGlassSide;
				const innerSeat = !frontWall || clearGlassSide;
				const tubInner = innerSeat ? innerBenchEdge : inner;
				const tubOuter = outerSeat ? benchInner : seatBack;
				const wallTop = system === "infinity" ? infinityCrestY(waterY) : waterY - H.wallWaterDepth;
				const tiers = [
					{
						role: "divider",
						footprint: rectOutline(box(back, end, partition0, inner)),
						topY: wallTop
					},
					...frontWall ? [{
						role: "frontWall",
						footprint: rectOutline(box(lip, end, inner, outerIsInfinity ? seatBack : outer)),
						topY: wallTop
					}] : [],
					{
						role: "backSeat",
						footprint: rectOutline(box(back, H.benchDepth, inner, outerIsInfinity ? seatBack : outer)),
						topY: seatTop
					},
					...outerSeat ? [{
						role: "sideSeat",
						footprint: rectOutline(box(H.benchDepth, front, benchInner, outerIsInfinity ? seatBack : outer)),
						topY: seatTop
					}] : [],
					...innerSeat ? [{
						role: "innerSideSeat",
						footprint: rectOutline(box(H.benchDepth, front, inner, innerBenchEdge)),
						topY: seatTop
					}] : [],
					...raisedFloor ? [{
						role: "tubFloor",
						footprint: rectOutline(box(H.benchDepth, front, tubInner, tubOuter)),
						topY: tubFloor
					}] : []
				];
				const toWalls = (outline) => outline.map(([x, z]) => {
					const snap = (v, min, max) => Math.abs(v - (min + EDGE_INSET)) < 1e-6 ? min - H.wallOverlap : Math.abs(v - (max - EDGE_INSET)) < 1e-6 ? max + H.wallOverlap : v;
					return [snap(x, bounds.minX, bounds.maxX), snap(z, bounds.minZ, bounds.maxZ)];
				});
				const jetY = Math.min(seatTop + H.jetAboveSeat, wallTop - H.jetDiameter / 2 - .01);
				const spaced = (from, to) => {
					const count = Math.max(1, Math.floor(Math.abs(to - from) / H.jetSpacing) + 1);
					const step = count > 1 ? (to - from) / (count - 1) : 0;
					return Array.from({ length: count }, (_, i) => count > 1 ? from + i * step : (from + to) / 2);
				};
				const point = (a, c) => longX ? {
					x: shelf.coordinate + direction * a,
					z: c
				} : {
					x: c,
					z: shelf.coordinate + direction * a
				};
				const headDir = longX ? [direction, 0] : [0, direction];
				const sideDir = longX ? [0, -side] : [-side, 0];
				const innerSideDir = longX ? [0, side] : [side, 0];
				const headStart = clearGlassSide ? innerBenchEdge : inner;
				const headEnd = clearGlassSide ? seatBack : benchInner;
				const jets = [
					...spaced(headStart + side * .3, headEnd - side * .25).map((c) => ({
						...point(0, c),
						y: jetY,
						dir: headDir
					})),
					...outerSeat ? spaced(H.benchDepth + .3, front - .25).map((a) => ({
						...point(a, seatBack),
						y: jetY,
						dir: sideDir
					})) : [],
					...innerSeat ? spaced(H.benchDepth + .3, front - .25).map((a) => ({
						...point(a, inner),
						y: jetY,
						dir: innerSideDir
					})) : []
				];
				const spotY = seatTop - H.spotBelowSeat;
				const spotsAlong = (from, to) => [(from + to) / 2];
				const backFrontDir = longX ? [direction, 0] : [0, direction];
				const spots = [
					...spotsAlong(headStart + side * .25, headEnd - side * .25).map((c) => ({
						...point(H.benchDepth, c),
						y: spotY,
						dir: backFrontDir
					})),
					...outerSeat ? spotsAlong(H.benchDepth + .25, front - .25).map((a) => ({
						...point(a, benchInner),
						y: spotY,
						dir: sideDir
					})) : [],
					...innerSeat ? spotsAlong(H.benchDepth + .25, front - .25).map((a) => ({
						...point(a, innerBenchEdge),
						y: spotY,
						dir: innerSideDir
					})) : []
				];
				elements.push({
					kind: "hydromassage",
					footprint: rectOutline(whole),
					topY: wallTop,
					waterDepth: H.seatWaterDepth,
					width: interiorWidth,
					run: end,
					...!separateHydroAccess ? {
						steps: shelf.steps.map((step) => ({
							...step,
							footprint: toWalls(step.footprint)
						})),
						riser: shelf.riser,
						landing: {
							...shelf.landing,
							footprint: toWalls(shelf.landing.footprint)
						}
					} : {},
					tiers,
					jets,
					spots
				});
				selectedRects.push(whole, shelf.flight, boundsOf(shelf.landing.footprint));
			}
		}
	}
	const benchLength = Math.min(3, Math.max(1.5, longSpan * .36));
	const half = benchLength / 2;
	const benchProjection = .5;
	const benchCandidates = longX ? [{
		rect: {
			minX: -half,
			maxX: half,
			minZ: bounds.minZ + EDGE_INSET,
			maxZ: bounds.minZ + EDGE_INSET + benchProjection
		},
		axis: "z",
		coordinate: bounds.minZ
	}, {
		rect: {
			minX: -half,
			maxX: half,
			minZ: bounds.maxZ - EDGE_INSET - benchProjection,
			maxZ: bounds.maxZ - EDGE_INSET
		},
		axis: "z",
		coordinate: bounds.maxZ
	}] : [{
		rect: {
			minX: bounds.minX + EDGE_INSET,
			maxX: bounds.minX + EDGE_INSET + benchProjection,
			minZ: -half,
			maxZ: half
		},
		axis: "x",
		coordinate: bounds.minX
	}, {
		rect: {
			minX: bounds.maxX - EDGE_INSET - benchProjection,
			maxX: bounds.maxX - EDGE_INSET,
			minZ: -half,
			maxZ: half
		},
		axis: "x",
		coordinate: bounds.maxX
	}];
	const benchOptions = [...benchCandidates];
	for (const length of [
		benchLength,
		Math.min(benchLength, 2),
		1.5
	]) {
		const low = (longX ? bounds.minX : bounds.minZ) + EDGE_INSET + length / 2;
		const high = (longX ? bounds.maxX : bounds.maxZ) - EDGE_INSET - length / 2;
		for (const fraction of [
			.5,
			.75,
			.25,
			1,
			0
		]) {
			const centre = low + (high - low) * fraction;
			for (const candidate of benchCandidates) benchOptions.push({
				...candidate,
				rect: longX ? {
					...candidate.rect,
					minX: centre - length / 2,
					maxX: centre + length / 2
				} : {
					...candidate.rect,
					minZ: centre - length / 2,
					maxZ: centre + length / 2
				}
			});
		}
	}
	const bench = benchOptions.find((candidate) => valid(candidate.rect, candidate.axis, candidate.coordinate));
	if (!bench) availability.integratedBench = {
		available: false,
		reason: "Nessuna parete lunga libera da scala, solarium o bordo Infinity."
	};
	else if (enabled.includes("integratedBench")) {
		const rect = bench.rect;
		const element = {
			kind: "integratedBench",
			footprint: rectOutline(rect),
			topY: waterY - .48,
			waterDepth: .48,
			width: benchProjection,
			run: longX ? rect.maxX - rect.minX : rect.maxZ - rect.minZ
		};
		elements.push(element);
		selectedRects.push(rect);
	}
	return {
		adjusted: !!bench && enabled.includes("integratedBench") && !benchCandidates.includes(bench),
		elements,
		availability,
		displacedVolume: elements.reduce((sum, element) => sum + (element.tiers ?? [element]).reduce((v, tier) => v + elementVolume({
			...element,
			...tier
		}, floorProfile), 0) + [...element.steps ?? [], ...element.landing ? [element.landing] : []].reduce((volume, step) => volume + elementVolume({
			...element,
			...step
		}, floorProfile), 0), 0)
	};
}
//#endregion
//#region ../2026-09-14/rendi-la-immagine-1-piu-relistica-4/pool-shaper-build2-recovered-20261010/node_modules/react/cjs/react-jsx-runtime.production.js
/**
* @license React
* react-jsx-runtime.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_jsx_runtime_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
	var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
	function jsxProd(type, config, maybeKey) {
		var key = null;
		void 0 !== maybeKey && (key = "" + maybeKey);
		void 0 !== config.key && (key = "" + config.key);
		if ("key" in config) {
			maybeKey = {};
			for (var propName in config) "key" !== propName && (maybeKey[propName] = config[propName]);
		} else maybeKey = config;
		config = maybeKey.ref;
		return {
			$$typeof: REACT_ELEMENT_TYPE,
			type,
			key,
			ref: void 0 !== config ? config : null,
			props: maybeKey
		};
	}
	exports.Fragment = REACT_FRAGMENT_TYPE;
	exports.jsx = jsxProd;
	exports.jsxs = jsxProd;
}));
//#endregion
//#region ../2026-09-14/rendi-la-immagine-1-piu-relistica-4/pool-shaper-build2-recovered-20261010/node_modules/react/cjs/react.production.js
/**
* @license React
* react.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
	var REACT_PORTAL_TYPE = Symbol.for("react.portal");
	var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
	var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
	var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
	var REACT_CONSUMER_TYPE = Symbol.for("react.consumer");
	var REACT_CONTEXT_TYPE = Symbol.for("react.context");
	var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
	var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
	var REACT_MEMO_TYPE = Symbol.for("react.memo");
	var REACT_LAZY_TYPE = Symbol.for("react.lazy");
	var REACT_ACTIVITY_TYPE = Symbol.for("react.activity");
	var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
	function getIteratorFn(maybeIterable) {
		if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
		maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
		return "function" === typeof maybeIterable ? maybeIterable : null;
	}
	var ReactNoopUpdateQueue = {
		isMounted: function() {
			return !1;
		},
		enqueueForceUpdate: function() {},
		enqueueReplaceState: function() {},
		enqueueSetState: function() {}
	};
	var assign = Object.assign;
	var emptyObject = {};
	function Component(props, context, updater) {
		this.props = props;
		this.context = context;
		this.refs = emptyObject;
		this.updater = updater || ReactNoopUpdateQueue;
	}
	Component.prototype.isReactComponent = {};
	Component.prototype.setState = function(partialState, callback) {
		if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
		this.updater.enqueueSetState(this, partialState, callback, "setState");
	};
	Component.prototype.forceUpdate = function(callback) {
		this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
	};
	function ComponentDummy() {}
	ComponentDummy.prototype = Component.prototype;
	function PureComponent(props, context, updater) {
		this.props = props;
		this.context = context;
		this.refs = emptyObject;
		this.updater = updater || ReactNoopUpdateQueue;
	}
	var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
	pureComponentPrototype.constructor = PureComponent;
	assign(pureComponentPrototype, Component.prototype);
	pureComponentPrototype.isPureReactComponent = !0;
	var isArrayImpl = Array.isArray;
	function noop() {}
	var ReactSharedInternals = {
		H: null,
		A: null,
		T: null,
		S: null
	};
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	function ReactElement(type, key, props) {
		var refProp = props.ref;
		return {
			$$typeof: REACT_ELEMENT_TYPE,
			type,
			key,
			ref: void 0 !== refProp ? refProp : null,
			props
		};
	}
	function cloneAndReplaceKey(oldElement, newKey) {
		return ReactElement(oldElement.type, newKey, oldElement.props);
	}
	function isValidElement(object) {
		return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
	}
	function escape(key) {
		var escaperLookup = {
			"=": "=0",
			":": "=2"
		};
		return "$" + key.replace(/[=:]/g, function(match) {
			return escaperLookup[match];
		});
	}
	var userProvidedKeyEscapeRegex = /\/+/g;
	function getElementKey(element, index) {
		return "object" === typeof element && null !== element && null != element.key ? escape("" + element.key) : index.toString(36);
	}
	function resolveThenable(thenable) {
		switch (thenable.status) {
			case "fulfilled": return thenable.value;
			case "rejected": throw thenable.reason;
			default: switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(function(fulfilledValue) {
				"pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
			}, function(error) {
				"pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
			})), thenable.status) {
				case "fulfilled": return thenable.value;
				case "rejected": throw thenable.reason;
			}
		}
		throw thenable;
	}
	function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
		var type = typeof children;
		if ("undefined" === type || "boolean" === type) children = null;
		var invokeCallback = !1;
		if (null === children) invokeCallback = !0;
		else switch (type) {
			case "bigint":
			case "string":
			case "number":
				invokeCallback = !0;
				break;
			case "object": switch (children.$$typeof) {
				case REACT_ELEMENT_TYPE:
				case REACT_PORTAL_TYPE:
					invokeCallback = !0;
					break;
				case REACT_LAZY_TYPE: return invokeCallback = children._init, mapIntoArray(invokeCallback(children._payload), array, escapedPrefix, nameSoFar, callback);
			}
		}
		if (invokeCallback) return callback = callback(children), invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", null != invokeCallback && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
			return c;
		})) : null != callback && (isValidElement(callback) && (callback = cloneAndReplaceKey(callback, escapedPrefix + (null == callback.key || children && children.key === callback.key ? "" : ("" + callback.key).replace(userProvidedKeyEscapeRegex, "$&/") + "/") + invokeCallback)), array.push(callback)), 1;
		invokeCallback = 0;
		var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
		if (isArrayImpl(children)) for (var i = 0; i < children.length; i++) nameSoFar = children[i], type = nextNamePrefix + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
		else if (i = getIteratorFn(children), "function" === typeof i) for (children = i.call(children), i = 0; !(nameSoFar = children.next()).done;) nameSoFar = nameSoFar.value, type = nextNamePrefix + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
		else if ("object" === type) {
			if ("function" === typeof children.then) return mapIntoArray(resolveThenable(children), array, escapedPrefix, nameSoFar, callback);
			array = String(children);
			throw Error("Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead.");
		}
		return invokeCallback;
	}
	function mapChildren(children, func, context) {
		if (null == children) return children;
		var result = [], count = 0;
		mapIntoArray(children, result, "", "", function(child) {
			return func.call(context, child, count++);
		});
		return result;
	}
	function lazyInitializer(payload) {
		if (-1 === payload._status) {
			var ctor = payload._result;
			ctor = ctor();
			ctor.then(function(moduleObject) {
				if (0 === payload._status || -1 === payload._status) payload._status = 1, payload._result = moduleObject;
			}, function(error) {
				if (0 === payload._status || -1 === payload._status) payload._status = 2, payload._result = error;
			});
			-1 === payload._status && (payload._status = 0, payload._result = ctor);
		}
		if (1 === payload._status) return payload._result.default;
		throw payload._result;
	}
	var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
		if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
			var event = new window.ErrorEvent("error", {
				bubbles: !0,
				cancelable: !0,
				message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
				error
			});
			if (!window.dispatchEvent(event)) return;
		} else if ("object" === typeof process && "function" === typeof process.emit) {
			process.emit("uncaughtException", error);
			return;
		}
		console.error(error);
	};
	var Children = {
		map: mapChildren,
		forEach: function(children, forEachFunc, forEachContext) {
			mapChildren(children, function() {
				forEachFunc.apply(this, arguments);
			}, forEachContext);
		},
		count: function(children) {
			var n = 0;
			mapChildren(children, function() {
				n++;
			});
			return n;
		},
		toArray: function(children) {
			return mapChildren(children, function(child) {
				return child;
			}) || [];
		},
		only: function(children) {
			if (!isValidElement(children)) throw Error("React.Children.only expected to receive a single React element child.");
			return children;
		}
	};
	exports.Activity = REACT_ACTIVITY_TYPE;
	exports.Children = Children;
	exports.Component = Component;
	exports.Fragment = REACT_FRAGMENT_TYPE;
	exports.Profiler = REACT_PROFILER_TYPE;
	exports.PureComponent = PureComponent;
	exports.StrictMode = REACT_STRICT_MODE_TYPE;
	exports.Suspense = REACT_SUSPENSE_TYPE;
	exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
	exports.__COMPILER_RUNTIME = {
		__proto__: null,
		c: function(size) {
			return ReactSharedInternals.H.useMemoCache(size);
		}
	};
	exports.cache = function(fn) {
		return function() {
			return fn.apply(null, arguments);
		};
	};
	exports.cacheSignal = function() {
		return null;
	};
	exports.cloneElement = function(element, config, children) {
		if (null === element || void 0 === element) throw Error("The argument must be a React element, but you passed " + element + ".");
		var props = assign({}, element.props), key = element.key;
		if (null != config) for (propName in void 0 !== config.key && (key = "" + config.key), config) !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
		var propName = arguments.length - 2;
		if (1 === propName) props.children = children;
		else if (1 < propName) {
			for (var childArray = Array(propName), i = 0; i < propName; i++) childArray[i] = arguments[i + 2];
			props.children = childArray;
		}
		return ReactElement(element.type, key, props);
	};
	exports.createContext = function(defaultValue) {
		defaultValue = {
			$$typeof: REACT_CONTEXT_TYPE,
			_currentValue: defaultValue,
			_currentValue2: defaultValue,
			_threadCount: 0,
			Provider: null,
			Consumer: null
		};
		defaultValue.Provider = defaultValue;
		defaultValue.Consumer = {
			$$typeof: REACT_CONSUMER_TYPE,
			_context: defaultValue
		};
		return defaultValue;
	};
	exports.createElement = function(type, config, children) {
		var propName, props = {}, key = null;
		if (null != config) for (propName in void 0 !== config.key && (key = "" + config.key), config) hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (props[propName] = config[propName]);
		var childrenLength = arguments.length - 2;
		if (1 === childrenLength) props.children = children;
		else if (1 < childrenLength) {
			for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++) childArray[i] = arguments[i + 2];
			props.children = childArray;
		}
		if (type && type.defaultProps) for (propName in childrenLength = type.defaultProps, childrenLength) void 0 === props[propName] && (props[propName] = childrenLength[propName]);
		return ReactElement(type, key, props);
	};
	exports.createRef = function() {
		return { current: null };
	};
	exports.forwardRef = function(render) {
		return {
			$$typeof: REACT_FORWARD_REF_TYPE,
			render
		};
	};
	exports.isValidElement = isValidElement;
	exports.lazy = function(ctor) {
		return {
			$$typeof: REACT_LAZY_TYPE,
			_payload: {
				_status: -1,
				_result: ctor
			},
			_init: lazyInitializer
		};
	};
	exports.memo = function(type, compare) {
		return {
			$$typeof: REACT_MEMO_TYPE,
			type,
			compare: void 0 === compare ? null : compare
		};
	};
	exports.startTransition = function(scope) {
		var prevTransition = ReactSharedInternals.T, currentTransition = {};
		ReactSharedInternals.T = currentTransition;
		try {
			var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
			null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
			"object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
		} catch (error) {
			reportGlobalError(error);
		} finally {
			null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
		}
	};
	exports.unstable_useCacheRefresh = function() {
		return ReactSharedInternals.H.useCacheRefresh();
	};
	exports.use = function(usable) {
		return ReactSharedInternals.H.use(usable);
	};
	exports.useActionState = function(action, initialState, permalink) {
		return ReactSharedInternals.H.useActionState(action, initialState, permalink);
	};
	exports.useCallback = function(callback, deps) {
		return ReactSharedInternals.H.useCallback(callback, deps);
	};
	exports.useContext = function(Context) {
		return ReactSharedInternals.H.useContext(Context);
	};
	exports.useDebugValue = function() {};
	exports.useDeferredValue = function(value, initialValue) {
		return ReactSharedInternals.H.useDeferredValue(value, initialValue);
	};
	exports.useEffect = function(create, deps) {
		return ReactSharedInternals.H.useEffect(create, deps);
	};
	exports.useEffectEvent = function(callback) {
		return ReactSharedInternals.H.useEffectEvent(callback);
	};
	exports.useId = function() {
		return ReactSharedInternals.H.useId();
	};
	exports.useImperativeHandle = function(ref, create, deps) {
		return ReactSharedInternals.H.useImperativeHandle(ref, create, deps);
	};
	exports.useInsertionEffect = function(create, deps) {
		return ReactSharedInternals.H.useInsertionEffect(create, deps);
	};
	exports.useLayoutEffect = function(create, deps) {
		return ReactSharedInternals.H.useLayoutEffect(create, deps);
	};
	exports.useMemo = function(create, deps) {
		return ReactSharedInternals.H.useMemo(create, deps);
	};
	exports.useOptimistic = function(passthrough, reducer) {
		return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
	};
	exports.useReducer = function(reducer, initialArg, init) {
		return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
	};
	exports.useRef = function(initialValue) {
		return ReactSharedInternals.H.useRef(initialValue);
	};
	exports.useState = function(initialState) {
		return ReactSharedInternals.H.useState(initialState);
	};
	exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
		return ReactSharedInternals.H.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
	};
	exports.useTransition = function() {
		return ReactSharedInternals.H.useTransition();
	};
	exports.version = "19.2.8";
}));
//#endregion
//#region ../2026-09-14/rendi-la-immagine-1-piu-relistica-4/pool-shaper-build2-recovered-20261010/node_modules/react/cjs/react.development.js
/**
* @license React
* react.development.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_development = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	"production" !== process.env.NODE_ENV && (function() {
		function defineDeprecationWarning(methodName, info) {
			Object.defineProperty(Component.prototype, methodName, { get: function() {
				console.warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
			} });
		}
		function getIteratorFn(maybeIterable) {
			if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
			maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
			return "function" === typeof maybeIterable ? maybeIterable : null;
		}
		function warnNoop(publicInstance, callerName) {
			publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
			var warningKey = publicInstance + "." + callerName;
			didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, publicInstance), didWarnStateUpdateForUnmountedComponent[warningKey] = !0);
		}
		function Component(props, context, updater) {
			this.props = props;
			this.context = context;
			this.refs = emptyObject;
			this.updater = updater || ReactNoopUpdateQueue;
		}
		function ComponentDummy() {}
		function PureComponent(props, context, updater) {
			this.props = props;
			this.context = context;
			this.refs = emptyObject;
			this.updater = updater || ReactNoopUpdateQueue;
		}
		function noop() {}
		function testStringCoercion(value) {
			return "" + value;
		}
		function checkKeyStringCoercion(value) {
			try {
				testStringCoercion(value);
				var JSCompiler_inline_result = !1;
			} catch (e) {
				JSCompiler_inline_result = !0;
			}
			if (JSCompiler_inline_result) {
				JSCompiler_inline_result = console;
				var JSCompiler_temp_const = JSCompiler_inline_result.error;
				var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
				JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
				return testStringCoercion(value);
			}
		}
		function getComponentNameFromType(type) {
			if (null == type) return null;
			if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
			if ("string" === typeof type) return type;
			switch (type) {
				case REACT_FRAGMENT_TYPE: return "Fragment";
				case REACT_PROFILER_TYPE: return "Profiler";
				case REACT_STRICT_MODE_TYPE: return "StrictMode";
				case REACT_SUSPENSE_TYPE: return "Suspense";
				case REACT_SUSPENSE_LIST_TYPE: return "SuspenseList";
				case REACT_ACTIVITY_TYPE: return "Activity";
			}
			if ("object" === typeof type) switch ("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
				case REACT_PORTAL_TYPE: return "Portal";
				case REACT_CONTEXT_TYPE: return type.displayName || "Context";
				case REACT_CONSUMER_TYPE: return (type._context.displayName || "Context") + ".Consumer";
				case REACT_FORWARD_REF_TYPE:
					var innerType = type.render;
					type = type.displayName;
					type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
					return type;
				case REACT_MEMO_TYPE: return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
				case REACT_LAZY_TYPE:
					innerType = type._payload;
					type = type._init;
					try {
						return getComponentNameFromType(type(innerType));
					} catch (x) {}
			}
			return null;
		}
		function getTaskName(type) {
			if (type === REACT_FRAGMENT_TYPE) return "<>";
			if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
			try {
				var name = getComponentNameFromType(type);
				return name ? "<" + name + ">" : "<...>";
			} catch (x) {
				return "<...>";
			}
		}
		function getOwner() {
			var dispatcher = ReactSharedInternals.A;
			return null === dispatcher ? null : dispatcher.getOwner();
		}
		function UnknownOwner() {
			return Error("react-stack-top-frame");
		}
		function hasValidKey(config) {
			if (hasOwnProperty.call(config, "key")) {
				var getter = Object.getOwnPropertyDescriptor(config, "key").get;
				if (getter && getter.isReactWarning) return !1;
			}
			return void 0 !== config.key;
		}
		function defineKeyPropWarningGetter(props, displayName) {
			function warnAboutAccessingKey() {
				specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
			}
			warnAboutAccessingKey.isReactWarning = !0;
			Object.defineProperty(props, "key", {
				get: warnAboutAccessingKey,
				configurable: !0
			});
		}
		function elementRefGetterWithDeprecationWarning() {
			var componentName = getComponentNameFromType(this.type);
			didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
			componentName = this.props.ref;
			return void 0 !== componentName ? componentName : null;
		}
		function ReactElement(type, key, props, owner, debugStack, debugTask) {
			var refProp = props.ref;
			type = {
				$$typeof: REACT_ELEMENT_TYPE,
				type,
				key,
				props,
				_owner: owner
			};
			null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
				enumerable: !1,
				get: elementRefGetterWithDeprecationWarning
			}) : Object.defineProperty(type, "ref", {
				enumerable: !1,
				value: null
			});
			type._store = {};
			Object.defineProperty(type._store, "validated", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: 0
			});
			Object.defineProperty(type, "_debugInfo", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: null
			});
			Object.defineProperty(type, "_debugStack", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: debugStack
			});
			Object.defineProperty(type, "_debugTask", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: debugTask
			});
			Object.freeze && (Object.freeze(type.props), Object.freeze(type));
			return type;
		}
		function cloneAndReplaceKey(oldElement, newKey) {
			newKey = ReactElement(oldElement.type, newKey, oldElement.props, oldElement._owner, oldElement._debugStack, oldElement._debugTask);
			oldElement._store && (newKey._store.validated = oldElement._store.validated);
			return newKey;
		}
		function validateChildKeys(node) {
			isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
		}
		function isValidElement(object) {
			return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
		}
		function escape(key) {
			var escaperLookup = {
				"=": "=0",
				":": "=2"
			};
			return "$" + key.replace(/[=:]/g, function(match) {
				return escaperLookup[match];
			});
		}
		function getElementKey(element, index) {
			return "object" === typeof element && null !== element && null != element.key ? (checkKeyStringCoercion(element.key), escape("" + element.key)) : index.toString(36);
		}
		function resolveThenable(thenable) {
			switch (thenable.status) {
				case "fulfilled": return thenable.value;
				case "rejected": throw thenable.reason;
				default: switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(function(fulfilledValue) {
					"pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
				}, function(error) {
					"pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
				})), thenable.status) {
					case "fulfilled": return thenable.value;
					case "rejected": throw thenable.reason;
				}
			}
			throw thenable;
		}
		function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
			var type = typeof children;
			if ("undefined" === type || "boolean" === type) children = null;
			var invokeCallback = !1;
			if (null === children) invokeCallback = !0;
			else switch (type) {
				case "bigint":
				case "string":
				case "number":
					invokeCallback = !0;
					break;
				case "object": switch (children.$$typeof) {
					case REACT_ELEMENT_TYPE:
					case REACT_PORTAL_TYPE:
						invokeCallback = !0;
						break;
					case REACT_LAZY_TYPE: return invokeCallback = children._init, mapIntoArray(invokeCallback(children._payload), array, escapedPrefix, nameSoFar, callback);
				}
			}
			if (invokeCallback) {
				invokeCallback = children;
				callback = callback(invokeCallback);
				var childKey = "" === nameSoFar ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
				isArrayImpl(callback) ? (escapedPrefix = "", null != childKey && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
					return c;
				})) : null != callback && (isValidElement(callback) && (null != callback.key && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(callback, escapedPrefix + (null == callback.key || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(userProvidedKeyEscapeRegex, "$&/") + "/") + childKey), "" !== nameSoFar && null != invokeCallback && isValidElement(invokeCallback) && null == invokeCallback.key && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
				return 1;
			}
			invokeCallback = 0;
			childKey = "" === nameSoFar ? "." : nameSoFar + ":";
			if (isArrayImpl(children)) for (var i = 0; i < children.length; i++) nameSoFar = children[i], type = childKey + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
			else if (i = getIteratorFn(children), "function" === typeof i) for (i === children.entries && (didWarnAboutMaps || console.warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead."), didWarnAboutMaps = !0), children = i.call(children), i = 0; !(nameSoFar = children.next()).done;) nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
			else if ("object" === type) {
				if ("function" === typeof children.then) return mapIntoArray(resolveThenable(children), array, escapedPrefix, nameSoFar, callback);
				array = String(children);
				throw Error("Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead.");
			}
			return invokeCallback;
		}
		function mapChildren(children, func, context) {
			if (null == children) return children;
			var result = [], count = 0;
			mapIntoArray(children, result, "", "", function(child) {
				return func.call(context, child, count++);
			});
			return result;
		}
		function lazyInitializer(payload) {
			if (-1 === payload._status) {
				var ioInfo = payload._ioInfo;
				null != ioInfo && (ioInfo.start = ioInfo.end = performance.now());
				ioInfo = payload._result;
				var thenable = ioInfo();
				thenable.then(function(moduleObject) {
					if (0 === payload._status || -1 === payload._status) {
						payload._status = 1;
						payload._result = moduleObject;
						var _ioInfo = payload._ioInfo;
						null != _ioInfo && (_ioInfo.end = performance.now());
						void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
					}
				}, function(error) {
					if (0 === payload._status || -1 === payload._status) {
						payload._status = 2;
						payload._result = error;
						var _ioInfo2 = payload._ioInfo;
						null != _ioInfo2 && (_ioInfo2.end = performance.now());
						void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error);
					}
				});
				ioInfo = payload._ioInfo;
				if (null != ioInfo) {
					ioInfo.value = thenable;
					var displayName = thenable.displayName;
					"string" === typeof displayName && (ioInfo.name = displayName);
				}
				-1 === payload._status && (payload._status = 0, payload._result = thenable);
			}
			if (1 === payload._status) return ioInfo = payload._result, void 0 === ioInfo && console.error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", ioInfo), "default" in ioInfo || console.error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", ioInfo), ioInfo.default;
			throw payload._result;
		}
		function resolveDispatcher() {
			var dispatcher = ReactSharedInternals.H;
			null === dispatcher && console.error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.");
			return dispatcher;
		}
		function releaseAsyncTransition() {
			ReactSharedInternals.asyncTransitions--;
		}
		function enqueueTask(task) {
			if (null === enqueueTaskImpl) try {
				var requireString = ("require" + Math.random()).slice(0, 7);
				enqueueTaskImpl = (module && module[requireString]).call(module, "timers").setImmediate;
			} catch (_err) {
				enqueueTaskImpl = function(callback) {
					!1 === didWarnAboutMessageChannel && (didWarnAboutMessageChannel = !0, "undefined" === typeof MessageChannel && console.error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."));
					var channel = new MessageChannel();
					channel.port1.onmessage = callback;
					channel.port2.postMessage(void 0);
				};
			}
			return enqueueTaskImpl(task);
		}
		function aggregateErrors(errors) {
			return 1 < errors.length && "function" === typeof AggregateError ? new AggregateError(errors) : errors[0];
		}
		function popActScope(prevActQueue, prevActScopeDepth) {
			prevActScopeDepth !== actScopeDepth - 1 && console.error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
			actScopeDepth = prevActScopeDepth;
		}
		function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
			var queue = ReactSharedInternals.actQueue;
			if (null !== queue) if (0 !== queue.length) try {
				flushActQueue(queue);
				enqueueTask(function() {
					return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
				});
				return;
			} catch (error) {
				ReactSharedInternals.thrownErrors.push(error);
			}
			else ReactSharedInternals.actQueue = null;
			0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve(returnValue);
		}
		function flushActQueue(queue) {
			if (!isFlushing) {
				isFlushing = !0;
				var i = 0;
				try {
					for (; i < queue.length; i++) {
						var callback = queue[i];
						do {
							ReactSharedInternals.didUsePromise = !1;
							var continuation = callback(!1);
							if (null !== continuation) {
								if (ReactSharedInternals.didUsePromise) {
									queue[i] = callback;
									queue.splice(0, i);
									return;
								}
								callback = continuation;
							} else break;
						} while (1);
					}
					queue.length = 0;
				} catch (error) {
					queue.splice(0, i + 1), ReactSharedInternals.thrownErrors.push(error);
				} finally {
					isFlushing = !1;
				}
			}
		}
		"undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
		var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
			isMounted: function() {
				return !1;
			},
			enqueueForceUpdate: function(publicInstance) {
				warnNoop(publicInstance, "forceUpdate");
			},
			enqueueReplaceState: function(publicInstance) {
				warnNoop(publicInstance, "replaceState");
			},
			enqueueSetState: function(publicInstance) {
				warnNoop(publicInstance, "setState");
			}
		}, assign = Object.assign, emptyObject = {};
		Object.freeze(emptyObject);
		Component.prototype.isReactComponent = {};
		Component.prototype.setState = function(partialState, callback) {
			if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
			this.updater.enqueueSetState(this, partialState, callback, "setState");
		};
		Component.prototype.forceUpdate = function(callback) {
			this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
		};
		var deprecatedAPIs = {
			isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
			replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]
		};
		for (fnName in deprecatedAPIs) deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
		ComponentDummy.prototype = Component.prototype;
		deprecatedAPIs = PureComponent.prototype = new ComponentDummy();
		deprecatedAPIs.constructor = PureComponent;
		assign(deprecatedAPIs, Component.prototype);
		deprecatedAPIs.isPureReactComponent = !0;
		var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = {
			H: null,
			A: null,
			T: null,
			S: null,
			actQueue: null,
			asyncTransitions: 0,
			isBatchingLegacy: !1,
			didScheduleLegacyUpdate: !1,
			didUsePromise: !1,
			thrownErrors: [],
			getCurrentStack: null,
			recentlyCreatedOwnerStacks: 0
		}, hasOwnProperty = Object.prototype.hasOwnProperty, createTask = console.createTask ? console.createTask : function() {
			return null;
		};
		deprecatedAPIs = { react_stack_bottom_frame: function(callStackForError) {
			return callStackForError();
		} };
		var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
		var didWarnAboutElementRef = {};
		var unknownOwnerDebugStack = deprecatedAPIs.react_stack_bottom_frame.bind(deprecatedAPIs, UnknownOwner)();
		var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
		var didWarnAboutMaps = !1, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
			if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
				var event = new window.ErrorEvent("error", {
					bubbles: !0,
					cancelable: !0,
					message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
					error
				});
				if (!window.dispatchEvent(event)) return;
			} else if ("object" === typeof process && "function" === typeof process.emit) {
				process.emit("uncaughtException", error);
				return;
			}
			console.error(error);
		}, didWarnAboutMessageChannel = !1, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = !1, isFlushing = !1, queueSeveralMicrotasks = "function" === typeof queueMicrotask ? function(callback) {
			queueMicrotask(function() {
				return queueMicrotask(callback);
			});
		} : enqueueTask;
		deprecatedAPIs = Object.freeze({
			__proto__: null,
			c: function(size) {
				return resolveDispatcher().useMemoCache(size);
			}
		});
		var fnName = {
			map: mapChildren,
			forEach: function(children, forEachFunc, forEachContext) {
				mapChildren(children, function() {
					forEachFunc.apply(this, arguments);
				}, forEachContext);
			},
			count: function(children) {
				var n = 0;
				mapChildren(children, function() {
					n++;
				});
				return n;
			},
			toArray: function(children) {
				return mapChildren(children, function(child) {
					return child;
				}) || [];
			},
			only: function(children) {
				if (!isValidElement(children)) throw Error("React.Children.only expected to receive a single React element child.");
				return children;
			}
		};
		exports.Activity = REACT_ACTIVITY_TYPE;
		exports.Children = fnName;
		exports.Component = Component;
		exports.Fragment = REACT_FRAGMENT_TYPE;
		exports.Profiler = REACT_PROFILER_TYPE;
		exports.PureComponent = PureComponent;
		exports.StrictMode = REACT_STRICT_MODE_TYPE;
		exports.Suspense = REACT_SUSPENSE_TYPE;
		exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
		exports.__COMPILER_RUNTIME = deprecatedAPIs;
		exports.act = function(callback) {
			var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
			actScopeDepth++;
			var queue = ReactSharedInternals.actQueue = null !== prevActQueue ? prevActQueue : [], didAwaitActCall = !1;
			try {
				var result = callback();
			} catch (error) {
				ReactSharedInternals.thrownErrors.push(error);
			}
			if (0 < ReactSharedInternals.thrownErrors.length) throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
			if (null !== result && "object" === typeof result && "function" === typeof result.then) {
				var thenable = result;
				queueSeveralMicrotasks(function() {
					didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = !0, console.error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"));
				});
				return { then: function(resolve, reject) {
					didAwaitActCall = !0;
					thenable.then(function(returnValue) {
						popActScope(prevActQueue, prevActScopeDepth);
						if (0 === prevActScopeDepth) {
							try {
								flushActQueue(queue), enqueueTask(function() {
									return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
								});
							} catch (error$0) {
								ReactSharedInternals.thrownErrors.push(error$0);
							}
							if (0 < ReactSharedInternals.thrownErrors.length) {
								var _thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
								ReactSharedInternals.thrownErrors.length = 0;
								reject(_thrownError);
							}
						} else resolve(returnValue);
					}, function(error) {
						popActScope(prevActQueue, prevActScopeDepth);
						0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
					});
				} };
			}
			var returnValue$jscomp$0 = result;
			popActScope(prevActQueue, prevActScopeDepth);
			0 === prevActScopeDepth && (flushActQueue(queue), 0 !== queue.length && queueSeveralMicrotasks(function() {
				didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = !0, console.error("A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"));
			}), ReactSharedInternals.actQueue = null);
			if (0 < ReactSharedInternals.thrownErrors.length) throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
			return { then: function(resolve, reject) {
				didAwaitActCall = !0;
				0 === prevActScopeDepth ? (ReactSharedInternals.actQueue = queue, enqueueTask(function() {
					return recursivelyFlushAsyncActWork(returnValue$jscomp$0, resolve, reject);
				})) : resolve(returnValue$jscomp$0);
			} };
		};
		exports.cache = function(fn) {
			return function() {
				return fn.apply(null, arguments);
			};
		};
		exports.cacheSignal = function() {
			return null;
		};
		exports.captureOwnerStack = function() {
			var getCurrentStack = ReactSharedInternals.getCurrentStack;
			return null === getCurrentStack ? null : getCurrentStack();
		};
		exports.cloneElement = function(element, config, children) {
			if (null === element || void 0 === element) throw Error("The argument must be a React element, but you passed " + element + ".");
			var props = assign({}, element.props), key = element.key, owner = element._owner;
			if (null != config) {
				var JSCompiler_inline_result;
				a: {
					if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(config, "ref").get) && JSCompiler_inline_result.isReactWarning) {
						JSCompiler_inline_result = !1;
						break a;
					}
					JSCompiler_inline_result = void 0 !== config.ref;
				}
				JSCompiler_inline_result && (owner = getOwner());
				hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
				for (propName in config) !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
			}
			var propName = arguments.length - 2;
			if (1 === propName) props.children = children;
			else if (1 < propName) {
				JSCompiler_inline_result = Array(propName);
				for (var i = 0; i < propName; i++) JSCompiler_inline_result[i] = arguments[i + 2];
				props.children = JSCompiler_inline_result;
			}
			props = ReactElement(element.type, key, props, owner, element._debugStack, element._debugTask);
			for (key = 2; key < arguments.length; key++) validateChildKeys(arguments[key]);
			return props;
		};
		exports.createContext = function(defaultValue) {
			defaultValue = {
				$$typeof: REACT_CONTEXT_TYPE,
				_currentValue: defaultValue,
				_currentValue2: defaultValue,
				_threadCount: 0,
				Provider: null,
				Consumer: null
			};
			defaultValue.Provider = defaultValue;
			defaultValue.Consumer = {
				$$typeof: REACT_CONSUMER_TYPE,
				_context: defaultValue
			};
			defaultValue._currentRenderer = null;
			defaultValue._currentRenderer2 = null;
			return defaultValue;
		};
		exports.createElement = function(type, config, children) {
			for (var i = 2; i < arguments.length; i++) validateChildKeys(arguments[i]);
			i = {};
			var key = null;
			if (null != config) for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = !0, console.warn("Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform")), hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key), config) hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (i[propName] = config[propName]);
			var childrenLength = arguments.length - 2;
			if (1 === childrenLength) i.children = children;
			else if (1 < childrenLength) {
				for (var childArray = Array(childrenLength), _i = 0; _i < childrenLength; _i++) childArray[_i] = arguments[_i + 2];
				Object.freeze && Object.freeze(childArray);
				i.children = childArray;
			}
			if (type && type.defaultProps) for (propName in childrenLength = type.defaultProps, childrenLength) void 0 === i[propName] && (i[propName] = childrenLength[propName]);
			key && defineKeyPropWarningGetter(i, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
			var propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
			return ReactElement(type, key, i, getOwner(), propName ? Error("react-stack-top-frame") : unknownOwnerDebugStack, propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
		};
		exports.createRef = function() {
			var refObject = { current: null };
			Object.seal(refObject);
			return refObject;
		};
		exports.forwardRef = function(render) {
			null != render && render.$$typeof === REACT_MEMO_TYPE ? console.error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).") : "function" !== typeof render ? console.error("forwardRef requires a render function but was given %s.", null === render ? "null" : typeof render) : 0 !== render.length && 2 !== render.length && console.error("forwardRef render functions accept exactly two parameters: props and ref. %s", 1 === render.length ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
			null != render && null != render.defaultProps && console.error("forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?");
			var elementType = {
				$$typeof: REACT_FORWARD_REF_TYPE,
				render
			}, ownName;
			Object.defineProperty(elementType, "displayName", {
				enumerable: !1,
				configurable: !0,
				get: function() {
					return ownName;
				},
				set: function(name) {
					ownName = name;
					render.name || render.displayName || (Object.defineProperty(render, "name", { value: name }), render.displayName = name);
				}
			});
			return elementType;
		};
		exports.isValidElement = isValidElement;
		exports.lazy = function(ctor) {
			ctor = {
				_status: -1,
				_result: ctor
			};
			var lazyType = {
				$$typeof: REACT_LAZY_TYPE,
				_payload: ctor,
				_init: lazyInitializer
			}, ioInfo = {
				name: "lazy",
				start: -1,
				end: -1,
				value: null,
				owner: null,
				debugStack: Error("react-stack-top-frame"),
				debugTask: console.createTask ? console.createTask("lazy()") : null
			};
			ctor._ioInfo = ioInfo;
			lazyType._debugInfo = [{ awaited: ioInfo }];
			return lazyType;
		};
		exports.memo = function(type, compare) {
			type ?? console.error("memo: The first argument must be a component. Instead received: %s", null === type ? "null" : typeof type);
			compare = {
				$$typeof: REACT_MEMO_TYPE,
				type,
				compare: void 0 === compare ? null : compare
			};
			var ownName;
			Object.defineProperty(compare, "displayName", {
				enumerable: !1,
				configurable: !0,
				get: function() {
					return ownName;
				},
				set: function(name) {
					ownName = name;
					type.name || type.displayName || (Object.defineProperty(type, "name", { value: name }), type.displayName = name);
				}
			});
			return compare;
		};
		exports.startTransition = function(scope) {
			var prevTransition = ReactSharedInternals.T, currentTransition = {};
			currentTransition._updatedFibers = /* @__PURE__ */ new Set();
			ReactSharedInternals.T = currentTransition;
			try {
				var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
				null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
				"object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && (ReactSharedInternals.asyncTransitions++, returnValue.then(releaseAsyncTransition, releaseAsyncTransition), returnValue.then(noop, reportGlobalError));
			} catch (error) {
				reportGlobalError(error);
			} finally {
				null === prevTransition && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.")), null !== prevTransition && null !== currentTransition.types && (null !== prevTransition.types && prevTransition.types !== currentTransition.types && console.error("We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."), prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
			}
		};
		exports.unstable_useCacheRefresh = function() {
			return resolveDispatcher().useCacheRefresh();
		};
		exports.use = function(usable) {
			return resolveDispatcher().use(usable);
		};
		exports.useActionState = function(action, initialState, permalink) {
			return resolveDispatcher().useActionState(action, initialState, permalink);
		};
		exports.useCallback = function(callback, deps) {
			return resolveDispatcher().useCallback(callback, deps);
		};
		exports.useContext = function(Context) {
			var dispatcher = resolveDispatcher();
			Context.$$typeof === REACT_CONSUMER_TYPE && console.error("Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?");
			return dispatcher.useContext(Context);
		};
		exports.useDebugValue = function(value, formatterFn) {
			return resolveDispatcher().useDebugValue(value, formatterFn);
		};
		exports.useDeferredValue = function(value, initialValue) {
			return resolveDispatcher().useDeferredValue(value, initialValue);
		};
		exports.useEffect = function(create, deps) {
			create ?? console.warn("React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?");
			return resolveDispatcher().useEffect(create, deps);
		};
		exports.useEffectEvent = function(callback) {
			return resolveDispatcher().useEffectEvent(callback);
		};
		exports.useId = function() {
			return resolveDispatcher().useId();
		};
		exports.useImperativeHandle = function(ref, create, deps) {
			return resolveDispatcher().useImperativeHandle(ref, create, deps);
		};
		exports.useInsertionEffect = function(create, deps) {
			create ?? console.warn("React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?");
			return resolveDispatcher().useInsertionEffect(create, deps);
		};
		exports.useLayoutEffect = function(create, deps) {
			create ?? console.warn("React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?");
			return resolveDispatcher().useLayoutEffect(create, deps);
		};
		exports.useMemo = function(create, deps) {
			return resolveDispatcher().useMemo(create, deps);
		};
		exports.useOptimistic = function(passthrough, reducer) {
			return resolveDispatcher().useOptimistic(passthrough, reducer);
		};
		exports.useReducer = function(reducer, initialArg, init) {
			return resolveDispatcher().useReducer(reducer, initialArg, init);
		};
		exports.useRef = function(initialValue) {
			return resolveDispatcher().useRef(initialValue);
		};
		exports.useState = function(initialState) {
			return resolveDispatcher().useState(initialState);
		};
		exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
			return resolveDispatcher().useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
		};
		exports.useTransition = function() {
			return resolveDispatcher().useTransition();
		};
		exports.version = "19.2.8";
		"undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
	})();
}));
//#endregion
//#region ../2026-09-14/rendi-la-immagine-1-piu-relistica-4/pool-shaper-build2-recovered-20261010/node_modules/react/index.js
var require_react = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	if (process.env.NODE_ENV === "production") module.exports = require_react_production();
	else module.exports = require_react_development();
}));
//#endregion
//#region ../2026-09-14/rendi-la-immagine-1-piu-relistica-4/pool-shaper-build2-recovered-20261010/node_modules/react/cjs/react-jsx-runtime.development.js
/**
* @license React
* react-jsx-runtime.development.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_jsx_runtime_development = /* @__PURE__ */ __commonJSMin(((exports) => {
	"production" !== process.env.NODE_ENV && (function() {
		function getComponentNameFromType(type) {
			if (null == type) return null;
			if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
			if ("string" === typeof type) return type;
			switch (type) {
				case REACT_FRAGMENT_TYPE: return "Fragment";
				case REACT_PROFILER_TYPE: return "Profiler";
				case REACT_STRICT_MODE_TYPE: return "StrictMode";
				case REACT_SUSPENSE_TYPE: return "Suspense";
				case REACT_SUSPENSE_LIST_TYPE: return "SuspenseList";
				case REACT_ACTIVITY_TYPE: return "Activity";
			}
			if ("object" === typeof type) switch ("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
				case REACT_PORTAL_TYPE: return "Portal";
				case REACT_CONTEXT_TYPE: return type.displayName || "Context";
				case REACT_CONSUMER_TYPE: return (type._context.displayName || "Context") + ".Consumer";
				case REACT_FORWARD_REF_TYPE:
					var innerType = type.render;
					type = type.displayName;
					type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
					return type;
				case REACT_MEMO_TYPE: return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
				case REACT_LAZY_TYPE:
					innerType = type._payload;
					type = type._init;
					try {
						return getComponentNameFromType(type(innerType));
					} catch (x) {}
			}
			return null;
		}
		function testStringCoercion(value) {
			return "" + value;
		}
		function checkKeyStringCoercion(value) {
			try {
				testStringCoercion(value);
				var JSCompiler_inline_result = !1;
			} catch (e) {
				JSCompiler_inline_result = !0;
			}
			if (JSCompiler_inline_result) {
				JSCompiler_inline_result = console;
				var JSCompiler_temp_const = JSCompiler_inline_result.error;
				var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
				JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
				return testStringCoercion(value);
			}
		}
		function getTaskName(type) {
			if (type === REACT_FRAGMENT_TYPE) return "<>";
			if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
			try {
				var name = getComponentNameFromType(type);
				return name ? "<" + name + ">" : "<...>";
			} catch (x) {
				return "<...>";
			}
		}
		function getOwner() {
			var dispatcher = ReactSharedInternals.A;
			return null === dispatcher ? null : dispatcher.getOwner();
		}
		function UnknownOwner() {
			return Error("react-stack-top-frame");
		}
		function hasValidKey(config) {
			if (hasOwnProperty.call(config, "key")) {
				var getter = Object.getOwnPropertyDescriptor(config, "key").get;
				if (getter && getter.isReactWarning) return !1;
			}
			return void 0 !== config.key;
		}
		function defineKeyPropWarningGetter(props, displayName) {
			function warnAboutAccessingKey() {
				specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
			}
			warnAboutAccessingKey.isReactWarning = !0;
			Object.defineProperty(props, "key", {
				get: warnAboutAccessingKey,
				configurable: !0
			});
		}
		function elementRefGetterWithDeprecationWarning() {
			var componentName = getComponentNameFromType(this.type);
			didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
			componentName = this.props.ref;
			return void 0 !== componentName ? componentName : null;
		}
		function ReactElement(type, key, props, owner, debugStack, debugTask) {
			var refProp = props.ref;
			type = {
				$$typeof: REACT_ELEMENT_TYPE,
				type,
				key,
				props,
				_owner: owner
			};
			null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
				enumerable: !1,
				get: elementRefGetterWithDeprecationWarning
			}) : Object.defineProperty(type, "ref", {
				enumerable: !1,
				value: null
			});
			type._store = {};
			Object.defineProperty(type._store, "validated", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: 0
			});
			Object.defineProperty(type, "_debugInfo", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: null
			});
			Object.defineProperty(type, "_debugStack", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: debugStack
			});
			Object.defineProperty(type, "_debugTask", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: debugTask
			});
			Object.freeze && (Object.freeze(type.props), Object.freeze(type));
			return type;
		}
		function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
			var children = config.children;
			if (void 0 !== children) if (isStaticChildren) if (isArrayImpl(children)) {
				for (isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++) validateChildKeys(children[isStaticChildren]);
				Object.freeze && Object.freeze(children);
			} else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
			else validateChildKeys(children);
			if (hasOwnProperty.call(config, "key")) {
				children = getComponentNameFromType(type);
				var keys = Object.keys(config).filter(function(k) {
					return "key" !== k;
				});
				isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
				didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error("A props object containing a \"key\" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />", isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = !0);
			}
			children = null;
			void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
			hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
			if ("key" in config) {
				maybeKey = {};
				for (var propName in config) "key" !== propName && (maybeKey[propName] = config[propName]);
			} else maybeKey = config;
			children && defineKeyPropWarningGetter(maybeKey, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
			return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
		}
		function validateChildKeys(node) {
			isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
		}
		function isValidElement(object) {
			return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
		}
		var React = require_react(), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
			return null;
		};
		React = { react_stack_bottom_frame: function(callStackForError) {
			return callStackForError();
		} };
		var specialPropKeyWarningShown;
		var didWarnAboutElementRef = {};
		var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(React, UnknownOwner)();
		var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
		var didWarnAboutKeySpread = {};
		exports.Fragment = REACT_FRAGMENT_TYPE;
		exports.jsx = function(type, config, maybeKey) {
			var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
			return jsxDEVImpl(type, config, maybeKey, !1, trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
		};
		exports.jsxs = function(type, config, maybeKey) {
			var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
			return jsxDEVImpl(type, config, maybeKey, !0, trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
		};
	})();
}));
//#endregion
//#region ../2026-09-14/rendi-la-immagine-1-piu-relistica-4/pool-shaper-build2-recovered-20261010/node_modules/react/jsx-runtime.js
var require_jsx_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	if (process.env.NODE_ENV === "production") module.exports = require_react_jsx_runtime_production();
	else module.exports = require_react_jsx_runtime_development();
}));
require_react();
/**
* Local radius of curvature (circumradius of the point and its immediate
* neighbours) at one outline vertex -- large/Infinity on a straight run,
* small at a tight bend. Dependency-free (no import from geometry.ts) to
* keep this module's own "no external deps" contract.
*/
function localCurvatureRadius(outline, index) {
	const previous = outline[(index - 1 + outline.length) % outline.length];
	const current = outline[index];
	const next = outline[(index + 1) % outline.length];
	const first = Math.hypot(current[0] - previous[0], current[1] - previous[1]);
	const second = Math.hypot(next[0] - current[0], next[1] - current[1]);
	const opposite = Math.hypot(next[0] - previous[0], next[1] - previous[1]);
	const twiceArea = Math.abs((current[0] - previous[0]) * (next[1] - previous[1]) - (current[1] - previous[1]) * (next[0] - previous[0]));
	if (twiceArea <= 1e-9) return Infinity;
	return first * second * opposite / (2 * twiceArea);
}
/** A real architectural corner (rectangle, L-shape recess) turns sharply
* over a single vertex -- a normal, expected place for two straight walls
* to meet, never itself the kind of "excessively curved mounting zone" this
* module steers away from. An Organic bay, by contrast, is a smooth,
* continuously-curving run sampled at many closely-spaced points, each
* turning only a little. Vertices past this turn-angle are treated as
* architectural corners and excluded from the curvature comparison below,
* so a perfectly ordinary L-shape/rectangle corner sitting inside the
* sampling band never gets mistaken for a bay and never flips which side
* is chosen. */
const CORNER_TURN_ANGLE = 25 * Math.PI / 180;
function turnAngle(outline, index) {
	const previous = outline[(index - 1 + outline.length) % outline.length];
	const current = outline[index];
	const next = outline[(index + 1) % outline.length];
	const inAngle = Math.atan2(current[1] - previous[1], current[0] - previous[0]);
	let delta = Math.atan2(next[1] - current[1], next[0] - current[0]) - inAngle;
	while (delta > Math.PI) delta -= Math.PI * 2;
	while (delta < -Math.PI) delta += Math.PI * 2;
	return Math.abs(delta);
}
/**
* How tightly and gradually curved the outline is in the neighbourhood of
* one side of the principal axis (vertices within `band` of that extreme
* coordinate, excluding real architectural corners -- see
* `CORNER_TURN_ANGLE`) -- the worst (smallest) local curvature radius among
* them, or `Infinity` when no qualifying vertex falls in the band (a
* degenerate/empty band, or a band that only contains corners, never
* disqualifies a side that has no genuine smooth-curve concern).
*/
function worstCurvatureNear(outline, axisIndex, extreme, band) {
	let worst = Infinity;
	for (let index = 0; index < outline.length; index++) {
		if (Math.abs(outline[index][axisIndex] - extreme) > band) continue;
		if (turnAngle(outline, index) > CORNER_TURN_ANGLE) continue;
		worst = Math.min(worst, localCurvatureRadius(outline, index));
	}
	return worst;
}
function skimmerWall(outline, excluded = null) {
	let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
	for (const [x, z] of outline) {
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (z < minZ) minZ = z;
		if (z > maxZ) maxZ = z;
	}
	const spanX = maxX - minX;
	const spanZ = maxZ - minZ;
	const runsAlongX = spanX >= spanZ;
	const axis = runsAlongX ? "z" : "x";
	const axisIndex = runsAlongX ? 1 : 0;
	const [lowExtreme, highExtreme] = runsAlongX ? [minZ, maxZ] : [minX, maxX];
	const band = Math.max(.5, (runsAlongX ? spanZ : spanX) * .15);
	const lowCurvature = worstCurvatureNear(outline, axisIndex, lowExtreme, band);
	let coordinate = worstCurvatureNear(outline, axisIndex, highExtreme, band) > lowCurvature ? highExtreme : lowExtreme;
	if (excluded && excluded.axis === axis && Math.abs(excluded.coordinate - coordinate) < 1e-6) coordinate = coordinate === lowExtreme ? highExtreme : lowExtreme;
	return {
		runsAlongX,
		axis,
		coordinate
	};
}
//#endregion
//#region src/lib/pool/boundary-placement.ts
function signedWaterArea(outline) {
	return outline.reduce((sum, a, i) => {
		const b = outline[(i + 1) % outline.length];
		return sum + a[0] * b[1] - b[0] * a[1];
	}, 0) / 2;
}
/** Runs retain the TRUE polyline: no fitting is ever mounted on an interior chord. */
function boundaryRuns(outline, excluded = null) {
	const winding = Math.sign(signedWaterArea(outline)) || 1;
	const runs = [];
	let run;
	let firstTangent = [0, 0], previousTangent = [0, 0];
	for (let i = 0; i < outline.length; i++) {
		const a = outline[i], b = outline[(i + 1) % outline.length];
		const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
		if (length < 1e-7) continue;
		const axis = excluded?.axis === "x" ? 0 : 1;
		if (excluded?.edgeIndices?.includes(i) || excluded && !excluded.edgeIndices && Math.abs(a[axis] - excluded.coordinate) < 1e-5 && Math.abs(b[axis] - excluded.coordinate) < 1e-5) {
			run = void 0;
			continue;
		}
		const t = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
		if (!run || t[0] * previousTangent[0] + t[1] * previousTangent[1] < .94 || t[0] * firstTangent[0] + t[1] * firstTangent[1] < .65) {
			run = {
				points: [a, b],
				edges: [i],
				length,
				winding
			};
			runs.push(run);
			firstTangent = t;
		} else {
			run.points = [...run.points, b];
			run.edges.push(i);
			run.length += length;
		}
		previousTangent = t;
	}
	return runs;
}
function sampleWall(run, distance) {
	let remaining = Math.max(0, Math.min(run.length, distance));
	for (let i = 0; i < run.points.length - 1; i++) {
		const a = run.points[i], b = run.points[i + 1];
		const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
		if (remaining <= length || i === run.points.length - 2) {
			const tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
			return {
				x: a[0] + tx * remaining,
				z: a[1] + tz * remaining,
				tx,
				tz,
				nx: -tz * run.winding,
				nz: tx * run.winding
			};
		}
		remaining -= length;
	}
	throw new Error("Empty mounting wall");
}
function pointInBasin(x, z, outline) {
	let inside = false;
	for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
		const a = outline[i], b = outline[j];
		if (a[1] > z !== b[1] > z && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
	}
	return inside;
}
//#endregion
//#region src/lib/pool/lighting.ts
/** Per-vertex convex/reflex classification, generic over any simple,
* consistently-wound polygon. Deliberately a local copy of the identical
* check in `l-shape.ts` (`classifyOutlineCorners`), not an import of it:
* `l-shape.ts` sits in a bundler-only circular import chain with
* `geometry.ts`/`config.ts` (fine under Vite/rolldown, unresolvable by
* Node's native ESM loader), and this module must stay loadable directly by
* `test-pool-lighting.mjs`. Winding-aware: works for either CW or CCW input. */
function hasReflexCorner(outline) {
	if (outline.length < 4) return false;
	let signedAreaSum = 0;
	for (let i = 0; i < outline.length; i++) {
		const [x1, z1] = outline[i];
		const [x2, z2] = outline[(i + 1) % outline.length];
		signedAreaSum += x1 * z2 - x2 * z1;
	}
	const ccw = signedAreaSum >= 0;
	return outline.some((point, i) => {
		const previous = outline[(i - 1 + outline.length) % outline.length];
		const next = outline[(i + 1) % outline.length];
		const inX = point[0] - previous[0];
		const inZ = point[1] - previous[1];
		const outX = next[0] - point[0];
		const cross = inX * (next[1] - point[1]) - inZ * outX;
		return ccw ? cross < -1e-9 : cross > 1e-9;
	});
}
/**
* Merge consecutive outline edges into longer "logical" wall chords while
* every point between the chord's endpoints stays within `tolerance` of the
* straight line between them. For a rectangle/L-shape outline (only ever a
* handful of true corner vertices) this is a no-op -- the very first
* candidate chord already deviates past `tolerance` at the next real corner,
* so the result is byte-identical to the raw per-vertex edges every existing
* lighting test asserts against. For a densely-sampled curve outline (the
* Organic shape, ~15-25cm point spacing) it collapses the low-curvature runs
* of the curve into real, placeable candidate walls instead of leaving every
* edge a few centimetres long and unconditionally rejected by the
* `cornerClearance`-based length filter below -- exactly the "arc-length
* distribution along candidate curve segments instead of assuming straight
* polygon walls" the Organic shape needs, without a parallel
* Organic-specific formula: the merged chord's own endpoints are always real
* outline vertices, so every downstream containment/exclusion check still
* runs against the true curve, only the candidate wall's tangent/normal is
* approximated locally.
*/
function mergedWallChords(outline, tolerance = .06) {
	const n = outline.length;
	if (n < 3) return [];
	const pointLineDistance = (p, a, b) => {
		const dx = b[0] - a[0];
		const dz = b[1] - a[1];
		const lengthSquared = dx * dx + dz * dz;
		if (lengthSquared < 1e-12) return Math.hypot(p[0] - a[0], p[1] - a[1]);
		const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / lengthSquared));
		return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
	};
	const chords = [];
	let startIndex = 0;
	let consumed = 0;
	while (consumed < n) {
		let bestSteps = 1;
		for (let steps = 2; steps <= n - consumed; steps++) {
			const endIndex = (startIndex + steps) % n;
			const start = outline[startIndex];
			const end = outline[endIndex];
			let withinTolerance = true;
			for (let k = 1; k < steps; k++) {
				const point = outline[(startIndex + k) % n];
				if (pointLineDistance(point, start, end) > tolerance) {
					withinTolerance = false;
					break;
				}
			}
			if (!withinTolerance) break;
			bestSteps = steps;
		}
		const endIndex = (startIndex + bestSteps) % n;
		const a = outline[startIndex];
		const b = outline[endIndex];
		chords.push({
			a,
			b,
			length: Math.hypot(b[0] - a[0], b[1] - a[1])
		});
		startIndex = endIndex;
		consumed += bestSteps;
	}
	return chords;
}
/** Lighting DESIGN defaults, not a statutory light count or a compliance check. */
const POOL_LIGHTING_DESIGN = {
	targetIlluminance: 45,
	utilization: .65,
	maintenance: .85,
	referenceDepth: 1.5,
	depthAllowance: .2,
	maxSpacing: 4,
	minCount: 2,
	maxRenderedCount: 8,
	submergence: .6,
	floorClearance: .2,
	cornerClearance: .6,
	fixtureRadius: .08
};
const POOL_LUMINAIRE = {
	diameter: POOL_LIGHTING_DESIGN.fixtureRadius * 2,
	lumens: 1500,
	trim: "steel",
	installation: "fixed-immersed",
	requiredIngressProtection: "IP68; verify declared continuous-immersion conditions",
	supplyAssumption: "12 V AC SELV; transformer and installation to be designed separately",
	certification: "Pool-use certification and installation instructions must be verified",
	complianceVerified: false
};
function insideLightingOutline(x, z, outline) {
	let inside = false;
	for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
		const a = outline[i], b = outline[j];
		if (a[1] > z !== b[1] > z && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
	}
	return inside;
}
function segmentDistance(x, z, a, b) {
	const dx = b[0] - a[0], dz = b[1] - a[1];
	const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
	return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}
function clearsLightingExclusions(x, z, exclusions, radius = POOL_LIGHTING_DESIGN.fixtureRadius) {
	return exclusions.every((exclusion) => {
		if (exclusion.kind !== "access") return Math.hypot(x - exclusion.x, z - exclusion.z) > exclusion.radius + radius;
		if (insideLightingOutline(x, z, exclusion.polygon)) return false;
		return exclusion.polygon.every((a, i) => segmentDistance(x, z, a, exclusion.polygon[(i + 1) % exclusion.polygon.length]) > exclusion.clearance + radius);
	});
}
/** One symmetric row on a clear long wall. Never force a fixture into an obstacle. */
function planPoolLighting({ outline, waterY, floorY, floorYAt = () => floorY, lumenOutput = POOL_LUMINAIRE.lumens, exclusions = [], design = POOL_LIGHTING_DESIGN, infinityExcluded = null }) {
	const area = Math.abs(signedWaterArea(outline));
	const depthFactor = 1 + design.depthAllowance * Math.max(0, waterY - floorY - design.referenceDepth);
	const coveragePerFixture = lumenOutput * design.utilization * design.maintenance / (design.targetIlluminance * depthFactor);
	const requestedCount = Number.isFinite(area / coveragePerFixture) && coveragePerFixture > 0 ? Math.ceil(area / coveragePerFixture) : 0;
	const result = {
		count: 0,
		requestedCount,
		surfaceArea: area,
		submergence: design.submergence,
		coveragePerFixture,
		positions: [],
		warnings: []
	};
	if (outline.length < 3 || !outline.every((p) => p.every(Number.isFinite)) || !Number.isFinite(waterY) || !Number.isFinite(floorY) || requestedCount < 1) {
		result.warnings.push("Invalid pool or provisional luminaire data");
		return result;
	}
	const count = Math.min(requestedCount, design.maxRenderedCount);
	if (count < requestedCount) result.warnings.push("Preview fixture budget reached; specialist layout required");
	const skimmers = skimmerWall(outline, infinityExcluded);
	const axis = skimmers.axis === "x" ? 0 : 1;
	const runs = boundaryRuns(outline, infinityExcluded).filter((r) => r.length > 2 * design.cornerClearance).sort((a, b) => b.length - a.length || Math.abs(b.points[0][axis] - skimmers.coordinate) - Math.abs(a.points[0][axis] - skimmers.coordinate));
	const fixture = (run, station) => {
		const p = sampleWall(run, station);
		if (!clearsLightingExclusions(p.x, p.z, exclusions, design.fixtureRadius)) return null;
		if (![
			-design.fixtureRadius,
			0,
			design.fixtureRadius
		].every((t) => pointInBasin(p.x + p.nx * .06 + p.tx * t, p.z + p.nz * .06 + p.tz * t, outline))) return null;
		const localFloor = Math.max(...[
			-design.fixtureRadius,
			0,
			design.fixtureRadius
		].map((t) => floorYAt(p.x + p.nx * .04 + p.tx * t, p.z + p.nz * .04 + p.tz * t)));
		const immersion = Math.min(design.submergence, waterY - localFloor - design.floorClearance - design.fixtureRadius);
		if (immersion < design.fixtureRadius + .08) return null;
		let throwDistance = .1;
		while (throwDistance < 40 && pointInBasin(p.x + p.nx * (throwDistance + .1), p.z + p.nz * (throwDistance + .1), outline)) throwDistance += .1;
		if (throwDistance < .6) return null;
		return {
			x: p.x,
			z: p.z,
			y: waterY - immersion,
			rotation: Math.atan2(p.nx, p.nz),
			throwDistance
		};
	};
	const row = (run, n) => {
		if (!n) return [];
		for (const contraction of [
			1,
			.9,
			.8,
			.7
		]) {
			const span = Math.min(run.length * (n - 1) / n, run.length - 2 * design.cornerClearance) * contraction;
			if (n > 1 && span / (n - 1) < 2 * design.fixtureRadius + .35) continue;
			const points = Array.from({ length: n }, (_, i) => fixture(run, run.length / 2 + (n === 1 ? 0 : span * (i / (n - 1) - .5))));
			if (points.every((p) => p !== null)) return points;
		}
		const stations = [];
		for (let s = design.cornerClearance; s <= run.length - design.cornerClearance; s += .05) {
			const p = fixture(run, s);
			if (p) stations.push(p);
		}
		if (stations.length >= n) {
			const points = Array.from({ length: n }, (_, i) => stations[Math.min(stations.length - 1, Math.floor(stations.length * (i + .5) / n))]);
			if (points.every((p, i) => points.slice(0, i).every((q) => Math.hypot(p.x - q.x, p.z - q.z) >= 2 * design.fixtureRadius + .35))) return points;
		}
		return null;
	};
	for (const primary of runs) {
		if (hasReflexCorner(outline) && count > 1) {
			const centre = sampleWall(primary, primary.length / 2);
			const alternatives = runs.filter((r) => r !== primary).sort((a, b) => {
				const pa = sampleWall(a, a.length / 2), pb = sampleWall(b, b.length / 2);
				return Math.hypot(pb.x - centre.x, pb.z - centre.z) - Math.hypot(pa.x - centre.x, pa.z - centre.z);
			});
			for (const secondary of alternatives) {
				const secondaryCount = Math.max(1, Math.min(count - 1, Math.round(count * secondary.length / (primary.length + secondary.length))));
				const a = row(primary, count - secondaryCount), b = row(secondary, secondaryCount);
				if (a && b && a.every((p) => b.every((q) => Math.hypot(p.x - q.x, p.z - q.z) > .8))) {
					result.positions = [...a, ...b];
					result.count = result.positions.length;
					return result;
				}
			}
		}
		const points = row(primary, count);
		if (points) {
			result.positions = points;
			result.count = points.length;
			return result;
		}
	}
	for (const run of runs) {
		const slots = Math.max(1, Math.floor((run.length - 2 * design.cornerClearance) / 1.2) + 1);
		for (let i = 0; i < slots && result.positions.length < count; i++) {
			const p = fixture(run, run.length * (i + .5) / slots);
			if (p && result.positions.every((q) => Math.hypot(p.x - q.x, p.z - q.z) >= 1.2)) result.positions.push(p);
		}
	}
	result.count = result.positions.length;
	if (result.count < count) result.warnings.push("Insufficient collision-free wall length; specialist layout required");
	return result;
}
require_jsx_runtime();
/** Metres. Internal design criteria, not certified regulatory limits. */
const ACCESS_DIMENSIONS = {
	maxRise: .25,
	minRise: .15,
	tread: .3,
	minWidth: .8,
	maxWidth: 1.15,
	cornerFirstRadius: .45,
	landingTolerance: .005,
	landingClearance: .3,
	fittingClearance: .32,
	ladderPitch: .28,
	ladderFloorClearance: .18,
	ladderMaxTreads: 5,
	ladderWidth: .5,
	ladderRun: .55,
	ladderTubeRadius: .021,
	ladderFootDrop: .1,
	ladderFootPad: .035
};
/** Real wall intersections for the two lower ladder returns, in local coordinates. */
function ladderWallContacts(outline, placement) {
	const c = Math.cos(placement.rotation), s = Math.sin(placement.rotation);
	const local = outline.map(([x, z]) => [c * (x - placement.x) - s * (z - placement.z), s * (x - placement.x) + c * (z - placement.z)]);
	return [-ACCESS_DIMENSIONS.ladderWidth / 2, ACCESS_DIMENSIONS.ladderWidth / 2].map((x) => {
		const hits = local.flatMap((a, i) => {
			const b = local[(i + 1) % local.length];
			if (Math.abs(b[0] - a[0]) < 1e-8) return [];
			const t = (x - a[0]) / (b[0] - a[0]);
			if (t < 0 || t > 1) return [];
			const z = a[1] + t * (b[1] - a[1]);
			return z <= .05 ? [z] : [];
		});
		return {
			x,
			z: hits.length ? Math.max(...hits) : NaN
		};
	});
}
/** Same SL-style return as the reference, with a monotone lower bend. */
function ladderRailCurve(anchorOffset, lastDepth, wallZ) {
	const bottomY = -lastDepth - ACCESS_DIMENSIONS.ladderFootDrop;
	const path = new THREE.CurvePath();
	path.add(new THREE.CatmullRomCurve3([
		new THREE.Vector3(0, 0, -anchorOffset),
		new THREE.Vector3(0, .62, -anchorOffset),
		new THREE.Vector3(0, .76, 0),
		new THREE.Vector3(0, .62, .26),
		new THREE.Vector3(0, .12, .32),
		new THREE.Vector3(0, -lastDepth, .32)
	], false, "centripetal"));
	path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -lastDepth, .32), new THREE.Vector3(0, bottomY, .32), new THREE.Vector3(0, bottomY, .22)));
	path.add(new THREE.LineCurve3(new THREE.Vector3(0, bottomY, .22), new THREE.Vector3(0, bottomY, wallZ + ACCESS_DIMENSIONS.ladderFootPad)));
	return path;
}
/**
* Select a wall with enough clear interior space for the entire access
* footprint, then place the access on it the way that access type is actually
* installed:
*
* - Internal steps are entered from a SHORT wall and pushed hard into the
*   corner, so one flank of the flight lands against the long wall the way a
*   built staircase does. Centred on the end wall it read as a free-standing
*   object dropped into the basin, with an unusable slot of water behind each
*   side.
* - The stainless ladder is a deck-mounted grab rail: it belongs on a LONG
*   wall, hard against the far corner, and never on the wall carrying the
*   skimmer run -- which is exactly where the shared "longest wall, 22% along"
*   default used to put it.
*
* `floorProfile` (Geometry Pass A follow-up): on a sloped floor, internal
* steps additionally prefer whichever short wall sits at the SHALLOW end --
* physically intuitive, safer, and the only end a customer would expect to
* wade in from. This is a secondary sort key, applied only among walls that
* already satisfy every existing constraint (length, clearance, basin
* containment): the shallow wall wins the tie only when it is itself a
* valid placement, and the search falls through to the next-best wall
* exactly as it always has otherwise. Never applied to the ladder, whose
* placement philosophy is unrelated to the floor profile. The preference
* reads live off the canonical `FloorProfileModel` (never a cached wall
* index), so reversing the slope re-derives it automatically.
* With Infinity, the opposite wall takes priority; a lateral wall is used
* only when the opposite one cannot fit a clear access footprint.
*/
function accessPlacement(outline, run, width, access = null, floorProfile, infinityExcluded = null, accept) {
	const inside = (x, z) => {
		let hit = false;
		for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
			const a = outline[i], b = outline[j];
			if (a[1] > z !== b[1] > z && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
		}
		return hit;
	};
	const skimmers = skimmerWall(outline);
	const wallProximity = .3;
	const onSkimmerWall = (a, b) => {
		const index = skimmers.axis === "x" ? 0 : 1;
		return Math.abs(a[index] - skimmers.coordinate) < wallProximity && Math.abs(b[index] - skimmers.coordinate) < wallProximity;
	};
	const shortWallAccess = access === "internalSteps";
	const edgeMargin = shortWallAccess ? .02 : .1;
	const atSkimmerEnd = (point) => Math.abs(point[skimmers.axis === "x" ? 0 : 1] - skimmers.coordinate) < wallProximity;
	const preferShallow = shortWallAccess && floorProfile?.sloped === true;
	const shallowAxisIndex = floorProfile?.axis === "x" ? 0 : 1;
	const shallowCoordinate = floorProfile ? floorProfile.shallowAtMin ? floorProfile.axisMin : floorProfile.axisMax : 0;
	const onShallowWall = (a, b) => Math.abs(a[shallowAxisIndex] - shallowCoordinate) < wallProximity && Math.abs(b[shallowAxisIndex] - shallowCoordinate) < wallProximity;
	const infinityAxisIndex = infinityExcluded ? infinityExcluded.axis === "x" ? 0 : 1 : null;
	const oppositeCoordinate = infinityExcluded ? oppositeInfinityCoordinate(outline, infinityExcluded) : null;
	const oppositeBand = oppositeCoordinate === null || !infinityExcluded ? wallProximity : Math.max(wallProximity, Math.abs(oppositeCoordinate - infinityExcluded.coordinate) * .12);
	const onInfinityWall = (a, b) => infinityAxisIndex !== null && infinityExcluded !== null && Math.abs(a[infinityAxisIndex] - infinityExcluded.coordinate) < wallProximity && Math.abs(b[infinityAxisIndex] - infinityExcluded.coordinate) < wallProximity;
	const onOppositeWall = (a, b) => infinityAxisIndex !== null && oppositeCoordinate !== null && Math.abs(a[infinityAxisIndex] - oppositeCoordinate) < oppositeBand && Math.abs(b[infinityAxisIndex] - oppositeCoordinate) < oppositeBand;
	const lateralWall = (a, b, length) => infinityAxisIndex !== null && Math.abs(b[infinityAxisIndex] - a[infinityAxisIndex]) >= length * .5;
	for (const tolerance of [
		.06,
		.15,
		.3,
		.6,
		1
	]) {
		const edges = mergedWallChords(outline, tolerance).map(({ a, b, length }) => ({
			a,
			b,
			length,
			skimmerWall: onSkimmerWall(a, b),
			shallowWall: preferShallow && onShallowWall(a, b),
			oppositeWall: onOppositeWall(a, b)
		})).filter(({ a, b, length }) => !onInfinityWall(a, b) && (!infinityExcluded || onOppositeWall(a, b) || lateralWall(a, b, length))).sort((first, second) => {
			if (first.oppositeWall !== second.oppositeWall) return first.oppositeWall ? -1 : 1;
			if (!shortWallAccess && first.skimmerWall !== second.skimmerWall) return first.skimmerWall ? 1 : -1;
			if (preferShallow && first.shallowWall !== second.shallowWall) return first.shallowWall ? -1 : 1;
			return shortWallAccess ? first.length - second.length : second.length - first.length;
		});
		for (const { a, b, length } of edges) {
			if (length < width + .2) continue;
			const tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
			const cornerFirst = shortWallAccess ? atSkimmerEnd(a) : false;
			const fractions = shortWallAccess ? cornerFirst ? [
				0,
				1,
				.5
			] : [
				1,
				0,
				.5
			] : [
				.88,
				.12,
				.5
			];
			for (const fraction of fractions) {
				const along = THREE.MathUtils.clamp(length * fraction, width / 2 + edgeMargin, length - width / 2 - edgeMargin);
				const x = a[0] + tx * along, z = a[1] + tz * along;
				if (infinityExcluded?.edgeIndices?.some((index) => {
					const p = outline[index], q = outline[(index + 1) % outline.length];
					const dx = q[0] - p[0], dz = q[1] - p[1];
					const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / (dx * dx + dz * dz)));
					return Math.hypot(x - p[0] - t * dx, z - p[1] - t * dz) < width / 2 + .15;
				})) continue;
				const sign = inside(x - tz * .05, z + tx * .05) ? 1 : -1;
				const nx = -tz * sign, nz = tx * sign;
				let clear = true;
				for (let d = .05; d <= run + (shortWallAccess ? ACCESS_DIMENSIONS.landingClearance : .05); d += .1) for (let w = -width / 2; w <= width / 2 + 1e-6; w += width / 8) if (!inside(x + nx * d + nz * w, z + nz * d - nx * w)) clear = false;
				const candidate = {
					x,
					z,
					rotation: Math.atan2(nx, nz)
				};
				if (clear && (!accept || accept(candidate))) return candidate;
			}
		}
	}
	return null;
}
/** Treads and risers shared by both internal staircases, so switching variant
*  changes the shape of the flight and never how steep it is. */
function internalStairFlight(floorY, topY) {
	const riseCount = Math.max(3, Math.ceil((topY - floorY) / ACCESS_DIMENSIONS.maxRise));
	return {
		riseCount,
		rise: (topY - floorY) / riseCount,
		steps: riseCount - 1
	};
}
/**
* Fixed, usable radial pitch. Depth determines the tread count; the basin
* determines availability, never a compressed version of the same flight.
*/
function cornerStairRadii(shortSpan, steps) {
	const radii = Array.from({ length: steps }, (_, i) => ACCESS_DIMENSIONS.cornerFirstRadius + i * ACCESS_DIMENSIONS.tread);
	return {
		radii,
		outerRadius: radii[radii.length - 1]
	};
}
/**
* A radial corner staircase: quarter-round treads growing outward from the
* corner as they descend, the way a Roman corner flight is actually built.
*
* Not a straight flight with its nose rounded off -- every tread is concentric
* about the corner vertex, so the two flanks land flat against the two walls
* and the nosings fan out into the basin.
*
* The outer radius follows the riser count at constant tread depth.
* Reject corners without enough basin space and a clear bottom landing.
*
* `floorProfile` (Geometry Pass A follow-up): among the (at most two) valid
* corners on the skimmer wall, prefer whichever sits at the shallow end --
* same reasoning and same live canonical-model read as `accessPlacement`'s
* shallow-wall preference. Geometric validity (square corner, full outer
* radius clear on both flanks and the diagonal) is checked first and is
* never relaxed for this preference; a shallow corner that fails validity
* is simply not a candidate, and the deep one is used instead.
*/
function cornerStairPlan(outline, floorY, topY, floorProfile, infinityExcluded = null, accept) {
	if (outline.length < 3) return null;
	const skimmers = skimmerWall(outline, infinityExcluded);
	const infinityAxisIndex = infinityExcluded ? infinityExcluded.axis === "x" ? 0 : 1 : null;
	const oppositeCoordinate = infinityExcluded ? oppositeInfinityCoordinate(outline, infinityExcluded) : null;
	skimmers.axis;
	const centre = [outline.reduce((sum, [x]) => sum + x, 0) / outline.length, outline.reduce((sum, [, z]) => sum + z, 0) / outline.length];
	let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
	for (const [x, z] of outline) {
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minZ = Math.min(minZ, z);
		maxZ = Math.max(maxZ, z);
	}
	const shortSpan = Math.min(maxX - minX, maxZ - minZ);
	const { rise, steps } = internalStairFlight(floorY, topY);
	const { radii, outerRadius } = cornerStairRadii(shortSpan, steps);
	const flight = linearStairDimensions(floorY, topY);
	const straight = accessPlacement(outline, flight.run, flight.width, "internalSteps", floorProfile, infinityExcluded);
	const preferShallow = floorProfile?.sloped === true;
	const shallowAxisIndex = floorProfile?.axis === "x" ? 0 : 1;
	const shallowCoordinate = floorProfile ? floorProfile.shallowAtMin ? floorProfile.axisMin : floorProfile.axisMax : 0;
	const isShallowCorner = (point) => preferShallow && Math.abs(point[shallowAxisIndex] - shallowCoordinate) < 1e-6;
	let best = null;
	let bestTier = Infinity;
	let bestOppositeTier = Infinity;
	let bestDistance = Infinity;
	for (let i = 0; i < outline.length; i++) {
		const point = outline[i];
		if (infinityExcluded?.edgeIndices?.some((edge) => edge === i || (edge + 1) % outline.length === i)) continue;
		const previous = outline[(i - 1 + outline.length) % outline.length];
		const next = outline[(i + 1) % outline.length];
		const first = normalise(next[0] - point[0], next[1] - point[1]);
		const second = normalise(previous[0] - point[0], previous[1] - point[1]);
		if (!first || !second) continue;
		if (Math.abs(first[0] * second[0] + first[1] * second[1]) > .001) continue;
		if (infinityAxisIndex !== null && infinityExcluded !== null && Math.abs(point[infinityAxisIndex] - infinityExcluded.coordinate) < 1e-6 && (Math.abs(previous[infinityAxisIndex] - infinityExcluded.coordinate) < 1e-6 || Math.abs(next[infinityAxisIndex] - infinityExcluded.coordinate) < 1e-6)) continue;
		const reach = (along, off, distance) => insideOutline(outline, point[0] + along[0] * distance + off[0] * .08, point[1] + along[1] * distance + off[1] * .08);
		const diagonal = normalise(first[0] + second[0], first[1] + second[1]);
		if (!reach(first, second, outerRadius * .96) || !reach(second, first, outerRadius * .96) || !diagonal || !reach(diagonal, diagonal, outerRadius * .96)) continue;
		if ((centre[0] - point[0]) * (first[0] + second[0]) + (centre[1] - point[1]) * (first[1] + second[1]) <= 0) continue;
		const footprint = [
			point,
			[point[0] + first[0] * outerRadius, point[1] + first[1] * outerRadius],
			[point[0] + (first[0] + second[0]) * outerRadius, point[1] + (first[1] + second[1]) * outerRadius],
			[point[0] + second[0] * outerRadius, point[1] + second[1] * outerRadius]
		];
		let contained = true;
		for (let j = 1; j < 64; j++) {
			const angle = j / 64 * Math.PI / 2;
			const r = outerRadius + ACCESS_DIMENSIONS.landingClearance;
			if (!insideOutline(outline, point[0] + r * (first[0] * Math.cos(angle) + second[0] * Math.sin(angle)), point[1] + r * (first[1] * Math.cos(angle) + second[1] * Math.sin(angle)))) contained = false;
		}
		for (let angle = .02; angle < Math.PI / 2; angle += .06) for (let r = .1; r <= outerRadius + .01; r += .1) if (!insideOutline(outline, point[0] + r * (first[0] * Math.cos(angle) + second[0] * Math.sin(angle)), point[1] + r * (first[1] * Math.cos(angle) + second[1] * Math.sin(angle)))) contained = false;
		if (!contained || accept && !accept(footprint)) continue;
		const distance = straight ? Math.hypot(point[0] - straight.x, point[1] - straight.z) : i;
		const tier = isShallowCorner(point) ? 0 : 1;
		const oppositeTier = infinityAxisIndex !== null && oppositeCoordinate !== null && Math.abs(point[infinityAxisIndex] - oppositeCoordinate) < 1e-6 && (Math.abs(previous[infinityAxisIndex] - oppositeCoordinate) < 1e-6 || Math.abs(next[infinityAxisIndex] - oppositeCoordinate) < 1e-6) ? 0 : 1;
		if (oppositeTier > bestOppositeTier || oppositeTier === bestOppositeTier && (tier > bestTier || tier === bestTier && distance >= bestDistance)) continue;
		bestOppositeTier = oppositeTier;
		bestTier = tier;
		bestDistance = distance;
		best = {
			point,
			into: [first, second]
		};
	}
	if (!best) return null;
	const [alpha, beta] = best.into;
	const yawFor = (direction) => Math.atan2(direction[0], direction[1]);
	let rotation = yawFor(alpha);
	if (Math.cos(rotation) * beta[0] - Math.sin(rotation) * beta[1] < .9) rotation = yawFor(beta);
	const [u, v] = Math.abs(yawFor(alpha) - rotation) < 1e-9 ? [alpha, beta] : [beta, alpha];
	const inset = .014;
	const x = best.point[0] - (u[0] + v[0]) * inset;
	const z = best.point[1] - (u[1] + v[1]) * inset;
	const corner = best.point;
	const footprint = [
		[corner[0], corner[1]],
		[corner[0] + u[0] * outerRadius, corner[1] + u[1] * outerRadius],
		[corner[0] + (u[0] + v[0]) * outerRadius, corner[1] + (u[1] + v[1]) * outerRadius],
		[corner[0] + v[0] * outerRadius, corner[1] + v[1] * outerRadius]
	];
	return {
		x,
		z,
		rotation,
		radii,
		rise,
		footprint
	};
}
function normalise(x, z) {
	const length = Math.hypot(x, z);
	return length < 1e-6 ? null : [x / length, z / length];
}
function insideOutline(outline, x, z) {
	let hit = false;
	for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
		const a = outline[i], b = outline[j];
		if (a[1] > z !== b[1] > z && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
	}
	return hit;
}
/** Plan dimensions for the straight flight, shared by the mesh and by anything
*  that has to keep fittings clear of it. */
function linearStairDimensions(floorY, topY) {
	const { riseCount, rise, steps } = internalStairFlight(floorY, topY);
	const tread = ACCESS_DIMENSIONS.tread;
	return {
		riseCount,
		rise,
		steps,
		tread,
		width: ACCESS_DIMENSIONS.maxWidth,
		run: steps * tread
	};
}
function resolveAccessPlan({ outline, access, stairType = "linear", floorProfile, topY, infinityExcluded = null, obstacles = [], reservedFootprints = [], ladderAnchorOffset = .2, ladderAnchorY = topY, ladderDeckAvailable = true, mirrorAnchor = null, rectangularCorner = false }) {
	const empty = {
		placement: null,
		corner: null,
		riseCount: 0,
		steps: 0,
		rise: 0,
		tread: ACCESS_DIMENSIONS.tread,
		width: 0,
		run: 0,
		footprint: [],
		ladderDepths: [],
		ladderAnchorOffset,
		ladderAnchorY,
		reason: "Spazio insufficiente per pedate e alzate regolari, senza interferenze."
	};
	if (!access) return empty;
	const clearOfFittings = (polygon) => clearOfInfinityEdge(outline, infinityExcluded, polygon) && !reservedFootprints.some((reserved) => {
		const bounds = (points) => ({
			minX: Math.min(...points.map((p) => p[0])),
			maxX: Math.max(...points.map((p) => p[0])),
			minZ: Math.min(...points.map((p) => p[1])),
			maxZ: Math.max(...points.map((p) => p[1]))
		});
		const a = bounds(polygon), b = bounds(reserved), gap = .2;
		return a.maxX + gap > b.minX && a.minX - gap < b.maxX && a.maxZ + gap > b.minZ && a.minZ - gap < b.maxZ;
	}) && !obstacles.some((p) => {
		if (insideOutline(polygon, p.x, p.z)) return true;
		return polygon.some((a, i) => {
			const b = polygon[(i + 1) % polygon.length];
			const dx = b[0] - a[0], dz = b[1] - a[1];
			const t = THREE.MathUtils.clamp(((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
			return Math.hypot(p.x - a[0] - t * dx, p.z - a[1] - t * dz) < ACCESS_DIMENSIONS.fittingClearance;
		});
	});
	const footprintAt = (p, width, run) => [
		[-width / 2, 0],
		[width / 2, 0],
		[width / 2, run],
		[-width / 2, run]
	].map(([x, z]) => [p.x + Math.cos(p.rotation) * x + Math.sin(p.rotation) * z, p.z - Math.sin(p.rotation) * x + Math.cos(p.rotation) * z]);
	if (access === "internalSteps" && stairType === "corner") {
		if (floorProfile.sloped) return {
			...empty,
			reason: "Scala angolare non disponibile sul fondo inclinato: il raccordo curvo richiede un pianerottolo piano."
		};
		const candidate = cornerStairPlan(outline, floorProfile.deepFloorY, topY, floorProfile, infinityExcluded, (footprint) => (!mirrorAnchor || Math.hypot(footprint[0][0] - mirrorAnchor.x, footprint[0][1] - mirrorAnchor.z) < .02) && clearOfFittings(footprint));
		const corner = candidate && rectangularCorner ? {
			...candidate,
			rectangular: true
		} : candidate;
		if (!corner) return {
			...empty,
			reason: "Nessun angolo retto libero con spazio sufficiente per i gradini curvi."
		};
		return {
			...empty,
			corner,
			placement: corner,
			steps: corner.radii.length,
			riseCount: corner.radii.length + 1,
			rise: corner.rise,
			width: corner.radii.at(-1),
			run: corner.radii.at(-1),
			footprint: corner.footprint,
			reason: ""
		};
	}
	const boundsX = outline.map((p) => p[0]), boundsZ = outline.map((p) => p[1]);
	const shortSpan = Math.min(Math.max(...boundsX) - Math.min(...boundsX), Math.max(...boundsZ) - Math.min(...boundsZ));
	const width = access === "internalSteps" ? THREE.MathUtils.clamp(shortSpan * .32, ACCESS_DIMENSIONS.minWidth, ACCESS_DIMENSIONS.maxWidth) : .62;
	if (access === "stainlessSteelLadder") {
		if (!ladderDeckAvailable) return {
			...empty,
			reason: "Serve un piano esterno portante oltre il canale di sfioro."
		};
		let depths = [];
		const placement = accessPlacement(outline, ACCESS_DIMENSIONS.ladderRun, width, access, floorProfile, infinityExcluded, (p) => {
			const footprint = footprintAt(p, width, ACCESS_DIMENSIONS.ladderRun);
			const shelfZone = floorProfile.shelfZone;
			if (shelfZone && footprint.some((point) => {
				const coordinate = point[floorProfile.axis === "x" ? 0 : 1];
				return shelfZone.atMin ? coordinate < shelfZone.slopeStart + .3 : coordinate > shelfZone.slopeStart - .3;
			})) return false;
			if (!clearOfFittings(footprint)) return false;
			const contacts = ladderWallContacts(outline, p);
			if (contacts.some((contact) => !Number.isFinite(contact.z))) return false;
			const c = Math.cos(p.rotation), s = Math.sin(p.rotation);
			const contactFloors = contacts.map(({ x, z }) => floorProfile.floorYAt(p.x + c * x + s * z, p.z - s * x + c * z));
			const floorY = Math.max(...contactFloors, ...footprint.map(([x, z]) => floorProfile.floorYAt(x, z)));
			depths = Array.from({ length: ACCESS_DIMENSIONS.ladderMaxTreads }, (_, i) => (i + 1) * ACCESS_DIMENSIONS.ladderPitch).filter((d) => d <= ladderAnchorY - floorY - ACCESS_DIMENSIONS.ladderFloorClearance);
			const nx = Math.sin(p.rotation), nz = Math.cos(p.rotation);
			for (const w of [-.25, .25]) for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) if (insideOutline(outline, p.x - nx * ladderAnchorOffset + nz * w + Math.cos(a) * .06, p.z - nz * ladderAnchorOffset - nx * w + Math.sin(a) * .06)) return false;
			return depths.length >= 2;
		});
		return placement ? {
			...empty,
			placement,
			width,
			run: ACCESS_DIMENSIONS.ladderRun,
			footprint: footprintAt(placement, width, ACCESS_DIMENSIONS.ladderRun),
			ladderDepths: depths,
			steps: depths.length,
			tread: ACCESS_DIMENSIONS.ladderPitch,
			reason: ""
		} : empty;
	}
	const estimate = Math.ceil((topY - floorProfile.shallowFloorY) / ACCESS_DIMENSIONS.maxRise);
	const counts = Array.from({ length: 8 }, (_, i) => i + 3).sort((a, b) => Math.abs(a - estimate) - Math.abs(b - estimate));
	for (const riseCount of counts) {
		const steps = riseCount - 1, run = steps * ACCESS_DIMENSIONS.tread;
		let rise = 0;
		const placement = accessPlacement(outline, run, width, access, floorProfile, infinityExcluded, (p) => {
			const footprint = footprintAt(p, width, run);
			if (mirrorAnchor && Math.hypot(p.x - mirrorAnchor.x, p.z - mirrorAnchor.z) > .02) return false;
			if (!clearOfFittings(footprint)) return false;
			const ends = footprint.slice(2).map(([x, z]) => floorProfile.floorYAt(x, z));
			if (Math.abs(ends[0] - ends[1]) > ACCESS_DIMENSIONS.landingTolerance) return false;
			rise = (topY - (ends[0] + ends[1]) / 2) / riseCount;
			if (rise < ACCESS_DIMENSIONS.minRise || rise > ACCESS_DIMENSIONS.maxRise) return false;
			return Array.from({ length: steps }, (_, i) => {
				const treadTop = topY - (i + 1) * rise;
				return [
					-width / 2,
					0,
					width / 2
				].every((x) => [i * ACCESS_DIMENSIONS.tread, (i + 1) * ACCESS_DIMENSIONS.tread].every((z) => treadTop > floorProfile.floorYAt(p.x + Math.cos(p.rotation) * x + Math.sin(p.rotation) * z, p.z - Math.sin(p.rotation) * x + Math.cos(p.rotation) * z) + .02));
			}).every(Boolean);
		});
		if (placement) return {
			...empty,
			placement,
			riseCount,
			steps,
			rise,
			width,
			run,
			footprint: footprintAt(placement, width, run),
			reason: ""
		};
	}
	return empty;
}
/** Disjoint rectangular corner treads, as in the above-ground photographs. */
function rectangularCornerTread(inner, outer) {
	return inner > 0 ? [
		[0, outer],
		[outer, outer],
		[outer, 0],
		[inner, 0],
		[inner, inner],
		[0, inner]
	] : [
		[0, outer],
		[outer, outer],
		[outer, 0],
		[0, 0]
	];
}
//#endregion
//#region src/components/pool/three/poolConstruction.ts
/** Architectural presentation only; never changes basin dimensions or quotation logic. */
function copingOuterOffset(system, overflow) {
	if (system === "overflow" && overflow === "visible") return OVERFLOW_GEOMETRY.visibleChannelOuterOffset;
	return .32 + (system === "overflow" ? OVERFLOW_GEOMETRY.hiddenChannelOffset : 0);
}
//#endregion
//#region src/lib/pool/access-plan.ts
/** Flanges sit on coping, or beyond an overflow channel on the ground deck. */
function accessMounting(system, overflow, layout) {
	const beyondChannel = system === "overflow";
	return {
		ladderAnchorOffset: beyondChannel ? copingOuterOffset(system, overflow) + .12 : .2,
		ladderAnchorY: beyondChannel ? layout.groundY : layout.copingY,
		ladderDeckAvailable: !beyondChannel || layout.wallTopY <= layout.groundY + .01
	};
}
//#endregion
//#region src/lib/pool/lighting-plan.ts
/**
* The single source of truth for where the luminaires end up.
*
* Hoisted out of the component so the camera can be aimed at the row that is
* actually built. `planPoolLighting` falls through to the second-longest wall
* whenever skimmers or the access steps obstruct the first, so anything that
* re-derives the wall independently -- as the lighting-step camera used to --
* can end up framing the opposite side of the basin, with the fixtures behind
* the viewer.
*/
function planSceneLighting({ resolvedAccess, resolvedLadder, comfort, outline, layout, skimmers, access, stairType = "linear", floorProfile, infinityExcluded = null, system, overflowType }) {
	const exclusions = skimmers.positions.map((p) => ({
		kind: "skimmer",
		x: p.x,
		z: p.z,
		radius: .65
	}));
	const accessPlan = resolvedAccess ?? resolveAccessPlan({
		outline,
		access,
		stairType,
		floorProfile,
		topY: layout.copingY,
		infinityExcluded,
		obstacles: skimmers.positions,
		...accessMounting(system, overflowType, layout)
	});
	const accessPoint = accessPlan.placement;
	for (const element of comfort?.elements ?? []) for (const footprint of [
		element.footprint,
		...(element.steps ?? []).map((step) => step.footprint),
		...element.landing ? [element.landing.footprint] : []
	]) exclusions.push({
		kind: "access",
		polygon: footprint,
		clearance: .2
	});
	if (accessPoint) exclusions.push({
		kind: "access",
		polygon: accessPlan.footprint,
		clearance: .2
	});
	if (resolvedLadder?.placement) exclusions.push({
		kind: "access",
		polygon: resolvedLadder.footprint,
		clearance: .2
	});
	const plan = planPoolLighting({
		outline,
		waterY: layout.waterY,
		floorY: layout.floorY,
		...floorProfile ? { floorYAt: floorProfile.floorYAt } : {},
		exclusions,
		infinityExcluded
	});
	let shadowIndex = -1, nearest = Infinity;
	const comfortOrigin = comfort?.elements[0]?.footprint[0];
	const shadowOrigin = accessPoint ?? (comfortOrigin ? {
		x: comfortOrigin[0],
		z: comfortOrigin[1]
	} : null);
	if (shadowOrigin) plan.positions.forEach((p, i) => {
		const distance = Math.hypot(p.x - shadowOrigin.x, p.z - shadowOrigin.z);
		if (distance < nearest) {
			nearest = distance;
			shadowIndex = i;
		}
	});
	const turns = outline.map((a, i) => {
		const b = outline[(i + 1) % outline.length], c = outline[(i + 2) % outline.length];
		return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
	});
	const convexQuad = outline.length === 4 && (turns.every((v) => v > 0) || turns.every((v) => v < 0));
	return {
		plan,
		shadowIndex,
		convexQuad,
		accessPlan
	};
}
//#endregion
//#region src/lib/pool/engineering.ts
/** Existing hydraulic sizing retained; this is indicative configuration, not certification. */
function planSkimmers(outline, waterSurface, enabled = true, infinityExcluded = null) {
	if (!enabled || outline.length < 3 || !Number.isFinite(waterSurface) || waterSurface <= 0) return {
		count: 0,
		positions: [],
		spacing: 0,
		cornerDistance: 0
	};
	const count = Math.max(1, Math.ceil(waterSurface / 25));
	const preferred = skimmerWall(outline, infinityExcluded);
	const axis = preferred.axis === "x" ? 0 : 1;
	const runs = boundaryRuns(outline, infinityExcluded).filter((r) => r.length > .588).sort((a, b) => {
		const pa = sampleWall(a, a.length / 2), pb = sampleWall(b, b.length / 2);
		return Math.abs((axis === 0 ? pa.x : pa.z) - preferred.coordinate) - Math.abs((axis === 0 ? pb.x : pb.z) - preferred.coordinate) || b.length - a.length;
	});
	const positions = [];
	let spacing = 0;
	for (const run of runs) {
		const margin = Math.min(.6, run.length / 2);
		const n = Math.min(count - positions.length, Math.max(1, Math.floor((run.length - .588) / .9) + 1));
		if (n <= 0) break;
		const pitch = run.length / n;
		for (let i = 0; i < n; i++) {
			const p = sampleWall(run, Math.max(margin, Math.min(run.length - margin, pitch * (i + .5))));
			if (positions.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < .9)) continue;
			positions.push({
				x: p.x,
				z: p.z,
				rotation: Math.atan2(p.nx, p.nz)
			});
		}
		spacing = pitch;
	}
	return {
		count: positions.length,
		positions,
		spacing,
		cornerDistance: Math.min(.6, spacing / 2)
	};
}
//#endregion
//#region src/lib/pool/stair-lighting.ts
/** Fittings only: derive from the approved flight, never alter its geometry.
* One small fitting per straight riser; corner returns follow their actual
* rectilinear or curved front faces, including mirrored/Infinity placement. */
function planStairMicroSpots(access, comfort, topY, floor) {
	const spots = [];
	if (access.placement && access.steps && !access.ladderDepths.length && !access.reason) {
		const p = access.placement, c = Math.cos(p.rotation), s = Math.sin(p.rotation);
		const place = (x, z, y, nx, nz) => spots.push({
			x: p.x + c * x + s * z,
			z: p.z - s * x + c * z,
			y,
			dir: [c * nx + s * nz, -s * nx + c * nz]
		});
		for (let i = 0; i < access.steps; i++) {
			const y = topY - (i + 1.5) * access.rise;
			const radius = access.corner?.radii[i];
			if (radius !== void 0) {
				if (access.corner?.rectangular) {
					const along = ((i ? access.corner.radii[i - 1] : 0) + radius) / 2;
					place(radius, along, y, 1, 0);
					place(along, radius, y, 0, 1);
				} else {
					const a = Math.PI / 4;
					place(radius * Math.sin(a), radius * Math.cos(a), y, Math.sin(a), Math.cos(a));
				}
			} else place(0, (i + 1) * access.tread, y, 0, 1);
		}
	}
	for (const element of comfort.elements) {
		const steps = element.steps;
		if (!steps?.length || !element.landing) continue;
		const center = (points) => [points.reduce((v, p) => v + p[0], 0) / points.length, points.reduce((v, p) => v + p[1], 0) / points.length];
		const first = center(steps[0].footprint), start = center(element.landing.footprint);
		const dx = first[0] - start[0], dz = first[1] - start[1];
		const dir = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
		[element.landing, ...steps].forEach((part, i, parts) => {
			const mid = center(part.footprint);
			const x = dir[0] ? (dir[0] > 0 ? Math.max : Math.min)(...part.footprint.map((p) => p[0])) : mid[0];
			const z = dir[1] ? (dir[1] > 0 ? Math.max : Math.min)(...part.footprint.map((p) => p[1])) : mid[1];
			const lower = parts[i + 1]?.topY ?? floor.floorYAt(x, z);
			if (part.topY - lower > .08) spots.push({
				x,
				z,
				y: (part.topY + lower) / 2,
				dir
			});
		});
	}
	return spots;
}
//#endregion
//#region src/lib/pool/resolved-layout.ts
function comfortFootprints(plan) {
	return plan.elements.flatMap((element) => [
		element.footprint,
		...(element.steps ?? []).map((step) => step.footprint),
		...element.landing ? [element.landing.footprint] : []
	]);
}
/** User intent -> comfort -> access -> free wall surfaces -> luminaires.
* No resolved state is persisted; all consumers derive the same deterministic plan. */
function resolvePoolLayout(input) {
	const features = normalizeComfortFeatures(input.features);
	const missingShelfLanding = (features.includes("sunShelf") || features.includes("hydromassage")) && input.floorProfile.sloped && !input.floorProfile.shelfZone;
	const comfort = resolveComfortPlan({
		...input,
		separateHydroAccess: input.poolType === "in-ground" && input.access === "internalSteps" && input.stairType === "corner",
		waterY: input.layout.waterY,
		enabled: missingShelfLanding ? features.filter((feature) => feature !== "sunShelf" && feature !== "hydromassage") : features
	});
	if (missingShelfLanding) {
		const reason = "Profondità o spazio insufficienti per scala e pianerottolo regolari prima della pendenza.";
		if (features.includes("sunShelf")) comfort.availability.sunShelf = {
			available: false,
			reason
		};
		if (features.includes("hydromassage")) comfort.availability.hydromassage = {
			available: false,
			reason
		};
	}
	const integrated = comfort.elements.some((element) => element.kind === "sunShelf" || element.kind === "hydromassage" && !!element.steps?.length);
	const ladderAsAddon = input.poolType !== "above-ground" && input.access === "internalSteps" && features.includes("inoxLadder");
	const effectiveAccess = input.poolType === "above-ground" && input.access === "stainlessSteelLadder" || integrated && input.access === "internalSteps" ? null : input.access;
	const mounting = accessMounting(input.system, input.overflowType, input.layout);
	const resolve = (access, reserved) => {
		const request = {
			...input,
			access,
			topY: input.layout.copingY,
			obstacles: input.skimmers.positions,
			reservedFootprints: reserved,
			...mounting,
			rectangularCorner: input.poolType === "above-ground"
		};
		const normal = resolveAccessPlan(request);
		if (input.poolType !== "above-ground" || !input.stairMirrored || access !== "internalSteps" || !normal.placement) return normal;
		const bounds = outlineBounds(input.outline), p = normal.placement, longX = bounds.spanX >= bounds.spanZ;
		return resolveAccessPlan({
			...request,
			mirrorAnchor: {
				x: longX ? p.x : bounds.minX + bounds.maxX - p.x,
				z: longX ? bounds.minZ + bounds.maxZ - p.z : p.z
			}
		});
	};
	const comfortReserved = comfortFootprints(comfort);
	const access = resolve(effectiveAccess, comfortReserved);
	let ladder = null;
	if (ladderAsAddon) {
		const plan = resolve("stainlessSteelLadder", [...comfortReserved, ...access.placement ? [access.footprint] : []]);
		const free = resolve("stainlessSteelLadder", comfortReserved);
		const moved = !!plan.placement && !!free.placement && (Math.abs(plan.placement.x - free.placement.x) > 1e-6 || Math.abs(plan.placement.z - free.placement.z) > 1e-6);
		ladder = {
			plan,
			status: !plan.placement ? "UNAVAILABLE" : moved ? "REPOSITION" : "VALID"
		};
	}
	const activeComfort = comfort.elements.find((element) => element.kind === "sunShelf" || element.kind === "hydromassage");
	if (activeComfort && (!!effectiveAccess && !access.placement || ladder?.status === "UNAVAILABLE")) {
		const reason = access.reason ?? ladder?.plan.reason ?? "Accesso incompatibile con la zona comfort selezionata.";
		const fallback = resolvePoolLayout({
			...input,
			features: features.filter((feature) => ![
				"sunShelf",
				"hydromassage",
				"integratedBench",
				"sunShelfLoungers"
			].includes(feature))
		});
		fallback.comfort.availability[activeComfort.kind] = {
			available: false,
			reason
		};
		return {
			...fallback,
			status: "UNAVAILABLE"
		};
	}
	const lighting = planSceneLighting({
		...input,
		resolvedAccess: access,
		resolvedLadder: ladder?.plan ?? null,
		comfort
	});
	return {
		status: features.includes("sunShelf") && !comfort.availability.sunShelf.available || features.includes("hydromassage") && !features.includes("sunShelf") && !comfort.availability.hydromassage.available || features.includes("integratedBench") && !comfort.availability.integratedBench.available || !!effectiveAccess && !access.placement || ladder?.status === "UNAVAILABLE" ? "UNAVAILABLE" : integrated && input.access === "internalSteps" || comfort.adjusted || ladder?.status === "REPOSITION" ? "AUTO_ADJUSTED" : "VALID",
		comfort,
		access,
		effectiveAccess,
		ladder,
		lighting,
		stairMicroSpots: planStairMicroSpots(access, comfort, input.layout.copingY, input.floorProfile)
	};
}
function configuredPoolLayout(config) {
	const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
	const poolType = config.poolType ?? "in-ground";
	const layout = getPoolVerticalLayout({
		poolType,
		system: config.system,
		overflowType: config.overflowType,
		depth: config.dimensions.depth,
		copingThickness: POOL_BORDER_PRESET.thickness
	});
	return resolvePoolLayout({
		outline,
		poolType,
		layout,
		floorProfile: buildFloorProfile({
			outline,
			shape: config.shape,
			poolType,
			dimensions: config.dimensions,
			verticalLayout: layout,
			sunShelf: config.features.includes("sunShelf") || config.features.includes("hydromassage"),
			twoLoungerShelf: config.features.includes("sunShelf"),
			infinityEdge: config.system === "infinity" ? config.infinityEdge : null
		}),
		shape: config.shape,
		system: config.system,
		overflowType: config.overflowType,
		features: config.features,
		hydromassageVariant: config.hydromassageVariant,
		nominalWidth: config.dimensions.width,
		sunShelfRun: config.dimensions.sunShelfRun,
		infinityWallType: config.system === "infinity" ? config.infinityEdge?.wallType : void 0,
		access: config.poolAccess,
		stairType: config.internalStairType ?? "linear",
		stairMirrored: !!config.internalStairMirrored,
		skimmers: planSkimmers(outline, computeMetrics(outline, config.dimensions.depth).waterSurface, config.system === "skimmer"),
		infinityExcluded: config.system === "infinity" && config.infinityEdge ? infinityExclusion(outline, config.infinityEdge, config.shape) : null
	});
}
//#endregion
//#region src/lib/pool/camera.ts
/** Fit a real component envelope, with the same physical margin at every size. */
function fitComponentCamera(points, direction, fov, aspect) {
	const target = new Vector3(...points[0]);
	const min = target.clone(), max = target.clone();
	for (const p of points) {
		min.min(new Vector3(...p));
		max.max(new Vector3(...p));
	}
	target.copy(min).add(max).multiplyScalar(.5);
	const eye = new Vector3(...direction).normalize();
	const right = new Vector3(0, 1, 0).cross(eye).normalize(), up = eye.clone().cross(right);
	const tanY = Math.tan(fov * Math.PI / 360) * .84, tanX = tanY * Math.max(.2, aspect);
	let distance = 1;
	for (const p of points) {
		const v = new Vector3(...p).sub(target);
		distance = Math.max(distance, v.dot(eye) + Math.max(Math.abs(v.dot(right)) / tanX, Math.abs(v.dot(up)) / tanY));
	}
	return {
		target: target.toArray(),
		position: target.addScaledVector(eye, distance + .15).toArray()
	};
}
/** Screen-space proportion of a component along its curated viewing axis. */
function componentCameraAspect(points, direction) {
	const eye = new Vector3(...direction).normalize();
	const right = new Vector3(0, 1, 0).cross(eye).normalize(), up = eye.clone().cross(right);
	let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
	for (const point of points) {
		const p = new Vector3(...point), x = p.dot(right), y = p.dot(up);
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minY = Math.min(minY, y);
		maxY = Math.max(maxY, y);
	}
	return Math.max(.2, (maxX - minX) / Math.max(.01, maxY - minY));
}
/** The same actual shelf, flight and selected furniture drive fit and UI space. */
function sunShelfCameraSubject(resolved, layout, outline, accessoryEnvelope = []) {
	const element = resolved.comfort.elements.find((part) => part.kind === "sunShelf");
	if (!element) return null;
	const parts = [
		element,
		...element.steps ?? [],
		...element.landing ? [element.landing] : []
	];
	const b = outlineBounds(parts.flatMap((part) => part.footprint)), pool = outlineBounds(outline);
	const x = (b.minX + b.maxX) / 2, z = (b.minZ + b.maxZ) / 2;
	let nx = (pool.minX + pool.maxX) / 2 - x, nz = (pool.minZ + pool.maxZ) / 2 - z;
	const n = Math.hypot(nx, nz);
	if (n < .1) {
		nx = 1;
		nz = 0;
	} else {
		nx /= n;
		nz /= n;
	}
	const tx = nz, tz = -nx, flight = element.steps?.flatMap((step) => step.footprint) ?? [];
	const side = flight.length ? Math.sign(flight.reduce((sum, [px, pz]) => sum + (px - x) * tx + (pz - z) * tz, 0)) || 1 : 1;
	const points = [...accessoryEnvelope];
	for (const part of parts) for (const [px, pz] of part.footprint) {
		for (const dx of [-.12, .12]) for (const dz of [-.12, .12]) {
			points.push([
				px + dx,
				part.topY - (element.riser ?? 0),
				pz + dz
			]);
			points.push([
				px + dx,
				part.topY,
				pz + dz
			]);
		}
		if (outline.some((a, index) => {
			const c = outline[(index + 1) % outline.length], vx = c[0] - a[0], vz = c[1] - a[1];
			const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (pz - a[1]) * vz) / Math.max(1e-8, vx * vx + vz * vz)));
			return Math.hypot(px - a[0] - t * vx, pz - a[1] - t * vz) < .08;
		})) points.push([
			px,
			layout.copingY + .08,
			pz
		]);
	}
	return {
		points,
		direction: [
			nx + tx * side * .35,
			.9,
			nz + tz * side * .35
		]
	};
}
/** The actual treads/risers or rail paths, not a full-height bounding cuboid. */
function accessCameraSubject(plan, layout, outline) {
	const p = plan.placement;
	if (!p || !plan.footprint.length || plan.reason) return null;
	const c = Math.cos(p.rotation), s = Math.sin(p.rotation), points = [];
	const place = (x, y, z) => points.push([
		p.x + c * x + s * z,
		y,
		p.z - s * x + c * z
	]);
	if (plan.ladderDepths.length) {
		const last = plan.ladderDepths.at(-1);
		for (const contact of ladderWallContacts(outline, p)) {
			if (!Number.isFinite(contact.z)) continue;
			const curve = ladderRailCurve(plan.ladderAnchorOffset, last, contact.z);
			for (let i = 0; i <= 64; i++) {
				const point = curve.getPointAt(i / 64), r = ACCESS_DIMENSIONS.ladderTubeRadius;
				for (const dx of [-r, r]) for (const dy of [-r, r]) for (const dz of [-r, r]) place(contact.x + point.x + dx, plan.ladderAnchorY + point.y + dy, point.z + dz);
			}
			for (const dx of [-.06, .06]) for (const dz of [-.06, .06]) for (const y of [0, .024]) place(contact.x + dx, plan.ladderAnchorY + y, -plan.ladderAnchorOffset + dz);
			for (const dx of [-.034, .034]) for (const dy of [-.034, .034]) for (const dz of [0, ACCESS_DIMENSIONS.ladderFootPad]) place(contact.x + dx, plan.ladderAnchorY - last - ACCESS_DIMENSIONS.ladderFootDrop + dy, contact.z + dz);
		}
		for (const depth of plan.ladderDepths) for (const x of [-ACCESS_DIMENSIONS.ladderWidth / 2, ACCESS_DIMENSIONS.ladderWidth / 2]) for (const z of [.255, .385]) for (const dy of [-.0175, .023]) place(x, plan.ladderAnchorY - depth + dy, z);
		if (!points.length) return null;
		return {
			points,
			direction: [
				s + c * .3,
				.65,
				c - s * .3
			]
		};
	}
	for (let i = 0; i < plan.steps; i++) {
		const top = layout.copingY - (i + 1) * plan.rise, lower = top - plan.rise;
		if (plan.corner) {
			const radius = plan.corner.radii[i], inner = i ? plan.corner.radii[i - 1] : 0;
			if (plan.corner.rectangular) for (const [x, z] of rectangularCornerTread(inner, radius)) {
				place(x, top, z);
				if (x === radius || z === radius) place(x, lower, z);
			}
			else {
				for (let j = 0; j <= 48; j++) {
					const a = j / 48 * Math.PI / 2;
					place(radius * Math.sin(a), top, radius * Math.cos(a));
					place(radius * Math.sin(a), lower, radius * Math.cos(a));
					if (inner) place(inner * Math.sin(a), top, inner * Math.cos(a));
				}
				if (!inner) place(0, top, 0);
			}
		} else for (const x of [-plan.width / 2, plan.width / 2]) {
			place(x, top, i * plan.tread);
			place(x, top, (i + 1) * plan.tread);
			place(x, lower, (i + 1) * plan.tread);
		}
	}
	if (!points.length) return null;
	if (plan.corner) place(0, layout.copingY, 0);
	else for (const x of [-plan.width / 2, plan.width / 2]) place(x, layout.copingY, 0);
	const b = outlineBounds(plan.footprint), x = (b.minX + b.maxX) / 2, z = (b.minZ + b.maxZ) / 2;
	let nx = x - p.x, nz = z - p.z, n = Math.hypot(nx, nz);
	if (n < .05) {
		nx = s;
		nz = c;
		n = 1;
	}
	nx /= n;
	nz /= n;
	return {
		points,
		direction: [
			nx + nz * .25,
			.9,
			nz - nx * .25
		]
	};
}
/** Integrated hydro replaces the separate stair plan, not the Access view. */
function accessFlightCameraSubject(resolved, layout, outline, accessoryEnvelope = []) {
	const standalone = accessCameraSubject(resolved.access, layout, outline);
	if (standalone) return standalone;
	const shelf = sunShelfCameraSubject(resolved, layout, outline, accessoryEnvelope);
	if (shelf) return shelf;
	const hydro = resolved.comfort.elements.find((element) => element.kind === "hydromassage" && element.steps?.length && element.landing);
	if (!hydro?.steps?.length || !hydro.landing) return null;
	const parts = [hydro.landing, ...hydro.steps], first = outlineBounds(hydro.steps[0].footprint), head = outlineBounds(hydro.landing.footprint);
	let nx = (first.minX + first.maxX - head.minX - head.maxX) / 2, nz = (first.minZ + first.maxZ - head.minZ - head.maxZ) / 2;
	const n = Math.hypot(nx, nz);
	if (n < 1e-8) return null;
	nx /= n;
	nz /= n;
	const points = [];
	for (const [index, part] of parts.entries()) {
		const front = Math.max(...part.footprint.map(([x, z]) => x * nx + z * nz));
		const lower = parts[index + 1]?.topY ?? part.topY - (hydro.riser ?? 0);
		for (const [x, z] of part.footprint) {
			points.push([
				x,
				part.topY,
				z
			]);
			if (front - x * nx - z * nz < 1e-7) points.push([
				x,
				lower,
				z
			]);
			if (index === 0 && outline.some((a, i) => {
				const b = outline[(i + 1) % outline.length], dx = b[0] - a[0], dz = b[1] - a[1];
				const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / Math.max(1e-8, dx * dx + dz * dz)));
				return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < .08;
			})) points.push([
				x,
				layout.copingY,
				z
			]);
		}
	}
	const flight = outlineBounds(parts.flatMap((part) => part.footprint)), pool = outlineBounds(outline);
	const tx = nz, tz = -nx;
	const side = Math.sign((pool.minX + pool.maxX - flight.minX - flight.maxX) * tx + (pool.minZ + pool.maxZ - flight.minZ - flight.maxZ) * tz) || 1;
	return {
		points,
		direction: [
			nx + tx * side * .25,
			.9,
			nz + tz * side * .25
		]
	};
}
/** Real seat, partition, footwell, flight and fitting levels of the chosen zone. */
function comfortCameraSubject(intent, resolved, layout, outline) {
	const element = resolved.comfort.elements.find((e) => e.kind === (intent === "bench" ? "integratedBench" : "hydromassage"));
	if (!element) return null;
	const points = [];
	const parts = element.tiers?.length ? element.tiers : [element];
	for (const part of parts) for (const [x, z] of part.footprint) points.push([
		x,
		part.topY,
		z
	]);
	for (const part of [...element.steps ?? [], ...element.landing ? [element.landing] : []]) for (const [x, z] of part.footprint) points.push([
		x,
		part.topY,
		z
	], [
		x,
		part.topY - (element.riser ?? 0),
		z
	]);
	for (const jet of element.jets ?? []) for (const side of [-1, 1]) for (const dy of [-1, 1]) {
		const r = HYDRO_DIMENSIONS.jetDiameter / 2;
		points.push([
			jet.x + jet.dir[1] * r * side,
			jet.y + r * dy,
			jet.z - jet.dir[0] * r * side
		]);
	}
	if (!element.tiers?.some((tier) => tier.role === "tubFloor")) for (const [x, z] of element.footprint) points.push([
		x,
		layout.floorY,
		z
	]);
	const b = outlineBounds(element.footprint), pool = outlineBounds(outline);
	let nx = (pool.minX + pool.maxX - b.minX - b.maxX) / 2, nz = (pool.minZ + pool.maxZ - b.minZ - b.maxZ) / 2;
	const n = Math.hypot(nx, nz);
	if (n < .1) {
		nx = 1;
		nz = 0;
	} else {
		nx /= n;
		nz /= n;
	}
	return {
		points,
		direction: [
			nx + nz * .35,
			1,
			nz - nx * .35
		]
	};
}
/** One real front-riser module; the separate comfort camera retains the full spa. */
function openBenchMacroSubject(hydro, head, closeup = false) {
	const [nx, nz] = head.dir, tx = nz, tz = -nx, plane = head.x * nx + head.z * nz, at = head.x * tx + head.z * tz;
	const seat = hydro.tiers?.find((tier) => tier.role === "backSeat"), floor = hydro.tiers?.find((tier) => tier.role === "tubFloor");
	if (!seat || !floor) return null;
	const along = seat.footprint.filter(([x, z]) => Math.abs(x * nx + z * nz - plane) < 1e-6).map(([x, z]) => x * tx + z * tz);
	const context = closeup ? HYDRO_DIMENSIONS.spotBelowSeat : HYDRO_DIMENSIONS.spotSpacing / 2;
	let segments = [[Math.max(Math.min(...along), at - context), Math.min(Math.max(...along), at + context)]];
	for (const other of [
		...hydro.tiers ?? [],
		...hydro.steps ?? [],
		...hydro.landing ? [hydro.landing] : []
	]) {
		if (other === seat || other.topY < seat.topY - 1e-8) continue;
		const normal = other.footprint.map(([x, z]) => x * nx + z * nz);
		if (Math.min(...normal) > plane + 1e-8 || Math.max(...normal) <= plane + 1e-8) continue;
		const projection = other.footprint.map(([x, z]) => x * tx + z * tz), low = Math.min(...projection), high = Math.max(...projection);
		segments = segments.flatMap(([a, b]) => [...low > a ? [[a, Math.min(b, low)]] : [], ...high < b ? [[Math.max(a, high), b]] : []]).filter(([a, b]) => b - a > 1e-8);
	}
	const interval = segments.find(([a, b]) => at >= a && at <= b);
	if (!interval) return null;
	const seatBack = Math.max(0, plane - Math.min(...seat.footprint.map(([x, z]) => x * nx + z * nz)));
	const floorForward = Math.max(0, Math.max(...floor.footprint.map(([x, z]) => x * nx + z * nz)) - plane);
	const seatStrip = Math.min(HYDRO_DIMENSIONS.lipThickness, seatBack), floorStrip = Math.min(HYDRO_DIMENSIONS.lipThickness, floorForward);
	const points = [];
	for (const end of interval) {
		const x = head.x + tx * (end - at), z = head.z + tz * (end - at);
		for (const y of [seat.topY, closeup ? Math.max(floor.topY, head.y - HYDRO_DIMENSIONS.spotBelowSeat) : floor.topY]) points.push([
			x,
			y,
			z
		]);
		points.push([
			x - nx * seatStrip,
			seat.topY,
			z - nz * seatStrip
		]);
		if (!closeup) points.push([
			x + nx * floorStrip,
			floor.topY,
			z + nz * floorStrip
		]);
	}
	const r = HYDRO_DIMENSIONS.spotDiameter / 2;
	for (const side of [-1, 1]) for (const dy of [-1, 1]) points.push([
		head.x + tx * r * side,
		head.y + r * dy,
		head.z + tz * r * side
	]);
	return {
		points,
		direction: [
			nx,
			.65,
			nz
		]
	};
}
/** A fitting detail is distinct from the whole-flight or RGB-basin camera. */
function microLightCameraSubject(intent, resolved, layout, outline) {
	const hydro = resolved.comfort.elements.find((element) => element.kind === "hydromassage");
	const available = intent === "stair-lighting" ? resolved.stairMicroSpots : hydro?.spots ?? [];
	if (!available.length) return null;
	const levels = [...new Set(available.map((spot) => spot.y))].sort((a, b) => b - a);
	const selectedLevels = intent === "stair-lighting" ? levels.slice(Math.max(0, Math.floor((levels.length - 3) / 2)), Math.max(0, Math.floor((levels.length - 3) / 2)) + 3) : levels;
	const spots = available.filter((spot) => selectedLevels.includes(spot.y)), points = [];
	const low = Math.min(...selectedLevels), high = Math.max(...selectedLevels);
	for (const spot of spots) {
		const r = HYDRO_DIMENSIONS.spotDiameter / 2;
		for (const side of [-1, 1]) for (const dy of [-1, 1]) points.push([
			spot.x + spot.dir[1] * r * side,
			spot.y + r * dy,
			spot.z - spot.dir[0] * r * side
		]);
	}
	if (intent === "stair-lighting") {
		const context = accessCameraSubject(resolved.access, layout, outline)?.points ?? resolved.comfort.elements.flatMap((element) => [...element.steps ?? [], ...element.landing ? [element.landing] : []].flatMap((part) => part.footprint.flatMap(([x, z]) => [[
			x,
			part.topY,
			z
		], [
			x,
			part.topY - (element.riser ?? 0),
			z
		]])));
		const rise = resolved.access.rise || resolved.comfort.elements.find((element) => element.riser)?.riser || 0;
		points.push(...context.filter((point) => point[1] >= low - rise * .51 && point[1] <= high + rise * .51));
	} else if (hydro) {
		const floor = hydro.tiers?.find((tier) => tier.role === "tubFloor")?.topY ?? layout.floorY;
		const seats = (hydro.tiers ?? []).filter((tier) => [
			"backSeat",
			"sideSeat",
			"innerSideSeat"
		].includes(tier.role));
		const open = !hydro.tiers?.some((tier) => tier.role === "frontWall");
		for (const spot of spots) {
			const [nx, nz] = spot.dir, tx = nz, tz = -nx, plane = spot.x * nx + spot.z * nz;
			const seat = seats.find((tier) => Math.abs(Math.max(...tier.footprint.map(([x, z]) => x * nx + z * nz)) - plane) < 1e-6);
			if (!seat) continue;
			const along = seat.footprint.filter(([x, z]) => Math.abs(x * nx + z * nz - plane) < 1e-6).map(([x, z]) => x * tx + z * tz), at = spot.x * tx + spot.z * tz;
			let segments = [[Math.max(Math.min(...along), at - HYDRO_DIMENSIONS.spotSpacing / 2), Math.min(Math.max(...along), at + HYDRO_DIMENSIONS.spotSpacing / 2)]];
			if (open) for (const other of [
				...hydro.tiers ?? [],
				...hydro.steps ?? [],
				...hydro.landing ? [hydro.landing] : []
			]) {
				if (other === seat || other.topY < seat.topY - 1e-8) continue;
				const normal = other.footprint.map(([x, z]) => x * nx + z * nz);
				if (Math.min(...normal) > plane + 1e-8 || Math.max(...normal) <= plane + 1e-8) continue;
				const projection = other.footprint.map(([x, z]) => x * tx + z * tz), low = Math.min(...projection), high = Math.max(...projection);
				segments = segments.flatMap(([a, b]) => [...low > a ? [[a, Math.min(b, low)]] : [], ...high < b ? [[Math.max(a, high), b]] : []]).filter(([a, b]) => b - a > 1e-8);
			}
			for (const [a, b] of segments) for (const end of [a, b]) for (const y of [seat.topY, floor]) points.push([
				spot.x + tx * (end - at),
				y,
				spot.z + tz * (end - at)
			]);
		}
	}
	if (intent === "bench-lighting" && hydro) {
		const backSeat = hydro.tiers?.find((tier) => tier.role === "backSeat");
		const head = spots.find((spot) => backSeat && Math.abs(Math.max(...backSeat.footprint.map(([x, z]) => x * spot.dir[0] + z * spot.dir[1])) - spot.x * spot.dir[0] - spot.z * spot.dir[1]) < 1e-6);
		if (head && !hydro.tiers?.some((tier) => tier.role === "frontWall")) {
			const macro = openBenchMacroSubject(hydro, head);
			const detail = openBenchMacroSubject(hydro, head, true);
			if (macro) return {
				...macro,
				fixtures: [head],
				...detail ? { detailPoints: detail.points } : {}
			};
			const view = openBenchLightingView(points, hydro, layout, head.dir);
			if (view) return {
				points,
				direction: [
					view.position[0] - view.target[0],
					view.position[1] - view.target[1],
					view.position[2] - view.target[2]
				],
				view
			};
			return {
				points,
				direction: [
					head.dir[0],
					.65,
					head.dir[1]
				]
			};
		}
	}
	let nx = spots.reduce((sum, spot) => sum + spot.dir[0], 0), nz = spots.reduce((sum, spot) => sum + spot.dir[1], 0);
	const n = Math.hypot(nx, nz);
	if (n < .1) {
		nx = 1;
		nz = 0;
	} else {
		nx /= n;
		nz /= n;
	}
	return {
		points,
		direction: [
			nx + nz * .2,
			.65,
			nz - nx * .2
		]
	};
}
/** Opposing seat faces require an eye at the real free opening, not beyond it. */
function openBenchLightingView(points, hydro, layout, head) {
	const [nx, nz] = head, tx = nz, tz = -nx;
	const front = Math.max(...hydro.footprint.map(([x, z]) => x * nx + z * nz));
	const sides = (hydro.spots ?? []).filter((spot) => Math.abs(spot.dir[0] * nx + spot.dir[1] * nz) < 1e-6).map((spot) => spot.x * tx + spot.z * tz);
	if (sides.length < 2 || Math.max(...sides) - Math.min(...sides) < 1e-6) return null;
	const middle = (Math.min(...sides) + Math.max(...sides)) / 2;
	const min = new Vector3(...points[0]), max = min.clone();
	for (const point of points) {
		min.min(new Vector3(...point));
		max.max(new Vector3(...point));
	}
	const target = min.add(max).multiplyScalar(.5).toArray();
	const x = nx * front + tx * middle, z = nz * front + tz * middle;
	const h = Math.hypot(x - target[0], z - target[2]);
	return {
		position: [
			x,
			target[1] + h * Math.tan(Math.atan2(layout.waterY + .4 - target[1], h) + .01),
			z
		],
		target
	};
}
/** Focal angle derived from the entire exposed riser ROI at that physical eye. */
function openBenchLightingFov(points, view, aspect) {
	const eye = new Vector3(...view.position), forward = new Vector3(...view.target).sub(eye).normalize();
	const right = forward.clone().cross(new Vector3(0, 1, 0)).normalize(), up = right.clone().cross(forward);
	let ratio = 0;
	for (const point of points) {
		const v = new Vector3(...point).sub(eye), depth = v.dot(forward);
		if (depth <= 0) return null;
		ratio = Math.max(ratio, Math.abs(v.dot(up)) / depth, Math.abs(v.dot(right)) / (depth * aspect));
	}
	return 2 * Math.atan(ratio / .84) * 180 / Math.PI;
}
/** Bench-only finite-ray clearance: retain the real target and plan eye. */
function fitBenchLightingCamera(subject, hydro, layout, fov, aspect, infinity) {
	const pose = fitComponentCamera(subject.points, subject.direction, fov, aspect), c = pose.target, e = pose.position;
	const h = Math.hypot(e[0] - c[0], e[2] - c[2]), ux = (e[0] - c[0]) / h, uz = (e[2] - c[2]) / h;
	const v0 = e[1] - c[1], d0 = Math.hypot(h, v0);
	let v = v0;
	const parts = [
		...hydro.tiers ?? [hydro],
		...hydro.steps ?? [],
		...hydro.landing ? [hydro.landing] : []
	];
	for (const spot of hydro.spots ?? []) for (const [r, offset] of [[HYDRO_DIMENSIONS.spotDiameter / 2, .004], [HYDRO_DIMENSIONS.spotDiameter * .34, .0055]]) for (const [side, dy] of [
		[0, 0],
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1]
	]) {
		const p = [
			spot.x + spot.dir[0] * offset + spot.dir[1] * r * side,
			spot.y + r * dy,
			spot.z + spot.dir[1] * offset - spot.dir[0] * r * side
		];
		for (const part of parts) {
			let enter = 0, exit = 1, valid = true;
			for (const axis of [0, 2]) {
				const origin = p[axis], delta = e[axis] - origin, values = part.footprint.map((point) => point[axis === 0 ? 0 : 1]);
				const low = Math.min(...values), high = Math.max(...values);
				if (Math.abs(delta) < 1e-9) {
					if (origin < low || origin > high) valid = false;
				} else {
					const a = (low - origin) / delta, b = (high - origin) / delta;
					enter = Math.max(enter, Math.min(a, b));
					exit = Math.min(exit, Math.max(a, b));
				}
			}
			if (valid && exit >= enter && enter > 1e-8 && enter < 1) v = Math.max(v, p[1] + (part.topY + 1e-5 - p[1]) / enter - c[1]);
		}
	}
	if (infinity) v = Math.max(v, h * Math.tan(Math.atan2(layout.waterY + .4 - c[1], h) + .01));
	const tanY = Math.tan(fov * Math.PI / 360) * .84, tanX = tanY * Math.max(.2, aspect);
	const intervals = [];
	const exclude = (a, b, k) => {
		const disc = b * b - 4 * a * k;
		if (disc > 0) {
			const root = Math.sqrt(disc);
			intervals.push([(-b - root) / (2 * a), (-b + root) / (2 * a)]);
		}
	};
	for (const point of subject.points) {
		const a = (point[0] - c[0]) * ux + (point[2] - c[2]) * uz, b = point[1] - c[1];
		const side = Math.abs((point[0] - c[0]) * uz - (point[2] - c[2]) * ux);
		for (const sign of [-1, 1]) exclude(tanY, -tanY * b - sign * a, tanY * (h * h - h * a) + sign * h * b);
		exclude(tanX, -tanX * b - side, tanX * (h * h - h * a) - side * (d0 - v0));
	}
	for (const [low, high] of intervals.sort((a, b) => a[0] - b[0])) if (v > low && v < high) v = high + 1e-6;
	return {
		position: [
			e[0],
			c[1] + v + 1e-6,
			e[2]
		],
		target: c
	};
}
/** Frames the SAME resolved comfort/ladder geometry used by PoolModel. */
function contextualAccessCamera(intent, resolved, layout, outline, fov, aspect, infinityZone, accessoryEnvelope = []) {
	if (intent === "shelf") {
		const subject = sunShelfCameraSubject(resolved, layout, outline, accessoryEnvelope);
		return subject ? fitComponentCamera(subject.points, subject.direction, fov, aspect) : null;
	}
	if (intent === "stair-lighting" || intent === "bench-lighting") {
		const subject = microLightCameraSubject(intent, resolved, layout, outline);
		if (subject && intent === "bench-lighting") {
			const hydro = resolved.comfort.elements.find((element) => element.kind === "hydromassage");
			if (subject.view) {
				const fov = openBenchLightingFov(subject.points, subject.view, aspect);
				if (fov !== null) return {
					...subject.view,
					fov
				};
			}
			if (hydro) {
				const view = fitBenchLightingCamera(subject, subject.fixtures ? {
					...hydro,
					spots: subject.fixtures
				} : hydro, layout, fov, aspect, !!infinityZone);
				if (subject.detailPoints?.length) {
					const min = new Vector3(...subject.detailPoints[0]), max = min.clone();
					for (const point of subject.detailPoints) {
						min.min(new Vector3(...point));
						max.max(new Vector3(...point));
					}
					const detailView = {
						position: view.position,
						target: min.add(max).multiplyScalar(.5).toArray()
					};
					const detailFov = openBenchLightingFov(subject.detailPoints, detailView, aspect);
					if (detailFov !== null) return {
						...detailView,
						fov: detailFov
					};
				}
				return view;
			}
		}
		return subject ? fitComponentCamera(subject.points, subject.direction, fov, aspect) : null;
	}
	if (intent === "access") {
		const subject = accessFlightCameraSubject(resolved, layout, outline, accessoryEnvelope);
		return subject ? fitComponentCamera(subject.points, subject.direction, fov, aspect) : null;
	}
	if (intent === "inox") {
		const plan = resolved.ladder?.plan ?? (resolved.access.ladderDepths.length ? resolved.access : null);
		return plan?.placement ? getAccessDetailCamera(plan, layout, fov, aspect, !!infinityZone, outline) : null;
	}
	if (!["bench", "hydromassage"].includes(intent)) return null;
	const subject = comfortCameraSubject(intent, resolved, layout, outline);
	return subject ? fitComponentCamera(subject.points, subject.direction, fov, aspect) : null;
}
/** Only subtract UI that really overlaps the canvas; trays below it cost no area. */
function visibleCameraFrame(canvas, overlays, preferredAspect) {
	let candidates = [{
		left: 0,
		top: 0,
		right: canvas.width,
		bottom: canvas.height
	}];
	for (const overlay of overlays) {
		const padding = overlay.width >= canvas.width * .55 ? 0 : 8;
		const x0 = Math.max(0, overlay.left - canvas.left - padding), y0 = Math.max(0, overlay.top - canvas.top - padding);
		const x1 = Math.min(canvas.width, overlay.left + overlay.width - canvas.left + padding);
		const y1 = Math.min(canvas.height, overlay.top + overlay.height - canvas.top + padding);
		if (x1 <= x0 || y1 <= y0) continue;
		const next = candidates.flatMap((r) => x1 <= r.left || x0 >= r.right || y1 <= r.top || y0 >= r.bottom ? [r] : [
			{
				...r,
				right: Math.min(r.right, x0)
			},
			{
				...r,
				left: Math.max(r.left, x1)
			},
			{
				...r,
				bottom: Math.min(r.bottom, y0)
			},
			{
				...r,
				top: Math.max(r.top, y1)
			}
		]).filter((r) => r.right > r.left && r.bottom > r.top);
		candidates = next.filter((r, i) => !next.some((other, j) => j !== i && other.left <= r.left && other.right >= r.right && other.top <= r.top && other.bottom >= r.bottom && (j < i || other.left < r.left || other.right > r.right || other.top < r.top || other.bottom > r.bottom)));
	}
	const score = (r) => preferredAspect && preferredAspect > 0 ? Math.min((r.right - r.left) / preferredAspect, r.bottom - r.top) : (r.right - r.left) * (r.bottom - r.top);
	const best = candidates.reduce((a, b) => score(b) > score(a) ? b : a, {
		left: 0,
		top: 0,
		right: 1,
		bottom: 1
	});
	return {
		left: best.left,
		top: best.top,
		width: best.right - best.left,
		height: best.bottom - best.top
	};
}
/** Bounds of the canonical access plan, never a second placement algorithm. */
function getAccessDetailCamera(plan, layout, verticalFov, aspect, _preciseInfinity = false, outline = plan.footprint) {
	const subject = accessCameraSubject(plan, layout, outline);
	return subject ? fitComponentCamera(subject.points, subject.direction, verticalFov, aspect) : null;
}
//#endregion
//#region docs/qa/evidence/release-readiness-20261020/camera-shelf-offline-projection.ts
const fixtures = [{
	name: "E430",
	width: 430,
	height: 932,
	toolbarLeft: 221,
	toolbarTop: 311,
	dockTop: 383.2
}, {
	name: "E390",
	width: 390,
	height: 844,
	toolbarLeft: 181,
	toolbarTop: 258.4,
	dockTop: 330.4
}];
const output = [];
const previousPoses = /* @__PURE__ */ new Map();
for (const fixture of fixtures) for (const run of [
	3.035,
	3.2,
	5.6
]) {
	const config = {
		projectType: "new",
		poolType: "in-ground",
		structure: "reinforced-concrete",
		shape: "rectangle",
		shapeSelected: true,
		customMode: "draw",
		controlPoints: [],
		dimensions: {
			length: 8,
			width: 4,
			depth: 1.5,
			cornerRadius: 0,
			sunShelfRun: run
		},
		system: "skimmer",
		overflowType: "hidden",
		skimmerFinish: "white",
		skimmerType: "slim",
		finish: "liner",
		linerColor: "motionSandBeach179",
		mosaicFinish: "default",
		copingMaterial: "travertine",
		features: ["sunShelf", "sunShelfLoungers"],
		sunShelfLoungerCount: 2,
		poolAccess: "internalSteps",
		internalStairType: "linear",
		equipment: [],
		customer: DEFAULT_CUSTOMER,
		uploads: []
	};
	const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
	const resolved = configuredPoolLayout(config);
	const layout = getPoolVerticalLayout({
		poolType: "in-ground",
		system: "skimmer",
		overflowType: "hidden",
		depth: 1.5,
		copingThickness: .04
	});
	const loungers = configuredSunShelfLoungers(config);
	const loungerPoints = loungers.placements.map((placement) => placement.footprint.flatMap(([x, z]) => [placement.y, placement.y + SUN_SHELF_LOUNGER_MODEL.height].map((y) => [
		x,
		y,
		z
	])));
	const envelope = loungerPoints.flat();
	const subject = sunShelfCameraSubject(resolved, layout, outline, envelope);
	const preferredAspect = componentCameraAspect(subject.points, subject.direction);
	const frame = visibleCameraFrame({
		left: 0,
		top: 0,
		width: fixture.width,
		height: fixture.height
	}, [
		{
			left: 0,
			top: 0,
			width: fixture.width,
			height: 127
		},
		{
			left: 12,
			top: 143,
			width: 132,
			height: 36
		},
		{
			left: fixture.width - 174,
			top: 143,
			width: 162,
			height: 35
		},
		{
			left: fixture.toolbarLeft,
			top: fixture.toolbarTop,
			width: 193,
			height: 40
		},
		{
			left: 0,
			top: fixture.dockTop,
			width: fixture.width,
			height: fixture.height - 8 - fixture.dockTop
		}
	], preferredAspect);
	const pose = contextualAccessCamera("shelf", resolved, layout, outline, 34, frame.width / frame.height, null, envelope);
	if (run === 3.2) previousPoses.set(fixture.name, pose);
	const makeCamera = (chosenPose = pose) => {
		const camera = new PerspectiveCamera(34, fixture.width / fixture.height, .05, 500);
		camera.position.set(...chosenPose.position);
		camera.lookAt(new Vector3(...chosenPose.target));
		camera.updateMatrixWorld(true);
		camera.setViewOffset(frame.width, frame.height, -frame.left, -frame.top, fixture.width, fixture.height);
		return camera;
	};
	const bounds = (points, camera) => {
		const pixels = points.map((point) => new Vector3(...point).project(camera)).map((point) => ({
			x: (point.x + 1) * fixture.width / 2,
			y: (1 - point.y) * fixture.height / 2,
			z: point.z
		}));
		return {
			left: Math.min(...pixels.map((p) => p.x)),
			right: Math.max(...pixels.map((p) => p.x)),
			top: Math.min(...pixels.map((p) => p.y)),
			bottom: Math.max(...pixels.map((p) => p.y)),
			outsideFrame: pixels.filter((p) => p.x < frame.left || p.x > frame.left + frame.width || p.y < frame.top || p.y > frame.top + frame.height).length
		};
	};
	const camera = makeCamera();
	const intended = {
		subject: bounds(subject.points, camera),
		loungers: loungerPoints.map((points) => bounds(points, camera))
	};
	const overwritten = makeCamera();
	overwritten.aspect = fixture.width / fixture.height;
	overwritten.updateProjectionMatrix();
	output.push({
		fixture: fixture.name,
		run,
		count: loungers.count,
		preferredAspect,
		frame,
		pose,
		intended,
		counterfactualFullCanvasAspectOverwrite: bounds(subject.points, overwritten),
		...run === 5.6 ? { counterfactualStalePose3_2: {
			subject: bounds(subject.points, makeCamera(previousPoses.get(fixture.name))),
			loungers: loungerPoints.map((points) => bounds(points, makeCamera(previousPoses.get(fixture.name))))
		} } : {}
	});
}
writeFileSync(new URL("./camera-shelf-offline-projection.json", import.meta.url), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
//#endregion
export {};
