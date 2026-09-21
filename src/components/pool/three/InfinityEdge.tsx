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
import type { Outline } from "@/lib/pool/types";
import type { ResolvedMaterials } from "@/lib/pool/materials";

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
  infinityEdge: InfinityEdgeParams | undefined;
  waterLevel: number;
  copingSurfaceY: number;
  copingOuterOffsetDistance: number;
  materials: ResolvedMaterials;
}

/**
 * Geometry Pass D (Infinity, Rectangle + L-shape): the visible
 * disappearing-lip / waterfall cascade / catch-basin / coping-transition
 * assembly for the one selected side. Renders nothing when Infinity isn't
 * enabled or the outline has no valid candidate zone for the selected side
 * (wrong shape, an excluded L-shape recess edge, Organic) --
 * `computeInfinityEdgeGeometry` is the single source of truth for that
 * check, never re-derived here.
 */
export function InfinityEdge({
  outline,
  infinityEdge,
  waterLevel,
  copingSurfaceY,
  copingOuterOffsetDistance,
  materials,
}: InfinityEdgeProps) {
  const params = infinityEdge;
  const geometryData = useMemo(
    () => (params ? computeInfinityEdgeGeometry(outline, params) : null),
    [outline, params],
  );
  const zone = useMemo(() => {
    if (!geometryData) return null;
    const zones = infinityZonesForOutline(outline);
    return zones.find((z) => z.side === geometryData.side) ?? null;
  }, [outline, geometryData]);

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

  const copingMaterialProps = {
    color: materials.coping.color,
    roughness: materials.coping.roughness,
  };

  return (
    <group name="infinity-edge">
      {/* Lip: same finish as the rest of the coping, just lowered/thinned. */}
      <mesh geometry={lip} receiveShadow castShadow>
        <meshStandardMaterial {...copingMaterialProps} side={DoubleSide} />
      </mesh>

      {/* Coping transition caps: close the step at both ends against the
          adjoining normal coping run. */}
      {transitions.start ? (
        <mesh geometry={transitions.start} receiveShadow castShadow>
          <meshStandardMaterial {...copingMaterialProps} side={DoubleSide} />
        </mesh>
      ) : null}
      {transitions.end ? (
        <mesh geometry={transitions.end} receiveShadow castShadow>
          <meshStandardMaterial {...copingMaterialProps} side={DoubleSide} />
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
