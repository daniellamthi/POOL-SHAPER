import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { StainlessSteelMaterial } from "./StainlessSteelMaterial";

/** Metres in the pool scene's world-space XZ plane. The footprint is the inner water opening. */
export interface AutomaticCoverPlan {
  status: "VALID" | "AUTO_ADJUSTED" | "UNAVAILABLE";
  enabled: boolean;
  position: "open" | "closed";
  /** Progressive deployment, 0 = stored on the roller .. 1 = fully closed.
   * Absent on legacy plans: derived from `position`. */
  extension?: number;
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
/** Travel of the slat mat, as a fraction of the full run per second. Fast
 * enough to follow the slider live, slow enough that a jump from the
 * "Aperta"/"Chiusa" presets still reads as the mat unrolling. */
const TRAVEL_RATE = 0.55;
const ROLL_RADIUS_OPEN = 0.085;
const ROLL_RADIUS_CLOSED = 0.045;

function targetExtension(plan: AutomaticCoverPlan) {
  if (typeof plan.extension === "number" && Number.isFinite(plan.extension))
    return Math.min(1, Math.max(0, plan.extension));
  return plan.position === "closed" ? 1 : 0;
}

/** The deployed part of the mat: slats are laid from the roller outward and
 * only the first `count * progress` are drawn, so the leading edge and the
 * stored roll always agree on how much mat is out. */
function SlatMat({
  plan,
  progress,
}: {
  plan: AutomaticCoverPlan;
  progress: React.RefObject<number>;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const bar = useRef<THREE.Mesh>(null);
  const { minX, maxX, minZ, maxZ } = plan.footprint;
  const run = maxX - minX - END_CLEARANCE * 2;
  const width = maxZ - minZ - END_CLEARANCE * 2;
  const count = Math.max(1, Math.ceil(run / NOMINAL_SLAT_PITCH));
  const pitch = run / count;
  const fromMinX = plan.housingSide === "minX";
  const start = fromMinX ? minX + END_CLEARANCE : maxX - END_CLEARANCE;
  const direction = fromMinX ? 1 : -1;

  useLayoutEffect(() => {
    const instances = mesh.current;
    if (!instances) return;
    const transform = new THREE.Object3D();
    const colours = [new THREE.Color("#e8e7df"), new THREE.Color("#e3e3dc")];
    for (let index = 0; index < count; index += 1) {
      transform.position.set(
        start + direction * (index + 0.5) * pitch,
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
  }, [count, maxZ, minZ, pitch, plan.waterY, start, direction]);

  useFrame(() => {
    const instances = mesh.current;
    if (!instances) return;
    const deployed = Math.round(count * progress.current);
    instances.count = deployed;
    instances.visible = deployed > 0;
    if (bar.current) {
      bar.current.visible = deployed > 0;
      bar.current.position.x = start + direction * (deployed * pitch + 0.009);
    }
  });

  if (run <= 0 || width <= 0) return null;

  return (
    <group name="automatic-cover-closed-mat">
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} castShadow receiveShadow>
        <boxGeometry args={[Math.max(0.001, pitch - SLAT_GAP), SLAT_THICKNESS, width]} />
        <meshStandardMaterial color="white" roughness={0.48} metalness={0.04} />
      </instancedMesh>
      <mesh
        ref={bar}
        name="automatic-cover-leading-bar"
        position={[start + direction * 0.009, plan.waterY + 0.024, (minZ + maxZ) / 2]}
        castShadow
      >
        <boxGeometry args={[0.018, 0.024, width]} />
        <StainlessSteelMaterial finish="brushed" brushRotation={Math.PI / 2} />
      </mesh>
    </group>
  );
}

function RollerHousing({
  plan,
  progress,
}: {
  plan: AutomaticCoverPlan;
  progress: React.RefObject<number>;
}) {
  const { minZ, maxZ } = plan.footprint;
  const span = maxZ - minZ;
  const backSign = plan.housingSide === "minX" ? -1 : 1;
  const roll = useRef<THREE.Mesh>(null);
  const lid = useRef<THREE.Mesh>(null);

  // The stored roll shrinks as the mat is paid out; the lid only closes the
  // housing once most of the mat is on the water and the roll sits low.
  useFrame(() => {
    const radius = THREE.MathUtils.lerp(ROLL_RADIUS_OPEN, ROLL_RADIUS_CLOSED, progress.current);
    if (roll.current)
      roll.current.scale.set(radius / ROLL_RADIUS_OPEN, 1, radius / ROLL_RADIUS_OPEN);
    if (lid.current) lid.current.visible = progress.current > 0.5;
  });

  return (
    <group
      name="automatic-cover-roller-housing"
      position={[plan.housingX, plan.housingY, (minZ + maxZ) / 2]}
    >
      {/* The pool-facing side is open so the stored roll remains legible. */}
      <mesh position={[0, -0.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.27, 0.02, span + 0.15]} />
        <StainlessSteelMaterial finish="brushed" color="#aeb4b7" />
      </mesh>
      <mesh ref={lid} position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.27, 0.022, span + 0.15]} />
        <StainlessSteelMaterial finish="satin" />
      </mesh>
      <mesh position={[backSign * 0.122, 0, 0]} castShadow>
        <boxGeometry args={[0.022, 0.2, span + 0.15]} />
        <StainlessSteelMaterial finish="brushed" color="#b6bcbf" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 0, side * (span / 2 + 0.063)]} castShadow>
          <boxGeometry args={[0.27, 0.2, 0.022]} />
          <StainlessSteelMaterial finish="brushed" color="#aeb4b7" />
        </mesh>
      ))}
      <mesh ref={roll} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[ROLL_RADIUS_OPEN, ROLL_RADIUS_OPEN, span + 0.1, 32]} />
        <meshStandardMaterial color="#d9dad3" roughness={0.58} metalness={0.08} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, span + 0.14, 12]} />
        <StainlessSteelMaterial finish="polished" />
      </mesh>
    </group>
  );
}

/** A physically sized surface mat and a short-side storage roller; no textures or shader samplers.
 * The mat deploys progressively: the plan's `extension` is the target, and the
 * scene eases toward it every frame so slider drags and the open/closed
 * presets both read as the cover actually travelling. */
export function AutomaticCover({ plan }: { plan: AutomaticCoverPlan }) {
  const progress = useRef(targetExtension(plan));
  useFrame(({ scene }, delta) => {
    const target = targetExtension(plan);
    const current = progress.current;
    if (current === target) return;
    const step = TRAVEL_RATE * Math.min(delta, 0.1);
    progress.current =
      target > current ? Math.min(target, current + step) : Math.max(target, current - step);
    // The sun's shadow map is cached between React commits; the moving mat
    // must refresh it or its shadow stays where the mat was.
    scene.traverse((object) => {
      if (object instanceof THREE.DirectionalLight && object.castShadow)
        object.shadow.needsUpdate = true;
    });
  });
  if (!plan.enabled || plan.status === "UNAVAILABLE") return null;
  if (plan.footprint.maxX <= plan.footprint.minX || plan.footprint.maxZ <= plan.footprint.minZ)
    return null;

  return (
    <group name="automatic-cover">
      <SlatMat plan={plan} progress={progress} />
      <RollerHousing plan={plan} progress={progress} />
    </group>
  );
}
