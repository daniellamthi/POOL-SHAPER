# Parametric pool access — targeted validation

2026-09-25 · branch `feat/premium-infinity-waterline-v1` · base HEAD `a9846c3`.
Existing Infinity and other WIP preserved. No commit, push, merge or deployment.

## Scope and decisions

- VB orchestration; architectural-pool-modeling for real elevations/landing fit; realtime-PBR-photorealism for metric UVs and stainless response; one read-only stair auditor.
- The three references were absent during the initial implementation, then supplied and inspected in the follow-up: concentric quarter-circle internal steps; SL-style stainless ladder with lower wall returns; solid rectangular parallel steps. Images guide typology, not scale or fixed tread count.
- One canonical plan drives actual meshes, option availability, wizard completion and LED clearance.
- Internal design criteria, in metres, NOT certified regulation: risers 0.15–0.25; tread 0.30; straight width 0.80–1.15; curved initial radius 0.45; bottom landing clearance 0.30.
- Number of risers derives from actual elevation difference; treads = risers − 1. Pool length does not set the count.
- Linear final rise is evaluated at both ends of its last nosing, with 5 mm fitting tolerance. All walking planes stay horizontal; solid bases follow the local floor.
- Curved flights use concentric annular sectors. No nested full cylinders and no silent linear substitute. A continuously sloped floor cannot meet a horizontal curved nosing at a uniform final rise: this combination is explicitly unavailable, without changing basin geometry.
- Inox uses 42 mm rails, 0.50 m width, 0.28 m tread spacing, up to five treads; final tread keeps at least 0.18 m floor clearance. Flanges are outside the actual outline; overflow anchors are beyond the channel on the deck. Above-ground overflow without an outer supporting deck is explicitly unavailable.
- Deterministic search tries other real walls/corners and avoids skimmers/Infinity; LEDs use the resulting access exclusion. Existing selection IDs and saved configuration fields are unchanged.

## Files changed in this pass

- `src/components/pool/three/PoolAccessModel.tsx`
- `src/components/pool/three/PoolModel.tsx` — mounting/obstacle inputs only
- `src/components/pool/three/PoolScene.tsx` — shared lighting-plan inputs only
- `src/lib/pool/access-plan.ts` (new)
- `src/lib/pool/lighting-plan.ts` — canonical stair exclusion
- `src/lib/pool/store.tsx` — access completion guard
- `src/configurator/steps/access/AccessStep.tsx`
- `src/configurator/steps/final-review/summary-labels.ts`
- `scripts/geometry-audit.ts` — replace former compressed-radius expectation
- `scripts/access-stairs-audit.ts` (new)
- This report

## Actual browser checks

Existing Vite preview reused: http://127.0.0.1:49872/ (no duplicate server).
Screenshots captured in the session; these are not saved PNG artifacts.

- Baseline and updated Comfort views at 15 × 4.5 × 1.5 m: linear and curved flights, six treads; inox four treads. The Infinity selection changed during the session, so these are not pixel-identical before/after comparison fixtures.
- 6 × 3 × 0.8 m: all three types selected; three internal treads / two inox treads visibly update, without uniformly scaling the rails.
- 3 × 2 × 1.5 m: corner unavailable with an explicit reason; linear remains six regular treads at 0.80 m width.
- 6 × 3 m, slope 0.8 → 1.5 m: side/oblique and top views inspected; slope reversed and stair moved to the new shallow end; corner explicitly unavailable.
- Angolare 10 × 4.5 × 1.2 m: straight/corner selections, two outline orientations; free orbit/top view used to see the real corner rather than judging only the locked overview.
- Custom rounded outline 10 × 4.5 × 1.2 m: incompatible selected corner remains selected with reason, no geometry substitution, Continue disabled; linear/inox selection restores a valid flow.
- Custom Visible Overflow: inox flanges visibly on exterior deck beyond grille, not planted in the drainage channel.
- Infinity regression limited to access compatibility: rectangle configurations and final selected side remain unobstructed by stairs. No Infinity geometry/camera/material changes in this pass.
- Interaction stayed usable during these checks; no instrumented FPS or broad performance claim.

## Automated checks

TypeScript, existing geometry audit, targeted access audit, production build and `git diff --check`: PASS.
Access audit covers 40 valid plans plus rejection cases, repeatability, depth vs length, last-riser width endpoints, all floor-following mesh vertices, Infinity exclusion on four rectangle edges, overflow mounting and an exact-arc containment regression.
Existing geometry suite includes its 108 shape/dimension/system cases and Infinity regression checks.
Build retains existing warnings about large chunks and Vite/Nitro options; no deployment executed.

Targeted access command:

```sh
node --input-type=module -e 'import {build} from "rolldown"; await build({input:"scripts/access-stairs-audit.ts",platform:"node",output:{file:"/tmp/pool-access-stairs-audit.mjs",format:"esm"}}); await import("/tmp/pool-access-stairs-audit.mjs");'
```

## Supplied-reference follow-up

- Skills: VB orchestration, visual-reference-matching and architectural-pool-modeling. No additional agents/installations needed for this bounded detail.
- References 1 and 3 confirm the existing curved-sector and straight-flight typologies; dimensions/count remain parametric and the selected liner is retained.
- Reference 2 exposed the missing lower stainless return and protective wall pads. Added continuous curved returns and pads, with separate actual-outline wall intersections for each rail rather than a guessed rectangular wall.
- Follow-up touches only PoolAccessModel.tsx, access-stairs-audit.ts and this report. Infinity, internal stair geometry, UI and other WIP remain unchanged.
- Targeted tests additionally check wall contact on Rectangle/L/Custom/Organic and sample the full rail curve to ensure the lower bend does not overshoot towards the floor. Clearance sizing includes floor height at the contacts.
- Current before/after screenshots captured in the live preview; free orbit used to inspect the ladder from inside the basin. No pixel-identical or photographic-material match is claimed.
- TypeScript, targeted access tests, build and diff-check passed again. No commit/push.

Limits: visual typology matching, not dimensional measurement from images; no electrical/structural certification; no new offline Cycles validation; no exhaustive manual matrix of every custom polygon.
