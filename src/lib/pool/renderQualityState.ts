/**
 * Cross-cutting, non-reactive "has the camera settled" signal, read from
 * inside per-frame `useFrame` callbacks (the water reflector, the adaptive
 * DPR bump) that live several component layers away from the camera-rig
 * code that owns movement/interaction state. A plain mutable object,
 * matching the existing `photoModeState` pattern: these reads happen every
 * animation frame and must never themselves trigger a React re-render.
 *
 * Written by `CameraRig` (PoolScene.tsx) whenever a scripted camera flight
 * or a live OrbitControls drag starts or ends. Consumed by:
 * - `AdaptiveQuality` (PoolScene.tsx), which bumps the renderer's pixel
 *   ratio up while idle and back down the instant movement resumes.
 * - `useWaterReflection` (WaterSurfaceMaterial.tsx), which renders the
 *   mirror pass every frame instead of every other frame while idle.
 *
 * Deliberately conservative: nothing here accumulates a multi-frame buffer
 * that needs disposal on reset -- both consumers just read `idle` and
 * change a plain per-frame render parameter, so there is no accumulated
 * resource to go stale or leak when geometry/materials/camera change.
 */
export const renderQualityState = {
  idle: false,
  locked: false,
};

/** Seconds the camera must be stationary (no scripted flight, no user drag)
 * before the stationary-quality mode engages -- the "200-400ms" debounce so
 * a quick drag or a fast flight doesn't flicker the quality level. */
export const RENDER_QUALITY_IDLE_DELAY = 0.3;
