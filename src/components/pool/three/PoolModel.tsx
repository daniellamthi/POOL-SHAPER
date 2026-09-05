import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DoubleSide } from "three";
import {
  createBeveledRingGeometry,
  createInteriorWallGeometry,
  createRingGeometry,
  createSurfaceGeometry,
  createWallGeometry,
} from "./poolGeometry";
import {
  createMaterialMicroNormalMap,
  createMaterialMicroRoughnessMap,
  createTriplanarDetailMaps,
  getDerivedDetailMaps,
} from "./textures";
import { WaterSurfaceMaterial } from "./WaterSurfaceMaterial";
import { photoModeState } from "@/lib/pool/photoModeState";
import { buildWaterOutline, offsetOutline, outlinePerimeter } from "@/lib/pool/geometry";
import { COPING_WIDTH, OVERFLOW_GEOMETRY } from "@/lib/pool/config";
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

interface PoolModelProps {
  outline: Outline;
  depth: number;
  materials: ResolvedMaterials;
  system: SystemType;
  overflowType: OverflowType;
  poolType: PoolType;
  copingThickness: number;
  showWater: boolean;
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
        if (active) console.warn(`[Pool3D] Could not load surface texture ${url}; using fallback.`, error);
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
  vec2 p = position * causticScale;
  vec2 warp = vec2(
    sin(p.y * 0.37 + time * 0.16),
    cos(p.x * 0.31 - time * 0.13)
  ) * 0.72;
  float broad = sin((p.x + warp.x) * 0.72 + sin(p.y * 0.41 + time * 0.11));
  float crossing = sin((p.y + warp.y) * 0.83 - cos(p.x * 0.46 - time * 0.09));
  float detail = sin((p.x * 0.57 - p.y * 0.49) + warp.x - warp.y + time * 0.07);
  float field = broad * 0.44 + crossing * 0.38 + detail * 0.18;
  return 0.5 + smoothstep(-0.72, 0.82, field) * 0.5 - 0.25;
}
`;

const CAUSTICS_LIGHT_MODULATION = `
vec3 causticNormal = normalize(cross(dFdx(vCausticWorldPosition), dFdy(vCausticWorldPosition)));
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
vec3 viewRay = normalize(cameraPosition - vCausticWorldPosition);
float viewThroughSurface = max(abs(viewRay.y), 0.35);
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
float causticLight = 1.0 + (causticValue - 0.5) * 2.0 * causticStrength;
vec3 submergedLight = outgoingLight * waterTransmission * causticLight + inScattering;
outgoingLight = mix(outgoingLight, submergedLight, underwaterMask);
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
varying vec3 vTriWorldPosition;
varying vec3 vTriWorldNormal;
vec3 triplanarBlend;
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
#ifdef USE_ROUGHNESSMAP
  vec3 triWorldNormalR = normalize(vTriWorldNormal);
  triplanarBlend = normalize(max(abs(triWorldNormalR), vec3(0.00001)));
  triplanarBlend = pow(triplanarBlend, vec3(4.0));
  triplanarBlend /= (triplanarBlend.x + triplanarBlend.y + triplanarBlend.z);
  float triRoughX = texture2D(roughnessMap, vTriWorldPosition.zy * triplanarScale).g;
  float triRoughY = texture2D(roughnessMap, vTriWorldPosition.xz * triplanarScale).g;
  float triRoughZ = texture2D(roughnessMap, vTriWorldPosition.xy * triplanarScale).g;
  roughnessFactor *=
    triRoughX * triplanarBlend.x + triRoughY * triplanarBlend.y + triRoughZ * triplanarBlend.z;
#endif
`;

const TRIPLANAR_NORMAL_FRAGMENT = `
vec3 triWorldNormalN = normalize(vTriWorldNormal);
vec3 triTangentX = texture2D(normalMap, vTriWorldPosition.zy * triplanarScale).xyz * 2.0 - 1.0;
vec3 triTangentY = texture2D(normalMap, vTriWorldPosition.xz * triplanarScale).xyz * 2.0 - 1.0;
vec3 triTangentZ = texture2D(normalMap, vTriWorldPosition.xy * triplanarScale).xyz * 2.0 - 1.0;
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
const COPING_EDGE_RADIUS = 0.006;
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
  materials,
  system,
  overflowType,
  poolType,
  copingThickness,
  showWater,
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
  const copingOutline = useMemo(() => offsetOutline(outline, COPING_WIDTH), [outline]);
  const structuralOutline = useMemo(
    () => offsetOutline(outline, ABOVE_GROUND_STRUCTURE_THICKNESS),
    [outline],
  );
  const overflowWaterEdge = useMemo(
    () => offsetOutline(outline, OVERFLOW_GEOMETRY.waterEdgeOffset),
    [outline],
  );
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
      : overflowWaterEdge
    : outline;
  const copingSurfaceY = isVisibleOverflow
    ? verticalLayout.wallTopY + 0.004
    : verticalLayout.copingY;
  const perimeter = useMemo(() => outlinePerimeter(outline), [outline]);
  const structuralPerimeter = useMemo(
    () => outlinePerimeter(structuralOutline),
    [structuralOutline],
  );
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
  const dataAnisotropy = Math.min(ACTIVE_RENDERING_QUALITY.textureAnisotropy, maxAnisotropy);
  // Real bump/roughness derived from the liner's or mosaic's own photographed
  // pattern when available; the generic sine-noise field is only a fallback
  // (e.g. before the image has produced readable pixel data).
  const derivedSurfaceDetail = useMemo(
    () => getDerivedDetailMaps(sourceSurfaceMap),
    [sourceSurfaceMap],
  );
  const surfaceMicroNormal = derivedSurfaceDetail?.normalMap ?? materialMicroNormal;
  const surfaceMicroRoughness = derivedSurfaceDetail?.roughnessMap ?? materialMicroRoughness;
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
      wallNormal: cloneDataTexture(surfaceMicroNormal, wallRepeatX, wallRepeatY, dataAnisotropy),
      wallRoughness: cloneDataTexture(
        surfaceMicroRoughness,
        wallRepeatX,
        wallRepeatY,
        dataAnisotropy,
      ),
    };
  }, [
    surfaceMicroNormal,
    surfaceMicroRoughness,
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
  const copingDetail = useMemo(() => createTriplanarDetailMaps("stone"), []);
  const panelDetail = useMemo(() => createTriplanarDetailMaps("panel"), []);
  useEffect(
    () => () => {
      aboveGroundPanelMap.dispose();
      aboveGroundPanelBumpMap.dispose();
      materialMicroNormal.dispose();
      materialMicroRoughness.dispose();
    },
    [aboveGroundPanelMap, aboveGroundPanelBumpMap, materialMicroNormal, materialMicroRoughness],
  );
  useEffect(
    () => () => Object.values(interiorMicroMaps).forEach((texture) => texture.dispose()),
    [interiorMicroMaps],
  );

  const causticsShaders = useRef<UnderwaterShader[]>([]);
  const configureCaustics = useCallback(
    (shader: UnderwaterShader) => {
      shader.uniforms.causticTime = { value: 0 };
      shader.uniforms.causticStrength = { value: 0 };
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
        .replace("#include <opaque_fragment>", CAUSTICS_LIGHT_MODULATION);
      if (!causticsShaders.current.includes(shader)) causticsShaders.current.push(shader);
    },
    [materials.surface, waterLevel],
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

  const configureCopingTriplanar = useCallback((shader: TriplanarShader) => {
    shader.uniforms.triplanarScale = {
      value: 1 / MATERIAL_MICRO_DETAIL_PRESET.coping.moduleSize,
    };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>${TRIPLANAR_VERTEX_HEADER}`)
      .replace("#include <worldpos_vertex>", TRIPLANAR_VERTEX_POSITION);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>${TRIPLANAR_FRAGMENT_HEADER}`)
      .replace("#include <roughnessmap_fragment>", TRIPLANAR_ROUGHNESS_FRAGMENT)
      .replace("#include <normal_fragment_maps>", TRIPLANAR_NORMAL_FRAGMENT);
  }, []);

  const configurePanelTriplanar = useCallback((shader: TriplanarShader) => {
    shader.uniforms.triplanarScale = {
      value: 1 / MATERIAL_MICRO_DETAIL_PRESET.aboveGroundPanel.moduleSize,
    };
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

  const floor = useDisposable(() => createSurfaceGeometry(outline), [outline]);
  const water = useDisposable(() => createSurfaceGeometry(waterOutline), [waterOutline]);
  const walls = useDisposable(
    () =>
      createInteriorWallGeometry(
        outline,
        verticalLayout.wallTopY,
        verticalLayout.floorY,
        INTERIOR_FLOOR_COVE_RADIUS,
        2,
      ),
    [outline, verticalLayout.wallTopY, verticalLayout.floorY],
  );
  const exteriorWalls = useDisposable(
    () => createWallGeometry(structuralOutline, verticalLayout.wallTopY, verticalLayout.floorY),
    [structuralOutline, verticalLayout.wallTopY, verticalLayout.floorY],
  );
  const coping = useDisposable(
    () => createBeveledRingGeometry(copingInner, copingOutline, COPING_EDGE_RADIUS, 3),
    [copingOutline, copingInner],
  );
  const copingSkirt = useDisposable(
    () =>
      createWallGeometry(
        copingOutline,
        copingSurfaceY - COPING_EDGE_RADIUS,
        verticalLayout.wallTopY,
      ),
    [copingOutline, copingSurfaceY, verticalLayout.wallTopY],
  );
  const copingInnerSkirt = useDisposable(
    () =>
      createWallGeometry(copingInner, copingSurfaceY - COPING_EDGE_RADIUS, verticalLayout.wallTopY),
    [copingInner, copingSurfaceY, verticalLayout.wallTopY],
  );
  const hiddenOverflowIntake = useDisposable(
    () => createRingGeometry(overflowWaterEdge, overflowSlotEdge),
    [overflowSlotEdge, overflowWaterEdge],
  );
  const visibleOverflowGrate = useDisposable(
    () => createRingGeometry(overflowWaterEdge, overflowChannelOuter, true),
    [overflowChannelOuter, overflowWaterEdge],
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
            roughness={materials.liner.roughness}
            metalness={materials.liner.metalness}
            clearcoat={materials.surface.wallClearcoat}
            clearcoatRoughness={materials.surface.wallClearcoatRoughness}
            reflectivity={0.42}
            envMapIntensity={1.0}
            specularIntensity={0.58}
            onBeforeCompile={configureCaustics}
            customProgramCacheKey={() => "depth-aware-underwater-optics-v2"}
            side={DoubleSide}
          />
        </mesh>

        {/* Floor with animated caustics */}
        <mesh geometry={floor} position={[0, verticalLayout.floorY, 0]} receiveShadow>
          <meshPhysicalMaterial
            color={materials.floor.color}
            map={floorSurfaceMap}
            normalMap={interiorMicroMaps.floorNormal}
            normalScale={[
              materials.surface.microDetail.normalStrength,
              materials.surface.microDetail.normalStrength,
            ]}
            roughnessMap={interiorMicroMaps.floorRoughness}
            roughness={materials.floor.roughness}
            metalness={0.02}
            clearcoat={materials.surface.floorClearcoat}
            clearcoatRoughness={materials.surface.floorClearcoatRoughness}
            reflectivity={0.38}
            envMapIntensity={0.95}
            onBeforeCompile={configureCaustics}
            customProgramCacheKey={() => "depth-aware-underwater-optics-v2"}
            side={DoubleSide}
          />
        </mesh>

        {/* Water body — animated ripples, refraction, real planar reflection */}
        {showWater ? (
          <mesh geometry={water} position={[0, waterLevel, 0]} renderOrder={2}>
            <WaterSurfaceMaterial waterLevel={waterLevel} />
          </mesh>
        ) : null}

        {/* Overflow variants share the pool outline but expose different sections. */}
        {isOverflow ? (
          <group>
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
                    roughness={0.82}
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
                <mesh
                  geometry={hiddenOverflowIntake}
                  position={[0, verticalLayout.wallTopY - 0.055, 0]}
                  receiveShadow
                >
                  <meshStandardMaterial
                    color="#151919"
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
            customProgramCacheKey={() => "triplanar-panel-detail-v1"}
            side={DoubleSide}
          />
        </mesh>
      ) : null}

      {/* Coping / deck ring -- normal/roughness sampled triplanar in world
          space (see configureCopingTriplanar) so the rounded bevel, which
          turns from horizontal to near-vertical, never stretches the way a
          UV projected flat from the ring's XZ footprint would. */}
      <mesh geometry={coping} position={[0, copingSurfaceY, 0]} receiveShadow castShadow>
        <meshPhysicalMaterial
          color={materials.coping.color}
          normalMap={copingDetail.normalMap}
          normalScale={[
            MATERIAL_MICRO_DETAIL_PRESET.coping.normalStrength,
            MATERIAL_MICRO_DETAIL_PRESET.coping.normalStrength,
          ]}
          roughnessMap={copingDetail.roughnessMap}
          roughness={materials.coping.roughness}
          metalness={0}
          clearcoat={0.1}
          clearcoatRoughness={0.45}
          onBeforeCompile={configureCopingTriplanar}
          customProgramCacheKey={() => "triplanar-stone-detail-v1"}
          side={DoubleSide}
        />
      </mesh>
      <mesh geometry={copingSkirt}>
        <meshStandardMaterial
          color={materials.coping.color}
          normalMap={copingDetail.normalMap}
          normalScale={[
            MATERIAL_MICRO_DETAIL_PRESET.coping.normalStrength,
            MATERIAL_MICRO_DETAIL_PRESET.coping.normalStrength,
          ]}
          roughnessMap={copingDetail.roughnessMap}
          roughness={Math.min(1, materials.coping.roughness + 0.1)}
          onBeforeCompile={configureCopingTriplanar}
          customProgramCacheKey={() => "triplanar-stone-detail-v1"}
          side={DoubleSide}
        />
      </mesh>
      {/* Dry coping bezel between the coping surface and the wall top --
          correct for Skimmer (water sits below it, so it's genuinely a dry
          rim) but not for Overflow, where water reaches the top edge: left
          on, it showed as an out-of-place dry/"skimmer-like" band right
          where the submerged liner colour should continue uninterrupted. */}
      {!isOverflow ? (
        <mesh geometry={copingInnerSkirt} castShadow>
          <meshPhysicalMaterial
            color={materials.coping.color}
            normalMap={copingDetail.normalMap}
            normalScale={[
              MATERIAL_MICRO_DETAIL_PRESET.coping.normalStrength,
              MATERIAL_MICRO_DETAIL_PRESET.coping.normalStrength,
            ]}
            roughnessMap={copingDetail.roughnessMap}
            roughness={materials.coping.roughness}
            clearcoat={0.12}
            clearcoatRoughness={0.4}
            onBeforeCompile={configureCopingTriplanar}
            customProgramCacheKey={() => "triplanar-stone-detail-v1"}
            side={DoubleSide}
          />
        </mesh>
      ) : null}
    </group>
  );
}
