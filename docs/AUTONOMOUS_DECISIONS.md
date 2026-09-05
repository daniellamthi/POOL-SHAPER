# Autonomous decisions

- Did not commit the `package-lock.json` diff produced by a local
  `npm install` (needed only to run typecheck/lint/build for verification):
  the diff was pure npm-version metadata noise (dropped `libc` fields), not
  a real lockfile fix. Reverted before committing. Recorded the underlying
  `npm ci` lockfile-drift problem as DEP-1 in docs/AUTONOMOUS_BACKLOG.md for
  a dedicated pass instead of bundling an unrelated, unreviewed lockfile
  change into a rendering-performance commit.
- Did not attempt to fix the pre-existing `npm run test:geometry` failure
  in this iteration: confirmed via `git stash` that it predates this
  session's change, so fixing it is separate, higher-risk geometry work
  (recorded as GEO-1) rather than something to fold into an unrelated
  low-risk texture-caching commit. Per the priority engine
  (impact x confidence / risk x complexity), the safe, already-scoped
  PERF-1 item was picked first; GEO-1 is queued next-but-one behind PERF-2.
- Chose the "cache a template canvas, `.clone()` per call site" pattern
  over a single shared `Texture` singleton for the deduplicated procedural
  maps: several call sites mutate instance-specific `repeat`/`anisotropy`
  and call `dispose()` on unmount, which would corrupt/break other
  consumers if they shared one live `Texture` object. Cloning keeps every
  call site's existing per-instance contract intact while still removing
  the redundant CPU generation, which was the actual cost identified in
  docs/PERFORMANCE_REPORT.md.
