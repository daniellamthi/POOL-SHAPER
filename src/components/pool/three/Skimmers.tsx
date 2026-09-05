import { useEffect, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { SkimmerPlan } from "@/lib/pool/engineering";
import type { PoolType, SkimmerTypeId } from "@/lib/pool/types";
import { ABOVE_GROUND_STRUCTURE_THICKNESS } from "@/lib/pool/vertical-layout";
import { MATERIAL_MICRO_DETAIL_PRESET } from "@/configurator/materials/visual-presets";
import {
  createContactAOGradientMap,
  createMaterialMicroNormalMap,
  createMaterialMicroRoughnessMap,
} from "./textures";
import { WaterSurfaceMaterial } from "./WaterSurfaceMaterial";

const CAVITY_COLOR = "#202829";
const THROAT_LIGHT = "#e9ebe8";
const THROAT_LIGHT_ALT = "#eef0ed";
/** Dark reveal line used by the Architectural Flush variant's shadow-gap
 * groove -- distinct from `CAVITY_COLOR` (which reads as an open cavity)
 * because this one must read as a shallow cut line, not a hole. */
const SHADOW_GAP_COLOR = "#14181a";
const SKIMMER_FRONT_SCALE: readonly [number, number, number] = [0.975, 0.25 / 0.195, 1];
const WATERLINE_PIVOT_Y = -0.004;

/**
 * Every skimmer in the plan shares the same color/roughness/maps (both are
 * plain props on `Skimmers`, not per-position), and each assembly reuses
 * the frame material across every mesh in the housing. Building one
 * `THREE.MeshPhysicalMaterial` in `Skimmers` and attaching it via
 * `<primitive>` everywhere -- instead of a JSX-per-usage helper that made
 * React/R3F construct a fresh material object at each spot for every skimmer
 * instance -- turns `positions.length * meshCount` material allocations
 * into 1, with identical visual output.
 */
function createFrameMaterial(
  color: string,
  roughness: number,
  metalness: number,
  normalMap: THREE.Texture,
  roughnessMap: THREE.Texture,
): THREE.MeshPhysicalMaterial {
  // Brushed stainless (metalness > 0.5) has no lacquer coat and a higher IOR
  // than the moulded-ABS finishes -- a clearcoat over bare metal would read
  // as a plastic-coated fake chrome, which the directive explicitly rules out.
  const isMetal = metalness > 0.5;
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    normalMap,
    roughnessMap,
    clearcoat: isMetal ? 0 : 0.55,
    clearcoatRoughness: 0.1,
    ior: isMetal ? 2.5 : 1.45,
  });
  material.normalScale.set(
    MATERIAL_MICRO_DETAIL_PRESET.skimmer.normalStrength,
    MATERIAL_MICRO_DETAIL_PRESET.skimmer.normalStrength,
  );
  return material;
}

interface AssemblyProps {
  frameMaterial: THREE.MeshPhysicalMaterial;
  contactAOMap: THREE.Texture;
  /** Real wall thickness at the skimmer's opening, so the hidden cavity
   * housing can be kept from poking through a thin (above-ground) panel
   * without touching the visible frame's own position or size. */
  wallThickness: number;
}

/** Clamps a recess housing's back face so it never breaks through a thin
 * (above-ground) exterior wall -- shared by every variant's cavity. */
function clampedCavityBackZ(fullBackZ: number, wallThickness: number, exteriorClearance: number) {
  return Math.max(fullBackZ, -(wallThickness - exteriorClearance));
}

// ---------------------------------------------------------------------------
// STANDARD REFINED -- the original moulded face frame: raised bevelled
// profile, deep recessed housing, classic 48 x 19.5 cm proportions. Kept
// numerically unchanged from the previously shipped/validated geometry.
// ---------------------------------------------------------------------------

const STD_CAVITY_FRONT_Z = 0.01;
const STD_CAVITY_FULL_BACK_Z = -0.17;
const STD_CAVITY_EXTERIOR_CLEARANCE = 0.01;

function StandardSkimmerAssembly({ frameMaterial, contactAOMap, wallThickness }: AssemblyProps) {
  const cavityBackZ = clampedCavityBackZ(
    STD_CAVITY_FULL_BACK_Z,
    wallThickness,
    STD_CAVITY_EXTERIOR_CLEARANCE,
  );
  const cavityDepth = STD_CAVITY_FRONT_Z - cavityBackZ;
  const cavityCenterZ = (STD_CAVITY_FRONT_Z + cavityBackZ) / 2;
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
        <meshStandardMaterial color={THROAT_LIGHT} roughness={0.58} />
      </mesh>
      <mesh position={[0.192, 0.017, -0.066]}>
        <boxGeometry args={[0.016, 0.115, 0.15]} />
        <meshStandardMaterial color={THROAT_LIGHT} roughness={0.58} />
      </mesh>
      <mesh position={[0, 0.069, -0.066]}>
        <boxGeometry args={[0.4, 0.014, 0.15]} />
        <meshStandardMaterial color={THROAT_LIGHT} roughness={0.58} />
      </mesh>
      <mesh position={[0, -0.035, -0.066]}>
        <boxGeometry args={[0.4, 0.014, 0.15]} />
        <meshStandardMaterial color={THROAT_LIGHT_ALT} roughness={0.5} />
      </mesh>

      {/* The water tongue continues naturally into the lower part of the mouth. */}
      <mesh position={[0, -0.004, -0.064]} renderOrder={3}>
        <boxGeometry args={[0.368, 0.004, 0.155]} />
        <WaterSurfaceMaterial />
      </mesh>

      {/* Geometric 48 x 19.5 cm face frame with a raised inner profile.
          A slight bevel (RoundedBox, low smoothness -- cheap geometry)
          replaces the flat box edges so the frame catches highlights like
          real moulded plastic instead of reading as a toy block. */}
      <RoundedBox
        args={[0.48, 0.045, 0.035]}
        radius={0.006}
        smoothness={2}
        position={[0, 0.092, 0.018]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>
      <RoundedBox
        args={[0.48, 0.045, 0.035]}
        radius={0.006}
        smoothness={2}
        position={[0, -0.058, 0.018]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>
      <RoundedBox
        args={[0.05, 0.115, 0.035]}
        radius={0.006}
        smoothness={2}
        position={[-0.215, 0.017, 0.018]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>
      <RoundedBox
        args={[0.05, 0.115, 0.035]}
        radius={0.006}
        smoothness={2}
        position={[0.215, 0.017, 0.018]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>

      <mesh position={[0, 0.066, 0.039]} castShadow>
        <boxGeometry args={[0.378, 0.01, 0.008]} />
        <primitive object={frameMaterial} attach="material" />
      </mesh>
      <mesh position={[0, -0.032, 0.039]} castShadow>
        <boxGeometry args={[0.378, 0.01, 0.008]} />
        <primitive object={frameMaterial} attach="material" />
      </mesh>
      <mesh position={[-0.184, 0.017, 0.039]} castShadow>
        <boxGeometry args={[0.01, 0.108, 0.008]} />
        <primitive object={frameMaterial} attach="material" />
      </mesh>
      <mesh position={[0.184, 0.017, 0.039]} castShadow>
        <boxGeometry args={[0.01, 0.108, 0.008]} />
        <primitive object={frameMaterial} attach="material" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// SLIM / MODERN -- thin low-profile bars (less than half the Standard bar
// thickness/width), a crisper near-flat bevel, and a shallower housing so the
// frame stands only a third as proud of the wall. Larger throat-to-frame
// ratio reads as a wider "glass-like" opening. Authored directly in final
// metres (no inner scale wrapper -- the Standard variant's 0.195->0.25
// native-to-final scale trick doesn't generalise to a different native
// height, so new variants size themselves for real).
// ---------------------------------------------------------------------------

function SlimSkimmerAssembly({ frameMaterial, contactAOMap, wallThickness }: AssemblyProps) {
  const faceWidth = 0.46;
  const faceHeight = 0.22;
  const barThickness = 0.022;
  const barWidth = 0.028;
  const vc = 0.019; // local vertical centre, same proportion as Standard's 0.017/0.195
  const topBarY = vc + faceHeight / 2 - barThickness / 2;
  const bottomBarY = vc - faceHeight / 2 + barThickness / 2;
  const throatHeight = faceHeight - 2 * barThickness;
  const throatWidth = faceWidth - 2 * barWidth;
  const sideBarX = faceWidth / 2 - barWidth / 2;
  const sideBarHeight = throatHeight + 0.008;
  const frameDepth = 0.018; // roughly half of Standard's 0.035 -- low-profile
  const frameZ = 0.011;
  const cavityBackZ = clampedCavityBackZ(-0.15, wallThickness, 0.01);
  const cavityFrontZ = 0.006;
  const cavityDepth = cavityFrontZ - cavityBackZ;
  const cavityCenterZ = (cavityFrontZ + cavityBackZ) / 2;

  return (
    <group>
      <mesh name="contact-ao-decal" position={[0, vc, 0.001]} renderOrder={1}>
        <planeGeometry args={[0.6, 0.3]} />
        <meshBasicMaterial map={contactAOMap} transparent depthWrite={false} />
      </mesh>

      <RoundedBox
        args={[throatWidth + 0.024, throatHeight + 0.03, cavityDepth]}
        radius={0.014}
        smoothness={3}
        position={[0, vc, cavityCenterZ]}
      >
        <meshStandardMaterial color={CAVITY_COLOR} roughness={0.9} metalness={0} />
      </RoundedBox>

      {/* Thin throat lining -- the modern opening reads mostly as glass/void,
          so panels are narrower than Standard's, letting the throat dominate. */}
      <mesh position={[-(throatWidth / 2 + 0.005), vc, -0.06]}>
        <boxGeometry args={[0.01, sideBarHeight, 0.14]} />
        <meshStandardMaterial color={THROAT_LIGHT} roughness={0.5} />
      </mesh>
      <mesh position={[throatWidth / 2 + 0.005, vc, -0.06]}>
        <boxGeometry args={[0.01, sideBarHeight, 0.14]} />
        <meshStandardMaterial color={THROAT_LIGHT} roughness={0.5} />
      </mesh>
      <mesh position={[0, topBarY - barThickness / 2 - 0.005, -0.06]}>
        <boxGeometry args={[throatWidth, 0.01, 0.14]} />
        <meshStandardMaterial color={THROAT_LIGHT} roughness={0.5} />
      </mesh>
      <mesh position={[0, bottomBarY + barThickness / 2 + 0.005, -0.06]}>
        <boxGeometry args={[throatWidth, 0.01, 0.14]} />
        <meshStandardMaterial color={THROAT_LIGHT_ALT} roughness={0.42} />
      </mesh>

      <mesh position={[0, vc - 0.004, -0.058]} renderOrder={3}>
        <boxGeometry args={[throatWidth - 0.01, 0.004, 0.145]} />
        <WaterSurfaceMaterial />
      </mesh>

      {/* Thin, crisp-edged bars (small bevel radius) -- the "modern" reveal
          is the wide glass-like throat, not a moulded raised profile. */}
      <RoundedBox
        args={[faceWidth, barThickness, frameDepth]}
        radius={0.003}
        smoothness={2}
        position={[0, topBarY, frameZ]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>
      <RoundedBox
        args={[faceWidth, barThickness, frameDepth]}
        radius={0.003}
        smoothness={2}
        position={[0, bottomBarY, frameZ]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>
      <RoundedBox
        args={[barWidth, sideBarHeight, frameDepth]}
        radius={0.003}
        smoothness={2}
        position={[-sideBarX, vc, frameZ]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>
      <RoundedBox
        args={[barWidth, sideBarHeight, frameDepth]}
        radius={0.003}
        smoothness={2}
        position={[sideBarX, vc, frameZ]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>
    </group>
  );
}

// ---------------------------------------------------------------------------
// HIGH-WATERLINE -- a short housing (well under half Standard's face height)
// set high against the coping, with the water plane pushed to the very top
// of the throat instead of its middle: the visible "dry" mouth area shrinks
// to a thin strip below the waterline, reading as a near-brimming pool.
// ---------------------------------------------------------------------------

function HighWaterlineSkimmerAssembly({
  frameMaterial,
  contactAOMap,
  wallThickness,
}: AssemblyProps) {
  const faceWidth = 0.46;
  const faceHeight = 0.14;
  const barThickness = 0.028;
  const barWidth = 0.03;
  const vc = 0.012;
  const topBarY = vc + faceHeight / 2 - barThickness / 2;
  const bottomBarY = vc - faceHeight / 2 + barThickness / 2;
  const throatHeight = faceHeight - 2 * barThickness;
  const throatWidth = faceWidth - 2 * barWidth;
  const sideBarX = faceWidth / 2 - barWidth / 2;
  const sideBarHeight = throatHeight + 0.008;
  const frameDepth = 0.03;
  const frameZ = 0.017;
  const cavityBackZ = clampedCavityBackZ(-0.14, wallThickness, 0.01);
  const cavityFrontZ = 0.008;
  const cavityDepth = cavityFrontZ - cavityBackZ;
  const cavityCenterZ = (cavityFrontZ + cavityBackZ) / 2;
  // Waterline sits just under the top bar -- most of the short throat is
  // submerged, unlike Standard/Slim where the tongue sits near mid-throat.
  const waterlineY = topBarY - barThickness / 2 - 0.012;

  return (
    <group>
      <mesh name="contact-ao-decal" position={[0, vc, 0.001]} renderOrder={1}>
        <planeGeometry args={[0.58, 0.2]} />
        <meshBasicMaterial map={contactAOMap} transparent depthWrite={false} />
      </mesh>

      <RoundedBox
        args={[throatWidth + 0.02, throatHeight + 0.025, cavityDepth]}
        radius={0.014}
        smoothness={3}
        position={[0, vc, cavityCenterZ]}
      >
        <meshStandardMaterial color={CAVITY_COLOR} roughness={0.9} metalness={0} />
      </RoundedBox>

      <mesh position={[-(throatWidth / 2 + 0.006), vc, -0.055]}>
        <boxGeometry args={[0.012, sideBarHeight, 0.13]} />
        <meshStandardMaterial color={THROAT_LIGHT} roughness={0.58} />
      </mesh>
      <mesh position={[throatWidth / 2 + 0.006, vc, -0.055]}>
        <boxGeometry args={[0.012, sideBarHeight, 0.13]} />
        <meshStandardMaterial color={THROAT_LIGHT} roughness={0.58} />
      </mesh>
      {/* Only a thin dry lip above the waterline -- most of the opening
          below it is the submerged water plane. */}
      <mesh position={[0, topBarY - barThickness / 2 - 0.005, -0.055]}>
        <boxGeometry args={[throatWidth, 0.01, 0.13]} />
        <meshStandardMaterial color={THROAT_LIGHT} roughness={0.58} />
      </mesh>
      <mesh position={[0, bottomBarY + barThickness / 2 + 0.005, -0.055]}>
        <boxGeometry args={[throatWidth, 0.01, 0.13]} />
        <meshStandardMaterial color={THROAT_LIGHT_ALT} roughness={0.5} />
      </mesh>

      <mesh position={[0, waterlineY, -0.052]} renderOrder={3}>
        <boxGeometry args={[throatWidth - 0.008, throatHeight * 0.7, 0.135]} />
        <WaterSurfaceMaterial />
      </mesh>

      <RoundedBox
        args={[faceWidth, barThickness, frameDepth]}
        radius={0.005}
        smoothness={2}
        position={[0, topBarY, frameZ]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>
      <RoundedBox
        args={[faceWidth, barThickness, frameDepth]}
        radius={0.005}
        smoothness={2}
        position={[0, bottomBarY, frameZ]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>
      <RoundedBox
        args={[barWidth, sideBarHeight, frameDepth]}
        radius={0.005}
        smoothness={2}
        position={[-sideBarX, vc, frameZ]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>
      <RoundedBox
        args={[barWidth, sideBarHeight, frameDepth]}
        radius={0.005}
        smoothness={2}
        position={[sideBarX, vc, frameZ]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>
    </group>
  );
}

// ---------------------------------------------------------------------------
// ARCHITECTURAL FLUSH -- no raised frame at all: a near-flush plate (frame
// standing only ~2mm proud, vs Standard's 3.5cm) with a fine dark shadow-gap
// groove cut into the wall just outside it. The groove -- not a bevel -- is
// what gives the opening a defined edge, per the directive's "shadow gaps"
// requirement. Housing is a shallow slot, not a deep moulded box, since a
// flush product doesn't need the same clearance.
// ---------------------------------------------------------------------------

function FlushSkimmerAssembly({ frameMaterial, contactAOMap, wallThickness }: AssemblyProps) {
  const faceWidth = 0.46;
  const faceHeight = 0.2;
  const barThickness = 0.014;
  const barWidth = 0.016;
  const vc = 0.017;
  const topBarY = vc + faceHeight / 2 - barThickness / 2;
  const bottomBarY = vc - faceHeight / 2 + barThickness / 2;
  const throatHeight = faceHeight - 2 * barThickness;
  const throatWidth = faceWidth - 2 * barWidth;
  const sideBarX = faceWidth / 2 - barWidth / 2;
  const sideBarHeight = throatHeight + 0.006;
  const frameDepth = 0.008; // near-flush -- a fraction of Standard's 0.035
  const frameZ = 0.005;
  const cavityBackZ = clampedCavityBackZ(-0.09, wallThickness, 0.01);
  const cavityFrontZ = 0.004;
  const cavityDepth = cavityFrontZ - cavityBackZ;
  const cavityCenterZ = (cavityFrontZ + cavityBackZ) / 2;
  // Shadow-gap groove: a thin dark reveal line just outside the flush bars,
  // recessed slightly behind their front face -- the detail that reads as
  // "cut into the wall" rather than "clipping through it".
  const grooveInset = 0.012;
  const grooveWidth = 0.006;
  const grooveZ = frameZ - frameDepth / 2 - 0.002;

  return (
    <group>
      <mesh name="contact-ao-decal" position={[0, vc, 0.001]} renderOrder={1}>
        <planeGeometry args={[0.58, 0.28]} />
        <meshBasicMaterial map={contactAOMap} transparent depthWrite={false} />
      </mesh>

      <RoundedBox
        args={[throatWidth + 0.016, throatHeight + 0.02, cavityDepth]}
        radius={0.01}
        smoothness={3}
        position={[0, vc, cavityCenterZ]}
      >
        <meshStandardMaterial color={CAVITY_COLOR} roughness={0.9} metalness={0} />
      </RoundedBox>

      <mesh position={[-(throatWidth / 2 + 0.004), vc, -0.05]}>
        <boxGeometry args={[0.008, sideBarHeight, 0.12]} />
        <meshStandardMaterial color={THROAT_LIGHT} roughness={0.5} />
      </mesh>
      <mesh position={[throatWidth / 2 + 0.004, vc, -0.05]}>
        <boxGeometry args={[0.008, sideBarHeight, 0.12]} />
        <meshStandardMaterial color={THROAT_LIGHT} roughness={0.5} />
      </mesh>
      <mesh position={[0, topBarY - barThickness / 2 - 0.004, -0.05]}>
        <boxGeometry args={[throatWidth, 0.008, 0.12]} />
        <meshStandardMaterial color={THROAT_LIGHT} roughness={0.5} />
      </mesh>
      <mesh position={[0, bottomBarY + barThickness / 2 + 0.004, -0.05]}>
        <boxGeometry args={[throatWidth, 0.008, 0.12]} />
        <meshStandardMaterial color={THROAT_LIGHT_ALT} roughness={0.42} />
      </mesh>

      <mesh position={[0, vc - 0.003, -0.048]} renderOrder={3}>
        <boxGeometry args={[throatWidth - 0.008, 0.004, 0.125]} />
        <WaterSurfaceMaterial />
      </mesh>

      {/* Near-flush bars -- almost no protrusion, sharp edge (minimal bevel). */}
      <RoundedBox
        args={[faceWidth, barThickness, frameDepth]}
        radius={0.0015}
        smoothness={2}
        position={[0, topBarY, frameZ]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>
      <RoundedBox
        args={[faceWidth, barThickness, frameDepth]}
        radius={0.0015}
        smoothness={2}
        position={[0, bottomBarY, frameZ]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>
      <RoundedBox
        args={[barWidth, sideBarHeight, frameDepth]}
        radius={0.0015}
        smoothness={2}
        position={[-sideBarX, vc, frameZ]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>
      <RoundedBox
        args={[barWidth, sideBarHeight, frameDepth]}
        radius={0.0015}
        smoothness={2}
        position={[sideBarX, vc, frameZ]}
        castShadow
      >
        <primitive object={frameMaterial} attach="material" />
      </RoundedBox>

      {/* Shadow-gap groove ring -- a fine dark line just outside the flush
          plate, recessed a couple of millimetres behind it. */}
      <mesh position={[0, topBarY + barThickness / 2 + grooveInset / 2, grooveZ]}>
        <boxGeometry args={[faceWidth + grooveInset, grooveWidth, 0.006]} />
        <meshStandardMaterial color={SHADOW_GAP_COLOR} roughness={0.85} />
      </mesh>
      <mesh position={[0, bottomBarY - barThickness / 2 - grooveInset / 2, grooveZ]}>
        <boxGeometry args={[faceWidth + grooveInset, grooveWidth, 0.006]} />
        <meshStandardMaterial color={SHADOW_GAP_COLOR} roughness={0.85} />
      </mesh>
      <mesh position={[-(sideBarX + barWidth / 2 + grooveInset / 2), vc, grooveZ]}>
        <boxGeometry args={[grooveWidth, faceHeight + grooveInset, 0.006]} />
        <meshStandardMaterial color={SHADOW_GAP_COLOR} roughness={0.85} />
      </mesh>
      <mesh position={[sideBarX + barWidth / 2 + grooveInset / 2, vc, grooveZ]}>
        <boxGeometry args={[grooveWidth, faceHeight + grooveInset, 0.006]} />
        <meshStandardMaterial color={SHADOW_GAP_COLOR} roughness={0.85} />
      </mesh>
    </group>
  );
}

function SkimmerAssembly({
  variant,
  ...assemblyProps
}: AssemblyProps & { variant: SkimmerTypeId }) {
  switch (variant) {
    case "slim":
      return <SlimSkimmerAssembly {...assemblyProps} />;
    case "highWaterline":
      return <HighWaterlineSkimmerAssembly {...assemblyProps} />;
    case "flush":
      return <FlushSkimmerAssembly {...assemblyProps} />;
    case "standard":
    default:
      return <StandardSkimmerAssembly {...assemblyProps} />;
  }
}

export function Skimmers({
  plan,
  wallTopY,
  color,
  roughness,
  metalness,
  variant,
  poolType,
}: {
  plan: SkimmerPlan;
  copingThickness: number;
  wallTopY: number;
  /** Face-frame finish -- see `materials.skimmer` (src/lib/pool/materials.ts),
   * driven by the "Finitura skimmer" selector. */
  color: string;
  roughness: number;
  metalness: number;
  /** Housing family -- see `materials.skimmer.type`, driven by the "Tipo
   * skimmer" selector. Real geometry differences, not a colour reskin. */
  variant: SkimmerTypeId;
  poolType: PoolType;
}) {
  // In-ground walls are structural concrete, thick enough that the cavity
  // housing was already fully hidden -- only the thinner above-ground
  // panel needs its depth clamped (see `wallThickness` on each assembly).
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
  // Shared across every skimmer position and every frame surface within
  // each one -- see `createFrameMaterial`'s doc comment.
  const frameMaterial = useMemo(
    () => createFrameMaterial(color, roughness, metalness, normalMap, roughnessMap),
    [color, roughness, metalness, normalMap, roughnessMap],
  );
  // Each variant places its own waterline differently against the coping --
  // High-Waterline sits much closer to it than Standard/Slim/Flush.
  const verticalDrop = variant === "highWaterline" ? 0.09 : variant === "flush" ? 0.15 : 0.16;
  useEffect(
    () => () => {
      normalMap.dispose();
      roughnessMap.dispose();
      contactAOMap.dispose();
    },
    [normalMap, roughnessMap, contactAOMap],
  );
  useEffect(() => () => frameMaterial.dispose(), [frameMaterial]);
  return (
    <group>
      {plan.positions.map((spot, index) => (
        <group
          key={index}
          position={[spot.x, wallTopY - verticalDrop, spot.z]}
          rotation={[0, spot.rotation, 0]}
        >
          <SkimmerAssembly
            variant={variant}
            frameMaterial={frameMaterial}
            contactAOMap={contactAOMap}
            wallThickness={wallThickness}
          />
        </group>
      ))}
    </group>
  );
}
