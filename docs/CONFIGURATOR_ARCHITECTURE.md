# Configurator architecture

## React hierarchy

```text
index Route
└─ PoolConfigurator
   └─ ThemeProvider
      └─ ConfiguratorProvider
         └─ ConfiguratorLayout
            ├─ BrandLogo / ThemeToggle / Reset
            ├─ StepIndicator
            ├─ Active StepComponent
            ├─ Back / Continue
            └─ PoolViewport (lazy PoolScene) + LiveSummary
```

## State model

There is **no Zustand**. `src/lib/pool/store.tsx` uses `useReducer`; `context.ts` exposes its typed contract. State contains `config`, `renovation`, and `step`. Actions update project/customer/shape/control points/dimensions/system/finish/color/accessories/renovation/uploads/navigation/reset.

Derived, memoized data:

```text
config shape + dimensions + controlPoints
→ buildOutline
→ computeMetrics
→ planSkimmers
→ Context consumers and PoolScene
```

Dimensions reject non-finite values and clamp to config limits. Removing/resetting uploads revokes object URLs. Completion rules gate Continue and future step navigation.

## New Pool workflow

| # | Module | Logic/output |
|---:|---|---|
| 0 | `project-type` | Required New Pool/Renovation selection |
| 1 | `pool-shape` | Rectangle or Custom; draw/upload modes; ShapeEditor/FileDrop |
| 2 | `pool-dimensions` | Length/width/depth controls and live metrics |
| 3 | `pool-system` | Skimmer or residential overflow; triggers detail camera |
| 4 | `interior-finish` | PVC liner/mosaic; internal camera; water hidden |
| 5 | `interior-color` | Six color swatches; material-only update |
| 6 | `accessories` | Twelve quote-only selectable cards; no 3D effect |
| 7 | `contact-details` | Required customer validation |
| 8 | `final-review` | ProjectSummary, customer, compact metrics |

## Renovation workflow

| # | Component | Logic |
|---:|---|---|
| 0 | `ProjectTypeStep` | Shared branch choice |
| 1 | `RenovationScopeStep` | Multi-select six renovation areas; one required |
| 2 | `RenovationPoolStep` | Current shape and essential dimensions |
| 3 | `RenovationDetailsStep` | Conditional finish/filtration/coping/structure/equipment questions |
| 4 | `RenovationCustomerStep` | Name, surname, email, phone, city, country required |
| 5 | `RenovationReviewStep` | Conditional professional summary |

`complete` activates all detail sections. Replace-skimmers displays the derived one-per-25-m² recommendation. Renovation keeps the 3D overview and shares dimensions/material state.

## Data flow

1. Step component calls a Context action.
2. Reducer returns immutable `config`/`renovation` state.
3. Provider recomputes only affected outline/metrics/skimmers.
4. Configurator resolves materials and selects camera focus.
5. PoolViewport receives serializable domain output as typed props.
6. R3F updates geometry only for shape/dimensions/system; materials update for finish/color.
7. LiveSummary and FinalReview read the same Context, preventing duplicate truth.

## Forms and validation

- New Pool uses `getCustomerValidation`: name/email/phone/city/country plus regex email.
- Renovation additionally requires surname.
- `TextField` provides accessible IDs, errors and autocomplete.
- `DimensionControl` pairs numeric input with Radix Slider.
- `FileDrop` creates image preview object URLs and delegates cleanup to the store.

## UI composition

- `StepSection`: headings and step entrance.
- `OptionCard`, `SwatchOption`, `ToggleChip`, `DataRow`: shared selection/data primitives.
- `StepIndicator`: current/completed/future state and safe navigation.
- `ProjectSummary`, `MetricsPanel`, `LiveSummary`: presentation of canonical derived values.
- `BrandLogo`, `ThemeToggle`: product and theme configuration boundaries.

## Routing/services/hooks

There is one functional route (`/`). Query is installed but unused by domain code. No configurator service or remote persistence exists. The only shared hook is `use-mobile`; configurator behavior is Context-driven.
