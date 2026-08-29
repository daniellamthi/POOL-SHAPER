# Photo Mode verification scripts

Ad hoc Playwright scripts used to verify Photo Mode changes against a running
dev server (`npm run dev`), headless, with SwiftShader software WebGL
(`--use-gl=swiftshader`) since there's no GPU in CI/agent sandboxes. Treat any
timing numbers they print as relative-only, not representative of real
hardware -- SwiftShader is slow enough that the whole app (not just the path
tracer) can drop to well under 5 FPS, which also makes browser-side timers
(toast auto-dismiss, `fetch()` promise resolution) visibly sluggish in ways
that don't happen on real hardware. See docs/PHOTO_MODE.md.

All take the dev server URL as the first argument; most take an output
directory for screenshots as the second.

- `pw-camlock.mjs` / `pw-camlock2.mjs` (+ `.bak`) -- verify the camera stays
  locked while the path tracer refines (no drift, no unexpected resets).
- `pw-water-check.mjs` -- activates Photo Mode on the default pool and polls
  the "Refining… N samples" overlay + screenshots over ~1 minute.
- `pw-water-compare.mjs` -- walks a few wizard steps first, then does the
  same, for a second data point on a different pool configuration.
- `pw-water-longrun.mjs` -- same idea over ~7 minutes, used to find the
  sample count where the image visually stops looking noisy.
- `pw-hdri-check.mjs` -- activates Photo Mode, watches convergence, exercises
  the Standard/High quality buttons and checks the "Generate photo" button's
  disabled state.
- `pw-hdri-fallback.mjs` -- blocks every `*.hdr` request (`page.route`) and
  confirms Photo Mode still activates on the gradient fallback instead of
  getting stuck, with the expected console warning.
- `pw-onunsupported-path.mjs` -- exercises PhotoModeRenderer's
  `onUnsupported` path (toast, disabled button, live view still usable
  afterward). Only meaningful with the WebGL2 check temporarily forced to
  throw in the source (see the git history around this script's addition for
  the one-line diff) -- forcing it externally (e.g. disabling
  `getContext('webgl2')`) also breaks the live raster Canvas in this three.js
  version, so it can't isolate Photo Mode's own failure handling.
- `pw-calibration-check.mjs` -- walks New Pool / In-Ground Pool then
  autofills the remaining wizard steps (first option in each step's
  `[role="group"]`) so the basin ends up filled with water and materials, then
  activates Photo Mode and screenshots the live view plus the converging
  render (`<url> <outDir> <tag> <waitSeconds>`). Used for before/after
  comparisons of small water-material/coping/reflection tuning passes -- not
  tied to one specific change like the scripts above.

Not run in CI; kept for manually re-verifying Photo Mode after future changes
to `PhotoModeRenderer.tsx` or the water material.
