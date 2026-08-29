import { useEffect, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { SkimmerPlan } from "@/lib/pool/engineering";
import { MATERIAL_MICRO_DETAIL_PRESET } from "@/configurator/materials/visual-presets";
import {
  createContactAOGradientMap,
  createMaterialMicroNormalMap,
  createMaterialMicroRoughnessMap,
} from "./textures";
import { WaterSurfaceMaterial } from "./WaterSurfaceMaterial";

const FRAME_COLOR = "#f5f5f1";
const CAVITY_COLOR = "#202829";
const SKIMMER_FRONT_SCALE: readonly [number, number, number] = [0.975, 0.25 / 0.195, 1];
const WATERLINE_PIVOT_Y = -0.004;

const frameMaterial = (normalMap: THREE.Texture, roughnessMap: THREE.Texture) => (
  <meshPhysicalMaterial
    color={FRAME_COLOR}
    roughness={0.3}
    normalMap={normalMap}
    normalScale={[
      MATERIAL_MICRO_DETAIL_PRESET.skimmer.normalStrength,
      MATERIAL_MICRO_DETAIL_PRESET.skimmer.normalStrength,
    ]}
    roughnessMap={roughnessMap}
    clearcoat={0.24}
    clearcoatRoughness={0.3}
  />
);

function SkimmerAssembly({
  normalMap,
  roughnessMap,
  contactAOMap,
}: {
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  contactAOMap: THREE.Texture;
}) {
  return (
    <group
      scale={SKIMMER_FRONT_SCALE}
      position={[0, WATERLINE_PIVOT_Y * (1 - SKIMMER_FRONT_SCALE[1]), 0]}
    >
      {/* Soft contact shadow where the frame meets the wall liner: a
          vertical wall-mounted fitting like this sits outside the pool's
          global (ground-plane) ContactShadows helper, so without this it
          reads as pasted onto the wall rather than seated in a cut opening. */}
      <mesh name="contact-ao-decal" position={[0, 0.017, 0.001]} renderOrder={1}>
        <planeGeometry args={[0.62, 0.27]} />
        <meshBasicMaterial map={contactAOMap} transparent depthWrite={false} />
      </mesh>

      {/* Recessed housing: its depth extends into the wall, behind the face frame. */}
      <RoundedBox
        args={[0.41, 0.145, 0.18]}
        radius={0.018}
        smoothness={3}
        position={[0, 0.017, -0.08]}
      >
        <meshStandardMaterial color={CAVITY_COLOR} roughness={0.9} metalness={0} />
      </RoundedBox>

      {/* White throat panels make the opening read as a real inset channel. */}
      <mesh position={[-0.192, 0.017, -0.066]}>
        <boxGeometry args={[0.016, 0.115, 0.15]} />
        <meshStandardMaterial color="#e9ebe8" roughness={0.58} />
      </mesh>
      <mesh position={[0.192, 0.017, -0.066]}>
        <boxGeometry args={[0.016, 0.115, 0.15]} />
        <meshStandardMaterial color="#e9ebe8" roughness={0.58} />
      </mesh>
      <mesh position={[0, 0.069, -0.066]}>
        <boxGeometry args={[0.4, 0.014, 0.15]} />
        <meshStandardMaterial color="#e9ebe8" roughness={0.58} />
      </mesh>
      <mesh position={[0, -0.035, -0.066]}>
        <boxGeometry args={[0.4, 0.014, 0.15]} />
        <meshStandardMaterial color="#eef0ed" roughness={0.5} />
      </mesh>

      {/* The water tongue continues naturally into the lower part of the mouth. */}
      <mesh position={[0, -0.004, -0.064]} renderOrder={3}>
        <boxGeometry args={[0.368, 0.004, 0.155]} />
        <WaterSurfaceMaterial />
      </mesh>

      {/* Geometric 48 × 19.5 cm face frame with a raised inner profile. */}
      <mesh position={[0, 0.092, 0.018]} castShadow>
        <boxGeometry args={[0.48, 0.045, 0.035]} />
        {frameMaterial(normalMap, roughnessMap)}
      </mesh>
      <mesh position={[0, -0.058, 0.018]} castShadow>
        <boxGeometry args={[0.48, 0.045, 0.035]} />
        {frameMaterial(normalMap, roughnessMap)}
      </mesh>
      <mesh position={[-0.215, 0.017, 0.018]} castShadow>
        <boxGeometry args={[0.05, 0.115, 0.035]} />
        {frameMaterial(normalMap, roughnessMap)}
      </mesh>
      <mesh position={[0.215, 0.017, 0.018]} castShadow>
        <boxGeometry args={[0.05, 0.115, 0.035]} />
        {frameMaterial(normalMap, roughnessMap)}
      </mesh>

      <mesh position={[0, 0.066, 0.039]} castShadow>
        <boxGeometry args={[0.378, 0.01, 0.008]} />
        {frameMaterial(normalMap, roughnessMap)}
      </mesh>
      <mesh position={[0, -0.032, 0.039]} castShadow>
        <boxGeometry args={[0.378, 0.01, 0.008]} />
        {frameMaterial(normalMap, roughnessMap)}
      </mesh>
      <mesh position={[-0.184, 0.017, 0.039]} castShadow>
        <boxGeometry args={[0.01, 0.108, 0.008]} />
        {frameMaterial(normalMap, roughnessMap)}
      </mesh>
      <mesh position={[0.184, 0.017, 0.039]} castShadow>
        <boxGeometry args={[0.01, 0.108, 0.008]} />
        {frameMaterial(normalMap, roughnessMap)}
      </mesh>
    </group>
  );
}

export function Skimmers({
  plan,
  wallTopY,
}: {
  plan: SkimmerPlan;
  copingThickness: number;
  wallTopY: number;
}) {
  const normalMap = useMemo(() => {
    const texture = createMaterialMicroNormalMap();
    texture.repeat.set(...MATERIAL_MICRO_DETAIL_PRESET.skimmer.repeat);
    return texture;
  }, []);
  const roughnessMap = useMemo(() => {
    const texture = createMaterialMicroRoughnessMap();
    texture.repeat.set(...MATERIAL_MICRO_DETAIL_PRESET.skimmer.repeat);
    return texture;
  }, []);
  const contactAOMap = useMemo(() => createContactAOGradientMap(), []);
  useEffect(
    () => () => {
      normalMap.dispose();
      roughnessMap.dispose();
      contactAOMap.dispose();
    },
    [normalMap, roughnessMap, contactAOMap],
  );
  return (
    <group>
      {plan.positions.map((spot, index) => (
        <group
          key={index}
          position={[spot.x, wallTopY - 0.16, spot.z]}
          rotation={[0, spot.rotation, 0]}
        >
          <SkimmerAssembly
            normalMap={normalMap}
            roughnessMap={roughnessMap}
            contactAOMap={contactAOMap}
          />
        </group>
      ))}
    </group>
  );
}
