export const SCENE_VISUAL_PRESET = {
  backgrounds: {
    dark: "#0d0e0f",
    light: "#e9e7e2",
    night: "#050708",
  },
  guides: { dark: "#a9a39a", light: "#756f67" },
  contactShadow: { dark: 0.38, light: 0.28, blur: 4.2 },
  exposure: { dark: 1.06, light: 1.1, night: 0.82 },
  environment: { dark: 0.74, light: 0.92, night: 0.18 },
  camera: { fov: 34, near: 0.1, far: 500, defaultDistanceFactor: 3.25 },
  renderer: { maxDpr: 1.5 },
} as const;
