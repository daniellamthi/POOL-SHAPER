import { useMemo } from "react";
import type { Outline } from "@/lib/pool/types";
import { getWallReference } from "@/lib/pool/wallReference";

interface PoolLadderProps {
  outline: Outline;
  wallTopY: number;
  copingY: number;
  floorY: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const STEEL = { color: "#d7dadb", roughness: 0.2, metalness: 0.92 } as const;

/** Classic stainless-steel pool ladder: two straight rails with a short
 * over-the-coping hook at the top and evenly spaced rungs below, hooked
 * onto the same wall Internal Stairs would otherwise use -- only one Pool
 * Access fixture is ever mounted at a time. */
export function PoolLadder({ outline, wallTopY, copingY, floorY }: PoolLadderProps) {
  const layout = useMemo(() => {
    const reference = getWallReference(outline, "shortest");
    const railSpacing = clamp(reference.length * 0.32, 0.42, 0.55);
    const bottomY = Math.max(floorY + 0.12, wallTopY - Math.min(1.15, (wallTopY - floorY) * 0.7));
    const topY = copingY + 0.55;
    const hookLength = 0.16;
    const rungCount = clamp(Math.round((wallTopY - bottomY) / 0.28), 2, 5);
    const angle = Math.atan2(reference.inward[0], reference.inward[1]);
    return { reference, railSpacing, bottomY, topY, hookLength, rungCount, angle };
  }, [outline, wallTopY, copingY, floorY]);

  const railOffsets = [-1, 1] as const;
  // Rails sit right against the wall, inset just enough to clear the coping
  // face; the hook bends back outward over the top of it.
  const railInset = 0.05;
  const railX = layout.reference.point[0] + layout.reference.inward[0] * railInset;
  const railZ = layout.reference.point[1] + layout.reference.inward[1] * railInset;
  const straightHeight = layout.topY - layout.hookLength - layout.bottomY;

  return (
    <group position={[railX, 0, railZ]} rotation={[0, layout.angle, 0]}>
      {railOffsets.map((side) => (
        <group key={side} position={[side * layout.railSpacing * 0.5, 0, 0]}>
          {/* Straight vertical rail */}
          <mesh position={[0, layout.bottomY + straightHeight / 2, 0]} castShadow>
            <cylinderGeometry args={[0.019, 0.019, straightHeight, 12]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          {/* Rounded cap over the coping edge, hooking outward for a hand grip */}
          <mesh
            position={[0, layout.topY - layout.hookLength * 0.35, layout.hookLength * 0.55]}
            rotation={[Math.PI / 2.6, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.019, 0.019, layout.hookLength * 1.3, 12]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        </group>
      ))}
      {/* Rungs, evenly spaced below the coping */}
      {Array.from({ length: layout.rungCount }, (_, index) => {
        const t = layout.rungCount === 1 ? 0.5 : index / (layout.rungCount - 1);
        const y = layout.bottomY + 0.12 + t * (wallTopY - layout.bottomY - 0.24);
        return (
          <mesh key={index} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.017, 0.017, layout.railSpacing, 12]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        );
      })}
    </group>
  );
}
