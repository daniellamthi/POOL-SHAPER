import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";

export type PhotoPoint = readonly [number, number];
export interface PhotoCalibration {
  imageWidth: number;
  imageHeight: number;
  /** Four clockwise image points, in pixels, starting at the far-left corner. */
  points: readonly [PhotoPoint, PhotoPoint, PhotoPoint, PhotoPoint];
  /** Measured rectangle on level ground, metres: first edge X, next edge Z. */
  referenceLength: number;
  referenceWidth: number;
  /** Optional known vertical field of view for nearly frontal/overhead photos. */
  verticalFov?: number | undefined;
}
export interface SitePhotoCamera {
  position: readonly [number, number, number];
  quaternion: readonly [number, number, number, number];
  verticalFov: number;
  aspect: number;
  maxErrorPixels: number;
}
export type CalibrationErrorCode = "dimensions" | "points" | "perspective" | "accuracy";
export class CalibrationError extends Error {
  constructor(public code: CalibrationErrorCode) {
    super(code);
  }
}

/** Small pivoted solve; all photo coordinates are normalized by image width. */
function solve(rows: number[][]): number[] {
  const size = rows.length;
  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let row = col + 1; row < size; row++)
      if (Math.abs(rows[row]![col]!) > Math.abs(rows[pivot]![col]!)) pivot = row;
    if (Math.abs(rows[pivot]![col]!) < 1e-10) throw new CalibrationError("perspective");
    [rows[col], rows[pivot]] = [rows[pivot]!, rows[col]!];
    const scale = rows[col]![col]!;
    for (let j = col; j <= size; j++) rows[col]![j] = rows[col]![j]! / scale;
    for (let row = 0; row < size; row++)
      if (row !== col) {
        const factor = rows[row]![col]!;
        for (let j = col; j <= size; j++) rows[row]![j] = rows[row]![j]! - factor * rows[col]![j]!;
      }
  }
  return rows.map((row) => row[size]!);
}

export function referenceCorners(length: number, width: number): readonly PhotoPoint[] {
  return [
    [-length / 2, -width / 2],
    [length / 2, -width / 2],
    [length / 2, width / 2],
    [-length / 2, width / 2],
  ];
}

/** Refine the physical camera against all four clicked corners. This removes
 * the asymmetric error from orthonormalizing a noisy homography; no image warp
 * is introduced. Damped least squares keeps almost frontal cases bounded. */
function refineCamera(
  camera: PerspectiveCamera,
  input: PhotoCalibration,
  world: readonly PhotoPoint[],
): void {
  const width = input.imageWidth,
    height = input.imageHeight;
  const variables = input.verticalFov === undefined ? 7 : 6;
  const residual = (candidate: PerspectiveCamera): number[] => {
    candidate.updateProjectionMatrix();
    candidate.updateMatrixWorld(true);
    return world.flatMap(([x, z], i) => {
      const point = new Vector3(x, 0, z);
      if (point.clone().applyMatrix4(candidate.matrixWorldInverse).z >= -0.01) return [1e6, 1e6];
      point.project(candidate);
      return [
        (point.x + 1) / 2 - input.points[i]![0] / width,
        ((1 - point.y) * height) / (2 * width) - input.points[i]![1] / width,
      ];
    });
  };
  const shifted = (base: PerspectiveCamera, delta: number[]): PerspectiveCamera => {
    const candidate = base.clone();
    candidate.position.add(new Vector3(delta[0]!, delta[1]!, delta[2]!));
    const rotation = new Vector3(delta[3]!, delta[4]!, delta[5]!);
    const angle = rotation.length();
    if (angle > 0)
      candidate.quaternion
        .multiply(new Quaternion().setFromAxisAngle(rotation.divideScalar(angle), angle))
        .normalize();
    if (variables === 7) {
      const focal = (1 / Math.tan((base.fov * Math.PI) / 360)) * Math.exp(delta[6]!);
      candidate.fov = (2 * Math.atan(1 / focal) * 180) / Math.PI;
    }
    return candidate;
  };
  let damping = 0.001;
  for (let iteration = 0; iteration < 35; iteration++) {
    const base = residual(camera),
      score = base.reduce((sum, value) => sum + value * value, 0);
    if (score < 1e-20) break;
    const jacobian = Array.from({ length: variables }, (_, column) => {
      const step = column < 3 ? 1e-4 : 1e-5;
      const delta = Array(variables).fill(0);
      delta[column] = step;
      return residual(shifted(camera, delta)).map((value, row) => (value - base[row]!) / step);
    });
    const normal = Array.from({ length: variables }, (_, row) =>
      Array.from({ length: variables + 1 }, (_, column) => {
        if (column === variables)
          return -jacobian[row]!.reduce((sum, value, i) => sum + value * base[i]!, 0);
        const product = jacobian[row]!.reduce(
          (sum, value, i) => sum + value * jacobian[column]![i]!,
          0,
        );
        return row === column ? product + damping * Math.max(product, 1e-8) : product;
      }),
    );
    let delta: number[];
    try {
      delta = solve(normal);
    } catch {
      break;
    }
    const candidate = shifted(camera, delta);
    const next = residual(candidate).reduce((sum, value) => sum + value * value, 0);
    if (
      Number.isFinite(next) &&
      next < score &&
      candidate.fov >= 10 &&
      candidate.fov <= 110 &&
      candidate.position.y > 0.15
    ) {
      camera.copy(candidate);
      damping = Math.max(1e-8, damping / 3);
      if (score - next < 1e-16) break;
    } else damping *= 10;
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

/** Pinhole calibration from a measured horizontal rectangle. Assumes square
 * pixels, no lens distortion and principal point at the image centre. It solves
 * real camera pose, not an image warp: objects above/below ground retain depth. */
export function calibrateSitePhoto(input: PhotoCalibration): SitePhotoCamera {
  const {
    imageWidth: w,
    imageHeight: h,
    points,
    referenceLength: length,
    referenceWidth: width,
  } = input;
  if (
    ![w, h, length, width].every((value) => Number.isFinite(value) && value > 0) ||
    w < 100 ||
    h < 100 ||
    w > 30000 ||
    h > 30000 ||
    length < 0.5 ||
    width < 0.5 ||
    length > 100 ||
    width > 100
  )
    throw new CalibrationError("dimensions");
  if (
    points.length !== 4 ||
    points.some(
      (point) =>
        point.length !== 2 ||
        !point.every(Number.isFinite) ||
        point[0] < 0 ||
        point[0] > w ||
        point[1] < 0 ||
        point[1] > h,
    )
  )
    throw new CalibrationError("points");
  let twiceArea = 0;
  for (let i = 0; i < 4; i++) {
    const a = points[i]!,
      b = points[(i + 1) % 4]!,
      c = points[(i + 2) % 4]!;
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross <= 0 || Math.hypot(b[0] - a[0], b[1] - a[1]) < Math.min(w, h) * 0.015)
      throw new CalibrationError("points");
    twiceArea += a[0] * b[1] - b[0] * a[1];
  }
  if (twiceArea < w * h * 0.01) throw new CalibrationError("perspective");
  const world = referenceCorners(length, width);
  const equations: number[][] = [];
  world.forEach(([x, z], i) => {
    const u = (points[i]![0] - w / 2) / w,
      v = (points[i]![1] - h / 2) / w;
    equations.push([x, z, 1, 0, 0, 0, -u * x, -u * z, u], [0, 0, 0, x, z, 1, -v * x, -v * z, v]);
  });
  const H = solve(equations);
  const [a, b, c, d, e, f, g, k] = H as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  let focal: number;
  if (input.verticalFov !== undefined) {
    if (!Number.isFinite(input.verticalFov) || input.verticalFov < 10 || input.verticalFov > 110)
      throw new CalibrationError("perspective");
    focal = h / w / (2 * Math.tan((input.verticalFov * Math.PI) / 360));
  } else {
    // Almost orthographic views cannot reliably identify focal length.
    if (Math.hypot(g * length, k * width) < 0.01) throw new CalibrationError("perspective");
    // Orthogonality and equal-length constraints on the rotation columns.
    const A1 = 2 * (a * b + d * e),
      B1 = 2 * g * k;
    const A2 = a * a + d * d - b * b - e * e,
      B2 = g * g - k * k;
    const denominator = A1 * A1 + A2 * A2;
    const inverseFocalSquared = -(A1 * B1 + A2 * B2) / denominator;
    if (!Number.isFinite(inverseFocalSquared) || inverseFocalSquared <= 1e-8)
      throw new CalibrationError("perspective");
    focal = 1 / Math.sqrt(inverseFocalSquared);
  }
  const verticalFov = (2 * Math.atan(h / (2 * w * focal)) * 180) / Math.PI;
  if (verticalFov < 10 || verticalFov > 110) throw new CalibrationError("perspective");
  const xAxis = new Vector3(a / focal, d / focal, g),
    zAxis = new Vector3(b / focal, e / focal, k);
  const scale = 2 / (xAxis.length() + zAxis.length());
  xAxis.normalize();
  zAxis.addScaledVector(xAxis, -zAxis.dot(xAxis)).normalize();
  const yAxis = new Vector3().crossVectors(zAxis, xAxis).normalize();
  const translation = new Vector3(c / focal, f / focal, 1).multiplyScalar(scale);
  // Computer-vision axes (right/down/forward) -> Three.js (right/up/back).
  const worldToCamera = new Matrix4().set(
    xAxis.x,
    yAxis.x,
    zAxis.x,
    translation.x,
    -xAxis.y,
    -yAxis.y,
    -zAxis.y,
    -translation.y,
    -xAxis.z,
    -yAxis.z,
    -zAxis.z,
    -translation.z,
    0,
    0,
    0,
    1,
  );
  const cameraToWorld = worldToCamera.clone().invert();
  const position = new Vector3(),
    quaternion = new Quaternion();
  cameraToWorld.decompose(position, quaternion, new Vector3());
  if (position.y < 0.15 || position.y > 100 || position.length() > 500)
    throw new CalibrationError("perspective");
  const camera = new PerspectiveCamera(verticalFov, w / h, 0.01, 2000);
  camera.position.copy(position);
  camera.quaternion.copy(quaternion);
  camera.updateMatrixWorld(true);
  refineCamera(camera, input, world);
  if (camera.position.y > 100 || camera.position.length() > 500)
    throw new CalibrationError("perspective");
  const errors = world.map(([x, z], i) => {
    const p = new Vector3(x, 0, z);
    if (p.clone().applyMatrix4(camera.matrixWorldInverse).z >= -0.01)
      throw new CalibrationError("perspective");
    p.project(camera);
    return Math.hypot(((p.x + 1) * w) / 2 - points[i]![0], ((1 - p.y) * h) / 2 - points[i]![1]);
  });
  const maxErrorPixels = Math.max(...errors);
  if (!Number.isFinite(maxErrorPixels) || maxErrorPixels > Math.max(4, Math.hypot(w, h) * 0.004))
    throw new CalibrationError("accuracy");
  return {
    position: camera.position.toArray(),
    quaternion: camera.quaternion.toArray(),
    verticalFov: camera.fov,
    aspect: w / h,
    maxErrorPixels,
  };
}
