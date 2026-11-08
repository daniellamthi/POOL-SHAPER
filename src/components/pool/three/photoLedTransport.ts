import { Matrix4, ShaderMaterial, SpotLight, Vector3, type Scene, type Texture, type WebGLRenderer } from "three";
import type { WebGLPathTracer } from "three-gpu-pathtracer";
import { LED_OPTICS } from "@/lib/pool/led-optics";

const emission = "lightRec.emission = light.color * light.intensity * distanceAttenuation * spotAttenuation;";

/** Carry the accepted submerged-fixture optics into the traced light sampler.
 * The tracer ignores raster onBeforeCompile and SpotLight.map. Borrow maps;
 * change only its owned material, never the live luminaires or global chunks.
 */
export function installPhotoLedTransport(tracer: WebGLPathTracer, scene: Scene, waterY: number, gl: WebGLRenderer, mediumOwnsAbsorption = false) {
  const fixtures: SpotLight[] = [];
  scene.traverseVisible(object => {
    if (!(object instanceof SpotLight) || object.intensity <= 0 || !object.map) return;
    let parent = object.parent;
    while (parent && parent.name !== "pool-underwater-led") parent = parent.parent;
    if (parent) fixtures.push(object);
  });
  if (!fixtures.length || !Number.isFinite(waterY)) return () => {};
  // Version-bound integration: this installed tracer shares its full material
  // with the low-res preview. Fail explicitly if its internal contract changes.
  const material = (tracer as unknown as { _pathTracer?: { material?: ShaderMaterial } })._pathTracer?.material;
  if (!material?.isShaderMaterial || material.fragmentShader.split(emission).length !== 2)
    throw new Error("Unsupported Photo Mode LED transport shader");
  const diffuser = fixtures[0]!.map as Texture;
  if (fixtures.some(light => light.map !== diffuser))
    throw new Error("Unsupported Photo Mode LED diffuser set");
  // With an explicit bounded water volume, that volume owns direct-path
  // extinction too. Retain the legacy fixture term for all other callers.
  const original = material.fragmentShader;
  // Reuse the tracer's existing optical atlas: a separate sampler exceeds
  // the fragment texture budget on the integrated browser's 16-unit GPU.
  const atlas = (material as ShaderMaterial & { iesProfiles?: { setTextures: (renderer: WebGLRenderer, textures: Texture[]) => void } }).iesProfiles;
  if (!atlas?.setTextures) throw new Error("Unsupported Photo Mode optical atlas");
  const ies = new Set<Texture>();
  // Match the installed tracer's getLights/getIesTextures collection exactly,
  // including visible lights below hidden parents; their layer indices exist.
  scene.traverse(object => {
    const light = object as unknown as { isSpotLight?: boolean; isPointLight?: boolean; isDirectionalLight?: boolean; isRectAreaLight?: boolean; iesMap?: Texture };
    if (object.visible && (light.isSpotLight || light.isPointLight || light.isDirectionalLight || light.isRectAreaLight) && light.iesMap) ies.add(light.iesMap);
  });
  const originals = [...ies].sort((a, b) => a.uuid < b.uuid ? 1 : a.uuid > b.uuid ? -1 : 0);
  // Atlas upload temporarily resets texture matrices, so upload owned clones.
  const uploads = [...originals, diffuser].map(texture => texture.clone());
  try { atlas.setTextures(gl, uploads); }
  finally { uploads.forEach(texture => texture.dispose()); }
  const projection: Matrix4[] = fixtures.map(light => {
    const shadow = light.shadow.clone();
    shadow.updateMatrices(light);
    return shadow.matrix;
  });
  const uniforms = {
    catalogueLedSources: { value: fixtures.map(light => light.getWorldPosition(new Vector3())) },
    catalogueLedProjection: { value: projection },
    catalogueLedWaterY: { value: waterY },
  };
  const previous = Object.fromEntries(Object.keys(uniforms).map(key => [key, material.uniforms[key]]));
  Object.assign(material.uniforms, uniforms);
  material.fragmentShader = `
    uniform vec3 catalogueLedSources[${fixtures.length}];
    uniform mat4 catalogueLedProjection[${fixtures.length}];
    uniform float catalogueLedWaterY;
  ` + original.replace(emission, `${emission}
    for (int ledIndex = 0; ledIndex < ${fixtures.length}; ledIndex++) {
      if (distance(light.position, catalogueLedSources[ledIndex]) < 0.0001) {
        float ledFalloff = getDistanceAttenuation( sqrt( dist * dist + ${LED_OPTICS.nearField ** 2} ), light.distance, light.decay );
        vec3 incident = light.color * light.intensity * ledFalloff * spotAttenuation;
        ${mediumOwnsAbsorption ? "" : `incident *= exp(-vec3(${LED_OPTICS.absorption.join(",")}) * dist);`}
        incident /= 1.0 + dot(incident, vec3(0.2126,0.7152,0.0722)) * ${LED_OPTICS.irradianceKnee};
        incident *= 1.0 - smoothstep(catalogueLedWaterY - 0.015, catalogueLedWaterY, rayOrigin.y);
        vec4 projected = catalogueLedProjection[ledIndex] * vec4(rayOrigin, 1.0);
        vec3 uv = projected.xyz / projected.w;
        bool inMap = all(lessThan(abs(uv * 2.0 - 1.0), vec3(1.0)));
        lightRec.emission = incident * (inMap ? texture2D(iesProfiles, vec3(uv.xy, ${originals.length}.0)).rgb : vec3(1.0));
        break;
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
      if (previous[key]) material.uniforms[key] = previous[key];
      else delete material.uniforms[key];
    }
    material.needsUpdate = true;
  };
}
