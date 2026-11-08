import { memo, useEffect, useMemo } from "react";
import { BoxGeometry, Float32BufferAttribute, MeshStandardMaterial, DirectionalLight, SpotLight, Vector2, TextureLoader, RepeatWrapping, SRGBColorSpace, NoColorSpace } from "three";
import { useLoader, useThree } from "@react-three/fiber";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Outline } from "@/lib/pool/types";
import { planCataloguePatio, type PatioFinish } from "@/lib/pool/catalogue-patio";
import { createCataloguePartGeometry } from "./cataloguePartGeometry";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";

const FINISHES: PatioFinish[] = ["plaster", "wood", "cap", "gravel", "reveal"];
/** Five static draw batches. No extra lights, render targets or frame callbacks. */
export const CataloguePatio = memo(function CataloguePatio({
  terrace,
  occupied,
  direction,
  waterY,
}: {
  terrace: Outline;
  occupied: readonly (readonly [number, number, number])[];
  direction: readonly [number, number, number];
  waterY: number;
}) {
  const scans = useLoader(TextureLoader, [
    "/textures/catalogue/oak/basecolor.jpg",
    "/textures/catalogue/oak/normal.jpg",
    "/textures/catalogue/oak/roughness.jpg",
  ]);
  const gl = useThree(state => state.gl);
  const scene = useThree(state => state.scene);
  const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
  const meshes = useMemo(() => {
    const plan = planCataloguePatio(terrace, occupied, direction);
    if (!plan) return [];
    return FINISHES.flatMap((finish) => {
      const parts = plan.parts.filter((part) => part.finish === finish);
      if (!parts.length) return [];
      const boxes = parts.map((part, index) => {
        const geometry = finish === "wood" || finish === "plaster" || finish === "cap"
          ? createCataloguePartGeometry({
              finish: finish === "cap" ? "stone" : finish,
              p: part.position, s: part.size,
            })
          : new BoxGeometry(...part.size).translate(...part.position);
        const tone = finish === "wood" ? 0.87 + ((index * 17) % 11) / 85 : 1;
        geometry.setAttribute(
          "color",
          new Float32BufferAttribute(
            Array.from({ length: geometry.getAttribute("position").count * 3 }, () => tone),
            3,
          ),
        );
        return geometry;
      });
      const geometry = mergeGeometries(boxes)!;
      boxes.forEach((box) => box.dispose());
      return [{ finish, geometry }];
    });
  }, [terrace, occupied, direction]);
  const resources = useMemo(() => {
    // Cached decoded sources are shared with the villa; this context owns
    // its clones. Metric geometry UVs keep the oak grain at a fixed scale.
    const maps = scans.map((source, index) => {
      const texture = source.clone();
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.colorSpace = index === 0 ? SRGBColorSpace : NoColorSpace;
      texture.anisotropy = anisotropy;
      return texture;
    });
    const wood = { colorMap: maps[0]!, normalMap: maps[1]!, roughnessMap: maps[2]! };
    const materials: Record<PatioFinish, MeshStandardMaterial> = {
      plaster: new MeshStandardMaterial({ color: "#ddd8ca", roughness: 0.94, vertexColors: true }),
      wood: new MeshStandardMaterial({
        color: "#cfa978",
        map: wood.colorMap,
        normalMap: wood.normalMap,
        roughnessMap: wood.roughnessMap,
        normalScale: new Vector2(0.18, 0.18),
        roughness: 1,
        vertexColors: true,
      }),
      cap: new MeshStandardMaterial({ color: "#c2bbaa", roughness: 0.86, vertexColors: true }),
      gravel: new MeshStandardMaterial({ color: "#afa799", roughness: 1, vertexColors: true }),
      reveal: new MeshStandardMaterial({ color: "#34342e", roughness: 0.95, vertexColors: true }),
    };
    for (const material of Object.values(materials)) {
      material.onBeforeCompile = shader => excludeSubmergedDirectLights(shader, waterY);
      material.customProgramCacheKey = () => "catalogue-patio-dry-v1";
    }
    return { wood, materials };
  }, [scans, anisotropy, waterY]);
  useEffect(() => () => meshes.forEach((mesh) => mesh.geometry.dispose()), [meshes]);
  useEffect(
    () => () => {
      Object.values(resources.materials).forEach((material) => material.dispose());
      Object.values(resources.wood).forEach((texture) => texture?.dispose());
    },
    [resources],
  );
  useEffect(() => {
    const invalidateShadows = () => {
      scene.traverse(object => {
        if (object instanceof DirectionalLight || object instanceof SpotLight) object.shadow.needsUpdate = true;
      });
      gl.shadowMap.needsUpdate = true;
    };
    invalidateShadows();
    return invalidateShadows;
  }, [gl, scene, meshes]);
  return (
    <group name="catalogue-patio-context">
      {meshes.map(({ finish, geometry }) => (
        <mesh
          key={finish}
          name={`patio-${finish}`}
          geometry={geometry}
          material={resources.materials[finish]}
          castShadow={finish !== "gravel"}
          receiveShadow
          dispose={null}
        />
      ))}
    </group>
  );
});
