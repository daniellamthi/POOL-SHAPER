import * as THREE from "three";
import type { WebGLPathTracer } from "three-gpu-pathtracer";
import { installPhotoOutputFilter } from "../src/components/pool/three/photoOutputFilter";

/** Browser/GPU regression fixture. Does not render to the visible canvas. */
export function runPhotoOutputNumericProbe(gl: THREE.WebGLRenderer) {
  const size = 16;
  const data = new Float32Array(size * size * 4);
  for (let i = 0; i < size * size; i++) data.set([0.2, 0.3, 0.4, 1], i * 4);
  const invalid = [5 + 5 * size, 11 + 9 * size];
  data.fill(NaN, invalid[0]! * 4, invalid[0]! * 4 + 3);
  data.fill(Infinity, invalid[1]! * 4, invalid[1]! * 4 + 3);
  const bright = 12 + 3 * size;
  data.fill(1e20, bright * 4, bright * 4 + 3);
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
  texture.needsUpdate = true;
  const result = new Float32Array(data.length);
  const original: WebGLPathTracer["renderToCanvasCallback"] = (target, renderer) => {
    renderer.readRenderTargetPixels(target, 0, 0, size, size, result);
  };
  const tracer = { samples: 200, renderToCanvasCallback: original } as unknown as WebGLPathTracer;
  const source = { width: size, height: size, texture } as unknown as THREE.WebGLRenderTarget;
  const quad = { material: { opacity: 1, map: texture } } as unknown as Parameters<
    typeof original
  >[2];
  const dispose = installPhotoOutputFilter(tracer);
  try {
    tracer.renderToCanvasCallback(source, gl, quad);
    let inputNonFinite = 0,
      outputNonFinite = 0,
      newNonFinite = 0,
      maxFlatError = 0;
    for (let i = 0; i < size * size; i++) {
      const inputValid = [0, 1, 2].every((c) => Number.isFinite(data[i * 4 + c]));
      const outputValid = [0, 1, 2].every((c) => Number.isFinite(result[i * 4 + c]));
      if (!inputValid) inputNonFinite++;
      if (!outputValid) outputNonFinite++;
      if (inputValid && !outputValid) newNonFinite++;
      if (inputValid && i !== bright && outputValid)
        for (let c = 0; c < 3; c++) {
          maxFlatError = Math.max(maxFlatError, Math.abs(result[i * 4 + c]! - data[i * 4 + c]!));
        }
    }
    const brightFinite = [0, 1, 2].every((c) => Number.isFinite(result[bright * 4 + c]));
    const pass =
      inputNonFinite === 2 && newNonFinite === 0 && brightFinite && maxFlatError < 0.00001;
    return {
      pass,
      dimensions: [size, size],
      inputNonFinite,
      outputNonFinite,
      newNonFinite,
      brightFinite,
      maxFlatError,
    };
  } finally {
    dispose();
    texture.dispose();
  }
}

/** Low-light noise versus coherent one-pixel joints: neither score alone is acceptance. */
export function runPhotoOutputDetailProbe(
  gl: THREE.WebGLRenderer,
  install: typeof installPhotoOutputFilter = installPhotoOutputFilter,
) {
  const width = 96,
    height = 64;
  const input = new Float32Array(width * height * 4);
  let seed = 12345;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const level = x < 48 ? 0.06 : 0.6;
      const noise = (random() + random() + random() + random() - 2) * (x < 48 ? 0.04 : 0.12);
      const value = x === 24 ? 0.001 : x === 72 ? 4 : Math.max(0.00001, level + noise);
      input.set([value, value * 0.75, value * 0.5, 1], (y * width + x) * 4);
    }
  const texture = new THREE.DataTexture(input, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.needsUpdate = true;
  const output = new Float32Array(input.length);
  const original: WebGLPathTracer["renderToCanvasCallback"] = (target, renderer) =>
    renderer.readRenderTargetPixels(target, 0, 0, width, height, output);
  const tracer = { samples: 200, renderToCanvasCallback: original } as unknown as WebGLPathTracer;
  const source = { texture, width, height } as unknown as THREE.WebGLRenderTarget;
  const quad = { material: { map: texture, opacity: 1 } } as unknown as Parameters<
    typeof original
  >[2];
  const dispose = install(tracer);
  try {
    tracer.renderToCanvasCallback(source, gl, quad);
    const summarize = (data: Float32Array) => {
      const column = (x: number) => {
        let sum = 0;
        for (let y = 8; y < height - 8; y++) sum += data[(y * width + x) * 4]!;
        return sum / (height - 16);
      };
      const values: number[] = [];
      for (let y = 8; y < height - 8; y++)
        for (let x = 5; x < 19; x++) values.push(data[(y * width + x) * 4]!);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      return {
        mean,
        variance: values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length,
        darkJointContrast: (column(20) + column(28)) / 2 - column(24),
        brightLineContrast: column(72) - (column(68) + column(76)) / 2,
        stepContrast: column(54) - column(42),
      };
    };
    const raw = summarize(input),
      filtered = summarize(output);
    return {
      raw,
      filtered,
      varianceRatio: filtered.variance / raw.variance,
      darkJointContrastRetention: filtered.darkJointContrast / raw.darkJointContrast,
      brightLineContrastRetention: filtered.brightLineContrast / raw.brightLineContrast,
      stepContrastRetention: filtered.stepContrast / raw.stepContrast,
      finite: output.every(Number.isFinite),
      limits: "Synthetic low-light/edge tradeoff; not full-scene texture fidelity",
    };
  } finally {
    dispose();
    texture.dispose();
  }
}
