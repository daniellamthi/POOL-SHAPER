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
    dark: "#111317",
    light: "#f3efe9",
    night: "#08090b",
  },
  guides: { dark: "#8a8e96", light: "#7a746d" },
  // Deeper, tighter contact shadow: the single biggest lever for reading as
  // grounded architectural photography instead of a CG model floating over
  // its own studio floor. Water/liner calibration untouched.
  contactShadow: { dark: 0.42, light: 0.35, blur: 2.5 },
  exposure: { dark: 1.12, light: 1.18, night: 0.9 },
  environment: { dark: 0.95, light: 1.18, night: 0.22 },
  lighting: {
    sky: {
      intensity: { dark: 0.15, light: 0.24 },
      color: "#f7f4ef",
      groundColor: { dark: "#171a1e", light: "#dcd4cb" },
    },
    sun: {
      intensity: { dark: 1.32, light: 1.95 },
      color: "#f9f6f1",
      bias: -0.0002,
      normalBias: 0.005,
      radius: 2.8,
      frustumMargin: 2.8,
    },
    auxiliary: {
      intensity: { dark: 0.2, light: 0.26 },
      color: { dark: "#dfe1ff", light: "#f2f0ff" },
    },
  },
  camera: { fov: 34, near: 0.1, far: 500, defaultDistanceFactor: 3.25 },
  renderer: { maxDpr: ACTIVE_RENDERING_QUALITY.dpr[1] },
} as const;
