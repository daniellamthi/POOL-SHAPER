import { useEffect, useMemo } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import {
  BufferGeometry,
  DirectionalLight,
  SpotLight,
  Float32BufferAttribute,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import type { WebGLProgramParametersWithUniforms } from "three";
import type { Outline, OverflowType, PoolType, SystemType } from "@/lib/pool/types";
import { offsetOutline, outlineBounds } from "@/lib/pool/geometry";
import { PAVING, pavingId, type PavingId } from "@/lib/pool/presentation";
import { createSurfaceGeometry } from "./poolGeometry";
import { studioDeckBand, studioDeckInnerOffset } from "./studioDeck";
import { createLimestoneMaps } from "./stoneTextures";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";

type Point = [number, number];
// Clip each existing ring triangle against one module. This keeps concave
// footprints and their basin holes intact; no slab ever bridges the pool.
function clip(poly: Point[], axis: 0 | 1, limit: number, greater: boolean): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!,
      b = poly[(i + 1) % poly.length]!;
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

export function createPavingModules(
  inner: Outline,
  outer: Outline,
  module: readonly [number, number],
) {
  const indexed = createSurfaceGeometry(outer, inner);
  const ring = indexed.toNonIndexed();
  indexed.dispose();
  const p = ring.getAttribute("position");
  const positions: number[] = [],
    colors: number[] = [],
    uv: number[] = [];
  const [sx, sz] = module,
    gap = 0.004;
  for (let i = 0; i < p.count; i += 3) {
    const tri: Point[] = [0, 1, 2].map((j) => [p.getX(i + j), p.getZ(i + j)]);
    const xs = tri.map((v) => v[0]),
      zs = tri.map((v) => v[1]);
    for (let z = Math.floor(Math.min(...zs) / sz); z <= Math.floor(Math.max(...zs) / sz); z++) {
      const stagger = ((z & 1) * sx) / 2;
      for (
        let x = Math.floor((Math.min(...xs) - stagger) / sx);
        x <= Math.floor((Math.max(...xs) - stagger) / sx);
        x++
      ) {
        const minX = x * sx + stagger + gap / 2,
          minZ = z * sz + gap / 2;
        let polygon = clip(tri, 0, minX, true);
        polygon = clip(polygon, 0, minX + sx - gap, false);
        polygon = clip(polygon, 1, minZ, true);
        polygon = clip(polygon, 1, minZ + sz - gap, false);
        const seed = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
        const rnd = seed - Math.floor(seed);
        const variation = 0.94 + rnd * 0.06;
        // Each slab samples a different window of the (seamless) texture, so
        // the same stain never repeats on neighbouring slabs.
        const offU = Math.floor(rnd * 997) * 0.37,
          offV = Math.floor(((rnd * 7919) % 1) * 991) * 0.41;
        for (let k = 1; k + 1 < polygon.length; k++) {
          for (const v of [polygon[0]!, polygon[k]!, polygon[k + 1]!]) {
            positions.push(v[0], 0, v[1]);
            uv.push(v[0] + offU, -v[1] + offV);
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

function PavingMaterial({
  id,
  waterY,
  joint = false,
}: {
  id: PavingId;
  waterY: number;
  /** The joint bedding: the slab's own material a shade darker, so joints
   * read in the stone's tone instead of a light graphic grid. */
  joint?: boolean;
}) {
  const definition = PAVING.find((p) => p.id === id)!;
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  // Cached source maps are never mutated: each presentation owns its clones.
  const sources = useLoader(
    TextureLoader,
    ["basecolor", "normal", "roughness"].map(
      (m) => `/textures/coping/${definition.maps ?? "gres"}/${m}.png`,
    ),
  );
  const maps = useMemo(() => {
    if (id === "istria") {
      // Authored visual approximation, explicitly labelled in UI/metadata.
      const stone = createLimestoneMaps();
      return [stone.colorMap, stone.normalMap, stone.roughnessMap];
    }
    return sources.map((t) => t.clone());
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
    return () => maps.forEach((t) => t?.dispose());
  }, [maps, id, maxAnisotropy]);
  return (
    <meshStandardMaterial
      vertexColors={!joint}
      color={
        joint ? (id === "istria" ? "#b1b0a7" : "#bdbdbd") : id === "istria" ? "#deddd1" : "#ffffff"
      }
      map={maps[0] ?? null}
      normalMap={maps[1] ?? null}
      roughnessMap={maps[2] ?? null}
      normalScale={[0.22, 0.22]}
      roughness={id === "istria" ? 0.9 : 1}
      metalness={0}
      onBeforeCompile={(shader) => excludeSubmergedDirectLights(shader, waterY)}
      customProgramCacheKey={() => `studio-paving${joint ? "-joint" : ""}-dry-${waterY}`}
    />
  );
}

export function StudioPaving({
  outline,
  poolType,
  system,
  overflowType,
  paving = "gres",
  environment = true,
  decking = true,
  waterY,
}: {
  outline: Outline;
  poolType: PoolType;
  system: SystemType;
  overflowType: OverflowType;
  paving?: PavingId;
  /** Late-stage context: wide terrace and lawn instead of the compact band. */
  environment?: boolean;
  /** Progressive reveal: before Bordo e decking the basin sits in a plain
   * ground plane, with no paving around the coping yet. */
  decking?: boolean;
  /** Submerged LEDs are linked out of every dry deck material (they cannot
   * shine through the shell), so the beam stays inside the basin. */
  waterY: number;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const id = pavingId(paving),
    module = PAVING.find((p) => p.id === id)!.module;
  const geometry = useMemo(() => {
    const inner = offsetOutline(outline, studioDeckInnerOffset(poolType, system, overflowType));
    const outer = offsetOutline(inner, studioDeckBand(outline, environment));
    const far: Outline = [
      [-150, -150],
      [150, -150],
      [150, 150],
      [-150, 150],
    ];
    return {
      slabs: createPavingModules(inner, outer, module),
      grout: createSurfaceGeometry(outer, inner),
      // The lawn's opening is 4 cm smaller than the paving so its edge always
      // sits under the slabs: an exactly matching edge left a hairline crack
      // that showed the basin shell at low cameras.
      ground: createSurfaceGeometry(
        far,
        decking ? offsetOutline(inner, studioDeckBand(outline, environment) - 0.04) : inner,
      ),
    };
  }, [outline, poolType, system, overflowType, module, environment, decking]);
  // The renderer caches stationary shadows. A new footprint must invalidate
  // that cache, otherwise the old basin silhouette remains on the new paving.
  useEffect(() => {
    scene.traverse((object) => {
      if ((object instanceof DirectionalLight || object instanceof SpotLight) && object.castShadow)
        object.shadow.needsUpdate = true;
    });
    gl.shadowMap.needsUpdate = true;
  }, [gl, scene, geometry]);
  useEffect(() => () => Object.values(geometry).forEach((g) => g.dispose()), [geometry]);
  const dry = (shader: WebGLProgramParametersWithUniforms) =>
    excludeSubmergedDirectLights(shader, waterY);
  const dryKey = () => `studio-ground-dry-${waterY}`;
  // Garden lawn around the terrace instead of a flat grey plane running to
  // the horizon: the single biggest "CG void" cue in the studio. Procedural
  // (two value-noise octaves plus a fine grain that fades out with distance
  // so it never shimmers), no texture, no extra sampler; the scene fog
  // already dissolves it into the background at the horizon.
  const lawn = (shader: WebGLProgramParametersWithUniforms) => {
    excludeSubmergedDirectLights(shader, waterY);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vLawnPlan;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvLawnPlan = (modelMatrix * vec4(transformed, 1.0)).xz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec2 vLawnPlan;
        float lawnHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float lawnNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(lawnHash(i), lawnHash(i + vec2(1.0, 0.0)), f.x),
            mix(lawnHash(i + vec2(0.0, 1.0)), lawnHash(i + vec2(1.0)), f.x), f.y);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float lawnBroad = 0.65 * lawnNoise(vLawnPlan * 0.21) + 0.35 * lawnNoise(vLawnPlan * 0.83);
        float lawnGrain = lawnHash(floor(vLawnPlan * 70.0));
        float lawnNear = 1.0 - smoothstep(0.01, 0.06, max(fwidth(vLawnPlan.x), fwidth(vLawnPlan.y)));
        vec3 lawnColor = mix(vec3(0.075, 0.105, 0.048), vec3(0.135, 0.16, 0.078), lawnBroad);
        diffuseColor.rgb *= lawnColor * (1.0 + (lawnGrain - 0.5) * 0.3 * lawnNear);`,
      );
  };
  return (
    <group name="premium-configuration-studio">
      <mesh
        name={environment ? "studio-lawn" : "studio-ground"}
        geometry={geometry.ground}
        position={[0, -0.012, 0]}
        receiveShadow
      >
        {environment ? (
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.97}
            onBeforeCompile={lawn}
            customProgramCacheKey={() => `studio-lawn-v1-${waterY}`}
          />
        ) : (
          <meshStandardMaterial
            color="#ddd9d2"
            roughness={0.95}
            onBeforeCompile={dry}
            customProgramCacheKey={dryKey}
          />
        )}
      </mesh>
      {decking ? (
        <>
          <mesh geometry={geometry.grout} position={[0, -0.004, 0]} receiveShadow>
            <PavingMaterial key={`${id}-joint`} id={id} waterY={waterY} joint />
          </mesh>
          <mesh name={`local-paving-${id}`} geometry={geometry.slabs} receiveShadow>
            <PavingMaterial key={id} id={id} waterY={waterY} />
          </mesh>
        </>
      ) : null}
    </group>
  );
}
