# Bounded attribution probe

Actual same Chrome/GPU/1440×900, candidate-only temporary `qaRenderDiagnostics=1` wrapper. Restored separate QA8×4Infinity/glass/Shelf2, Night with wall LEDs and six stair micro-spots. Baseline not modified by this probe. Source/quality/geometry unchanged by this specialist; coordinator inserted/removes diagnostic wrapper.

Existing sampler-audit loop measured7times: maximum1.8ms for78 newly inspected programs; remaining0.3–0.6ms. The hypothesis that this loop accounts for the multi-second stalls is not supported in this document.

Timed synchronous `gl.render` calls include3399.9ms/83programs,598.7ms/53,427.7ms/81 and later2648.8ms/82. Thus synchronous renderer work demonstrably blocks scheduling; this wrapper does not distinguish shader compilation, GL driver waits, GPU completion or individual draw/texture operations.

Actual actions after initial restored scene: dry-system entry611.4ms input→secondrAF; dry→finished review631.2ms (new gl.render418ms); review→dry material stage2702ms (new gl.render2648.8ms); dry material→wet lighting1689.6ms; stair micro-spots OFF6640.2ms. All accepted UI states recorded, zero page errors. The12-entry render diagnostic budget was exhausted before micro-spots OFF, so its internal GL duration is unmeasured; sampler cost remained below1ms nearby.

Exact payloads, final accepted DOM/canvas state, all existing telemetry and log-budget caveat: `performance-render-diagnostic.json`; UI proof: `performance-diagnostic-state.png`. Queued console collection timestamps are not precise event-correlation timestamps. No new steady benchmark or broad matrix was run. Own browser tab returned to `about:blank`, viewport override reset, ownership released for cloud QA.
