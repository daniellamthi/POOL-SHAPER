export const SCENE_VISUAL_PRESET = {
  backgrounds: {
    dark: "#0d0e0f",
    light: "#e9e7e2",
    night: "#050708",
  },
  guides: { dark: "#a9a39a", light: "#756f67" },
  contactShadow: { dark: 0.34, light: 0.25, blur: 5.2 },
  exposure: { dark: 1.02, light: 1.08, night: 0.82 },
  environment: { dark: 0.82, light: 0.98, night: 0.18 },
  camera: { fov: 34, near: 0.1, far: 500, defaultDistanceFactor: 3.25 },
  renderer: { maxDpr: 1.5 },
} as const;
