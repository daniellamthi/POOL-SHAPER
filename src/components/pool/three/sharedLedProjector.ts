import { ShaderChunk, type Texture, type WebGLProgramParametersWithUniforms } from "three";

/** PoolLights projects one scene-owned diffuser from every submerged fitting.
 * Keep every projector coordinate and shadow, but bind that same image once.
 * This is material-local; library chunks and the renderer's light state stay intact.
 */
export function shareLedProjector(shader: WebGLProgramParametersWithUniforms): void {
  if (shader.uniforms["poolLedProjector"]) return;
  shader.uniforms["poolLedProjector"] = {
    // Three assigns the sorted light-map array after onBeforeCompile.
    get value(): Texture | null {
      const maps = shader.uniforms["spotLightMap"]?.value as Texture[] | undefined;
      const texture = maps?.[0] ?? null;
      if (maps?.some((map) => map !== texture)) {
        throw new Error("Pool LED projectors must use the identical shared diffuser image");
      }
      return texture;
    },
  };
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <shadowmap_pars_fragment>", ShaderChunk.shadowmap_pars_fragment)
    .replace("#include <lights_fragment_begin>", ShaderChunk.lights_fragment_begin)
    .replace(
      /uniform sampler2D spotLightMap\[\s*[^\]]+\s*\];/,
      "uniform sampler2D poolLedProjector;",
    )
    .replace(/spotLightMap\[\s*[^\]]+\s*\]/g, "poolLedProjector");
}
