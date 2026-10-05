import { StainlessSteelMaterial } from "./StainlessSteelMaterial";
import { useEffect, useMemo } from "react";
import { planExternalStaircase, type ExternalStaircaseProps } from "./externalStaircasePlan";
import { createContactAOGradientMap } from "./textures";

export function ExternalStaircase({
  outline,
  groundY,
  topY,
  copingOffset,
  infinityExcluded = null,
}: ExternalStaircaseProps) {
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
    <group position={groupPosition} rotation={[0, layout.rotation, 0]}>
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
        const blockHeight = layout.rise * level;
        const z = (layout.stepCount - index - 0.5) * layout.treadDepth;
        // The top step's own riser top already sits exactly at `topY` (its
        // block height is defined as the full `height`), so it's already
        // flush with the pool's top edge -- the proud nosing cap every other
        // tread gets would push *this* one above that edge instead of
        // landing flush with it, so the top step skips it.
        const isTopStep = level === layout.stepCount;
        return (
          <group key={level}>
            <mesh position={[0, groundY + blockHeight / 2, z]} castShadow receiveShadow>
              <boxGeometry args={[layout.width, blockHeight, layout.treadDepth]} />
              <meshStandardMaterial color="#f1f2f2" roughness={0.48} metalness={0.02} />
            </mesh>
            {!isTopStep ? (
              <mesh position={[0, groundY + blockHeight + 0.018, z]} castShadow receiveShadow>
                <boxGeometry args={[layout.width + 0.04, 0.036, layout.treadDepth + 0.025]} />
                <meshStandardMaterial color="#34383c" roughness={0.34} metalness={0.08} />
              </mesh>
            ) : null}
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
                <StainlessSteelMaterial finish="polished" />
              </mesh>
            );
          })}
          <mesh
            position={[0, (lowerRailY + upperRailY) / 2, (lowestZ + highestZ) / 2]}
            rotation={[railAngle, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.018, 0.018, railLength, 10]} />
            <StainlessSteelMaterial finish="polished" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
