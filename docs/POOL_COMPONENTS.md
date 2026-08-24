# Pool component map

| Element | Rendered/calculated by | Notes |
|---|---|---|
| Pool shell | `PoolModel.tsx` + `poolGeometry.ts` | No separate `PoolShell` component |
| Outline | `lib/pool/geometry.ts` | Rectangle or smoothed validated custom polygon |
| Walls | `PoolModel` / `createWallGeometry` | Vertical band, double-sided physical material |
| Floor | `PoolModel` / `createSurfaceGeometry` | Finish map plus optional caustic emissive map |
| Water | `PoolModel` | Physical transparent surface and animated normal |
| Overflow | `PoolModel` | Offset ring surfaces, channel wall, shadow gap, film |
| Skimmer | `Skimmers.tsx` | Rounded procedural assembly per engineering position |
| Liner | `lib/pool/materials`, texture registry, `PoolModel` | Smooth base texture, zero bump |
| Mosaic | Same | Tiled map, smaller physical scale, bump |
| Coping/border | `PoolModel`, `visual-presets.ts` | Ring, skirts, highlight bands and stone map |
| Studio floor | `PoolScene/StudioFloor` | Neutral surface with real opening |
| Measurements | `PoolMeasurements.tsx` | Length/width/depth Lines and Html labels |
| Dimension controls | `PoolDimensionsStep`, `DimensionControl` | UI only; store clamps values |
| Custom guides | `ShapeEditor.tsx` | SVG polygon/control handles, not WebGL |
| Depth markers | `PoolMeasurements.tsx` | Vertical guide and label; no wall depth scale ticks |

## Shape lifecycle

Control points are edited in normalized 2D. Invalid moves are constrained by binary search. Valid custom polygons receive Chaikin subdivision to ≥128 samples and are normalized before multiplying by length/width. The same `Outline` drives floor, walls, water, coping, studio opening, overflow and guides.

## System lifecycle

`planSkimmers` uses water area and outline bounds. PoolModel switches coping inner profile/waterline/overflow geometry based on `system`; PoolScene conditionally mounts Skimmers. No hydraulic equipment is rendered.
