import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";
import { StainlessSteelMaterial } from "./StainlessSteelMaterial";

/**
 * Contemporary solar outdoor shower: a slim anthracite aluminium column (the
 * column IS the solar water tank, as on current premium models), a satin
 * stainless arm with a flat rain head, a mixer and a foot tap, standing on a
 * drained composite base plate. Real-world proportions: 2.2 m tall, 18 x 12
 * cm column, 0.6 m plate. Local +Z points at the pool; the user stands on
 * the plate between the column and the water.
 */
const SIZE = {
  height: 2.2,
  column: [0.18, 0.12] as const,
  plate: 0.6,
  plateThickness: 0.035,
  armLength: 0.44,
  headRadius: 0.13,
} as const;

export function SolarShower({
  position,
  rotation,
  waterY,
}: {
  position: [number, number, number];
  rotation: number;
  waterY: number;
}) {
  const materials = useMemo(() => {
    const dry = (material: THREE.MeshStandardMaterial) => {
      material.onBeforeCompile = (shader) => excludeSubmergedDirectLights(shader, waterY);
      material.customProgramCacheKey = () => `deck-shower-dry-${waterY}`;
      return material;
    };
    return {
      column: dry(
        new THREE.MeshStandardMaterial({ color: "#2a2d2f", roughness: 0.42, metalness: 0.45 }),
      ),
      plate: dry(new THREE.MeshStandardMaterial({ color: "#6e665c", roughness: 0.8 })),
      slot: dry(new THREE.MeshStandardMaterial({ color: "#1d1e1f", roughness: 0.9 })),
    };
  }, [waterY]);
  useEffect(
    () => () => Object.values(materials).forEach((material) => material.dispose()),
    [materials],
  );
  const [columnWidth, columnDepth] = SIZE.column;
  const columnZ = -SIZE.plate / 2 + columnDepth / 2 + 0.03;
  const armY = SIZE.height - 0.05;
  return (
    <group name="deck-solar-shower" position={position} rotation={[0, rotation, 0]}>
      <mesh
        position={[0, SIZE.plateThickness / 2, 0]}
        material={materials.plate}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[SIZE.plate, SIZE.plateThickness, SIZE.plate]} />
      </mesh>
      {[-0.15, -0.05, 0.05, 0.15].map((z) => (
        <mesh
          key={z}
          position={[0, SIZE.plateThickness + 0.0005, z + 0.04]}
          material={materials.slot}
        >
          <boxGeometry args={[SIZE.plate - 0.1, 0.001, 0.012]} />
        </mesh>
      ))}
      <mesh
        position={[0, SIZE.height / 2, columnZ]}
        material={materials.column}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[columnWidth, SIZE.height, columnDepth]} />
      </mesh>
      {/* Satin stainless arm, rain head, mixer and foot tap. */}
      <mesh
        position={[0, armY, columnZ + columnDepth / 2 + SIZE.armLength / 2]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.012, 0.012, SIZE.armLength, 16]} />
        <StainlessSteelMaterial finish="satin" />
      </mesh>
      <mesh position={[0, armY - 0.02, columnZ + columnDepth / 2 + SIZE.armLength]} castShadow>
        <cylinderGeometry args={[SIZE.headRadius, SIZE.headRadius, 0.012, 40]} />
        <StainlessSteelMaterial finish="polished" />
      </mesh>
      <mesh position={[0, 1.12, columnZ + columnDepth / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.04, 24]} />
        <StainlessSteelMaterial finish="brushed" />
      </mesh>
      <mesh position={[0, 0.42, columnZ + columnDepth / 2 + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.1, 12]} />
        <StainlessSteelMaterial finish="satin" />
      </mesh>
    </group>
  );
}
