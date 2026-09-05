import { useEffect, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { SkimmerPlan } from "@/lib/pool/engineering";
import type { PoolType } from "@/lib/pool/types";
import { ABOVE_GROUND_STRUCTURE_THICKNESS } from "@/lib/pool/vertical-layout";
import { MATERIAL_MICRO_DETAIL_PRESET } from "@/configurator/materials/visual-presets";
import {
  createContactAOGradientMap,
  createMaterialMicroNormalMap,
  createMaterialMicroRoughnessMap,
} from "./textures";
import { WaterSurfaceMaterial } from "./WaterSurfaceMaterial";

const CAVITY_COLOR = "#202829";
const SKIMMER_FRONT_SCALE: readonly [number, number, number] = [0.975, 0.25 / 0.195, 1];
const WATERLINE_PIVOT_Y = -0.004;

const frameMaterial = (
  color: string,
  roughness: number,
  normalMap: THREE.Texture,
  roughnessMap: THREE.Texture,
) => (
  <meshPhysicalMaterial
    color={color}
    roughness={roughness}
    normalMap={normalMap}
    normalScale={[
      MATERIAL_MICRO_DETAIL_PRESET.skimmer.normalStrength,
      MATERIAL_MICRO_DETAIL_PRESET.skimmer.normalStrength,
    ]}
    roughnessMap={roughnessMap}
    clearcoat={0.55}
    clearcoatRoughness={0.1}
    ior={1.45}
  />
);

// Recessed housing geometry (unclamped): its depth runs behind the face
// frame, into the wall. Fine for a thick in-ground wall, but an
// above-ground panel is thinner than that -- see `cavityBackZ` below.
const CAVITY_FRONT_Z = 0.01;
const CAVITY_FULL_BACK_Z = -0.17;
/** Clearance kept short of the exterior wall face so the cavity's back cap
 * never breaks through it (the bug this guards against: that cap reading
 * as a black rectangle floating outside an above-ground panel). */
const CAVITY_EXTERIOR_CLEARANCE = 0.01;

function SkimmerAssembly({
  color,
  roughness,
  normalMap,
  roughnessMap,
  contactAOMap,
  wallThickness,
}: {
  color: string;
  roughness: number;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  contactAOMap: THREE.Texture;
  /** Real wall thickness at the skimmer's opening, so the hidden cavity
   * housing can be kept from poking through a thin (above-ground) panel
   * without touching the visible frame's own position or size. */
  wallThickness: number;
}) {
  const cavityBackZ = Math.max(CAVITY_FULL_BACK_Z, -(wallThickness - CAVITY_EXTERIOR_CLEARANCE));
  const cavityDepth = CAVITY_FRONT_Z - cavityBackZ;
  const cavityCenterZ = (CAVITY_FRONT_Z + cavityBackZ) / 2;
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

      {/* Recessed housing: its depth extends into the wall, behind the face
          frame, clamped to `wallThickness` so it can't poke through a thin
          (above-ground) panel and appear outside the pool. */}
      <RoundedBox
        args={[0.41, 0.145, cavityDepth]}
        radius={0.018}
        smoothness={3}
        position={[0, 0.017, cavityCenterZ]}
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

      {/* Geometric 48 × 19.5 cm face frame with a raised inner profile.
          A slight bevel (RoundedBox, low smoothness -- cheap geometry)
          replaces the flat box edges so the frame catches highlights like
          real moulded plastic instead of reading as a toy block. */}
      <RoundedBox args={[0.48, 0.045, 0.035]} radius={0.006} smoothness={2} position={[0, 0.092, 0.018]} castShadow>
        {frameMaterial(color, roughness, normalMap, roughnessMap)}
      </RoundedBox>
      <RoundedBox args={[0.48, 0.045, 0.035]} radius={0.006} smoothness={2} position={[0, -0.058, 0.018]} castShadow>
        {frameMaterial(color, roughness, normalMap, roughnessMap)}
      </RoundedBox>
      <RoundedBox args={[0.05, 0.115, 0.035]} radius={0.006} smoothness={2} position={[-0.215, 0.017, 0.018]} castShadow>
        {frameMaterial(color, roughness, normalMap, roughnessMap)}
      </RoundedBox>
      <RoundedBox args={[0.05, 0.115, 0.035]} radius={0.006} smoothness={2} position={[0.215, 0.017, 0.018]} castShadow>
        {frameMaterial(color, roughness, normalMap, roughnessMap)}
      </RoundedBox>

      <mesh position={[0, 0.066, 0.039]} castShadow>
        <boxGeometry args={[0.378, 0.01, 0.008]} />
        {frameMaterial(color, roughness, normalMap, roughnessMap)}
      </mesh>
      <mesh position={[0, -0.032, 0.039]} castShadow>
        <boxGeometry args={[0.378, 0.01, 0.008]} />
        {frameMaterial(color, roughness, normalMap, roughnessMap)}
      </mesh>
      <mesh position={[-0.184, 0.017, 0.039]} castShadow>
        <boxGeometry args={[0.01, 0.108, 0.008]} />
        {frameMaterial(color, roughness, normalMap, roughnessMap)}
      </mesh>
      <mesh position={[0.184, 0.017, 0.039]} castShadow>
        <boxGeometry args={[0.01, 0.108, 0.008]} />
        {frameMaterial(color, roughness, normalMap, roughnessMap)}
      </mesh>
    </group>
  );
}

export function Skimmers({
  plan,
  wallTopY,
  color,
  roughness,
  poolType,
}: {
  plan: SkimmerPlan;
  copingThickness: number;
  wallTopY: number;
  /** Face-frame finish -- see `materials.skimmer` (src/lib/pool/materials.ts),
   * driven by the "Finitura skimmer" selector. */
  color: string;
  roughness: number;
  poolType: PoolType;
}) {
  // In-ground walls are structural concrete, thick enough that the cavity
  // housing was already fully hidden -- only the thinner above-ground
  // panel needs its depth clamped (see `wallThickness` on SkimmerAssembly).
  const wallThickness = poolType === "above-ground" ? ABOVE_GROUND_STRUCTURE_THICKNESS : 1;
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
            color={color}
            roughness={roughness}
            normalMap={normalMap}
            roughnessMap={roughnessMap}
            contactAOMap={contactAOMap}
            wallThickness={wallThickness}
          />
        </group>
      ))}
    </group>
  );
}
