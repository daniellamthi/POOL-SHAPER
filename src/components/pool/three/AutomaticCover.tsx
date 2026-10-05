import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

/** Metres in the pool scene's world-space XZ plane. The footprint is the inner water opening. */
export interface AutomaticCoverPlan {
  status: "VALID" | "AUTO_ADJUSTED" | "UNAVAILABLE";
  enabled: boolean;
  position: "open" | "closed";
  footprint: { minX: number; maxX: number; minZ: number; maxZ: number };
  waterY: number;
  housingSide: "minX" | "maxX";
  /** World-space centre of the roller, outside the short X wall and its coping. */
  housingX: number;
  housingY: number;
  slatRun: number;
}

const END_CLEARANCE = 0.03;
const NOMINAL_SLAT_PITCH = 0.07;
const SLAT_GAP = 0.0025;
const SLAT_THICKNESS = 0.018;

function SlatMat({ plan }: { plan: AutomaticCoverPlan }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { minX, maxX, minZ, maxZ } = plan.footprint;
  const run = maxX - minX - END_CLEARANCE * 2;
  const width = maxZ - minZ - END_CLEARANCE * 2;
  const count = Math.max(1, Math.ceil(run / NOMINAL_SLAT_PITCH));
  const pitch = run / count;

  useLayoutEffect(() => {
    const instances = mesh.current;
    if (!instances) return;
    const transform = new THREE.Object3D();
    const colours = [new THREE.Color("#e8e7df"), new THREE.Color("#e3e3dc")];
    for (let index = 0; index < count; index += 1) {
      transform.position.set(
        minX + END_CLEARANCE + (index + 0.5) * pitch,
        plan.waterY + 0.022,
        (minZ + maxZ) / 2,
      );
      transform.updateMatrix();
      instances.setMatrixAt(index, transform.matrix);
      instances.setColorAt(index, colours[index % colours.length]!);
    }
    instances.instanceMatrix.needsUpdate = true;
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
    instances.computeBoundingSphere();
  }, [count, maxZ, minX, minZ, pitch, plan.waterY]);

  if (run <= 0 || width <= 0) return null;

  return (
    <group name="automatic-cover-closed-mat">
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} castShadow receiveShadow>
        <boxGeometry args={[Math.max(0.001, pitch - SLAT_GAP), SLAT_THICKNESS, width]} />
        <meshStandardMaterial color="white" roughness={0.48} metalness={0.04} />
      </instancedMesh>
      <mesh
        name="automatic-cover-leading-bar"
        position={[
          plan.housingSide === "minX" ? maxX - END_CLEARANCE - 0.009 : minX + END_CLEARANCE + 0.009,
          plan.waterY + 0.024,
          (minZ + maxZ) / 2,
        ]}
        castShadow
      >
        <boxGeometry args={[0.018, 0.024, width]} />
        <meshStandardMaterial color="#b9bcb7" roughness={0.4} metalness={0.42} />
      </mesh>
    </group>
  );
}

function RollerHousing({ plan }: { plan: AutomaticCoverPlan }) {
  const { minZ, maxZ } = plan.footprint;
  const span = maxZ - minZ;
  const backSign = plan.housingSide === "minX" ? -1 : 1;
  const rollRadius = plan.position === "open" ? 0.085 : 0.045;

  return (
    <group
      name="automatic-cover-roller-housing"
      position={[plan.housingX, plan.housingY, (minZ + maxZ) / 2]}
    >
      {/* The pool-facing side is open so the stored roll remains legible. */}
      <mesh position={[0, -0.10, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.27, 0.02, span + 0.15]} />
        <meshStandardMaterial color="#878f90" roughness={0.48} metalness={0.52} />
      </mesh>
      {plan.position === "closed" ? <mesh position={[0, 0.10, 0]} castShadow>
        <boxGeometry args={[0.27, 0.022, span + 0.15]} />
        <meshStandardMaterial color="#aeb5b3" roughness={0.38} metalness={0.56} />
      </mesh> : null}
      <mesh position={[backSign * 0.122, 0, 0]} castShadow>
        <boxGeometry args={[0.022, 0.2, span + 0.15]} />
        <meshStandardMaterial color="#8f9898" roughness={0.42} metalness={0.5} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 0, side * (span / 2 + 0.063)]} castShadow>
          <boxGeometry args={[0.27, 0.2, 0.022]} />
          <meshStandardMaterial color="#818b8b" roughness={0.48} metalness={0.46} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[rollRadius, rollRadius, span + 0.1, 32]} />
        <meshStandardMaterial color="#d9dad3" roughness={0.58} metalness={0.08} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, span + 0.14, 12]} />
        <meshStandardMaterial color="#737d7e" roughness={0.34} metalness={0.7} />
      </mesh>
    </group>
  );
}

/** A physically sized surface mat and a short-side storage roller; no textures or shader samplers. */
export function AutomaticCover({ plan }: { plan: AutomaticCoverPlan }) {
  if (!plan.enabled || plan.status === "UNAVAILABLE") return null;
  if (plan.footprint.maxX <= plan.footprint.minX || plan.footprint.maxZ <= plan.footprint.minZ)
    return null;

  return (
    <group name="automatic-cover">
      {plan.position === "closed" ? <SlatMat plan={plan} /> : null}
      <RollerHousing plan={plan} />
    </group>
  );
}
