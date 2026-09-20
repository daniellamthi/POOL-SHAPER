import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DoubleSide } from "three";
import {
  createBeveledRingGeometry,
  createInteriorWallGeometry,
  createRingGeometry,
  createSlopedFloorGeometry,
  createSurfaceGeometry,
  createWallGeometry,
} from "./poolGeometry";
import type { FloorProfileModel } from "@/lib/pool/floor-profile";
import {
  createMaterialMicroAoMap,
  createCausticsMap,
  createMaterialMicroNormalMap,
  createMaterialMicroRoughnessMap,
  createTriplanarDetailMaps,
  getDerivedDetailMaps,
} from "./textures";
import { WaterSurfaceMaterial } from "./WaterSurfaceMaterial";
import { PoolAccessModel } from "./PoolAccessModel";
import { applyLedTransmission, LED_TRANSPORT_CACHE_KEY } from "./ledTransmission";
import {
  createAnthraciteMaps,
  createLimestoneMaps,
  createPrunMaps,
  createSlateMaps,
  createTravertineMaps,
  createWoodDeckMaps,
  createWPCMaps,
  loadCopingTextureMaps,
  type StoneMaps,
} from "./stoneTextures";
import type { CopingMaterialId } from "@/lib/pool/coping-materials";

/** Each premium coping finish gets its own procedural stone bake (distinct
 * structural DNA -- vein/grain/pore character), never a shared texture with
 * only color/roughness retinted -- see stoneTextures.ts. */
const COPING_STONE_BUILDERS: Record<CopingMaterialId, (size?: number) => StoneMaps> = {
  travertine: createTravertineMaps,
  limestone: createLimestoneMaps,
  prun: createPrunMaps,
  "anthracite-gres": createAnthraciteMaps,
  ardesia: createSlateMaps,
  "deck-marrone": createWoodDeckMaps,
  wpc: createWPCMaps,
};
import { photoModeState } from "@/lib/pool/photoModeState";
import { buildWaterOutline, offsetOutline, outlinePerimeter } from "@/lib/pool/geometry";
import { OVERFLOW_GEOMETRY } from "@/lib/pool/config";
import type { ResolvedMaterials } from "@/lib/pool/materials";
import type { Outline, OverflowType, PoolType, SystemType } from "@/lib/pool/types";
import {
  ABOVE_GROUND_STRUCTURE_THICKNESS,
  getPoolVerticalLayout,
} from "@/lib/pool/vertical-layout";
import {
  MATERIAL_MICRO_DETAIL_PRESET,
  WATER_VISUAL_PRESET,
} from "@/configurator/materials/visual-presets";
import { ACTIVE_RENDERING_QUALITY } from "@/configurator/3d/scene/visual-preset";
import type { SkimmerPlan } from "@/lib/pool/engineering";
import {
  copingOuterOffset,
  createCopingSlabGeometry,
  createGrateGeometry,
  SKIMMER_PROFILES,
} from "./poolConstruction";

interface PoolModelProps {
  poolAccess: import("@/lib/pool/types").PoolAccess | null;
  internalStairType: import("@/lib/pool/types").InternalStairType;
  outline: Outline;
  depth: number;
  floorProfile: FloorProfileModel;
  materials: ResolvedMaterials;
  system: SystemType;
  overflowType: OverflowType;
  poolType: PoolType;
  copingThickness: number;
  showWater: boolean;
  skimmers: SkimmerPlan;
}

function createNeutralSurfaceTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  canvas.getContext("2d")!.fillStyle = "#ffffff";
  canvas.getContext("2d")!.fillRect(0, 0, 1, 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Keeps the current material usable when an optional finish image cannot load. */
function useSafeSurfaceTexture(url: string) {
  const [texture, setTexture] = useState<THREE.Texture>(() => createNeutralSurfaceTexture());

  useEffect(() => {
    let active = true;
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (loadedTexture) => {
        if (!active) {
          loadedTexture.dispose();
          return;
        }
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        setTexture((previous) => {
          previous.dispose();
          return loadedTexture;
        });
      },
      undefined,
      (error) => {
        if (active)
          console.warn(`[Pool3D] Could not load surface texture ${url}; using fallback.`, error);
      },
    );
    return () => {
      active = false;
    };
  }, [url]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

interface UnderwaterShader extends THREE.WebGLProgramParametersWithUniforms {
  uniforms: THREE.WebGLProgramParametersWithUniforms["uniforms"] & {
    causticTime?: { value: number };
    causticStrength?: { value: number };
    causticScale?: { value: number };
    waterLevel?: { value: number };
    waterAbsorption?: { value: THREE.Vector3 };
    waterScatteringColor?: { value: THREE.Vector3 };
    waterScatteringStrength?: { value: number };
    maxOpticalPath?: { value: number };
    waterDepthDensity?: { value: number };
    waterScatteringContribution?: { value: number };
    maxWaterScatteringEnergy?: { value: number };
    waterScatteringDepthStart?: { value: number };
    waterScatteringOpticalPathScale?: { value: number };
    waterAbsorptionOpticalPathScale?: { value: number };
  };
}

const CAUSTICS_VERTEX_HEADER = `
varying vec3 vCausticWorldPosition;
`;

const CAUSTICS_VERTEX_POSITION = `
#include <worldpos_vertex>
vCausticWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

const CAUSTICS_FRAGMENT_HEADER = `
uniform float causticTime;
uniform sampler2D causticMap;
uniform float causticStrength;
uniform float causticScale;
uniform float waterLevel;
uniform vec3 waterAbsorption;
uniform vec3 waterScatteringColor;
uniform float waterScatteringStrength;
uniform float maxOpticalPath;
uniform float waterDepthDensity;
uniform float waterScatteringContribution;
uniform float maxWaterScatteringEnergy;
uniform float waterScatteringDepthStart;
uniform float waterScatteringOpticalPathScale;
uniform float waterAbsorptionOpticalPathScale;
varying vec3 vCausticWorldPosition;

float subtleCausticField(vec2 position, float time) {
  vec2 p = position * 0.22;
  vec2 warp = vec2(sin(p.y * 7.0 + time * 0.51), sin(p.x * 8.0 - time * 0.39)) * 0.012;
  float a = texture2D(causticMap, p + warp + vec2(time * 0.013, -time * 0.008)).r;
  float b = texture2D(causticMap, mat2(0.8, -0.6, 0.6, 0.8) * p * 1.23 - warp + vec2(-time * 0.011, time * 0.015)).r;
  return (a + b) * 0.5;
}
`;

const CAUSTICS_LIGHT_MODULATION = `
// A screen-space cross product of the position derivatives degenerates to
// (near-)zero on a small or steeply foreshortened triangle -- e.g. the
// corner staircase's tight quarter-cylinder wedges from some camera angles
// -- and normalize() of a zero vector is NaN in GLSL, which then poisons
// causticWeights, causticValue and finally outgoingLight itself: the whole
// fragment silently renders as nothing rather than merely losing its
// caustic detail. Falling back to a fixed up-facing normal on that
// degenerate case costs nothing visually (caustics are already a subtle
// modulation) and guarantees a finite, opaque fragment.
vec3 causticCross = cross(dFdx(vCausticWorldPosition), dFdy(vCausticWorldPosition));
vec3 causticNormal = dot(causticCross, causticCross) > 1e-12
  ? normalize(causticCross)
  : vec3(0.0, 1.0, 0.0);
vec3 causticWeights = pow(abs(causticNormal), vec3(6.0));
causticWeights /= max(causticWeights.x + causticWeights.y + causticWeights.z, 0.0001);
vec3 causticProjectedPosition = vCausticWorldPosition + vec3(
  vCausticWorldPosition.y * 0.18,
  0.0,
  vCausticWorldPosition.y * 0.12
);
float causticValue =
  subtleCausticField(causticProjectedPosition.yz, causticTime) * causticWeights.x +
  subtleCausticField(causticProjectedPosition.xz, causticTime * 0.93) * causticWeights.y +
  subtleCausticField(causticProjectedPosition.xy, causticTime * 1.07) * causticWeights.z;
float underwaterMask = 1.0 - step(waterLevel + 0.0001, vCausticWorldPosition.y);
float underwaterDepth = max(0.0, waterLevel - vCausticWorldPosition.y);
float wetContact = exp(-abs(waterLevel - vCausticWorldPosition.y) * 190.0);
vec3 viewRay = normalize(cameraPosition - vCausticWorldPosition);
// Snell's law: even a grazing air ray travels at a finite angle in water.
float viewThroughSurface = sqrt(1.0 - (1.0 - viewRay.y * viewRay.y) / (1.333 * 1.333));
float opticalPath = min(underwaterDepth * waterDepthDensity / viewThroughSurface, maxOpticalPath);
float absorptionPath = opticalPath * waterAbsorptionOpticalPathScale;
vec3 waterTransmission = exp(-waterAbsorption * absorptionPath);
float lostLight = 1.0 - dot(waterTransmission, vec3(0.2126, 0.7152, 0.0722));
float scatteringPath = opticalPath * waterScatteringOpticalPathScale;
float scatteringDepthWeight = smoothstep(
  waterScatteringDepthStart,
  maxOpticalPath,
  scatteringPath
);
float scatteringEnergy = min(
  lostLight * waterScatteringStrength * waterScatteringContribution * scatteringDepthWeight,
  maxWaterScatteringEnergy
);
vec3 inScattering = waterScatteringColor * scatteringEnergy;
float causticLight = causticValue * 8.0 * min(causticStrength, 0.007) * exp(-underwaterDepth * 0.35);
// Sun-caustics cannot illuminate a face hidden from the sun. Modulate only
// direct diffuse light, leaving sky bounce and specular energy untouched.
vec3 submergedLight = (outgoingLight + reflectedLight.directDiffuse * causticLight) * waterTransmission + inScattering;
outgoingLight = mix(outgoingLight, submergedLight, underwaterMask);
outgoingLight *= 1.0 - wetContact * min(causticStrength * 2.0, 0.12);
#include <opaque_fragment>
`;

interface TriplanarShader extends THREE.WebGLProgramParametersWithUniforms {
  uniforms: THREE.WebGLProgramParametersWithUniforms["uniforms"] & {
    triplanarScale?: { value: number };
  };
}

const TRIPLANAR_VERTEX_HEADER = `
varying vec3 vTriWorldPosition;
varying vec3 vTriWorldNormal;
`;

const TRIPLANAR_VERTEX_POSITION = `
#include <worldpos_vertex>
vTriWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
vTriWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
`;

const TRIPLANAR_FRAGMENT_HEADER = `
uniform float triplanarScale;
// Width/height of the source map. A scanned set is not always square (the
// slate is 512x249); scaling V by the aspect keeps its real proportions
// without duplicating the image to force it square, which would halve the
// repeat distance. 1.0 for every square map.
uniform float triplanarAspect;
varying vec3 vTriWorldPosition;
varying vec3 vTriWorldNormal;
vec3 triplanarBlend;
#define TRI_UV_SCALE vec2(triplanarScale, triplanarScale * triplanarAspect)
`;

/**
 * World-space triplanar sampling for the coping ring/skirts and the
 * above-ground panel: their procedural detail no longer depends on the
 * mesh's own UVs, which stretch badly wherever a face turns away from its
 * "home" projection (the coping's rounded bevel going from horizontal top to
 * near-vertical side is exactly that case -- its UV is a flat XZ footprint
 * projection, degenerate once the face is nearly vertical). Blend weights
 * are computed once here, in `<roughnessmap_fragment>`, which three.js runs
 * before `<normal_fragment_maps>` -- reused there instead of recomputed.
 */
const TRIPLANAR_ROUGHNESS_FRAGMENT = `
float roughnessFactor = roughness;
// Blend weights must be computed unconditionally: <normal_fragment_maps>
// consumes them, and a scanned set without a roughness map (USE_ROUGHNESSMAP
// undefined) would otherwise leave them uninitialised -- degenerate normals
// that render the coping black and glossy.
vec3 triWorldNormalR = normalize(vTriWorldNormal);
triplanarBlend = normalize(max(abs(triWorldNormalR), vec3(0.00001)));
triplanarBlend = pow(triplanarBlend, vec3(4.0));
triplanarBlend /= (triplanarBlend.x + triplanarBlend.y + triplanarBlend.z);
#ifdef USE_ROUGHNESSMAP
  float triRoughX = texture2D(roughnessMap, vTriWorldPosition.zy * TRI_UV_SCALE).g;
  float triRoughY = texture2D(roughnessMap, vTriWorldPosition.xz * TRI_UV_SCALE).g;
  float triRoughZ = texture2D(roughnessMap, vTriWorldPosition.xy * TRI_UV_SCALE).g;
  roughnessFactor *=
    triRoughX * triplanarBlend.x + triRoughY * triplanarBlend.y + triRoughZ * triplanarBlend.z;
#endif
`;

const TRIPLANAR_NORMAL_FRAGMENT = `
vec3 triWorldNormalN = normalize(vTriWorldNormal);
vec3 triTangentX = texture2D(normalMap, vTriWorldPosition.zy * TRI_UV_SCALE).xyz * 2.0 - 1.0;
vec3 triTangentY = texture2D(normalMap, vTriWorldPosition.xz * TRI_UV_SCALE).xyz * 2.0 - 1.0;
vec3 triTangentZ = texture2D(normalMap, vTriWorldPosition.xy * TRI_UV_SCALE).xyz * 2.0 - 1.0;
triTangentX.xy *= normalScale;
triTangentY.xy *= normalScale;
triTangentZ.xy *= normalScale;
triTangentX = vec3(triTangentX.xy + triWorldNormalN.zy, abs(triTangentX.z) * triWorldNormalN.x);
triTangentY = vec3(triTangentY.xy + triWorldNormalN.xz, abs(triTangentY.z) * triWorldNormalN.y);
triTangentZ = vec3(triTangentZ.xy + triWorldNormalN.xy, abs(triTangentZ.z) * triWorldNormalN.z);
vec3 triBlendedWorldNormal = normalize(
  triTangentX.zyx * triplanarBlend.x +
  triTangentY.xzy * triplanarBlend.y +
  triTangentZ.xyz * triplanarBlend.z
);
normal = normalize(mat3(viewMatrix) * triBlendedWorldNormal);
`;

const ABOVE_GROUND_PANEL_WIDTH = 0.9;
const INTERIOR_FLOOR_COVE_RADIUS = 0.008;

function createAboveGroundPanelMap(size = 256): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#f7f8f6";
  context.fillRect(0, 0, size, size);

  const joint = context.createLinearGradient(0, 0, Math.max(6, size * 0.045), 0);
  joint.addColorStop(0, "#aeb4b1");
  joint.addColorStop(0.18, "#d4d8d5");
  joint.addColorStop(0.5, "#ffffff");
  joint.addColorStop(1, "#f7f8f6");
  context.fillStyle = joint;
  context.fillRect(0, 0, Math.max(6, size * 0.045), size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function useDisposable<T extends THREE.BufferGeometry>(factory: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(factory, deps);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function cloneDataTexture(
  source: THREE.Texture,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
) {
  const texture = source.clone();
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(Math.max(1, repeatX), Math.max(1, repeatY));
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The pool itself: coping ring, interior walls, floor, water body and the
 * concealed perimeter gutter used by residential overflow-edge systems.
 */
export function PoolModel({
  outline,
  depth,
  floorProfile,
  materials,
  system,
  overflowType,
  poolType,
  copingThickness,
  showWater,
  skimmers,
  poolAccess,
  internalStairType,
}: PoolModelProps) {
  const verticalLayout = getPoolVerticalLayout({
    poolType,
    system,
    overflowType,
    depth,
    copingThickness,
  });
  const waterLevel = verticalLayout.waterY;
  const isOverflow = system === "overflow";
  const isVisibleOverflow = isOverflow && overflowType === "visible";
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const copingOutline = useMemo(
    () => offsetOutline(outline, copingOuterOffset(system, overflowType)),
    [outline, system, overflowType],
  );
  // Must match the channel's outer edge exactly (hiddenChannelOffset), not a
  // point partway across it -- otherwise the deck coping caps most of the
  // receiving slot and the hidden channel never reads as open.
  const concealedCopingEdge = useMemo(
    () => offsetOutline(outline, OVERFLOW_GEOMETRY.hiddenChannelOffset),
    [outline],
  );
  const structuralOutline = useMemo(
    () => offsetOutline(outline, ABOVE_GROUND_STRUCTURE_THICKNESS),
    [outline],
  );
  const overflowWaterEdge = useMemo(
    () => offsetOutline(outline, OVERFLOW_GEOMETRY.waterEdgeOffset),
    [outline],
  );
  // Visible overflow edge, from the water outwards: basin -> raised kerb ->
  // grated channel. The kerb is carved out of the near side of the channel
  // band, so the grating simply starts further out and nothing beyond the
  // channel's outer edge moves.
  const overflowKerbOuter = useMemo(
    () => offsetOutline(outline, OVERFLOW_GEOMETRY.visibleKerbWidth),
    [outline],
  );
  const channelInnerEdge = isVisibleOverflow ? overflowKerbOuter : overflowWaterEdge;
  const overflowSlotEdge = useMemo(
    () => offsetOutline(outline, OVERFLOW_GEOMETRY.hiddenChannelOffset),
    [outline],
  );
  const overflowChannelOuter = useMemo(
    () => offsetOutline(outline, OVERFLOW_GEOMETRY.visibleChannelOuterOffset),
    [outline],
  );
  const waterOutline = useMemo(
    () => buildWaterOutline(outline, system, overflowType),
    [outline, system, overflowType],
  );
  const copingInner = isOverflow
    ? isVisibleOverflow
      ? overflowChannelOuter
      : concealedCopingEdge
    : outline;
  const copingSurfaceY = isOverflow ? waterLevel - 0.001 : verticalLayout.copingY;
  const perimeter = useMemo(() => outlinePerimeter(outline), [outline]);
  const structuralPerimeter = useMemo(
    () => outlinePerimeter(structuralOutline),
    [structuralOutline],
  );
  const openings = useMemo(() => {
    if (system !== "skimmer") return [];
    const p = SKIMMER_PROFILES[materials.skimmer.type];
    const centerY = verticalLayout.wallTopY - p.drop + p.center;
    return skimmers.positions.map((spot) => ({
      ...spot,
      width: p.width - p.bar * 2 + 0.008,
      top: centerY + p.height / 2 - p.bar + 0.004,
      bottom: centerY - p.height / 2 + p.bar - 0.004,
    }));
  }, [system, skimmers.positions, materials.skimmer.type, verticalLayout.wallTopY]);
  const sourceSurfaceMap = useSafeSurfaceTexture(materials.surface.maps.baseColorMap);

  const [floorSurfaceMap, wallSurfaceMap] = useMemo(() => {
    const floorMap = sourceSurfaceMap.clone();
    const wallMap = sourceSurfaceMap.clone();
    for (const texture of [floorMap, wallMap]) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = Math.min(ACTIVE_RENDERING_QUALITY.textureAnisotropy, maxAnisotropy);
    }
    floorMap.colorSpace = THREE.SRGBColorSpace;
    wallMap.colorSpace = THREE.SRGBColorSpace;
    floorMap.repeat.set(1 / materials.surface.tileSize, 1 / materials.surface.tileSize);
    wallMap.repeat.set(
      Math.max(1, perimeter / materials.surface.tileSize),
      Math.max(1, depth / materials.surface.tileSize),
    );
    for (const texture of [floorMap, wallMap]) texture.needsUpdate = true;
    return [floorMap, wallMap];
  }, [sourceSurfaceMap, materials.surface.tileSize, perimeter, depth, maxAnisotropy]);

  useEffect(
    () => () => {
      floorSurfaceMap.dispose();
      wallSurfaceMap.dispose();
    },
    [floorSurfaceMap, wallSurfaceMap],
  );

  const materialMicroNormal = useMemo(() => createMaterialMicroNormalMap(), []);
  const materialMicroRoughness = useMemo(() => createMaterialMicroRoughnessMap(), []);
  const materialMicroAo = useMemo(() => createMaterialMicroAoMap(), []);
  const dataAnisotropy = Math.min(ACTIVE_RENDERING_QUALITY.textureAnisotropy, maxAnisotropy);
  // Real bump/roughness/AO derived from the liner's or mosaic's own
  // photographed pattern when available; the generic sine-noise fields are
  // only a fallback (e.g. before the image has produced readable pixel data).
  const derivedSurfaceDetail = useMemo(
    () => getDerivedDetailMaps(sourceSurfaceMap),
    [sourceSurfaceMap],
  );
  const surfaceMicroNormal = derivedSurfaceDetail?.normalMap ?? materialMicroNormal;
  const surfaceMicroRoughness = derivedSurfaceDetail?.roughnessMap ?? materialMicroRoughness;
  const surfaceMicroAo = derivedSurfaceDetail?.aoMap ?? materialMicroAo;
  const interiorMicroMaps = useMemo(() => {
    const moduleSize = materials.surface.microDetail.moduleSize;
    const floorRepeat = 1 / moduleSize;
    const wallRepeatX = perimeter / moduleSize;
    const wallRepeatY = depth / moduleSize;
    return {
      floorNormal: cloneDataTexture(surfaceMicroNormal, floorRepeat, floorRepeat, dataAnisotropy),
      floorRoughness: cloneDataTexture(
        surfaceMicroRoughness,
        floorRepeat,
        floorRepeat,
        dataAnisotropy,
      ),
      floorAo: cloneDataTexture(surfaceMicroAo, floorRepeat, floorRepeat, dataAnisotropy),
      wallNormal: cloneDataTexture(surfaceMicroNormal, wallRepeatX, wallRepeatY, dataAnisotropy),
      wallRoughness: cloneDataTexture(
        surfaceMicroRoughness,
        wallRepeatX,
        wallRepeatY,
        dataAnisotropy,
      ),
      wallAo: cloneDataTexture(surfaceMicroAo, wallRepeatX, wallRepeatY, dataAnisotropy),
    };
  }, [
    surfaceMicroNormal,
    surfaceMicroRoughness,
    surfaceMicroAo,
    materials.surface.microDetail.moduleSize,
    perimeter,
    depth,
    dataAnisotropy,
  ]);

  const aboveGroundPanelMap = useMemo(() => createAboveGroundPanelMap(), []);
  const aboveGroundPanelBumpMap = useMemo(() => {
    const texture = aboveGroundPanelMap.clone();
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, [aboveGroundPanelMap]);
  // Cast-stone and manufactured-panel detail, sampled triplanar in-shader
  // (see configureCopingTriplanar/configurePanelTriplanar below) rather than
  // through the mesh's own UV -- these come from a module-level cache keyed
  // by material kind, so they are shared and must not be disposed here.
  // Scanned asset when the finish has one; procedural bake only as the
  // documented fallback for finishes whose real maps aren't sourced yet.
  const copingAssetDir = "asset" in materials.coping ? materials.coping.asset.dir : null;
  const copingAssetHasRoughness =
    "asset" in materials.coping && "roughnessMap" in materials.coping.asset
      ? materials.coping.asset.roughnessMap !== false
      : true;
  // Non-square scanned maps keep their real proportions via the shader's V
  // scale rather than being duplicated to a square, which would halve the
  // repeat distance along the coping run.
  const copingAssetAspect =
    "asset" in materials.coping && "aspect" in materials.coping.asset
      ? materials.coping.asset.aspect
      : 1;
  const copingDetail = useMemo(
    () =>
      copingAssetDir
        ? loadCopingTextureMaps(copingAssetDir, copingAssetHasRoughness)
        : COPING_STONE_BUILDERS[materials.coping.id](),
    [materials.coping.id, copingAssetDir, copingAssetHasRoughness],
  );
  useEffect(() => {
    const maps = Object.values(copingDetail).filter((map) => map !== null);
    maps.forEach((map) => {
      map.anisotropy = dataAnisotropy;
      map.needsUpdate = true;
    });
    return () => maps.forEach((map) => map.dispose());
  }, [copingDetail, dataAnisotropy]);
  const panelDetail = useMemo(() => createTriplanarDetailMaps("panel"), []);
  useEffect(
    () => () => {
      aboveGroundPanelMap.dispose();
      aboveGroundPanelBumpMap.dispose();
      materialMicroNormal.dispose();
      materialMicroRoughness.dispose();
      materialMicroAo.dispose();
    },
    [
      aboveGroundPanelMap,
      aboveGroundPanelBumpMap,
      materialMicroNormal,
      materialMicroRoughness,
      materialMicroAo,
    ],
  );
  useEffect(
    () => () => Object.values(interiorMicroMaps).forEach((texture) => texture.dispose()),
    [interiorMicroMaps],
  );

  const causticsShaders = useRef<UnderwaterShader[]>([]);
  const causticMap = useMemo(() => createCausticsMap(), []);
  useEffect(() => () => causticMap.dispose(), [causticMap]);
  const configureCaustics = useCallback(
    (shader: UnderwaterShader) => {
      shader.uniforms.causticTime = { value: 0 };
      shader.uniforms["causticMap"] = { value: causticMap };
      shader.uniforms.causticStrength = {
        value: showWater
          ? materials.surface.underwaterCausticStrength * WATER_VISUAL_PRESET.causticVisibility
          : 0,
      };
      shader.uniforms.causticScale = { value: WATER_VISUAL_PRESET.caustics.scale };
      shader.uniforms.waterLevel = { value: waterLevel };
      shader.uniforms.waterAbsorption = {
        value: new THREE.Vector3(...materials.surface.underwaterAbsorption),
      };
      shader.uniforms.waterScatteringColor = {
        value: new THREE.Vector3(...materials.surface.underwaterScatteringColor),
      };
      shader.uniforms.waterScatteringStrength = {
        value: materials.surface.underwaterScatteringStrength,
      };
      shader.uniforms.maxOpticalPath = { value: WATER_VISUAL_PRESET.maxOpticalPath };
      shader.uniforms.waterDepthDensity = { value: WATER_VISUAL_PRESET.depthDensity };
      shader.uniforms.waterScatteringContribution = {
        value: materials.surface.underwaterScatteringContribution,
      };
      shader.uniforms.maxWaterScatteringEnergy = {
        value: materials.surface.underwaterMaxScatteringEnergy,
      };
      shader.uniforms.waterScatteringDepthStart = {
        value: WATER_VISUAL_PRESET.scatteringDepthStart,
      };
      shader.uniforms.waterScatteringOpticalPathScale = {
        value: materials.surface.underwaterScatteringOpticalPathScale,
      };
      shader.uniforms.waterAbsorptionOpticalPathScale = {
        value: materials.surface.underwaterAbsorptionOpticalPathScale,
      };
      shader.vertexShader = shader.vertexShader
        .replace(
          "varying vec3 vViewPosition;",
          `varying vec3 vViewPosition;${CAUSTICS_VERTEX_HEADER}`,
        )
        .replace("#include <worldpos_vertex>", CAUSTICS_VERTEX_POSITION);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>${CAUSTICS_FRAGMENT_HEADER}`)
        .replace(
          "#include <opaque_fragment>",
          CAUSTICS_LIGHT_MODULATION.replace(
            "#include <opaque_fragment>",
            import.meta.env.DEV && import.meta.env["VITE_WATER_DEBUG"] === "directLight"
              ? "outgoingLight = reflectedLight.directDiffuse;\n#include <opaque_fragment>"
              : import.meta.env.DEV && import.meta.env["VITE_WATER_DEBUG"] === "strength"
                ? "outgoingLight = vec3(causticStrength * 10.0);\n#include <opaque_fragment>"
                : import.meta.env.DEV && import.meta.env["VITE_WATER_DEBUG"] === "caustics"
                  ? "outgoingLight = vec3(causticValue);\n#include <opaque_fragment>"
                  : "#include <opaque_fragment>",
          ),
        );
      applyLedTransmission(shader);
      if (!causticsShaders.current.includes(shader)) causticsShaders.current.push(shader);
    },
    [materials.surface, waterLevel, causticMap, showWater],
  );
  useFrame(({ clock }) => {
    // The path tracer never executes this onBeforeCompile-patched shader --
    // it reads the material's plain JS properties and builds its own
    // rendering path entirely, ignoring runtime GLSL patches. Real light
    // transport through the water also makes the manual caustics
    // approximation moot. Updating these uniforms would still be harmless
    // (the patched program simply isn't used for the traced image), but
    // skipping it avoids doing pointless work every frame.
    if (photoModeState.active) return;
    const time = clock.getElapsedTime();
    for (const shader of causticsShaders.current) {
      if (shader.uniforms.causticTime) {
        shader.uniforms.causticTime.value = time * WATER_VISUAL_PRESET.caustics.speed;
      }
      if (shader.uniforms.causticStrength) {
        shader.uniforms.causticStrength.value = showWater
          ? materials.surface.underwaterCausticStrength * WATER_VISUAL_PRESET.causticVisibility
          : 0;
      }
      if (shader.uniforms.waterLevel) shader.uniforms.waterLevel.value = waterLevel;
      if (shader.uniforms.waterAbsorption) {
        const absorption = showWater
          ? materials.surface.underwaterAbsorption
          : ([0, 0, 0] as const);
        shader.uniforms.waterAbsorption.value.set(absorption[0], absorption[1], absorption[2]);
      }
      if (shader.uniforms.waterScatteringColor) {
        const scatteringColor = materials.surface.underwaterScatteringColor;
        shader.uniforms.waterScatteringColor.value.set(
          scatteringColor[0],
          scatteringColor[1],
          scatteringColor[2],
        );
      }
      if (shader.uniforms.waterScatteringStrength) {
        shader.uniforms.waterScatteringStrength.value = showWater
          ? materials.surface.underwaterScatteringStrength
          : 0;
      }
      if (shader.uniforms.waterScatteringOpticalPathScale) {
        shader.uniforms.waterScatteringOpticalPathScale.value =
          materials.surface.underwaterScatteringOpticalPathScale;
      }
      if (shader.uniforms.waterAbsorptionOpticalPathScale) {
        shader.uniforms.waterAbsorptionOpticalPathScale.value =
          materials.surface.underwaterAbsorptionOpticalPathScale;
      }
      if (shader.uniforms.maxWaterScatteringEnergy) {
        shader.uniforms.maxWaterScatteringEnergy.value =
          materials.surface.underwaterMaxScatteringEnergy;
      }
      if (shader.uniforms.waterScatteringContribution) {
        shader.uniforms.waterScatteringContribution.value =
          materials.surface.underwaterScatteringContribution;
      }
    }
  });

  const configureCopingTriplanar = useCallback(
    (shader: TriplanarShader) => {
      shader.uniforms.triplanarScale = {
        value: 1 / materials.coping.moduleSize,
      };
      shader.uniforms["triplanarAspect"] = { value: copingAssetAspect };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>${TRIPLANAR_VERTEX_HEADER}`)
        .replace("#include <worldpos_vertex>", TRIPLANAR_VERTEX_POSITION);
      shader.uniforms["stoneColorMap"] = { value: copingDetail.colorMap };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>${TRIPLANAR_FRAGMENT_HEADER}\nuniform sampler2D stoneColorMap;`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
        vec3 stoneWeights = pow(abs(normalize(vTriWorldNormal)), vec3(4.0));
        stoneWeights /= max(dot(stoneWeights, vec3(1.0)), 0.0001);
        vec3 stoneColor = texture2D(stoneColorMap, vTriWorldPosition.zy * TRI_UV_SCALE).rgb * stoneWeights.x
          + texture2D(stoneColorMap, vTriWorldPosition.xz * TRI_UV_SCALE).rgb * stoneWeights.y
          + texture2D(stoneColorMap, vTriWorldPosition.xy * TRI_UV_SCALE).rgb * stoneWeights.z;
        diffuseColor.rgb *= stoneColor;
      `,
        )
        .replace("#include <roughnessmap_fragment>", TRIPLANAR_ROUGHNESS_FRAGMENT)
        .replace("#include <normal_fragment_maps>", TRIPLANAR_NORMAL_FRAGMENT);
    },
    [copingDetail, materials.coping.moduleSize, copingAssetAspect],
  );

  const configurePanelTriplanar = useCallback((shader: TriplanarShader) => {
    shader.uniforms.triplanarScale = {
      value: 1 / MATERIAL_MICRO_DETAIL_PRESET.aboveGroundPanel.moduleSize,
    };
    // Square source map.
    shader.uniforms["triplanarAspect"] = { value: 1 };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>${TRIPLANAR_VERTEX_HEADER}`)
      .replace("#include <worldpos_vertex>", TRIPLANAR_VERTEX_POSITION);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>${TRIPLANAR_FRAGMENT_HEADER}`)
      .replace("#include <roughnessmap_fragment>", TRIPLANAR_ROUGHNESS_FRAGMENT)
      .replace("#include <normal_fragment_maps>", TRIPLANAR_NORMAL_FRAGMENT);
  }, []);

  useEffect(() => {
    aboveGroundPanelMap.repeat.set(
      Math.max(1, Math.round(structuralPerimeter / ABOVE_GROUND_PANEL_WIDTH)),
      1,
    );
    aboveGroundPanelBumpMap.repeat.copy(aboveGroundPanelMap.repeat);
  }, [structuralPerimeter, aboveGroundPanelMap, aboveGroundPanelBumpMap]);

  const floor = useDisposable(
    () =>
      floorProfile.sloped
        ? createSlopedFloorGeometry(outline, floorProfile.floorYAt)
        : createSurfaceGeometry(outline),
    [outline, floorProfile],
  );
  const water = useDisposable(() => createSurfaceGeometry(waterOutline), [waterOutline]);
  const walls = useDisposable(
    () =>
      createInteriorWallGeometry(
        outline,
        verticalLayout.wallTopY,
        floorProfile.sloped ? floorProfile.floorYAt : verticalLayout.floorY,
        INTERIOR_FLOOR_COVE_RADIUS,
        2,
        openings,
      ),
    [outline, verticalLayout.wallTopY, verticalLayout.floorY, floorProfile, openings],
  );
  const exteriorWalls = useDisposable(
    () => createWallGeometry(structuralOutline, verticalLayout.wallTopY, verticalLayout.floorY),
    [structuralOutline, verticalLayout.wallTopY, verticalLayout.floorY],
  );
  const coping = useDisposable(
    () =>
      isVisibleOverflow
        ? new THREE.BufferGeometry()
        : createCopingSlabGeometry(copingInner, copingOutline, copingThickness),
    [copingInner, copingOutline, copingThickness, isVisibleOverflow],
  );
  const overflowLip = useDisposable(
    () =>
      isOverflow && !isVisibleOverflow
        ? createBeveledRingGeometry(outline, overflowWaterEdge, 0.003, 3)
        : new THREE.BufferGeometry(),
    [outline, overflowWaterEdge, isOverflow, isVisibleOverflow],
  );
  const copingBed = useDisposable(
    () =>
      isVisibleOverflow
        ? new THREE.BufferGeometry()
        : createRingGeometry(copingInner, copingOutline),
    [copingInner, copingOutline, isVisibleOverflow],
  );
  const grilleInnerSeat = useDisposable(
    () => createRingGeometry(overflowKerbOuter, offsetOutline(overflowKerbOuter, 0.012)),
    [overflowKerbOuter],
  );
  const grilleOuterSeat = useDisposable(
    () => createRingGeometry(offsetOutline(overflowChannelOuter, -0.012), overflowChannelOuter),
    [overflowChannelOuter],
  );
  const visibleOverflowGrate = useDisposable(
    () =>
      isVisibleOverflow
        ? createGrateGeometry(overflowKerbOuter, overflowChannelOuter)
        : new THREE.BufferGeometry(),
    [overflowChannelOuter, overflowKerbOuter, isVisibleOverflow],
  );
  const channelFloor = useDisposable(
    () =>
      isOverflow
        ? createRingGeometry(
            channelInnerEdge,
            isVisibleOverflow ? overflowChannelOuter : overflowSlotEdge,
          )
        : new THREE.BufferGeometry(),
    [isOverflow, isVisibleOverflow, channelInnerEdge, overflowChannelOuter, overflowSlotEdge],
  );
  const channelInnerWall = useDisposable(
    () =>
      isOverflow
        ? createWallGeometry(
            // Recess the grille's channel wall beneath its seat; it must
            // not overlap the basin liner at the same XZ plane.
            isVisibleOverflow ? offsetOutline(channelInnerEdge, 0.012) : channelInnerEdge,
            isVisibleOverflow ? verticalLayout.wallTopY - 0.013 : waterLevel - 0.003,
            verticalLayout.wallTopY - OVERFLOW_GEOMETRY.channelDepth,
          )
        : new THREE.BufferGeometry(),
    [isOverflow, isVisibleOverflow, channelInnerEdge, waterLevel, verticalLayout.wallTopY],
  );
  const overflowChannelWall = useDisposable(
    () =>
      createWallGeometry(
        overflowSlotEdge,
        verticalLayout.wallTopY - 0.018,
        verticalLayout.wallTopY - OVERFLOW_GEOMETRY.channelDepth,
      ),
    [overflowSlotEdge, verticalLayout.wallTopY],
  );
  const overflowKerbTopY = verticalLayout.wallTopY + OVERFLOW_GEOMETRY.visibleKerbRise;
  const overflowKerbTop = useDisposable(
    () =>
      isVisibleOverflow
        ? createRingGeometry(outline, overflowKerbOuter)
        : new THREE.BufferGeometry(),
    [outline, overflowKerbOuter, isVisibleOverflow],
  );
  const overflowKerbInnerFace = useDisposable(
    () =>
      isVisibleOverflow
        ? createWallGeometry(outline, overflowKerbTopY, verticalLayout.wallTopY - 0.05)
        : new THREE.BufferGeometry(),
    [outline, overflowKerbTopY, verticalLayout.wallTopY, isVisibleOverflow],
  );
  const overflowKerbOuterFace = useDisposable(
    () =>
      isVisibleOverflow
        ? createWallGeometry(overflowKerbOuter, overflowKerbTopY, verticalLayout.wallTopY - 0.014)
        : new THREE.BufferGeometry(),
    [overflowKerbOuter, overflowKerbTopY, verticalLayout.wallTopY, isVisibleOverflow],
  );
  const visibleOverflowChannelWall = useDisposable(
    () =>
      createWallGeometry(
        overflowChannelOuter,
        verticalLayout.wallTopY - 0.012,
        verticalLayout.wallTopY - OVERFLOW_GEOMETRY.channelDepth,
      ),
    [overflowChannelOuter, verticalLayout.wallTopY],
  );

  return (
    <group>
      {/* Interior walls, floor, water and overflow channel: everything that
          physically sits inside the basin. Named so the planar water
          reflector can hide it for its mirror-camera pass — from below the
          waterline these surfaces would otherwise render nonsensical
          close-up backfaces instead of a clean sky/coping reflection. */}
      <group name="pool-basin">
        <PoolAccessModel
          outline={outline}
          access={poolAccess}
          stairType={internalStairType}
          floorProfile={floorProfile}
          topY={verticalLayout.copingY}
        >
          <meshPhysicalMaterial
            color={materials.liner.color}
            map={floorSurfaceMap}
            normalMap={interiorMicroMaps.floorNormal}
            normalScale={[
              materials.surface.microDetail.normalStrength,
              materials.surface.microDetail.normalStrength,
            ]}
            roughness={materials.liner.roughness}
            metalness={materials.liner.metalness}
            onBeforeCompile={configureCaustics}
            customProgramCacheKey={() =>
              `depth-aware-underwater-optics-v4-${LED_TRANSPORT_CACHE_KEY}`
            }
          />
        </PoolAccessModel>
        {/* Interior walls */}
        <mesh geometry={walls} renderOrder={0} receiveShadow castShadow>
          <meshPhysicalMaterial
            color={materials.liner.color}
            map={wallSurfaceMap}
            normalMap={interiorMicroMaps.wallNormal}
            normalScale={[
              materials.surface.microDetail.normalStrength,
              materials.surface.microDetail.normalStrength,
            ]}
            roughnessMap={interiorMicroMaps.wallRoughness}
            aoMap={interiorMicroMaps.wallAo}
            aoMapIntensity={0.6}
            roughness={materials.liner.roughness}
            metalness={materials.liner.metalness}
            clearcoat={showWater ? 0.04 : materials.surface.wallClearcoat}
            ior={showWater ? 1.2 : 1.5}
            clearcoatRoughness={materials.surface.wallClearcoatRoughness}
            reflectivity={0.42}
            envMapIntensity={1.0}
            specularIntensity={0.58}
            onBeforeCompile={configureCaustics}
            customProgramCacheKey={() =>
              `depth-aware-underwater-optics-v4-${LED_TRANSPORT_CACHE_KEY}`
            }
            side={DoubleSide}
          />
        </mesh>

        {/* Floor with animated caustics. Sloped floors bake their absolute
            world Y into every vertex (see createSlopedFloorGeometry), so
            the mesh itself sits at the origin; flat floors keep the single
            constant-Y geometry raised by `position`, exactly as before. */}
        <mesh
          geometry={floor}
          position={floorProfile.sloped ? [0, 0, 0] : [0, verticalLayout.floorY, 0]}
          receiveShadow
        >
          <meshPhysicalMaterial
            color={materials.floor.color}
            map={floorSurfaceMap}
            normalMap={interiorMicroMaps.floorNormal}
            normalScale={[
              materials.surface.microDetail.normalStrength,
              materials.surface.microDetail.normalStrength,
            ]}
            roughnessMap={interiorMicroMaps.floorRoughness}
            aoMap={interiorMicroMaps.floorAo}
            aoMapIntensity={0.6}
            roughness={materials.floor.roughness}
            metalness={0}
            clearcoat={showWater ? 0 : materials.surface.floorClearcoat}
            ior={showWater ? 1.13 : 1.5}
            clearcoatRoughness={materials.surface.floorClearcoatRoughness}
            reflectivity={0.38}
            envMapIntensity={0.95}
            onBeforeCompile={configureCaustics}
            customProgramCacheKey={() =>
              `depth-aware-underwater-optics-v4-${LED_TRANSPORT_CACHE_KEY}`
            }
            side={DoubleSide}
          />
        </mesh>

        {/* Water body — animated ripples, refraction, real planar reflection */}
        {showWater ? (
          <mesh geometry={water} position={[0, waterLevel, 0]} renderOrder={2}>
            <WaterSurfaceMaterial
              waterLevel={waterLevel}
              depth={waterLevel - verticalLayout.floorY}
              outline={waterOutline}
            />
          </mesh>
        ) : null}

        {/* Overflow variants share the pool outline but expose different sections. */}
        {isOverflow ? (
          <group>
            <mesh
              geometry={channelFloor}
              position={[0, verticalLayout.wallTopY - OVERFLOW_GEOMETRY.channelDepth, 0]}
              receiveShadow
            >
              <meshStandardMaterial color="#394340" roughness={0.54} side={DoubleSide} />
            </mesh>
            <mesh geometry={channelInnerWall} receiveShadow>
              <meshStandardMaterial color="#4b5350" roughness={0.45} side={DoubleSide} />
            </mesh>
            {!isVisibleOverflow && (
              <mesh
                name="overflow-edge-without-grille"
                geometry={overflowLip}
                position={[0, waterLevel - 0.001, 0]}
                receiveShadow
              >
                <meshPhysicalMaterial
                  key={materials.coping.moduleSize}
                  color={materials.coping.color}
                  normalMap={copingDetail.normalMap}
                  normalScale={[materials.coping.normalStrength, materials.coping.normalStrength]}
                  roughnessMap={copingDetail.roughnessMap}
                  roughness={materials.coping.roughness * 0.8}
                  onBeforeCompile={configureCopingTriplanar}
                  customProgramCacheKey={() => "overflow-stone-continuity-v3"}
                  clearcoat={0}
                  clearcoatRoughness={0.12}
                  side={DoubleSide}
                />
              </mesh>
            )}
            {isVisibleOverflow ? (
              <>
                {/* Front-face only (not DoubleSide): this wall sits at the
                    pool's true outer edge, so its backface is what the
                    exterior camera sees -- DoubleSide was leaking this dark
                    channel colour through as a black exterior band. */}
                <mesh geometry={visibleOverflowChannelWall} receiveShadow castShadow>
                  <meshStandardMaterial color="#242929" roughness={0.9} metalness={0.08} />
                </mesh>
                <mesh
                  geometry={grilleInnerSeat}
                  position={[0, verticalLayout.wallTopY - 0.013, 0]}
                  receiveShadow
                >
                  <meshStandardMaterial color="#77796f" roughness={0.68} side={DoubleSide} />
                </mesh>
                <mesh
                  geometry={grilleOuterSeat}
                  position={[0, verticalLayout.wallTopY - 0.013, 0]}
                  receiveShadow
                >
                  <meshStandardMaterial color="#77796f" roughness={0.68} side={DoubleSide} />
                </mesh>
                {/* The kerb: the raised band the basin is contained by, and
                    the first thing outboard of the water. Mitred ring on top,
                    a face down into the basin and a face down onto the grille
                    seat, so it reads as one solid edge from every angle. */}
                <mesh
                  name="overflow-kerb"
                  geometry={overflowKerbTop}
                  position={[0, overflowKerbTopY, 0]}
                  receiveShadow
                  castShadow
                >
                  <meshStandardMaterial color="#eceae3" roughness={0.62} side={DoubleSide} />
                </mesh>
                <mesh geometry={overflowKerbInnerFace} receiveShadow castShadow>
                  <meshStandardMaterial color="#e6e4dd" roughness={0.66} side={DoubleSide} />
                </mesh>
                <mesh geometry={overflowKerbOuterFace} receiveShadow castShadow>
                  <meshStandardMaterial color="#e6e4dd" roughness={0.66} side={DoubleSide} />
                </mesh>
                <mesh
                  name="overflow-grille"
                  geometry={visibleOverflowGrate}
                  position={[
                    0,
                    verticalLayout.wallTopY + OVERFLOW_GEOMETRY.visibleGrateTopOffset,
                    0,
                  ]}
                  receiveShadow
                  castShadow
                >
                  <meshStandardMaterial
                    color="#e5e3dc"
                    roughness={0.48}
                    metalness={0}
                    side={DoubleSide}
                  />
                </mesh>
              </>
            ) : (
              <>
                <mesh geometry={overflowChannelWall} receiveShadow castShadow>
                  <meshStandardMaterial
                    color="#171b1b"
                    roughness={0.94}
                    metalness={0.01}
                    side={DoubleSide}
                  />
                </mesh>
              </>
            )}
          </group>
        ) : null}
      </group>

      {poolType === "above-ground" ? (
        <mesh geometry={exteriorWalls} receiveShadow castShadow>
          <meshStandardMaterial
            color="#ffffff"
            map={aboveGroundPanelMap}
            bumpMap={aboveGroundPanelBumpMap}
            bumpScale={0.004}
            normalMap={panelDetail.normalMap}
            normalScale={[
              MATERIAL_MICRO_DETAIL_PRESET.aboveGroundPanel.normalStrength,
              MATERIAL_MICRO_DETAIL_PRESET.aboveGroundPanel.normalStrength,
            ]}
            roughnessMap={panelDetail.roughnessMap}
            roughness={0.74}
            metalness={0}
            onBeforeCompile={configurePanelTriplanar}
            customProgramCacheKey={() => "triplanar-panel-detail-v2"}
            side={DoubleSide}
          />
        </mesh>
      ) : null}

      {/* Coping / deck ring -- normal/roughness sampled triplanar in world
          space (see configureCopingTriplanar) so the rounded bevel, which
          turns from horizontal to near-vertical, never stretches the way a
          UV projected flat from the ring's XZ footprint would. */}
      {!isVisibleOverflow && (
        <group name="pool-perimeter-finish">
          <mesh geometry={copingBed} position={[0, copingSurfaceY - 0.006, 0]} receiveShadow>
            <meshStandardMaterial color="#938b7b" roughness={0.96} side={DoubleSide} />
          </mesh>
          <mesh geometry={coping} position={[0, copingSurfaceY, 0]} receiveShadow castShadow>
            <meshPhysicalMaterial
              key={materials.coping.moduleSize}
              color={materials.coping.color}
              vertexColors
              normalMap={copingDetail.normalMap}
              normalScale={[materials.coping.normalStrength, materials.coping.normalStrength]}
              roughnessMap={copingDetail.roughnessMap}
              roughness={materials.coping.roughness}
              metalness={0}
              clearcoat={0}
              clearcoatRoughness={0.45}
              onBeforeCompile={configureCopingTriplanar}
              customProgramCacheKey={() => "coping-triplanar-v4"}
              side={DoubleSide}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
