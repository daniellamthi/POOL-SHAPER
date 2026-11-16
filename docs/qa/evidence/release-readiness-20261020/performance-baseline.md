# Isolated performance baseline

- Directory: `/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/release-baseline-20261020-RtqXZ8`.
- Source: tracked `0665d3b44bb0d25319f273397dea14825ff5f64a` (tree `5a63e2e2ed6a01d0fbac3b0a76044f0ffc2d66da`), streamed `git archive`→`tar`, 853 tracked files, plus exact 40-file preserved-WIP manifest overlay from `residual-gates-20261015-vPbgdc`. Each copy verified SHA256/size against manifest before and after copying.
- Manifest SHA256: `6739186be82781c53cdd59027ad5f6c3e5c00c4dae57876758a03c15af86b3ff`.
- No `.env`, credentials or secret-like paths copied. No checkout changed, full build, renderer edit or profiler run. Existing dependencies linked through `node_modules`; standard `predev` generated only the isolated mosaic manifest.
- Initial process session33350 was stopped after first browser load exposed shared Vite cache React hook errors. Only the baseline-owned `node_modules` symlink was replaced with328 package symlinks and its own `.vite` cache; shared dependencies/cache were not deleted. `performance-isolate-baseline-cache.mjs` records the exact tooling operation. Restarted `npm run dev -- --host 127.0.0.1 --port 3018 --strictPort`, session65799, Vite8.2.1. Local listen required targeted sandbox escalation after `EPERM`; approved. Separate local-only HTTP check returned200.
- Browser scene then loaded normally. Three matched steady comparisons completed; see `performance-steady-summary.md`. No separate dependency install, full build or application-source correction was required for baseline startup.

Exact overlay identities and relevant source fingerprints: `performance-baseline-identity.json`. Reproduction script: `performance-baseline-prepare.mjs` (requires a new empty dedicated `mktemp` directory and never overwrites current checkout).
