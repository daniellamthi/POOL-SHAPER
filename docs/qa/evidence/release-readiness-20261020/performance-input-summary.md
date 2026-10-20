# Input feedback and long-transition diagnosis

Identical opt-in DEV helper in baseline and candidate, SHA256 `fdd791e12fd933bb12025e257b8ab442b7a146c965e022616eeb0bd868fc04d9`, query `qaInteractionTiming=1`. Trusted UI click→second requestAnimationFrame scheduling, not GPU execution, guaranteed paint or final3D readiness. No control value, target identity or personal data logged. Browser-native `performance`/`PerformanceObserver` unavailable in permitted read-only DOM scope.

Same common8×4Skimmer/Shelf scene used for controlled steady comparison; existing source+asset differences and background IAB limitation described there. Every selected state committed with `aria-pressed=true`, foreground visibility and same review camera. Exact raw payloads in `performance-input-feedback.json`.

| Actual action | Baseline ms | Candidate ms |
| --- | ---: | ---: |
| First Night in document | 94.7 | 205.2 |
| Day | 44.8 | 38.7 |
| Warm Night | 48.0 | 61.6 |

Only one sample/action/version; first-vs-warm and modest differences do not establish a consistent regression. No3s CUA timeout reproduced on those specific header Night actions. Setup clicks615/36ms etc are retained in logs but excluded from the three comparable actions.

## Separate observed DEV stalls

| Candidate8×4Infinity/glass action | Input→second rAF ms | Recorded application sample |
| --- | ---: | ---: |
| First dry system configuration→finished Presentation | 8786.1 | 29 |
| Repeat same dry→finished Presentation | 2438.6 | 33 |
| First wall LEDs activation / Night preview | 12397.1 | 42 |
| First stair micro-spot activation | 6714.5 | 45 |

These application-side intervals demonstrate delayed scheduling in this instrumented DEV environment; separate CUA Runtime.evaluate3s timeouts occurred while selections ultimately committed. No JavaScript page error was observed. They are not automatically production-renderer defects: existing DEV renderer telemetry synchronously queries newly compiled GL program uniforms/sampler budgets every2s, and coordinator is testing whether that observer itself causes a stall. No cause, GPU execution time or steady-FPS drop is inferred solely from these intervals.

Raw actions/tool-timeout descriptions: `performance-infinity-feedback.json`.291 existing console entries including sampler/program counters and transient frame windows: `performance-long-interaction-runtime.json`. Sampler peaks6→8→9→11 of16. Several queued console entries share one CUA collection timestamp; these timestamps cannot precisely correlate GL work with input. Computed helper elapsed values and sequential sample IDs are the authoritative observed intervals.

Status: controlled steady rendering PASS within its exact scene; global responsiveness remains FAIL/diagnosis pending for observed DEV transitions. Product/production attribution and any correction require coordinator probe/retest. No quality reduction or renderer change was performed by this specialist. Mobile hardware performance remains NOT VERIFIED.

Follow-up bounded probe (`performance-render-diagnostic.md/.json`) measured sampler inspection at maximum1.8ms while synchronous `gl.render` took up to3399.9ms. The sampler-cost hypothesis is not supported by this run; synchronous renderer blocking is demonstrated, exact GL/driver/compiler cause remains unresolved. Coordinator owns any subsequent correction and production/DEV attribution retest.
