/** A photographic backdrop is distant context, never pool geometry or scale. */
export const CATALOGUE_GARDEN = {
  url: "/hdri/catalogue-garden-2k.hdr",
  environmentIntensity: 0.65,
  rasterSunIntensity: 1,
  // Brightest sky texel: 1229,137 in the original 2048×1024 HDRI.
  // Rotate its sun to the garden-facing side of the metric villa, matching our key.
  rotation: 1.55776,
  sun: [0.2457, 0.9123, -0.3276] as const,
} as const;
