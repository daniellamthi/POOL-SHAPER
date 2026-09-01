/**
 * Canonical, engine-agnostic description of one configured pool -- the ONE
 * source of truth handed from the live Three.js/R3F configurator to the
 * separate Blender/Cycles photorealistic-render pipeline (see
 * rendering/blender/). Nothing here is Three.js- or Blender-specific: it's
 * plain geometry/material/camera data that both sides agree on. The live
 * configurator keeps deriving this from `PoolConfig` (see
 * src/lib/pool/types.ts) via `serializePoolRenderConfig` in serialize.ts;
 * Blender never sees `PoolConfig` at all, only this.
 */

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export type PoolRenderShapeKind = "rectangle" | "custom";
export type PoolRenderInstallation = "in-ground" | "above-ground";
export type PoolRenderSystem = "skimmer" | "overflow";
export type PoolRenderOverflowType = "hidden" | "visible";
export type PoolRenderFinishMaterial = "liner" | "mosaic";
export type PoolRenderStaircaseKind = "external" | "internal-steps" | "stainless-ladder";
export type PoolRenderAccessoryCategory = "feature" | "equipment";

/**
 * Named viewpoints already computed by the live configurator's own camera
 * system (see src/lib/pool/camera.ts, `CameraIntent`). "hero" is the one
 * addition for this pipeline: the wide beauty shot used for a finished,
 * standalone render, mapped to the existing "review" intent -- there is no
 * separate camera algorithm for it.
 */
export type PoolRenderCameraPreset =
  "hero" | "overview" | "skimmer" | "overflow" | "liner" | "mosaic";

export type PoolRenderEnvironmentLabel = "Sunny Day" | "Dusk";
export type PoolRenderOutputPresetId = "hd" | "4k";

export interface PoolRenderShape {
  kind: PoolRenderShapeKind;
  /**
   * Closed outline in the XZ plane, metres, centred on the origin -- same
   * convention and winding as `buildOutline()` in src/lib/pool/geometry.ts.
   * This is the actual polygon (rectangle corners, or the user's custom
   * control-point polygon already resolved to world units), not a shape
   * label + parameters pair: Blender never needs to know how a rectangle or
   * a custom outline is parameterised, only the resulting polygon.
   */
  outline: ReadonlyArray<Vec2>;
}

export interface PoolRenderDimensions {
  /** metres */
  length: number;
  /** metres */
  width: number;
  /** metres */
  depth: number;
  /** 0..1 relative corner rounding, informational only -- already baked into `shape.outline`. */
  cornerRadius: number;
}

export interface PoolRenderStructure {
  installation: PoolRenderInstallation;
  system: PoolRenderSystem;
  /** Only meaningful when `system === "overflow"`. */
  overflowType: PoolRenderOverflowType | null;
}

/**
 * Every vertical elevation (metres, world Y), pre-computed by the same
 * `getPoolVerticalLayout()` the live renderer uses -- see
 * src/lib/pool/vertical-layout.ts. Blender positions floor/walls/water/coping
 * from these numbers directly instead of re-deriving them from
 * installation/system/overflow rules a second time.
 */
export interface PoolRenderVerticalLayout {
  groundY: number;
  floorY: number;
  wallTopY: number;
  waterY: number;
  copingY: number;
  copingThickness: number;
  copingWidth: number;
}

export interface PoolRenderFinish {
  material: PoolRenderFinishMaterial;
  /** LinerColor id or MosaicFinishId from src/lib/pool/types.ts, kept for traceability. */
  colorId: string;
  title: string;
  baseColorHex: string;
  /** Site-relative texture path (e.g. "/textures/pvc-liner/motion-sand-beach-179.png"), resolved against the exporting app's `public/` directory. */
  textureUrl: string | null;
  roughness: number;
  metalness: number;
}

export interface PoolRenderCoping {
  colorHex: string;
  roughness: number;
  /** metres */
  thickness: number;
  /** metres, plan-offset from the water outline -- see COPING_WIDTH in src/lib/pool/config.ts. */
  width: number;
}

/**
 * Physical water parameters, not a GLSL uniform dump -- these map onto a
 * Cycles Principled BSDF + volume absorption, not a port of
 * WaterSurfaceMaterial.tsx's shader (see water_builder.py).
 */
export interface PoolRenderWater {
  /** metres, world Y of the flat water plane. */
  waterY: number;
  ior: number;
  roughness: number;
  /** 0..1, Principled BSDF "Transmission Weight". */
  transmission: number;
  /** Linear RGB, 0..1 -- tints light scattered back out of the water body. */
  scatteringColor: Vec3;
  /** Per-channel absorption coefficients (R, G, B), arbitrary units matching WATER_VISUAL_PRESET. */
  absorption: Vec3;
  attenuationColorHex: string;
  /** metres -- Beer-Lambert distance at which `attenuationColorHex` is reached. */
  attenuationDistance: number;
}

export interface PoolRenderStaircase {
  present: boolean;
  kind: PoolRenderStaircaseKind | null;
}

export interface PoolRenderAccessory {
  id: string;
  category: PoolRenderAccessoryCategory;
  title: string;
}

/** A concrete, already-framed camera pose -- not a label Blender has to re-derive. */
export interface PoolRenderCamera {
  preset: PoolRenderCameraPreset;
  /** metres, world space */
  position: Vec3;
  /** metres, world space -- point the camera looks at */
  target: Vec3;
  verticalFovDeg: number;
}

export interface PoolRenderEnvironment {
  /** Matches the live configurator's `Theme` (src/lib/theme.tsx). */
  theme: "light" | "dark";
  label: PoolRenderEnvironmentLabel;
  /** Site-relative path to the exact HDRI Photo Mode uses -- see PhotoModeRenderer.tsx's HDRI_BY_THEME. */
  hdriUrl: string;
}

export interface PoolRenderOutputPreset {
  id: PoolRenderOutputPresetId;
  width: number;
  height: number;
  /** Cycles render samples. */
  samples: number;
  denoise: boolean;
}

export interface PoolRenderConfig {
  /** Bump when a field's meaning changes in a way `config_loader.py` needs to branch on. */
  schemaVersion: 1;
  /** ISO-8601, when this export was produced. */
  generatedAt: string;
  sourceProject: "pool-shape-shaper-main";
  shape: PoolRenderShape;
  dimensions: PoolRenderDimensions;
  structure: PoolRenderStructure;
  verticalLayout: PoolRenderVerticalLayout;
  finish: PoolRenderFinish;
  coping: PoolRenderCoping;
  water: PoolRenderWater;
  staircase: PoolRenderStaircase;
  accessories: ReadonlyArray<PoolRenderAccessory>;
  camera: PoolRenderCamera;
  environment: PoolRenderEnvironment;
  outputPreset: PoolRenderOutputPreset;
}
