# Source-only cause analysis

Read-only while another specialist owns the browser. No application edit, build, browser call or fake-GL unit benchmark. Inspected only current pool material/light/reflection lifecycle and installed Three/R3F implementation.

## Confirmed source mechanisms

1. `WebGLPrograms.js:339`/`:473` includes spot-light count, projected-light-map count, shadow count/type in the program cache key and GLSL defines. Optional lighting can therefore invalidate shaders for many otherwise unchanged PBR materials. `PoolLights.tsx:474` passes `powered={showWater}`: selected wall spots are mounted for wet Day as well as Night. `PoolComfortModel.tsx:184` mounts each micro spotlight only for Night and positive output. Optional feature removal also unmounts their fixture materials.
2. `PoolModel.tsx:1127`,`:1176`,`:1227`,`:1266` wet/dry material keys remount existing interior materials. The key/cache change is intentional: `configureCaustics` returns before patching dry shaders (`:762`); wet shaders add actual underwater code/uniforms. R3F `removeChild` idle-disposes non-primitive materials; Three `onMaterialDispose` releases all material program references and `WebGLPrograms.releaseProgram` destroys a program when its reference count reaches0. Revisit costs can therefore include real program reacquisition, not merely uniform writes. The current evidence does not quantify this cost.
3. `WaterSurfaceMaterial.tsx:350` hides the `pool-basin` group for the mirror pass. Stair micro-spots live inside that group (`PoolModel.tsx:1156`); wall `PoolLights` are outside it (`PoolScene.tsx:1640`). Main/mirror passes can therefore use different light counts. Shadow depth/distance materials are generated internally by `WebGLShadowMap.getDepthMaterial`, outside ordinary scene-material traversal. Glass/water transmission also creates per-camera render targets, multisample buffers and mipmaps (`WebGLRenderer.js:1973`), another candidate for first-use GL allocation waits.
4. `WebGLProgram.js:858` links programs; first `getUniforms`/`getAttributes` runs `onFirstUse`, which calls program/shader info logs, LINK_STATUS (default `checkShaderErrors=true`), then uniform/attribute enumeration and location queries (`:860`–`:985`, `WebGLUniforms.js:1114`). These first-use queries occur inside ordinary rendering, distinct from the measured cheap app sampler audit. Disabling shader diagnostics alone does not remove uniform/attribute queries or prove a fix.

## Why a one-line compileAsync addition is not demonstrated safe

Installed `WebGLRenderer.compileAsync` traverses ordinary materials after gathering scene lights, then polls each `program.isReady()` every10ms. With `KHR_parallel_shader_compile`, completion polling can avoid a blocking first link-use query. Actual browser extension support has not been collected. Without KHR, `isReady` immediately reports true and the10ms wait does not guarantee stall-free rendering.

Calling compileAsync after the same frame already drew is too late. Preventing first use needs a cancellation-safe draw/readiness gate covering the actual committed materials/lights, without fighting the user's camera. A main-scene compile does not precompile internal shadow materials, the reflection's different visibility/light-count variant, transmission render targets or texture/buffer uploads. Environment preprocessing within `getProgram` can itself do GL work. Source inspection cannot establish that a main-only readiness gate fixes the observed stall.

## Minimum next measurement

One bounded, opt-in application DEV probe during two already reproduced interactions; no profiler install, raw browser protocol or quality change. Preserve original context methods/receiver/returns/errors and restore on cleanup; aggregate count/total/max duration per method plus only slow calls. Record KHR availability once outside the timed path. Reset the small capture budget per trusted click so initial page warm-up cannot consume it before the requested interaction.

Capture the likely blocking first-use/link family: `getProgramInfoLog`, `getShaderInfoLog`, `getProgramParameter`, `linkProgram`, and `getUniformLocation`/`getActiveUniform`. Also capture representative upload/allocation calls `bufferData`, `texImage2D`, `texStorage2D`, `renderbufferStorageMultisample`, `generateMipmap`, plus `drawElements`/`drawArrays` to detect a first draw/driver pipeline wait. Do not call `finish`/`flush` or inject extra status queries to force synchronisation. Log names/counts/timings only, no argument values or shader/customer data.

If program-query waits dominate and KHR is present, prototype async preparation covering actual main+reflection+shadow variants with unchanged visual output. If uploads or draw calls dominate, compileAsync alone is not the correction. If timed native calls stay cheap but outer gl.render remains slow, next inspect bounded CPU material/program preparation. This small attribution step is preferable to changing the renderer without evidence.

## Rejected quick fixes

- Do not blindly remove wet/dry keys: valid shader invalidation, closures and both dry/wet appearance need preservation; liner is explicitly protected.
- Do not keep arbitrary maximum invisible lights to freeze defines: this increases shader/sampler work even for unselected options and may differ between mirror/main passes. It needs separate performance/visual justification.
- Do not reduce shadows, detail, light count, transmission, DPR or shader quality to conceal the issue.
- Do not call a theoretical precompile a measured latency fix. Source evidence establishes plausible lifecycle/first-use paths; the current synchronous `gl.render` stall remains unresolved.
