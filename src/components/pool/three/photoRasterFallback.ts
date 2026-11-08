import type { Camera, Scene, WebGLRenderer } from "three";

const fallbackCameras = new WeakMap<Camera, Camera>();

/** Three185 retains raster transmission targets by camera.id. Reuse one
 * preparation camera per editor, with the exact current photographic optics,
 * so reopening Photo Mode cannot grow that renderer-owned target cache. */
export function renderPhotoRasterFallback(gl: Pick<WebGLRenderer, "render">, scene: Scene, editor: Camera, photo: Camera) {
  let fallback = fallbackCameras.get(editor);
  if (!fallback || fallback.constructor !== photo.constructor) {
    fallback = new (photo.constructor as new () => Camera)();
    fallbackCameras.set(editor, fallback);
  }
  fallback.copy(photo, false);
  gl.render(scene, fallback);
}
