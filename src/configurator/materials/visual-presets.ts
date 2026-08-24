export const WATER_VISUAL_PRESET = {
  opacity: 0.82,
  roughness: 0.065,
  metalness: 0,
  transmission: 0.82,
  ior: 1.33,
  clearcoat: 1,
  clearcoatRoughness: 0.055,
  normalStrength: 0.062,
  attenuationDepthFactor: 2.05,
  environmentIntensity: { day: 1.18, night: 0.72 },
} as const;

export const POOL_SURFACE_PRESET = {
  linerClearcoat: 0.42,
  linerClearcoatRoughness: 0.22,
  floorClearcoat: 0.36,
  dayCaustics: 0.18,
  nightCaustics: 0.08,
} as const;

/** Fixed presentation border; coping choices remain quotation-only options. */
export const POOL_BORDER_PRESET = {
  color: "#cbc7bf",
  roughness: 0.62,
  thickness: 0.055,
} as const;
