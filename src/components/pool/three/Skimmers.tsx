import { RoundedBox } from "@react-three/drei";
import type { SkimmerPlan } from "@/lib/pool/engineering";

const FRAME_COLOR = "#f5f5f1";
const THROAT_COLOR = "#101516";

function SkimmerAssembly() {
  return (
    <group>
      {/* The housing sits behind the finished wall, creating a believable
          recess instead of a flat black rectangle. */}
      <RoundedBox
        args={[0.61, 0.195, 0.12]}
        radius={0.025}
        smoothness={3}
        position={[0, 0.012, -0.02]}
      >
        <meshStandardMaterial color="#202627" roughness={0.86} metalness={0.02} />
      </RoundedBox>

      {/* Water continues into the throat, as it does in a working skimmer. */}
      <mesh position={[0, -0.038, 0.005]} renderOrder={3}>
        <boxGeometry args={[0.535, 0.008, 0.115]} />
        <meshPhysicalMaterial
          color="#78c9d1"
          transparent
          opacity={0.58}
          roughness={0.1}
          transmission={0.52}
          ior={1.33}
          clearcoat={0.7}
          clearcoatRoughness={0.12}
          depthWrite={false}
        />
      </mesh>

      <RoundedBox
        args={[0.57, 0.135, 0.018]}
        radius={0.018}
        smoothness={3}
        position={[0, 0.016, 0.052]}
        receiveShadow
      >
        <meshStandardMaterial color={THROAT_COLOR} roughness={0.72} metalness={0.04} />
      </RoundedBox>

      {/* Four-piece faceplate preserves a real opening while the rounded
          edges catch the studio light like moulded ABS. */}
      <RoundedBox
        args={[0.72, 0.052, 0.052]}
        radius={0.018}
        smoothness={3}
        position={[0, 0.12, 0.071]}
        castShadow
      >
        <meshPhysicalMaterial
          color={FRAME_COLOR}
          roughness={0.24}
          clearcoat={0.38}
          clearcoatRoughness={0.22}
        />
      </RoundedBox>
      <RoundedBox
        args={[0.72, 0.052, 0.052]}
        radius={0.018}
        smoothness={3}
        position={[0, -0.088, 0.071]}
        castShadow
      >
        <meshPhysicalMaterial
          color={FRAME_COLOR}
          roughness={0.24}
          clearcoat={0.38}
          clearcoatRoughness={0.22}
        />
      </RoundedBox>
      <RoundedBox
        args={[0.052, 0.16, 0.052]}
        radius={0.017}
        smoothness={3}
        position={[-0.334, 0.016, 0.071]}
        castShadow
      >
        <meshPhysicalMaterial
          color={FRAME_COLOR}
          roughness={0.24}
          clearcoat={0.38}
          clearcoatRoughness={0.22}
        />
      </RoundedBox>
      <RoundedBox
        args={[0.052, 0.16, 0.052]}
        radius={0.017}
        smoothness={3}
        position={[0.334, 0.016, 0.071]}
        castShadow
      >
        <meshPhysicalMaterial
          color={FRAME_COLOR}
          roughness={0.24}
          clearcoat={0.38}
          clearcoatRoughness={0.22}
        />
      </RoundedBox>

      {/* A slightly inclined floating weir makes the opening readable in the
          close-up while remaining below the water line. */}
      <mesh position={[0, -0.022, 0.064]} rotation={[0.08, 0, 0]} castShadow>
        <boxGeometry args={[0.51, 0.055, 0.014]} />
        <meshPhysicalMaterial color="#e7e9e6" roughness={0.32} clearcoat={0.22} />
      </mesh>

      {[-0.304, 0.304].map((x) =>
        [-0.058, 0.09].map((y) => (
          <mesh key={`${x}-${y}`} position={[x, y, 0.101]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.007, 0.007, 0.006, 12]} />
            <meshStandardMaterial color="#aeb2b0" roughness={0.42} metalness={0.5} />
          </mesh>
        )),
      )}
    </group>
  );
}

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
          <SkimmerAssembly />
        </group>
      ))}
    </group>
  );
}
