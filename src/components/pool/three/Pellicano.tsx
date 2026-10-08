import { useEffect, useMemo } from "react";
import * as THREE from "three";

/** Spout centre line in the local frame: x across the blade, y up from the
 * coping top, z inward over the water (0 = the water's edge). A post rises
 * from a base plate on the coping and arcs over the edge to a mouth that
 * points forward and slightly down, like the reference stainless blades. */
const SPOUT_PATH = [
  new THREE.Vector3(0, 0, -0.16),
  new THREE.Vector3(0, 0.38, -0.16),
  new THREE.Vector3(0, 0.6, -0.09),
  new THREE.Vector3(0, 0.63, 0.08),
  new THREE.Vector3(0, 0.53, 0.23),
];
/** Satin AISI 316: mid grey with soft highlights (not the white polished look). */
const SATIN_STAINLESS = { color: "#aeb2b6", metalness: 0.82, roughness: 0.3 } as const;
const BLADE = { width: 0.3, thickness: 0.022, sheetWidth: 0.27 } as const;

/**
 * Pellicano -- cascata a lama d'acqua. Stainless spout on the coping and a
 * continuous water sheet falling ballistically into the pool, with a quiet
 * splash ring where it lands. No glow, no particles. Hydraulics (pump,
 * connection) are a project item, not modelled.
 */
export function Pellicano({
  position,
  rotation,
  copingY,
  waterY,
}: {
  /** Water's edge, middle of the chosen side (x, z). */
  position: readonly [number, number];
  /** Y rotation turning local +z toward the water. */
  rotation: number;
  copingY: number;
  waterY: number;
}) {
  const spout = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(SPOUT_PATH, false, "centripetal");
    const shape = new THREE.Shape();
    const w = BLADE.width / 2,
      t = BLADE.thickness / 2;
    shape.moveTo(-t, -w);
    shape.lineTo(t, -w);
    shape.lineTo(t, w);
    shape.lineTo(-t, w);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      steps: 48,
      bevelEnabled: false,
      extrudePath: curve,
    });
  }, []);
  // The sheet leaves the mouth along the spout's end tangent and falls under
  // gravity to the water surface (a thin ribbon, slightly narrowing).
  const sheet = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(SPOUT_PATH, false, "centripetal");
    const mouth = curve.getPoint(1);
    const tangent = curve.getTangent(1).normalize();
    const speed = 1.15;
    const drop = mouth.y + (copingY - waterY);
    const tEnd = (tangent.y * speed + Math.sqrt((tangent.y * speed) ** 2 + 2 * 9.81 * drop)) / 9.81;
    const segments = 24;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const time = (tEnd * i) / segments;
      const y = mouth.y + tangent.y * speed * time - 0.5 * 9.81 * time * time;
      const z = mouth.z + tangent.z * speed * time;
      const half = (BLADE.sheetWidth / 2) * (1 - 0.12 * (i / segments));
      positions.push(-half, y, z, half, y, z);
      if (i < segments) {
        const k = i * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const landing = mouth.z + tangent.z * speed * tEnd;
    return { geometry, landing };
  }, [copingY, waterY]);
  useEffect(
    () => () => {
      spout.dispose();
      sheet.geometry.dispose();
    },
    [spout, sheet],
  );
  return (
    <group
      name="pellicano"
      position={[position[0], copingY, position[1]]}
      rotation={[0, rotation, 0]}
    >
      <mesh name="pellicano-base" position={[0, 0.006, -0.16]} castShadow receiveShadow>
        <boxGeometry args={[BLADE.width + 0.06, 0.012, 0.16]} />
        <meshStandardMaterial {...SATIN_STAINLESS} />
      </mesh>
      <mesh name="pellicano-spout" geometry={spout} castShadow receiveShadow>
        <meshStandardMaterial {...SATIN_STAINLESS} />
      </mesh>
      <mesh name="pellicano-water-sheet" geometry={sheet.geometry} renderOrder={3}>
        <meshPhysicalMaterial
          color="#e9f5f6"
          transparent
          opacity={0.5}
          roughness={0.08}
          metalness={0}
          clearcoat={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Where the sheet meets the pool: a soft foam patch and a faint ring. */}
      <group
        position={[0, waterY - copingY + 0.004, sheet.landing]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <mesh renderOrder={4}>
          <circleGeometry args={[0.16, 32]} />
          <meshBasicMaterial color="#f4fbfb" transparent opacity={0.32} depthWrite={false} />
        </mesh>
        <mesh renderOrder={4}>
          <ringGeometry args={[0.22, 0.36, 48]} />
          <meshBasicMaterial color="#f4fbfb" transparent opacity={0.12} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
