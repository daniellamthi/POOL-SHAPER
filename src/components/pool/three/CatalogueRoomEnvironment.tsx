import { useEffect, type RefObject } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { CATALOGUE_COVE_POWER, type ArchitecturalPlan } from "@/lib/pool/catalogue-architecture";
import { CATALOGUE_GARDEN } from "@/lib/pool/catalogue-garden";
import { SCENE_VISUAL_PRESET } from "@/configurator/3d/scene/visual-preset";
import { createCatalogueRoomProxy, createNightRoomSky } from "./catalogueRoomProxy";

import type { CatalogueRoomCache } from "./catalogueRoomCache";
export type { CatalogueRoomCache } from "./catalogueRoomCache";

export interface CatalogueRoomMaps {
  day: THREE.Texture;
  night: THREE.Texture;
}

/** Both maps are prepared once per room, never on a Day/Night or Photo Mode
 * toggle. Raster tiers share this bounded approximation; Photo Mode still
 * traces the actual architecture and keeps its own environment owner.
 */
export function CatalogueRoomEnvironment({
  room,
  plan,
  onMaps,
  cache,
}: {
  room: RefObject<THREE.Group | null>;
  plan: ArchitecturalPlan;
  onMaps: (maps: CatalogueRoomMaps | null) => void;
  cache: CatalogueRoomCache;
}) {
  const gl = useThree((state) => state.gl);
  const daylight = useLoader(HDRLoader, CATALOGUE_GARDEN.url);
  useEffect(() => {
    if (cache.targets) {
      onMaps({ day: cache.targets[0]!.texture, night: cache.targets[1]!.texture });
      return () => onMaps(null);
    }
    if (!room.current) return;
    const ground = Math.min(...plan.parts.map((part) => part.p[1] - part.s[1] / 2));
    const proxy = createCatalogueRoomProxy(room.current, ground);
    const night = createNightRoomSky();
    daylight.mapping = THREE.EquirectangularReflectionMapping;
    const generator = cache.generator.current ??= new THREE.PMREMGenerator(gl);
    const targets: THREE.WebGLRenderTarget[] = [];
    const position = new THREE.Vector3(plan.centre[0], ground + 1.55, plan.centre[1]);
    const previousTarget = gl.getRenderTarget();
    const face = gl.getActiveCubeFace(),
      mip = gl.getActiveMipmapLevel();
    const shadowAutoUpdate = gl.shadowMap.autoUpdate,
      xrEnabled = gl.xr.enabled;
    const autoClear = gl.autoClear,
      toneMapping = gl.toneMapping;
    try {
      gl.shadowMap.autoUpdate = false;
      for (const [isNight, outside] of [
        [false, daylight],
        [true, night],
      ] as const) {
        proxy.scene.environment = outside;
        proxy.scene.background = outside;
        // The map stores final room irradiance: sky attenuation belongs to
        // capture, so the live consumer does not attenuate authored coves too.
        const skyIntensity = isNight
          ? SCENE_VISUAL_PRESET.dusk.environment
          : CATALOGUE_GARDEN.environmentIntensity;
        proxy.scene.environmentIntensity = skyIntensity;
        proxy.scene.backgroundIntensity = skyIntensity;
        proxy.scene.environmentRotation.set(0, isNight ? 0 : plan.angle + CATALOGUE_GARDEN.rotation, 0);
        proxy.scene.backgroundRotation.copy(proxy.scene.environmentRotation);
        proxy.scene.traverse((object) => {
          if (object instanceof THREE.RectAreaLight) {
            const face = object.name === "catalogue-cove-down" ? "down" : "wall";
            object.power = object.width * CATALOGUE_COVE_POWER[face][isNight ? "night" : "day"];
          }
        });
        targets.push(generator.fromScene(proxy.scene, 0, 0.05, 180, { size: 128, position }));
      }
      cache.targets = targets;
      onMaps({ day: targets[0]!.texture, night: targets[1]!.texture });
    } catch (error) {
      console.warn(
        "[Pool3D] Indoor reflection capture unavailable; keeping the established environment.",
        error,
      );
    } finally {
      gl.setRenderTarget(previousTarget, face, mip);
      gl.shadowMap.autoUpdate = shadowAutoUpdate;
      gl.xr.enabled = xrEnabled;
      gl.autoClear = autoClear;
      gl.toneMapping = toneMapping;
      proxy.dispose();
      night.dispose();
    }
    if (!cache.targets) targets.forEach((target) => target.dispose());
    return () => onMaps(null);
  }, [gl, daylight, plan, room, onMaps, cache]);
  return null;
}
