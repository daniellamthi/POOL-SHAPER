import { Matrix4, PerspectiveCamera, Vector3, type Camera, type Vector2 } from "three";

/** A photograph owns its full-frame projection; editor UI insets stay on the
 * live camera. Copy only on actual source/size changes, not every sample. */
export function createPhotoCamera(source: Camera, subject?: readonly (readonly [number, number, number])[], portraitPitch = 0) {
  const camera = new (source.constructor as new () => Camera)().copy(source, false);
  const point = new Vector3();
  const portraitRotation = new Matrix4().makeRotationX(-portraitPitch);
  const previousWorld = new Matrix4();
  const previousProjection = new Matrix4();
  return {
    camera,
    sync(editor: Camera, size: Vector2) {
      if (editor.constructor !== camera.constructor) throw new Error("Recreate the photo camera when its type changes");
      previousWorld.copy(camera.matrixWorld);
      previousProjection.copy(camera.projectionMatrix);
      camera.copy(editor, false);
      // The clone has no parent. Its local matrix therefore owns the exact
      // editor WORLD transform, including a possible camera parent.
      camera.matrixAutoUpdate = false;
      camera.matrixWorldAutoUpdate = true;
      camera.matrix.copy(editor.matrixWorld);
      camera.matrixWorld.copy(editor.matrixWorld);
      camera.matrixWorldInverse.copy(editor.matrixWorld).invert();
      camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
      camera.matrixWorldNeedsUpdate = true;
      if (camera instanceof PerspectiveCamera && subject) {
        camera.aspect = Math.max(1, size.x) / Math.max(1, size.y);
        camera.clearViewOffset();
        // Indoor portrait overviews frame the basin below the aisle eye.
        // Apply to this owned camera only, afresh from the editor each sync.
        if (camera.aspect < 0.8 && portraitPitch) {
          camera.matrix.multiply(portraitRotation);
          camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
          camera.matrixWorld.copy(camera.matrix);
          camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
        }
        // Preserve the chosen eye/target. Widen only the photographic lens
        // when the real pool perimeter would otherwise leave the frame.
        let extent = 0;
        for (const position of subject) {
          point.fromArray(position).applyMatrix4(camera.matrixWorldInverse);
          if (point.z >= -camera.near) {
            // A detail/inside viewpoint cannot show the entire basin safely.
            camera.copy(editor as PerspectiveCamera, false);
            camera.matrixAutoUpdate = false;
            camera.matrix.copy(editor.matrixWorld);
            camera.matrixWorld.copy(editor.matrixWorld);
            camera.matrixWorldInverse.copy(editor.matrixWorld).invert();
            camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
            camera.matrixWorldNeedsUpdate = true;
            return !previousWorld.equals(camera.matrixWorld) || !previousProjection.equals(camera.projectionMatrix);
          }
          point.applyMatrix4(camera.projectionMatrix);
          extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y));
        }
        if (extent > 0.88) {
          camera.zoom *= 0.88 / extent;
          camera.updateProjectionMatrix();
        }
      }
      return !previousWorld.equals(camera.matrixWorld) || !previousProjection.equals(camera.projectionMatrix);
    },
  };
}
