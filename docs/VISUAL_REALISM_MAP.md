# Visual realism map

Scores describe current leverage on final realism, not code quality.

| Rank | File | Impact /10 | Controls | Safest improvement |
|---:|---|---:|---|---|
| 1 | `three/PoolModel.tsx` | 10 | Basin, water, coping, overflow, PBR binding | Better edge profiles, UVs, water/material separation |
| 2 | `three/PoolScene.tsx` | 10 | Camera, renderer, lighting, environment, shadows | Calibrated light rig, exposure and cinematic framing |
| 3 | `configurator/materials/visual-presets.ts` | 9 | Water/surface/coping PBR constants | Physically calibrated preset variants |
| 4 | `lib/pool/materials.ts` | 9 | Finish/color/water material resolution | Richer map contracts and color management |
| 5 | `three/textures.ts` | 8 | Ripple, caustics, stone microdetail | Multi-scale normals and less synthetic caustics |
| 6 | `materials/interior-textures.ts` | 8 | Replaceable liner/mosaic library | Full per-color PBR texture sets |
| 7 | `three/Skimmers.tsx` | 8 | Skimmer close-up | Shared geometry/materials, refined dimensions |
| 8 | `three/poolGeometry.ts` | 8 | Surface/wall topology and UVs | Tangents, consistent winding, true offset/bevel support |
| 9 | `lib/pool/geometry.ts` | 7 | Custom silhouette and offsets | Robust parallel offset instead of bounding-box scale |
| 10 | `3d/scene/visual-preset.ts` | 7 | Camera/renderer/environment baseline | Device quality tiers and exposure calibration |
| 11 | `PoolViewport.tsx` | 6 | Presentation/loading/reframe | Adaptive quality and graceful WebGL fallback |
| 12 | `three/PoolMeasurements.tsx` | 4 | Guides/labels | Occlusion and premium CAD legibility |
| 13 | `configurator/config/design-tokens.ts` | 4 | UI motion/icons/spacing | Harmonize camera/UI timing |
| 14 | `styles.css` | 4 | Viewport surround and overall contrast | Refine glass/panel contrast around hero scene |
| 15 | `PoolConfigurator.tsx` | 3 | Focus selection and water visibility | Extract declarative focus mapping only after tests |

## Highest-value realism gaps

1. Real per-color PBR texture sets (base color, normal, roughness, AO).
2. True curve-aware offsets/beveled construction profiles.
3. Better water optics/reflections without overloading low-end GPUs.
4. Consistent material scale and tangent-space detail.
5. Camera shots calibrated against actual construction references.

The first ten files create almost all rendered pixels; the remaining five determine presentation, quality policy and UX coherence.
