import { AboveGroundCladding } from "./AboveGroundCladding";
import {
  claddingFaceOffset,
  DEFAULT_EXTERIOR_PANEL_FINISH,
  type ExteriorPanelFinishId,
} from "@/lib/pool/above-ground";
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
  createLinerSampleMap,
  createMaterialMicroNormalMap,
  createMaterialMicroRoughnessMap,
  createTriplanarDetailMaps,
  getDerivedDetailMaps,
} from "./textures";
import { WaterSurfaceMaterial } from "./WaterSurfaceMaterial";
import { RetainedStageMaterial } from "./RetainedStageMaterial";
import { configureMosaicSampling, MOSAIC_SAMPLING_REVISION } from "./mosaicSampling";
import { requestMosaicTexture } from "./mosaicTexture";
import { PoolAccessModel } from "./PoolAccessModel";
import { PoolComfortModel, HydroSpot } from "./PoolComfortModel";
import { RawShellMaterial, type RawShellKind } from "./RawShellMaterial";
import type { StructureFamily } from "@/lib/pool/construction-presentation";
import { subdivideFloorBoundary } from "@/lib/pool/floor-profile";
import { accessMounting } from "@/lib/pool/access-plan";
import { applyLedTransmission, createMicroSpotTransport, updateMicroSpotTransport, LED_TRANSPORT_CACHE_KEY } from "./ledTransmission";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";
import {
  createAnthraciteMaps,
  createLimestoneMaps,
  createPrunMaps,
  createSlateMaps,
  createTravertineMaps,
  createWoodDeckMaps,
  createWPCMaps,
  loadCopingTextureMaps,
  configureExteriorRoughness,
  legacyMineralTextureScale,
  LEGACY_MINERAL_SAMPLER_REVISION,
  type StoneMaps,
} from "./stoneTextures";
import type { CopingMaterialId } from "@/lib/pool/coping-materials";
import { configureDeckCopingGrain } from "./deckCopingGrain";
import { isReferenceFinish } from "@/lib/pool/reference-finishes";
import { configureReferenceCoping, loadReferenceFinishMaps, REFERENCE_SAMPLER_REVISION } from "./referenceFinishTexture";

/** Each premium coping finish gets its own procedural stone bake (distinct
 * structural DNA -- vein/grain/pore character), never a shared texture with
 * only color/roughness retinted -- see stoneTextures.ts. */
const COPING_STONE_BUILDERS: Partial<Record<CopingMaterialId, (size?: number) => StoneMaps>> = {
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
import type { Outline, OverflowType, PoolFeatureId, PoolShapeId, PoolType, SystemType } from "@/lib/pool/types";
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
  concealedOverflowSection,
  copingOuterOffset,
  createCopingSlabGeometry,
  squareInfinityCopingEnds,
  createGrateGeometry,
  SKIMMER_PROFILES,
} from "./poolConstruction";
import { InfinityEdge } from "./InfinityEdge";
import { infinityZonesForOutline, clampInfinityEdgeDimensions } from "@/lib/pool/infinity-edge";
import { infinityContainmentLevels } from "./infinityContainment";
import type { InfinityEdgeParams } from "@/lib/pool/infinity-edge";
import type { InfinityExclusion } from "@/lib/pool/walls.ts";

interface PoolModelProps {
  resolvedLayout: import("@/lib/pool/resolved-layout").ResolvedPoolLayout;
  features: ReadonlyArray<PoolFeatureId>;
  poolAccess: import("@/lib/pool/types").PoolAccess | null;
  internalStairType: import("@/lib/pool/types").InternalStairType;
  shape: PoolShapeId;
  outline: Outline;
  depth: number;
  floorProfile: FloorProfileModel;
  materials: ResolvedMaterials;
  system: SystemType;
  overflowType: OverflowType;
  poolType: PoolType;
  copingThickness: number;
  pavingThickness?: number;
  showWater: boolean;
  planView?: boolean;
  /** Above-ground exterior cladding finish. */
  exteriorPanelFinish?: ExteriorPanelFinishId;
  rawStructure?: StructureFamily | null;
  structureFamily?: StructureFamily | null;
  showAccessories?: boolean;
  /** Night scene: hydromassage micro-spots glow. */
  night?: boolean;
  ledColor?: string | undefined;
  ledIntensity?: number | undefined;
  skimmers: SkimmerPlan;
  /** Geometry Pass D (Infinity, Rectangle + L-shape). Only meaningful
   * while `system === "infinity"`. */
  infinityEdge?: InfinityEdgeParams;
  infinityExcluded?: InfinityExclusion | null;
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
function useSafeSurfaceTexture(url: string, mosaic = false) {
  const [texture, setTexture] = useState<THREE.Texture>(() => createNeutralSurfaceTexture());

  useEffect(() => {
    if (mosaic) return requestMosaicTexture(url, loadedTexture => {
      setTexture(previous => { previous.dispose(); return loadedTexture; });
    }, error => console.warn(`[Pool3D] Could not load mosaic texture ${url}; retaining current finish.`, error));
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
  }, [url, mosaic]);

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
  vec2 p = position * 0.4;
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
// Reject the diffuse pedestal from the soft, crossed texture projections.
// Concentrations retain their peak gain; the whole floor is not brightened.
float causticLight = smoothstep(0.08, 0.24, causticValue) * 10.0
  * min(causticStrength, 0.035) * exp(-underwaterDepth * 0.35);
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

/** Coping only: per-slab stone frame (see `createCopingSlabGeometry`).
 * Meshes without the attribute read WebGL's default (0,0,0,1): world space,
 * no swap, a constant offset -- i.e. the plain triplanar mapping. */
const COPING_SLAB_VERTEX_HEADER = `
varying vec3 vTriWorldPosition;
varying vec3 vTriWorldNormal;
varying float vTriSwap;
attribute vec4 slabFrame;
`;
const COPING_SLAB_VERTEX_POSITION = `
#include <worldpos_vertex>
vec3 triWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vec3 triNormal = normalize(mat3(modelMatrix) * objectNormal);
vec2 triLocal = triWorld.xz - slabFrame.xy;
if (slabFrame.z > 0.5) { triLocal = triLocal.yx; triNormal = triNormal.zyx; }
vec2 triShift = vec2(slabFrame.w * 37.0, fract(slabFrame.w * 7.31) * 23.0);
vTriWorldPosition = vec3(triLocal.x + triShift.x, triWorld.y, triLocal.y + triShift.y);
vTriWorldNormal = triNormal;
vTriSwap = slabFrame.z;
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
  resolvedLayout,
  features,
  outline,
  shape,
  depth,
  floorProfile,
  materials,
  system,
  overflowType,
  poolType,
  copingThickness,
  pavingThickness = 0.02,
  showWater,
  planView = false,
  exteriorPanelFinish = DEFAULT_EXTERIOR_PANEL_FINISH,
  rawStructure = null,
  structureFamily = null,
  showAccessories = true,
  night = false,
  ledColor,
  ledIntensity,
  skimmers,
  poolAccess,
  internalStairType,
  infinityEdge,
  infinityExcluded = null,
}: PoolModelProps) {
  // Prepare water only when first shown, then retain its resources across
  // construction/finished-stage navigation instead of recompiling on return.
  const [waterPrepared, setWaterPrepared] = useState(showWater);
  useEffect(() => {
    if (showWater) setWaterPrepared(true);
  }, [showWater]);
  const isInfinity = system === "infinity" && infinityEdge?.enabled === true;
  // Rectangle + L-shape this pass: `infinityZonesForOutline` is honestly
  // empty for Organic (or any outline with no candidate zones), so
  // `excludeSection` stays `null` and every coping/ring builder below
  // renders its normal, full, byte-identical geometry.
  const infinitySection = useMemo(() => {
    if (!isInfinity || infinityEdge?.side === null || infinityEdge?.side === undefined) return null;
    const zones = infinityZonesForOutline(outline, shape);
    const zone = zones.find((zone) => zone.side === infinityEdge.side);
    return zone
      ? new Set(
          Array.from(
            { length: zone.points.length - 1 },
            (_, i) => (zone.side + i) % outline.length,
          ),
        )
      : null;
  }, [isInfinity, infinityEdge, outline, shape]);
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
  const isContinuousOverflow = isOverflow && overflowType === "continuous" && poolType !== "above-ground";
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const copingOutline = useMemo(
    () => offsetOutline(outline, copingOuterOffset(system, overflowType)),
    [outline, system, overflowType],
  );
  const hiddenSection = isContinuousOverflow
    ? { ...concealedOverflowSection(verticalLayout.wallTopY, copingThickness),
        copingInnerOffset: 0, copingTopY: verticalLayout.copingY,
        copingBottomY: verticalLayout.copingY - pavingThickness }
    : concealedOverflowSection(verticalLayout.wallTopY, copingThickness);
  // Conceal the collector beneath the solid coping, leaving its narrow intake.
  const concealedCopingEdge = useMemo(
    () => offsetOutline(outline, hiddenSection.copingInnerOffset),
    [outline, hiddenSection.copingInnerOffset],
  );
  const structuralOutline = useMemo(
    () =>
      offsetOutline(
        outline,
        poolType === "above-ground"
          ? claddingFaceOffset(copingOuterOffset(system, overflowType))
          : isVisibleOverflow
          ? OVERFLOW_GEOMETRY.visibleChannelOuterOffset + 0.025
          : ABOVE_GROUND_STRUCTURE_THICKNESS,
      ),
    [outline, isVisibleOverflow, poolType, system, overflowType],
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
  const copingSurfaceY = isOverflow
    ? isVisibleOverflow ? waterLevel - 0.001 : hiddenSection.copingTopY
    : verticalLayout.copingY;
  const perimeter = useMemo(() => outlinePerimeter(outline), [outline]);
  const structuralPerimeter = useMemo(
    () => outlinePerimeter(structuralOutline),
    [structuralOutline],
  );
  const openings = useMemo(() => {
    if (isInfinity && infinityEdge?.wallType === "glass") {
      const zone = infinityZonesForOutline(outline, shape).find(z => z.side === infinityEdge.side);
      const bottom = infinityContainmentLevels(clampInfinityEdgeDimensions(undefined), waterLevel).baseY;
      return zone ? zone.points.slice(0, -1).map((a, i) => {
        const b = zone.points[i + 1]!;
        return { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2,
          rotation: -Math.atan2(b[1] - a[1], b[0] - a[0]),
          width: Math.hypot(b[0] - a[0], b[1] - a[1]), top: verticalLayout.wallTopY + 0.01, bottom };
      }) : [];
    }
    if (system !== "skimmer") return [];
    const p = SKIMMER_PROFILES[materials.skimmer.type];
    const centerY = verticalLayout.wallTopY - p.drop + p.center;
    return skimmers.positions.map((spot) => ({
      ...spot,
      width: p.width - p.bar * 2 + 0.008,
      top: centerY + p.height / 2 - p.bar + 0.004,
      bottom: centerY - p.height / 2 + p.bar - 0.004,
    }));
  }, [system, skimmers.positions, materials.skimmer.type, verticalLayout.wallTopY, isInfinity, infinityEdge, outline, shape, waterLevel]);
  const sourceSurfaceMap = useSafeSurfaceTexture(materials.surface.maps.baseColorMap, materials.surface.kind === "mosaic");
  const calibratedSurfaceMap = useMemo(() => materials.surface.calibrateSample
    ? createLinerSampleMap(sourceSurfaceMap) : sourceSurfaceMap,
  [sourceSurfaceMap, materials.surface.calibrateSample]);
  useEffect(() => () => {
    if (calibratedSurfaceMap !== sourceSurfaceMap) calibratedSurfaceMap.dispose();
  }, [calibratedSurfaceMap, sourceSurfaceMap]);

  const [floorSurfaceMap, wallSurfaceMap] = useMemo(() => {
    const floorMap = calibratedSurfaceMap.clone();
    const wallMap = calibratedSurfaceMap.clone();
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
      materials.surface.kind === "liner" ? perimeter / materials.surface.tileSize : Math.max(1, perimeter / materials.surface.tileSize),
      materials.surface.kind === "liner" ? depth / materials.surface.tileSize : Math.max(1, depth / materials.surface.tileSize),
    );
    for (const texture of [floorMap, wallMap]) texture.needsUpdate = true;
    return [floorMap, wallMap];
  }, [calibratedSurfaceMap, materials.surface.tileSize, materials.surface.kind, perimeter, depth, maxAnisotropy]);

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
    // Every photo-derived map describes the same patch as its colour image,
    // including mosaic sheets of 8 × 8 (or 9 × 9) tesserae.
    // The fallback micrograin keeps its independent small-scale repeat.
    const moduleSize = derivedSurfaceDetail
      ? materials.surface.tileSize : materials.surface.microDetail.moduleSize;
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
    materials.surface.tileSize,
    derivedSurfaceDetail,
    materials.surface.kind,
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
  const copingAssetHasNormal = !("asset" in materials.coping && "normalMap" in materials.coping.asset && materials.coping.asset.normalMap === false);
  const copingAssetMirrored = "asset" in materials.coping && "mirroredRepeat" in materials.coping.asset && materials.coping.asset.mirroredRepeat;
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
      isReferenceFinish(materials.coping.id)
        ? loadReferenceFinishMaps(materials.coping.id)
        : copingAssetDir
        ? loadCopingTextureMaps(copingAssetDir, copingAssetHasRoughness, copingAssetHasNormal, copingAssetMirrored)
        : COPING_STONE_BUILDERS[materials.coping.id]!(),
    [materials.coping.id, copingAssetDir, copingAssetHasRoughness, copingAssetHasNormal, copingAssetMirrored],
  );
  useEffect(() => {
    const maps = Object.values(copingDetail).filter((map) => map !== null);
    maps.forEach((map) => {
      map.anisotropy = dataAnisotropy;
      // TextureLoader returns an empty placeholder immediately. It marks
      // the texture dirty itself after the image arrives; uploading here
      // before that point produces the GPU "no image data" warning.
      if (map.image) map.needsUpdate = true;
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
  const microSpotTransport = useMemo(() => createMicroSpotTransport(), []);
  const microSpotSources = useMemo(() => night && showWater && showAccessories ? [
    ...(features.includes("stairLighting") ? resolvedLayout.stairMicroSpots : []),
    ...(features.includes("hydromassageBenchLighting") ? resolvedLayout.comfort.elements.flatMap(element => element.spots ?? []) : []),
  ] : [], [night, showWater, showAccessories, features, resolvedLayout]);
  // The same uniform objects are held by all compiled liner/comfort materials;
  // updates reach existing programs even when source count stays unchanged.
  updateMicroSpotTransport(microSpotTransport, microSpotSources);
  const causticMap = useMemo(() => createCausticsMap(), []);
  useEffect(() => () => causticMap.dispose(), [causticMap]);
  const configureCaustics = useCallback(
    (shader: UnderwaterShader) => {
      // Dry finish is a presentation stage, never a second underwater calibration.
      if (!showWater) return;
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
      applyLedTransmission(shader, microSpotTransport);
      if (!causticsShaders.current.includes(shader)) causticsShaders.current.push(shader);
    },
    [materials.surface, waterLevel, causticMap, showWater, microSpotTransport],
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

  const copingJointColor = useMemo(
    () => new THREE.Color(materials.coping.color).multiplyScalar(0.9),
    [materials.coping.color],
  );
  // Reference selections share shader programs, but own their source/crop
  // uniforms. A fresh material installs those uniforms even at the same scale.
  const referenceCoping = isReferenceFinish(materials.coping.id);
  const legacyMineralKey = materials.coping.id === "ardesia" || materials.coping.id === "prun"
    ? `-${materials.coping.id}-${LEGACY_MINERAL_SAMPLER_REVISION}-metric` : "";
  const copingMaterialKey = referenceCoping ? `${materials.coping.id}-photographic-v2-${REFERENCE_SAMPLER_REVISION}`
    : materials.coping.id === "travertine" ? `${materials.coping.moduleSize}-dry-honed-v1` : `${materials.coping.moduleSize}${legacyMineralKey}`;
  const referenceProgramKey = referenceCoping ? `-${REFERENCE_SAMPLER_REVISION}-${materials.coping.id === "reference-ipe" ? "reference-ipe-v8-continuous-single-board" : "reference-stone-v6-shared-sampler"}`
    : materials.coping.id === "travertine" ? "-dry-honed-v1" : legacyMineralKey;
  const configureCopingTriplanar = useCallback(
    (shader: TriplanarShader) => {
      shader.uniforms.triplanarScale = {
        value: legacyMineralTextureScale(materials.coping.id) / materials.coping.moduleSize,
      };
      shader.uniforms["triplanarAspect"] = { value: copingAssetAspect };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>${COPING_SLAB_VERTEX_HEADER}`)
        .replace("#include <worldpos_vertex>", COPING_SLAB_VERTEX_POSITION);
      shader.uniforms["stoneColorMap"] = { value: copingDetail.colorMap };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>${TRIPLANAR_FRAGMENT_HEADER}\nuniform sampler2D stoneColorMap;\nvarying float vTriSwap;`,
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
        .replace(
          "#include <normal_fragment_maps>",
          // Back from the slab's (possibly X/Z-swapped) frame to world space.
          TRIPLANAR_NORMAL_FRAGMENT.replace(
            "normal = normalize(mat3(viewMatrix) * triBlendedWorldNormal);",
            "if (vTriSwap > 0.5) triBlendedWorldNormal = triBlendedWorldNormal.zyx;\nnormal = normalize(mat3(viewMatrix) * triBlendedWorldNormal);",
          ),
        );
      if (materials.coping.id === "deck-marrone") configureDeckCopingGrain(shader);
      if (isReferenceFinish(materials.coping.id)) configureReferenceCoping(shader, materials.coping.id);
      configureExteriorRoughness(shader, materials.coping.id);
    },
    [copingDetail, materials.coping.moduleSize, materials.coping.id, copingAssetAspect],
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
        ? createSlopedFloorGeometry(outline, floorProfile.floorYAt, floorProfile)
        : createSurfaceGeometry(outline),
    [outline, floorProfile],
  );
  const water = useDisposable(() => createSurfaceGeometry(waterOutline), [waterOutline]);
  const walls = useDisposable(
    () =>
      createInteriorWallGeometry(
        subdivideFloorBoundary(outline, floorProfile),
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
  const terminatedCopingOutline = useMemo(
    () => squareInfinityCopingEnds(copingInner, copingOutline, infinitySection),
    [copingInner, copingOutline, infinitySection],
  );
  const coping = useDisposable(
    () =>
      isVisibleOverflow || isContinuousOverflow
        ? new THREE.BufferGeometry()
        : createCopingSlabGeometry(copingInner, terminatedCopingOutline, copingThickness, infinitySection,
            materials.coping.id === "deck-marrone" || materials.coping.id === "reference-ipe"),
    [copingInner, terminatedCopingOutline, copingThickness, isVisibleOverflow, isContinuousOverflow, infinitySection, materials.coping.id],
  );
  const overflowLip = useDisposable(
    () =>
      isOverflow && !isVisibleOverflow && !isContinuousOverflow
        ? createBeveledRingGeometry(outline, overflowWaterEdge, 0.003, 3)
        : new THREE.BufferGeometry(),
    [outline, overflowWaterEdge, isOverflow, isVisibleOverflow, isContinuousOverflow],
  );
  const copingBed = useDisposable(
    () =>
      isVisibleOverflow || isContinuousOverflow
        ? new THREE.BufferGeometry()
        : createRingGeometry(copingInner, terminatedCopingOutline, false, infinitySection),
    [copingInner, terminatedCopingOutline, isVisibleOverflow, isContinuousOverflow, infinitySection],
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
        ? createGrateGeometry(overflowKerbOuter, overflowChannelOuter, poolType === "above-ground" ? 0.016 : 0.022)
        : new THREE.BufferGeometry(),
    [overflowChannelOuter, overflowKerbOuter, isVisibleOverflow, poolType],
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
        hiddenSection.copingBottomY,
        verticalLayout.wallTopY - OVERFLOW_GEOMETRY.channelDepth,
      ),
    [overflowSlotEdge, verticalLayout.wallTopY, hiddenSection.copingBottomY],
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

  const comfortPlan = resolvedLayout.comfort;
  const shellKind = (family: StructureFamily): RawShellKind =>
    family === "REINFORCED_CONCRETE"
      ? "concrete"
      : family === "VISIBLE_STAINLESS_STEEL"
        ? "stainless"
        : "steel";
  const interiorShellKind: RawShellKind | null = structureFamily === "VISIBLE_STAINLESS_STEEL"
    ? "stainless"
    : rawStructure
      ? shellKind(rawStructure)
      : null;
  const rawShellKind = rawStructure ? shellKind(rawStructure) : null;
  const wallSize = [perimeter, depth] as const;
  // Identical glass-tile response on walls, floor, stairs and comfort solids.
  // Only the water surface supplies the strong wet reflection; the mosaic
  // remains a readable glazed material underneath, not a second mirror.
  const mosaicResponse = materials.surface.kind === "mosaic" ? {
    clearcoat: showWater ? 0.06 : materials.surface.wallClearcoat,
    clearcoatRoughness: materials.surface.wallClearcoatRoughness,
    ior: showWater ? 1.13 : 1.5,
    reflectivity: 0.42,
    envMapIntensity: 1,
    specularIntensity: 0.58,
  } : {};
  const mosaicSamplingKey = materials.surface.kind === "mosaic" ? `-${MOSAIC_SAMPLING_REVISION}-${materials.surface.tileSize}` : "";
  // Construction stages attach a separate raw material, not a dry version of
  // the finished basin. Retain that finished program until it is visible again.
  const finishedProgramKey = `${showWater || interiorShellKind ? "wet" : "dry"}${mosaicSamplingKey}`;
  const configureInteriorMaterial = useCallback((shader: UnderwaterShader) => {
    configureCaustics(shader);
    if (materials.surface.kind === "mosaic") configureMosaicSampling(shader, materials.surface.tileSize);
  }, [configureCaustics, materials.surface.kind, materials.surface.tileSize]);
  // A finished stainless basin is seen through the water exactly like a
  // liner: same absorption, scattering and caustics, only once filled.
  const interiorUnderwater =
    showWater && structureFamily === "VISIBLE_STAINLESS_STEEL"
      ? { configure: configureCaustics, key: `wet-${waterLevel}-${materials.surface.underwaterScatteringContribution}-${LED_TRANSPORT_CACHE_KEY}` }
      : undefined;
  const accessMaterial = (
    <RetainedStageMaterial programKey={finishedProgramKey} raw={interiorShellKind ? <RawShellMaterial kind={interiorShellKind} seamlessSteel underwater={interiorUnderwater} /> : null}>
    <meshPhysicalMaterial
            key={`${showWater ? "wet" : "dry"}${mosaicSamplingKey}`}
            color={materials.liner.color}
            map={floorSurfaceMap}
            normalMap={interiorMicroMaps.floorNormal}
            normalScale={[
              materials.surface.microDetail.normalStrength,
              materials.surface.microDetail.normalStrength,
            ]}
            roughness={materials.liner.roughness}
            metalness={materials.liner.metalness}
            roughnessMap={interiorMicroMaps.floorRoughness}
            aoMap={interiorMicroMaps.floorAo}
            aoMapIntensity={0.6}
            {...mosaicResponse}
            onBeforeCompile={materials.surface.kind === "mosaic" ? configureInteriorMaterial : configureCaustics}
            customProgramCacheKey={() =>
              `depth-aware-underwater-optics-v8-${LED_TRANSPORT_CACHE_KEY}-${showWater}${mosaicSamplingKey}`
            }
          />
    </RetainedStageMaterial>
  );

  return (
    <group>
      {/* Interior walls, floor, water and overflow channel: everything that
          physically sits inside the basin. Named so the planar water
          reflector can hide it for its mirror-camera pass — from below the
          waterline these surfaces would otherwise render nonsensical
          close-up backfaces instead of a clean sky/coping reflection. */}
      <group name="pool-basin">
        {showAccessories && features.includes("stairLighting") ? (
          <group name="pool-stair-micro-spots">
            {resolvedLayout.stairMicroSpots.map((spot, i) => (
              <HydroSpot key={i} spot={spot} night={night && showWater} ledColor={ledColor} ledIntensity={ledIntensity} />
            ))}
          </group>
        ) : null}
        <PoolComfortModel
          plan={comfortPlan}
          floorProfile={floorProfile}
          showJets={showAccessories}
          showBenchLighting={showAccessories && features.includes("hydromassageBenchLighting")}
          night={night && showWater}
          ledColor={ledColor}
          ledIntensity={ledIntensity}
        >
          <RetainedStageMaterial programKey={finishedProgramKey} raw={interiorShellKind ? <RawShellMaterial kind={interiorShellKind} seamlessSteel underwater={interiorUnderwater} /> : null}>
            <meshPhysicalMaterial
              key={`${showWater ? "wet" : "dry"}${mosaicSamplingKey}`}
              color={materials.liner.color}
              map={floorSurfaceMap}
              normalMap={interiorMicroMaps.floorNormal}
              normalScale={[
                materials.surface.microDetail.normalStrength,
                materials.surface.microDetail.normalStrength,
              ]}
              roughness={materials.liner.roughness}
              metalness={materials.liner.metalness}
              roughnessMap={interiorMicroMaps.floorRoughness}
              aoMap={interiorMicroMaps.floorAo}
              aoMapIntensity={0.6}
              {...mosaicResponse}
              onBeforeCompile={materials.surface.kind === "mosaic" ? configureInteriorMaterial : configureCaustics}
              customProgramCacheKey={() =>
                `depth-aware-underwater-optics-v8-${LED_TRANSPORT_CACHE_KEY}-${showWater}${mosaicSamplingKey}`
              }
            />
          </RetainedStageMaterial>
        </PoolComfortModel>
        {resolvedLayout.effectiveAccess !== "stainlessSteelLadder" || showAccessories ? <PoolAccessModel
          resolvedPlan={resolvedLayout.access}
          outline={outline}
          access={resolvedLayout.effectiveAccess}
          stairType={internalStairType}
          floorProfile={floorProfile}
          topY={verticalLayout.copingY}
          infinityExcluded={infinityExcluded}
          obstacles={system === "skimmer" ? skimmers.positions : []}
          {...accessMounting(system, overflowType, verticalLayout)}
        >
          {accessMaterial}
        </PoolAccessModel> : null}
        {showAccessories && resolvedLayout.ladder?.plan.placement ? (
          <PoolAccessModel
            resolvedPlan={resolvedLayout.ladder.plan}
            outline={outline}
            access="stainlessSteelLadder"
            floorProfile={floorProfile}
            topY={verticalLayout.copingY}
            infinityExcluded={infinityExcluded}
            obstacles={system === "skimmer" ? skimmers.positions : []}
            {...accessMounting(system, overflowType, verticalLayout)}
          >
            {accessMaterial}
          </PoolAccessModel>
        ) : null}
        {/* Interior walls */}
        <mesh name="plan-basin-walls" geometry={walls} renderOrder={0} receiveShadow castShadow>
          <RetainedStageMaterial programKey={finishedProgramKey} raw={interiorShellKind ? <RawShellMaterial kind={interiorShellKind} seamlessSteel wallSize={wallSize} underwater={interiorUnderwater} /> : null}><meshPhysicalMaterial
            key={`${showWater ? "wet" : "dry"}${mosaicSamplingKey}`}
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
            {...mosaicResponse}
            onBeforeCompile={materials.surface.kind === "mosaic" ? configureInteriorMaterial : configureCaustics}
            customProgramCacheKey={() =>
              `depth-aware-underwater-optics-v8-${LED_TRANSPORT_CACHE_KEY}-${showWater}${mosaicSamplingKey}`
            }
            side={DoubleSide}
          /></RetainedStageMaterial>
        </mesh>

        {/* Floor with animated caustics. Sloped floors bake their absolute
            world Y into every vertex (see createSlopedFloorGeometry), so
            the mesh itself sits at the origin; flat floors keep the single
            constant-Y geometry raised by `position`, exactly as before. */}
        <mesh
          name="plan-basin-floor"
          geometry={floor}
          position={floorProfile.sloped ? [0, 0, 0] : [0, verticalLayout.floorY, 0]}
          receiveShadow
        >
          <RetainedStageMaterial programKey={finishedProgramKey} raw={interiorShellKind ? <RawShellMaterial kind={interiorShellKind} seamlessSteel underwater={interiorUnderwater} /> : null}><meshPhysicalMaterial
            key={`${showWater ? "wet" : "dry"}${mosaicSamplingKey}`}
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
            {...mosaicResponse}
            onBeforeCompile={materials.surface.kind === "mosaic" ? configureInteriorMaterial : configureCaustics}
            customProgramCacheKey={() =>
              `depth-aware-underwater-optics-v8-${LED_TRANSPORT_CACHE_KEY}-${showWater}${mosaicSamplingKey}`
            }
            side={DoubleSide}
          /></RetainedStageMaterial>
        </mesh>

        {/* Water body — animated ripples, refraction, real planar reflection */}
        {showWater || waterPrepared ? (
          <mesh geometry={water} position={[0, waterLevel, 0]} renderOrder={2} visible={showWater}>
            <WaterSurfaceMaterial
              active={showWater}
              planView={planView}
              waterLevel={waterLevel}
              depth={waterLevel - verticalLayout.floorY}
              outline={waterOutline}
              flowing={system === "infinity"}
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
              {rawShellKind ? <RawShellMaterial kind={rawShellKind} /> : <meshStandardMaterial color="#394340" roughness={0.54} side={DoubleSide} />}
            </mesh>
            <mesh geometry={channelInnerWall} receiveShadow>
              {rawShellKind ? <RawShellMaterial kind={rawShellKind} /> : <meshStandardMaterial color="#4b5350" roughness={0.45} side={DoubleSide} />}
            </mesh>
            {!isVisibleOverflow && !isContinuousOverflow && (
              <mesh
                name="overflow-edge-without-grille"
                geometry={overflowLip}
                position={[0, waterLevel - 0.001, 0]}
                receiveShadow
              >
                {rawShellKind ? (
                  <RawShellMaterial kind={rawShellKind} />
                ) : (
                  <meshPhysicalMaterial
                    key={copingMaterialKey}
                    color={materials.coping.color}
                    normalMap={copingDetail.normalMap}
                    normalScale={[materials.coping.normalStrength, materials.coping.normalStrength]}
                    roughnessMap={copingDetail.roughnessMap}
                    roughness={materials.coping.roughness * 0.8}
                    specularIntensity={materials.coping.id === "reference-ipe" ? 0.35 : 1}
                    onBeforeCompile={(shader) => {
                      configureCopingTriplanar(shader);
                      excludeSubmergedDirectLights(shader, waterLevel);
                    }}
                    customProgramCacheKey={() => `overflow-stone-continuity-v4-dry-${waterLevel}${materials.coping.id === "deck-marrone" ? "-continuous-deck-v3" : ""}${referenceProgramKey}`}
                    clearcoat={0}
                    clearcoatRoughness={0.12}
                    side={DoubleSide}
                  />
                )}
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
                  name="plan-grille-inner-seat"
                  geometry={grilleInnerSeat}
                  position={[0, verticalLayout.wallTopY - 0.013, 0]}
                  receiveShadow
                >
                  <meshStandardMaterial color="#77796f" roughness={0.68} side={DoubleSide} />
                </mesh>
                <mesh
                  name="plan-grille-outer-seat"
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
                  {rawShellKind ? <RawShellMaterial kind={rawShellKind} /> : <meshStandardMaterial color="#eceae3" roughness={0.62} side={DoubleSide} />}
                </mesh>
                <mesh geometry={overflowKerbInnerFace} receiveShadow castShadow>
                  {rawShellKind ? <RawShellMaterial kind={rawShellKind} /> : <meshStandardMaterial color="#e6e4dd" roughness={0.66} side={DoubleSide} />}
                </mesh>
                <mesh geometry={overflowKerbOuterFace} receiveShadow castShadow>
                  {rawShellKind ? <RawShellMaterial kind={rawShellKind} /> : <meshStandardMaterial color="#e6e4dd" roughness={0.66} side={DoubleSide} />}
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
                    color="#ffffff"
                    roughness={0.62}
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

      {poolType === "above-ground" && !rawShellKind ? (
        <AboveGroundCladding
          outline={outline}
          faceOffset={claddingFaceOffset(copingOuterOffset(system, overflowType))}
          groundY={verticalLayout.groundY}
          topY={verticalLayout.wallTopY}
          finish={exteriorPanelFinish}
        />
      ) : poolType === "above-ground" ? (
        <mesh geometry={exteriorWalls} receiveShadow castShadow>
          {rawShellKind ? <RawShellMaterial kind={rawShellKind} wallSize={wallSize} /> : <meshStandardMaterial
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
          />}
        </mesh>
      ) : null}

      {/* Coping / deck ring -- normal/roughness sampled triplanar in world
          space (see configureCopingTriplanar) so the rounded bevel, which
          turns from horizontal to near-vertical, never stretches the way a
          UV projected flat from the ring's XZ footprint would. */}
      {!isVisibleOverflow && !isContinuousOverflow && (
        <group name="pool-perimeter-finish">
          {/* Joint bedding seen through the slab joints: the same stone,
              a shade darker and only 3.5mm down, so a joint reads as a fine
              integrated line -- never a black trench in a foreign colour. */}
          <mesh geometry={copingBed} position={[0, copingSurfaceY - 0.0035, 0]} receiveShadow>
            {rawShellKind ? (
              <RawShellMaterial kind={rawShellKind} />
            ) : (
              <meshPhysicalMaterial
                key={`bed-${copingMaterialKey}`}
                color={copingJointColor}
                normalMap={copingDetail.normalMap}
                normalScale={[materials.coping.normalStrength, materials.coping.normalStrength]}
                roughnessMap={copingDetail.roughnessMap}
                roughness={Math.min(1, materials.coping.roughness + 0.08)}
                specularIntensity={materials.coping.id === "reference-ipe" ? 0.35 : 1}
                metalness={0}
                onBeforeCompile={(shader) => {
                  configureCopingTriplanar(shader);
                  excludeSubmergedDirectLights(shader, waterLevel);
                }}
                customProgramCacheKey={() => `coping-bed-triplanar-v2-dry-${waterLevel}${materials.coping.id === "deck-marrone" ? "-continuous-deck-v3" : ""}${referenceProgramKey}`}
                side={DoubleSide}
              />
            )}
          </mesh>
          <mesh name="plan-coping" geometry={coping} position={[0, copingSurfaceY, 0]} receiveShadow castShadow>
            {rawShellKind ? (
              <RawShellMaterial kind={rawShellKind} />
            ) : (
              <meshPhysicalMaterial
                key={copingMaterialKey}
                color={materials.coping.color}
                vertexColors={materials.coping.id !== "reference-ipe"}
                normalMap={copingDetail.normalMap}
                normalScale={[materials.coping.normalStrength, materials.coping.normalStrength]}
                roughnessMap={copingDetail.roughnessMap}
                roughness={materials.coping.roughness}
                specularIntensity={materials.coping.id === "reference-ipe" ? 0.35 : 1}
                metalness={0}
                clearcoat={0}
                clearcoatRoughness={0.45}
                onBeforeCompile={(shader) => {
                  configureCopingTriplanar(shader);
                  // Dry stone: a submerged LED cannot light it through the shell.
                  excludeSubmergedDirectLights(shader, waterLevel);
                }}
                customProgramCacheKey={() => `coping-triplanar-v6-slab-dry-${waterLevel}${materials.coping.id === "deck-marrone" ? "-continuous-deck-v3" : ""}${referenceProgramKey}`}
                side={DoubleSide}
              />
            )}
          </mesh>
        </group>
      )}

      {isInfinity && infinitySection !== null ? (
        <InfinityEdge
          // Visible stainless is the finished basin, not a construction
          // stage: the Infinity containment keeps the same satin steel in
          // the finish step and the final presentation.
          rawStructure={
            structureFamily === "VISIBLE_STAINLESS_STEEL" ? "VISIBLE_STAINLESS_STEEL" : rawStructure
          }
          showWater={showWater}
          outline={outline}
          shape={shape}
          infinityEdge={infinityEdge}
          waterLevel={waterLevel}
          copingSurfaceY={copingSurfaceY}
          copingOuterOffsetDistance={copingOuterOffset(system, overflowType)}
          materials={materials}
          copingDetail={copingDetail}
          configureCopingTriplanar={configureCopingTriplanar}
        />
      ) : null}
    </group>
  );
}
