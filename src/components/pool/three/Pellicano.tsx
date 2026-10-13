import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { StainlessSteelMaterial } from "./StainlessSteelMaterial";

/** Spout centre line in the local frame: x across the blade, y up from the
 * coping top, z inward over the water (0 = the water's edge). A post rises
 * from a base plate on the coping and arcs over the edge to a mouth that
 * points forward and slightly down, like the reference stainless blades. */
const SPOUT_PATH = Array.from({length:33},(_,i) => {
  const angle=(230-185*i/32)*Math.PI/180;
  return new THREE.Vector3(0,0.375+0.46*Math.sin(angle),0.12+0.4*Math.cos(angle));
});
const BLADE = { width: 0.44, thickness: 0.045, sheetWidth: 0.4 } as const;

export function pellicanoCurve() { return new THREE.CatmullRomCurve3(SPOUT_PATH,false,"centripetal"); }
export function createPellicanoSpoutGeometry() {
  const shape=new THREE.Shape(),w=BLADE.width/2,t=BLADE.thickness/2;
  // The Frenet normal is transverse X: width and thickness were previously
  // swapped, producing a narrow post rather than a broad curved blade.
  shape.moveTo(-w,-t);shape.lineTo(w,-t);shape.lineTo(w,t);shape.lineTo(-w,t);shape.closePath();
  return new THREE.ExtrudeGeometry(shape,{steps:64,bevelEnabled:false,extrudePath:pellicanoCurve()});
}

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
  const spout = useMemo(createPellicanoSpoutGeometry, []);
  // The sheet leaves the mouth along the spout's end tangent and falls under
  // gravity to the water surface (a thin ribbon, slightly narrowing).
  const sheet = useMemo(() => {
    const curve = pellicanoCurve();
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
  useEffect(() => () => spout.dispose(),[spout]);
  useEffect(() => () => sheet.geometry.dispose(),[sheet]);
  return (
    <group
      name="pellicano"
      position={[position[0], copingY, position[1]]}
      rotation={[0, rotation, 0]}
    >
      <mesh name="pellicano-base" position={[0, 0.008, SPOUT_PATH[0]!.z]} castShadow receiveShadow>
        <boxGeometry args={[BLADE.width + 0.06, 0.016, 0.12]} />
        <StainlessSteelMaterial finish="polished" />
      </mesh>
      <mesh name="pellicano-spout" geometry={spout} castShadow receiveShadow>
        <StainlessSteelMaterial finish="polished" />
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
