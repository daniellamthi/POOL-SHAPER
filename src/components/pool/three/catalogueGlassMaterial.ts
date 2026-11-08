import * as THREE from "three";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";

/** One clear physical glazing model in live view and Photo Mode. Transmission
 * keeps the dielectric reflection and the room behind the pane in the same
 * linear lighting calculation, avoiding a diffuse white alpha overlay.
 */
export function createCatalogueGlassMaterial(waterY: number) {
  const material = new THREE.MeshPhysicalMaterial({
    color: "#edf3ee",
    transmission: 1,
    thickness: 0,
    ior: 1.5,
    opacity: 1,
    transparent: false,
    roughness: 0.02,
    metalness: 0,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => excludeSubmergedDirectLights(shader, waterY, true);
  material.customProgramCacheKey = () => "catalogue-dry-linked-v1";
  return material;
}
