# Autonomous State

CURRENT OBJECTIVE
Elevate Pool Architect 3D toward ultra-premium realism/commercial quality while preserving the existing configurator flow (see `docs/IMPROVEMENT_ROADMAP.md`).

CURRENT TASK
Session of 2026-09-06 (P2 material-truth pass). Outcome was mostly
*verification*, which closed more than it opened:
- `AUTO-014` FIXED — every page load 404'd on `/favicon.ico` while `public/`
  ships `favicon.png` only (broken tab icon on a premium-positioned product).
  Root-caused by diffing assets referenced in `__root.tsx` against `public/`,
  no browser run needed. Now resolves; the console error is gone.
- `AUTO-015` FIXED — removed 7 superseded legacy liner textures (12 MB) that
  shipped in `public/` with zero code references (`public/textures/`
  61 MB -> 49 MB). Recoverable from git history.
- `AUTO-016` / D-001 CLOSED, no defect — mosaic anti-tiling (§28, P2 item 13)
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
P2 material truth is now closed out as far as it can go without owner input:
anti-tiling is settled (D-001), UV scaling verified (D-002), and `AUTO-008`
is owner-gated. Do NOT re-open those without new evidence.
Best remaining candidates, in rough value order:
1. P4 pool-construction detail (§45/§46) — first *audit* what is actually
   live in 3D vs metadata-only (internal steps, ladder, LED, returns, main
   drain, cover), since §45 warns the docs may overstate it. Verify before
   building anything.
2. `AUTO-011` (`vite preview` broken against the Nitro `cloudflare-module`
   output) — READY, low severity, unblocks auditing the real production
   bundle instead of `vite dev`.
3. Expand `AUTO-009` reference coverage opportunistically alongside whatever
   change touches those areas (coping/skimmer/overflow close-ups, custom
   shape, mobile viewport).
Superseded note from the previous session, kept for context: `AUTO-011` is
opportunistically. See `docs/AUTONOMOUS_BACKLOG.md` / `AUTONOMOUS_ISSUES.md`.

BLOCKED TASKS
None currently.

LAST VERIFIED CANONICAL COMMIT
`ba26c42` on `claude/pool-photorealism-autonomous`. Reconciled from two
concurrent sessions working the repo at once (`claude/vibrant-cannon-grk2xt`
authoring AUTO-010/AUTO-012 above, `claude/vibrant-cannon-2v6g91`
independently attempting the same AUTO-010 close-ups with an inferior
implementation, non-force-merged twice keeping the grk2xt version -- see
`git log --oneline -8` for the merge commits). Both harness branches and
canonical now point at the same `ba26c42`. Base was `4cddd3f` (=
`origin/main`, unchanged).

LAST VALIDATED BUILD
`npm ci` clean, `npx tsc --noEmit` clean, `npm run lint` (86 problems,
baseline unchanged), `npm run test:geometry` (108/108, both commits this
session), `npm run test:visual` — `landing-desktop` diffs ~1.07% against
the checked-in baseline (see `AUTO-013`, cross-sandbox rendering noise, not
a regression: edge-only diff, reproduced identically across 2 re-runs in
this sandbox); `liner-closeup`/`mosaic-closeup` newly baselined this
session (no prior baseline to diff against). `npm run build` clean
(re-run for the `AUTO-012` camera change per LC-10A's "camera subsystem
changed" milestone trigger).

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
