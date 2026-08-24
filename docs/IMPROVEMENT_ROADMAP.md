# Improvement roadmap

No changes below are implemented by this analysis.

| Priority | Work | Reason / expected gain | Difficulty |
|---:|---|---|---:|
| 1 | Establish visual reference shots and automated screenshots | Prevent subjective regressions; enables consistent Porsche-level target | Medium |
| 2 | Upgrade interior texture registry to full PBR sets | Largest material realism gain; real liner/mosaic identity | Medium |
| 3 | Implement true curve-aware coping/overflow offsets | Correct thickness and seams on Custom Shape | High |
| 4 | Refine PoolModel edge profiles/UV/tangents | Better close-ups, highlights and material continuity | High |
| 5 | Calibrate camera shot system | Consistent component storytelling and cinematic transitions | Medium |
| 6 | Calibrate showroom lighting/environment | Better material readability/reflections without new workflow | Medium |
| 7 | Improve lightweight water optics | More believable depth/refraction while preserving performance | High |
| 8 | Refine procedural skimmer and overflow construction | Technical credibility in system close-up | Medium |
| 9 | Introduce renderer quality tiers | Protect laptop/mobile FPS while enabling premium desktop output | Medium |
| 10 | Share/cache geometry/material resources | Reduce allocations and shader churn | Medium |
| 11 | Add camera collision/reduced-motion handling | UX/accessibility and prevents invalid manual views | Medium |
| 12 | Improve measurement occlusion/CAD presentation | Cleaner professional-tool feel | Low-medium |
| 13 | Profile/split Context subscriptions | Reduce React work during forms without changing domain truth | High |
| 14 | Add WebGL loss recovery and asset fallbacks | Production resilience | Medium |
| 15 | Final UI/viewport contrast polish | Harmonize high-quality render with surrounding product UI | Low |

## The 15 future edit targets

For realism, camera, materials, reflections, lighting, zoom, rendering quality and UX, edit these files in this order:

1. `src/components/pool/three/PoolModel.tsx`
2. `src/components/pool/three/PoolScene.tsx`
3. `src/components/pool/three/poolGeometry.ts`
4. `src/components/pool/three/textures.ts`
5. `src/components/pool/three/Skimmers.tsx`
6. `src/configurator/materials/interior-textures.ts`
7. `src/configurator/materials/visual-presets.ts`
8. `src/configurator/3d/scene/visual-preset.ts`
9. `src/lib/pool/materials.ts`
10. `src/lib/pool/geometry.ts`
11. `src/components/pool/PoolViewport.tsx`
12. `src/components/pool/three/PoolMeasurements.tsx`
13. `src/components/pool/PoolConfigurator.tsx`
14. `src/configurator/config/design-tokens.ts`
15. `src/styles.css`

Files 1–10 affect actual rendered content. Files 11–15 affect delivery, focus selection, measurement UX and the visual frame around the scene. Preserve public props, reducer contracts and workflow while improving them.
