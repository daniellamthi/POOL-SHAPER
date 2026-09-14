import { useMemo } from "react";
import type { Outline } from "@/lib/pool/types";
import { getWallReference } from "@/lib/pool/wallReference";

interface InternalStairsProps {
  outline: Outline;
  wallTopY: number;
  floorY: number;
  color: string;
  roughness: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/** Integrated concrete entry steps built into the basin itself, at the
 * shortest wall (the skimmer/overflow front wall, by convention the
 * longest one, stays clear). Steps descend inward from the wall top down
 * toward the floor, finished in the same tone as the selected interior
 * liner so they read as part of the pool rather than an add-on fixture. */
export function InternalStairs({ outline, wallTopY, floorY, color, roughness }: InternalStairsProps) {
  const layout = useMemo(() => {
    const reference = getWallReference(outline, "shortest");
    const height = Math.max(0.3, wallTopY - floorY);
    const stepCount = clamp(Math.ceil(height / 0.26), 3, 8);
    const rise = height / stepCount;
    const treadDepth = clamp(height * 0.22, 0.28, 0.36);
    const width = clamp(reference.length * 0.55, 1.0, 1.8);
    const angle = Math.atan2(reference.inward[0], reference.inward[1]);
    return { reference, height, stepCount, rise, treadDepth, width, angle };
  }, [outline, wallTopY, floorY]);

  return (
    <group>
      {Array.from({ length: layout.stepCount }, (_, index) => {
        const level = index + 1;
        const blockHeight = layout.rise * level;
        const insetDistance = (index + 0.5) * layout.treadDepth;
        const cx = layout.reference.point[0] + layout.reference.inward[0] * insetDistance;
        const cz = layout.reference.point[1] + layout.reference.inward[1] * insetDistance;
        return (
          <mesh
            key={level}
            position={[cx, wallTopY - blockHeight / 2, cz]}
            rotation={[0, layout.angle, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[layout.width, blockHeight, layout.treadDepth]} />
            <meshStandardMaterial color={color} roughness={Math.max(0.55, roughness)} metalness={0} />
          </mesh>
        );
      })}
    </group>
  );
}
