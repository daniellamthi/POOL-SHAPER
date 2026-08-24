# Render pipeline

There is no `App.tsx`; the effective chain is:

```text
HTTP request
→ server.ts / start.ts middleware
→ TanStack Router
→ __root.tsx HTML + CSS + providers
→ routes/index.tsx
→ PoolConfigurator
→ ConfiguratorProvider derives outline/metrics/skimmers
→ ConfiguratorLayout resolves materials/focus
→ PoolViewport client-only lazy import
→ R3F Canvas / PoolScene
→ domain Outline translated by poolGeometry
→ PoolModel + Skimmers + Measurements
→ Three renderer (ACES/PCF)
→ WebGL canvas in browser
```

## React update order

1. User action dispatches reducer action.
2. Provider rerenders and memoized selectors invalidate selectively.
3. Context consumers rerender.
4. `resolveMaterials` changes only for finish/color.
5. PoolViewport props change; memo only blocks identical props.
6. R3F reconciles scene nodes.
7. Geometry hooks rebuild/dispose only when their geometry dependency changes.
8. Material props update; texture clones change when texture/tile size/perimeter/depth changes.
9. `useFrame` advances water maps and active camera flight.

## GPU order (conceptual)

Shadow pass → environment capture/lightforms → opaque floor/walls/coping/skimmers → transparent water/overflow film (`renderOrder=2/3`, no depth write) → line/HTML overlays → presentation. Three decides exact opaque/transparent sorting.

## Error path

Client render failures reach TanStack root ErrorComponent and Lovable reporting. SSR failures are captured/normalized to an HTML recovery page. Remote environment failure is avoided because Environment is local.
