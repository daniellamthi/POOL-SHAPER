import { useEffect, useMemo } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import {
  DirectionalLight,
  SpotLight,
  BufferGeometry,
  RepeatWrapping,
  MirroredRepeatWrapping,
  DataTexture,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import type { WebGLProgramParametersWithUniforms } from "three";
import type { Outline, OverflowType, PoolType, SystemType } from "@/lib/pool/types";
import { offsetOutline, outlineBounds } from "@/lib/pool/geometry";
import { PAVING, pavingForPool, pavingLayout, type PavingId, type PavingFormatId } from "@/lib/pool/presentation";
import { isReferenceFinish } from "@/lib/pool/reference-finishes";
import { ReferencePavingMaterial } from "./ReferencePavingMaterial";
import { createPavingModules, type PavingOptions } from "./pavingGeometry";
import { samplePavingWood, samplePavingGres, WOOD_GRAIN_SCALE } from "./pavingTexture";
import { createSurfaceGeometry } from "./poolGeometry";
import { studioDeckBand, studioDeckInnerOffset, studioDeckOutline, type DeckFurnitureSide } from "./studioDeck";
import { createLimestoneMaps, createPrunMaps, createWPCMaps } from "./stoneTextures";
import { COPING_MATERIALS } from "@/lib/pool/coping-materials";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";

export { createPavingModules } from "./pavingGeometry";
const NO_FURNITURE_ROWS: readonly DeckFurnitureSide[] = [];
const PRUN_PAVING_ASSET = { dir: "/textures/coping/prun", aspect: 365 / 547,
  normalMap: false, roughnessMap: false, mirroredRepeat: true } as const;

/** While editing shape/dimensions the paving is not rendered. Avoid cutting
 * thousands of invisible modules on every input; build the exact same full
 * geometry only when the exterior stage actually displays it. */
export function createVisiblePavingGeometry(inner: Outline, outer: Outline,
  module: readonly [number, number], options: PavingOptions, visible: boolean) {
  return {
    slabs: visible ? createPavingModules(inner, outer, module, options) : new BufferGeometry(),
    grout: visible ? createSurfaceGeometry(outer, inner) : new BufferGeometry(),
  };
}

export function PavingMaterial(props: { id: PavingId; waterY: number; joint?: boolean; vertexColors?: boolean }) {
  if (props.joint) return <meshStandardMaterial color={props.id === "wood" || props.id === "wpc" || props.id === "reference-ipe" ? "#4c443b" : "#aaa69f"} roughness={1}
    onBeforeCompile={shader => excludeSubmergedDirectLights(shader, props.waterY)}
    customProgramCacheKey={() => `paving-bed-${props.waterY}`} />;
  if (isReferenceFinish(props.id)) return <ReferencePavingMaterial id={props.id} waterY={props.waterY} vertexColors={props.vertexColors ?? true} />;
  return ["gres", "wood", "istria"].includes(props.id)
    ? <OriginalPavingMaterial {...props} /> : <CatalogPavingMaterial {...props} />;
}

function CatalogPavingMaterial({ id, waterY, joint = false, vertexColors = true }: { id: PavingId; waterY: number; joint?: boolean; vertexColors?: boolean }) {
  const maxAnisotropy = useThree(s => s.gl.capabilities.getMaxAnisotropy());
  const definition = COPING_MATERIALS.find(m => m.id === id)!;
  // Paving owns its photograph calibration; it must not depend on or change
  // the independent coping material's maps or physical module.
  const asset = id === "prun" ? PRUN_PAVING_ASSET
    : "asset" in definition ? definition.asset : null;
  const hasNormal = !(asset && "normalMap" in asset && asset.normalMap === false);
  const sources = useLoader(TextureLoader, asset ? ["basecolor", ...(hasNormal ? ["normal"] : []), ...("roughnessMap" in asset && asset.roughnessMap === false ? [] : ["roughness"])].map(name => `${asset.dir}/${name}.png`) : []);
  const maps = useMemo(() => {
    const maps = asset
      ? { colorMap: sources[0]!.clone(), normalMap: hasNormal ? sources[1]!.clone() : new DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1), roughnessMap: sources[hasNormal ? 2 : 1]?.clone() ?? null }
      : id === "prun" ? createPrunMaps() : id === "wpc" ? createWPCMaps() : createLimestoneMaps();
    const aspect = asset && "aspect" in asset ? asset.aspect : 1;
    maps.colorMap.colorSpace = SRGBColorSpace;
    const wrapping = id === "ardesia" || (asset && "mirroredRepeat" in asset && asset.mirroredRepeat) ? MirroredRepeatWrapping : RepeatWrapping;
    Object.values(maps).forEach(t => { if (t) {
      t.wrapS = t.wrapT = wrapping;
      t.repeat.set(id === "wpc" ? 1 / 2.2 : 1 / definition.moduleSize, id === "wpc" ? 0.90 / 0.14 : aspect / definition.moduleSize);
      if (id === "wpc") t.offset.y = 0.05;
      t.anisotropy = Math.min(8, maxAnisotropy); t.needsUpdate = true;
    } });
    return maps;
  }, [definition, id, asset, sources, hasNormal, maxAnisotropy]);
  useEffect(() => () => Object.values(maps).forEach(t => t?.dispose()), [maps]);
  return <meshStandardMaterial vertexColors={vertexColors && !joint} color={id === "prun" ? "#ffffff" : id === "wpc" ? "#e2dbd1" : definition.color}
    map={maps.colorMap} normalMap={maps.normalMap} roughnessMap={maps.roughnessMap}
    normalScale={[Math.min(0.35, definition.normalStrength), Math.min(0.35, definition.normalStrength)]} roughness={id === "wpc" ? 0.86 : definition.roughness}
    onBeforeCompile={shader => excludeSubmergedDirectLights(shader, waterY)}
    customProgramCacheKey={() => `catalog-paving-dry-${waterY}`} />;
}

function OriginalPavingMaterial({
  id,
  waterY,
  joint = false,
  vertexColors = true,
}: {
  id: PavingId;
  waterY: number;
  /** The joint bedding: the slab's own material a shade darker, so joints
   * read in the stone's tone instead of a light graphic grid. */
  joint?: boolean;
  vertexColors?: boolean;
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
      t.repeat.set(id === "wood" ? WOOD_GRAIN_SCALE : 1 / 1.2, id === "wood" ? WOOD_GRAIN_SCALE : 1 / 1.2);
      if (i === 0) t.colorSpace = SRGBColorSpace;
      t.anisotropy = Math.min(8, maxAnisotropy);
      t.needsUpdate = true;
    });
    return () => maps.forEach((t) => t?.dispose());
  }, [maps, id, maxAnisotropy]);
  return (
    <meshStandardMaterial
      vertexColors={vertexColors && !joint}
      color={
        joint ? (id === "istria" ? "#b1b0a7" : "#bdbdbd") : id === "istria" ? "#deddd1" : "#ffffff"
      }
      map={maps[0] ?? null}
      normalMap={maps[1] ?? null}
      roughnessMap={maps[2] ?? null}
      normalScale={id === "gres" ? [0.12, 0.12] : [0.22, 0.22]}
      roughness={id === "istria" ? 0.9 : 1}
      metalness={0}
      onBeforeCompile={(shader) => {
        excludeSubmergedDirectLights(shader, waterY);
        if (id === "wood") samplePavingWood(shader);
        if (id === "gres") samplePavingGres(shader);
      }}
      customProgramCacheKey={() => `studio-paving-${id}-metric-dry-${waterY}`}
    />
  );
}

export function StudioPaving({
  outline,
  poolType,
  system,
  overflowType,
  paving = "gres",
  pavingFormat,
  environment = true,
  loungers = false,
  furnitureRows = NO_FURNITURE_ROWS,
  decking = true,
  waterY,
}: {
  outline: Outline;
  poolType: PoolType;
  system: SystemType;
  overflowType: OverflowType;
  paving?: PavingId;
  pavingFormat?: PavingFormatId | undefined;
  /** Late-stage context: wide terrace and lawn instead of the compact band. */
  environment?: boolean;
  /** Reserve the furniture footprint plus a clear poolside passage. */
  loungers?: boolean;
  furnitureRows?: readonly DeckFurnitureSide[] | undefined;
  /** Progressive reveal: before Bordo e decking the basin sits in a plain
   * ground plane, with no paving around the coping yet. */
  decking?: boolean;
  /** Submerged LEDs are linked out of every dry deck material (they cannot
   * shine through the shell), so the beam stays inside the basin. */
  waterY: number;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const id = pavingForPool(paving, poolType);
  const layout = useMemo(() => pavingLayout(id, pavingFormat), [id, pavingFormat]);
  const { module, gap, thickness, boards } = layout;
  // Material-only changes do not alter a single paving vertex. Preserve the
  // above-ground lifecycle; reuse the in-ground mesh for equal metric modules.
  const aboveGroundLayout = poolType === "above-ground" ? layout : null;
  const geometry = useMemo(() => {
    const started = import.meta.env.DEV ? performance.now() : 0;
    const inner = offsetOutline(outline, studioDeckInnerOffset(poolType, system, overflowType));
    const band = studioDeckBand(outline, environment, loungers);
    const outer = studioDeckOutline(inner, band, furnitureRows);
    const far: Outline = [
      [-150, -150],
      [150, -150],
      [150, 150],
      [-150, 150],
    ];
    const result = {
      ...createVisiblePavingGeometry(inner, outer, module, { gap, thickness, boards }, decking),
      // The lawn's opening is 4 cm smaller than the paving so its edge always
      // sits under the slabs: an exactly matching edge left a hairline crack
      // that showed the basin shell at low cameras.
      ground: createSurfaceGeometry(
        far,
        decking ? (furnitureRows.length ? offsetOutline(outer, -0.04) : offsetOutline(inner, band - 0.04)) : inner,
      ),
    };
    if (import.meta.env.DEV) console.debug("[Pool3D paving build]", JSON.stringify({
      module, boards, visible: decking, vertices: result.slabs.getAttribute("position")?.count ?? 0,
      durationMs: Number((performance.now() - started).toFixed(2)),
    }));
    return result;
  }, [outline, poolType, system, overflowType, module, gap, thickness, boards, aboveGroundLayout, environment, loungers, furnitureRows, decking]);
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
          <mesh geometry={geometry.grout} position={[0, -layout.thickness, 0]} receiveShadow>
            <PavingMaterial key={`${id}-joint`} id={id} waterY={waterY} joint />
          </mesh>
          <mesh name={`local-paving-${id}`} geometry={geometry.slabs} receiveShadow>
            <PavingMaterial key={isReferenceFinish(id) ? "reference" : id} id={id} waterY={waterY} />
          </mesh>
        </>
      ) : null}
    </group>
  );
}
