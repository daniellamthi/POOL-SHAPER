# Three.js pipeline

## Ownership map

| Concern | Owner | Details |
|---|---|---|
| Canvas/renderer | `PoolScene.tsx` | R3F Canvas, antialias, DPR ≤1.5, PCF shadows, ACES, no preserved buffer |
| Camera/controller | `PoolScene.tsx / CameraRig` | Perspective camera and lerped position/Orbit target |
| Controls | `PoolScene.tsx` | Drei OrbitControls with damping and distance/polar limits |
| Environment | `PoolScene.tsx` | Local Environment + two Lightformers; no remote HDRI |
| Lighting | `PoolScene.tsx` | Hemisphere, shadowed directional and spot lights |
| Shadows | `PoolScene.tsx` | Directional shadow map and one-frame ContactShadows |
| Basin | `PoolModel.tsx` | Walls, floor, water, coping, overflow channel/film |
| Skimmers | `Skimmers.tsx` | Rounded procedural assembly at engineering positions |
| Measurements | `PoolMeasurements.tsx` | Drei Lines and Html labels |
| Geometry adapters | `poolGeometry.ts` | ShapeGeometry surface/rings and custom wall BufferGeometry |
| Domain outline | `lib/pool/geometry.ts` | Rectangle/custom validation, smoothing, offsets, metrics |
| Material resolution | `lib/pool/materials.ts` | Finish/color → surface/water/coping values |
| Texture registry | `interior-textures.ts` | Finish/color → local URLs; unique preload list |
| Visual constants | `visual-presets.ts`, `visual-preset.ts` | Water, surface, border, renderer/camera/environment values |
| Procedural maps | `textures.ts` | Ripple normal, caustics and mineral stone detail CanvasTextures |

## Scene graph

```text
Canvas
├─ background + fog
├─ hemisphereLight
├─ directionalLight (shadow caster)
├─ spotLight
├─ Environment
│  └─ Lightformer ×2
├─ StudioFloor (surface with pool-shaped hole)
├─ PoolModel
│  ├─ interior walls
│  ├─ floor + caustics
│  ├─ water surface
│  ├─ overflow channel/wall/shadow/water film (conditional)
│  └─ coping + skirts + highlight bands
├─ Skimmers (skimmer system only)
├─ PoolMeasurements (optional)
├─ ContactShadows
├─ OrbitControls
└─ CameraRig
```

## Geometry and materials

`createSurfaceGeometry` maps an XZ outline to `THREE.ShapeGeometry`, optionally with a hole. `createWallGeometry` emits six vertices per outline segment with perimeter-normalized UVs. Model geometries are created through `useDisposable`, memoized by actual geometric dependencies and disposed on replacement/unmount.

Interior textures are loaded once by Drei `useTexture`, then cloned separately for floor/walls. Clones use sRGB, repeat wrapping and anisotropy 4. Wall repeat depends on perimeter/depth; floor repeat depends on material tile size. Liner uses zero bump; mosaic uses a small bump.

Water uses MeshPhysicalMaterial with opacity, transmission, IOR 1.33, clearcoat, attenuation and animated procedural normal map. `useFrame` changes texture offsets and moves the waterline by ±0.004 m. Caustics are an emissive floor map and are disabled when water is hidden.

Overflow is a parametric set of offset rings and walls, not an infinity plane. Skimmer assemblies include recessed throat, water, rounded ABS frame, weir and fasteners.

## Features explicitly absent

- No HDRI file or remote environment map is loaded.
- No EffectComposer, SSAO, SSR, bloom, TAA or other post processing.
- No cube/reflection probes or planar reflections.
- No custom GLSL water shader.
- No GLB/GLTF/OBJ models or instancing.
- No accessory 3D rendering.

These absences reduce GPU load and failure surface but limit top-end realism.
