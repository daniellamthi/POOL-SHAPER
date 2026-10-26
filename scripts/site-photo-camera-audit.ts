import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import {
  calibrateSitePhoto,
  CalibrationError,
  referenceCorners,
  type PhotoCalibration,
  type PhotoPoint,
} from "../src/lib/pool/site-photo-camera";
let cases = 0;
function fixture(
  w: number,
  h: number,
  length: number,
  width: number,
  fov: number,
  x: number,
  y: number,
  z: number,
) {
  const camera = new PerspectiveCamera(fov, w / h, 0.01, 2000);
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const points = referenceCorners(length, width).map(([px, pz]) => {
    const p = new Vector3(px, 0, pz).project(camera);
    return [((p.x + 1) * w) / 2, ((1 - p.y) * h) / 2] as PhotoPoint;
  }) as unknown as PhotoCalibration["points"];
  return {
    input: {
      imageWidth: w,
      imageHeight: h,
      referenceLength: length,
      referenceWidth: width,
      points,
    },
    camera,
  };
}
for (const [w, h] of [
  [1600, 1000],
  [1000, 1600],
  [1200, 1200],
])
  for (const fov of [28, 45, 72])
    for (const x of [0, 6, 12])
      for (const y of [3, 8, 15]) {
        const { input, camera } = fixture(w!, h!, 8, 4, fov, x, y, 20);
        if (input.points.some(([px, py]) => px < 0 || px > w! || py < 0 || py > h!)) continue;
        const twiceArea = input.points.reduce((sum, a, i) => {
          const b = input.points[(i + 1) % 4]!;
          return sum + a[0] * b[1] - b[0] * a[1];
        }, 0);
        if (twiceArea < w! * h! * 0.01) {
          assert.throws(() => calibrateSitePhoto(input), CalibrationError);
          continue;
        }
        const result = calibrateSitePhoto(input);
        assert(result.maxErrorPixels < 1e-6);
        assert(Math.abs(result.verticalFov - fov) < 1e-6);
        assert(new Vector3(...result.position).distanceTo(camera.position) < 1e-6);
        // Verify objects above AND below the calibration plane: cannot pass by warping a flat image.
        const recovered = new PerspectiveCamera(result.verticalFov, result.aspect, 0.01, 2000);
        recovered.position.fromArray(result.position);
        recovered.quaternion.fromArray(result.quaternion);
        recovered.updateMatrixWorld(true);
        for (const p of [new Vector3(-2, -1.5, 1), new Vector3(2, 1.2, -1), new Vector3(0, 0.1, 0)])
          assert(p.clone().project(camera).distanceTo(p.clone().project(recovered)) < 1e-8);
        cases++;
      }
const base = fixture(1600, 1000, 8, 4, 45, 6, 8, 16).input;
const noisy = {
  ...base,
  points: base.points.map(([x, y], i) => [
    x + (i % 2 ? 1 : -1),
    y + (i < 2 ? 1 : -1),
  ]) as unknown as PhotoCalibration["points"],
};
assert(calibrateSitePhoto(noisy).maxErrorPixels < 4);
const overhead = fixture(1200, 1200, 8, 4, 45, 0, 20, 0).input;
assert.throws(() => calibrateSitePhoto(overhead), CalibrationError);
assert(calibrateSitePhoto({ ...overhead, verticalFov: 45 }).maxErrorPixels < 1e-5);
for (const invalid of [
  { ...base, referenceLength: 0 },
  { ...base, imageWidth: NaN },
  { ...base, points: [base.points[0], base.points[2], base.points[1], base.points[3]] },
  { ...base, points: [base.points[0], base.points[0], base.points[2], base.points[3]] },
  { ...base, points: [...base.points].reverse() },
  { ...base, verticalFov: NaN },
  { ...base, verticalFov: 150 },
  {
    ...base,
    points: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
])
  assert.throws(() => calibrateSitePhoto(invalid as PhotoCalibration), CalibrationError);
console.log(
  `Site photo calibration PASS: ${cases} camera poses, landscape/portrait/square, 3D depth, click noise, overhead fallback and invalid inputs.`,
);

const calibrated = calibrateSitePhoto(base);
const resized = calibrateSitePhoto({
  ...base,
  imageWidth: 800,
  imageHeight: 500,
  points: base.points.map(([x, y]) => [x / 2, y / 2]) as unknown as PhotoCalibration["points"],
});
assert(
  new Vector3(...calibrated.position).distanceTo(new Vector3(...resized.position)) < 1e-8,
  "Responsive sizing preserves world scale",
);
const doubled = calibrateSitePhoto({
  ...base,
  referenceLength: base.referenceLength * 2,
  referenceWidth: base.referenceWidth * 2,
});
assert(
  new Vector3(...doubled.position).distanceTo(
    new Vector3(...calibrated.position).multiplyScalar(2),
  ) < 1e-8,
  "Measured metres determine world scale",
);
const rolled = fixture(1600, 1000, 8, 4, 50, -6, 8, 18);
rolled.camera.lookAt(1, 0, -1);
rolled.camera.rotateZ(0.12);
rolled.camera.updateMatrixWorld(true);
const rolledPoints = referenceCorners(8, 4).map(([x, z]) => {
  const p = new Vector3(x, 0, z).project(rolled.camera);
  return [(p.x + 1) * 800, (1 - p.y) * 500] as PhotoPoint;
}) as unknown as PhotoCalibration["points"];
const rolledResult = calibrateSitePhoto({ ...rolled.input, points: rolledPoints });
assert(
  new Vector3(...rolledResult.position).distanceTo(rolled.camera.position) < 1e-6,
  "Off-centre subject and camera roll are recovered",
);
console.log("Metric/responsive/rolled-camera calibration PASS.");
