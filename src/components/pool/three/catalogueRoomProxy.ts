import * as THREE from "three";
import { correctCatalogueFoliageCoverage } from "./catalogueFoliageCoverage";

/** Capture only dry architecture, with no water feedback or optical callbacks.
 * Geometry/maps are borrowed; only material clones and the bounce floor are owned.
 */
export function createCatalogueRoomProxy(room: THREE.Group, ground: number) {
  const proxy = new THREE.Scene();
  const copy = room.clone(true);
  const materials: THREE.Material[] = [];
  const instances: THREE.InstancedMesh[] = [];
  copy.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.InstancedMesh) instances.push(object);
    const clone = (source: THREE.Material) => {
      const material = source.clone() as THREE.MeshPhysicalMaterial;
      const cutout = source.name.endsWith("_leaves") || source.name.endsWith("_twigs");
      material.onBeforeCompile = cutout ? correctCatalogueFoliageCoverage : () => {};
      material.customProgramCacheKey = () =>
        cutout ? "catalogue-room-foliage-v2" : "catalogue-room-capture-v1";
      if (material.envMap !== undefined) material.envMap = null;
      if (material.transmission !== undefined && material.transmission > 0) {
        material.transmission = 0;
        material.transparent = true;
        material.opacity = 0.18;
        material.depthWrite = false;
      }
      materials.push(material);
      return material;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(clone)
      : clone(object.material);
    object.castShadow = false;
    object.receiveShadow = false;
  });
  proxy.add(copy);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(250, 250),
    new THREE.MeshStandardMaterial({ color: "#aaa396", roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(room.position.x, ground, room.position.z);
  proxy.add(floor);
  return {
    scene: proxy,
    dispose() {
      materials.forEach((material) => material.dispose());
      instances.forEach((instance) => instance.dispose());
      floor.geometry.dispose();
      floor.material.dispose();
    },
  };
}

export function createNightRoomSky() {
  const width = 32,
    height = 16;
  const data = new Float32Array(width * height * 4);
  const zenith = new THREE.Color("#141a21"),
    horizon = new THREE.Color("#242a2f");
  for (let y = 0; y < height; y++) {
    const color = zenith.clone().lerp(horizon, Math.sin(((y + 0.5) / height) * Math.PI));
    for (let x = 0; x < width; x++) data.set([color.r, color.g, color.b, 1], (y * width + x) * 4);
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}
