import {
  ACCESSORIES,
  DEFAULT_CONTROL_POINTS,
  DIMENSION_LIMITS,
  FINISHES,
  LINER_COLORS,
  POOL_SHAPES,
  PROJECT_TYPES,
  SQM_PER_SKIMMER,
  STEPS,
} from "../src/lib/pool/config";
import { planSkimmers } from "../src/lib/pool/engineering";
import {
  buildOutline,
  computeMetrics,
  constrainControlPoint,
  isValidControlPolygon,
  outlineBounds,
} from "../src/lib/pool/geometry";
import type { Dimensions, PoolShapeId } from "../src/lib/pool/types";
import { resolveMaterials } from "../src/lib/pool/materials";
import { getCustomerValidation } from "../src/lib/pool/validation";
import {
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
    const surfacePositions = surface.getAttribute("position");
    const wallPositions = walls.getAttribute("position");
    assert(surfacePositions.count >= 3, `${shape}: empty triangulated surface`);
    assert(wallPositions.count === outline.length * 6, `${shape}: incomplete wall geometry`);
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
    }
  }
}

assert(isValidControlPolygon(DEFAULT_CONTROL_POINTS), "default custom polygon must be valid");
const crossingAttempt = constrainControlPoint(DEFAULT_CONTROL_POINTS, 0, [0.5, 0.5]);
const constrained = DEFAULT_CONTROL_POINTS.map((point, index) =>
  index === 0 ? crossingAttempt : point,
);
assert(isValidControlPolygon(constrained), "custom point constraint produced an invalid polygon");

assert(
  STEPS.map(({ id }) => id).join(",") ===
    "project,shape,dimensions,system,finish,color,accessories,contact,review",
  "workflow order does not match the approved nine-step flow",
);
assert(PROJECT_TYPES.map(({ id }) => id).join(",") === "new,renovation", "invalid project types");
assert(POOL_SHAPES.map(({ id }) => id).join(",") === "rectangle,custom", "invalid pool shapes");
assert(FINISHES.map(({ id }) => id).join(",") === "liner,mosaic", "invalid finishes");
assert(
  ACCESSORIES.map(({ id }) => id).join(",") ===
    "automaticCover,heatPump,saltElectrolysis,automaticDosing,ledLighting,perimeterLed,waterfall,hydromassage,counterCurrent,poolRobot,smartControl,solarShower",
  "invalid quotation accessories",
);

for (const finish of FINISHES) {
  for (const color of LINER_COLORS) {
    const materials = resolveMaterials({ finish: finish.id, linerColor: color.id });
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
  `Geometry audit passed: ${shapes.length * dimensionCases.length * 2} shape/dimension/system cases.`,
);
