export const WATER_VISUAL_PRESET = {
  opacity: 0.84,
  roughness: 0.085,
  metalness: 0,
  transmission: 0.82,
  ior: 1.33,
  clearcoat: 1,
  clearcoatRoughness: 0.075,
  normalStrength: 0.075,
  attenuationDepthFactor: 1.85,
  environmentIntensity: { day: 1.05, night: 0.72 },
} as const;

export const POOL_SURFACE_PRESET = {
  linerClearcoat: 0.35,
  linerClearcoatRoughness: 0.25,
  floorClearcoat: 0.3,
  dayCaustics: 0.22,
  nightCaustics: 0.08,
} as const;

/** Fixed presentation border; coping choices remain quotation-only options. */
export const POOL_BORDER_PRESET = {
  color: "#cbc7bf",
  roughness: 0.62,
  thickness: 0.055,
} as const;
