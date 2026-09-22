import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { DoubleSide } from "three";
import {
  createInfinityCascadeGeometry,
  createInfinityCatchBasinGeometry,
  createInfinityLipGeometry,
  createInfinityTransitionCapGeometry,
} from "./infinityEdgeGeometry";
import { WaterSurfaceMaterial } from "./WaterSurfaceMaterial";
import {
  clampInfinityEdgeDimensions,
  computeInfinityEdgeGeometry,
  infinityZonesForOutline,
} from "@/lib/pool/infinity-edge";
import type { InfinityEdgeParams } from "@/lib/pool/infinity-edge";
import type { Outline, PoolShapeId } from "@/lib/pool/types";
import type { ResolvedMaterials } from "@/lib/pool/materials";
import type { StoneMaps } from "./stoneTextures";

function useDisposableGeometry<T extends THREE.BufferGeometry>(
  factory: () => T,
  deps: unknown[],
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(factory, deps);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

interface InfinityEdgeProps {
  outline: Outline;
  shape: PoolShapeId;
  infinityEdge: InfinityEdgeParams | undefined;
  waterLevel: number;
  copingSurfaceY: number;
  copingOuterOffsetDistance: number;
  materials: ResolvedMaterials;
  /** Same procedural/scanned stone bake `PoolModel` samples triplanar (world
   * -space, not mesh UV) for the main coping ring -- shared here so the lip
   * and coping transition caps ("the coping-equivalent cap the water sheets
   * over", see infinity-edge.ts) render the SAME finish as the rest of the
   * coping instead of a flat, texture-less swatch of `materials.coping.color`
   * (pure white for every scanned finish -- travertine, gres, ardesia, deck
   * -marrone -- whose colour is deliberately neutral so the real maps drive
   * the look, per coping-materials.ts). */
  copingDetail: StoneMaps;
  configureCopingTriplanar: (shader: THREE.WebGLProgramParametersWithUniforms) => void;
}

/**
 * Geometry Pass D (Infinity, Rectangle + L-shape + Organic): the visible
 * disappearing-lip / waterfall cascade / catch-basin / coping-transition
 * assembly for the one selected side/arc. Renders nothing when Infinity
 * isn't enabled or the outline has no valid candidate zone for the selected
 * side (wrong shape, an excluded L-shape recess edge, an Organic index that
 * isn't currently a candidate arc) -- `computeInfinityEdgeGeometry` is the
 * single source of truth for that check, never re-derived here.
 */
export function InfinityEdge({
  outline,
  shape,
  infinityEdge,
  waterLevel,
  copingSurfaceY,
  copingOuterOffsetDistance,
  materials,
  copingDetail,
  configureCopingTriplanar,
}: InfinityEdgeProps) {
  const params = infinityEdge;
  const geometryData = useMemo(
    () => (params ? computeInfinityEdgeGeometry(outline, params, shape) : null),
    [outline, params, shape],
  );
  const zone = useMemo(() => {
    if (!geometryData) return null;
    const zones = infinityZonesForOutline(outline, shape);
    return zones.find((z) => z.side === geometryData.side) ?? null;
  }, [outline, shape, geometryData]);

  // Just above the waterline so the main water body reads as running
  // straight into the lip with no visible reveal.
  const lipTopY = waterLevel + 0.003;
  const dims = params ? clampInfinityEdgeDimensions(undefined) : null;

  const lip = useDisposableGeometry(
    () =>
      zone && dims ? createInfinityLipGeometry(zone, dims, lipTopY) : new THREE.BufferGeometry(),
    [zone, dims, lipTopY],
  );
  const cascade = useDisposableGeometry(
    () =>
      zone && dims
        ? createInfinityCascadeGeometry(zone, dims, lipTopY)
        : new THREE.BufferGeometry(),
    [zone, dims, lipTopY],
  );
  const basin = useMemo(
    () => (zone && dims ? createInfinityCatchBasinGeometry(zone, dims, lipTopY) : null),
    [zone, dims, lipTopY],
  );
  useEffect(
    () => () => {
      basin?.floor.dispose();
      basin?.outerWall.dispose();
      basin?.endWallStart.dispose();
      basin?.endWallEnd.dispose();
    },
    [basin],
  );
  const transitions = useMemo(
    () =>
      zone && dims
        ? createInfinityTransitionCapGeometry(
            zone,
            dims,
            lipTopY,
            copingSurfaceY,
            copingOuterOffsetDistance,
          )
        : { start: null, end: null },
    [zone, dims, lipTopY, copingSurfaceY, copingOuterOffsetDistance],
  );
  useEffect(
    () => () => {
      transitions.start?.dispose();
      transitions.end?.dispose();
    },
    [transitions],
  );

  if (!zone || !dims || !basin) return null;

  // Same triplanar (world-space, not mesh-UV) stone material PoolModel uses
  // for the main coping ring -- see `copingDetail`/`configureCopingTriplanar`
  // doc on the props above. Sampling is triplanar, so it is correct
  // regardless of each piece's own UVs (the lip is a per-segment fan for a
  // curved Organic arc, the caps are small end quads) and needs no seam
  // alignment with the coping ring's own UVs -- world position alone keeps
  // the stone pattern continuous across the coping -> transition cap -> lip
  // boundary.
  // `key` is passed directly on each JSX element below, never inside this
  // spread object -- React warns (and, in some versions, throws) when a
  // spread props object carries its own `key`, since key is special JSX
  // metadata, not a real prop.
  const copingMaterialKey = materials.coping.moduleSize;
  const copingMaterialProps = {
    color: materials.coping.color,
    normalMap: copingDetail.normalMap,
    normalScale: [materials.coping.normalStrength, materials.coping.normalStrength] as [
      number,
      number,
    ],
    roughnessMap: copingDetail.roughnessMap,
    roughness: materials.coping.roughness,
    metalness: 0,
    clearcoat: 0,
    clearcoatRoughness: 0.45,
    onBeforeCompile: configureCopingTriplanar,
    customProgramCacheKey: () => "coping-triplanar-v4",
  };

  return (
    <group name="infinity-edge">
      {/* Lip: same finish as the rest of the coping, just lowered/thinned. */}
      <mesh geometry={lip} receiveShadow castShadow>
        <meshPhysicalMaterial key={copingMaterialKey} {...copingMaterialProps} side={DoubleSide} />
      </mesh>

      {/* Coping transition caps: close the step at both ends against the
          adjoining normal coping run. */}
      {transitions.start ? (
        <mesh geometry={transitions.start} receiveShadow castShadow>
          <meshPhysicalMaterial
            key={copingMaterialKey}
            {...copingMaterialProps}
            side={DoubleSide}
          />
        </mesh>
      ) : null}
      {transitions.end ? (
        <mesh geometry={transitions.end} receiveShadow castShadow>
          <meshPhysicalMaterial
            key={copingMaterialKey}
            {...copingMaterialProps}
            side={DoubleSide}
          />
        </mesh>
      ) : null}

      {/* Waterfall cascade -- reuses the pool's own water material/shader
          (transmission, ripple, colour) rather than a parallel one. Planar
          reflection is horizontal-water-only, so it's disabled here; the
          ripple normal map and transmission still animate off the shared
          clock uniform, no per-frame geometry rebuild. */}
      <mesh geometry={cascade} renderOrder={2}>
        <WaterSurfaceMaterial
          waterLevel={lipTopY - dims.dropHeight / 2}
          reflections={false}
          depth={dims.dropHeight}
        />
      </mesh>

      {/* Catch basin / receiving channel. */}
      <mesh geometry={basin.floor} receiveShadow>
        <meshStandardMaterial color="#394340" roughness={0.6} side={DoubleSide} />
      </mesh>
      <mesh geometry={basin.outerWall} receiveShadow castShadow>
        <meshStandardMaterial color="#4b5350" roughness={0.55} side={DoubleSide} />
      </mesh>
      <mesh geometry={basin.endWallStart} receiveShadow castShadow>
        <meshStandardMaterial color="#4b5350" roughness={0.55} side={DoubleSide} />
      </mesh>
      <mesh geometry={basin.endWallEnd} receiveShadow castShadow>
        <meshStandardMaterial color="#4b5350" roughness={0.55} side={DoubleSide} />
      </mesh>
    </group>
  );
}
