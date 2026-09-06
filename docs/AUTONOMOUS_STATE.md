# Autonomous State

CURRENT OBJECTIVE
Elevate Pool Architect 3D toward ultra-premium realism/commercial quality while preserving the existing configurator flow (see `docs/IMPROVEMENT_ROADMAP.md`).

CURRENT TASK
This session: Visible Premium Realism Phase A -- SKIMMER PREMIUM PASS
(`AUTO-014`, `docs/AUTONOMOUS_BACKLOG.md`). Added a `SkimmerTypeId` ("Tipo
skimmer" selector, `PoolSystemStep.tsx`) driving 4 dimensionally distinct
housing assemblies in `Skimmers.tsx` -- Standard Refined (unchanged),
Slim/Modern, High-Waterline, Architectural Flush (frameless + shadow-gap
groove) -- plus a `steel` (satin AISI-316-style) skimmer finish alongside
the existing white/graphite/sand moulded ABS. Verified with an ad hoc,
uncommitted Playwright close-up smoke test (real macOS Chromium, zoomed
OrbitControls view of the Pool System step) confirming all 4 variants are
visually distinct, no floating parts/z-fighting, no console errors, and the
steel finish renders correctly (no missing-envmap black-hole artifact).
COMPLETE this iteration -- see `AUTO-014` for full detail.

Concurrently, a second session ran a P2 material-truth pass on the same
canonical branch (merged here, no source-file overlap):
- `AUTO-015` FIXED — every page load 404'd on `/favicon.ico` while `public/`
  ships `favicon.png` only (broken tab icon on a premium-positioned product).
  Root-caused by diffing assets referenced in `__root.tsx` against `public/`,
  no browser run needed. Now resolves; the console error is gone.
- `AUTO-016` FIXED — removed 7 superseded legacy liner textures (12 MB) that
  shipped in `public/` with zero code references (`public/textures/`
  61 MB -> 49 MB). Recoverable from git history.
- `AUTO-017` / D-001 CLOSED, no defect — mosaic anti-tiling (§28, P2 item 13)
  investigated and deliberately NOT implemented: both shipped assets tile
  seamlessly with no detectable repeating constellation. Evidence and
  re-open criteria in `docs/AUTONOMOUS_DECISIONS.md`.
- D-002 recorded — the floor (`1/tileSize`) vs wall (`perimeter/tileSize`)
  repeat asymmetry reads as a bug but is correct: floor UVs are world-metre
  (`uvs.push(x, z)`), wall UVs are normalised. Do not "fix" it.
- `AUTO-008` re-scoped to BLOCKED/owner-input: its engineering half already
  ships (derived normal+roughness+AO); only manufacturer asset sourcing and
  PVC print-repeat calibration remain. See `docs/OWNER_INPUT_REQUIRED.md`.

Previous session: closed `AUTO-010` (last open consolidation item). Added two
`AUTO-009` harness reference configs (`liner-closeup`, `mosaic-closeup`,
`scripts/visual-audit.mjs`) reached by driving the wizard from Step 01 to
Step 06 "Interior Finish" via in-page `Element.click()` dispatch (see script
header comment — real Playwright mouse clicks time out in this sandbox's
software-rendered WebGL; also had to wait ~45s per transition for the
camera's frame-capped lerp to finish under this sandbox's ~0.2-0.9 fps).
Both close-ups confirm the ported interior AO (`70f0d0c`) is subtle,
artifact-free, indirect-light-only. Ledger entry upgraded IN_PROGRESS →
RECOVERED (`docs/POOL_ARCHITECT_MASTER_AUDIT.md`); `AUTO-007` upgraded to
FIXED (`docs/AUTONOMOUS_ISSUES.md`). Logged two new findings: `AUTO-012`
(camera transitions don't respect `prefers-reduced-motion`, directive §53
gap) and `AUTO-013` (this sandbox's `landing-desktop` baseline diffs ~1.07%
against a different sandbox instance — edge/AA-only, not a content
regression; documented so it isn't mistaken for one later).
COMPLETE this iteration.

Also fixed `AUTO-012` this session: `CameraRig` (`PoolScene.tsx`) now checks
`prefers-reduced-motion` and snaps to the goal camera pose instead of
flying when active (directive §53). Verified visually (emulated reduced
motion reached the Liner close-up framing in 3s vs. ~45s without it in
this sandbox) plus `tsc`/`test:geometry`/`lint` clean.

NEXT READY TASK
Two independent tracks are live; both are safe to pick up.
A. Phase B of the Visible Premium Realism sequence: coping / pool-edge
   realism (thickness, bevel, premium stone material) — the skimmer
   session's stated next step.
B. P2 material truth is closed as far as it can go without owner input:
   anti-tiling settled (D-001), UV scaling verified (D-002), `AUTO-008`
   owner-gated. Do NOT re-open those without new evidence.
Opportunistic, either track: add a skimmer close-up reference to
`scripts/visual-audit.mjs` (none exists yet, and the new variants are
exactly the kind of geometry a reference should lock in), expand
`AUTO-009` coverage generally (coping/overflow close-ups, custom shape,
mobile viewport), or fix `AUTO-011` (`vite preview`, low severity).
See `docs/AUTONOMOUS_BACKLOG.md` / `AUTONOMOUS_ISSUES.md`.

BLOCKED TASKS
None currently.

LAST VERIFIED CANONICAL COMMIT
`9b1504d` on `claude/pool-photorealism-autonomous` (this session's starting
point, `git fetch origin` confirmed no drift). This session's `AUTO-014`
work is uncommitted as of this state-doc update -- see COMMIT step pending
in the session's own workflow.

LAST VALIDATED BUILD
`npx tsc --noEmit` clean, `npm run test:geometry` (108/108, unaffected --
this file isn't exercised by the geometry audit), `npm run lint` (86
problems, baseline unchanged -- `Skimmers.tsx`/`PoolSystemStep.tsx` both
`--fix`-clean), `npm run build` clean. `npm run test:visual` not run this
session (no committed reference exercises the skimmer; see `AUTO-014`'s
follow-up). Visual verification instead done via an ad hoc, uncommitted
Playwright script (see `AUTO-014`).

KNOWN REGRESSIONS
None. (`AUTO-013` is an environment/harness characteristic, not a regression.)

CURRENT REALISM SCORE
Not yet formally scored — `docs/REALISM_SCORECARD.md` does not exist yet.

CURRENT PERFORMANCE STATUS
Not measured this session (no rendering/perf code changed).

CONSOLIDATION STATUS
COMPLETE (LC-13A). All 12 unique commits across all 7 `zen-cannon-*`
branches at a terminal disposition (5 RECOVERED, 5 SUPERSEDED/DUPLICATE, 2
DOC-ONLY groups NO UNIQUE USEFUL CHANGE — see
`docs/POOL_ARCHITECT_MASTER_AUDIT.md`). No zen-cannon branch was deleted.
Re-open branch review only if new evidence suggests a branch was missed.

LAST_SYNCED_MAIN_COMMIT
4cddd3f (origin/main == both branches' merge-base; no drift).

MAIN_SYNC_PENDING
No.
