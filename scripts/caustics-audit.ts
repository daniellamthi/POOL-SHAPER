import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCausticsMap } from "../src/components/pool/three/textures";
import { WATER_VISUAL_PRESET } from "../src/configurator/materials/visual-presets";
import { LINER_COLORS } from "../src/lib/pool/config";

// Numerical rendering contracts, not a physical certification or GPU image test.
// Read the actual receiving transfer so changing gain/thresholds cannot bypass it.
const source = readFileSync("src/components/pool/three/PoolModel.tsx", "utf8");
const transfer = source.match(/float causticLight = smoothstep\(([\d.]+), ([\d.]+), causticValue\) \* ([\d.]+)\s*\* min\(causticStrength, ([\d.]+)\) \* exp\(-underwaterDepth \* ([\d.]+)\)/);
assert(transfer, "Update the CPU mirror if the receiving-light equation changes");
const [low, high, gain, cap, attenuation] = transfer.slice(1).map(Number);
assert.match(source, /vec2 p = position \* 0\.4;/);
assert.match(source, /return \(a \+ b\) \* 0\.5;/);
const mirroredField = `float subtleCausticField(vec2 position, float time) {
  vec2 p = position * 0.4;
  vec2 warp = vec2(sin(p.y * 7.0 + time * 0.51), sin(p.x * 8.0 - time * 0.39)) * 0.012;
  float a = texture2D(causticMap, p + warp + vec2(time * 0.013, -time * 0.008)).r;
  float b = texture2D(causticMap, mat2(0.8, -0.6, 0.6, 0.8) * p * 1.23 - warp + vec2(-time * 0.011, time * 0.015)).r;
  return (a + b) * 0.5;
}`;
assert(source.replace(/\s+/g, " ").includes(mirroredField.replace(/\s+/g, " ")),
  "Update the CPU field mirror if its GLSL sampling equation changes");
const texture = createCausticsMap(512), data = texture.image.data as Uint8Array, size = 512;
const wrap = (v: number) => ((v % size) + size) % size;
function sample(u: number, v: number) {
  const x = u * size - 0.5, y = v * size - 0.5;
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const p = (x: number, y: number) => data[(wrap(y) * size + wrap(x)) * 4]! / 255;
  return (p(ix, iy) * (1 - fx) + p(ix + 1, iy) * fx) * (1 - fy)
    + (p(ix, iy + 1) * (1 - fx) + p(ix + 1, iy + 1) * fx) * fy;
}
function field(x: number, y: number, t: number) {
  x *= 0.4; y *= 0.4;
  const wx = Math.sin(y * 7 + t * 0.51) * 0.012;
  const wy = Math.sin(x * 8 - t * 0.39) * 0.012;
  return (sample(x + wx + t * 0.013, y + wy - t * 0.008)
    + sample((0.8 * x + 0.6 * y) * 1.23 - wx - t * 0.011,
      (-0.6 * x + 0.8 * y) * 1.23 - wy + t * 0.015)) * 0.5;
}
function modulation(x: number, y: number, t: number, depth: number, strength: number) {
  const f = field(x, y, t);
  const u = Math.max(0, Math.min(1, (f - low!) / (high! - low!)));
  return u * u * (3 - 2 * u) * gain! * Math.min(strength, cap!) * Math.exp(-depth * attenuation!);
}
let sum = 0, maxGradient = 0;
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const value = data[(y * size + x) * 4]!;
  sum += value;
  maxGradient = Math.max(maxGradient,
    Math.abs(value - data[(y * size + (x + 1) % size) * 4]!),
    Math.abs(value - data[(((y + 1) % size) * size + x) * 4]!));
}
const textureMean = sum / (size * size * 255);
const results: Array<{ liner: string; mean: number; peak: number; brightCoverage: number; temporalPeak: number }> = [];
for (const liner of LINER_COLORS) {
  const strength = liner.underwater.causticStrength * WATER_VISUAL_PRESET.causticVisibility;
  let total = 0, peak = 0, temporalPeak = 0, bright = 0, count = 0;
  for (const [length, width] of [[10, 4.5], [8, 3]]) for (const depth of [0.4, 1.5]) {
    const bound = gain! * Math.min(strength, cap!) * Math.exp(-depth * attenuation!);
    for (const seconds of [0, 12, 60]) for (let z = 0; z < 64; z++) for (let x = 0; x < 128; x++) {
      const t = seconds * WATER_VISUAL_PRESET.caustics.speed * 0.93;
      const px = x / 128 * length! - depth * 0.18, pz = z / 64 * width! - depth * 0.12;
      const v = modulation(px, pz, t, depth, strength);
      const next = modulation(px, pz, t + WATER_VISUAL_PRESET.caustics.speed * 0.93 / 60, depth, strength);
      total += v; peak = Math.max(peak, v); count++;
      if (v > bound * 0.5) bright++;
      temporalPeak = Math.max(temporalPeak, Math.abs(next - v));
    }
  }
  results.push({ liner: liner.id, mean: total / count, peak, brightCoverage: bright / count, temporalPeak });
}
console.log(JSON.stringify({ textureMean, maxGradient, visibility: WATER_VISUAL_PRESET.causticVisibility, results }, null, 2));
if (!process.argv.includes("--measure")) {
  // Preserve the original low-energy texture ceiling; also reject an empty field.
  assert(textureMean > 0.01 && textureMean < 0.08, "Texture must be sparse, not disabled");
  assert(maxGradient < 30, "Soft gradients on both texture axes, including wrapped seams");
  for (const r of results) {
    // Project-specific visual budgets: average added DIRECT diffuse, not all light.
    assert(r.mean > 0.003 && r.mean < 0.04, `${r.liner}: no flat wash or disabled caustics`);
    assert(r.peak > 0.04 && r.peak <= 0.35, `${r.liner}: readable bounded concentrations`);
    assert(r.brightCoverage < 0.15, `${r.liner}: bright traces must not fill the floor`);
    assert(r.temporalPeak > 0 && r.temporalPeak < 0.01, `${r.liner}: nonzero motion without per-frame jumps at 60 Hz`);
  }
  assert.match(source, /float underwaterMask = 1\.0 - step\(waterLevel \+ 0\.0001, vCausticWorldPosition\.y\)/);
  assert.match(source, /reflectedLight\.directDiffuse \* causticLight/);
  assert.match(source, /mix\(outgoingLight, submergedLight, underwaterMask\)/);
  assert.match(source, /const time = clock\.getElapsedTime\(\)/, "No fixed-time capture left in runtime");
  assert.equal((source.match(/onBeforeCompile=\{configureCaustics\}/g) ?? []).length, 4,
    "Caustics attach only to comfort solids, internal stairs, walls and floor, not deck/exterior");
  console.log("PASS: caustics texture, six-liner transfer/distribution/motion and receiver contracts");
}
texture.dispose();
