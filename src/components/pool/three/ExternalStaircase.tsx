import { useEffect, useMemo } from "react";
import type { Outline } from "@/lib/pool/types";
import { COPING_WIDTH } from "@/lib/pool/config";
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
      centre,
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

  // `outline` is the pool's wall outline; the coping band extends
  // COPING_WIDTH beyond it (see PoolModel's `offsetOutline(outline,
  // COPING_WIDTH)`). The staircase sits right at the wall's end, where the
  // coping's mitred corner bulges slightly past that straight-edge offset --
  // a small extra clearance keeps the staircase clear of that corner too,
  // without reading as a gap at real scale.
  const CORNER_MITRE_CLEARANCE = 0.05;
  const copingClearance = COPING_WIDTH + CORNER_MITRE_CLEARANCE;
  const groupPosition: readonly [number, number, number] = [
    layout.midpoint[0] + layout.outward[0] * (layout.width / 2 + copingClearance),
    0,
    layout.midpoint[1] + layout.outward[1] * (layout.width / 2 + copingClearance),
  ];
  // The staircase sits at the end of its wall (see `endOffset` above), so
  // one of its two rails can land past the corner, next to (or over) the
  // adjacent wall -- an "inner" rail that reads as entering the pool. Keep
  // only whichever rail is actually farther from the pool's own centre,
  // i.e. genuinely external, for any wall/corner this ends up on.
  const cosRotation = Math.cos(layout.rotation);
  const sinRotation = Math.sin(layout.rotation);
  const railSides = [-1, 1] as const;
  const externalSide = railSides.reduce((farthest, side) => {
    const localX = side * layout.width * 0.49;
    const worldX = groupPosition[0] + localX * cosRotation;
    const worldZ = groupPosition[2] - localX * sinRotation;
    const distance = Math.hypot(worldX - layout.centre[0], worldZ - layout.centre[1]);
    const farthestLocalX = farthest * layout.width * 0.49;
    const farthestWorldX = groupPosition[0] + farthestLocalX * cosRotation;
    const farthestWorldZ = groupPosition[2] - farthestLocalX * sinRotation;
    const farthestDistance = Math.hypot(
      farthestWorldX - layout.centre[0],
      farthestWorldZ - layout.centre[1],
    );
    return distance > farthestDistance ? side : farthest;
  }, railSides[0]);

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

      {[externalSide].map((side) => (
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
