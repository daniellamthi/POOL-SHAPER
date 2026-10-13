# Above-ground visual QA — 2026-10-08

Repository: `daniellamthi/POOL-SHAPER`.
Branch: `claude/pool-shaper-build2-project-delivery`.
Verified remote starting HEAD: `d1f6a6fb55dc245b6fd2b1a59ecfe35cf4c52df4`.
The previous local `work` branch was retained; no reset, merge into main or deployment was performed.

## Corrections

- Above-ground navigation now names only the coping finish, rather than advertising a paving surface that is absent from the scene and summary.
- Turning internal stairs OFF is described as a valid completed choice. Selected external stairs also appear in the phase summary.
- The Pellicano base and spout use the existing satin stainless material, including its metal-only environment correction and brushed microstructure. The old generic material made the blade look nearly black in the long-side elevation. The water sheet and pool lighting calibration are unchanged.
- The above-ground audit runner uses the operating system's temporary directory instead of a macOS-only path.
- The external staircase has a scene name so browser QA can assert that toggling it removes the entire object.

## Reproduce

From the existing isolated checkout at `/workspace/POOL-SHAPER` (no worktree is needed):

```sh
npm ci --cache /workspace/.cache/npm --no-audit --no-fund
npm --ignore-scripts run dev -- --host 0.0.0.0 --port 3000 --strictPort
```

The committed mosaic manifest already matches the texture assets. Skipping the predev/prebuild generator avoids rewriting that tracked file during setup.

In a separate terminal, run:

```sh
PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium \
  node scripts/above-ground-visual-qa.mjs \
  http://127.0.0.1:3000/ /workspace/artifacts/above-ground-qa-final
```

The script generates its fixture with the application's real reducer and restores the canonical project through the existing local draft mechanism. It creates no backend records. Screenshots and `results.json` are written outside the checkout.

For a targeted rerun, add `--cases=elevation-long,led-night --scenes-only`. To run the UI controls without recapturing the scene matrix, add `--controls-only`.

## Coverage

The default scene is a 6 × 3 m rectangle, depth 1.30 m, steel-panel structure, Sand Beach liner and travertine coping, with internal stairs, external stairs and Pellicano enabled. The OFF and visible-stainless cases use 8 × 4 m. Desktop is 1440 × 900; mobile is 390 × 844.

| Screenshot               | Configuration                                            |
| ------------------------ | -------------------------------------------------------- |
| `steel-day.png`          | Satin exterior panels, default accesses and Pellicano    |
| `composite-day.png`      | Light composite exterior panels                          |
| `gres-day.png`           | Gres exterior panels                                     |
| `access-options-off.png` | Internal stairs, external stairs and Pellicano removed   |
| `stainless-basin.png`    | Visible stainless interior and composite exterior        |
| `led-night.png`          | Gres panels, white underwater LEDs, night scene          |
| `elevation-long.png`     | Long-side elevation, satin panels and satin blade        |
| `elevation-short.png`    | Short-side elevation, external staircase and gres panels |
| `mobile.png`             | Mobile viewport, composite panels                        |
| `mobile-expanded.png`    | Expanded mobile viewport, gres panels                    |

Each case checks a successful page response, actual live-render draw calls and triangles, a healthy WebGL context, the selected panel material, presence/absence of the access and Pellicano objects, no paving meshes, and projected component bounds inside the viewport. It also rejects browser errors and failed asset responses, and checks the Pellicano's calibrated satin material.

The UI pass exercises real mouse dragging and wheel zoom on the canvas, internal and external access ON/OFF, completion with internal stairs OFF, all panel finishes without changing liner/coping, a liner change without changing panels, Pellicano ON/OFF, and removal of above-ground-only selections when switching to an in-ground installation. It verifies a Vite hot-reload connection and captures `interactive-orbit.png` and `exterior-panel-controls.png`.

As in the existing visual harness, button events are dispatched in the page because software WebGL can stall normal mouse actionability checks. The Radix view menu receives its pointer-down event; rotation and zoom use actual browser mouse input. Before each still capture, the script validates a live draw and then pauses continuous rendering in R3F's supported demand mode, restoring the previous render loop afterward; geometry and material parameters are not overridden.

## Validation

- `npm run test:above-ground`: PASS, 7,358 checks.
- `npm run test:geometry`: PASS, including 108 shape/dimension/system cases, 72 camera poses and the existing construction/geometry regressions.
- `./node_modules/.bin/tsc --noEmit`: PASS.
- ESLint on the modified source and audit scripts: PASS.
- `npm --ignore-scripts run build`: PASS, Cloudflare-module output; existing build-size/inline-import warnings remain.
- Final browser matrix: PASS, 10/10 scenes, no JavaScript errors or failed asset requests. All 10 screenshots were manually reviewed. All tested components fit the viewport (maximum absolute projected bound 0.695, within the limit of 1).
- UI controls: PASS for access ON/OFF, panel/liner independence, Pellicano ON/OFF and installation switching.
- Additional live-browser pass: PASS for real mouse rotation and zoom, connected Vite hot reload, and the full UI controls pass. The two additional screenshots were manually reviewed and are saved in `/workspace/artifacts/above-ground-live-browser`.

The reviewed images show three distinct exterior finishes with closed corners and visible panel joints, the optional objects fully removed when OFF, the corrected satin Pellicano in elevation, underwater LED lighting inside the pool, and complete framing in both elevations and mobile layouts.

## Live preview availability

The existing Vite development server remains bound to `0.0.0.0:3000` and serves the current local branch with hot reload. This task's cloud toolset has no public port-sharing or integrated browser-preview tool. The installed desktop browser launcher reports that Orbit desktop is unavailable; only automated Chromium rendering is available. No externally accessible Chrome link was created. The real browser screenshots provide the available visual preview; no deployment, new environment or backend change was used.

Runtime: Node 24.19.0, npm 11.9.0, Chromium 151, SwiftShader software WebGL. These captures demonstrate the selected geometry, materials and UI states; their timings are not representative of GPU hardware.
