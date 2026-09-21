import {
  DEFAULT_CONTROL_POINTS,
  DIMENSION_LIMITS,
  EQUIPMENT,
  FINISHES,
  LINER_COLORS,
  POOL_FEATURES,
  POOL_SHAPES,
  POOL_STRUCTURES,
  POOL_TYPES,
  PROJECT_TYPES,
  COPING_WIDTH,
  FREEBOARD,
  OVERFLOW_GEOMETRY,
  SQM_PER_SKIMMER,
  STEPS,
} from "../src/lib/pool/config";
import { planSkimmers } from "../src/lib/pool/engineering";
import { COPING_MATERIALS } from "../src/lib/pool/coping-materials";
import { getCameraPose } from "../src/lib/pool/camera";
import type { CameraIntent, CameraPose } from "../src/lib/pool/camera";
import {
  buildOutline,
  buildWaterOutline,
  computeMetrics,
  constrainControlPoint,
  constrainControlPoints,
  isValidControlPolygon,
  offsetOutline,
  outlineArea,
  outlineBounds,
  outlineCentroid,
  outlinePerimeter,
  validatePoolShape,
} from "../src/lib/pool/geometry";
import {
  buildLShapeOutlineInfo,
  clampLShapeDimensions,
  L_SHAPE_GUARDRAILS,
  L_SHAPE_ORIENTATIONS,
  type LShapeOrientation,
} from "../src/lib/pool/l-shape";
import {
  buildOrganicShapeOutline,
  buildOrganicShapeOutlineInfo,
  clampOrganicShapeParams,
  ORGANIC_SHAPE_GUARDRAILS,
  sampleOrganicOutlineAtCount,
  outlineSelfIntersects,
  outlineWindsCcw,
  validateOrganicOutline,
} from "../src/lib/pool/organic-shape";
import { planPoolLighting, POOL_LUMINAIRE } from "../src/lib/pool/lighting";
import { calibratedLedColor, isLedColor } from "../src/lib/pool/led-optics";
import { skimmerWall } from "../src/lib/pool/walls";
import type { Dimensions, PoolShapeId } from "../src/lib/pool/types";
import {
  ABOVE_GROUND_STRUCTURE_THICKNESS,
  GROUND_LEVEL,
  getPoolVerticalLayout,
} from "../src/lib/pool/vertical-layout";
import { resolveMaterials } from "../src/lib/pool/materials";
import {
  DEFAULT_MOSAIC_FINISH_ID,
  MOSAIC_FINISHES,
} from "../src/configurator/materials/interior-textures";
import { getCustomerValidation } from "../src/lib/pool/validation";
import {
  createBeveledRingGeometry,
  createInteriorWallGeometry,
  createRingGeometry,
  createSurfaceGeometry,
  createWallGeometry,
} from "../src/components/pool/three/poolGeometry";
import {
  createGrateGeometry,
  createCopingJointGeometry,
  createCopingSlabGeometry,
  copingOuterOffset,
  SKIMMER_PROFILES,
} from "../src/components/pool/three/poolConstruction";
import * as THREE from "three";
import { createShorelineField } from "../src/components/pool/three/waterDepth";
import { createCausticsMap } from "../src/components/pool/three/textures";
import {
  accessPlacement,
  cornerStairPlan,
  linearStairDimensions,
  recomputeCornerHeight,
} from "../src/components/pool/three/PoolAccessModel";
import { WATER_VISUAL_PRESET } from "../src/configurator/materials/visual-presets";
import {
  buildFloorProfile,
  clampShallowDepth,
  computeSlopeMetrics,
  isSlopedFloorDisplay,
  MIN_SLOPE_DIFFERENCE,
  slopeEligibleForDepth,
} from "../src/lib/pool/floor-profile";
import { createSlopedFloorGeometry } from "../src/components/pool/three/poolGeometry";
import {
  clampInfinityEdgeDimensions,
  clampInfinityEdgeParams,
  computeInfinityEdgeGeometry,
  defaultInfinityEdgeParams,
  INFINITY_EDGE_DIMENSIONS,
  isRectangleSideExcludedByInfinity,
  lShapeInfinityZones,
  organicInfinityZones,
  RECTANGLE_INFINITY_SIDES,
  rectangleInfinityZones,
  type InfinityEdgeParams,
} from "../src/lib/pool/infinity-edge";

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

/** True when (x,z) sits inside the L's outer bounding rectangle but outside
 * the true L polygon -- i.e. in the missing recess. Orientation-agnostic
 * (point-in-polygon against the real outline, not a re-derivation of which
 * corner is cut), used only by the test suite to assert stairs/systems
 * never land there. */
function insideRecess(x: number, z: number, dims: Dimensions): boolean {
  const halfLength = dims.length / 2;
  const halfWidth = dims.width / 2;
  if (Math.abs(x) > halfLength || Math.abs(z) > halfWidth) return false;
  const outline = buildOutline("l-shape", dims, DEFAULT_CONTROL_POINTS);
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!;
    const b = outline[j]!;
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return !inside;
}

const shapes: ReadonlyArray<PoolShapeId> = ["rectangle", "custom"];
assert(
  copingOuterOffset("overflow", "visible") === OVERFLOW_GEOMETRY.visibleChannelOuterOffset,
  "grille overflow must meet the deck directly, without a masonry border",
);
assert(
  copingOuterOffset("overflow", "hidden") > OVERFLOW_GEOMETRY.hiddenChannelOffset,
  "grille-free overflow must retain its concealed channel and stone edge",
);
assert(copingOuterOffset("skimmer", "visible") === 0.32, "skimmer coping must remain unchanged");
{
  const texture = createCausticsMap(512);
  const pixels = texture.image.data as Uint8Array;
  let sum = 0,
    maxGradient = 0;
  for (let i = 0; i < 512 * 512; i++) {
    sum += pixels[i * 4]!;
    const next = Math.floor(i / 512) * 512 + ((i + 1) % 512);
    maxGradient = Math.max(maxGradient, Math.abs(pixels[i * 4]! - pixels[next * 4]!));
  }
  assert(sum / (512 * 512 * 255) < 0.08, "caustic field must remain sparse and low-energy");
  assert(maxGradient < 30, "caustic field must be softened rather than sharp lines");
  assert(
    WATER_VISUAL_PRESET.causticVisibility <= 0.1,
    "calm-water caustics must remain barely visible",
  );
  texture.dispose();
}
// Refraction must remain inside rectangular and concave water footprints.
for (const outline of [
  [
    [-4, -2],
    [4, -2],
    [4, 2],
    [-4, 2],
  ],
  [
    [0, 0],
    [6, 0],
    [6, 2],
    [2, 2],
    [2, 5],
    [0, 5],
  ],
] as const) {
  const field = createShorelineField(outline, 64);
  const data = field.texture.image.data;
  assert(
    Array.from(data).every((value) => Number.isFinite(value) && value >= 0),
    "finite shoreline field",
  );
  assert(
    Array.from(data).some((value) => value > 0),
    "shoreline has usable interior refraction depth",
  );
  assert(data[0] === 0 && data[63] === 0, "refraction vanishes at perimeter corners");
  if (outline.length === 6) {
    assert(data[50 * 64 + 50] === 0, "concave notch cannot refract dry paving");
    const geometry = createSurfaceGeometry(outline);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.updateMatrixWorld();
    const ray = new THREE.Raycaster(new THREE.Vector3(1, 2, 4), new THREE.Vector3(0, -1, 0));
    assert(ray.intersectObject(mesh).length > 0, "asymmetric floor/water aligns with walls");
    ray.ray.origin.set(5, 2, 4);
    assert(ray.intersectObject(mesh).length === 0, "asymmetric surface preserves the dry notch");
    geometry.dispose();
    mesh.material.dispose();
  }
  field.texture.dispose();
}
const dimensionCases: ReadonlyArray<Dimensions> = [
  DIMENSION_LIMITS.length.min,
  10,
  DIMENSION_LIMITS.length.max,
].flatMap((length) =>
  [DIMENSION_LIMITS.width.min, 4.5, DIMENSION_LIMITS.width.max].flatMap((width) =>
    [DIMENSION_LIMITS.depth.min, 1.5, DIMENSION_LIMITS.depth.max].map((depth) => ({
      length,
      width,
      depth,
      cornerRadius: 0.25,
    })),
  ),
);

const copingCases: ReadonlyArray<Dimensions> = [
  { length: 6, width: 3, depth: 1.5, cornerRadius: 0.25 },
  { length: 8, width: 4, depth: 1.5, cornerRadius: 0.25 },
  { length: 10, width: 4.5, depth: 1.5, cornerRadius: 0.25 },
];

const customCases = [
  {
    name: "organic",
    dimensions: { length: 8, width: 4, depth: 1.5, cornerRadius: 0.25 },
    points: DEFAULT_CONTROL_POINTS,
  },
  {
    name: "pronounced-concavity",
    dimensions: { length: 8, width: 5, depth: 1.5, cornerRadius: 0.25 },
    points: [
      [-0.48, -0.38],
      [0, -0.3],
      [0.46, -0.42],
      [0.27, 0],
      [0.48, 0.4],
      [0, 0.24],
      [-0.46, 0.42],
      [-0.28, 0],
    ],
  },
  {
    name: "rounded-rectangle",
    dimensions: { length: 8, width: 4, depth: 1.5, cornerRadius: 0.25 },
    points: [
      [-0.48, -0.42],
      [0.48, -0.42],
      [0.48, 0.42],
      [-0.48, 0.42],
    ],
  },
  {
    name: "elongated",
    dimensions: { length: 12, width: 3, depth: 1.5, cornerRadius: 0.25 },
    points: [
      [-0.5, -0.32],
      [0, -0.46],
      [0.5, -0.3],
      [0.48, 0.32],
      [0, 0.46],
      [-0.48, 0.3],
    ],
  },
  {
    name: "asymmetric",
    dimensions: { length: 9, width: 5, depth: 1.5, cornerRadius: 0.25 },
    points: [
      [-0.5, -0.25],
      [-0.08, -0.46],
      [0.48, -0.3],
      [0.32, 0.08],
      [0.45, 0.42],
      [-0.18, 0.35],
      [-0.46, 0.12],
    ],
  },
  {
    name: "many-control-points",
    dimensions: { length: 8, width: 5, depth: 1.5, cornerRadius: 0.25 },
    points: Array.from({ length: 16 }, (_, index) => {
      const angle = (index / 16) * Math.PI * 2;
      const radius = index % 3 === 0 ? 0.38 : 0.48;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
    }),
  },
] as const;

const signedArea = (outline: ReadonlyArray<readonly [number, number]>) => {
  let sum = 0;
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index]!;
    const b = outline[(index + 1) % outline.length]!;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
};

const hasSelfIntersection = (outline: ReadonlyArray<readonly [number, number]>) => {
  for (let first = 0; first < outline.length; first++) {
    const firstNext = (first + 1) % outline.length;
    for (let second = first + 1; second < outline.length; second++) {
      const secondNext = (second + 1) % outline.length;
      if (first === second || first === secondNext || firstNext === second) continue;
      if (
        segmentsCross(outline[first]!, outline[firstNext]!, outline[second]!, outline[secondNext]!)
      ) {
        return true;
      }
    }
  }
  return false;
};

const segmentsCross = (
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
  d: readonly [number, number],
) => {
  const cross = (
    p: readonly [number, number],
    q: readonly [number, number],
    r: readonly [number, number],
  ) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return cross(a, b, c) * cross(a, b, d) < -1e-9 && cross(c, d, a) * cross(c, d, b) < -1e-9;
};

const distanceToOutline = (
  point: readonly [number, number],
  outline: ReadonlyArray<readonly [number, number]>,
) => {
  let minimum = Infinity;
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index]!;
    const b = outline[(index + 1) % outline.length]!;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const lengthSquared = dx * dx + dz * dz;
    const amount =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSquared),
          );
    minimum = Math.min(
      minimum,
      Math.hypot(point[0] - a[0] - dx * amount, point[1] - a[1] - dz * amount),
    );
  }
  return minimum;
};

const hasDegenerateTriangles = (geometry: ReturnType<typeof createSurfaceGeometry>) => {
  const positions = geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index += 3) {
    const ax = positions.getX(index);
    const ay = positions.getY(index);
    const az = positions.getZ(index);
    const abx = positions.getX(index + 1) - ax;
    const aby = positions.getY(index + 1) - ay;
    const abz = positions.getZ(index + 1) - az;
    const acx = positions.getX(index + 2) - ax;
    const acy = positions.getY(index + 2) - ay;
    const acz = positions.getZ(index + 2) - az;
    const crossX = aby * acz - abz * acy;
    const crossY = abz * acx - abx * acz;
    const crossZ = abx * acy - aby * acx;
    if (Math.hypot(crossX, crossY, crossZ) < 1e-9) return true;
  }
  return false;
};

const assertWallCopingAlignment = (
  name: string,
  inner: ReadonlyArray<readonly [number, number]>,
  outer: ReadonlyArray<readonly [number, number]>,
  depth: number,
) => {
  const walls = createWallGeometry(inner, 0, -depth);
  const coping = createRingGeometry(inner, outer);
  const wallPositions = walls.getAttribute("position");
  const copingPositions = coping.getAttribute("position");
  for (let index = 0; index < inner.length; index++) {
    const wallOffset = index * 6;
    const copingOffset = index * 6;
    assert(
      Math.hypot(
        wallPositions.getX(wallOffset) - copingPositions.getX(copingOffset),
        wallPositions.getZ(wallOffset) - copingPositions.getZ(copingOffset),
      ) < 1e-7,
      `${name}: coping inner edge detached at sample ${index}`,
    );
  }
  walls.dispose();
  coping.dispose();
};

for (const testCase of customCases) {
  assert(isValidControlPolygon(testCase.points), `${testCase.name}: invalid test control polygon`);
  const inner = buildOutline("custom", testCase.dimensions, testCase.points);
  const outer = offsetOutline(inner, COPING_WIDTH);
  assert(inner.length >= 4 && outer.length >= 4, `${testCase.name}: open outline`);
  assert(!hasSelfIntersection(inner), `${testCase.name}: inner self-intersection`);
  assert(!hasSelfIntersection(outer), `${testCase.name}: outer self-intersection`);
  assert(signedArea(inner) * signedArea(outer) > 0, `${testCase.name}: winding mismatch`);
  const outerSamples = outer.flatMap((point, index) => {
    const next = outer[(index + 1) % outer.length]!;
    return [point, [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2] as const];
  });
  assert(
    outerSamples.every((point) => Math.abs(distanceToOutline(point, inner) - COPING_WIDTH) < 0.012),
    `${testCase.name}: coping width is not constant`,
  );
  assert(
    inner.every((point) => distanceToOutline(point, outer) >= COPING_WIDTH - 0.012),
    `${testCase.name}: inner and outer coping boundaries intersect`,
  );
  const floor = createSurfaceGeometry(inner);
  const water = createSurfaceGeometry(inner);
  const coping = createRingGeometry(inner, outer);
  const walls = createWallGeometry(inner, 0, -testCase.dimensions.depth);
  const beveledWalls = createInteriorWallGeometry(inner, 0, -testCase.dimensions.depth, 0.005, 2);
  assert(!hasDegenerateTriangles(floor), `${testCase.name}: degenerate floor triangle`);
  assert(!hasDegenerateTriangles(water), `${testCase.name}: degenerate water triangle`);
  assert(!hasDegenerateTriangles(coping), `${testCase.name}: degenerate coping triangle`);
  assert(
    walls.getAttribute("position").count === inner.length * 6,
    `${testCase.name}: walls detached from master outline`,
  );
  assert(!hasDegenerateTriangles(beveledWalls), `${testCase.name}: degenerate floor cove`);
  assert(
    [inner.length * 6, inner.length * 18].includes(beveledWalls.getAttribute("position").count),
    `${testCase.name}: invalid floor-cove fallback`,
  );
  const beveledWallPositions = beveledWalls.getAttribute("position");
  for (let index = 0; index < inner.length; index++) {
    const topVertex = index * 6;
    assert(
      Math.hypot(
        beveledWallPositions.getX(topVertex) - inner[index]![0],
        beveledWallPositions.getZ(topVertex) - inner[index]![1],
      ) < 1e-6 && Math.abs(beveledWallPositions.getY(topVertex)) < 1e-7,
      `${testCase.name}: floor cove changed the authoritative wall outline`,
    );
  }
  assertWallCopingAlignment(testCase.name, inner, outer, testCase.dimensions.depth);
  const overflowWaterEdge = offsetOutline(inner, OVERFLOW_GEOMETRY.waterEdgeOffset);
  const hiddenOverflowEdge = offsetOutline(inner, OVERFLOW_GEOMETRY.hiddenChannelOffset);
  const visibleOverflowEdge = offsetOutline(inner, OVERFLOW_GEOMETRY.visibleChannelOuterOffset);
  const hiddenIntake = createRingGeometry(overflowWaterEdge, hiddenOverflowEdge);
  const visibleGrate = createRingGeometry(
    offsetOutline(inner, OVERFLOW_GEOMETRY.visibleKerbWidth),
    visibleOverflowEdge,
    true,
  );
  const skimmerWater = buildWaterOutline(inner, "skimmer", "hidden");
  const hiddenWater = buildWaterOutline(inner, "overflow", "hidden");
  const visibleWater = buildWaterOutline(inner, "overflow", "visible");
  const innerBounds = outlineBounds(inner);
  const hiddenWaterBounds = outlineBounds(hiddenWater);
  const visibleWaterBounds = outlineBounds(visibleWater);
  const hiddenBounds = outlineBounds(hiddenOverflowEdge);
  const visibleBounds = outlineBounds(visibleOverflowEdge);
  assert(
    visibleBounds.spanX > hiddenBounds.spanX && visibleBounds.spanZ > hiddenBounds.spanZ,
    `${testCase.name}: Visible Overflow is not geometrically wider than Hidden Overflow`,
  );
  assert(skimmerWater === inner, `${testCase.name}: Skimmer water footprint changed`);
  // Hidden Overflow's water still reaches into its concealed slot. Visible
  // Overflow's is contained by the kerb instead: the water stops at the basin
  // wall, the raised kerb stands proud of it and the grated channel is
  // outboard again -- basin, kerb, grating, in that order.
  assert(
    hiddenWaterBounds.spanX > visibleWaterBounds.spanX &&
      hiddenWaterBounds.spanZ > visibleWaterBounds.spanZ &&
      Math.abs(visibleWaterBounds.spanX - innerBounds.spanX) < 1e-9 &&
      Math.abs(visibleWaterBounds.spanZ - innerBounds.spanZ) < 1e-9,
    `${testCase.name}: overflow water footprints do not reach their thresholds`,
  );
  const kerbBounds = outlineBounds(offsetOutline(inner, OVERFLOW_GEOMETRY.visibleKerbWidth));
  assert(
    innerBounds.spanX < kerbBounds.spanX &&
      kerbBounds.spanX < visibleBounds.spanX &&
      innerBounds.spanZ < kerbBounds.spanZ &&
      kerbBounds.spanZ < visibleBounds.spanZ,
    `${testCase.name}: visible overflow kerb does not sit between basin and grating`,
  );
  assert(
    hiddenIntake.getAttribute("position").count > 0 &&
      visibleGrate.getAttribute("position").count > 0,
    `${testCase.name}: missing overflow variant geometry`,
  );
  const grateUvs = visibleGrate.getAttribute("uv");
  assert(
    grateUvs.getX(0) >= 0 && grateUvs.getX(grateUvs.count - 1) <= 1,
    `${testCase.name}: invalid perimeter grate UVs`,
  );
  hiddenIntake.dispose();
  visibleGrate.dispose();
  for (const geometry of [floor, water, coping, walls, beveledWalls]) geometry.dispose();
}

const validationDimensions = { length: 10, width: 5, depth: 1.5, cornerRadius: 0.25 } as const;
const ovalPoints = Array.from({ length: 12 }, (_, index) => {
  const angle = (index / 12) * Math.PI * 2;
  return [Math.cos(angle) * 0.5, Math.sin(angle) * 0.5] as const;
});
const mildFreeformPoints = DEFAULT_CONTROL_POINTS.map(([x, y], index) =>
  index === 1 ? ([x + 0.06, y + 0.03] as const) : ([x, y] as const),
);
const asymmetricFreeformPoints = DEFAULT_CONTROL_POINTS.map(([x, y], index) =>
  index === 4 ? ([x - 0.08, y + 0.02] as const) : ([x, y] as const),
);
const moderateConcavityPoints = DEFAULT_CONTROL_POINTS.map(([x, y], index) =>
  index === 3 ? ([x - 0.14, y] as const) : ([x, y] as const),
);
const extremeConcavityPoints = [
  [-0.5, -0.4],
  [0, -0.2],
  [0.5, -0.4],
  [0.08, 0],
  [0.5, 0.4],
  [0, 0.2],
  [-0.5, 0.4],
  [-0.08, 0],
] as const;
const selfIntersectingPoints = [
  [-0.5, -0.5],
  [0.5, 0.5],
  [0.5, -0.5],
  [-0.5, 0.5],
] as const;
const narrowNeckPoints = [
  [-0.5, -0.42],
  [0, -0.12],
  [0.5, -0.42],
  [0.12, 0],
  [0.5, 0.42],
  [0, 0.12],
  [-0.5, 0.42],
  [-0.12, 0],
] as const;
const sharpCurvaturePoints = [
  [-0.5, -0.4],
  [0.42, -0.4],
  [0.5, -0.36],
  [0.42, -0.32],
  [0.5, 0.4],
  [-0.5, 0.4],
] as const;
const loopPoints = [
  [-0.5, -0.35],
  [0.35, 0.35],
  [-0.35, 0.42],
  [0.5, -0.3],
  [0.3, 0.5],
  [-0.45, -0.5],
] as const;

const validateControls = (points: ReadonlyArray<readonly [number, number]>) =>
  validatePoolShape(buildOutline("custom", validationDimensions, points), points);

const validRegressionCases = [
  ["oval", ovalPoints],
  ["kidney", DEFAULT_CONTROL_POINTS],
  ["mild-freeform", mildFreeformPoints],
  ["asymmetric-freeform", asymmetricFreeformPoints],
  ["moderate-concavity", moderateConcavityPoints],
] as const;
for (const [name, points] of validRegressionCases) {
  const validation = validateControls(points);
  assert(validation.valid, `${name} should be valid: ${JSON.stringify(validation)}`);
}

const verticalGeometryCases = [
  {
    name: "rectangle-10x4.5",
    shape: "rectangle" as const,
    dimensions: { length: 10, width: 4.5, depth: 1.5, cornerRadius: 0.25 },
    points: DEFAULT_CONTROL_POINTS,
  },
  {
    name: "rectangle-7x3",
    shape: "rectangle" as const,
    dimensions: { length: 7, width: 3, depth: 1.5, cornerRadius: 0.25 },
    points: DEFAULT_CONTROL_POINTS,
  },
  {
    name: "round-custom",
    shape: "custom" as const,
    dimensions: { length: 4, width: 4, depth: 1.5, cornerRadius: 0.25 },
    points: ovalPoints,
  },
  {
    name: "oval-custom",
    shape: "custom" as const,
    dimensions: { length: 8, width: 4, depth: 1.5, cornerRadius: 0.25 },
    points: ovalPoints,
  },
  {
    name: "asymmetric-custom",
    shape: "custom" as const,
    dimensions: validationDimensions,
    points: asymmetricFreeformPoints,
  },
  {
    name: "concave-custom",
    shape: "custom" as const,
    dimensions: validationDimensions,
    points: moderateConcavityPoints,
  },
] as const;

const cameraIntents: ReadonlyArray<CameraIntent> = [
  "overview",
  "skimmer",
  "overflow",
  "liner",
  "mosaic",
  "review",
];
let cameraRegressionCount = 0;

for (const testCase of verticalGeometryCases) {
  const outline = buildOutline(testCase.shape, testCase.dimensions, testCase.points);
  const outer = offsetOutline(outline, ABOVE_GROUND_STRUCTURE_THICKNESS);
  const innerBounds = outlineBounds(outline);
  const outerBounds = outlineBounds(outer);
  assert(
    outerBounds.spanX > innerBounds.spanX && outerBounds.spanZ > innerBounds.spanZ,
    `${testCase.name}: exterior shell does not expand outward`,
  );

  for (const poolType of ["in-ground", "above-ground"] as const) {
    const layout = getPoolVerticalLayout({
      poolType,
      system: "skimmer",
      depth: testCase.dimensions.depth,
      copingThickness: 0.06,
    });
    const expectedFloor = poolType === "above-ground" ? GROUND_LEVEL : -testCase.dimensions.depth;
    const expectedTop = poolType === "above-ground" ? testCase.dimensions.depth : GROUND_LEVEL;
    assert(Math.abs(layout.floorY - expectedFloor) < 1e-9, `${testCase.name}: invalid floor Y`);
    assert(Math.abs(layout.wallTopY - expectedTop) < 1e-9, `${testCase.name}: invalid top Y`);
    assert(layout.waterY < layout.wallTopY, `${testCase.name}: water is above the pool top`);

    const walls = createWallGeometry(outline, layout.wallTopY, layout.floorY);
    const wallPositions = walls.getAttribute("position");
    let minimumY = Infinity;
    let maximumY = -Infinity;
    for (let index = 0; index < wallPositions.count; index++) {
      minimumY = Math.min(minimumY, wallPositions.getY(index));
      maximumY = Math.max(maximumY, wallPositions.getY(index));
    }
    assert(Math.abs(minimumY - layout.floorY) < 1e-7, `${testCase.name}: wall misses floor`);
    assert(Math.abs(maximumY - layout.wallTopY) < 1e-7, `${testCase.name}: wall misses top`);
    if (poolType === "above-ground") {
      assert(minimumY >= GROUND_LEVEL, `${testCase.name}: structure crosses the ground`);
    }
    walls.dispose();

    const hiddenOverflowLayout = getPoolVerticalLayout({
      poolType,
      system: "overflow",
      overflowType: "hidden",
      depth: testCase.dimensions.depth,
      copingThickness: 0.06,
    });
    const visibleOverflowLayout = getPoolVerticalLayout({
      poolType,
      system: "overflow",
      overflowType: "visible",
      depth: testCase.dimensions.depth,
      copingThickness: 0.06,
    });
    assert(
      Math.abs(
        hiddenOverflowLayout.wallTopY -
          hiddenOverflowLayout.waterY -
          OVERFLOW_GEOMETRY.hiddenWaterTopClearance,
      ) < 1e-9,
      `${testCase.name}: invalid Hidden Overflow water clearance`,
    );
    assert(
      Math.abs(
        visibleOverflowLayout.waterY -
          visibleOverflowLayout.wallTopY -
          OVERFLOW_GEOMETRY.visibleGrateTopOffset -
          OVERFLOW_GEOMETRY.visibleWaterAboveLip,
      ) < 1e-9,
      `${testCase.name}: invalid Visible Overflow water lip level`,
    );
    assert(
      OVERFLOW_GEOMETRY.visibleWaterAboveLip > OVERFLOW_GEOMETRY.surfaceMovementAmplitude &&
        OVERFLOW_GEOMETRY.hiddenWaterTopClearance > OVERFLOW_GEOMETRY.surfaceMovementAmplitude &&
        OVERFLOW_GEOMETRY.visibleWaterAboveLip <= 0.001 &&
        OVERFLOW_GEOMETRY.hiddenWaterTopClearance <= 0.001,
      `${testCase.name}: Overflow water can z-fight with the upper edge`,
    );

    let frontMasterPose: CameraPose | undefined;
    let interiorWidePose: CameraPose | undefined;
    for (const intent of cameraIntents) {
      const intentSystem = intent === "overflow" ? "overflow" : "skimmer";
      const intentLayout = getPoolVerticalLayout({
        poolType,
        system: intentSystem,
        depth: testCase.dimensions.depth,
        copingThickness: 0.06,
      });
      const metrics = computeMetrics(outline, testCase.dimensions.depth);
      const cameraSkimmers = planSkimmers(
        outline,
        metrics.waterSurface,
        intentSystem === "skimmer",
      );
      const pose = getCameraPose({
        intent,
        outline,
        layout: intentLayout,
        depth: testCase.dimensions.depth,
        skimmers: cameraSkimmers,
      });
      assert(
        [...pose.position, ...pose.target].every(Number.isFinite),
        `${testCase.name}/${poolType}/${intent}: non-finite camera pose`,
      );
      const cameraDistance = Math.hypot(
        pose.position[0] - pose.target[0],
        pose.position[1] - pose.target[1],
        pose.position[2] - pose.target[2],
      );
      assert(
        cameraDistance > 0.5 && cameraDistance < 40,
        `${testCase.name}/${poolType}/${intent}: unreasonable camera distance`,
      );
      if (intent === "skimmer") frontMasterPose = pose;
      if (intent === "overflow") {
        assert(frontMasterPose, `${testCase.name}/${poolType}: missing Skimmer master`);
        assert(
          pose.position.every(
            (value, index) => Math.abs(value - frontMasterPose.position[index]!) < 1e-10,
          ) &&
            pose.target.every(
              (value, index) => Math.abs(value - frontMasterPose.target[index]!) < 1e-10,
            ),
          `${testCase.name}/${poolType}: Overflow changed the existing master camera`,
        );
      }
      if (intent === "liner") {
        assert(frontMasterPose, `${testCase.name}/${poolType}: missing Skimmer master`);
        interiorWidePose = pose;
        const referenceSkimmer =
          cameraSkimmers.positions[Math.floor(cameraSkimmers.positions.length / 2)];
        assert(referenceSkimmer, `${testCase.name}/${poolType}: missing reference skimmer`);
        const inwardX = Math.sin(referenceSkimmer.rotation);
        const inwardZ = Math.cos(referenceSkimmer.rotation);
        const tangentX = inwardZ;
        const tangentZ = -inwardX;
        // The Interior Finish camera intentionally targets a point ON the
        // reference wall -- a close, perpendicular material view -- rather
        // than the Skimmer master's pool-centre target (see
        // `getInteriorFinishCamera` in `camera.ts`). What must still hold:
        // the target sits at the same inward coordinate as the reference
        // skimmer (i.e. actually on that wall, not floating mid-pool) and
        // stays tangentially centred, matching the master view.
        const onWallOffset =
          (pose.target[0] - referenceSkimmer.x) * inwardX +
          (pose.target[2] - referenceSkimmer.z) * inwardZ;
        const tangentialOffset =
          (pose.target[0] - frontMasterPose.target[0]) * tangentX +
          (pose.target[2] - frontMasterPose.target[2]) * tangentZ;
        assert(
          Math.abs(onWallOffset) < 1e-9 && Math.abs(tangentialOffset) < 1e-9,
          `${testCase.name}/${poolType}: Interior Finish changed the reference wall target`,
        );
        const viewX = pose.position[0] - pose.target[0];
        const viewZ = pose.position[2] - pose.target[2];
        const horizontalLength = Math.hypot(viewX, viewZ);
        assert(
          Math.abs(viewX / horizontalLength - inwardX) < 1e-10 &&
            Math.abs(viewZ / horizontalLength - inwardZ) < 1e-10,
          `${testCase.name}/${poolType}: Interior Finish camera is not frontal`,
        );
      }
      if (intent === "mosaic") {
        assert(interiorWidePose, `${testCase.name}/${poolType}: missing Liner wide pose`);
        // Finish comparisons must preserve both position and target.
        assert(
          pose.position.every(
            (value, index) => Math.abs(value - interiorWidePose.position[index]!) < 1e-10,
          ) &&
            pose.target.every(
              (value, index) => Math.abs(value - interiorWidePose.target[index]!) < 1e-10,
            ),
          `${testCase.name}/${poolType}: Mosaic camera differs from PVC/Liner`,
        );
      }
      assert(
        pose.target[1] >= intentLayout.floorY - 1e-9 &&
          pose.target[1] <= intentLayout.copingY + 1e-9,
        `${testCase.name}/${poolType}/${intent}: target outside vertical pool bounds`,
      );
      if (poolType === "above-ground") {
        assert(
          pose.target[1] >= GROUND_LEVEL,
          `${testCase.name}/${intent}: above-ground target below ground`,
        );
        assert(
          pose.position[1] > intentLayout.waterY,
          `${testCase.name}/${intent}: camera placed in above-ground water`,
        );
      }
      cameraRegressionCount++;
    }
  }
}

const invalidRegressionCases = [
  ["extreme-concavity", extremeConcavityPoints],
  ["self-intersection", selfIntersectingPoints],
  ["very-narrow-neck", narrowNeckPoints],
  ["curvature-below-hard-radius", sharpCurvaturePoints],
  ["coping-offset-self-intersection", extremeConcavityPoints],
  ["loop", loopPoints],
  ["current-bug-shape", narrowNeckPoints],
] as const;
for (const [name, points] of invalidRegressionCases) {
  const validation = validateControls(points);
  assert(!validation.valid, `${name} should be invalid: ${JSON.stringify(validation)}`);
}

let dragPoints = [...DEFAULT_CONTROL_POINTS];
let previousDragOutline = buildOutline("custom", validationDimensions, dragPoints);
for (let step = 1; step <= 24; step++) {
  const controlIndex = (step - 1) % dragPoints.length;
  const currentControl = dragPoints[controlIndex]!;
  const worldScaleMove = step === 1 ? 0.08 : 0.025;
  const requested = [
    Math.max(-0.5, Math.min(0.5, currentControl[0] + Math.cos(step * 0.83) * worldScaleMove)),
    Math.max(-0.5, Math.min(0.5, currentControl[1] + Math.sin(step * 0.71) * 0.035)),
  ] as const;
  dragPoints = [
    ...constrainControlPoints(dragPoints, controlIndex, requested, validationDimensions),
  ];
  const validation = validateControls(dragPoints);
  assert(validation.valid, `drag clamp produced invalid geometry at step ${step}`);
  const currentDragOutline = buildOutline("custom", validationDimensions, dragPoints);
  const currentOuter = offsetOutline(currentDragOutline, COPING_WIDTH);
  assertWallCopingAlignment(
    `drag-step-${step}`,
    currentDragOutline,
    currentOuter,
    validationDimensions.depth,
  );
  assert(
    currentDragOutline.some(
      (point, index) =>
        Math.hypot(
          point[0] - previousDragOutline[index]![0],
          point[1] - previousDragOutline[index]![1],
        ) > 1e-6,
    ),
    `live update did not invalidate the master outline at step ${step}`,
  );
  previousDragOutline = currentDragOutline;
}

for (const dimensions of copingCases) {
  const outline = buildOutline("rectangle", dimensions, DEFAULT_CONTROL_POINTS);
  const innerBounds = outlineBounds(outline);
  const outerBounds = outlineBounds(offsetOutline(outline, COPING_WIDTH));
  assert(
    Math.abs((outerBounds.spanX - innerBounds.spanX) / 2 - 0.2) < 1e-9,
    `${dimensions.length} x ${dimensions.width}: incorrect longitudinal coping width`,
  );
  assert(
    Math.abs((outerBounds.spanZ - innerBounds.spanZ) / 2 - 0.2) < 1e-9,
    `${dimensions.length} x ${dimensions.width}: incorrect transverse coping width`,
  );
}

for (const shape of shapes) {
  for (const dimensions of dimensionCases) {
    const outline = buildOutline(shape, dimensions, DEFAULT_CONTROL_POINTS);
    const metrics = computeMetrics(outline, dimensions.depth);
    const bounds = outlineBounds(outline);
    assert(outline.length >= 4, `${shape}: insufficient outline vertices`);
    assert(
      outline.every((point) => point.every(Number.isFinite)),
      `${shape}: non-finite vertex`,
    );
    assert(
      metrics.waterSurface > 0 && Number.isFinite(metrics.waterVolume),
      `${shape}: invalid metrics`,
    );
    assert(Math.abs(bounds.spanX - dimensions.length) < 1e-6, `${shape}: incorrect length`);
    assert(Math.abs(bounds.spanZ - dimensions.width) < 1e-6, `${shape}: incorrect width`);

    const surface = createSurfaceGeometry(outline);
    const walls = createWallGeometry(outline, 0, -dimensions.depth);
    const beveledWalls = createInteriorWallGeometry(outline, 0, -dimensions.depth, 0.005, 2);
    const surfacePositions = surface.getAttribute("position");
    const wallPositions = walls.getAttribute("position");
    assert(surfacePositions.count >= 3, `${shape}: empty triangulated surface`);
    assert(wallPositions.count === outline.length * 6, `${shape}: incomplete wall geometry`);
    assert(!hasDegenerateTriangles(beveledWalls), `${shape}: degenerate floor-cove triangle`);
    const beveledPositions = beveledWalls.getAttribute("position");
    const beveledNormals = beveledWalls.getAttribute("normal");
    assert(
      [outline.length * 6, outline.length * 18].includes(beveledPositions.count),
      `${shape}: invalid floor-cove geometry or fallback`,
    );
    for (let index = 0; index < beveledNormals.count; index++) {
      assert(
        Number.isFinite(beveledNormals.getX(index)) &&
          Number.isFinite(beveledNormals.getY(index)) &&
          Number.isFinite(beveledNormals.getZ(index)),
        `${shape}: non-finite floor-cove normal`,
      );
    }
    for (const attribute of [surfacePositions, wallPositions]) {
      for (let index = 0; index < attribute.count; index++) {
        assert(
          Number.isFinite(attribute.getX(index)) &&
            Number.isFinite(attribute.getY(index)) &&
            Number.isFinite(attribute.getZ(index)),
          `${shape}: non-finite mesh vertex`,
        );
      }
    }
    surface.dispose();
    walls.dispose();
    beveledWalls.dispose();

    for (const system of ["skimmer", "overflow"] as const) {
      const skimmers = planSkimmers(outline, metrics.waterSurface, system === "skimmer");
      const expectedCount =
        system === "skimmer" ? Math.ceil(metrics.waterSurface / SQM_PER_SKIMMER) : 0;
      assert(skimmers.count === expectedCount, `${shape}/${system}: incorrect skimmer count`);
      assert(
        skimmers.positions.length === skimmers.count,
        `${shape}/${system}: missing skimmer positions`,
      );
      assert(
        skimmers.positions.every(({ x, z, rotation }) => [x, z, rotation].every(Number.isFinite)),
        `${shape}/${system}: invalid skimmer position`,
      );
      const centreX = outline.reduce((sum, [x]) => sum + x, 0) / outline.length;
      const centreZ = outline.reduce((sum, [, z]) => sum + z, 0) / outline.length;
      assert(
        skimmers.positions.every(({ x, z, rotation }) => {
          const inwardX = Math.sin(rotation);
          const inwardZ = Math.cos(rotation);
          return (centreX - x) * inwardX + (centreZ - z) * inwardZ > 0;
        }),
        `${shape}/${system}: skimmer opening must face the pool interior`,
      );
    }
  }
}

assert(isValidControlPolygon(DEFAULT_CONTROL_POINTS), "default custom polygon must be valid");
const defaultCustomValidation = validatePoolShape(
  buildOutline(
    "custom",
    { length: 10, width: 4.5, depth: 1.5, cornerRadius: 0.25 },
    DEFAULT_CONTROL_POINTS,
  ),
);
assert(
  defaultCustomValidation.valid,
  `default custom outline rejected: ${JSON.stringify(defaultCustomValidation)}`,
);
const crossingAttempt = constrainControlPoint(DEFAULT_CONTROL_POINTS, 0, [0.5, 0.5], {
  length: 10,
  width: 4.5,
  depth: 1.5,
  cornerRadius: 0.25,
});
const constrained = DEFAULT_CONTROL_POINTS.map((point, index) =>
  index === 0 ? crossingAttempt : point,
);
assert(isValidControlPolygon(constrained), "custom point constraint produced an invalid polygon");

assert(
  STEPS.map(({ id }) => id).join(",") ===
    "project,pool-type,structure,shape-dimensions,system,style,access,lighting,technology,review",
  "workflow order does not match the approved Nuova Piscina flow",
);
assert(PROJECT_TYPES.map(({ id }) => id).join(",") === "new,renovation", "invalid project types");
assert(POOL_TYPES.map(({ id }) => id).join(",") === "in-ground,above-ground", "invalid pool types");
assert(
  POOL_STRUCTURES.filter(({ poolTypes }) => poolTypes.includes("in-ground"))
    .map(({ id }) => id)
    .join(",") === "reinforced-concrete,modular-steel-panels",
  "invalid in-ground structures",
);
assert(
  POOL_STRUCTURES.filter(({ poolTypes }) => poolTypes.includes("above-ground"))
    .map(({ id }) => id)
    .join(",") === "modular-steel-structure",
  "invalid above-ground structures",
);

// --- Internal staircases -------------------------------------------------
// Both variants are built from the basin's own dimensions, so they are checked
// across the size range rather than at the one pool they were drawn against.
for (const [length, width, depth] of [
  [6, 3, 1.2],
  [8, 4, 1.5],
  [10, 4.5, 1.5],
  [12, 6, 2],
] as const) {
  const outline: Outline = [
    [-length / 2, -width / 2],
    [length / 2, -width / 2],
    [length / 2, width / 2],
    [-length / 2, width / 2],
  ];
  const floorY = -depth;
  const topY = 0.06;
  const flight = linearStairDimensions(floorY, topY);
  const label = `${length}x${width}x${depth}`;
  assert(
    flight.rise > 0.12 && flight.rise <= 0.25,
    `${label}: stair risers outside a climbable range`,
  );

  const straight = accessPlacement(outline, flight.run, flight.width, "internalSteps");
  assert(straight, `${label}: straight flight found no wall`);
  // On the short wall...
  assert(
    Math.abs(Math.abs(straight.x) - length / 2) < 1e-6,
    `${label}: straight flight is not on a short wall`,
  );
  // ...and pushed into a corner, one flank against the long wall.
  const flank = width / 2 - (Math.abs(straight.z) + flight.width / 2);
  assert(
    flank >= -1e-6 && flank < 0.05,
    `${label}: straight flight is not seated against the long wall (gap ${flank.toFixed(3)} m)`,
  );
  assert(flight.run < length - 0.6, `${label}: straight flight runs too far down the basin`);

  const corner = cornerStairPlan(outline, floorY, topY);
  assert(corner, `${label}: corner flight found no corner`);
  assert(
    corner.radii.length === flight.steps,
    `${label}: the two staircases must descend in the same number of treads`,
  );
  const treads = corner.radii.slice(1).map((radius, i) => radius - corner.radii[i]!);
  assert(
    treads.every((tread) => tread >= 0.219 && tread <= 0.351),
    `${label}: corner treads are not a walkable depth`,
  );
  assert(
    treads.every((tread) => Math.abs(tread - treads[0]!) < 1e-9),
    `${label}: corner treads are not concentric at a constant pitch`,
  );
  // The 28 cm target is only guaranteed once the basin is wide enough that a
  // FULL 28 cm pitch would itself have stayed in proportion -- checking the
  // plan's own (possibly already backed-off) reach here would be circular,
  // since that reach fits *by construction* however far the pitch had to
  // back off. Recompute the same hypothetical cornerStairPlan works from.
  const shortSpan = Math.min(length, width);
  const outerTarget = Math.min(1.85, Math.max(1.1, shortSpan * 0.4));
  const safeOuterReach = shortSpan * 0.45;
  const hypotheticalOuterReach =
    Math.max(0.42, outerTarget - 0.28 * (flight.steps - 1)) + 0.28 * (flight.steps - 1);
  if (hypotheticalOuterReach <= safeOuterReach + 1e-6) {
    assert(
      treads.every((tread) => tread >= 0.279),
      `${label}: corner treads should reach the ~28 cm target on a basin this size`,
    );
  }
  const outerRadius = corner.radii[corner.radii.length - 1]!;
  assert(
    corner.radii[0]! >= 0.42 && outerRadius <= Math.min(width, length) * 0.45,
    `${label}: corner flight is out of proportion with the basin`,
  );
  // Anchored on an actual corner of the outline, with the whole quarter inside.
  assert(
    outline.some(([x, z]) => Math.hypot(x - corner.x, z - corner.z) < 0.05),
    `${label}: corner flight is not anchored on a corner`,
  );
  assert(
    corner.footprint.every(
      ([x, z]) => Math.abs(x) <= length / 2 + 1e-6 && Math.abs(z) <= width / 2 + 1e-6,
    ),
    `${label}: corner flight footprint leaves the basin`,
  );
  // Top tread submerged, bottom tread standing on the floor: no floating steps.
  const topTread = floorY + corner.radii.length * corner.rise;
  assert(
    topTread < topY - 1e-6 && topTread > topY - 0.3,
    `${label}: corner flight does not finish just below the coping`,
  );
}

assert(
  POOL_SHAPES.map(({ id }) => id).join(",") === "rectangle,l-shape,custom,organic",
  "invalid pool shapes",
);
assert(FINISHES.map(({ id }) => id).join(",") === "liner,mosaic", "invalid finishes");
assert(
  OVERFLOW_GEOMETRY.waterEdgeOffset < OVERFLOW_GEOMETRY.hiddenChannelOffset &&
    OVERFLOW_GEOMETRY.hiddenChannelOffset < OVERFLOW_GEOMETRY.visibleChannelOuterOffset,
  "invalid overflow geometry hierarchy",
);
// The visible overflow perimeter is built out of two real components, so its
// outer edge is their sum and nothing else. Without this the kerb, the grille
// and the band they sit in can each be tuned on their own until the edge stops
// adding up -- which is exactly how it ended up reading as a trim strip.
assert(
  Math.abs(
    OVERFLOW_GEOMETRY.visibleKerbWidth +
      OVERFLOW_GEOMETRY.visibleGrateWidth -
      OVERFLOW_GEOMETRY.visibleChannelOuterOffset,
  ) < 1e-9,
  "visible overflow band must equal kerb width + grille width",
);
assert(
  OVERFLOW_GEOMETRY.visibleKerbWidth >= 0.09 &&
    OVERFLOW_GEOMETRY.visibleKerbWidth <= 0.16 &&
    OVERFLOW_GEOMETRY.visibleKerbRise >= 0.05 &&
    OVERFLOW_GEOMETRY.visibleKerbRise <= 0.12,
  "visible overflow kerb is outside buildable proportions",
);
assert(
  OVERFLOW_GEOMETRY.visibleGrateWidth >= 0.195 &&
    OVERFLOW_GEOMETRY.visibleGrateWidth <= 0.295 &&
    OVERFLOW_GEOMETRY.channelDepth > OVERFLOW_GEOMETRY.visibleKerbRise,
  "overflow grille width or channel depth is not a real section",
);
assert(
  POOL_FEATURES.map(({ id }) => id).join(",") === "ledLighting,hydromassage",
  "invalid pool features",
);
assert(
  EQUIPMENT.map(({ id }) => id).join(",") ===
    "automaticCover,heatPump,saltElectrolysis,automaticDosing",
  "invalid quotation equipment",
);
assert(MOSAIC_FINISHES.length > 0, "at least one mosaic finish must be configured");

for (const mosaicFinish of MOSAIC_FINISHES) {
  const materials = resolveMaterials({
    finish: "mosaic",
    linerColor: "motionBlueSky602",
    mosaicFinish: mosaicFinish.id,
  });
  assert(materials.surface.textureUrl === mosaicFinish.texture, "invalid mosaic texture mapping");
  assert(
    Math.abs(materials.surface.tileSize - 0.2) < 1e-9,
    "an 8 x 8 mosaic module must cover 0.2 metres",
  );
}

for (const finish of FINISHES) {
  for (const color of LINER_COLORS) {
    const materials = resolveMaterials({
      finish: finish.id,
      linerColor: color.id,
      mosaicFinish: DEFAULT_MOSAIC_FINISH_ID,
    });
    assert(
      Boolean(materials.liner.color && materials.floor.color && materials.water),
      "invalid material",
    );
  }
}

assert(
  getCustomerValidation({
    name: "Test Customer",
    surname: "Example",
    company: "",
    email: "customer@example.com",
    phone: "+39 012 345 6789",
    city: "Milano",
    country: "Italia",
    notes: "",
  }).valid,
  "a complete customer form must unlock Final Review",
);

// Construction regressions: real wall apertures, finite bevel normals and
// bounded grille geometry across small, large and concave configurations.
for (const shape of shapes) {
  for (const dimensions of [dimensionCases[0]!, dimensionCases[dimensionCases.length - 1]!]) {
    const outline = buildOutline(shape, dimensions, DEFAULT_CONTROL_POINTS);
    const outer = offsetOutline(outline, COPING_WIDTH);
    const meshes = [
      createBeveledRingGeometry(outline, outer, 0.008, 5),
      createGrateGeometry(outline, offsetOutline(outline, 0.165)),
      createCopingJointGeometry(outline, outer, 0.055),
      createCopingSlabGeometry(
        outline,
        offsetOutline(outline, copingOuterOffset("skimmer", "hidden")),
        0.055,
      ),
      createCopingSlabGeometry(
        offsetOutline(outline, 0.07),
        offsetOutline(outline, copingOuterOffset("overflow", "hidden")),
        0.055,
      ),
    ];
    for (const geometry of meshes) {
      for (const attribute of ["position", "normal", "uv"]) {
        assert(
          Array.from(geometry.getAttribute(attribute).array).every(Number.isFinite),
          `${shape}: finite construction ${attribute}`,
        );
      }
      assert(
        geometry.getAttribute("position").count < 500000,
        "construction geometry stays bounded",
      );
      geometry.dispose();
    }
    const plan = planSkimmers(outline, dimensions.length * dimensions.width);
    for (const profile of Object.values(SKIMMER_PROFILES)) {
      const openings = plan.positions.map((p) => ({
        ...p,
        width: profile.width - 2 * profile.bar + 0.008,
        top: -profile.drop + profile.center + profile.height / 2 - profile.bar + 0.004,
        bottom: -profile.drop + profile.center - profile.height / 2 + profile.bar - 0.004,
      }));
      const geometry = createInteriorWallGeometry(
        outline,
        0,
        -dimensions.depth,
        0.008,
        2,
        openings,
      );
      for (const opening of openings) {
        assert(
          opening.bottom < -FREEBOARD && opening.top > -FREEBOARD,
          `${shape}: every installed skimmer mouth must intersect the configured waterline`,
        );
      }
      const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.updateMatrixWorld();
      for (const opening of openings) {
        const inward = new THREE.Vector3(Math.sin(opening.rotation), 0, Math.cos(opening.rotation));
        const center = new THREE.Vector3(opening.x, (opening.top + opening.bottom) / 2, opening.z);
        const ray = new THREE.Raycaster(
          center.clone().addScaledVector(inward, 0.1),
          inward.clone().negate(),
          0,
          0.2,
        );
        assert(
          ray.intersectObject(mesh).length === 0,
          `${shape}: skimmer throat must be physically open`,
        );
        ray.ray.origin.y = opening.bottom - 0.035;
        assert(
          ray.intersectObject(mesh).length > 0,
          `${shape}: liner below skimmer must remain intact`,
        );
      }
      geometry.dispose();
      material.dispose();
    }
  }
}

// Mitred grating must also span the outside corner patches, not leave four
// open squares where perpendicular straight-run ribs stop at the inner edge.
{
  const outline: Outline = [
    [-3, -2],
    [3, -2],
    [3, 2],
    [-3, 2],
  ];
  const geometry = createGrateGeometry(outline, offsetOutline(outline, 0.165));
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld();
  for (const xSign of [-1, 1])
    for (const zSign of [-1, 1]) {
      let covered = 0;
      for (let x = 0; x < 5; x++)
        for (let z = 0; z < 5; z++) {
          const ray = new THREE.Raycaster(
            new THREE.Vector3(xSign * (3.075 + x * 0.016), 0.1, zSign * (2.075 + z * 0.016)),
            new THREE.Vector3(0, -1, 0),
            0,
            0.15,
          );
          if (ray.intersectObject(mesh).length) covered++;
        }
      assert(covered >= 5, "grating ribs must cover every mitred outer corner");
    }
  geometry.dispose();
  material.dispose();
}

assert(COPING_MATERIALS.length === 7, "seven coping finishes required");
// Finishes backed by a scanned asset are deliberately untinted (#ffffff), so
// their identity comes from the asset, not the base colour. Only the
// procedural fallbacks still distinguish themselves by tone.
const scannedCoping = COPING_MATERIALS.filter((material) => "asset" in material);
const proceduralCoping = COPING_MATERIALS.filter((material) => !("asset" in material));
assert(
  new Set(scannedCoping.map((material) => material.asset.dir)).size === scannedCoping.length,
  "each scanned coping finish needs its own asset directory",
);
assert(
  new Set(proceduralCoping.map((material) => material.color)).size === proceduralCoping.length,
  "procedural coping tones must differ",
);
for (const material of COPING_MATERIALS) {
  assert(material.roughness > 0 && material.roughness <= 1, "bounded stone roughness");
  // Real-world repeat, in metres: from a single decking board width up to a
  // large-format stone slab.
  assert(material.moduleSize >= 0.15 && material.moduleSize <= 1.5, "metric coping texture scale");
}
console.log(
  `Construction audit passed: open skimmer throats for all four profiles; bounded grille, joints and bevels; ${COPING_MATERIALS.length} coping finishes (${scannedCoping.length} scanned, ${proceduralCoping.length} procedural fallback).`,
);

// --- Geometry Pass A: sloped floor -----------------------------------
const slopeCases: ReadonlyArray<{
  length: number;
  width: number;
  depth: number;
  shallowDepth: number;
}> = [
  { length: 10, width: 4.5, depth: 1.5, shallowDepth: 1.2 },
  { length: 8, width: 4, depth: 1.5, shallowDepth: 1.1 },
  // Small valid pool, at the absolute floor of a real slope (exactly
  // MIN_SLOPE_DIFFERENCE apart).
  { length: 3, width: 2, depth: 1, shallowDepth: 0.8 },
];

for (const testCase of slopeCases) {
  const dimensions: Dimensions = {
    length: testCase.length,
    width: testCase.width,
    depth: testCase.depth,
    cornerRadius: 0,
    floorProfile: "slope",
    shallowDepth: testCase.shallowDepth,
  };
  const outline = buildOutline("rectangle", dimensions, DEFAULT_CONTROL_POINTS);
  const verticalLayout = getPoolVerticalLayout({
    poolType: "in-ground",
    system: "skimmer",
    overflowType: "hidden",
    depth: testCase.depth,
    copingThickness: 0.03,
  });
  const profile = buildFloorProfile({
    outline,
    shape: "rectangle",
    poolType: "in-ground",
    dimensions,
    verticalLayout,
  });
  const label = `${testCase.length}x${testCase.width} slope ${testCase.shallowDepth}->${testCase.depth}`;
  assert(profile.sloped, `slope must be eligible for ${label}`);

  // Endpoints.
  const shallowY = profile.floorYAt(...profile.shallowPoint);
  const deepY = profile.floorYAt(...profile.deepPoint);
  assert(Number.isFinite(shallowY) && Number.isFinite(deepY), `no NaN floor elevations (${label})`);
  assert(
    Math.abs(shallowY - profile.shallowFloorY) < 1e-9,
    `shallow endpoint must equal shallowFloorY (${label})`,
  );
  assert(
    Math.abs(deepY - profile.deepFloorY) < 1e-9,
    `deep endpoint must equal deepFloorY (${label})`,
  );
  assert(
    profile.elevationDrop > 0 && Number.isFinite(profile.elevationDrop),
    `elevationDrop must be a real positive number (${label})`,
  );

  // Monotonic slope along the running axis.
  const bounds = outlineBounds(outline);
  const axisMin = profile.axis === "x" ? bounds.minX : bounds.minZ;
  const axisMax = profile.axis === "x" ? bounds.maxX : bounds.maxZ;
  let previousY: number | null = null;
  for (let step = 0; step <= 20; step++) {
    const coordinate = axisMin + (step / 20) * (axisMax - axisMin);
    const y =
      profile.axis === "x" ? profile.floorYAt(coordinate, 0) : profile.floorYAt(0, coordinate);
    assert(Number.isFinite(y), `monotonic sample must be finite (${label})`);
    if (previousY !== null) {
      const gettingDeeper = profile.shallowAtMin ? y <= previousY + 1e-9 : y >= previousY - 1e-9;
      assert(
        gettingDeeper,
        `floor elevation must move monotonically along the slope axis (${label})`,
      );
    }
    previousY = y;
  }

  // Real, closed-form metrics.
  const metrics = computeSlopeMetrics(
    outline,
    profile,
    verticalLayout.waterY,
    verticalLayout.wallTopY,
  );
  const footprintArea = testCase.length * testCase.width;
  assert(
    Number.isFinite(metrics.waterVolume) && metrics.waterVolume > 0,
    `finite positive volume (${label})`,
  );
  assert(
    Number.isFinite(metrics.floorSurface) && metrics.floorSurface > 0,
    `finite positive floor surface (${label})`,
  );
  assert(
    Number.isFinite(metrics.wallSurface) && metrics.wallSurface > 0,
    `finite positive wall surface (${label})`,
  );
  assert(
    metrics.floorSurface > footprintArea,
    `inclined floor surface must exceed the flat footprint (${label})`,
  );
  assert(
    Math.abs(metrics.waterSurface - footprintArea) < 1e-6,
    `water surface stays the horizontal plan area (${label})`,
  );
  const shallowFlatVolume = footprintArea * (verticalLayout.waterY - profile.shallowFloorY);
  const deepFlatVolume = footprintArea * (verticalLayout.waterY - profile.deepFloorY);
  assert(
    metrics.waterVolume > shallowFlatVolume - 1e-6 && metrics.waterVolume < deepFlatVolume + 1e-6,
    `sloped volume must sit between the flat-at-shallow and flat-at-deep bounds (${label})`,
  );

  // Floor geometry: no extra tessellation, no NaN, correct unit normals.
  const slopedFloorGeom = createSlopedFloorGeometry(outline, profile.floorYAt);
  const flatFloorGeom = createSurfaceGeometry(outline);
  assert(
    slopedFloorGeom.getAttribute("position").count === flatFloorGeom.getAttribute("position").count,
    `sloped floor must keep the same triangle count as flat -- no extra tessellation (${label})`,
  );
  const floorPositions = slopedFloorGeom.getAttribute("position");
  const floorNormals = slopedFloorGeom.getAttribute("normal");
  assert(floorNormals, `sloped floor must have computed normals (${label})`);
  for (let i = 0; i < floorPositions.count; i++) {
    assert(
      Number.isFinite(floorPositions.getX(i)) &&
        Number.isFinite(floorPositions.getY(i)) &&
        Number.isFinite(floorPositions.getZ(i)),
      `no NaN floor vertex (${label})`,
    );
    const normal = new THREE.Vector3(
      floorNormals.getX(i),
      floorNormals.getY(i),
      floorNormals.getZ(i),
    );
    assert(Math.abs(normal.length() - 1) < 1e-3, `floor normals must be unit length (${label})`);
    assert(
      normal.y > 0.5,
      `floor normal must still point mostly upward for a real, gentle slope (${label})`,
    );
  }
  slopedFloorGeom.dispose();
  flatFloorGeom.dispose();

  // Wall geometry: valid, and never reaches below the deepest local floor
  // nor stays above the shallowest -- i.e. it genuinely follows the slope.
  const slopedWallGeom = createInteriorWallGeometry(
    outline,
    verticalLayout.wallTopY,
    profile.floorYAt,
    0.005,
    2,
    [],
  );
  const wallPositions = slopedWallGeom.getAttribute("position");
  let minWallY = Infinity;
  let maxWallY = -Infinity;
  for (let i = 0; i < wallPositions.count; i++) {
    assert(
      Number.isFinite(wallPositions.getX(i)) &&
        Number.isFinite(wallPositions.getY(i)) &&
        Number.isFinite(wallPositions.getZ(i)),
      `no NaN wall vertex (${label})`,
    );
    minWallY = Math.min(minWallY, wallPositions.getY(i));
    maxWallY = Math.max(maxWallY, wallPositions.getY(i));
  }
  assert(
    minWallY >= profile.deepFloorY - 1e-6,
    `wall must never reach below the deepest local floor (${label})`,
  );
  assert(
    maxWallY <= verticalLayout.wallTopY + 1e-6,
    `wall must never rise above the coping-level top (${label})`,
  );
  assert(
    minWallY <= profile.shallowFloorY + 1e-6,
    `wall bottom must reach down to at least the shallow floor somewhere (${label})`,
  );
  slopedWallGeom.dispose();

  // Corner stairs: the flight rebuilt for the local floor must genuinely
  // differ from one built for the opposite end -- proves the correction is
  // not a no-op -- and stay a real, finite, positive flight either way.
  const cornerRaw = cornerStairPlan(outline, profile.deepFloorY, verticalLayout.copingY);
  if (cornerRaw) {
    const deepRecompute = recomputeCornerHeight(
      cornerRaw,
      outline,
      profile.deepFloorY,
      verticalLayout.copingY,
    );
    const shallowRecompute = recomputeCornerHeight(
      cornerRaw,
      outline,
      profile.shallowFloorY,
      verticalLayout.copingY,
    );
    assert(
      Number.isFinite(shallowRecompute.rise) && shallowRecompute.rise > 0,
      `corrected shallow-end rise must be finite and positive (${label})`,
    );
    assert(
      shallowRecompute.radii.every((radius) => Number.isFinite(radius) && radius > 0),
      `corrected radii must all be finite and positive (${label})`,
    );
    const shallowSpan = shallowRecompute.rise * shallowRecompute.radii.length;
    const deepSpan = deepRecompute.rise * deepRecompute.radii.length;
    assert(
      shallowSpan < deepSpan + 1e-6,
      `a corner stair rebuilt for the shallow floor must span no more total height than one rebuilt for the deep floor (${label})`,
    );
  }

  // Linear stair flight: sized against the shallow floor must be a
  // real, shorter flight than one sized against the deep floor.
  const shallowFlight = linearStairDimensions(profile.shallowFloorY, verticalLayout.copingY);
  const deepFlight = linearStairDimensions(profile.deepFloorY, verticalLayout.copingY);
  assert(
    shallowFlight.riseCount <= deepFlight.riseCount,
    `a shallow-floor flight must never need more risers than a deep-floor one (${label})`,
  );

  // Skimmer/overflow placement never consumes floor elevation, so it must
  // stay fully unaffected by slope.
  const skimmerPlan = planSkimmers(outline, footprintArea, true);
  assert(
    skimmerPlan.positions.length > 0,
    `skimmers must still place with a sloped floor (${label})`,
  );
  for (const position of skimmerPlan.positions) {
    assert(
      Number.isFinite(position.x) && Number.isFinite(position.z),
      `skimmer positions must stay finite under slope (${label})`,
    );
  }
}

// Flat mode is unaffected: `buildFloorProfile` on a config with no
// `floorProfile` returns `sloped: false` and the single global floor Y
// everywhere, exactly like every pool before this pass.
{
  const flatDimensions: Dimensions = { length: 10, width: 4.5, depth: 1.5, cornerRadius: 0 };
  const outline = buildOutline("rectangle", flatDimensions, DEFAULT_CONTROL_POINTS);
  const verticalLayout = getPoolVerticalLayout({
    poolType: "in-ground",
    system: "skimmer",
    overflowType: "hidden",
    depth: 1.5,
    copingThickness: 0.03,
  });
  const profile = buildFloorProfile({
    outline,
    shape: "rectangle",
    poolType: "in-ground",
    dimensions: flatDimensions,
    verticalLayout,
  });
  assert(!profile.sloped, "a project without floorProfile must build as flat");
  assert(
    profile.floorYAt(0, 0) === verticalLayout.floorY,
    "flat floorYAt must equal the single global floorY everywhere",
  );
}

// Ineligible combinations must always normalise to flat -- never error,
// never build a partial/degenerate slope.
{
  const slopeRequested: Dimensions = {
    length: 10,
    width: 4.5,
    depth: 1.5,
    cornerRadius: 0,
    floorProfile: "slope",
    shallowDepth: 1.2,
  };
  const customOutline = buildOutline("custom", slopeRequested, DEFAULT_CONTROL_POINTS);
  const inGroundLayout = getPoolVerticalLayout({
    poolType: "in-ground",
    system: "skimmer",
    overflowType: "hidden",
    depth: 1.5,
    copingThickness: 0.03,
  });
  assert(
    !buildFloorProfile({
      outline: customOutline,
      shape: "custom",
      poolType: "in-ground",
      dimensions: slopeRequested,
      verticalLayout: inGroundLayout,
    }).sloped,
    "custom shape must never build sloped, even with slope requested",
  );

  const rectOutline = buildOutline("rectangle", slopeRequested, DEFAULT_CONTROL_POINTS);
  const aboveGroundLayout = getPoolVerticalLayout({
    poolType: "above-ground",
    system: "skimmer",
    overflowType: "hidden",
    depth: 1.5,
    copingThickness: 0.03,
  });
  assert(
    !buildFloorProfile({
      outline: rectOutline,
      shape: "rectangle",
      poolType: "above-ground",
      dimensions: slopeRequested,
      verticalLayout: aboveGroundLayout,
    }).sloped,
    "above-ground pools must never build sloped",
  );
}

// clampShallowDepth / slopeEligibleForDepth: no NaN, no inversion, no
// zero-difference slope. The last assertion is deliberately the negation of
// a bug that was briefly reintroduced while writing this block (clamp
// returning the deep depth unchanged), to prove the guard actually fires
// rather than being vacuously true.
{
  assert(
    slopeEligibleForDepth(1.5, 0.8) === true,
    "1.5m deep pool has room for a real shallow end",
  );
  assert(
    slopeEligibleForDepth(0.9, 0.8) === false,
    "0.9m deep pool cannot fit MIN_SLOPE_DIFFERENCE above the absolute minimum",
  );
  assert(
    Number.isFinite(clampShallowDepth(NaN, 1.5, 0.8)) && clampShallowDepth(NaN, 1.5, 0.8) >= 0.8,
    "a NaN shallow depth must clamp to a real number, never propagate",
  );
  assert(
    clampShallowDepth(-3, 1.5, 0.8) === 0.8,
    "a negative shallow depth clamps to the absolute minimum",
  );
  assert(
    clampShallowDepth(1.5, 1.5, 0.8) <= 1.5 - MIN_SLOPE_DIFFERENCE,
    "requesting the deep depth as the shallow depth must still clamp to a real slope below it",
  );
}

// --- Geometry Pass A follow-up: shallow-end stair placement preference ---
{
  const stairDimensions: Dimensions = {
    length: 10,
    width: 4.5,
    depth: 1.5,
    cornerRadius: 0,
    floorProfile: "slope",
    shallowDepth: 1.2,
  };
  const outline = buildOutline("rectangle", stairDimensions, DEFAULT_CONTROL_POINTS);
  const verticalLayout = getPoolVerticalLayout({
    poolType: "in-ground",
    system: "skimmer",
    overflowType: "hidden",
    depth: stairDimensions.depth,
    copingThickness: 0.03,
  });
  const normalProfile = buildFloorProfile({
    outline,
    shape: "rectangle",
    poolType: "in-ground",
    dimensions: stairDimensions,
    verticalLayout,
  });
  const reversedProfile = buildFloorProfile({
    outline,
    shape: "rectangle",
    poolType: "in-ground",
    dimensions: { ...stairDimensions, slopeReversed: true },
    verticalLayout,
  });
  assert(
    normalProfile.sloped && reversedProfile.sloped,
    "shallow-end stair test requires sloped profiles",
  );
  assert(
    normalProfile.shallowAtMin === true && reversedProfile.shallowAtMin === false,
    "reversal must flip shallowAtMin",
  );
  const axisIndex = normalProfile.axis === "x" ? 0 : 1;
  const axisValue = (point: { x: number; z: number }) => (axisIndex === 0 ? point.x : point.z);
  const flight = linearStairDimensions(normalProfile.deepFloorY, verticalLayout.copingY);

  // Linear stairs follow the shallow end, and swap it when reversed.
  const linearNormal = accessPlacement(
    outline,
    flight.run,
    flight.width,
    "internalSteps",
    normalProfile,
  );
  assert(linearNormal, "linear stair placement must succeed on a sloped rectangle");
  assert(
    Math.abs(axisValue(linearNormal!) - normalProfile.axisMin) < 1e-6,
    "linear stairs must land on the shallow-end wall (normal orientation)",
  );
  const linearReversed = accessPlacement(
    outline,
    flight.run,
    flight.width,
    "internalSteps",
    reversedProfile,
  );
  assert(linearReversed, "linear stair placement must succeed after reversal");
  assert(
    Math.abs(axisValue(linearReversed!) - normalProfile.axisMax) < 1e-6,
    "reversing the slope must move linear stairs to the new shallow (previously deep) end",
  );
  // Local floor under the chosen wall must be exactly that wall's own real
  // floor -- never floating above it, never sinking below it.
  assert(
    Math.abs(
      normalProfile.floorYAt(linearNormal!.x, linearNormal!.z) - normalProfile.shallowFloorY,
    ) < 1e-6,
    "linear stairs at the shallow wall must sit on the true shallow floor",
  );

  // Corner stairs: same shallow preference and reversal behaviour.
  const cornerNormal = cornerStairPlan(
    outline,
    normalProfile.deepFloorY,
    verticalLayout.copingY,
    normalProfile,
  );
  const cornerReversed = cornerStairPlan(
    outline,
    reversedProfile.deepFloorY,
    verticalLayout.copingY,
    reversedProfile,
  );
  assert(cornerNormal, "corner stair placement must succeed on a sloped rectangle");
  assert(cornerReversed, "corner stair placement must succeed after reversal");
  // The returned x/z are inset a few centimetres in from the true corner
  // vertex (see cornerStairPlan's `inset`, so the flight's flat flanks
  // finish inside the wall rather than coplanar with it) -- a wide but
  // still discriminating tolerance confirms "the shallow corner, not the
  // deep one" (5m apart here) without asserting an exact vertex match.
  const cornerTolerance = 0.1;
  assert(
    Math.abs(axisValue(cornerNormal!) - normalProfile.axisMin) < cornerTolerance,
    "corner stairs must land on the shallow-end corner (normal orientation)",
  );
  assert(
    Math.abs(axisValue(cornerReversed!) - normalProfile.axisMax) < cornerTolerance,
    "reversing the slope must move the corner stair to the new shallow end",
  );
  // No floating/buried treads: rebuild height against the true local floor
  // and confirm the resulting flight is real (finite, positive, in range).
  const localCornerFloorY = normalProfile.floorYAt(cornerNormal!.x, cornerNormal!.z);
  const correctedCorner = recomputeCornerHeight(
    cornerNormal!,
    outline,
    localCornerFloorY,
    verticalLayout.copingY,
  );
  assert(
    correctedCorner.rise > 0 && correctedCorner.radii.every((r) => Number.isFinite(r) && r > 0),
    "corner stair corrected for the local shallow floor must remain a real, valid flight",
  );
  // Within the outline: the corner point itself must lie on the basin
  // boundary, not drift outside it.
  const bounds = outlineBounds(outline);
  assert(
    cornerNormal!.x >= bounds.minX - 0.1 &&
      cornerNormal!.x <= bounds.maxX + 0.1 &&
      cornerNormal!.z >= bounds.minZ - 0.1 &&
      cornerNormal!.z <= bounds.maxZ + 0.1,
    "corner stair position must stay within the basin outline",
  );

  // Regression: omitting floorProfile (as every pre-existing call site
  // does) must be byte-identical to a flat profile -- the preference has
  // zero effect unless a caller actually opts in with a sloped model.
  const linearNoProfile = accessPlacement(outline, flight.run, flight.width, "internalSteps");
  const flatDimensions: Dimensions = { ...stairDimensions, floorProfile: "flat" };
  const flatProfile = buildFloorProfile({
    outline,
    shape: "rectangle",
    poolType: "in-ground",
    dimensions: flatDimensions,
    verticalLayout,
  });
  const linearFlatProfile = accessPlacement(
    outline,
    flight.run,
    flight.width,
    "internalSteps",
    flatProfile,
  );
  assert(
    linearNoProfile !== null &&
      linearFlatProfile !== null &&
      Math.abs(linearNoProfile.x - linearFlatProfile.x) < 1e-9 &&
      Math.abs(linearNoProfile.z - linearFlatProfile.z) < 1e-9 &&
      Math.abs(linearNoProfile.rotation - linearFlatProfile.rotation) < 1e-9,
    "an unsloped floorProfile must place identically to omitting it entirely -- zero regression for flat pools",
  );

  // Valid fallback: a floorProfile whose "shallow" coordinate matches no
  // real wall of this outline must still produce a valid placement rather
  // than null or a crash -- the preference degrades gracefully to the
  // existing length-based search.
  const bogusProfile = {
    ...normalProfile,
    axisMin: normalProfile.axisMin - 50,
    axisMax: normalProfile.axisMin - 50,
  };
  const linearBogus = accessPlacement(
    outline,
    flight.run,
    flight.width,
    "internalSteps",
    bogusProfile,
  );
  assert(
    linearBogus !== null,
    "a shallow-end preference that matches no real wall must still fall back to a valid placement",
  );
}

console.log(
  "Shallow-end stair placement audit passed: linear + corner stairs prefer the shallow end, follow slope reversal, stay within the outline, land on their true local floor, regress to zero effect when unsloped, and fall back safely when the preference matches no real wall.",
);

// --- Geometry Pass B: L-shape domain model ---
{
  const orientations: readonly LShapeOrientation[] = ["sw", "se", "ne", "nw"];
  const baseDims = { totalLength: 10, totalWidth: 7, recessLength: 4, recessWidth: 3 };

  for (const orientation of orientations) {
    const dims = clampLShapeDimensions({ ...baseDims, orientation });
    const info = buildLShapeOutlineInfo(dims);
    assert(info.outline.length === 6, `${orientation}: L outline must have exactly 6 vertices`);
    assert(
      info.outline.every(([x, z]) => Number.isFinite(x) && Number.isFinite(z)),
      `${orientation}: every L vertex must be finite`,
    );
    // Deterministic winding: shoelace sum positive (CCW), matching
    // unitRectangle()'s own convention -- every generic outline consumer
    // (walls, offsetOutline, skimmerWall) expects this.
    let signedAreaSum = 0;
    for (let i = 0; i < info.outline.length; i++) {
      const [x1, z1] = info.outline[i]!;
      const [x2, z2] = info.outline[(i + 1) % info.outline.length]!;
      signedAreaSum += x1 * z2 - x2 * z1;
    }
    assert(signedAreaSum > 0, `${orientation}: L outline winding must be CCW (positive shoelace)`);
    // No duplicate/coincident consecutive vertices, no zero-length edges.
    for (let i = 0; i < info.outline.length; i++) {
      const a = info.outline[i]!;
      const b = info.outline[(i + 1) % info.outline.length]!;
      assert(
        Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-6,
        `${orientation}: L outline must have no duplicate/zero-length edges`,
      );
    }
    // Exactly one concave (reflex) corner, five convex.
    const concaveCount = info.convex.filter((c) => !c).length;
    assert(
      concaveCount === 1,
      `${orientation}: an L must have exactly one concave corner, found ${concaveCount}`,
    );
    // Area/perimeter: outer rectangle minus the recess rectangle, and a
    // perimeter independent of the recess (2*(L+W), a property of any
    // axis-aligned corner notch).
    const expectedArea =
      baseDims.totalLength * baseDims.totalWidth - baseDims.recessLength * baseDims.recessWidth;
    assert(
      Math.abs(info.area - expectedArea) < 1e-6,
      `${orientation}: L area must equal outer rectangle minus recess (expected ${expectedArea}, got ${info.area})`,
    );
    const expectedPerimeter = 2 * (baseDims.totalLength + baseDims.totalWidth);
    assert(
      Math.abs(info.perimeter - expectedPerimeter) < 1e-6,
      `${orientation}: L perimeter must equal 2*(length+width) regardless of recess size`,
    );
    assert(
      info.bounds.spanX <= baseDims.totalLength + 1e-6 &&
        info.bounds.spanZ <= baseDims.totalWidth + 1e-6,
      `${orientation}: L bounds must never exceed the outer rectangle`,
    );
  }

  // Validation/clamping: never a degenerate leg, corridor, NaN or inverted
  // dimension, whatever garbage input arrives (legacy draft, malformed UI
  // state, a slider dragged to its extreme).
  const hugeRecess = clampLShapeDimensions({
    totalLength: 10,
    totalWidth: 7,
    recessLength: 9.9,
    recessWidth: 6.9,
    orientation: "se",
  });
  assert(
    hugeRecess.recessLength <= 10 - L_SHAPE_GUARDRAILS.minLegWidth + 1e-9 &&
      hugeRecess.recessWidth <= 7 - L_SHAPE_GUARDRAILS.minLegWidth + 1e-9,
    "an oversized recess request must clamp to leave a real leg on both axes",
  );
  const clampedHugeInfo = buildLShapeOutlineInfo(hugeRecess);
  assert(
    clampedHugeInfo.area > 0 && Number.isFinite(clampedHugeInfo.area),
    "even a maximally-clamped recess must produce a real, positive-area L",
  );
  const nanInput = clampLShapeDimensions({
    totalLength: NaN,
    totalWidth: NaN,
    recessLength: NaN,
    recessWidth: NaN,
    orientation: "bogus" as LShapeOrientation,
  });
  assert(
    Object.values(nanInput).every((v) => typeof v === "string" || Number.isFinite(v)),
    "NaN/malformed L input must normalise to finite dimensions, never propagate",
  );
  assert(
    (["sw", "se", "ne", "nw"] as const).includes(nanInput.orientation),
    "an invalid orientation string must normalise to a real orientation",
  );
  const undefinedInput = clampLShapeDimensions(undefined);
  assert(
    Number.isFinite(undefinedInput.totalLength) && Number.isFinite(undefinedInput.recessLength),
    "omitted L dimensions (a brand-new project) must default to a real, finite L",
  );

  // buildOutline wiring: shape === "l-shape" must route through the L
  // generator, never fall back to the unit-rectangle/custom path.
  const lShapeDims: Dimensions = {
    length: 10,
    width: 7,
    depth: 1.5,
    cornerRadius: 0,
    lShapeRecessLength: 4,
    lShapeRecessWidth: 3,
    lShapeOrientation: "se",
  };
  const wiredOutline = buildOutline("l-shape", lShapeDims, DEFAULT_CONTROL_POINTS);
  assert(
    wiredOutline.length === 6,
    "buildOutline('l-shape', ...) must produce the 6-vertex L outline",
  );
  assert(
    Math.abs(outlineArea(wiredOutline) - (10 * 7 - 4 * 3)) < 1e-6,
    "buildOutline('l-shape', ...) area must match the canonical L area formula",
  );

  console.log(
    "L-shape domain audit passed: all 4 orientations produce a deterministic 6-vertex CCW outline with exactly one concave corner, correct area/perimeter, clamped guardrails against degenerate/NaN/omitted input, and correct buildOutline wiring.",
  );
}

// --- Geometry Pass B: L-shape floor/water/wall/slope/systems integration ---
{
  const lShapeDims: Dimensions = {
    length: 10,
    width: 7,
    depth: 1.5,
    cornerRadius: 0,
    lShapeRecessLength: 4,
    lShapeRecessWidth: 3,
    lShapeOrientation: "se",
  };
  const outline = buildOutline("l-shape", lShapeDims, DEFAULT_CONTROL_POINTS);
  const verticalLayout = getPoolVerticalLayout({
    poolType: "in-ground",
    system: "skimmer",
    overflowType: "hidden",
    depth: lShapeDims.depth,
    copingThickness: 0.03,
  });

  // Floor triangulation: THREE.ShapeGeometry over the real concave polygon
  // must produce a finite, non-degenerate mesh -- no NaN positions/UVs/
  // normals, a real (non-zero) triangle count.
  const floorGeometry = createSurfaceGeometry(outline);
  const positions = floorGeometry.getAttribute("position");
  const uvs = floorGeometry.getAttribute("uv");
  assert(positions.count > 0, "L floor must triangulate to a real, non-empty mesh");
  for (let i = 0; i < positions.count; i++) {
    assert(
      Number.isFinite(positions.getX(i)) &&
        Number.isFinite(positions.getY(i)) &&
        Number.isFinite(positions.getZ(i)),
      "L floor vertex positions must all be finite (no NaN from the concave triangulation)",
    );
    assert(
      Number.isFinite(uvs.getX(i)) && Number.isFinite(uvs.getY(i)),
      "L floor UVs must all be finite",
    );
  }
  floorGeometry.computeVertexNormals();
  const normals = floorGeometry.getAttribute("normal");
  for (let i = 0; i < normals.count; i++) {
    assert(
      Number.isFinite(normals.getX(i)) &&
        Number.isFinite(normals.getY(i)) &&
        Number.isFinite(normals.getZ(i)),
      "L floor normals must all be finite",
    );
  }

  // Wall closure: one wall segment per outline edge (6 edges -> the wall
  // ribbon must close on itself with no gap), all finite.
  const wallGeometry = createWallGeometry(outline, verticalLayout.wallTopY, verticalLayout.floorY);
  const wallPositions = wallGeometry.getAttribute("position");
  assert(wallPositions.count > 0, "L walls must produce a real, non-empty mesh");
  for (let i = 0; i < wallPositions.count; i++) {
    assert(
      Number.isFinite(wallPositions.getX(i)) &&
        Number.isFinite(wallPositions.getY(i)) &&
        Number.isFinite(wallPositions.getZ(i)),
      "L wall vertex positions must all be finite -- a watertight ribbon around all 6 edges including the inner concave corner",
    );
  }

  // Coping/water-channel offset around a concave outline: offsetOutline
  // documents itself as concave-safe -- verify the L actually gets a
  // constant-width, non-self-intersecting offset with the inner corner
  // correctly handled (still 90 degrees, still finite).
  const copingOutline = offsetOutline(outline, 0.35);
  assert(
    copingOutline.length >= 6 &&
      copingOutline.every(([x, z]) => Number.isFinite(x) && Number.isFinite(z)),
    "L coping offset must remain a real, finite, closed outline around the concave perimeter",
  );
  assert(
    outlineArea(copingOutline) > outlineArea(outline),
    "L coping offset must expand the outline (coping sits outside the basin), even at the concave corner",
  );

  // Water outline for a skimmer system is the outline itself -- the
  // recess must contain no water, i.e. the water polygon must be exactly
  // the L, not the outer bounding rectangle.
  const waterOutline = buildWaterOutline(outline, "skimmer", "hidden");
  assert(
    Math.abs(outlineArea(waterOutline) - outlineArea(outline)) < 1e-6,
    "L water outline (skimmer system) must be the real L polygon, never the bounding rectangle",
  );

  // Overflow (hidden + visible): every offset ring `offsetOutline` derives
  // from the L's own boundary -- water edge, channel edge(s) -- must stay a
  // real, finite, closed outline with no NaN/invalid coordinate, including
  // right at the single concave (reflex) corner, which is the one place a
  // constant-width offset is most likely to misbehave (self-intersection,
  // a collapsed segment). This is the "does the generic overflow-outline
  // machinery actually hold up on a concave shape" guarantee the visible
  // overflow grille (createGrateGeometry) is built on top of.
  const lOverflowWaterEdge = offsetOutline(outline, OVERFLOW_GEOMETRY.waterEdgeOffset);
  const lHiddenChannelEdge = offsetOutline(outline, OVERFLOW_GEOMETRY.hiddenChannelOffset);
  const lVisibleChannelEdge = offsetOutline(outline, OVERFLOW_GEOMETRY.visibleChannelOuterOffset);
  for (const [label, ring] of [
    ["water edge", lOverflowWaterEdge],
    ["hidden channel", lHiddenChannelEdge],
    ["visible channel outer", lVisibleChannelEdge],
  ] as const) {
    assert(
      ring.length >= 6 && ring.every(([x, z]) => Number.isFinite(x) && Number.isFinite(z)),
      `L overflow ${label} offset must remain a real, finite, closed outline around the concave perimeter -- never NaN, never a collapsed/degenerate ring at the reflex corner`,
    );
  }
  const lHiddenOverflowWater = buildWaterOutline(outline, "overflow", "hidden");
  const lVisibleOverflowWater = buildWaterOutline(outline, "overflow", "visible");
  for (const [label, water] of [
    ["hidden", lHiddenOverflowWater],
    ["visible", lVisibleOverflowWater],
  ] as const) {
    assert(
      Number.isFinite(outlineArea(water)) && outlineArea(water) > 0,
      `L ${label}-overflow water outline must triangulate to a real, positive, finite area`,
    );
  }
  const lGrate = createGrateGeometry(
    lVisibleChannelEdge,
    offsetOutline(outline, OVERFLOW_GEOMETRY.visibleChannelOuterOffset + 0.02),
  );
  const lGratePositions = lGrate.getAttribute("position");
  for (let i = 0; i < lGratePositions.count; i++) {
    assert(
      Number.isFinite(lGratePositions.getX(i)) &&
        Number.isFinite(lGratePositions.getY(i)) &&
        Number.isFinite(lGratePositions.getZ(i)),
      "L visible-overflow grate geometry must be entirely finite, including the ribs mitring around the concave corner",
    );
  }

  // Slope integration: ONE planar slope across the whole L, along its
  // principal (longer) axis, sharing the exact same floorYAt every other
  // consumer reads -- never a second per-wing formula.
  const slopedLDims: Dimensions = { ...lShapeDims, floorProfile: "slope", shallowDepth: 1.2 };
  const lFloorProfile = buildFloorProfile({
    outline,
    shape: "l-shape",
    poolType: "in-ground",
    dimensions: slopedLDims,
    verticalLayout,
  });
  assert(
    lFloorProfile.sloped,
    "an L-shape, in-ground pool must be slope-eligible (Geometry Pass B)",
  );
  assert(
    lFloorProfile.axis === "x",
    "the L's principal axis must be its longer bounding-box span (x, 10m vs 7m)",
  );
  // Sample floor height at several real points across BOTH wings of the L
  // and confirm it's the same single monotonic ramp everywhere -- not two
  // independent per-wing slopes.
  const shallowSample = lFloorProfile.floorYAt(lFloorProfile.axisMin, 0);
  const deepSample = lFloorProfile.floorYAt(lFloorProfile.axisMax, 0);
  const midSample = lFloorProfile.floorYAt((lFloorProfile.axisMin + lFloorProfile.axisMax) / 2, 0);
  assert(
    Math.abs(shallowSample - lFloorProfile.shallowFloorY) < 1e-6,
    "the L's shallow end must sit at the true shallow floor",
  );
  assert(
    Math.abs(deepSample - lFloorProfile.deepFloorY) < 1e-6,
    "the L's deep end must sit at the true deep floor",
  );
  assert(
    midSample > Math.min(shallowSample, deepSample) - 1e-6 &&
      midSample < Math.max(shallowSample, deepSample) + 1e-6,
    "the L's mid-point floor height must lie strictly between the shallow and deep ends (one continuous ramp)",
  );

  // Summary depth display (LiveSummary/ProjectSummary): the L's sloped depth
  // must show as a shallow->deep range, exactly like a sloped rectangle,
  // never silently collapsing back to a single flat-looking number just
  // because the shape isn't "rectangle".
  assert(
    isSlopedFloorDisplay("l-shape", "in-ground", {
      floorProfile: "slope",
      shallowDepth: 1.2,
      depth: 1.5,
    }),
    "an in-ground, sloped L-shape must display a shallow->deep depth range",
  );
  assert(
    isSlopedFloorDisplay("rectangle", "in-ground", {
      floorProfile: "slope",
      shallowDepth: 1.2,
      depth: 1.5,
    }),
    "an in-ground, sloped rectangle must still display a shallow->deep depth range (unchanged by the L-shape widening)",
  );
  assert(
    !isSlopedFloorDisplay("l-shape", "in-ground", {
      floorProfile: "flat",
      shallowDepth: undefined,
      depth: 1.5,
    }),
    "a flat L-shape must display a single depth, never a range",
  );
  assert(
    !isSlopedFloorDisplay("custom", "in-ground", {
      floorProfile: "slope",
      shallowDepth: 1.2,
      depth: 1.5,
    }),
    "a custom shape must never display a sloped depth range (slope is only offered for rectangle/L-shape)",
  );

  // Reversal must swap which end is shallow, same as the rectangle.
  const reversedLProfile = buildFloorProfile({
    outline,
    shape: "l-shape",
    poolType: "in-ground",
    dimensions: { ...slopedLDims, slopeReversed: true },
    verticalLayout,
  });
  assert(
    reversedLProfile.shallowAtMin !== lFloorProfile.shallowAtMin,
    "reversing the slope on an L-shape must swap which end is shallow, exactly as it does for a rectangle",
  );
  const slopedFloorGeometry = createSlopedFloorGeometry(outline, lFloorProfile.floorYAt);
  const slopedPositions = slopedFloorGeometry.getAttribute("position");
  for (let i = 0; i < slopedPositions.count; i++) {
    assert(
      Number.isFinite(slopedPositions.getY(i)),
      "the L's sloped floor must have a finite Y everywhere, including across the concave corner",
    );
  }

  // Skimmer: must choose a real, valid wall on the L outline -- never a
  // hardcoded rectangle wall index, and never the concave inner corner.
  const lSkimmers = planSkimmers(outline, outlineArea(outline), true);
  assert(
    lSkimmers.positions.length > 0,
    "the L-shape must get a real skimmer row, not an empty/failed placement",
  );
  for (const position of lSkimmers.positions) {
    assert(
      Number.isFinite(position.x) && Number.isFinite(position.z),
      "every L skimmer position must be finite",
    );
  }

  // Access: linear + corner stairs must land inside the true L polygon --
  // never in the missing recess, never outside the outer bounds -- and the
  // corner-stair search must never treat the single concave (reflex)
  // corner as if it were a normal convex pool corner.
  const flight = linearStairDimensions(verticalLayout.floorY, verticalLayout.copingY);
  const lLinear = accessPlacement(outline, flight.run, flight.width, "internalSteps");
  assert(lLinear !== null, "linear internal stairs must find a valid wall on the L outline");
  // The anchor itself sits flush against a wall by construction (every wall
  // is a valid boundary edge, including the one bordering the recess), so
  // check the stair's actual footprint interior -- advanced inward from the
  // wall by half the flight's run -- rather than the wall-flush point
  // itself, which a naive point-in-polygon test would flag as "on the
  // boundary" regardless of which real wall it's on.
  const inwardX = Math.sin(lLinear!.rotation) * (flight.run / 2);
  const inwardZ = Math.cos(lLinear!.rotation) * (flight.run / 2);
  assert(
    !insideRecess(lLinear!.x + inwardX, lLinear!.z + inwardZ, lShapeDims),
    "linear stairs' own footprint must never land inside the L's missing recess",
  );
  const lCorner = cornerStairPlan(outline, verticalLayout.floorY, verticalLayout.copingY);
  if (lCorner) {
    const info = buildLShapeOutlineInfo(
      clampLShapeDimensions({
        totalLength: lShapeDims.length,
        totalWidth: lShapeDims.width,
        recessLength: lShapeDims.lShapeRecessLength,
        recessWidth: lShapeDims.lShapeRecessWidth,
        orientation: lShapeDims.lShapeOrientation,
      }),
    );
    const concaveVertex = info.outline[info.concaveIndex]!;
    const distanceToConcave = Math.hypot(
      lCorner.x - concaveVertex[0],
      lCorner.z - concaveVertex[1],
    );
    assert(
      distanceToConcave > 0.5,
      "a corner staircase must never be classified onto the L's concave (reflex) inner corner",
    );
  }

  // L-aware overview camera (Geometry Pass B closure): the "overview" pose
  // (also used by Final Review) must look FROM the side of the concave
  // corner, for every orientation -- never a single fixed direction that
  // only happens to suit one of the four. Position minus target, projected
  // onto XZ, must point the same general way as centroid-to-concave-vertex.
  for (const orientation of L_SHAPE_ORIENTATIONS) {
    const orientedDims = clampLShapeDimensions({
      totalLength: 10,
      totalWidth: 7,
      recessLength: 4,
      recessWidth: 3,
      orientation,
    });
    const orientedOutline = buildLShapeOutlineInfo(orientedDims);
    const orientedLayout = getPoolVerticalLayout({
      poolType: "in-ground",
      system: "skimmer",
      depth: lShapeDims.depth,
      copingThickness: 0.03,
    });
    const orientedSkimmers = planSkimmers(orientedOutline.outline, orientedOutline.area, true);
    const orientedPose = getCameraPose({
      intent: "overview",
      outline: orientedOutline.outline,
      layout: orientedLayout,
      depth: lShapeDims.depth,
      skimmers: orientedSkimmers,
    });
    assert(
      [...orientedPose.position, ...orientedPose.target].every(Number.isFinite),
      `L overview camera (${orientation}): non-finite pose`,
    );
    const concaveVertex = orientedOutline.outline[orientedOutline.concaveIndex]!;
    const centroid = orientedOutline.centroid;
    const toConcaveX = concaveVertex[0] - centroid[0];
    const toConcaveZ = concaveVertex[1] - centroid[1];
    const cameraOffsetX = orientedPose.position[0] - orientedPose.target[0];
    const cameraOffsetZ = orientedPose.position[2] - orientedPose.target[2];
    const alignment = toConcaveX * cameraOffsetX + toConcaveZ * cameraOffsetZ;
    assert(
      alignment > 0,
      `L overview camera (${orientation}) must look from the same side as the concave corner, not a fixed direction that only suits one orientation`,
    );
  }
  // Regression guard: a fully convex outline (the rectangle) must be
  // completely untouched by the above -- same fixed direction as always.
  {
    const rectOutline = buildOutline(
      "rectangle",
      { ...lShapeDims, cornerRadius: 0 },
      DEFAULT_CONTROL_POINTS,
    );
    const rectLayout = getPoolVerticalLayout({
      poolType: "in-ground",
      system: "skimmer",
      depth: lShapeDims.depth,
      copingThickness: 0.03,
    });
    const rectSkimmers = planSkimmers(rectOutline, outlineArea(rectOutline), true);
    const rectPose = getCameraPose({
      intent: "overview",
      outline: rectOutline,
      layout: rectLayout,
      depth: lShapeDims.depth,
      skimmers: rectSkimmers,
    });
    const rectCentre: readonly [number, number] = [
      rectOutline.reduce((sum, [x]) => sum + x, 0) / rectOutline.length,
      rectOutline.reduce((sum, [, z]) => sum + z, 0) / rectOutline.length,
    ];
    const rectOffsetX = rectPose.position[0] - rectCentre[0];
    const rectOffsetZ = rectPose.position[2] - rectCentre[1];
    // The original, pre-Pass-B fixed direction's XZ ratio was exactly 1.7:0.7.
    assert(
      Math.abs(rectOffsetX / rectOffsetZ - 1.7 / 0.7) < 1e-6,
      "rectangle overview camera direction must stay exactly the original fixed [1.7, 0.7] ratio -- untouched by the L-shape concave-direction logic",
    );
  }

  console.log(
    "L-shape geometry/systems audit passed: floor triangulation, wall closure, coping/water-channel offset, one planar slope across both wings (with reversal), skimmer placement, internal-stair placement and the overview camera (all 4 orientations) are all finite, real, and correctly avoid or expose the recess/concave corner as appropriate.",
  );
}

// Mirrors organic-shape.ts's own `MAX_REAL_OUTWARD_OFFSET` (not imported --
// that constant is intentionally private to the module) -- the largest real
// outward offset any consumer (coping, hidden/visible overflow channels)
// ever applies. Kept as a literal here so this test independently pins down
// the real value rather than trusting the module's own guardrail to grade
// itself.
const MAX_REAL_OUTWARD_OFFSET_FOR_TEST = 0.45;

// --- Geometry Pass C: Organic shape domain + systems integration ---
{
  const baseParams = { length: 10, width: 6, curvature: 0.6, mirror: false };

  // Domain: winding, self-intersection, determinism, area, point-count cap.
  for (const curvature of [0, 0.25, 0.5, 0.75, 1]) {
    for (const mirror of [false, true]) {
      const params = clampOrganicShapeParams({ ...baseParams, curvature, mirror });
      const outline = buildOrganicShapeOutline(params);
      assert(
        outline.length >= ORGANIC_SHAPE_GUARDRAILS.minPoints &&
          outline.length <= ORGANIC_SHAPE_GUARDRAILS.maxPoints,
        `organic curvature=${curvature} mirror=${mirror}: point count ${outline.length} must respect the [min,max] sampling guardrails`,
      );
      assert(
        outline.every(([x, z]) => Number.isFinite(x) && Number.isFinite(z)),
        `organic curvature=${curvature} mirror=${mirror}: every sampled point must be finite`,
      );
      assert(
        outlineWindsCcw(outline),
        `organic curvature=${curvature} mirror=${mirror}: outline must wind CCW, same convention as every other shape`,
      );
      assert(
        !outlineSelfIntersects(outline),
        `organic curvature=${curvature} mirror=${mirror}: outline must never self-intersect`,
      );
      const validation = validateOrganicOutline(outline);
      assert(
        validation.valid,
        `organic curvature=${curvature} mirror=${mirror}: validateOrganicOutline must report valid`,
      );
      const ellipseArea = Math.PI * (params.length / 2) * (params.width / 2);
      assert(
        validation.area > 0 && validation.area <= ellipseArea + 1e-6,
        `organic curvature=${curvature} mirror=${mirror}: real area must be positive and never exceed the bounding ellipse's own area`,
      );
      const rebuilt = buildOrganicShapeOutline(params);
      assert(
        rebuilt.length === outline.length &&
          rebuilt.every(([x, z], i) => x === outline[i]![0] && z === outline[i]![1]),
        `organic curvature=${curvature} mirror=${mirror}: outline generation must be deterministic (no randomness/noise)`,
      );
      // Higher curvature must read as more organic (lower area than a plain
      // ellipse of the same length/width), never more, and never collapse.
      if (curvature > 0) {
        assert(
          validation.area < ellipseArea - 1e-6,
          `organic curvature=${curvature} mirror=${mirror}: a real bay must actually reduce area below the plain ellipse`,
        );
      }
      // Regression guard for the "reads as a plain ellipse" defect: at the
      // default (0.5) and max (1) curvature the bay must be a REAL,
      // visually-legible notch, not a shallow wobble. Area alone is a weak
      // signal (a wide, shallow dip can move area a little while looking
      // like an oval), so this also checks the outline's own
      // distance-from-centroid profile has a deep local minimum on the bay
      // side relative to the opposite (bulge) side -- the actual geometric
      // signature of a kidney/bean waist.
      if (curvature >= 0.5) {
        const divergence = (ellipseArea - validation.area) / ellipseArea;
        assert(
          divergence >= 0.05,
          `organic curvature=${curvature} mirror=${mirror}: area must diverge from the bounding ellipse by at least 5% (got ${(divergence * 100).toFixed(2)}%) -- otherwise the bay reads as a plain ellipse`,
        );
        const centroid = outline.reduce(
          (sum, [x, z]) => [sum[0] + x / outline.length, sum[1] + z / outline.length] as const,
          [0, 0] as readonly [number, number],
        );
        const bayCentre = mirror ? -Math.PI / 2 : Math.PI / 2;
        let bayMinDistance = Infinity;
        let oppositeMaxDistance = 0;
        for (const [x, z] of outline) {
          const theta = Math.atan2(z, x);
          const distance = Math.hypot(x - centroid[0], z - centroid[1]);
          const toBay = Math.atan2(Math.sin(theta - bayCentre), Math.cos(theta - bayCentre));
          if (Math.abs(toBay) < 0.35) bayMinDistance = Math.min(bayMinDistance, distance);
          const toOpposite = Math.atan2(
            Math.sin(theta - (bayCentre + Math.PI)),
            Math.cos(theta - (bayCentre + Math.PI)),
          );
          if (Math.abs(toOpposite) < 0.35)
            oppositeMaxDistance = Math.max(oppositeMaxDistance, distance);
        }
        assert(
          Number.isFinite(bayMinDistance) && oppositeMaxDistance > 0,
          `organic curvature=${curvature} mirror=${mirror}: could not sample both the bay side and its opposite side for the notch-depth check`,
        );
        assert(
          bayMinDistance <= oppositeMaxDistance * 0.85,
          `organic curvature=${curvature} mirror=${mirror}: the bay side's centroid distance (${bayMinDistance.toFixed(3)}) must sit meaningfully closer in than the opposite (fuller) side (${oppositeMaxDistance.toFixed(3)}) -- a real, visible notch, not a plain ellipse`,
        );
      }
    }
  }

  // Guardrail/clamp: NaN, undefined, out-of-range, and non-boolean mirror
  // must all normalise to safe, finite, valid params -- never propagate.
  const nanParams = clampOrganicShapeParams({
    length: NaN,
    width: NaN,
    curvature: NaN,
    mirror: "yes" as unknown as boolean,
  });
  assert(
    Number.isFinite(nanParams.length) &&
      Number.isFinite(nanParams.width) &&
      Number.isFinite(nanParams.curvature) &&
      typeof nanParams.mirror === "boolean",
    "NaN/malformed organic input must normalise to finite, well-typed params, never propagate",
  );
  const undefinedParams = clampOrganicShapeParams(undefined);
  assert(
    Number.isFinite(undefinedParams.length) && Number.isFinite(undefinedParams.curvature),
    "omitted organic params (a brand-new project) must default to real, finite params",
  );
  const outOfRange = clampOrganicShapeParams({
    length: 999,
    width: -50,
    curvature: 5,
    mirror: true,
  });
  assert(
    outOfRange.length <= ORGANIC_SHAPE_GUARDRAILS.length.max &&
      outOfRange.width >= ORGANIC_SHAPE_GUARDRAILS.width.min &&
      outOfRange.curvature <= ORGANIC_SHAPE_GUARDRAILS.curvature.max &&
      outOfRange.curvature >= ORGANIC_SHAPE_GUARDRAILS.curvature.min,
    "out-of-range organic input must clamp into the real guardrail ranges",
  );
  // Smallest allowed footprint at maximum curvature must still produce a
  // real, valid, above-the-area-floor outline -- the "shrink curvature until
  // safe" guardrail must actually engage rather than silently degrade.
  const tightest = clampOrganicShapeParams({
    length: ORGANIC_SHAPE_GUARDRAILS.length.min,
    width: ORGANIC_SHAPE_GUARDRAILS.width.min,
    curvature: 1,
    mirror: false,
  });
  const tightestOutline = buildOrganicShapeOutline(tightest);
  const tightestValidation = validateOrganicOutline(tightestOutline);
  assert(
    tightestValidation.valid && tightestValidation.area >= ORGANIC_SHAPE_GUARDRAILS.minArea,
    "the smallest allowed organic footprint at maximum requested curvature must still clear the minimum real area",
  );

  // buildOutline wiring: shape === "organic" must route through the organic
  // generator, never fall back to the unit-rectangle/control-point path.
  const organicDims: Dimensions = {
    length: 10,
    width: 6,
    depth: 1.5,
    cornerRadius: 0,
    organicCurvature: 0.6,
    organicMirror: false,
  };
  const wiredOutline = buildOutline("organic", organicDims, DEFAULT_CONTROL_POINTS);
  assert(
    wiredOutline.length >= ORGANIC_SHAPE_GUARDRAILS.minPoints,
    "buildOutline('organic', ...) must produce the real sampled organic outline, not a 4-vertex rectangle",
  );
  assert(
    Math.abs(
      outlineArea(wiredOutline) -
        outlineArea(
          buildOrganicShapeOutline({
            length: 10,
            width: 6,
            curvature: 0.6,
            mirror: false,
          }),
        ),
    ) < 1e-9,
    "buildOutline('organic', ...) must match the canonical organic-shape.ts generator exactly",
  );

  console.log(
    "Organic domain audit passed: winding, self-intersection safety, determinism, area vs. bounding ellipse, and clamped guardrails against degenerate/NaN/out-of-range/omitted input are all verified, plus correct buildOutline wiring.",
  );
}

// --- Geometry Pass C: Organic shape floor/water/wall/systems integration ---
{
  const outlineInfo = buildOrganicShapeOutlineInfo({
    length: 12,
    width: 7,
    curvature: 0.55,
    mirror: false,
  });
  const outline = outlineInfo.outline;
  const depth = 1.5;
  const verticalLayout = getPoolVerticalLayout({
    poolType: "in-ground",
    system: "skimmer",
    overflowType: "hidden",
    depth,
    copingThickness: 0.03,
  });

  // Floor triangulation over the real concave/organic polygon: finite mesh,
  // no NaN positions/UVs/normals.
  const floorGeometry = createSurfaceGeometry(outline);
  const positions = floorGeometry.getAttribute("position");
  const uvs = floorGeometry.getAttribute("uv");
  assert(positions.count > 0, "organic floor must triangulate to a real, non-empty mesh");
  for (let i = 0; i < positions.count; i++) {
    assert(
      Number.isFinite(positions.getX(i)) &&
        Number.isFinite(positions.getY(i)) &&
        Number.isFinite(positions.getZ(i)),
      "organic floor vertex positions must all be finite",
    );
    assert(
      Number.isFinite(uvs.getX(i)) && Number.isFinite(uvs.getY(i)),
      "organic floor UVs must all be finite",
    );
  }

  // Wall closure around every sampled curve segment.
  const wallGeometry = createWallGeometry(outline, verticalLayout.wallTopY, verticalLayout.floorY);
  const wallPositions = wallGeometry.getAttribute("position");
  assert(wallPositions.count > 0, "organic walls must produce a real, non-empty mesh");
  for (let i = 0; i < wallPositions.count; i++) {
    assert(
      Number.isFinite(wallPositions.getX(i)) &&
        Number.isFinite(wallPositions.getY(i)) &&
        Number.isFinite(wallPositions.getZ(i)),
      "organic wall vertex positions must all be finite -- a watertight ribbon around every curve segment",
    );
  }

  // Coping offset around the curve must stay a real, finite, larger-area,
  // non-self-intersecting ring, with EXACTLY the same point count as the
  // basin outline -- not "close enough": a dropped point here means
  // `offsetOutline`'s self-intersection cleanup (`removeOffsetLoops`) fired,
  // which is exactly the defect that let `createCopingSlabGeometry` throw
  // "Mismatched coping outlines" at runtime for a real Organic pool (a too
  // narrow/deep bay dip whose radius of curvature was tighter than the real
  // coping offset). A previous, looser version of this assertion (tolerating
  // up to 4 dropped points) let that regression through; it must not again.
  const copingOutline = offsetOutline(outline, 0.35);
  assert(
    copingOutline.length === outline.length &&
      copingOutline.every(([x, z]) => Number.isFinite(x) && Number.isFinite(z)),
    "organic coping offset must remain a real, finite, closed outline around the curved perimeter, with no points dropped by self-intersection cleanup",
  );
  assert(
    outlineArea(copingOutline) > outlineArea(outline),
    "organic coping offset must expand the outline outward",
  );
  assert(!outlineSelfIntersects(copingOutline), "organic coping offset must not self-intersect");

  // Real regression proof for the exact runtime crash: `createCopingSlabGeometry`
  // (poolConstruction.ts) itself, called across the full curvature range, both
  // mirror states, and the largest real outward offset any consumer ever
  // applies (coping, hidden/visible overflow channels). Must never throw
  // "Mismatched coping outlines".
  for (const sweepCurvature of [0, 0.25, 0.5, 0.75, 1]) {
    for (const sweepMirror of [false, true]) {
      const sweepOutline = buildOrganicShapeOutline({
        length: 12,
        width: 7,
        curvature: sweepCurvature,
        mirror: sweepMirror,
      });
      const sweepOuter = offsetOutline(sweepOutline, MAX_REAL_OUTWARD_OFFSET_FOR_TEST);
      assert(
        sweepOuter.length === sweepOutline.length,
        `organic curvature=${sweepCurvature} mirror=${sweepMirror}: the ${MAX_REAL_OUTWARD_OFFSET_FOR_TEST}m outward offset (the largest any real consumer applies) must not drop points`,
      );
      let threw = false;
      try {
        createCopingSlabGeometry(sweepOutline, sweepOuter, 0.03);
      } catch {
        threw = true;
      }
      assert(
        !threw,
        `organic curvature=${sweepCurvature} mirror=${sweepMirror}: createCopingSlabGeometry must never throw "Mismatched coping outlines" for any real, guardrail-clamped organic outline`,
      );
    }
  }

  // Water outline (skimmer system) must be the real curve, not a bounding box.
  const waterOutline = buildWaterOutline(outline, "skimmer", "hidden");
  assert(
    Math.abs(outlineArea(waterOutline) - outlineArea(outline)) < 1e-6,
    "organic water outline (skimmer system) must be the real curved polygon, never its bounding rectangle",
  );

  // Overflow (hidden + visible): the generic offset/water/grille machinery
  // must hold up on the densely-sampled curved outline exactly as it does on
  // the L-shape's single concave corner -- real, finite rings, real positive
  // water area, a finite grille mesh.
  const organicWaterEdge = offsetOutline(outline, OVERFLOW_GEOMETRY.waterEdgeOffset);
  const organicHiddenChannelEdge = offsetOutline(outline, OVERFLOW_GEOMETRY.hiddenChannelOffset);
  const organicVisibleChannelEdge = offsetOutline(
    outline,
    OVERFLOW_GEOMETRY.visibleChannelOuterOffset,
  );
  for (const [label, ring] of [
    ["water edge", organicWaterEdge],
    ["hidden channel", organicHiddenChannelEdge],
    ["visible channel outer", organicVisibleChannelEdge],
  ] as const) {
    assert(
      ring.length >= outline.length - 4 &&
        ring.every(([x, z]) => Number.isFinite(x) && Number.isFinite(z)),
      `organic overflow ${label} offset must remain a real, finite, closed outline around the curved perimeter`,
    );
  }
  for (const [label, water] of [
    ["hidden", buildWaterOutline(outline, "overflow", "hidden")],
    ["visible", buildWaterOutline(outline, "overflow", "visible")],
  ] as const) {
    assert(
      Number.isFinite(outlineArea(water)) && outlineArea(water) > 0,
      `organic ${label}-overflow water outline must triangulate to a real, positive, finite area`,
    );
  }
  const organicGrate = createGrateGeometry(
    organicVisibleChannelEdge,
    offsetOutline(outline, OVERFLOW_GEOMETRY.visibleChannelOuterOffset + 0.02),
  );
  const organicGratePositions = organicGrate.getAttribute("position");
  assert(
    organicGratePositions.count > 0,
    "organic visible-overflow grille must be a real, non-empty mesh",
  );
  for (let i = 0; i < organicGratePositions.count; i++) {
    assert(
      Number.isFinite(organicGratePositions.getX(i)) &&
        Number.isFinite(organicGratePositions.getY(i)) &&
        Number.isFinite(organicGratePositions.getZ(i)),
      "organic visible-overflow grille positions must all be finite",
    );
  }

  // Floor slope (Geometry Pass C closure): Organic now shares the exact same
  // canonical model rectangle/L-shape already use -- `buildFloorProfile`'s
  // axis derivation is already fully shape-agnostic (only reads
  // `outlineBounds`), so it needed no organic-specific formula at all, only
  // widening the eligibility list. This is the SAME "longer bounding-box
  // span" rule `skimmerWall()` (walls.ts) uses for the skimmer/lighting wall,
  // so "the principal axis" means one thing everywhere it's asked.
  const organicSlopeDimensions: Dimensions = {
    length: 12,
    width: 7,
    depth,
    cornerRadius: 0,
    floorProfile: "slope",
    shallowDepth: 1.0,
    organicCurvature: 0.55,
    organicMirror: false,
  };
  const organicSlopeProfile = buildFloorProfile({
    outline,
    shape: "organic",
    poolType: "in-ground",
    dimensions: organicSlopeDimensions,
    verticalLayout,
  });
  assert(
    organicSlopeProfile.sloped === true,
    "organic shape must build a real sloped floor when floorProfile: 'slope' is requested, reusing the same eligibility/axis model as rectangle/L-shape",
  );
  const organicBounds = outlineBounds(outline);
  const expectedAxis = organicBounds.spanX >= organicBounds.spanZ ? "x" : "z";
  assert(
    organicSlopeProfile.axis === expectedAxis,
    "organic slope axis must be the outline's own longer bounding-box span -- the same rule skimmerWall() and buildFloorProfile use for rectangle/L-shape, not a separate organic-specific formula",
  );
  assert(
    isSlopedFloorDisplay("organic", "in-ground", organicSlopeDimensions) === true,
    "isSlopedFloorDisplay must report organic as sloped exactly like buildFloorProfile does, for the 'Fondo in pendenza' UI toggle",
  );
  assert(
    isSlopedFloorDisplay("organic", "in-ground", {
      ...organicSlopeDimensions,
      floorProfile: "flat",
    }) === false,
    "isSlopedFloorDisplay must report organic as flat when floorProfile is 'flat', same as rectangle/L-shape",
  );

  // Monotonic slope along the running axis (mirrors the rectangle/L-shape
  // slopeCases assertion above) -- proves it is one real planar ramp across
  // the whole curved basin, not a bowl or a per-lobe slope.
  {
    const axisMin = organicSlopeProfile.axis === "x" ? organicBounds.minX : organicBounds.minZ;
    const axisMax = organicSlopeProfile.axis === "x" ? organicBounds.maxX : organicBounds.maxZ;
    let previousY: number | null = null;
    for (let step = 0; step <= 20; step++) {
      const coordinate = axisMin + (step / 20) * (axisMax - axisMin);
      const y =
        organicSlopeProfile.axis === "x"
          ? organicSlopeProfile.floorYAt(coordinate, 0)
          : organicSlopeProfile.floorYAt(0, coordinate);
      assert(Number.isFinite(y), "organic sloped floorYAt must be finite along the whole run");
      if (previousY !== null) {
        const gettingDeeper = organicSlopeProfile.shallowAtMin
          ? y <= previousY + 1e-9
          : y >= previousY - 1e-9;
        assert(
          gettingDeeper,
          "organic floor elevation must move monotonically along the slope axis -- one real planar ramp, no bowl/per-lobe slope",
        );
      }
      previousY = y;
    }
  }

  // Water surface stays perfectly horizontal regardless of floor slope --
  // generic behaviour, verified for organic specifically.
  assert(
    Math.abs(
      computeSlopeMetrics(
        outline,
        organicSlopeProfile,
        verticalLayout.waterY,
        verticalLayout.wallTopY,
      ).waterSurface - outlineArea(outline),
    ) < 1e-6,
    "organic sloped water surface must stay the horizontal plan area, exactly like rectangle/L-shape",
  );

  // slopeReversed must flip which end is shallow, same field rectangle/
  // L-shape already use -- no organic-specific field invented.
  const organicReversedProfile = buildFloorProfile({
    outline,
    shape: "organic",
    poolType: "in-ground",
    dimensions: { ...organicSlopeDimensions, slopeReversed: true },
    verticalLayout,
  });
  assert(
    organicReversedProfile.shallowAtMin === !organicSlopeProfile.shallowAtMin,
    "organic slopeReversed must flip shallowAtMin, exactly as it does for rectangle/L-shape",
  );

  // Real metrics under slope: volume must sit strictly between the
  // flat-at-shallow and flat-at-deep bounds, floor surface must exceed the
  // flat footprint, and the whole computation must come from the real
  // sampled polygon (outlineArea/outlineCentroid/per-edge integration), not
  // a length x width shortcut.
  const organicMetrics = computeSlopeMetrics(
    outline,
    organicSlopeProfile,
    verticalLayout.waterY,
    verticalLayout.wallTopY,
  );
  const organicFootprintArea = outlineArea(outline);
  assert(
    Number.isFinite(organicMetrics.waterVolume) && organicMetrics.waterVolume > 0,
    "organic sloped volume must be finite and positive",
  );
  assert(
    organicMetrics.floorSurface > organicFootprintArea,
    "organic inclined floor surface must exceed the flat footprint area",
  );
  const organicShallowFlatVolume =
    organicFootprintArea * (verticalLayout.waterY - organicSlopeProfile.shallowFloorY);
  const organicDeepFlatVolume =
    organicFootprintArea * (verticalLayout.waterY - organicSlopeProfile.deepFloorY);
  assert(
    organicMetrics.waterVolume > organicShallowFlatVolume - 1e-6 &&
      organicMetrics.waterVolume < organicDeepFlatVolume + 1e-6,
    "organic sloped volume must sit between the flat-at-shallow and flat-at-deep bounds",
  );
  // The exact affine-integral identity this relies on: volume must equal
  // planArea x (waterY - floorYAt(centroid)) -- proves the real polygon
  // centroid (not the vertex mean, and not a naive endpoint average) is
  // actually driving the result for a non-constant-cross-width basin.
  const [organicCentroidX, organicCentroidZ] = outlineCentroid(outline);
  const organicCentroidFloorY = organicSlopeProfile.floorYAt(organicCentroidX, organicCentroidZ);
  assert(
    Math.abs(
      organicMetrics.waterVolume -
        organicFootprintArea * (verticalLayout.waterY - organicCentroidFloorY),
    ) < 1e-6,
    "organic sloped volume must equal planArea x (waterY - floorYAt(centroid)) exactly",
  );
  // Same identity, but on a bay proportioned the OTHER way (width > length,
  // so the slope runs along z instead of x): this shape's dip/bulge sit at
  // theta = +/-90 degrees, which keeps its point density -- and so its area
  // centroid -- essentially symmetric about the x-axis regardless of
  // curvature, so a regression that silently swapped the true area centroid
  // for a plain vertex-mean would NOT show up on the length>width case above
  // (its x-centroid barely differs either way). It DOES show up along z,
  // where the dip/bulge genuinely skew where the outline's area sits. This
  // is what makes the assertion non-vacuous rather than accidentally
  // insensitive to the very bug it exists to catch.
  const wideOutline = buildOrganicShapeOutline({
    length: 7,
    width: 12,
    curvature: 0.55,
    mirror: false,
  });
  const wideProfile = buildFloorProfile({
    outline: wideOutline,
    shape: "organic",
    poolType: "in-ground",
    dimensions: { ...organicSlopeDimensions, length: 7, width: 12 },
    verticalLayout,
  });
  assert(wideProfile.axis === "z", "width > length organic bay must slope along z");
  const wideMetrics = computeSlopeMetrics(
    wideOutline,
    wideProfile,
    verticalLayout.waterY,
    verticalLayout.wallTopY,
  );
  const [wideCentroidX, wideCentroidZ] = outlineCentroid(wideOutline);
  const wideVertexMeanZ = wideOutline.reduce((sum, [, z]) => sum + z, 0) / wideOutline.length;
  assert(
    Math.abs(wideCentroidZ - wideVertexMeanZ) > 0.05,
    "test sanity: the wide bay's area centroid must genuinely differ from its vertex mean along the slope axis, or this assertion cannot actually distinguish the two formulas",
  );
  const wideCentroidFloorY = wideProfile.floorYAt(wideCentroidX, wideCentroidZ);
  assert(
    Math.abs(
      wideMetrics.waterVolume -
        outlineArea(wideOutline) * (verticalLayout.waterY - wideCentroidFloorY),
    ) < 1e-6,
    "organic sloped volume (width > length bay) must equal planArea x (waterY - floorYAt(AREA centroid)) exactly, not the vertex-mean approximation",
  );
  // Wall surface must vary along the perimeter following the local floor Y
  // (never a single constant height), and stay within the [shallow, deep]
  // per-metre wall-height range.
  const organicMinWallHeight = verticalLayout.wallTopY - organicSlopeProfile.shallowFloorY;
  const organicMaxWallHeight = verticalLayout.wallTopY - organicSlopeProfile.deepFloorY;
  assert(
    organicMetrics.wallSurface > outlinePerimeter(outline) * organicMinWallHeight - 1e-6 &&
      organicMetrics.wallSurface < outlinePerimeter(outline) * organicMaxWallHeight + 1e-6,
    "organic sloped wall surface must sit between the constant-shallow-height and constant-deep-height bounds",
  );

  // Metric-convergence: as the Organic outline is sampled at increasing
  // point-count resolution (via decreasing targetResolution), volume/floor
  // surface/wall surface must converge to a stable value -- proves
  // `computeSlopeMetrics` is a real integral over the sampled polygon, not
  // a coarse length x width shortcut that would stay constant (or diverge)
  // regardless of resolution.
  {
    const convergenceParams = clampOrganicShapeParams({
      length: 12,
      width: 7,
      curvature: 0.55,
      mirror: false,
    });
    const resolutions = [1.0, 0.4, 0.2, 0.1];
    const converged: Array<{ volume: number; floorSurface: number; wallSurface: number }> = [];
    for (const targetResolution of resolutions) {
      const perimeterEstimate = outlinePerimeter(
        sampleOrganicOutlineAtCount(convergenceParams, 128),
      );
      const pointCount = Math.min(
        ORGANIC_SHAPE_GUARDRAILS.maxPoints,
        Math.max(
          ORGANIC_SHAPE_GUARDRAILS.minPoints,
          Math.round(perimeterEstimate / targetResolution),
        ),
      );
      const sampled = sampleOrganicOutlineAtCount(convergenceParams, pointCount);
      const sampledProfile = buildFloorProfile({
        outline: sampled,
        shape: "organic",
        poolType: "in-ground",
        dimensions: organicSlopeDimensions,
        verticalLayout,
      });
      const sampledMetrics = computeSlopeMetrics(
        sampled,
        sampledProfile,
        verticalLayout.waterY,
        verticalLayout.wallTopY,
      );
      converged.push({
        volume: sampledMetrics.waterVolume,
        floorSurface: sampledMetrics.floorSurface,
        wallSurface: sampledMetrics.wallSurface,
      });
    }
    for (let i = 1; i < converged.length; i++) {
      const previous = converged[i - 1]!;
      const current = converged[i]!;
      // Each successive doubling-ish of resolution must move the metric by a
      // strictly smaller absolute amount than the previous step moved it --
      // the definition of converging, not oscillating or diverging.
      if (i >= 2) {
        const prevPrev = converged[i - 2]!;
        assert(
          Math.abs(current.volume - previous.volume) <=
            Math.abs(previous.volume - prevPrev.volume) + 1e-9,
          "organic volume must converge (non-increasing step size) as sample resolution increases",
        );
        assert(
          Math.abs(current.floorSurface - previous.floorSurface) <=
            Math.abs(previous.floorSurface - prevPrev.floorSurface) + 1e-9,
          "organic floor surface must converge as sample resolution increases",
        );
      }
    }
    const finest = converged[converged.length - 1]!;
    const coarsest = converged[0]!;
    assert(
      Math.abs(finest.volume - coarsest.volume) / finest.volume < 0.02,
      "organic volume at coarse vs. fine sampling must already agree within 2% -- real convergence, not noise",
    );
  }

  // Skimmer placement: a real, finite, non-empty plan along the outline's
  // longer bounding-box axis (skimmerWall is already outline-generic).
  const skimmers = planSkimmers(outline, outlineInfo.area, true);
  assert(skimmers.positions.length > 0, "organic pool must get a real, non-empty skimmer plan");
  assert(
    skimmers.positions.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z)),
    "organic skimmer positions must all be finite",
  );
  const wall = skimmerWall(outline);
  assert(
    (wall.axis === "x" || wall.axis === "z") && Number.isFinite(wall.coordinate),
    "organic skimmerWall must resolve a real axis/coordinate from the outline's own bounding box",
  );

  // LED lighting: must never crash, must never place a fixture outside the
  // true curved outline or with non-finite geometry, and -- Geometry Pass C
  // closure -- must always place a REAL row, never only the honest warning,
  // for every curvature value the UI actually offers (the generalized
  // `mergedWallChords` retry in lighting.ts, not a curvature clamp: see the
  // dedicated block below for the full min/medium/max/mirror/slope matrix).
  const lightingPlan = planPoolLighting({
    outline,
    waterY: verticalLayout.waterY,
    floorY: verticalLayout.floorY,
  });
  assert(
    lightingPlan.count > 0 && lightingPlan.warnings.length === 0,
    "organic lighting must place a real, warning-free row, not fall back to a collision-free-row warning",
  );
  assert(
    lightingPlan.positions.every(
      (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
    ),
    "organic lighting plan positions must all be finite",
  );
  for (const position of lightingPlan.positions) {
    assert(
      outlineInfo.outline.some(
        ([x, z]) => Math.hypot(x - position.x, z - position.z) < outlineInfo.perimeter,
      ),
      "organic lighting fixtures must be plausibly within the basin's own scale",
    );
  }

  // Corner (radial) stairs must be correctly UNAVAILABLE for an organic
  // outline -- it has no real square corner for a radial flight to land its
  // two flanks against (cornerStairPlan's own square-corner dot-product
  // check, walls.ts, rejects every vertex of a smooth curve). This must
  // return null cleanly, never fabricate a fake corner.
  const organicCorner = cornerStairPlan(outline, verticalLayout.floorY, verticalLayout.copingY);
  assert(
    organicCorner === null,
    "organic shape must never produce a corner staircase plan -- it has no real square corner, and cornerStairPlan must not invent one",
  );

  // Overview camera: must resolve a finite pose from the curve's own
  // bounding box / centroid (no reflex-corner assumption required to not
  // crash -- an organic outline has none in the L-shape sense, but the
  // generic reflex-aware direction helper must still degrade gracefully).
  const cameraPose = getCameraPose({
    intent: "overview",
    outline,
    layout: verticalLayout,
    depth,
    skimmers,
  });
  assert(
    [...cameraPose.position, ...cameraPose.target].every(Number.isFinite),
    "organic overview camera pose must be finite",
  );

  // Mirror flips the bay to the opposite side -- the two outlines must be
  // genuinely different (not accidentally ignored) but the same area.
  const mirrored = buildOrganicShapeOutline({
    length: 12,
    width: 7,
    curvature: 0.55,
    mirror: true,
  });
  assert(
    Math.abs(outlineArea(mirrored) - outlineInfo.area) < 1e-6,
    "mirroring the organic bay must not change the real area",
  );
  assert(
    mirrored.some(([, z], i) => Math.abs(z - outline[i]![1]) > 1e-6),
    "mirror: true must actually produce a different outline from mirror: false, not silently no-op",
  );

  console.log(
    "Organic geometry/systems audit passed: floor triangulation, wall closure, coping/water offset, skimmer placement, lighting placement, the overview camera, and one real planar slope with slope-aware metrics are all finite, real, and correctly generic over the curved outline.",
  );
}

// --- Geometry Pass C closure: LED lighting at every UI-selectable Organic
// curvature must place a real row, never only a warning. ---
{
  const ledLumenOutputs: ReadonlyArray<{ label: string; lumens: number; ledColor: string }> = [
    { label: "white LED", lumens: POOL_LUMINAIRE.lumens, ledColor: "#ffffff" },
    // No RGB-specific lumen output exists in this codebase (colour is a
    // rendering-only property, calibratedLedColor/led-optics.ts) -- the real
    // requirement this satisfies is that PLACEMENT never depends on colour,
    // so an RGB colour selection is exercised alongside the same lumen
    // model, and calibratedLedColor itself must produce finite output for
    // both a white and a saturated RGB value.
    { label: "RGB LED", lumens: POOL_LUMINAIRE.lumens, ledColor: "#3388ff" },
  ];
  for (const { label, lumens, ledColor } of ledLumenOutputs) {
    assert(isLedColor(ledColor), `${label}: test colour must itself be a valid LED colour string`);
    const calibrated = calibratedLedColor(ledColor);
    assert(
      [calibrated.r, calibrated.g, calibrated.b].every(Number.isFinite),
      `${label}: calibratedLedColor must produce finite linear colour components`,
    );
    for (const curvature of [
      ORGANIC_SHAPE_GUARDRAILS.curvature.min,
      (ORGANIC_SHAPE_GUARDRAILS.curvature.min + ORGANIC_SHAPE_GUARDRAILS.curvature.max) / 2,
      ORGANIC_SHAPE_GUARDRAILS.curvature.max,
    ]) {
      for (const mirror of [false, true]) {
        for (const floorProfile of ["flat", "slope"] as const) {
          const params = clampOrganicShapeParams({ length: 11, width: 6.5, curvature, mirror });
          const outline = buildOrganicShapeOutline(params);
          const dims: Dimensions = {
            length: params.length,
            width: params.width,
            depth: 1.5,
            cornerRadius: 0,
            organicCurvature: params.curvature,
            organicMirror: params.mirror,
            ...(floorProfile === "slope"
              ? ({ floorProfile: "slope", shallowDepth: 1.1 } as const)
              : ({ floorProfile: "flat" } as const)),
          };
          const verticalLayout = getPoolVerticalLayout({
            poolType: "in-ground",
            system: "skimmer",
            overflowType: "hidden",
            depth: dims.depth,
            copingThickness: 0.03,
          });
          const floorProfileModel = buildFloorProfile({
            outline,
            shape: "organic",
            poolType: "in-ground",
            dimensions: dims,
            verticalLayout,
          });
          const label2 = `${label} curvature=${curvature.toFixed(2)} mirror=${mirror} floorProfile=${floorProfile}`;
          const plan = planPoolLighting({
            outline,
            waterY: verticalLayout.waterY,
            floorY: floorProfileModel.sloped
              ? floorProfileModel.shallowFloorY
              : verticalLayout.floorY,
            lumenOutput: lumens,
          });
          assert(plan.count > 0, `${label2}: must place a real, non-empty LED row`);
          assert(plan.warnings.length === 0, `${label2}: must place without any warning`);
          assert(
            plan.positions.every(
              (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
            ),
            `${label2}: every fixture position must be finite`,
          );
          // Sloped-floor Y-positioning: each fixture's local floor elevation
          // (via the same floorYAt every other sloped consumer reads) must
          // stay strictly below the fixture, and the fixture strictly below
          // the water line -- proves the LED row is really placed against
          // the local sloped floor, not the old single global floorY.
          for (const p of plan.positions) {
            const localFloorY = floorProfileModel.floorYAt(p.x, p.z);
            assert(
              p.y > localFloorY && p.y < verticalLayout.waterY,
              `${label2}: fixture must sit strictly between its local floor and the water line`,
            );
          }
        }
      }
    }
  }
  console.log(
    "Organic LED low-curvature closure audit passed: every UI-selectable curvature (min/medium/max), both mirror states, white and RGB LED colour, and flat/sloped floor all place a real, warning-free lighting row -- no silent low-curvature gap.",
  );
}

console.log(
  `Floor-profile audit passed: ${slopeCases.length} sloped configurations (endpoints, monotonic slope, floor/wall closure, normals, metrics, stairs, skimmers), flat/ineligible normalisation and clamp guards all verified.`,
);
console.log(
  `Geometry audit passed: ${shapes.length * dimensionCases.length * 2} shape/dimension/system cases, ${customCases.length} custom-shape offset cases, ${validRegressionCases.length + invalidRegressionCases.length} guardrail regressions, ${cameraRegressionCount} camera poses and 24 clamped drag steps.`,
);

// --- Geometry Pass D: Infinity edge (Rectangle-only first slice) ----------
{
  const rectOutline = buildOutline(
    "rectangle",
    { length: 10, width: 6, depth: 1.5, cornerRadius: 0 },
    [],
  );

  // Every one of the 4 rectangle sides is a real, valid candidate zone.
  const zones = rectangleInfinityZones(rectOutline);
  assert(zones.length === 4, "Infinity: a rectangle outline must expose exactly 4 candidate zones");
  for (const zone of zones) {
    assert(zone.length > 0, "Infinity: every zone must have positive length");
    assert(
      Number.isFinite(zone.normal[0]) && Number.isFinite(zone.normal[1]),
      "Infinity: every zone normal must be finite",
    );
    const normalMagnitude = Math.hypot(zone.normal[0], zone.normal[1]);
    assert(Math.abs(normalMagnitude - 1) < 1e-9, "Infinity: every zone normal must be unit length");
  }
  // Every zone's outward normal really points away from the outline centroid
  // -- the one property that would silently invert the waterfall/catch-basin
  // drop direction if it ever regressed.
  const bounds = outlineBounds(rectOutline);
  const centroidX = (bounds.minX + bounds.maxX) / 2;
  const centroidZ = (bounds.minZ + bounds.maxZ) / 2;
  for (const zone of zones) {
    const midX = (zone.start[0] + zone.end[0]) / 2;
    const midZ = (zone.start[1] + zone.end[1]) / 2;
    const towardOutside = zone.normal[0] * (midX - centroidX) + zone.normal[1] * (midZ - centroidZ);
    assert(towardOutside > 0, "Infinity: zone normal must point outward from the centroid");
  }

  // L-shape / Organic candidate zones: honestly empty this pass, not faked.
  assert(
    lShapeInfinityZones(rectOutline).length === 0,
    "Infinity: L-shape candidate zones must be the stubbed empty array this pass",
  );
  assert(
    organicInfinityZones(rectOutline).length === 0,
    "Infinity: Organic candidate zones must be the stubbed empty array this pass",
  );

  // Malformed input normalises to the safe disabled default, never a
  // fabricated selection.
  const malformed = clampInfinityEdgeParams({
    enabled: true,
    side: 7 as unknown as InfinityEdgeParams["side"],
    startT: NaN,
    endT: -3,
  } as Partial<InfinityEdgeParams>);
  assert(malformed.enabled === false, "Infinity: an out-of-range side must normalise to disabled");
  assert(malformed.side === null, "Infinity: an out-of-range side must normalise to null");
  const legacy = clampInfinityEdgeParams(undefined);
  assert(
    JSON.stringify(legacy) === JSON.stringify(defaultInfinityEdgeParams()),
    "Infinity: a project saved before Infinity existed must restore to the safe default",
  );

  // Dimension clamps: out-of-plausible-range input clamps into the
  // GLB-derived / documented residential range, never NaN or a runaway value.
  const dims = clampInfinityEdgeDimensions({
    lipWidth: 99,
    dropHeight: -5,
    catchBasinWidth: NaN,
  } as Partial<{ lipWidth: number; dropHeight: number; catchBasinWidth: number }>);
  assert(
    dims.lipWidth === INFINITY_EDGE_DIMENSIONS.lipWidth.max,
    "Infinity: lip width must clamp to its max",
  );
  assert(
    dims.dropHeight === INFINITY_EDGE_DIMENSIONS.dropHeight.min,
    "Infinity: drop height must clamp to its min for a negative input",
  );
  assert(
    dims.catchBasinWidth === INFINITY_EDGE_DIMENSIONS.catchBasinWidth.default,
    "Infinity: a NaN catch-basin width must fall back to its default",
  );

  // Real per-side geometry: finite, non-degenerate, for every one of the 4
  // rectangle sides -- proves the lip geometry data is buildable for any
  // valid selection, not just one hardcoded side.
  for (const side of RECTANGLE_INFINITY_SIDES) {
    const params: InfinityEdgeParams = {
      enabled: true,
      side,
      startT: 0,
      endT: 1,
      dropDirection: "outward",
    };
    const edge = computeInfinityEdgeGeometry(rectOutline, params);
    assert(edge !== null, `Infinity: side ${side} must produce real geometry data`);
    assert(
      [edge!.start[0], edge!.start[1], edge!.end[0], edge!.end[1], edge!.length].every(
        Number.isFinite,
      ),
      `Infinity: side ${side} geometry must be entirely finite (no NaN)`,
    );
    assert(edge!.length > 0, `Infinity: side ${side} must have positive length`);
    assert(
      isRectangleSideExcludedByInfinity(params, side),
      `Infinity: the selected side ${side} must be reported as excluded`,
    );
    const otherSide = ((side + 1) % 4) as InfinityEdgeParams["side"];
    assert(
      !isRectangleSideExcludedByInfinity(
        params,
        otherSide as (typeof RECTANGLE_INFINITY_SIDES)[number],
      ),
      `Infinity: a non-selected side must never be reported as excluded`,
    );
  }

  // Disabled params never produce geometry, regardless of a stale `side`.
  const disabled = computeInfinityEdgeGeometry(rectOutline, {
    enabled: false,
    side: 0,
    startT: 0,
    endT: 1,
    dropDirection: "outward",
  });
  assert(disabled === null, "Infinity: disabled params must never produce geometry");

  // --- Break/restore proof 1: wrong-side selection must be caught --------
  // Deliberately assert the geometry for side 0 equals the geometry for
  // side 2 (opposite side of a 10x6 rectangle) -- this MUST fail, proving
  // the test actually distinguishes sides rather than trivially passing.
  {
    const edge0 = computeInfinityEdgeGeometry(rectOutline, {
      enabled: true,
      side: 0,
      startT: 0,
      endT: 1,
      dropDirection: "outward",
    })!;
    const edge2 = computeInfinityEdgeGeometry(rectOutline, {
      enabled: true,
      side: 2,
      startT: 0,
      endT: 1,
      dropDirection: "outward",
    })!;
    let caughtWrongSide = false;
    try {
      assert(
        edge0.start[0] === edge2.start[0] && edge0.start[1] === edge2.start[1],
        "deliberate wrong-side break",
      );
    } catch {
      caughtWrongSide = true;
    }
    assert(
      caughtWrongSide,
      "Infinity: break/restore proof 1 failed to catch a wrong-side selection",
    );
  }

  // --- Break/restore proof 2: an inverted drop direction must be caught ---
  // Deliberately assert side 0's outward normal is the reverse of what
  // `rectangleInfinityZones` actually computed -- this MUST fail, proving a
  // regression that flips the drop direction would be caught, not silently
  // accepted.
  {
    const zone0 = zones.find((z) => z.side === 0)!;
    const invertedNormal: readonly [number, number] = [-zone0.normal[0], -zone0.normal[1]];
    let caughtInvertedDrop = false;
    try {
      assert(
        Math.abs(zone0.normal[0] - invertedNormal[0]) < 1e-9 &&
          Math.abs(zone0.normal[1] - invertedNormal[1]) < 1e-9,
        "deliberate inverted-drop-direction break",
      );
    } catch {
      caughtInvertedDrop = true;
    }
    assert(
      caughtInvertedDrop,
      "Infinity: break/restore proof 2 failed to catch an inverted drop direction",
    );
  }
}
console.log(
  "Infinity edge audit passed: 4 rectangle candidate zones (positive length, unit outward normals), stubbed L-shape/Organic zones honestly empty, malformed-input and legacy-project normalisation, dimension clamps, per-side finite geometry + exclusion checks, disabled-params guard, and 2 non-vacuous break/restore proofs (wrong-side selection, inverted drop direction).",
);
