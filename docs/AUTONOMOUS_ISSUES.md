# Autonomous Issue Registry

## AUTO-001
CATEGORY: INSTALL
SEVERITY: HIGH
PROBLEM: `npm ci` failed with `ERR_MODULE_NOT_FOUND` / lockfile-drift error: `package-lock.json` was missing the `node_modules/nitro/node_modules/lru-cache` entry that `npm install` resolves for the `nitro` dependency tree.
EVIDENCE: `npm ci` failed on a clean checkout of `4cddd3f` with "Missing: lru-cache@11.5.2 from lock file". Confirmed the only genuine missing entry (other diff from a full `npm install` was npm-version `libc` metadata noise from local npm 10.9.7, deliberately not committed).
REPRODUCTION: fresh clone/`npm ci` at `4cddd3f`.
EXPECTED BEHAVIOR: `npm ci` succeeds on a clean checkout.
AFFECTED FILES: `package-lock.json`.
RISK: Low (additive lockfile entry only).
STATUS: FIXED.
VERIFICATION: `rm -rf node_modules && npm ci` succeeds; `npm run build` clean.

## AUTO-002
CATEGORY: GEOMETRY
SEVERITY: MEDIUM
PROBLEM: `npm run test:geometry` failed on `rectangle-10x4.5/in-ground` ("Interior Finish changed the reference wall target"). Root cause: `getInteriorFinishCamera` (`src/lib/pool/camera.ts`) intentionally targets a point ON the reference wall for Liner/Mosaic (close, perpendicular material view) instead of the pool's bounds centre, and gives Mosaic a tighter distance than Liner — but `scripts/geometry-audit.ts` still asserted the old "target equals bounds centre" / "Mosaic pose exactly equals Liner pose" invariants.
EVIDENCE: Reproduced on `4cddd3f` before any edits. Same root cause independently identified and fixed on 5 historical `zen-cannon-*` branches (0akmda, 46nie6, srr1xc, w0go78, xkrtvq) — ported the `w0go78` (`9267fc4`) version verbatim onto this branch.
REPRODUCTION: `npm run test:geometry` at `4cddd3f`.
EXPECTED BEHAVIOR: audit invariants match the intentional camera design — Liner's target lies on the reference wall (tangentially centred like the master view); Mosaic shares Liner's target only, not its distance.
AFFECTED FILES: `scripts/geometry-audit.ts` only — no product code changed.
RISK: Low (test-only change; verified against intentional, unmodified camera behavior).
STATUS: FIXED.
VERIFICATION: `npm run test:geometry` passes all 108 cases; `npx tsc --noEmit`, `npm run lint` (baseline unchanged), `npm run build` all clean.

## AUTO-003
CATEGORY: RESILIENCE
SEVERITY: LOW
PROBLEM: `npm run lint` reports 90 pre-existing problems (82 `prettier/prettier` formatting errors concentrated in a couple of files, plus a `react-refresh/only-export-components` warning in `src/lib/theme.tsx`). Confirmed identical before/after this session's changes (baseline, not a regression).
EVIDENCE: `git stash` back to `4cddd3f` → `npm run lint` reports the same 90 problems.
EXPECTED BEHAVIOR: canonical lint baseline should trend toward zero; low-value formatting noise should not block higher-value work.
AFFECTED FILES: not yet identified precisely (see lint output; largely one file with an 45+ line prettier-indentation block, plus `src/lib/pool/camera.ts:183` and `src/lib/theme.tsx:40`).
RISK: Low — cosmetic only, 82/90 are auto-fixable with `--fix`.
STATUS: READY (low priority; not blocking roadmap work per LC-24 error triage — batch-fix opportunistically).
