# Project architecture

This document defines the target source structure for the reusable premium
framework. The repository currently runs on TanStack Start and Vite; `src/app`
is reserved for the future Next.js 16 App Router migration. No runtime migration
is part of this architecture-only change.

## Source tree

```text
src/
├── app/                         # Next.js App Router entry point
├── components/
│   ├── ui/                      # Framework-agnostic design-system primitives
│   ├── layout/                  # Shared page-shell and layout composition
│   ├── sections/                # Reusable, composed website sections
│   └── animations/              # Reusable presentational motion wrappers
├── configurator/                # Self-contained configurator domain
│   ├── steps/                   # Step-level feature composition
│   ├── 3d/
│   │   ├── components/          # React Three Fiber scene components
│   │   ├── geometry/            # Geometry-building modules
│   │   └── scene/               # Cameras, lighting and scene composition
│   ├── forms/                   # Domain forms and validation boundaries
│   ├── calculations/            # Pure domain calculations
│   ├── materials/               # 3D material definitions and factories
│   ├── services/                # Configurator-specific integrations
│   ├── hooks/                   # Configurator-specific React hooks
│   ├── store/                   # Configurator state and selectors
│   ├── types/                   # Configurator domain types
│   ├── utils/                   # Configurator-only helper functions
│   ├── constants/               # Stable domain constants
│   ├── data/                    # Static domain datasets and presets
│   ├── config/                  # Configurator feature configuration
│   └── assets/
│       ├── models/              # 3D model assets
│       ├── textures/            # Texture and environment assets
│       └── icons/               # Configurator-only icons
├── lib/                         # Shared infrastructure and third-party adapters
├── hooks/                       # Cross-feature React hooks
├── services/                    # Application-wide service boundaries
├── store/                       # Application-wide client state
├── types/                       # Shared TypeScript types
├── utils/                       # Small shared pure utilities
└── styles/                      # Global CSS, Tailwind layers and design tokens
```

## Folder responsibilities

### `app`

Reserved for Next.js 16 routes, layouts, metadata, loading and error boundaries,
route handlers, and providers that belong to the App Router. Route-specific code
should stay colocated here; reusable business code should not.

### `components`

Contains reusable React presentation and composition. `ui` owns low-level design
system primitives, `layout` owns shells shared by multiple routes, `sections` owns
larger marketing/content compositions, and `animations` owns reusable motion-only
wrappers. These modules must not contain configurator business rules.

### `configurator`

Defines a feature boundary for the product's core domain. Keeping its state,
types, calculations, rendering code, assets, and integrations together makes the
feature portable to another storefront or application without coupling it to the
website shell.

- `steps`: orchestration for individual workflow steps.
- `3d`: the React Three Fiber rendering boundary, split into scene components,
  pure geometry construction, and scene setup.
- `forms`: form schemas, field composition, and validation boundaries.
- `calculations`: deterministic domain formulas, independent of React and 3D.
- `materials`: Three.js materials and material creation policies.
- `services`: external I/O used only by the configurator.
- `hooks`: React-facing configurator behavior and selectors.
- `store`: domain state, actions, selectors, and persistence boundaries.
- `types`: canonical domain contracts.
- `utils`: small helpers meaningful only inside this feature.
- `constants`: values that are stable across deployments.
- `data`: static catalogs, presets, and seed data.
- `config`: environment- or product-variant feature configuration.
- `assets`: feature-owned models, textures, and icons.

### Shared infrastructure

- `lib`: configured libraries, infrastructure helpers, and third-party adapters.
- `hooks`: generic hooks used by more than one feature.
- `services`: app-level API clients and integration boundaries.
- `store`: global UI/session state only; domain state stays with its feature.
- `types`: genuinely cross-feature TypeScript contracts.
- `utils`: pure, generic utilities without product-specific meaning.
- `styles`: Tailwind entry styles, global styles, tokens, and theme layers.

## Dependency rules

1. `app` may compose shared components and features.
2. `components` may use shared `lib`, `hooks`, `types`, and `utils`, but not feature
   internals.
3. `configurator` may use shared infrastructure, while shared infrastructure must
   never import from `configurator`.
4. Pure layers such as `calculations`, `types`, `constants`, and `utils` must not
   depend on React, browser APIs, state stores, or Three.js rendering components.
5. External I/O belongs in `services`; view and calculation modules remain free of
   network and persistence concerns.
6. Public feature exports should eventually be exposed through explicit barrel
   files only after real modules exist; empty barrels are intentionally omitted.

## Placeholder policy

Empty directories contain `.gitkeep` files solely so Git can preserve the agreed
architecture. They are replaced by real modules when implementation begins.
