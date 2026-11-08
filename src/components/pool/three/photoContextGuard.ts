import type { WebGLRenderer } from "three";

/** A lost GPU context invalidates both accumulated samples and async captures.
 * Native restoration starts a new generation; old blobs never become valid
 * again merely because isContextLost() has returned to false. */
export function watchPhotoContext(
  gl: Pick<WebGLRenderer, "domElement" | "getContext" | "forceContextRestore">,
  onLost: () => void,
  onRestored: () => void,
) {
  let lost = false, disposed = false, generation = 0;
  const lose = (event?: Event) => {
    event?.preventDefault();
    if (disposed || lost) return;
    lost = true;
    generation++;
    onLost();
  };
  const restore = () => {
    if (disposed || !lost) return;
    lost = false;
    onRestored();
  };
  gl.domElement.addEventListener("webglcontextlost", lose);
  gl.domElement.addEventListener("webglcontextrestored", restore);
  if (gl.getContext().isContextLost()) lose();
  return {
    stamp: () => generation,
    isLost: () => lost || gl.getContext().isContextLost(),
    valid: (stamp: number) => !disposed && !lost && !gl.getContext().isContextLost() && generation === stamp,
    requestRestore() {
      if (!disposed && lost) {
        try { gl.forceContextRestore(); }
        catch (error) { console.warn("[PhotoMode] Graphics recovery request failed", error); }
      }
    },
    dispose() {
      disposed = true;
      gl.domElement.removeEventListener("webglcontextlost", lose);
      gl.domElement.removeEventListener("webglcontextrestored", restore);
    },
  };
}
