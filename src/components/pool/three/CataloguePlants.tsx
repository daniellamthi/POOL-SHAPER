import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { SCENE_VISUAL_PRESET } from "@/configurator/3d/scene/visual-preset";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { ArchitecturalPlan } from "@/lib/pool/catalogue-architecture";
import {
  createCataloguePlantInstances,
  bakeCataloguePlantInstances,
} from "./cataloguePlantGeometry";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";
import { shareLedProjector } from "./sharedLedProjector";
import { skipBackFacingPlantAreaLights } from "./cataloguePlantAreaLight";
import { correctCatalogueFoliageCoverage } from "./catalogueFoliageCoverage";

const configureLoader = (loader: GLTFLoader) => loader.setMeshoptDecoder(MeshoptDecoder);

/** Source geometry is shared by live instances; only Photo Mode expands it. */
export function CataloguePlants({
  plan,
  waterY,
  photoMode,
  night,
}: {
  plan: ArchitecturalPlan;
  waterY: number;
  photoMode: boolean;
  night: boolean;
}) {
  const asset = useLoader(GLTFLoader, "/models/catalogue/canopy-packed.glb", configureLoader);
  const sourceAlphas = useLoader(THREE.TextureLoader, [
    "/textures/catalogue/evergreen/alpha.png",
    "/textures/catalogue/canopy/leaves_alpha.png",
  ]);
  // These plants stand outside the spa. They must not inherit its ceiling /
  // floor reflection probe as their daylight. The shared exterior HDR stays
  // cached on Night/Day; only its receiver intensity is crossfaded.
  const outside = useLoader(HDRLoader, "/hdri/pool-daylight-1k.hdr");
  outside.mapping = THREE.EquirectangularReflectionMapping;
  const outsideBlend = useRef(night ? 1 : 0);
  const anisotropy = useThree((state) => Math.min(8, state.gl.capabilities.getMaxAnisotropy()));
  const instances = useMemo(() => createCataloguePlantInstances(asset.scene, plan), [asset, plan]);
  const materialSources = useMemo(() => {
    const sources = new Set<THREE.MeshStandardMaterial>();
    asset.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => sources.add(material as THREE.MeshStandardMaterial));
    });
    return [...sources];
  }, [asset]);
  const resources = useMemo(() => {
    const alphas: THREE.Texture[] = [];
    const materials = new Map<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>();
    for (const source of materialSources) {
      const material = source.clone();
      // Optimizers remove BLEND from JPEG-only glTFs. Named source roles keep
      // the original separate alpha scans authoritative for leaf/twig cutouts.
      if (source.name.endsWith("_leaves") || source.name.endsWith("_twigs")) {
        const alpha = sourceAlphas[source.name.startsWith("tree_small_02") ? 1 : 0]!.clone();
        alpha.flipY = false;
        alpha.colorSpace = THREE.NoColorSpace;
        alpha.anisotropy = anisotropy;
        if (source.map) {
          alpha.wrapS = source.map.wrapS;
          alpha.wrapT = source.map.wrapT;
          alpha.repeat.copy(source.map.repeat);
          alpha.offset.copy(source.map.offset);
          alpha.center.copy(source.map.center);
          alpha.rotation = source.map.rotation;
          alpha.channel = source.map.channel;
          alpha.matrixAutoUpdate = source.map.matrixAutoUpdate;
          alpha.matrix.copy(source.map.matrix);
        }
        alpha.needsUpdate = true;
        alphas.push(alpha);
        material.alphaMap = alpha;
        material.alphaTest = 0.5;
      }
      if (plan.indoor) {
        material.envMap = outside;
        material.envMapIntensity = THREE.MathUtils.lerp(0.24, 0.015, outsideBlend.current);
      }
      material.transparent = false;
      material.opacity = 1;
      const cutout = source.name.endsWith("_leaves") || source.name.endsWith("_twigs");
      material.onBeforeCompile = (shader) => {
        excludeSubmergedDirectLights(shader, waterY, true);
        if (cutout) correctCatalogueFoliageCoverage(shader);
        shareLedProjector(shader);
        skipBackFacingPlantAreaLights(shader);
      };
      material.customProgramCacheKey = () =>
        cutout ? "catalogue-foliage-coverage-v4-area-earlyout" : "catalogue-dry-linked-v3-area-earlyout";
      materials.set(source, material);
    }
    return { materials, alphas, list: [...materials.values()] };
  }, [materialSources, sourceAlphas, anisotropy, waterY, outside, plan.indoor]);
  useFrame((_, delta) => {
    if (!plan.indoor) return;
    const target = night ? 1 : 0;
    const value = outsideBlend.current;
    if (value === target) return;
    const step = delta / SCENE_VISUAL_PRESET.dusk.transitionSeconds;
    outsideBlend.current =
      value < target ? Math.min(target, value + step) : Math.max(target, value - step);
    const intensity = THREE.MathUtils.lerp(0.24, 0.015, outsideBlend.current);
    for (let i = 0; i < resources.list.length; i++) resources.list[i]!.envMapIntensity = intensity;
  });
  const meshes = useMemo(
    () =>
      instances.map((entry, index) => {
        const mesh = new THREE.InstancedMesh(
          entry.geometry,
          resources.materials.get(entry.material)!,
          entry.matrices.length,
        );
        entry.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.computeBoundingBox();
        mesh.name = `catalogue-plant-${index}`;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
      }),
    [instances, resources],
  );
  const batches = useMemo(
    () => (photoMode ? bakeCataloguePlantInstances(instances) : []),
    [photoMode, instances],
  );
  useEffect(() => () => meshes.forEach((mesh) => mesh.dispose()), [meshes]);
  useEffect(() => () => batches.forEach(({ geometry }) => geometry.dispose()), [batches]);
  useEffect(
    () => () => {
      resources.materials.forEach((material) => material.dispose());
      resources.alphas.forEach((alpha) => alpha.dispose());
    },
    [resources],
  );
  return (
    <group name="catalogue-vegetation">
      {photoMode
        ? batches.map(({ geometry, material }, index) => (
            <mesh
              key={index}
              name={`catalogue-plant-traced-${index}`}
              geometry={geometry}
              material={resources.materials.get(material)!}
              castShadow
              receiveShadow
              dispose={null}
            />
          ))
        : meshes.map((mesh) => <primitive key={mesh.uuid} object={mesh} dispose={null} />)}
    </group>
  );
}
