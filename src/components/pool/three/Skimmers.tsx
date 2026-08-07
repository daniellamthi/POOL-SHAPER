import type { SkimmerPlan } from "@/lib/pool/engineering";

/**
 * Wall-mounted skimmer faceplates, placed on the water line following the
 * computed plan (one every 25 m², never in a corner).
 */
export function Skimmers({
  plan,
  copingThickness,
}: {
  plan: SkimmerPlan;
  copingThickness: number;
}) {
  return (
    <group>
      {plan.positions.map((spot, index) => (
        <group
          key={index}
          position={[spot.x, -0.17 + copingThickness, spot.z]}
          rotation={[0, spot.rotation, 0]}
        >
          {/* Recessed throat behind the face frame. */}
          <mesh position={[0, 0.018, 0.012]} receiveShadow>
            <boxGeometry args={[0.6, 0.15, 0.035]} />
            <meshStandardMaterial color="#171b1c" roughness={0.92} metalness={0} />
          </mesh>

          {/* Wide white frame matching a residential skimmer faceplate. */}
          <mesh position={[0, 0.12, 0.045]} castShadow>
            <boxGeometry args={[0.7, 0.055, 0.045]} />
            <meshPhysicalMaterial color="#f2f2ee" roughness={0.3} clearcoat={0.22} />
          </mesh>
          <mesh position={[0, -0.085, 0.045]} castShadow>
            <boxGeometry args={[0.7, 0.055, 0.045]} />
            <meshPhysicalMaterial color="#f2f2ee" roughness={0.3} clearcoat={0.22} />
          </mesh>
          <mesh position={[-0.323, 0.017, 0.045]} castShadow>
            <boxGeometry args={[0.055, 0.15, 0.045]} />
            <meshPhysicalMaterial color="#f2f2ee" roughness={0.3} clearcoat={0.22} />
          </mesh>
          <mesh position={[0.323, 0.017, 0.045]} castShadow>
            <boxGeometry args={[0.055, 0.15, 0.045]} />
            <meshPhysicalMaterial color="#f2f2ee" roughness={0.3} clearcoat={0.22} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
