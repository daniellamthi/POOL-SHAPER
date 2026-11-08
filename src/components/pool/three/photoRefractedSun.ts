import { DataTexture, DirectionalLight, FloatType, LinearFilter, Matrix3, RGBAFormat, Vector3, Vector4, type Scene, type ShaderMaterial, type Texture, type Vector2, type WebGLRenderer } from "three";
import type { WebGLPathTracer } from "three-gpu-pathtracer";
import type { PhotoWaterMedium } from "./photoWaterMedium";
import { bakeRefractedSunField, createPhotoWaterNormalSampler, normaliseRefractedSunGain } from "./photoSunCausticField";

/** Freeze the actual water-normal field and world-space sun once per photo.
 * This receiver is a horizontal floor; the caller excludes sloping/indoor
 * contexts. Wall caustics and displaced/multiply scattered rays are not solved. */
export function prepareRefractedSun(scene: Scene, medium: PhotoWaterMedium, normalMap: Texture, normalScale: Vector2, ior: number, environmentSunDirection?: readonly [number, number, number]) {
  let sun: DirectionalLight | null = null;
  scene.traverseVisible(object => {
    if (object instanceof DirectionalLight && object.intensity > 0 && (!sun || object.intensity > sun.intensity)) sun = object;
  });
  const selected = sun as DirectionalLight | null;
  if (!selected && !environmentSunDirection) return null;
  const toSun = environmentSunDirection ? new Vector3(...environmentSunDirection).normalize() : selected!.getWorldPosition(new Vector3()).sub(selected!.target.getWorldPosition(new Vector3())).normalize();
  const image = normalMap.image as { width: number; height: number; data?: Uint8Array | Uint8ClampedArray; getContext?: (type: "2d") => CanvasRenderingContext2D | null } | undefined;
  if (!image?.width || !image.height) return null;
  const pixels = image.data ?? image.getContext?.("2d")?.getImageData(0, 0, image.width, image.height).data;
  if (!pixels) return null;
  const transform = normalMap.matrixAutoUpdate ? new Matrix3().setUvTransform(normalMap.offset.x, normalMap.offset.y, normalMap.repeat.x, normalMap.repeat.y, normalMap.rotation, normalMap.center.x, normalMap.center.y) : normalMap.matrix;
  const sampleNormal = createPhotoWaterNormalSampler({ data: pixels, width: image.width, height: image.height }, transform, normalMap.flipY, normalScale);
  const started = performance.now();
  const field = bakeRefractedSunField({ outline: medium.outline, waterY: medium.waterY, floorY: medium.bottomY, toSun: toSun.toArray(), ior, sampleNormal });
  if (!field) return null;
  const gain = normaliseRefractedSunGain(field);
  return gain ? { field, gain, environmentSun: !!environmentSunDirection, floorY: medium.bottomY, waterY: medium.waterY, toSun: toSun.toArray(), bakeMs: performance.now() - started } : null;
}

const direct = "result = attenuatedColor * lightRec.emission * state.throughputColor * sampleColor * misWeight / lightPdf;";
const environmentDirect = "result = attenuatedColor * environmentIntensity * envColor * state.throughputColor * sampleColor * misWeight / envPdf;";
const functionStart = "vec3 directLightContribution( vec3 worldWo, SurfaceRecord surf, RenderState state, vec3 rayOrigin ) {";

/** Correct only the visible direct-sun diffuse lobe using the refracted/flat
 * irradiance ratio. The catalogue sun comes from the HDRI with its duplicate directional light off.
 * Only that measured solar cone is modulated. Existing shadow visibility, spectrum/absorption, specular
 * reflection and environment sampling remain in the installed owned tracer. */
export function installRefractedSun(tracer: WebGLPathTracer, scene: Scene, gl: WebGLRenderer, snapshot: NonNullable<ReturnType<typeof prepareRefractedSun>>) {
  const anchor = snapshot.environmentSun ? environmentDirect : direct;
  const direction = snapshot.environmentSun ? "envDirection" : "lightRec.direction";
  const radiance = snapshot.environmentSun ? "environmentIntensity * envColor" : "lightRec.emission";
  const pdf = snapshot.environmentSun ? "envPdf" : "lightPdf";
  const solarGate = snapshot.environmentSun ? "true" : "lightRec.type == DIR_LIGHT_TYPE";
  const material = (tracer as unknown as { _pathTracer?: { material?: ShaderMaterial } })._pathTracer?.material;
  if (!material?.isShaderMaterial || !material.uniforms["poolPhotoWaterPoints"] || material.fragmentShader.split(anchor).length !== 2 || material.fragmentShader.split(functionStart).length !== 2)
    throw new Error("Unsupported refracted-sun shader or water medium");
  const atlas = (material as ShaderMaterial & { iesProfiles?: { setTextures: (renderer: WebGLRenderer, textures: Texture[]) => void } }).iesProfiles;
  if (!atlas?.setTextures) throw new Error("Unsupported refracted-sun optical atlas");
  const profiles = new Set<Texture>();
  scene.traverse(object => {
    const light = object as unknown as { isSpotLight?: boolean; isPointLight?: boolean; isDirectionalLight?: boolean; isRectAreaLight?: boolean; iesMap?: Texture };
    if (object.visible && (light.isSpotLight || light.isPointLight || light.isDirectionalLight || light.isRectAreaLight) && light.iesMap) profiles.add(light.iesMap);
  });
  const originals = [...profiles].sort((a, b) => a.uuid < b.uuid ? 1 : a.uuid > b.uuid ? -1 : 0);
  const map = new DataTexture(snapshot.gain.data, snapshot.field.resolution, snapshot.field.resolution, RGBAFormat, FloatType);
  map.minFilter = map.magFilter = LinearFilter; map.needsUpdate = true;
  const uploads = [...originals, map].map(texture => texture.clone());
  try { atlas.setTextures(gl, uploads); }
  finally { uploads.forEach(texture => texture.dispose()); map.dispose(); }
  const original = material.fragmentShader, bounds = snapshot.field.bounds;
  const uniforms = {
    poolRefractedSunFloorY: { value: snapshot.floorY },
    poolRefractedSunDirection: { value: new Vector3(...snapshot.toSun).normalize() },
    poolRefractedSunBounds: { value: new Vector4(bounds[0], bounds[1], bounds[2] - bounds[0], bounds[3] - bounds[1]) },
  };
  const previous = Object.fromEntries(Object.keys(uniforms).map(key => [key, material.uniforms[key]]));
  Object.assign(material.uniforms, uniforms);
  const field = `
    float poolRefractedSunGain(vec3 position) {
      if (abs(position.y - poolRefractedSunFloorY) > 0.015 ||
          poolPhotoWaterLength(position + vec3(0,0.002,0), vec3(0,1,0), poolPhotoWaterMax.y - position.y) <= 0.0) return 0.0;
      vec2 uv = (position.xz - poolRefractedSunBounds.xy) / poolRefractedSunBounds.zw;
      if (any(lessThan(uv,vec2(0))) || any(greaterThan(uv,vec2(1)))) return 0.0;
      vec2 field = texture2D(iesProfiles, vec3(uv, ${originals.length}.0)).rg;
      return (field.r - 1.0) * clamp(field.g,0.0,1.0);
    }
  `;
  material.fragmentShader = `uniform float poolRefractedSunFloorY;\nuniform vec4 poolRefractedSunBounds;\nuniform vec3 poolRefractedSunDirection;\n` + original
    .replace(functionStart, field + functionStart)
    .replace(anchor, `${anchor}
      if (${solarGate} && !surf.volumeParticle && surf.transmission < 0.01 && surf.metalness < 0.99) {
        // Measured catalogue HDRI: >1% solar-core luminance lies within0.38 degrees.
        float solarWeight = smoothstep(0.9999451693655121,0.9999756307053947,dot(${direction},poolRefractedSunDirection));
        float gain = 0.0;
        if (solarWeight > 0.0) gain = poolRefractedSunGain(rayOrigin) * solarWeight;
        if (gain != 0.0) {
          vec3 wo = normalize(surf.normalInvBasis * worldWo);
          vec3 wi = normalize(surf.normalInvBasis * ${direction});
          if (wo.z > 0.0 && wi.z > 0.0) {
            vec3 diffuseColor = vec3(0.0);
            diffuseEval(wo, wi, getHalfVector(wi, wo, surf.eta), surf, diffuseColor);
            diffuseColor *= (1.0 - surf.transmission) * mix(1.0, sheenAlbedoScaling(wo, wi, surf), surf.sheen);
            vec3 coatWo = normalize(surf.clearcoatInvBasis * worldWo);
            vec3 coatWi = normalize(surf.clearcoatInvBasis * ${direction});
            if (coatWi.z >= 0.0) diffuseColor *= 1.0 - surf.clearcoat * schlickFresnel(dot(coatWi,getHalfVector(coatWo,coatWi)),iorRatioToF0(1.5));
            diffuseColor = min(max(diffuseColor,vec3(0)),sampleColor);
            result += attenuatedColor * ${radiance} * state.throughputColor * diffuseColor * gain * misWeight / ${pdf};
          }
        }
      }
    `);
  material.needsUpdate = true;
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    material.fragmentShader = original;
    for (const key of Object.keys(uniforms)) {
      if (previous[key]) material.uniforms[key] = previous[key]; else delete material.uniforms[key];
    }
    material.needsUpdate = true;
  };
}
