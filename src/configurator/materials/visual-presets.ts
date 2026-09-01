/** P1-B/P0 approved water baseline. Kept intact as the reversible fallback. */
export const WATER_BASELINE_PRESET = {
  surfaceColor: "#ffffff",
  opacity: 0.29,
  roughness: 0.12,
  metalness: 0,
  transmission: 0.26,
  thickness: 0.035,
  ior: 1.333,
  clearcoat: 0.24,
  clearcoatRoughness: 0.3,
  reflectivity: 0.1,
  specularIntensity: 0.18,
  specularColor: "#e5f4f3",
  normalStrength: 0.016,
  attenuationColor: "#e8fffb",
  attenuationDistance: 1.8,
  absorption: [0.36, 0.065, 0.025] as const,
  scatteringColor: [0.2, 0.72, 0.82] as const,
  scatteringStrength: 0.5,
  maxOpticalPath: 3.5,
  caustics: { strength: 0.018, scale: 22, speed: 0.35 },
  waves: {
    speed: [0.0015, 0.001] as const,
    drift: [0.006, 0.005] as const,
    driftFrequency: [0.071, 0.053] as const,
  },
  environmentIntensity: { day: 0.24, night: 0.15 },
} as const;

/** P1-C values before the visual-correction pass. Retained for direct comparison. */
export const WATER_P1C_BASELINE_PRESET = {
  ...WATER_BASELINE_PRESET,
  opacity: 0.42,
  roughness: 0.095,
  transmission: 0.54,
  thickness: 0.06,
  clearcoat: 0.18,
  clearcoatRoughness: 0.22,
  reflectivity: 0.12,
  specularIntensity: 0.28,
  normalStrength: 0.012,
  attenuationDistance: 2.4,
  caustics: { strength: 0.016, scale: 18, speed: 0.28 },
  waves: {
    speed: [0.00115, 0.00072] as const,
    drift: [0.004, 0.0035] as const,
    driftFrequency: [0.061, 0.047] as const,
  },
  environmentIntensity: { day: 0.34, night: 0.18 },
} as const;

/** P1-C correction: stronger water cues without changing surface colour or opacity. */
const WATER_CONFIGURATION_PRESET = {
  ...WATER_P1C_BASELINE_PRESET,
  opacity: 0.12,
  transmission: 0.92,
  roughness: 0.105,
  clearcoat: 0.16,
  clearcoatRoughness: 0.12,
  reflectivity: 0.5,
  specularIntensity: 1,
  normalStrength: 0.016,
  depthDensity: 1.08,
  scatteringContribution: 0.16,
  maxScatteringEnergy: 0.06,
  scatteringDepthStart: 0.18,
  causticVisibility: 2.3,
  caustics: { strength: 0.027, scale: 20, speed: 0.28 },
  normals: {
    large: { scale: 0.82, strength: 0.3, rotation: 0.24 },
    micro: { scale: 3.8, strength: 0.21, rotation: -0.68 },
  },
  waves: {
    speed: [0.0013, 0.00086] as const,
    drift: [0.0045, 0.0038] as const,
    driftFrequency: [0.067, 0.051] as const,
  },
  environmentIntensity: { day: 0.83, night: 0.28 },
} as const;

export const WATER_QUALITY_PRESETS = {
  baseline: {
    ...WATER_BASELINE_PRESET,
    depthDensity: 1,
    scatteringContribution: 1,
    maxScatteringEnergy: 1,
    scatteringDepthStart: 0,
    causticVisibility: 1,
    normals: {
      large: { scale: 1, strength: WATER_BASELINE_PRESET.normalStrength, rotation: 0 },
      micro: { scale: 1, strength: 0, rotation: 0 },
    },
  },
  configuration: WATER_CONFIGURATION_PRESET,
  // Reserved until Experience mode has an explicit performance budget.
  experience: WATER_CONFIGURATION_PRESET,
} as const;

/** Internal one-line fallback; intentionally not exposed in the configurator UI. */
export const ACTIVE_WATER_RENDERING: "legacy" | "premium" = "premium";
const selectWaterPreset = (mode: "legacy" | "premium") =>
  mode === "legacy" ? WATER_QUALITY_PRESETS.baseline : WATER_QUALITY_PRESETS.configuration;
export const WATER_VISUAL_PRESET = selectWaterPreset(ACTIVE_WATER_RENDERING);

export const POOL_SURFACE_PRESET = {
  linerClearcoat: 0.58,
  linerClearcoatRoughness: 0.1,
  floorClearcoat: 0.5,
  dayCaustics: 0.16,
  nightCaustics: 0.13,
} as const;

export const MATERIAL_MICRO_DETAIL_PRESET = {
  liner: { moduleSize: 0.08, normalStrength: 0.05 },
  mosaic: { moduleSize: 0.04, normalStrength: 0.025 },
  coping: { moduleSize: 0.12, normalStrength: 0.055 },
  aboveGroundPanel: { moduleSize: 0.12, normalStrength: 0.025 },
  studioFloor: { moduleSize: 0.22, normalStrength: 0.018 },
  skimmer: { repeat: [7, 4] as const, normalStrength: 0.032 },
} as const;

/** Fixed presentation border; coping choices remain quotation-only options. */
export const POOL_BORDER_PRESET = {
  color: "#cbc7bf",
  roughness: 0.62,
  thickness: 0.055,
} as const;
