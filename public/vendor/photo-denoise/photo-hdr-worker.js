import { createPreservationMask } from "./preserve-regions.js";
import { Denoiser } from "./denoiser-0.0.11.mjs";
import { hdrTransferFuncCPU, hdrTransferFuncInverseCPU } from "./hdr-transfer.js";

// A worker owns its WebGL context and model for exactly one export. The caller
// terminates it on completion, cancellation, error or deadline.
self.onmessage = async ({ data: { width, height, buffer, preservePolygons = [], preserveRect } }) => {
  let denoiser, startupRejected, unsubscribeBackend;
  const releaseStartup = () => {
    if (startupRejected) self.removeEventListener("unhandledrejection", startupRejected);
    startupRejected = undefined;
    unsubscribeBackend?.();
    unsubscribeBackend = undefined;
  };
  try {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
        width * height > 8_388_608 || buffer.byteLength !== width * height * 16) {
      throw new Error("Invalid HDR image dimensions");
    }
    const rgba = new Float32Array(buffer);
    const preserve = createPreservationMask(width, height, preservePolygons);
    let displayPixels;
    if (preserveRect) {
      const r = preserveRect;
      if (![r.x,r.y,r.width,r.height].every(Number.isInteger) || r.x < 0 || r.y < 0 || r.width < 1 || r.height < 1 ||
          r.x + r.width > width || r.y + r.height > height || !(r.buffer instanceof ArrayBuffer) ||
          r.buffer.byteLength !== r.width * r.height * 16) throw new Error("Invalid HDR preservation pixels");
      displayPixels = new Float32Array(r.buffer);
    }
    const topDown = new Float32Array(width * height * 3);
    let repaired = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const source = (y * width + x) * 4;
        if (!Number.isFinite(rgba[source + 3]) || rgba[source + 3] < 0.999) {
          throw new Error("HDR output must be opaque");
        }
        const target = ((height - 1 - y) * width + x) * 3;
        for (let c = 0; c < 3; c++) {
          const value = rgba[source + c];
          topDown[target + c] = Number.isFinite(value) && value >= 0 ? value : (repaired++, 0);
        }
      }
    }
    // This vendor starts async backend setup in its constructor without
    // exposing that promise. Forward an orphaned startup failure to our caller.
    const backendFailure = new Promise((_, reject) => {
      startupRejected = event => reject(event.reason);
      self.addEventListener("unhandledrejection", startupRejected);
    });
    denoiser = new Denoiser("webgl");
    denoiser.weightsUrl = new URL(".", self.location.href).href.replace(/\/$/, "");
    denoiser.quality = "balanced";
    denoiser.hdr = true;
    denoiser.srgb = false;
    denoiser.useTiling = true;
    denoiser.tileSize = 256;
    denoiser.batchSize = 1;
    denoiser.warmstart = false;
    denoiser.outputMode = "float32";
    await Promise.race([new Promise(resolve => {
      if (denoiser.backendReady) resolve();
      else unsubscribeBackend = denoiser.onBackendReady(resolve);
    }), backendFailure]);
    releaseStartup();
    denoiser.width = width;
    denoiser.height = height;
    // This published port selects HDR weights but does not apply the required
    // PU transfer itself. Never send tone-mapped/sRGB pixels to this model.
    denoiser.setInputData("color", hdrTransferFuncCPU({
      data: topDown, channels: 3, inputScale: 1,
    }), { channels: 3 });
    const encoded = await denoiser.execute();
    const clean = hdrTransferFuncInverseCPU({ data: encoded, channels: 3, inputScale: 1 });
    if (clean.length !== width * height * 3) throw new Error("Invalid HDR output size");
    const output = new Float32Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const target = ((height - 1 - y) * width + x) * 4;
        const keep = preserve?.[target / 4];
        let preservedIndex = target;
        if (keep && displayPixels) {
          const bottomY = height - 1 - y, r = preserveRect;
          if (x < r.x || x >= r.x + r.width || bottomY < r.y || bottomY >= r.y + r.height)
            throw new Error("Preserved HDR pixel outside captured ROI");
          preservedIndex = ((bottomY - r.y) * r.width + x - r.x) * 4;
          if (!Number.isFinite(displayPixels[preservedIndex + 3]) || displayPixels[preservedIndex + 3] < .999)
            throw new Error("Preserved HDR pixels must be opaque");
        }
        for (let c = 0; c < 3; c++) {
          const value = keep ? (displayPixels ?? rgba)[preservedIndex + c] : clean[(y * width + x) * 3 + c];
          if (!keep && (!Number.isFinite(value) || value < 0)) throw new Error("Invalid HDR output value");
          output[target + c] = Number.isFinite(value) && value >= 0 ? value : 0;
        }
        output[target + 3] = 1;
      }
    }
    self.postMessage({ type: "done", buffer: output.buffer, repaired }, [output.buffer]);
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  } finally {
    releaseStartup();
    try { denoiser?.dispose(); } catch { /* Termination also releases this context. */ }
  }
};
