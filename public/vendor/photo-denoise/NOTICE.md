# Local photo denoising runtime

Loaded only for a requested indoor catalogue photo export. Images stay in a
browser worker; no image, telemetry or inference request is sent to a service.

- `denoiser-0.0.11.mjs`: unmodified npm `denoiser@0.0.11` self-contained ES module,
  Dennis Smolek, MIT. Includes TensorFlow.js (Apache-2.0); bundled notices retained.
  https://www.npmjs.com/package/denoiser/v/0.0.11
- `hdr-transfer.js`: CPU PU transfer functions from `oidn-web@0.5.0`, pissang, MIT.
  https://github.com/pissang/oidn-web
- `rt_hdr.tza`: original Open Image Denoise RT HDR color-only weights, Apache-2.0.
  https://github.com/RenderKit/oidn-weights
- `photo-hdr-worker.js`: Pool Shaper wrapper; sanitizes a copied HDR input,
  applies PU transfer, executes the network and returns linear HDR.

Full MIT and Apache license texts accompany these files. No SDK binary is shipped.
