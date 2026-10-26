import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { PerspectiveCamera, Quaternion, Vector2, Vector3 } from "three";
import type { SitePhotoCamera } from "@/lib/pool/site-photo-camera";
export interface SitePhotoView {
  camera: SitePhotoCamera;
  offsetX: number;
  offsetZ: number;
  rotation: number;
  exportRequest: number;
  exportWidth: number;
  exportHeight: number;
  onReady: (ready: boolean) => void;
  onCapture: (image: string | null) => void;
}
/** Only mounted inside the photo studio. Existing wizard camera rigs are absent. */
export function SitePhotoCameraRig({ view }: { view: SitePhotoView }) {
  const { camera, gl, scene, size } = useThree();
  const {
    camera: matchedCamera,
    offsetX,
    offsetZ,
    rotation,
    exportRequest,
    exportWidth,
    exportHeight,
    onReady,
    onCapture,
  } = view;
  const active = useProgress((state) => state.active);
  const stable = useRef(0),
    reported = useRef(false),
    captured = useRef(0);
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const turn = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      (-rotation * Math.PI) / 180,
    );
    camera.position
      .fromArray(matchedCamera.position)
      .sub(new Vector3(offsetX, 0, offsetZ))
      .applyQuaternion(turn);
    camera.quaternion.fromArray(matchedCamera.quaternion).premultiply(turn);
    camera.fov = matchedCamera.verticalFov;
    // Keep the calibrated projection even when CSS borders round the viewport size.
    camera.aspect = matchedCamera.aspect;
    camera.near = 0.01;
    camera.far = 2000;
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    stable.current = 0;
    reported.current = false;
    onReady(false);
  }, [camera, size.width, size.height, matchedCamera, offsetX, offsetZ, rotation, onReady]);
  useFrame((_state, delta) => {
    if (active) {
      stable.current = 0;
      if (reported.current) {
        reported.current = false;
        onReady(false);
      }
    } else stable.current += Math.min(delta, 0.1);
    gl.render(scene, camera);
    if (stable.current >= 0.6 && !reported.current) {
      reported.current = true;
      onReady(true);
    }
    if (reported.current && exportRequest > captured.current) {
      captured.current = exportRequest;
      const originalSize = gl.getSize(new Vector2());
      const originalDpr = gl.getPixelRatio();
      let image: string | null = null;
      try {
        // Export at the photo resolution, independent of the mobile preview size.
        gl.setPixelRatio(1);
        gl.setSize(exportWidth, exportHeight, false);
        gl.render(scene, camera);
        image = gl.domElement.toDataURL("image/png");
      } catch {
        image = null;
      } finally {
        gl.setPixelRatio(originalDpr);
        gl.setSize(originalSize.x, originalSize.y, false);
        gl.render(scene, camera);
      }
      onCapture(image);
    }
  }, 1);
  return null;
}
