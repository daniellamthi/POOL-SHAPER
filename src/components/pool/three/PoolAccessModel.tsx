import { useMemo, type ReactNode } from "react";
import * as THREE from "three";
import type { Outline, PoolAccess } from "@/lib/pool/types";

/** Select a wall with enough clear interior space for the entire access footprint. */
function accessPlacement(outline: Outline, run: number, width: number) {
  const inside = (x: number, z: number) => {
    let hit = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const a = outline[i]!, b = outline[j]!;
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  };
  const edges = outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  }).sort((a, b) => b.length - a.length);
  for (const { a, b, length } of edges) {
    if (length < width + 0.2) continue;
    const tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
    for (const fraction of [0.22, 0.78, 0.5]) {
      const along = THREE.MathUtils.clamp(length * fraction, width / 2 + 0.1, length - width / 2 - 0.1);
      const x = a[0] + tx * along, z = a[1] + tz * along;
      const sign = inside(x - tz * 0.05, z + tx * 0.05) ? 1 : -1;
      const nx = -tz * sign, nz = tx * sign;
      let clear = true;
      for (let d = 0.05; d <= run + 0.05; d += 0.1) {
        for (const w of [-width / 2, 0, width / 2]) {
          if (!inside(x + nx * d + nz * w, z + nz * d - nx * w)) clear = false;
        }
      }
      if (clear) return { x, z, rotation: Math.atan2(nx, nz) };
    }
  }
  return null;
}

export function PoolAccessModel({ outline, access, floorY, topY, children }: {
  outline: Outline; access: PoolAccess | null; floorY: number; topY: number; children: ReactNode;
}) {
  const riseCount = Math.max(3, Math.ceil((topY - floorY) / 0.25));
  const rise = (topY - floorY) / riseCount;
  const tread = 0.3;
  const run = access === "internalSteps" ? (riseCount - 1) * tread : 0.55;
  const width = access === "internalSteps" ? 1.15 : 0.62;
  const placement = useMemo(() => accessPlacement(outline, run, width), [outline, run, width]);
  const rail = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, -0.36),
    new THREE.Vector3(0, 0.62, -0.36),
    new THREE.Vector3(0, 0.76, -0.15),
    new THREE.Vector3(0, 0.62, 0.26),
    new THREE.Vector3(0, 0.12, 0.32),
    new THREE.Vector3(0, -Math.min(1.15, topY - floorY - 0.15), 0.32),
  ], false, "centripetal"), [topY, floorY]);
  if (!access || !placement) return null;
  return <group name={`pool-access-${access}`} position={[placement.x, 0, placement.z]} rotation={[0, placement.rotation, 0]}>
    {access === "internalSteps" ? Array.from({ length: riseCount - 1 }, (_, i) => {
      const height = (riseCount - 1 - i) * rise;
      return <mesh key={i} position={[0, floorY + height / 2, (i + 0.5) * tread]} castShadow receiveShadow>
        <boxGeometry args={[width, height, tread + 0.002]} />
        {children}
      </mesh>;
    }) : <group position={[0, topY, 0]}>
      {[-0.25, 0.25].map(x => <group key={x} position={[x, 0, 0]}>
        <mesh castShadow><tubeGeometry args={[rail, 40, 0.021, 12, false]} /><meshStandardMaterial color="#e5e8e9" metalness={1} roughness={0.2} /></mesh>
        <mesh position={[0, 0.012, -0.36]}><cylinderGeometry args={[0.06, 0.06, 0.024, 24]} /><meshStandardMaterial color="#d5dadd" metalness={1} roughness={0.24} /></mesh>
      </group>)}
      {[0.3, 0.58, 0.86].filter(d => d < topY - floorY - 0.12).map(d => <mesh key={d} position={[0, -d, 0.32]} castShadow>
        <boxGeometry args={[0.5, 0.035, 0.13]} /><meshStandardMaterial color="#bbc3c6" metalness={0.9} roughness={0.32} />
      </mesh>)}
    </group>}
  </group>;
}
