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
  OVERFLOW_GEOMETRY,
  SQM_PER_SKIMMER,
  STEPS,
} from "../src/lib/pool/config";
import { planSkimmers } from "../src/lib/pool/engineering";
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
  outlineBounds,
  validatePoolShape,
} from "../src/lib/pool/geometry";
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
  createInteriorWallGeometry,
  createRingGeometry,
  createSurfaceGeometry,
  createWallGeometry,
} from "../src/components/pool/three/poolGeometry";

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

const shapes: ReadonlyArray<PoolShapeId> = ["rectangle", "custom"];
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
  const visibleGrate = createRingGeometry(overflowWaterEdge, visibleOverflowEdge, true);
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
  assert(
    hiddenWaterBounds.spanX > visibleWaterBounds.spanX &&
      hiddenWaterBounds.spanZ > visibleWaterBounds.spanZ &&
      visibleWaterBounds.spanX > innerBounds.spanX &&
      visibleWaterBounds.spanZ > innerBounds.spanZ,
    `${testCase.name}: overflow water footprints do not reach their thresholds`,
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
        // Interior Finish deliberately targets the wall itself for a close
        // material read, while the master shot frames the whole pool from
        // outside -- so the two targets differ along the wall's inward axis
        // by design (see getInteriorFinishCamera). What must not drift is
        // the sideways (tangent) position: Interior Finish is only valid on
        // the very same wall segment the master shot already committed to.
        const tangentX = Math.cos(referenceSkimmer.rotation);
        const tangentZ = -Math.sin(referenceSkimmer.rotation);
        const tangentDrift =
          (pose.target[0] - frontMasterPose.target[0]) * tangentX +
          (pose.target[2] - frontMasterPose.target[2]) * tangentZ;
        assert(
          Math.abs(tangentDrift) < 1e-9,
          `${testCase.name}/${poolType}: Interior Finish drifted to a different wall segment`,
        );
        const viewX = pose.position[0] - pose.target[0];
        const viewZ = pose.position[2] - pose.target[2];
        const horizontalLength = Math.hypot(viewX, viewZ);
        const expectedInwardX = Math.sin(referenceSkimmer.rotation);
        const expectedInwardZ = Math.cos(referenceSkimmer.rotation);
        assert(
          Math.abs(viewX / horizontalLength - expectedInwardX) < 1e-10 &&
            Math.abs(viewZ / horizontalLength - expectedInwardZ) < 1e-10,
          `${testCase.name}/${poolType}: Interior Finish camera is not frontal`,
        );
      }
      if (intent === "mosaic") {
        assert(interiorWidePose, `${testCase.name}/${poolType}: missing Liner wide pose`);
        // Mosaic keeps a tighter material-swatch framing than Liner's more
        // pulled-back architectural read (the isLiner branch in
        // getInteriorFinishCamera), so distance and height differ by
        // design. The invariant that must hold is that both shots point at
        // the exact same wall point along the exact same viewing axis.
        assert(
          pose.target.every(
            (value, index) => Math.abs(value - interiorWidePose.target[index]!) < 1e-10,
          ),
          `${testCase.name}/${poolType}: Mosaic camera targets a different wall than PVC/Liner`,
        );
        const mosaicView = [pose.position[0] - pose.target[0], pose.position[2] - pose.target[2]];
        const linerView = [
          interiorWidePose.position[0] - interiorWidePose.target[0],
          interiorWidePose.position[2] - interiorWidePose.target[2],
        ];
        const mosaicLength = Math.hypot(mosaicView[0], mosaicView[1]);
        const linerLength = Math.hypot(linerView[0], linerView[1]);
        assert(
          mosaicLength > 1e-9 && linerLength > 1e-9,
          `${testCase.name}/${poolType}: Mosaic/Liner camera collapsed onto its target`,
        );
        assert(
          Math.abs(mosaicView[0] / mosaicLength - linerView[0] / linerLength) < 1e-9 &&
            Math.abs(mosaicView[1] / mosaicLength - linerView[1] / linerLength) < 1e-9,
          `${testCase.name}/${poolType}: Mosaic camera left the PVC/Liner viewing axis`,
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
    "project,pool-type,structure,shape-dimensions,system,finish,features,equipment,contact,review",
  "workflow order does not match the approved ten-step flow",
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
assert(POOL_SHAPES.map(({ id }) => id).join(",") === "rectangle,custom", "invalid pool shapes");
assert(FINISHES.map(({ id }) => id).join(",") === "liner,mosaic", "invalid finishes");
assert(
  OVERFLOW_GEOMETRY.waterEdgeOffset < OVERFLOW_GEOMETRY.hiddenChannelOffset &&
    OVERFLOW_GEOMETRY.hiddenChannelOffset < OVERFLOW_GEOMETRY.visibleChannelOuterOffset &&
    OVERFLOW_GEOMETRY.visibleChannelOuterOffset < COPING_WIDTH,
  "invalid overflow geometry hierarchy",
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

console.log(
  `Geometry audit passed: ${shapes.length * dimensionCases.length * 2} shape/dimension/system cases, ${customCases.length} custom-shape offset cases, ${validRegressionCases.length + invalidRegressionCases.length} guardrail regressions, ${cameraRegressionCount} camera poses and 24 clamped drag steps.`,
);
