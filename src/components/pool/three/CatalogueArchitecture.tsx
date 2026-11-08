import { useEffect, useMemo, useRef } from "react";
import {
  CatalogueRoomEnvironment,
  type CatalogueRoomMaps,
  type CatalogueRoomCache,
} from "./CatalogueRoomEnvironment";
import { useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import {
  CATALOGUE_COVE_POWER,
  type ArchitecturalPlan,
  type ArchitecturalFinish,
} from "@/lib/pool/catalogue-architecture";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";
import { createCataloguePartGeometry } from "./cataloguePartGeometry";
import { CataloguePlants } from "./CataloguePlants";
import { createCatalogueGlassMaterial } from "./catalogueGlassMaterial";
import { createCatalogueLinen } from "./catalogueLounger";

RectAreaLightUniformsLib.init();
const finishes: ArchitecturalFinish[] = [
  "stone",
  "plaster",
  "wood",
  "teak",
  "dark",
  "glass",
  "fabric",
  "linen",
  "light",
];
export function CatalogueArchitecture({
  plan,
  night,
  photoMode,
  waterY,
  onRoomMaps,
  roomMapCache,
}: {
  plan: ArchitecturalPlan;
  night: boolean;
  photoMode: boolean;
  waterY: number;
  onRoomMaps: (maps: CatalogueRoomMaps | null) => void;
  roomMapCache: CatalogueRoomCache;
}) {
  const room = useRef<THREE.Group>(null);
  const scans = useLoader(THREE.TextureLoader, [
    "/textures/coping/travertino/basecolor.png",
    "/textures/coping/travertino/normal.png",
    "/textures/catalogue/oak/basecolor.jpg",
    "/textures/catalogue/oak/normal.jpg",
    "/textures/catalogue/oak/roughness.jpg",
  ]);
  const anisotropy = useThree((state) => Math.min(8, state.gl.capabilities.getMaxAnisotropy()));
  const resources = useMemo(() => {
    // Suspend until every source is decoded before Photo Mode snapshots the
    // scene. Sources remain cached; each presentation owns only its clones.
    const maps = scans.map((source, i) => {
      const texture = source.clone();
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(i < 2 ? 0.5 : 1, i < 2 ? 0.5 : 1);
      texture.colorSpace = i === 0 || i === 2 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.anisotropy = anisotropy;
      return texture;
    });
    const stone = { colorMap: maps[0]!, normalMap: maps[1]!, roughnessMap: null };
    const wood = { colorMap: maps[2]!, normalMap: maps[3]!, roughnessMap: maps[4]! };
    const linen = createCatalogueLinen(anisotropy);
    const mats: Record<ArchitecturalFinish, THREE.MeshStandardMaterial> = {
      stone: new THREE.MeshStandardMaterial({
        color: "#f0e5d2",
        map: stone.colorMap,
        normalMap: stone.normalMap,
        roughnessMap: stone.roughnessMap,
        normalScale: new THREE.Vector2(0.12, 0.12),
        roughness: 0.8,
      }),
      plaster: new THREE.MeshStandardMaterial({ color: "#eee6d7", roughness: 0.88 }),
      wood: new THREE.MeshStandardMaterial({
        color: "#f4e8d7",
        map: wood.colorMap,
        normalMap: wood.normalMap,
        normalScale: new THREE.Vector2(0.18, 0.18),
        roughnessMap: wood.roughnessMap,
        roughness: 1,
      }),
      teak: new THREE.MeshStandardMaterial({
        color: "#c19a6b",
        map: wood.colorMap,
        normalMap: wood.normalMap,
        normalScale: new THREE.Vector2(0.18, 0.18),
        roughnessMap: wood.roughnessMap,
        roughness: 1,
      }),
      dark: new THREE.MeshStandardMaterial({ color: "#383329", metalness: 0.65, roughness: 0.34 }),
      glass: createCatalogueGlassMaterial(waterY),
      fabric: new THREE.MeshStandardMaterial({ color: "#eee1c9", roughness: 0.97 }),
      linen: linen.material,
      light: new THREE.MeshStandardMaterial({
        color: "#ffe1a3",
        emissive: "#ffcf83",
        emissiveIntensity: 3,
        toneMapped: true,
      }),
    };
    for (const [finish, material] of Object.entries(mats)) {
      if (finish === "glass") continue;
      material.onBeforeCompile = (shader) => excludeSubmergedDirectLights(shader, waterY, true);
      material.customProgramCacheKey = () => "catalogue-dry-linked-v1";
    }
    return { stone, wood, mats, linenMaps: linen.maps };
  }, [scans, anisotropy, waterY]);
  const geometry = useMemo(
    () =>
      finishes.flatMap((finish) => {
        const boxes = plan.parts
          .filter((p) => p.finish === finish)
          .map(createCataloguePartGeometry);
        if (!boxes.length) return [];
        const g = mergeGeometries(boxes)!;
        boxes.forEach((b) => b.dispose());
        return [{ finish, g }];
      }),
    [plan],
  );
  useEffect(() => () => geometry.forEach((p) => p.g.dispose()), [geometry]);
  useEffect(
    () => () => {
      Object.values(resources.mats).forEach((m) => m.dispose());
      Object.values(resources.stone).forEach((t) => t?.dispose());
      Object.values(resources.wood).forEach((t) => t?.dispose());
      Object.values(resources.linenMaps).forEach((t) => t.dispose());
    },
    [resources],
  );
  return (
    <group
      ref={room}
      position={[plan.centre[0], 0, plan.centre[1]]}
      rotation={[0, plan.angle, 0]}
      name="catalogue-architecture"
    >
      {plan.indoor ? (
        <CatalogueRoomEnvironment
          room={room}
          plan={plan}
          onMaps={onRoomMaps}
          cache={roomMapCache}
        />
      ) : null}
      {geometry.map(({ finish, g }) => (
        <mesh
          key={finish}
          name={`architecture-${finish}`}
          geometry={g}
          material={resources.mats[finish]}
          castShadow={finish !== "glass" && finish !== "light"}
          receiveShadow
          dispose={null}
        />
      ))}
      <CataloguePlants plan={plan} waterY={waterY} photoMode={photoMode} night={night} />
      {plan.indoor
        ? plan.parts
            .filter((part) => part.finish === "light")
            .map((part, index) => {
              const left = part.p[2] < 0;
              return (
                <group key={index}>
                  <rectAreaLight
                    name="catalogue-cove-wall"
                    position={[part.p[0], part.p[1] - 0.15, part.p[2] + (left ? 0.1 : -0.1)]}
                    rotation={[0, left ? 0 : Math.PI, 0]}
                    width={part.s[0]}
                    height={0.18}
                    power={part.s[0] * CATALOGUE_COVE_POWER.wall[night ? "night" : "day"]}
                    color="#ffe1af"
                  />
                  {/* Sample the existing fixture's underside explicitly. The
                      tracer cannot efficiently find this narrow emissive face
                      by random bounces; it previously lit only the walls. */}
                  <rectAreaLight
                    name="catalogue-cove-down"
                    position={[part.p[0], part.p[1] - part.s[1] / 2 - 0.002, part.p[2]]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    width={part.s[0]}
                    height={part.s[2]}
                    power={part.s[0] * CATALOGUE_COVE_POWER.down[night ? "night" : "day"]}
                    color="#ffe1af"
                  />
                </group>
              );
            })
        : null}
    </group>
  );
}
