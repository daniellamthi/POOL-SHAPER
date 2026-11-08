import { DenoiseMaterial, type WebGLPathTracer } from "three-gpu-pathtracer";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import {
  LinearSRGBColorSpace,
  NearestFilter,
  RGBAFormat,
  WebGLRenderTarget,
  type Texture,
} from "three";
import { PHOTO_MODE_EXPORT_READY_SAMPLES } from "@/lib/pool/photoModeState";

/** Filter a display copy of the linear HDR image, then retain the tracer's
 * clamped reconstruction/tone mapping. Never filter its accumulating target.
 */
export function installPhotoOutputFilter(
  tracer: WebGLPathTracer,
  onFilteredFrame?: (target: WebGLRenderTarget | null) => void,
) {
  const original = tracer.renderToCanvasCallback;
  const material = new DenoiseMaterial({ sigma: 1.5, kSigma: 1, threshold: 0.12 });
  // Do not let an invalid HDR neighbour contaminate a whole output kernel.
  // Preserve the original centre when the weighted result is undefined.
  material.fragmentShader = material.fragmentShader
    .replace(
      "centrPx.rgb *= centrPx.a;",
      `centrPx.rgb *= centrPx.a;
      if (any(isnan(centrPx)) || any(isinf(centrPx))) return centrPx;`,
    )
    .replace(
      "walkPx.rgb *= walkPx.a;",
      `walkPx.rgb *= walkPx.a;
      if (any(isnan(walkPx)) || any(isinf(walkPx))) continue;`,
    )
    .replace(
      "zBuff += deltaFactor;",
      `if (!(deltaFactor > 0.0)) continue;
      zBuff += deltaFactor;`,
    )
    .replace(
      "return aBuff / zBuff;",
      `
      if (!(zBuff > 0.0) || any(isnan(aBuff)) || any(isinf(aBuff))) return centrPx;
      return aBuff / zBuff;`,
    );
  material.toneMapped = false;
  const quad = new FullScreenQuad(material);
  let output: WebGLRenderTarget | null = null;
  let disposed = false;
  let failed = false;
  const filtered: WebGLPathTracer["renderToCanvasCallback"] = (target, gl, sourceQuad) => {
    onFilteredFrame?.(null);
    if (
      failed ||
      tracer.samples < PHOTO_MODE_EXPORT_READY_SAMPLES ||
      sourceQuad.material.opacity < 1
    ) {
      original(target, gl, sourceQuad);
      return;
    }
    const previousTarget = gl.getRenderTarget();
    const cubeFace = gl.getActiveCubeFace(),
      mip = gl.getActiveMipmapLevel();
    const autoClear = gl.autoClear;
    let complete = false;
    try {
      if (!output) {
        output = new WebGLRenderTarget(target.width, target.height, {
          type: target.texture.type,
          format: RGBAFormat,
          minFilter: NearestFilter,
          magFilter: NearestFilter,
          depthBuffer: false,
          stencilBuffer: false,
          generateMipmaps: false,
        });
        output.texture.colorSpace = LinearSRGBColorSpace;
      } else if (output.width !== target.width || output.height !== target.height) {
        output.setSize(target.width, target.height);
      }
      gl.autoClear = false;
      gl.setRenderTarget(output);
      material.map = target.texture;
      quad.render(gl);
      complete = true;
    } catch (error) {
      failed = true;
      console.warn(
        "[PhotoMode] Output filter unavailable; retaining the accumulated image.",
        error,
      );
    } finally {
      gl.setRenderTarget(previousTarget, cubeFace, mip);
      gl.autoClear = autoClear;
    }
    if (complete && output) {
      onFilteredFrame?.(output);
      // The public output callback receives the tracer's interpolation quad.
      // Borrow its map for this draw only; leave its alpha/fade/colour path intact.
      const blit = sourceQuad.material as typeof sourceQuad.material & { map: Texture };
      const previousMap = blit.map;
      try {
        blit.map = output.texture;
        original(output, gl, sourceQuad);
      } finally {
        blit.map = previousMap;
      }
    } else {
      original(target, gl, sourceQuad);
    }
  };
  tracer.renderToCanvasCallback = filtered;
  return () => {
    if (disposed) return;
    disposed = true;
    onFilteredFrame?.(null);
    if (tracer.renderToCanvasCallback === filtered) tracer.renderToCanvasCallback = original;
    output?.dispose();
    quad.dispose();
    material.dispose();
  };
}
