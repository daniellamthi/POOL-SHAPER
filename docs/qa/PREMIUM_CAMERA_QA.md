# Premium contextual camera QA — 2026-10-13

> Historical checkpoint. The later owner-directed environment removal and final
> cleanup are tracked in `FINAL_CONFIGURATOR_QA.md`. The Photo Mode section below
> records the former WIP, not a feature remaining in the customer flow.

Branch `claude/pool-shaper-build2-project-delivery`; baseline `31b72d6`.
All Build 4 and unrelated WIP preserved. No backend, geometry or material changes
in this candidate. Infinity poses/routing protected.

## Runtime evidence

Local folder outside Git:
`/Users/danielelamthi/Documents/Codex/2026-09-14/rendi-la-immagine-1-piu-relistica-4/premium-camera-evidence`.
Each prefix below has `-1440`, `-390`, `-430` captures. Viewports:
1440×900, 390×844, 430×932. Clipping refers to the selected element, not the
surrounding basin intentionally outside detail framing. Superseded early resize
captures are not certified; use the final prefixes listed here.

| Selection | Activated camera | Visible object | Object clipping | 1440 / 390 / 430 | Evidence prefix / extension |
|---|---|---|---|---|---|
| C01 Skimmer | skimmer-detail | Fitting/waterline | None | PASS / PASS / PASS | skimmer.png |
| C02 Grille overflow | overflow-visible | Grille/channel/rim | None | PASS / PASS / PASS | overflow-grille.png |
| C03 Hidden overflow | overflow-hidden | Slot/rim | None | PASS / PASS / PASS | overflow-hidden.png |
| C04 Straight stairs | access | Whole stair and treads | None | PASS / PASS / PASS | stairs-linear-final.jpg |
| C05 Corner stairs | access | Whole stair and treads | None | PASS / PASS / PASS | stairs-corner-final.jpg |
| C06 Inox access | inox | Complete ladder | None | PASS / PASS / PASS | inox-access.jpg |
| C07 Sun Shelf | shelf | Shelf/descent; toolbar close to lowest tread on mobile | None | PASS / PASS / PASS | sun-shelf-final.jpg |
| C08 Hydro A | hydromassage | Seats/partition/jets/access | None | PASS / PASS / PASS | hydromassage-a.jpg |
| C09 Hydro B | hydromassage | Seats/jets/access | None | PASS / PASS / PASS | hydromassage-b.jpg |
| C10 Coping | coping | Local thickness/texture/joints | None | PASS / PASS / PASS | coping-fixed.jpg |
| C11 Paving/format | paving | 30×60 patch/joints | None | PASS / PASS / PASS | paving-format.jpg |
| C12 Liner | liner | Blue Sky surface | None | PASS / PASS / PASS | liner.jpg |
| C13 Mosaic | mosaic | Selected tesserae | None | PASS / PASS / PASS | mosaic.jpg |
| C14 Visible inox | liner | Interior surface; existing material unchanged | None | PASS / PASS / PASS | visible-inox.jpg |
| C15 Exterior panels | exterior-panel | Finish/seams | None | PASS / PASS / PASS | exterior-panels.jpg |
| C16 External stairs long | external-stairs | Run/extended platform/guard | None | PASS / PASS / PASS | external-stairs-long.jpg |
| C17 External stairs short | external-stairs | Run/landing/guard | None | PASS / PASS / PASS | external-stairs-short.jpg |
| C18 Pellicano | pellicano | Body/water sheet | None | PASS / PASS / PASS | pellicano.jpg |
| C19 Main LEDs night | features | Two desktop fixtures; primary mobile fixture | None | PASS / PASS / PASS | main-led-night.jpg |
| C20 Micro-spots night | stair-lighting | Six hydro stair points, main LED off | None | PASS / PASS / PASS | micro-spots-night-fixed.jpg |
| C20b Corner micro-spots | stair-lighting | Eleven points, main LED off | None | PASS / PASS / PASS | corner-micro-spots-night.jpg |
| C21 Infinity regression | access / hydromassage | Existing 12×5 access/comfort compositions | No new clipping; existing mobile toolbar overlaps lower basin | PASS / PASS / PASS (regression only) | infinity-access-regression; infinity-comfort-regression (.jpg) |

## Fixes

Before: `before-skimmer-1440.png` documents the whole-pool rule replacing detail
with review. Format, panels, external stairs and Pellicano also lacked dedicated
action mappings. Non-Infinity selections now retain detail intent; presentation
keeps whole-pool framing. Actual component envelopes and available UI frame drive
camera fitting. Detail transition: 0.24 s, except reduced motion. Existing Infinity
snap behavior remains. No substitute geometry.

## Tests

- Current WIP: typecheck PASS; **31,264 camera checks PASS**;
  **1,451 hybrid-photo checks PASS**; production build PASS; diff-check PASS.
- Isolated staged candidate excluding unrelated WIP:
  `/private/tmp/pool-camera-stage.FkMtDL`: typecheck PASS;
  **30,368 camera checks PASS**; production build PASS.
  Different counts reflect additional points in unstaged comfort geometry.
- Existing Infinity assertions retained; micro-spot routing regression added.
  Non-Infinity whole-pool expectations changed to the requested detail behavior.
- No skipped tests counted as PASS. Existing Vite warnings remain.
- Browser evidence uses the WIP runtime. The isolated candidate has automated
  verification, not a second browser audit.

## C22 — Photo Mode, separate Build 4 WIP

Observed at all three viewports:

- Skimmer 8×4 Outdoor: `photo-skimmer-hero`, `photo-skimmer-raised`,
  `photo-skimmer-waterline`.
- Infinity 12×5: `photo-infinity-hero`, `photo-infinity-raised`,
  `photo-infinity-waterline`. Original geometry unchanged.
- Above-ground 8×4: before `photo-aboveground-hero`; after
  `photo-aboveground-hero-fixed`, `photo-aboveground-raised`,
  `photo-aboveground-waterline-fixed`. Local target/height correction reveals
  the basin above the rail. Two-line correction remains in Build 4 WIP
  `src/lib/pool/hybrid-photo.ts`, outside the independent wizard-camera candidate.
- Indoor Hero: `photo-indoor-hero` at all viewports. Additional raised/waterline
  observations at 430: `photo-indoor-raised-430.jpg`,
  `photo-indoor-waterline-430.jpg`. This is not a full Indoor matrix PASS.

**Photo Mode visual gate: FIX REQUIRED.** Visible background/deck joins, flat
presentation and weak low-angle mobile compositions remain Build 4 work.
No environment/material/geometry changes were made to conceal them.
Download, performance and photorealism are not newly certified by camera tests.
No Build 4 closeout is claimed.

## Delivery boundary

Wizard-camera candidate verified independently. Other WIP and local Photo Mode
correction remain on disk. No merge, deployment or backend action.

Overall delivery: **FIX REQUIRED**. Commit/push deliberately not executed because
the complete visual gate, including Photo Mode, is not PASS. The four-file staged
camera candidate remains available without discarding any unstaged changes.
