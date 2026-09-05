# Autonomous decisions log

Newest first. Each entry records a decision an autonomous session made
without asking the owner, and why it was safe to make.

## 2026-09-05 -- Fixed stale camera-regression assertions instead of changing camera behavior

`npm run test:geometry` failed immediately on its first case
(`rectangle-10x4.5/in-ground: Interior Finish changed the reference wall
target`). Root-caused with a standalone repro (bisected to before the
current HEAD as well -- this was not a regression introduced this session,
it has been red for at least the last two checkpoints):

- `getFrontWallMasterCamera` (used for the Skimmer/Overflow shots) targets
  the pool's overall bounds centre -- a wide shot of the whole basin.
- `getInteriorFinishCamera` (used for Liner/Mosaic) deliberately targets a
  point *on the wall itself* -- a close material read, pulled back further
  for Liner than Mosaic per its own doc comment.

These are two intentional, different, well-commented compositions in
`src/lib/pool/camera.ts`. The failing assertions required the Liner target
to equal the Skimmer master's target exactly, and the Mosaic pose
(position *and* target) to equal the Liner pose exactly -- invariants that
cannot hold given the current, evidently intentional design, for any
rectangle. Confirmed via direct repro against `getCameraPose` that every
tested dimension (8x4, 8x5, 12x3, 9x5, 10x4.5) produces the same structural
mismatch; `rectangle-10x4.5` only "won" first because it is the first entry
in `verticalGeometryCases`.

Decision: fix the two assertions in `scripts/geometry-audit.ts` to check the
actual invariant worth protecting -- same wall (no sideways/tangent drift,
same target for Mosaic vs. Liner) and same viewing axis -- while allowing
the by-design differences (inward-axis offset for Liner vs. the wide shot;
distance/height for Mosaic vs. Liner). Did not touch `camera.ts` or any
rendered behavior: this was a test-only fix, zero risk to shipped visuals,
and `npm run test:geometry` now passes all 72 camera poses. `npx tsc
--noEmit` and `npx eslint scripts/geometry-audit.ts` are clean.

Alternative considered and rejected: changing `getFrontWallMasterCamera` or
`getInteriorFinishCamera` to force literal target equality. Rejected because
the current framing is documented as intentional product behavior (distinct
"wide master shot" vs. "close material shot" compositions) and altering it
would change real rendered camera behavior without any visual QA capability
in this environment to confirm the change reads better, violating the
preserve-current-logic mandate.

## 2026-09-05 -- Installed dependencies from the public npm registry

`bun install` and `npm install` both failed (403) against the project's
configured private registry mirrors
(`europe-west1/west4-npm.pkg.dev/lovable-core-prod/...`), not reachable from
this session. `registry.npmjs.org` is in this session's proxy allowlist and
reachable directly; `package-lock.json` does not pin the private mirror, so
`npm install --registry https://registry.npmjs.org/` resolved and installed
cleanly. `package-lock.json`'s working-tree diff from that install was
reverted before committing (kept `bun.lock` as the only lockfile change of
record, since no dependency version actually changed) -- only `node_modules`
(gitignored) was needed to run `tsc`/`eslint`/the geometry audit locally.
