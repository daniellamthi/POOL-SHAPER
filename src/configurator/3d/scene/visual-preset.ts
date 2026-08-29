export type RenderingQualityMode = "configuration" | "experience";

export interface RenderingQualityPreset {
  readonly id: RenderingQualityMode;
  readonly dpr: [number, number];
  readonly antialias: boolean;
  readonly shadowMapSize: number;
  readonly environmentResolution: number;
  readonly contactShadows: {
    readonly enabled: boolean;
    readonly resolution: number;
    readonly frames: number;
  };
  readonly ambientOcclusion: { readonly enabled: boolean };
  readonly waterQuality: "configuration" | "experience";
  readonly textureAnisotropy: number;
  readonly postProcessing: { readonly enabled: boolean };
  /** Real mirror-camera planar reflection for the water surface. */
  readonly planarReflection: { readonly enabled: boolean; readonly resolution: number };
}

export const RENDERING_QUALITY_PRESETS: Readonly<
  Record<RenderingQualityMode, RenderingQualityPreset>
> = {
  configuration: {
    id: "configuration",
    dpr: [1, 1.5],
    antialias: true,
    shadowMapSize: 2048,
    environmentResolution: 768,
    contactShadows: { enabled: true, resolution: 1536, frames: 1 },
    ambientOcclusion: { enabled: false },
    waterQuality: "configuration",
    textureAnisotropy: 8,
    postProcessing: { enabled: false },
    planarReflection: { enabled: false, resolution: 0 },
  },
  experience: {
    id: "experience",
    dpr: [1, 2],
    antialias: true,
    shadowMapSize: 4096,
    environmentResolution: 1024,
    contactShadows: { enabled: true, resolution: 2048, frames: 1 },
    ambientOcclusion: { enabled: false },
    waterQuality: "experience",
    textureAnisotropy: 16,
    postProcessing: { enabled: true },
    planarReflection: { enabled: true, resolution: 512 },
  },
};

/** Temporarily set to Experience for live visual verification in the browser. */
export const ACTIVE_RENDERING_QUALITY = RENDERING_QUALITY_PRESETS.experience;

export const SCENE_VISUAL_PRESET = {
  backgrounds: {
    dark: "#0d0e0f",
    light: "#e9e7e2",
    night: "#050708",
  },
  guides: { dark: "#a9a39a", light: "#756f67" },
  contactShadow: { dark: 0.3, light: 0.22, blur: 4.2 },
  exposure: { dark: 1.02, light: 1.08, night: 0.82 },
  environment: { dark: 0.82, light: 0.98, night: 0.18 },
  lighting: {
    sky: {
      intensity: { dark: 0.2, light: 0.42 },
      color: "#edf5ff",
      groundColor: { dark: "#202326", light: "#817d74" },
    },
    sun: {
      intensity: { dark: 1.02, light: 1.9 },
      color: "#fff4df",
      bias: -0.00018,
      normalBias: 0.006,
      radius: 2.5,
      frustumMargin: 2.6,
    },
    auxiliary: {
      intensity: { dark: 0.24, light: 0.3 },
      color: { dark: "#d9dde0", light: "#fffaf2" },
    },
  },
  camera: { fov: 34, near: 0.1, far: 500, defaultDistanceFactor: 3.25 },
  renderer: { maxDpr: ACTIVE_RENDERING_QUALITY.dpr[1] },
} as const;
