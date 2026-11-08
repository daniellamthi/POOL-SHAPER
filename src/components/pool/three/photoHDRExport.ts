import {
  DataTexture,
  FloatType,
  LinearSRGBColorSpace,
  NearestFilter,
  RGBAFormat,
  type Texture,
  type WebGLRenderTarget,
} from "three";
import type { WebGLPathTracer } from "three-gpu-pathtracer";
import { PHOTO_MODE_EXPORT_READY_SAMPLES } from "@/lib/pool/photoModeState";

type OutputCallback = WebGLPathTracer["renderToCanvasCallback"];

/** Own the copied HDR image and a short-lived worker, never the accumulator.
 * A completed image is drawn through the stock output path before export.
 */
export function installPhotoHDRExport(
  tracer: WebGLPathTracer,
  stockOutput: OutputCallback,
  onPreparing: (value: boolean) => void,
  createWorker: () => Worker = () =>
    new Worker("/vendor/photo-denoise/photo-hdr-worker.js", { type: "module" }),
  preserveRegions?: () => [number, number][][],
  captureFrame?: () => WebGLRenderTarget | null,
) {
  const fallback = tracer.renderToCanvasCallback;
  let worker: Worker | null = null;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let clean: DataTexture | null = null;
  let pending = false,
    requested = false,
    exportable = false,
    failed = false,
    disposed = false;
  let previousPause = tracer.pausePathTracing;

  const stopWorker = () => {
    if (deadline !== undefined) clearTimeout(deadline);
    deadline = undefined;
    worker?.terminate();
    worker = null;
    onPreparing(false);
  };
  const fail = (error: unknown) => {
    console.warn("[PhotoMode] HDR cleanup unavailable; retaining the accumulated photo.", error);
    stopWorker();
    tracer.pausePathTracing = previousPause;
    failed = true;
  };
  const output: OutputCallback = (target, gl, quad) => {
    if (clean) {
      const material = quad.material as typeof quad.material & { map: Texture };
      const originalMap = material.map;
      try {
        material.map = clean;
        stockOutput(target, gl, quad);
      } finally {
        material.map = originalMap;
      }
    } else fallback(target, gl, quad);
    // A worker reply alone is not export readiness: this callback must first
    // draw that image in the same task in which the canvas will be captured.
    exportable = pending && !!(clean || failed);
    if (
      !requested ||
      worker ||
      tracer.samples < PHOTO_MODE_EXPORT_READY_SAMPLES ||
      quad.material.opacity < 1
    )
      return;
    requested = false;
    previousPause = tracer.pausePathTracing;
    try {
      const frame = captureFrame?.();
      if (
        frame &&
        (frame.width !== target.width ||
          frame.height !== target.height ||
          frame.texture.type !== FloatType)
      )
        throw new Error("Stale HDR display target");
      if (target.texture.type !== FloatType || target.width * target.height > 8_388_608) {
        throw new Error("Unsupported HDR capture target");
      }
      const { width, height } = target;
      const expectedBytes = width * height * 16;
      const pixels = new Float32Array(width * height * 4);
      // Inference needs the original noise statistics. Keep its input raw;
      // only the protected water ROI comes from the existing display filter.
      gl.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      const polygons = preserveRegions?.();
      const points = polygons?.flat() ?? [];
      let preserveRect:
        { x: number; y: number; width: number; height: number; buffer: ArrayBuffer } | undefined;
      if (frame && points.length) {
        if (
          points.some((p) => p.length !== 2 || p.some((v) => !Number.isFinite(v) || v < 0 || v > 1))
        )
          throw new Error("Invalid HDR preservation coordinates");
        const x = Math.max(0, Math.floor(Math.min(...points.map((p) => p[0])) * width));
        const y = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1])) * height));
        const w = Math.min(width, Math.ceil(Math.max(...points.map((p) => p[0])) * width)) - x;
        const h = Math.min(height, Math.ceil(Math.max(...points.map((p) => p[1])) * height)) - y;
        if (w > 0 && h > 0) {
          const values = new Float32Array(w * h * 4);
          gl.readRenderTargetPixels(frame, x, y, w, h, values);
          preserveRect = { x, y, width: w, height: h, buffer: values.buffer };
        }
      }
      worker = createWorker();
      const job = worker;
      tracer.pausePathTracing = true;
      onPreparing(true);
      deadline = setTimeout(() => {
        if (worker === job) fail(new Error("HDR cleanup deadline"));
      }, 180_000);
      job.onerror = (event) => {
        if (worker === job) fail(event.message);
      };
      job.onmessageerror = () => {
        if (worker === job) fail(new Error("Invalid HDR worker message"));
      };
      job.onmessage = ({ data }) => {
        if (worker !== job || disposed) return;
        if (data.type === "error") {
          fail(data.message);
          return;
        }
        if (data.type !== "done") return;
        try {
          if (!(data.buffer instanceof ArrayBuffer) || data.buffer.byteLength !== expectedBytes) {
            throw new Error("Invalid HDR worker output");
          }
          const values = new Float32Array(data.buffer);
          if (!values.every(Number.isFinite)) throw new Error("Non-finite HDR worker output");
          clean = new DataTexture(values, width, height, RGBAFormat, FloatType);
          clean.colorSpace = LinearSRGBColorSpace;
          clean.minFilter = clean.magFilter = NearestFilter;
          clean.needsUpdate = true;
          stopWorker();
        } catch (error) {
          fail(error);
        }
      };
      job.postMessage(
        {
          width: target.width,
          height: target.height,
          buffer: pixels.buffer,
          ...(polygons ? { preservePolygons: polygons } : {}),
          ...(preserveRect ? { preserveRect } : {}),
        },
        preserveRect ? [pixels.buffer, preserveRect.buffer] : [pixels.buffer],
      );
    } catch (error) {
      fail(error);
    }
  };
  tracer.renderToCanvasCallback = output;

  const reset = () => {
    stopWorker();
    tracer.pausePathTracing = previousPause;
    clean?.dispose();
    clean = null;
    pending = requested = exportable = failed = false;
  };
  return {
    get working() {
      return worker !== null;
    },
    request() {
      if (disposed || pending || worker) return;
      pending = true;
      exportable = false;
      requested = !clean && !failed;
    },
    consumeExport() {
      if (!exportable) return false;
      pending = exportable = false;
      return true;
    },
    reset,
    dispose() {
      if (disposed) return;
      disposed = true;
      reset();
      if (tracer.renderToCanvasCallback === output) tracer.renderToCanvasCallback = fallback;
    },
  };
}
