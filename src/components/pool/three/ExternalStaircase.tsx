import { useEffect, useMemo } from "react";
import type { Outline } from "@/lib/pool/types";
import { createContactAOGradientMap } from "./textures";

interface ExternalStaircaseProps {
  outline: Outline;
  groundY: number;
  topY: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function ExternalStaircase({ outline, groundY, topY }: ExternalStaircaseProps) {
  const layout = useMemo(() => {
    const centre = outline.reduce(
      (sum, [x, z]) => [sum[0] + x / outline.length, sum[1] + z / outline.length] as const,
      [0, 0] as const,
    );
    let longest: {
      length: number;
      midpoint: readonly [number, number];
      outward: readonly [number, number];
      tangent: readonly [number, number];
    } = { length: 0, midpoint: [0, 0], outward: [0, 1], tangent: [1, 0] };
    for (let index = 0; index < outline.length; index++) {
      const start = outline[index]!;
      const end = outline[(index + 1) % outline.length]!;
      const dx = end[0] - start[0];
      const dz = end[1] - start[1];
      const length = Math.hypot(dx, dz);
      if (length <= longest.length) continue;
      const midpoint: readonly [number, number] = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      const firstNormal: readonly [number, number] = [-dz / length, dx / length];
      const pointsOutward =
        firstNormal[0] * (midpoint[0] - centre[0]) + firstNormal[1] * (midpoint[1] - centre[1]) > 0;
      longest = {
        length,
        midpoint,
        outward: pointsOutward ? firstNormal : [-firstNormal[0], -firstNormal[1]],
        tangent:
          dx > 0 || (Math.abs(dx) < 1e-9 && dz > 0)
            ? [dx / length, dz / length]
            : [-dx / length, -dz / length],
      };
    }
    const height = Math.max(0.6, topY - groundY);
    const stepCount = clamp(Math.ceil(height / 0.2), 3, 10);
    const rise = height / stepCount;
    const treadDepth = clamp(height * 0.19, 0.27, 0.34);
    const width = 0.96;
    const endOffset = longest.length / 2;
    return {
      ...longest,
      midpoint: [
        longest.midpoint[0] + longest.tangent[0] * endOffset,
        longest.midpoint[1] + longest.tangent[1] * endOffset,
      ] as const,
      height,
      stepCount,
      rise,
      treadDepth,
      width,
      rotation: Math.atan2(-longest.tangent[0], -longest.tangent[1]),
    };
  }, [groundY, outline, topY]);

  const railHeight = 0.88;
  const lowestZ = (layout.stepCount - 0.5) * layout.treadDepth;
  const highestZ = 0.5 * layout.treadDepth;
  const lowerRailY = groundY + layout.rise + railHeight;
  const upperRailY = topY + railHeight;
  const railLength = Math.hypot(upperRailY - lowerRailY, highestZ - lowestZ);
  const railAngle = Math.atan2(highestZ - lowestZ, upperRailY - lowerRailY);

  const contactAOMap = useMemo(() => createContactAOGradientMap(), []);
  useEffect(() => () => contactAOMap.dispose(), [contactAOMap]);

  return (
    <group
      position={[
        layout.midpoint[0] + layout.outward[0] * (layout.width / 2 + 0.03),
        0,
        layout.midpoint[1] + layout.outward[1] * (layout.width / 2 + 0.03),
      ]}
      rotation={[0, layout.rotation, 0]}
    >
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
        return (
          <group key={level}>
            <mesh position={[0, groundY + blockHeight / 2, z]} castShadow receiveShadow>
              <boxGeometry args={[layout.width, blockHeight, layout.treadDepth]} />
              <meshStandardMaterial color="#f1f2f2" roughness={0.48} metalness={0.02} />
            </mesh>
            <mesh position={[0, groundY + blockHeight + 0.018, z]} castShadow receiveShadow>
              <boxGeometry args={[layout.width + 0.04, 0.036, layout.treadDepth + 0.025]} />
              <meshStandardMaterial color="#34383c" roughness={0.34} metalness={0.08} />
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
                <meshStandardMaterial color="#c8ced1" roughness={0.2} metalness={0.9} />
              </mesh>
            );
          })}
          <mesh
            position={[0, (lowerRailY + upperRailY) / 2, (lowestZ + highestZ) / 2]}
            rotation={[railAngle, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.018, 0.018, railLength, 10]} />
            <meshStandardMaterial color="#c8ced1" roughness={0.18} metalness={0.92} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
