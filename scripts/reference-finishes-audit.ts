import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { PNG } from "pngjs";
import { REFERENCE_FINISHES, referenceSampleMatrix, type ReferencePoint } from "../src/lib/pool/reference-finishes";
import { cloneReferenceFinishColorMap, configureReferenceCoping, configureReferencePaving, loadReferenceFinishMaps, projectReferenceSample, subscribeReferenceFinishReady } from "../src/components/pool/three/referenceFinishTexture";
import { Texture, TextureLoader, type WebGLProgramParametersWithUniforms } from "three";

let checks = 0;
const check = (value: unknown, message: string) => { checks++; assert.ok(value, message); };
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const directory = join(process.cwd(), "public/textures/references/20261018");
const provenance = JSON.parse(readFileSync(join(directory, "provenance.json"), "utf8"));

check(REFERENCE_FINISHES.length === 8, "All eight owner references are represented");
check(new Set(REFERENCE_FINISHES.map(f => f.id)).size === 8, "No duplicate selection identities");
check(REFERENCE_FINISHES[0].description.includes("da confermare"), "Unknown first material remains explicitly unidentified");
for (const finish of REFERENCE_FINISHES) {
  const image = readFileSync(join(directory, `image-${finish.sourceImage}.jpeg`));
  check(hash(image) === provenance.images[finish.sourceImage - 1].sha256, `${finish.id}: original image checksum retained`);
  check(image.byteLength === provenance.images[finish.sourceImage - 1].bytes, `${finish.id}: no hidden raster conversion`);
  check(!finish.asset.normalMap && !finish.asset.roughnessMap, `${finish.id}: no fabricated measured PBR maps`);
  check(!finish.asset.mirroredRepeat, `${finish.id}: no mirrored source repetitions`);
  check(finish.color === "#ffffff", `${finish.id}: neutral multiplier preserves reference colours`);
  check(finish.textureSize.every(n => Number.isFinite(n) && n > 0), `${finish.id}: physical mapping is finite`);
  const m = referenceSampleMatrix(finish.sample, finish.imageSize);
  check(m.every(Number.isFinite), `${finish.id}: finite projection`);
  const [width, height] = finish.imageSize;
  const expected: readonly ReferencePoint[] = finish.sample.kind === "rectangle"
    ? [[finish.sample.pixels[0], finish.sample.pixels[1]], [finish.sample.pixels[0] + finish.sample.pixels[2], finish.sample.pixels[1]],
      [finish.sample.pixels[0] + finish.sample.pixels[2], finish.sample.pixels[1] + finish.sample.pixels[3]],
      [finish.sample.pixels[0], finish.sample.pixels[1] + finish.sample.pixels[3]]]
    : finish.sample.pixels;
  for (const [index, [u, v]] of ([[0, 0], [1, 0], [1, 1], [0, 1]] as const).entries()) {
    const source = projectReferenceSample(finish.id, u, v);
    check(close(source[0] * width, expected[index]![0]) && close((1 - source[1]) * height, expected[index]![1]), `${finish.id}: projective corner ${index} maps to original measured pixel`);
  }
  // The cropped area must remain a regular, orientation-preserving mapping,
  // not a folded/singular projected photo. Test interior as well as corners.
  for (let u = 0; u <= 1; u += 0.1) for (let v = 0; v <= 1; v += 0.1) {
    const p = projectReferenceSample(finish.id, u, v);
    check(p[0] > 0 && p[0] < 1 && p[1] > 0 && p[1] < 1, `${finish.id}: safe source window`);
    const dx = projectReferenceSample(finish.id, u + 1e-5, v), dy = projectReferenceSample(finish.id, u, v + 1e-5);
    const jacobian = (dx[0] - p[0]) * (dy[1] - p[1]) - (dx[1] - p[1]) * (dy[0] - p[0]);
    check(jacobian < 0, `${finish.id}: photographic projection never mirrors/folds`);
  }
  // Captions belong below these Y coordinates, so none can appear in 3D.
  const captionTop = ({ 2: 1040, 3: 548, 4: 550, 5: 554 } as Record<number, number>)[finish.sourceImage];
  if (captionTop) check(expected.every(p => p[1] < captionTop), `${finish.id}: caption excluded`);
  if (finish.sourceImage === 7 || finish.sourceImage === 8) check(expected.every(p => p[1] < (finish.sourceImage === 7 ? 900 : 700)), `${finish.id}: camera icon excluded`);

  const shader = { uniforms: {}, vertexShader: "", fragmentShader: "#include <map_fragment>" } as WebGLProgramParametersWithUniforms;
  configureReferencePaving(shader, finish.id);
  check(shader.fragmentShader.includes("referenceColour(map, vMapUv, referenceVariant)"), `${finish.id}: paving reuses metric geometry UV`);
  check(shader.uniforms["referenceMetricSize"]?.value.x === finish.textureSize[0], `${finish.id}: metric scale reaches shader`);
  check(shader.uniforms["referenceExposure"]?.value === (finish.id === "reference-ipe" ? 0.55 : 1), `${finish.id}: neutral photographic exposure restricted to Ipè`);
  const copingShader = { uniforms: {}, vertexShader: "", fragmentShader: "vec3 stoneColor = texture2D(stoneColorMap, vTriWorldPosition.zy * TRI_UV_SCALE).rgb * stoneWeights.x\n + texture2D(stoneColorMap, vTriWorldPosition.xz * TRI_UV_SCALE).rgb * stoneWeights.y\n + texture2D(stoneColorMap, vTriWorldPosition.xy * TRI_UV_SCALE).rgb * stoneWeights.z;" } as WebGLProgramParametersWithUniforms;
  configureReferenceCoping(copingShader, finish.id);
  check(copingShader.fragmentShader.includes("referenceColour(stoneColorMap, referenceMetric, referenceVariant)"), `${finish.id}: coping uses its existing longitudinal slab frame`);
  if ("additionalSamples" in finish) {
    check(finish.additionalSamples.length === 3, "Four actual photographic boards, not tinted copies");
    check(shader.fragmentShader.includes("vColor.r * 997.0"), "Variant selected by existing stable per-module colour attribute");
    for (const [index, sample] of finish.additionalSamples.entries()) {
      const points = sample.pixels;
      check(shader.uniforms[`referenceSourceProjection${index + 1}`]?.value.elements.every(Number.isFinite), "Every board projection reaches the shared shader");
      for (const [corner, [u,v]] of ([[0,0],[1,0],[1,1],[0,1]] as const).entries()) {
        const projected = projectReferenceSample(finish.id,u,v,index + 1);
        check(close(projected[0]*width, points[corner]![0]) && close((1-projected[1])*height,points[corner]![1]), "Each real board maps to its unchanged source corners");
      }
    }
  } else check(!shader.fragmentShader.includes("uniform mat3 referenceSourceProjection1"), "Stone has no unnecessary board-variant uniforms");
}
// Inspect the unchanged JPEG's actual pixels using the native decoder, not
// an assumed brown tint. The temporary PNG is diagnostic only; no processed
// texture enters public assets. A joint crossing this crop previously had
// R=25 and 4.6% near-black pixels and must not become a second fake board seam.
const decodeDirectory = mkdtempSync(join(tmpdir(), "pool-reference-colour-"));
const decodedPath = join(decodeDirectory, "ipe-diagnostic.png");
try {
  execFileSync("sips", ["-s", "format", "png", join(directory, "image-6.jpeg"), "--out", decodedPath], { stdio: "ignore" });
  const decoded = PNG.sync.read(readFileSync(decodedPath));
  const ipe = REFERENCE_FINISHES.find(finish => finish.id === "reference-ipe")!;
  const quad = ipe.sample.pixels;
  let r = 0, g = 0, b = 0, pixels = 0, minimumR = 255;
  const x0 = Math.min(...quad.map(point => point[0])), x1 = Math.max(...quad.map(point => point[0]));
  const y0 = Math.min(...quad.map(point => point[1])), y1 = Math.max(...quad.map(point => point[1]));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (!quad.every((a, index) => {
      const next = quad[(index + 1) % quad.length]!;
      return (next[0] - a[0]) * (y - a[1]) - (next[1] - a[1]) * (x - a[0]) >= 0;
    })) continue;
    const offset = (y * decoded.width + x) * 4;
    r += decoded.data[offset]!; g += decoded.data[offset + 1]!; b += decoded.data[offset + 2]!;
    minimumR = Math.min(minimumR, decoded.data[offset]!); pixels++;
  }
  check(pixels > 4000, "Ipè photographic board sample has actual source coverage");
  check(minimumR > 100, "Ipè source sample contains no photographed black board joint");
  check(r / pixels - g / pixels > 10 && g / pixels - b / pixels > 9, "Ipè original source chroma is warm brown without a shader tint");
  const exposure = ipe.photographicExposure;
  const before = [r / pixels, g / pixels, b / pixels].map(channel => {
    const srgb = channel / 255;
    return srgb <= .04045 ? srgb / 12.92 : ((srgb + .055) / 1.055) ** 2.4;
  });
  const after = before.map(channel => channel * exposure);
  check(close(after[0]! / after[1]!, before[0]! / before[1]!) && close(after[1]! / after[2]!, before[1]! / before[2]!), "Photographic exposure preserves linear RGB chromaticity exactly");
  const [sx, sy, sw, sh] = ipe.swatchPixels;
  for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) {
    const offset = (y * decoded.width + x) * 4;
    check(decoded.data[offset]! > 100, "Ipè card crop also excludes the photographed dark joint");
  }
} finally {
  try { unlinkSync(decodedPath); } catch {}
  rmdirSync(decodeDirectory);
}
// A deterministic asynchronous loader proves the production cache shares one
// load between coping and paving, cancellation works, and disposed clones are
// not invalidated when the deferred image eventually resolves. No DOM/network.
const originalLoad = TextureLoader.prototype.load;
const pendingLoads = new Map<string, () => void>();
let loaderCalls = 0;
TextureLoader.prototype.load = function (url, onLoad) {
  loaderCalls++;
  const source = new Texture();
  pendingLoads.set(url, () => {
    source.image = { width: 16, height: 16 };
    source.needsUpdate = true;
    onLoad?.(source);
  });
  return source;
};
try {
  for (const finish of REFERENCE_FINISHES) {
    const before = loaderCalls;
    const coping = loadReferenceFinishMaps(finish.id);
    const paving = cloneReferenceFinishColorMap(finish.id);
    check(loaderCalls - before === 1, `${finish.id}: coping and paving issue only one shared texture load`);
    check(coping.colorMap.source === paving.source, `${finish.id}: shared decoded source, consumer-owned texture clones`);
    let notifications = 0, cancelledNotifications = 0;
    const unsubscribe = subscribeReferenceFinishReady(finish.id, () => { notifications++; });
    const cancel = subscribeReferenceFinishReady(finish.id, () => { cancelledNotifications++; });
    cancel();
    const disposed = cloneReferenceFinishColorMap(finish.id);
    let disposeEvents = 0;
    disposed.addEventListener("dispose", () => { disposeEvents++; });
    disposed.dispose();
    const disposedVersion = disposed.version;
    check(notifications === 0, `${finish.id}: pending image never claims readiness early`);
    pendingLoads.get(finish.asset.url)!();
    check(notifications === 1 && cancelledNotifications === 0, `${finish.id}: ready callback fires once; cancelled callback does not`);
    check(disposedVersion === disposed.version && disposeEvents === 1, `${finish.id}: disposed consumers removed before async completion`);
    check(coping.colorMap.image === paving.image && paving.image.width === 16, `${finish.id}: source arrival reaches both actual clones`);
    check(coping.colorMap.version > 0 && paving.version > 0, `${finish.id}: both GPU texture versions invalidated`);
    let immediate = false;
    const removeReady = subscribeReferenceFinishReady(finish.id, () => { immediate = true; });
    check(immediate && loaderCalls - before === 1, `${finish.id}: cached reselection is synchronously ready without another request`);
    removeReady(); unsubscribe();
    coping.colorMap.dispose(); coping.normalMap.dispose(); paving.dispose();
  }
  check(loaderCalls === 8, "Cache bounded to one source load for each of eight reference assets");
} finally { TextureLoader.prototype.load = originalLoad; }
console.log(JSON.stringify({ status: "PASS", finishes: 8, checks, evidence: "original checksums, safe source windows, caption/icon exclusion, non-mirrored projection, metric shader setup" }));
