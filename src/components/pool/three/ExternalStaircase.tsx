import { StainlessSteelMaterial } from "./StainlessSteelMaterial";
import { useEffect, useMemo } from "react";
import { planExternalStaircase, type ExternalStaircaseProps } from "./externalStaircasePlan";
import { createContactAOGradientMap } from "./textures";
import { CladdingMaterial } from "./AboveGroundCladding";
import { loadCopingTextureMaps } from "./stoneTextures";
import { DEFAULT_EXTERIOR_PANEL_FINISH, type ExteriorPanelFinishId } from "@/lib/pool/above-ground";

/** Tread slab thickness and its front nosing, metres. */
const TREAD = { thickness: 0.03, nosing: 0.02 } as const;

/**
 * Above-ground external access: a solid stepped block standing against the
 * pool, its sides and risers clad in the pool's own exterior panels, every
 * tread a stone/gres slab in the coping finish, the top tread flush with the
 * coping as the landing. A slim satin stainless handrail runs on both sides.
 * Removed entirely (block, treads, rails) when the option is off.
 */
export function ExternalStaircase({
  outline,
  groundY,
  topY,
  copingOffset,
  infinityExcluded = null,
  finish = DEFAULT_EXTERIOR_PANEL_FINISH,
  tread,
}: ExternalStaircaseProps & {
  finish?: ExteriorPanelFinishId;
  /** Coping finish for the treads: a colour and, when the coping is a
   * scanned asset, its maps directory. */
  tread: { color: string; roughness: number; assetDir: string | null };
}) {
  const treadMaps = useMemo(
    () => (tread.assetDir ? loadCopingTextureMaps(tread.assetDir) : null),
    [tread.assetDir],
  );
  useEffect(
    () => () => {
      if (treadMaps) Object.values(treadMaps).forEach((map) => map?.dispose());
    },
    [treadMaps],
  );
  const layout = useMemo(
    () => planExternalStaircase({ outline, groundY, topY, copingOffset, infinityExcluded }),
    [groundY, outline, topY, copingOffset, infinityExcluded],
  );
  const contactAOMap = useMemo(() => createContactAOGradientMap(), []);
  useEffect(() => () => contactAOMap.dispose(), [contactAOMap]);
  if (!layout || layout.height <= 0) return null;
  const groupPosition: [number, number, number] = [layout.x, 0, layout.z];

  const railHeight = 0.88;
  const lowestZ = (layout.stepCount - 0.5) * layout.treadDepth;
  const highestZ = 0.5 * layout.treadDepth;
  const lowerRailY = groundY + layout.rise + railHeight;
  const upperRailY = topY + railHeight;
  const railLength = Math.hypot(upperRailY - lowerRailY, highestZ - lowestZ);
  const railAngle = Math.atan2(highestZ - lowestZ, upperRailY - lowerRailY);

  return (
    <group name="external-staircase" position={groupPosition} rotation={[0, layout.rotation, 0]}>
      {/* Soft ground contact shadow under the whole footprint: the global,
          heavily-blurred pool ContactShadows bake is sized for the pool
          itself and reads too faint at this small a footprint to anchor it
          visually to the ground. */}
      <mesh
        name="contact-ao-decal"
        position={[0, groundY + 0.003, (layout.stepCount * layout.treadDepth) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1}
      >
        <planeGeometry args={[layout.width * 1.2, layout.stepCount * layout.treadDepth * 1.15]} />
        <meshBasicMaterial map={contactAOMap} transparent depthWrite={false} />
      </mesh>

      {Array.from({ length: layout.stepCount }, (_, index) => {
        const level = index + 1;
        // Block top sits one tread below the step level, so the top tread
        // lands exactly at the coping: a flush landing, never a lip above it.
        const blockHeight = layout.rise * level - TREAD.thickness;
        const z = (layout.stepCount - index - 0.5) * layout.treadDepth;
        return (
          <group key={level}>
            <mesh position={[0, groundY + blockHeight / 2, z]} castShadow receiveShadow>
              <boxGeometry args={[layout.width, blockHeight, layout.treadDepth]} />
              <CladdingMaterial finish={finish} />
            </mesh>
            <mesh
              position={[
                0,
                groundY + blockHeight + TREAD.thickness / 2,
                z + (level === layout.stepCount ? 0 : TREAD.nosing / 2),
              ]}
              castShadow
              receiveShadow
            >
              <boxGeometry
                args={[
                  layout.width + 0.02,
                  TREAD.thickness,
                  layout.treadDepth + (level === layout.stepCount ? 0 : TREAD.nosing),
                ]}
              />
              {treadMaps ? (
                <meshStandardMaterial
                  color="#ffffff"
                  map={treadMaps.colorMap}
                  normalMap={treadMaps.normalMap}
                  roughnessMap={treadMaps.roughnessMap}
                  roughness={treadMaps.roughnessMap ? 1 : tread.roughness}
                  metalness={0}
                />
              ) : (
                <meshStandardMaterial
                  color={tread.color}
                  roughness={tread.roughness}
                  metalness={0}
                />
              )}
            </mesh>
          </group>
        );
      })}

      {[-1, 1].map((side) => (
        <group key={side} position={[side * layout.width * 0.49, 0, 0]}>
          {[0, Math.floor((layout.stepCount - 1) / 2), layout.stepCount - 1].map((index) => {
            const stepY = groundY + layout.rise * (index + 1);
            const z = (layout.stepCount - index - 0.5) * layout.treadDepth;
            return (
              <mesh key={index} position={[0, stepY + railHeight / 2, z]} castShadow>
                <cylinderGeometry args={[0.016, 0.016, railHeight, 10]} />
                <StainlessSteelMaterial finish="brushed" />
              </mesh>
            );
          })}
          <mesh
            position={[0, (lowerRailY + upperRailY) / 2, (lowestZ + highestZ) / 2]}
            rotation={[railAngle, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.018, 0.018, railLength, 10]} />
            <StainlessSteelMaterial finish="brushed" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
