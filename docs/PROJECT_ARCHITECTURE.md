# Project architecture

## Executive summary

POOL SHAPER is a TanStack Start/Vite React 19 application. The only route composes a two-column swimming-pool configurator. Domain state is local to a React Context backed by `useReducer`; derived outlines, metrics and skimmer plans are pure functions. The WebGL bundle is client-only and lazy-loaded.

There is no `App.tsx`, Zustand store, API/database, post-processing stack or remote HDRI. `src/routes/index.tsx` is the page entry and `PoolConfigurator.tsx` is the application feature root.

## Repository folders

| Folder | Responsibility | Layer/dependencies |
|---|---|---|
| `public` | Static favicon, robots and replaceable pool textures | Assets; served verbatim |
| `scripts` | Geometry audit source and Node runner | Tests; imports pure domain geometry |
| `docs` | Architecture and technical documentation | Documentation only |
| `src/routes` | TanStack file routes, metadata and root boundaries | Routing; composes application |
| `src/components/pool` | Configurator shell and product UI | UI/orchestration; Context + config |
| `src/components/pool/three` | Active R3F scene, meshes and geometry adapters | Rendering; Three/R3F/Drei |
| `src/components/ui` | 51 generic shadcn/Radix primitives | UI foundation; no pool rules |
| `src/configurator/steps` | Current modular New Pool/Renovation steps | Feature UI; reads Context |
| `src/configurator/3d` | Visual scene presets; component/geometry folders reserved | Rendering configuration |
| `src/configurator/materials` | Texture registry and PBR presets | Rendering data |
| `src/configurator/config` | Branding and design tokens | Product configuration |
| `src/configurator/assets` | Logo plus reserved model/texture/icon locations | Feature assets |
| `src/lib/pool` | Canonical domain: types, config, reducer, calculations, validation | Pure logic plus React store boundary |
| `src/lib` | Theme, utilities and SSR/client error infrastructure | Shared infrastructure |
| `src/hooks` | Generic responsive hook | Shared UI utility |
| `src/types` | R3F JSX type augmentation | Type infrastructure |
| `src/app`, `components/{layout,sections,animations}`, `configurator/{forms,calculations,services,hooks,store,types,utils,constants,data}`, `services`, `store`, `styles`, `utils` | Empty `.gitkeep` placeholders for the intended portable/Next architecture | No runtime effect |

## Bootstrap and execution order

1. Vite uses `@lovable.dev/vite-tanstack-config`; `r3fSourceAnnotationGuard` strips DOM-only inspector props from scene JSX.
2. `src/server.ts` wraps TanStack SSR and normalizes swallowed H3 failures.
3. `src/start.ts` installs SSR error and CSRF middleware.
4. `src/router.tsx` creates a QueryClient and TanStack Router from generated `routeTree.gen.ts`.
5. `routes/__root.tsx` installs CSS, theme boot script, QueryClient provider, route/error/404 shell.
6. `routes/index.tsx` renders `PoolConfigurator`.
7. `PoolConfigurator` installs Theme and Configurator providers, wizard and lazy viewport.

## Important files

| File | Purpose/imports | Imported by | Complexity and impact |
|---|---|---|---|
| `vite.config.ts` | Lovable/TanStack config and R3F annotation guard | Vite | Low; startup/render stability critical |
| `src/server.ts`, `src/start.ts` | SSR normalization, middleware, CSRF | Runtime | Medium; no visual impact, high reliability impact |
| `src/routes/__root.tsx` | HTML shell and error boundary | Router | Medium; hydration/error UX |
| `src/routes/index.tsx` | Page entry | Route tree | Low; composition only |
| `PoolConfigurator.tsx` | Workflow arrays, layout, camera-focus mapping | Index route | High; central orchestration and React rerenders |
| `PoolViewport.tsx` | Client-only lazy scene and viewport actions | Configurator | Medium; bundle/perceived performance |
| `src/lib/pool/store.tsx` | Reducer, derived domain values, completion rules | PoolConfigurator | High; state correctness/performance |
| `src/lib/pool/geometry.ts` | Outline validation/smoothing/scaling/metrics | Store/editor/scene | High; geometry stability and CPU cost |
| `src/lib/pool/engineering.ts` | Skimmer count and placement | Store | Medium; construction accuracy |
| `PoolScene.tsx` | Canvas, renderer, camera, lights, controls | Lazy viewport | Very high; realism and GPU cost |
| `PoolModel.tsx` | Basin meshes, PBR surfaces, water, overflow | Scene | Very high; realism and GPU/CPU lifecycle |
| `Skimmers.tsx` | Procedural skimmer assemblies | Scene | Medium-high; close-up realism |
| `poolGeometry.ts` | Three BufferGeometry adapters | Model/scene | High; mesh validity and allocations |
| `textures.ts` | Procedural ripple, caustics and stone maps | Model | Medium-high; material realism and CPU startup |
| `styles.css` | Tailwind theme/tokens/utilities | Root route | High UI visual impact; negligible runtime |

## Configuration files

- `package.json`: scripts and runtime packages; Three bundle is the dominant client chunk.
- `tsconfig.json`: strict TS and `@/*` alias.
- `components.json`: shadcn conventions.
- `eslint.config.js`: lint rules; existing Fast Refresh warnings are confined to shared exports.
- `bunfig.toml`, locks: package-manager state, not runtime logic.
- `AGENTS.md`: collaboration rule for Lovable-connected Git history.

## Assets

- `piscine-wellness-logo.png`: active brand mark through `PRODUCT_BRAND`.
- `pvc-liner-base.png`: seamless subtle liner microtexture.
- `mosaic-base.png`: tiled mosaic with grout.
- `favicon.png`, `robots.txt`: delivery metadata.
- `src/assets/logo.png.asset.json`: asset metadata, not active rendering.

## Dependency rule

Routes compose feature UI; feature UI consumes `lib/pool`; pure domain modules never import React/Three; R3F modules translate domain output to meshes. Shared UI primitives must not import configurator rules.
