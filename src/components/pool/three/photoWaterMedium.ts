import { ShaderMaterial, Vector2, Vector3 } from "three";
import type { WebGLPathTracer } from "three-gpu-pathtracer";
import type { Outline } from "@/lib/pool/types";

export interface PhotoWaterMedium {
  outline: Outline;
  waterY: number;
  bottomY: number;
  /** Linear absorption per metre, from the selected finish. Raster path-scale
   * heuristics are excluded: the tracer measures both view and light paths. */
  absorption: readonly [number, number, number];
}

export function preparePhotoWaterMedium(input: PhotoWaterMedium | undefined) {
  if (
    !input ||
    !Number.isFinite(input.waterY) ||
    !Number.isFinite(input.bottomY) ||
    input.bottomY >= input.waterY ||
    input.absorption.length !== 3 ||
    input.absorption.some((value) => !Number.isFinite(value) || value < 0)
  )
    return null;
  const points = input.outline.map(([x, z]) => new Vector2(x, z));
  if (points.length > 3 && points[0]!.equals(points.at(-1)!)) points.pop();
  if (
    points.length < 3 ||
    points.length > 256 ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    return null;
  const area = points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length]!;
    return sum + p.x * next.y - p.y * next.x;
  }, 0);
  if (Math.abs(area) < 1e-8) return null;
  return {
    points,
    winding: Math.sign(area),
    absorption: new Vector3(...input.absorption),
    min: new Vector3(
      Math.min(...points.map((p) => p.x)),
      input.bottomY,
      Math.min(...points.map((p) => p.y)),
    ),
    max: new Vector3(
      Math.max(...points.map((p) => p.x)),
      input.waterY,
      Math.max(...points.map((p) => p.y)),
    ),
  };
}

/** Exact line integral inside an extruded simple polygon, clipped vertically.
 * Oriented edge crossings add signed remaining lengths, without sorting or
 * allocating a per-ray intersection array. Half weights balance shared vertices.
 * Scalar form is also executed verbatim by the focused geometric test. */
export const PHOTO_WATER_LENGTH_GLSL = `
float poolPhotoWaterLength(vec3 origin, vec3 direction, float rayDist) {
  float lo = 0.0, hi = min(rayDist, 1e20);
  for (int axis = 0; axis < 3; axis++) {
    float lower = axis == 0 ? poolPhotoWaterMin.x : axis == 1 ? poolPhotoWaterMin.y : poolPhotoWaterMin.z;
    float upper = axis == 0 ? poolPhotoWaterMax.x : axis == 1 ? poolPhotoWaterMax.y : poolPhotoWaterMax.z;
    float o = origin[axis], d = direction[axis];
    if (abs(d) < 1e-10) {
      if (o < lower || o > upper) return 0.0;
    } else {
      float a = (lower - o) / d, b = (upper - o) / d;
      lo = max(lo, min(a, b)); hi = min(hi, max(a, b));
    }
  }
  if (hi <= lo) return 0.0;
  float startT = lo + min((hi - lo) * 0.5, 1e-6);
  float sx = origin.x + direction.x * startT, sz = origin.z + direction.z * startT;
  bool inside = false;
  for (int i = 0; i < POOL_PHOTO_WATER_POINTS; i++) {
    int j = (i + 1) % POOL_PHOTO_WATER_POINTS;
    float ax = poolPhotoWaterPoints[i].x, az = poolPhotoWaterPoints[i].y;
    float bx = poolPhotoWaterPoints[j].x, bz = poolPhotoWaterPoints[j].y;
    if ((az > sz) != (bz > sz) && sx < (bx - ax) * (sz - az) / (bz - az) + ax) inside = !inside;
  }
  float total = inside ? hi - lo : 0.0;
  for (int i = 0; i < POOL_PHOTO_WATER_POINTS; i++) {
    int j = (i + 1) % POOL_PHOTO_WATER_POINTS;
    float ax = poolPhotoWaterPoints[i].x, az = poolPhotoWaterPoints[i].y;
    float ex = poolPhotoWaterPoints[j].x - ax, ez = poolPhotoWaterPoints[j].y - az;
    float denominator = direction.x * ez - direction.z * ex;
    if (abs(denominator) < 1e-10) continue;
    float t = ((ax - origin.x) * ez - (az - origin.z) * ex) / denominator;
    float u = ((ax - origin.x) * direction.z - (az - origin.z) * direction.x) / denominator;
    if (t > startT && t < hi && u >= -1e-7 && u <= 1.0000001) {
      float weight = (abs(u) < 1e-7 || abs(u - 1.0) < 1e-7) ? 0.5 : 1.0;
      total += weight * sign(-denominator) * poolPhotoWaterWinding * (hi - t);
    }
  }
  return clamp(total, 0.0, hi - lo);
}`;

type Prepared = NonNullable<ReturnType<typeof preparePhotoWaterMedium>>;

/** Adapt only the owned tracer shader. The water interface remains refractive;
 * this supplies the missing medium on view/bounce AND direct-light paths.
 * No scene mutation, added sampler, global ShaderChunk or raster change. */
export function installPhotoWaterMedium(tracer: WebGLPathTracer, medium: Prepared) {
  const material = (tracer as unknown as { _pathTracer?: { material?: ShaderMaterial } })
    ._pathTracer?.material;
  const surface = "// early out if this is a matte material";
  const shadow = "// reset the bounce index";
  if (
    !material?.isShaderMaterial ||
    material.fragmentShader.split(surface).length !== 2 ||
    material.fragmentShader.split(shadow).length !== 2
  )
    throw new Error("Unsupported Photo Mode water medium shader");
  const original = material.fragmentShader;
  const uniforms = {
    poolPhotoWaterPoints: { value: medium.points },
    poolPhotoWaterMin: { value: medium.min },
    poolPhotoWaterMax: { value: medium.max },
    poolPhotoWaterWinding: { value: medium.winding },
    poolPhotoWaterAbsorption: { value: medium.absorption },
  };
  const previous = Object.fromEntries(
    Object.keys(uniforms).map((key) => [key, material.uniforms[key]]),
  );
  Object.assign(material.uniforms, uniforms);
  material.fragmentShader =
    `
#define POOL_PHOTO_WATER_POINTS ${medium.points.length}
uniform vec2 poolPhotoWaterPoints[POOL_PHOTO_WATER_POINTS];
uniform vec3 poolPhotoWaterMin, poolPhotoWaterMax, poolPhotoWaterAbsorption;
uniform float poolPhotoWaterWinding;
${PHOTO_WATER_LENGTH_GLSL}
` +
    original
      .replace(
        surface,
        `state.throughputColor *= exp(-poolPhotoWaterAbsorption * poolPhotoWaterLength( ray.origin, ray.direction, surfaceHit.dist ));\n${surface}`,
      )
      .replace(
        shadow,
        `color *= exp(-poolPhotoWaterAbsorption * poolPhotoWaterLength( startPoint, ray.direction, rayDist ));\n${shadow}`,
      );
  material.needsUpdate = true;
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    material.fragmentShader = original;
    for (const key of Object.keys(uniforms)) {
      if (previous[key]) material.uniforms[key] = previous[key];
      else delete material.uniforms[key];
    }
    material.needsUpdate = true;
  };
}
