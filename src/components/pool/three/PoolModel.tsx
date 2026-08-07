import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { DoubleSide } from "three";
import { createSurfaceGeometry, createWallGeometry } from "./poolGeometry";
import { createCausticsMap, createRippleNormalMap } from "./textures";
import { offsetOutline, outlinePerimeter } from "@/lib/pool/geometry";
import { COPING_WIDTH, FREEBOARD } from "@/lib/pool/config";
import type { ResolvedMaterials } from "@/lib/pool/materials";
import type { Outline, SystemType } from "@/lib/pool/types";
import { POOL_SURFACE_PRESET, WATER_VISUAL_PRESET } from "@/configurator/materials/visual-presets";
import { INTERIOR_TEXTURE_URLS } from "@/configurator/materials/interior-textures";

interface PoolModelProps {
  outline: Outline;
  depth: number;
  materials: ResolvedMaterials;
  system: SystemType;
  copingThickness: number;
  showWater: boolean;
}

function useDisposable<T extends THREE.BufferGeometry>(factory: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(factory, deps);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * The pool itself: coping ring, interior walls, floor, water body and the
 * concealed perimeter gutter used by residential overflow-edge systems.
 */
export function PoolModel({
  outline,
  depth,
  materials,
  system,
  copingThickness,
  showWater,
}: PoolModelProps) {
  const copingOutline = useMemo(() => offsetOutline(outline, COPING_WIDTH), [outline]);
  const overflowWaterEdge = useMemo(() => offsetOutline(outline, 0.06), [outline]);
  const overflowSlotEdge = useMemo(() => offsetOutline(outline, 0.105), [outline]);
  const copingInner = system === "overflow" ? overflowSlotEdge : outline;
  const perimeter = useMemo(() => outlinePerimeter(outline), [outline]);
  const loadedSurfaceMaps = useTexture(INTERIOR_TEXTURE_URLS);
  const sourceSurfaceMap =
    loadedSurfaceMaps[INTERIOR_TEXTURE_URLS.indexOf(materials.surface.textureUrl)] ??
    loadedSurfaceMaps[0]!;

  const [floorSurfaceMap, wallSurfaceMap] = useMemo(() => {
    const floorMap = sourceSurfaceMap.clone();
    const wallMap = sourceSurfaceMap.clone();
    for (const texture of [floorMap, wallMap]) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 4;
    }
    floorMap.repeat.set(1 / materials.surface.tileSize, 1 / materials.surface.tileSize);
    wallMap.repeat.set(
      Math.max(1, perimeter / materials.surface.tileSize),
      Math.max(1, depth / materials.surface.tileSize),
    );
    floorMap.needsUpdate = true;
    wallMap.needsUpdate = true;
    return [floorMap, wallMap];
  }, [sourceSurfaceMap, materials.surface.tileSize, perimeter, depth]);

  useEffect(
    () => () => {
      floorSurfaceMap.dispose();
      wallSurfaceMap.dispose();
    },
    [floorSurfaceMap, wallSurfaceMap],
  );

  const rippleMap = useMemo(() => createRippleNormalMap(), []);
  const causticsMap = useMemo(() => createCausticsMap(), []);
  useEffect(
    () => () => {
      rippleMap.dispose();
      causticsMap.dispose();
    },
    [rippleMap, causticsMap],
  );

  const waterMesh = useRef<THREE.Mesh>(null);
  const normalScale = useMemo(
    () => new THREE.Vector2(WATER_VISUAL_PRESET.normalStrength, WATER_VISUAL_PRESET.normalStrength),
    [],
  );

  useFrame((_, delta) => {
    rippleMap.offset.x += delta * 0.012;
    rippleMap.offset.y += delta * 0.008;
    causticsMap.offset.x -= delta * 0.01;
    causticsMap.offset.y += delta * 0.014;
    if (waterMesh.current) {
      const waterline = system === "overflow" ? -0.018 : -FREEBOARD;
      waterMesh.current.position.y = waterline + Math.sin(performance.now() * 0.0008) * 0.004;
    }
  });

  useEffect(() => {
    const repeat = Math.max(2, Math.round(Math.hypot(...bounds(outline)) / 2));
    rippleMap.repeat.set(repeat, repeat);
    causticsMap.repeat.set(repeat * 0.7, repeat * 0.7);
  }, [outline, rippleMap, causticsMap]);

  const floor = useDisposable(() => createSurfaceGeometry(outline), [outline]);
  const water = useDisposable(() => createSurfaceGeometry(outline), [outline]);
  const walls = useDisposable(() => createWallGeometry(outline, 0, -depth), [outline, depth]);
  const coping = useDisposable(
    () => createSurfaceGeometry(copingOutline, copingInner),
    [copingOutline, copingInner],
  );
  const copingSkirt = useDisposable(
    () => createWallGeometry(copingOutline, 0, -copingThickness),
    [copingOutline, copingThickness],
  );
  const copingInnerSkirt = useDisposable(
    () => createWallGeometry(copingInner, 0, -copingThickness),
    [copingInner, copingThickness],
  );
  const overflowChannel = useDisposable(
    () => createSurfaceGeometry(overflowSlotEdge, outline),
    [overflowSlotEdge, outline],
  );
  const overflowWater = useDisposable(
    () => createSurfaceGeometry(overflowWaterEdge, outline),
    [overflowWaterEdge, outline],
  );
  const isOverflow = system === "overflow";

  return (
    <group>
      {/* Interior walls */}
      <mesh geometry={walls} receiveShadow castShadow>
        <meshPhysicalMaterial
          color={materials.liner.color}
          map={wallSurfaceMap}
          bumpMap={wallSurfaceMap}
          bumpScale={materials.surface.bumpScale}
          roughness={materials.liner.roughness}
          metalness={materials.liner.metalness}
          clearcoat={POOL_SURFACE_PRESET.linerClearcoat}
          clearcoatRoughness={POOL_SURFACE_PRESET.linerClearcoatRoughness}
          side={DoubleSide}
        />
      </mesh>

      {/* Floor with animated caustics */}
      <mesh geometry={floor} position={[0, -depth, 0]} receiveShadow>
        <meshPhysicalMaterial
          color={materials.floor.color}
          map={floorSurfaceMap}
          bumpMap={floorSurfaceMap}
          bumpScale={materials.surface.bumpScale}
          roughness={materials.floor.roughness}
          metalness={0.02}
          clearcoat={POOL_SURFACE_PRESET.floorClearcoat}
          emissive={"#7fd8ff"}
          emissiveMap={causticsMap}
          emissiveIntensity={showWater ? POOL_SURFACE_PRESET.dayCaustics : 0}
          side={DoubleSide}
        />
      </mesh>

      {/* Water body — animated ripples, refraction, real reflections */}
      {showWater ? (
        <mesh ref={waterMesh} geometry={water} position={[0, -FREEBOARD, 0]} renderOrder={2}>
          <meshPhysicalMaterial
            color={materials.water}
            transparent
            opacity={WATER_VISUAL_PRESET.opacity}
            roughness={WATER_VISUAL_PRESET.roughness}
            metalness={WATER_VISUAL_PRESET.metalness}
            transmission={WATER_VISUAL_PRESET.transmission}
            thickness={Math.min(depth, 2.4)}
            ior={WATER_VISUAL_PRESET.ior}
            clearcoat={WATER_VISUAL_PRESET.clearcoat}
            clearcoatRoughness={WATER_VISUAL_PRESET.clearcoatRoughness}
            attenuationColor={materials.water}
            attenuationDistance={Math.max(0.8, depth * WATER_VISUAL_PRESET.attenuationDepthFactor)}
            envMapIntensity={WATER_VISUAL_PRESET.environmentIntensity.day}
            normalMap={rippleMap}
            normalScale={normalScale}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      ) : null}

      {/* Concealed perimeter gutter for a residential overflow-edge pool. */}
      {isOverflow ? (
        <group>
          <mesh geometry={overflowChannel} position={[0, -0.095, 0]} receiveShadow>
            <meshStandardMaterial
              color="#555653"
              roughness={0.82}
              metalness={0.03}
              side={DoubleSide}
            />
          </mesh>
          {showWater ? (
            <mesh geometry={overflowWater} position={[0, -0.026, 0]} renderOrder={2}>
              <meshPhysicalMaterial
                color={materials.water}
                transparent
                opacity={0.72}
                roughness={0.11}
                transmission={0.62}
                ior={WATER_VISUAL_PRESET.ior}
                normalMap={rippleMap}
                normalScale={normalScale}
                depthWrite={false}
                side={DoubleSide}
              />
            </mesh>
          ) : null}
        </group>
      ) : null}

      {/* Coping / deck ring */}
      <mesh geometry={coping} position={[0, copingThickness, 0]} receiveShadow castShadow>
        <meshPhysicalMaterial
          color={materials.coping.color}
          roughness={materials.coping.roughness}
          metalness={0}
          clearcoat={0.1}
          clearcoatRoughness={0.45}
          side={DoubleSide}
        />
      </mesh>
      <mesh geometry={copingSkirt} position={[0, copingThickness, 0]}>
        <meshStandardMaterial
          color={materials.coping.color}
          roughness={Math.min(1, materials.coping.roughness + 0.1)}
          side={DoubleSide}
        />
      </mesh>
      <mesh geometry={copingInnerSkirt} position={[0, copingThickness, 0]} castShadow>
        <meshPhysicalMaterial
          color={materials.coping.color}
          roughness={materials.coping.roughness}
          clearcoat={0.12}
          clearcoatRoughness={0.4}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

function bounds(outline: Outline): [number, number] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of outline) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return [maxX - minX, maxZ - minZ];
}
