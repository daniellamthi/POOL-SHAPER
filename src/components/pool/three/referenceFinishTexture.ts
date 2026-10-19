import * as THREE from "three";
import { referenceFinish, referenceSampleMatrix, type ReferenceFinishId } from "@/lib/pool/reference-finishes";
import type { StoneMaps } from "./stoneTextures";

/** Kept in sync with the shader. Four translated, overlapping source windows
 * make a continuous field without mirroring/rotating the original pattern.
 * No colour tint, invented height, contrast correction or generated pixels. */
export const REFERENCE_PATCH_HALF_SPAN = 0.24;
export const REFERENCE_PATCH_JITTER = 0.44;
export const REFERENCE_SAMPLER_REVISION = "mineral-grain-v2";

type ReferenceImage = {
  source: THREE.Texture;
  consumers: Set<THREE.Texture>;
  readyListeners: Set<() => void>;
  ready: boolean;
};
const loadedImages = new Map<string, ReferenceImage>();
const loader = new THREE.TextureLoader();

/** Image requests are shared across coping and paving and retained for the
 * finite eight-reference catalogue. Each consumer owns/disposes its clones.
 * Shared original JPEGs keep provenance and avoid re-decoding on reselection. */
function referenceImage(id: ReferenceFinishId): ReferenceImage {
  const finish = referenceFinish(id)!;
  let entry = loadedImages.get(finish.asset.url);
  if (!entry) {
    const consumers = new Set<THREE.Texture>();
    const readyListeners = new Set<() => void>();
    const next = { consumers, readyListeners, ready: false } as ReferenceImage;
    const source = loader.load(finish.asset.url, () => {
      // Loader resolves after the first render. Clones share Source data but
      // must explicitly invalidate their own texture version for GPU upload.
      next.ready = true;
      for (const consumer of consumers) consumer.needsUpdate = true;
      const listeners = [...readyListeners];
      for (const notify of listeners) if (readyListeners.delete(notify)) notify();
    });
    source.colorSpace = THREE.SRGBColorSpace;
    source.wrapS = source.wrapT = THREE.ClampToEdgeWrapping;
    source.minFilter = THREE.LinearMipmapLinearFilter;
    source.magFilter = THREE.LinearFilter;
    next.source = source;
    entry = next;
    loadedImages.set(finish.asset.url, entry);
  }
  return entry;
}

/** One shared loading state for coping and paving. A cached ready image calls
 * back immediately; a pending image notifies once and supports cancellation.
 * This deliberately does not throw a Promise into the ground's Suspense
 * boundary, so changing a finish can never remove the floor/terrain mesh. */
export function subscribeReferenceFinishReady(id: ReferenceFinishId, onReady: () => void): () => void {
  const entry = referenceImage(id);
  if (entry.ready) {
    onReady();
    return () => {};
  }
  entry.readyListeners.add(onReady);
  return () => { entry.readyListeners.delete(onReady); };
}

export function cloneReferenceFinishColorMap(id: ReferenceFinishId): THREE.Texture {
  const entry = referenceImage(id);
  // Texture.clone() itself marks the copy dirty, even while its image is
  // pending. Share the decoded Source without scheduling an empty GPU upload.
  const colorMap = new THREE.Texture();
  colorMap.source = entry.source.source;
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = colorMap.wrapT = THREE.ClampToEdgeWrapping;
  colorMap.minFilter = THREE.LinearMipmapLinearFilter;
  colorMap.magFilter = THREE.LinearFilter;
  entry.consumers.add(colorMap);
  colorMap.addEventListener("dispose", () => entry.consumers.delete(colorMap));
  if (entry.ready) colorMap.needsUpdate = true;
  return colorMap;
}

export function loadReferenceFinishMaps(id: ReferenceFinishId): StoneMaps {
  const colorMap = cloneReferenceFinishColorMap(id);
  const normalMap = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.needsUpdate = true;
  return { colorMap, normalMap, roughnessMap: null };
}

export function configureReferenceTexture(texture: THREE.Texture, maxAnisotropy: number) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  texture.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  if (texture.image) texture.needsUpdate = true;
}

const SAMPLER = `
uniform mat3 referenceSourceProjection;
REFERENCE_VARIANT_UNIFORMS
uniform vec2 referenceMetricSize;
uniform vec2 referencePatchBlend;
uniform float referenceExposure;
vec2 referenceHash(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}
vec2 referenceProject(vec2 p, float variant) {
  mat3 projection = referenceSourceProjection;
  REFERENCE_SELECT_VARIANT
  vec3 q = projection * vec3(clamp(p, vec2(0.015), vec2(0.985)), 1.0);
  return q.xy / q.z;
}
vec3 referencePatch(sampler2D sourceMap, vec2 anchor, vec2 p, float variant) {
  vec2 samplePoint = vec2(0.5) + (p - anchor) * 0.24 + (referenceHash(anchor) - vec2(0.5)) * 0.44;
  REFERENCE_DIRECTION
  return texture2D(sourceMap, referenceProject(samplePoint, variant)).rgb;
}
vec3 referenceColour(sampler2D sourceMap, vec2 metric, float variant) {
  // The 0.24 physical period compensates the source-window span, so the
  // original grain does not stretch when pool or paving module sizes change.
  vec2 p = metric / (referenceMetricSize * 0.24);
  vec2 cell = floor(p);
  // Mineral interiors keep original fine grain instead of averaging four
  // unrelated veins everywhere. C1 transitions still join translated source
  // windows continuously, without tint, mirroring or extra texture fetches.
  vec2 weight = smoothstep(vec2(referencePatchBlend.x), vec2(referencePatchBlend.y), fract(p));
  vec3 a = referencePatch(sourceMap, cell, p, variant);
  vec3 b = referencePatch(sourceMap, cell + vec2(1.0, 0.0), p, variant);
  vec3 c = referencePatch(sourceMap, cell + vec2(0.0, 1.0), p, variant);
  vec3 d = referencePatch(sourceMap, cell + vec2(1.0), p, variant);
  return mix(mix(a, b, weight.x), mix(c, d, weight.x), weight.y) * referenceExposure;
}
`;

function installSampler(shader: THREE.WebGLProgramParametersWithUniforms, id: ReferenceFinishId) {
  const finish = referenceFinish(id)!;
  shader.uniforms["referenceSourceProjection"] = { value: new THREE.Matrix3().fromArray(referenceSampleMatrix(finish.sample, finish.imageSize)) };
  const variants = "additionalSamples" in finish ? finish.additionalSamples : [];
  variants.forEach((sample, index) => {
    shader.uniforms[`referenceSourceProjection${index + 1}`] = { value: new THREE.Matrix3().fromArray(referenceSampleMatrix(sample, finish.imageSize)) };
  });
  shader.uniforms["referenceMetricSize"] = { value: new THREE.Vector2(...finish.textureSize) };
  // Preserve the approved homogeneous wood response unchanged. For stone,
  // narrow the overlap only; metric derivatives and source crops stay exact.
  shader.uniforms["referencePatchBlend"] = { value: new THREE.Vector2(finish.boards ? 0 : 0.25, finish.boards ? 1 : 0.75) };
  // A perspective product photograph is already illuminated. This neutral
  // linear-light calibration avoids illuminating that baked exposure twice;
  // it never changes hue/saturation or any other pool material or scene light.
  shader.uniforms["referenceExposure"] = { value: "photographicExposure" in finish ? finish.photographicExposure : 1 };
  shader.fragmentShader = SAMPLER
    .replace("REFERENCE_VARIANT_UNIFORMS", variants.map((_, index) => `uniform mat3 referenceSourceProjection${index + 1};`).join("\n"))
    .replace("REFERENCE_SELECT_VARIANT", variants.map((_, index) => `if (variant > ${index + 0.5}) projection = referenceSourceProjection${index + 1};`).join("\n"))
    .replace("REFERENCE_DIRECTION", finish.boards ? "samplePoint = samplePoint.yx;" : "") + shader.fragmentShader;
}

// Existing geometry stores one neutral shade per actual slab/board. Reuse
// that stable identity; do not vary colour windows within a single board,
// add geometry attributes, tint pixels or rotate the photographed grain.
const MODULE_VARIANT = `
  float referenceVariant = 0.0;
  #ifdef USE_COLOR
    referenceVariant = floor(fract(vColor.r * 997.0) * 4.0);
  #endif
`;

/** Apply AFTER existing coping triplanar setup. Its slabFrame keeps each
 * side's grain longitudinal and gives adjacent real modules stable offsets.
 * The dominant projection avoids twelve texture fetches on every fragment;
 * the flat normal does not add fabricated relief to a colour photograph. */
export function configureReferenceCoping(shader: THREE.WebGLProgramParametersWithUniforms, id: ReferenceFinishId) {
  installSampler(shader, id);
  const existing = /vec3 stoneColor = texture2D\(stoneColorMap,[\s\S]*?stoneWeights\.z;/;
  shader.fragmentShader = shader.fragmentShader.replace(existing, `
    float referenceVariant = 0.0;
    vec3 referenceNormal = abs(normalize(vTriWorldNormal));
    vec2 referenceMetric = referenceNormal.y >= max(referenceNormal.x, referenceNormal.z)
      ? vTriWorldPosition.xz : referenceNormal.x > referenceNormal.z
      ? vTriWorldPosition.zy : vTriWorldPosition.xy;
    vec3 stoneColor = referenceColour(stoneColorMap, referenceMetric, referenceVariant);
  `);
}

/** Paving geometry already has metre-based UVs with deterministic per-module
 * offsets. Its physical joints remain geometry, never painted into the image. */
export function configureReferencePaving(shader: THREE.WebGLProgramParametersWithUniforms, id: ReferenceFinishId) {
  installSampler(shader, id);
  shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
    #ifdef USE_MAP
      ${id === "reference-ipe" ? MODULE_VARIANT : "float referenceVariant = 0.0;"}
      diffuseColor *= vec4(referenceColour(map, vMapUv, referenceVariant), 1.0);
    #endif
  `);
}

/** CPU projection for asset/crop and boundary-continuity checks. */
export function projectReferenceSample(id: ReferenceFinishId, u: number, v: number, variant = 0): readonly [number, number] {
  const finish = referenceFinish(id)!;
  const variants = "additionalSamples" in finish ? finish.additionalSamples : [];
  const matrix = referenceSampleMatrix(variant > 0 ? variants[variant - 1] ?? finish.sample : finish.sample, finish.imageSize);
  const denominator = matrix[2]! * u + matrix[5]! * v + matrix[8]!;
  return [(matrix[0]! * u + matrix[3]! * v + matrix[6]!) / denominator,
    (matrix[1]! * u + matrix[4]! * v + matrix[7]!) / denominator];
}
