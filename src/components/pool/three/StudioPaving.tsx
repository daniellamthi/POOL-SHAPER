import { useEffect, useMemo } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import { BufferGeometry, DirectionalLight, SpotLight, Float32BufferAttribute, RepeatWrapping, SRGBColorSpace, TextureLoader } from "three";
import type { Outline, OverflowType, PoolType, SystemType } from "@/lib/pool/types";
import { offsetOutline } from "@/lib/pool/geometry";
import { PAVING, pavingId, type PavingId } from "@/lib/pool/presentation";
import { createSurfaceGeometry } from "./poolGeometry";
import { copingOuterOffset } from "./poolConstruction";
import { createLimestoneMaps } from "./stoneTextures";

type Point = [number, number];
// Clip each existing ring triangle against one module. This keeps concave
// footprints and their basin holes intact; no slab ever bridges the pool.
function clip(poly: Point[], axis: 0 | 1, limit: number, greater: boolean): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    const insideA = greater ? a[axis] >= limit : a[axis] <= limit;
    const insideB = greater ? b[axis] >= limit : b[axis] <= limit;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (limit - a[axis]) / (b[axis] - a[axis]);
      result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return result;
}

export function createPavingModules(inner: Outline, outer: Outline, module: readonly [number, number]) {
  const indexed = createSurfaceGeometry(outer, inner);
  const ring = indexed.toNonIndexed();
  indexed.dispose();
  const p = ring.getAttribute("position");
  const positions: number[] = [], colors: number[] = [], uv: number[] = [];
  const [sx, sz] = module, gap = 0.004;
  for (let i = 0; i < p.count; i += 3) {
    const tri: Point[] = [0, 1, 2].map(j => [p.getX(i + j), p.getZ(i + j)]);
    const xs = tri.map(v => v[0]), zs = tri.map(v => v[1]);
    for (let z = Math.floor(Math.min(...zs) / sz); z <= Math.floor(Math.max(...zs) / sz); z++) {
      const stagger = (z & 1) * sx / 2;
      for (let x = Math.floor((Math.min(...xs) - stagger) / sx); x <= Math.floor((Math.max(...xs) - stagger) / sx); x++) {
        const minX = x * sx + stagger + gap / 2, minZ = z * sz + gap / 2;
        let polygon = clip(tri, 0, minX, true);
        polygon = clip(polygon, 0, minX + sx - gap, false);
        polygon = clip(polygon, 1, minZ, true);
        polygon = clip(polygon, 1, minZ + sz - gap, false);
        const seed = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
        const variation = 0.965 + (seed - Math.floor(seed)) * 0.035;
        for (let k = 1; k + 1 < polygon.length; k++) {
          for (const v of [polygon[0]!, polygon[k]!, polygon[k + 1]!]) {
            positions.push(v[0], 0, v[1]);
            uv.push(v[0], -v[1]);
            colors.push(variation, variation, variation);
          }
        }
      }
    }
  }
  ring.dispose();
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function PavingMaterial({ id }: { id: PavingId }) {
  const definition = PAVING.find(p => p.id === id)!;
  const maxAnisotropy = useThree(s => s.gl.capabilities.getMaxAnisotropy());
  // Cached source maps are never mutated: each presentation owns its clones.
  const sources = useLoader(TextureLoader, ["basecolor", "normal", "roughness"].map(m => `/textures/coping/${definition.maps ?? "gres"}/${m}.png`));
  const maps = useMemo(() => {
    if (id === "istria") {
      // Authored visual approximation, explicitly labelled in UI/metadata.
      const stone = createLimestoneMaps();
      return [stone.colorMap, stone.normalMap, stone.roughnessMap];
    }
    return sources.map(t => t.clone());
  }, [id, sources]);
  useEffect(() => {
    maps.forEach((t, i) => {
      if (!t) return;
      t.wrapS = t.wrapT = RepeatWrapping;
      // UVs are world metres, independent from pool resize.
      t.repeat.set(id === "wood" ? 1 / 2.4 : 1 / 1.2, id === "wood" ? 1 / 1.12 : 1 / 1.2);
      if (i === 0) t.colorSpace = SRGBColorSpace;
      t.anisotropy = Math.min(8, maxAnisotropy);
      t.needsUpdate = true;
    });
    return () => maps.forEach(t => t?.dispose());
  }, [maps, id, maxAnisotropy]);
  return <meshStandardMaterial vertexColors color={id === "istria" ? "#deddd1" : "#ffffff"}
    map={maps[0] ?? null} normalMap={maps[1] ?? null} roughnessMap={maps[2] ?? null}
    normalScale={[0.22, 0.22]} roughness={id === "istria" ? 0.9 : 1} metalness={0} />;
}

export function StudioPaving({ outline, poolType, system, overflowType, paving = "gres" }: {
  outline: Outline; poolType: PoolType; system: SystemType; overflowType: OverflowType; paving?: PavingId;
}) {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const id = pavingId(paving), module = PAVING.find(p => p.id === id)!.module;
  const geometry = useMemo(() => {
    const inner = offsetOutline(outline, poolType === "in-ground" ? copingOuterOffset(system, overflowType) : 0.17);
    const outer = offsetOutline(inner, 1.2);
    const far: Outline = [[-150,-150],[150,-150],[150,150],[-150,150]];
    return { slabs: createPavingModules(inner, outer, module), grout: createSurfaceGeometry(outer, inner),
      ground: createSurfaceGeometry(far, outer) };
  }, [outline, poolType, system, overflowType, module]);
  // The renderer caches stationary shadows. A new footprint must invalidate
  // that cache, otherwise the old basin silhouette remains on the new paving.
  useEffect(() => {
    scene.traverse(object => {
      if ((object instanceof DirectionalLight || object instanceof SpotLight) && object.castShadow) object.shadow.needsUpdate = true;
    });
    gl.shadowMap.needsUpdate = true;
  }, [gl, scene, geometry]);
  useEffect(() => () => Object.values(geometry).forEach(g => g.dispose()), [geometry]);
  return <group name="premium-configuration-studio">
    <mesh geometry={geometry.ground} position={[0,-0.012,0]} receiveShadow><meshStandardMaterial color="#ddd9d2" roughness={0.95} /></mesh>
    <mesh geometry={geometry.grout} position={[0,-0.006,0]} receiveShadow><meshStandardMaterial color={id === "wood" ? "#706457" : "#ada69a"} roughness={1} /></mesh>
    <mesh name={`local-paving-${id}`} geometry={geometry.slabs} receiveShadow><PavingMaterial key={id} id={id} /></mesh>
  </group>;
}
