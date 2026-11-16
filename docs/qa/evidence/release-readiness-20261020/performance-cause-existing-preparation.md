# Existing preparation points — read-only

No existing `compileAsync`, explicit `compile` or shader preload phase found in the scoped normal raster pool path. No code/browser/build changed during this check.

- `PoolViewport.tsx:109`/`:219`: `ViewportFallback` under ClientOnly/Suspense covers lazy client code or components suspending for assets. It is not a shader/GL readiness gate and does not delay the next ordinary frame after a material/light selection.
- `PoolScene.tsx:1822` + `DaylightEnvironment.tsx:120`: Infinity preparation overlay tracks panorama/HDR texture arrival/error only. It marks ready before any evidence that shaders, reflection/shadow variants or transmission buffers are ready. Its existing visual language could be reused for a proven preparation operation, but showing this overlay alone cannot remove a synchronous driver stall.
- `HeroCaptureListener` checks `useProgress.active`, settled camera and a1.5s delay for export capture. This does not provide normal interactive draw suppression/readiness.
- `DaylightEnvironment.tsx:136` loads HDR asynchronously and otherwise mounts a procedural Drei Environment. Both feed the running scene; no compile/readiness promise gates the initial GL use.
- `PhotoModeRenderer.tsx:293` uses a separate path tracer, synchronous `setScene`, progressive samples and priority1 frame ownership. Normal raster configuration deliberately does not download/mount that mode. Reusing it for normal configuration would expand scope and not solve the existing raster pipeline through an established hook.

Conclusion: there is an existing loader appearance, but no existing safe shader-preparation mechanism to attach a one-line fix to. Native GL attribution remains necessary before introducing a bounded readiness gate or changing material/program lifetime. The independent GL probe stays unimported until coordinator handoff.
