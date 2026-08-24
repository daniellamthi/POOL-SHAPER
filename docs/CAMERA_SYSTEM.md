# Camera system

## Components

- `PoolConfigurator.tsx` converts workflow state into `SceneFocus`.
- `PoolViewport.tsx` forwards focus/frame token through a lazy client boundary.
- `PoolScene.tsx` owns the PerspectiveCamera configuration, OrbitControls and `CameraRig`.
- `SCENE_VISUAL_PRESET` supplies FOV, clipping planes and overview distance factor.

## Focus mapping

```text
Renovation              → overview
New step 3              → config.system (skimmer/overflow)
New steps 4 and 5       → interior
New step 8              → review
All other New steps     → overview
```

## Movement

`CameraRig` stores `goal`, `lookAt` and a `flying` flag in refs. Its effect calculates a shot when radius, frame token, focus, shape, depth, width or skimmer plan changes. `useFrame` performs frame-rate-independent interpolation:

```text
t = 1 - pow(0.0015, delta)
camera.position.lerp(goal, t)
controls.target.lerp(lookAt, t)
```

Motion ends near positional/target thresholds, avoiding continuous CPU work. Material/color are deliberately absent from effect dependencies.

## Shots

- Overview: diagonal normalized vector scaled by `max(6, radius × 3.25)`.
- Review: same family with higher elevation.
- System: selected middle skimmer position, 2.25–4 m detail distance. The remembered detail is shared by skimmer and overflow, guaranteeing the same viewpoint.
- Interior: camera below coping, facing floor/opposite wall; depends on depth and width, not finish/color.

OrbitControls remains enabled after automatic movement, with damping, zoom/pan/rotate, distance 2–160 and polar clamp. Reframe increments `frameToken`; dimension/shape changes also trigger framing.

## Risks/opportunities

- System framing derives from a skimmer spot even for overflow: consistent comparison, but custom outlines may not choose the visually best detail.
- No collision constraints prevent manual camera entry into geometry.
- No spring velocity/shot sequencing; current exponential lerp is stable and cheap.
- No reduced-motion camera policy yet.
- Camera logic is nested in scene, which is cohesive but harder to unit test.
