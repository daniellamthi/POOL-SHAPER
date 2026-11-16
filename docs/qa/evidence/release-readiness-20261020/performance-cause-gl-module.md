# Independent GL attribution module

Implemented only new, unimported `src/lib/pool/development-gl-diagnostic.ts` and `scripts/development-gl-diagnostic-audit.mjs`. Existing scene/application/browser/build untouched by this specialist. Coordinator owns later DEV integration: `installDevelopmentGlDiagnostic(renderer.getContext())`, returning its cleanup from the effect. Query must explicitly contain `qaGlDiagnostic=1`.

Fourteen native calls covered: program/shader info logs, program parameters, compile/link, uniform locations/active uniforms, bufferData, texImage2D/texStorage2D, multisample renderbuffer allocation, mipmap generation, drawElements/drawArrays. No new GL query, readback, flush or finish. Only per-method count/totalMs/maxMs plus sample/event metadata logged under `[Pool3D GL diagnostic]`; native arguments/results/exceptions are neither retained nor logged. Actual native receiver and error identity are preserved.

Trusted click/input opens a fresh two-rAF window, cancelling the previous window if input supersedes it; cap60 windows. Outside an active window wrappers skip the clock. Without opt-in no methods/listeners/rAF/clock work is installed. Missing/non-wrappable methods are skipped. Cleanup cancels pending callbacks/listeners and restores original method descriptors/prototype ownership, preserving later wrappers installed by another owner.

Targeted `node scripts/development-gl-diagnostic-audit.mjs`: PASS31 fake-GL/clock checks for aggregation, no opt-in work, trusted input, missing/read-only methods, receiver/argument/result identity, native exceptions, clock failure, window replacement, two-rAF finalization, cap, cleanup and absence of argument/result/exception values in logs. This plumbing test makes no browser performance claim.

SHA256 module `7ca65a6568abef166205792318d957aa05508e04e8907a782f3e843454f2a874`; audit `c8ae526da4b54f18384ef1999e31f1383cf4ceecd65a4da9fdda790b697d0caa`.
