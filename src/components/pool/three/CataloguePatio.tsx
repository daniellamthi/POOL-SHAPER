import { memo, useEffect, useMemo } from "react";
import { BoxGeometry, Float32BufferAttribute, MeshStandardMaterial, Vector2 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Outline } from "@/lib/pool/types";
import { planCataloguePatio, type PatioFinish } from "@/lib/pool/catalogue-patio";
import { createWoodDeckMaps } from "./stoneTextures";

const FINISHES: PatioFinish[] = ["plaster", "wood", "cap", "gravel", "reveal"];
/** Five static draw batches. No extra lights, render targets or frame callbacks. */
export const CataloguePatio = memo(function CataloguePatio({
  terrace,
  occupied,
  direction,
}: {
  terrace: Outline;
  occupied: readonly (readonly [number, number, number])[];
  direction: readonly [number, number, number];
}) {
  const meshes = useMemo(() => {
    const plan = planCataloguePatio(terrace, occupied, direction);
    if (!plan) return [];
    return FINISHES.flatMap((finish) => {
      const parts = plan.parts.filter((part) => part.finish === finish);
      if (!parts.length) return [];
      const boxes = parts.map((part, index) => {
        const geometry = new BoxGeometry(...part.size);
        geometry.translate(...part.position);
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
    const wood = createWoodDeckMaps(256);
    const materials: Record<PatioFinish, MeshStandardMaterial> = {
      plaster: new MeshStandardMaterial({ color: "#ddd8ca", roughness: 0.94, vertexColors: true }),
      wood: new MeshStandardMaterial({
        color: "#cfa978",
        map: wood.colorMap,
        normalMap: wood.normalMap,
        roughnessMap: wood.roughnessMap,
        normalScale: new Vector2(0.16, 0.16),
        roughness: 0.82,
        vertexColors: true,
      }),
      cap: new MeshStandardMaterial({ color: "#c2bbaa", roughness: 0.86, vertexColors: true }),
      gravel: new MeshStandardMaterial({ color: "#afa799", roughness: 1, vertexColors: true }),
      reveal: new MeshStandardMaterial({ color: "#34342e", roughness: 0.95, vertexColors: true }),
    };
    return { wood, materials };
  }, []);
  useEffect(() => () => meshes.forEach((mesh) => mesh.geometry.dispose()), [meshes]);
  useEffect(
    () => () => {
      Object.values(resources.materials).forEach((material) => material.dispose());
      Object.values(resources.wood).forEach((texture) => texture?.dispose());
    },
    [resources],
  );
  return (
    <group name="catalogue-patio-context">
      {meshes.map(({ finish, geometry }) => (
        <mesh
          key={finish}
          name={`patio-${finish}`}
          geometry={geometry}
          material={resources.materials[finish]}
          receiveShadow
          dispose={null}
        />
      ))}
    </group>
  );
});
