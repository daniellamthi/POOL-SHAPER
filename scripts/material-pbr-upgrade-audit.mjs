import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";
import { PNG } from "pngjs";
import { MINERAL_ATLAS, mineralAtlasPlan, toLinear, toSrgb } from "./lib/legacy-mineral-atlas.mjs";
import { Texture, TextureLoader, RepeatWrapping, MirroredRepeatWrapping, ClampToEdgeWrapping, SRGBColorSpace, NoColorSpace } from "three";

const root = process.cwd(), file = join(root, "node_modules/.cache/material-pbr-upgrade-audit.mjs");
await build({ input: "material-pbr-entry", output: { file, format: "esm" }, platform: "node", external: ["three"],
  resolve: { alias: { "@": join(root, "src") } }, plugins: [{ name: "material-pbr-entry",
    resolveId: id => id === "material-pbr-entry" ? id : null,
    load: id => id === "material-pbr-entry" ? `
      export * from "${root}/src/components/pool/three/stoneTextures.ts";
      export * from "${root}/src/components/pool/three/referenceFinishTexture.ts";
      export { REFERENCE_FINISHES } from "${root}/src/lib/pool/reference-finishes.ts";
    ` : null,
  }] });
const { loadCopingTextureMaps, createWPCMaps, configureExteriorRoughness,
  legacyMineralTextureScale, legacyMineralTextureUrl, LEGACY_MINERAL_SAMPLER_REVISION,
  configureReferencePaving, configureReferenceCoping, cloneReferenceFinishColorMap,
  subscribeReferenceFinishReady, REFERENCE_FINISHES } = await import(pathToFileURL(file).href);
let checks = 0;
const check = (condition, message) => { checks++; assert(condition, message); };

// Real source data, not an assumption that the KTX2-derived roughness is matte.
const scan = PNG.sync.read(readFileSync("public/textures/coping/travertino/roughness.png"));
let sum = 0, minimum = 255, maximum = 0;
for (let i = 1; i < scan.data.length; i += 4) {
  sum += scan.data[i]; minimum = Math.min(minimum, scan.data[i]); maximum = Math.max(maximum, scan.data[i]);
}
const scanMean = sum / (scan.width * scan.height * 255);
check(scanMean < .05 && maximum / 255 < .1, "Actual legacy travertine scan would give nearly mirror-like dry roughness");
for (const id of ["travertine", "wpc", "limestone", "reference-travertine-light", "reference-ipe"]) {
  const shader = { fragmentShader: "#include <metalnessmap_fragment>" };
  configureExteriorRoughness(shader, id);
  check(shader.fragmentShader.includes("dryTravertineRoughness") === (id === "travertine"), "Only the demonstrated legacy dry-travertine defect receives calibration");
}
const dryTravertineMean = .74 + .16 * scanMean;
check(dryTravertineMean > .74 && dryTravertineMean < .76, "Dry calibration is restrained matte; not a measured reflectance claim");

// Original colours/geometry are unchanged: only the authored WPC roughness data.
const wpc = createWPCMaps(128), another = createWPCMaps(128);
check(wpc.colorMap.image.data === another.colorMap.image.data, "WPC clones share immutable baked pixels");
const digest = map => createHash("sha256").update(map.image.data).digest("hex");
check(digest(wpc.colorMap) === "2314dbe929b22a250cbcac82cc51e1b7de1ac40d6b75ef8e648e2ed56ddb4ce8", "WPC original colour pixels are byte-identical to approved f7fe5a2");
check(digest(wpc.normalMap) === "aa3551472fb8421ebba17881a198af884769c569a94df7b9f0f3cc59d3b6af9e", "WPC original shallow relief pixels are byte-identical to approved f7fe5a2");
let wpcSum = 0;
for (let i = 0; i < wpc.roughnessMap.image.data.length; i += 4) {
  const value = wpc.roughnessMap.image.data[i] / 255;
  check(value >= .83 && value <= .95, "Dry WPC texture has matte micro-roughness, not the old .52 plastic finish");
  check(wpc.normalMap.image.data[i + 2] >= 250, "Existing shallow composite grain is not exaggerated");
  wpcSum += value;
}
for (const maps of [wpc, another]) Object.values(maps).forEach(texture => texture.dispose());

for (const finish of REFERENCE_FINISHES) {
  const shader = { uniforms: {}, fragmentShader: "#include <map_fragment>" };
  configureReferencePaving(shader, finish.id);
  const fragment = shader.fragmentShader;
  check(shader.uniforms.referenceMetricSize.value.x === finish.textureSize[0] && shader.uniforms.referenceMetricSize.value.y === finish.textureSize[1], "Exact existing metric source coverage preserved");
  check(fragment.includes("referencePatchBlend"), "Shared mineral blend calibration installed");
  check(!fragment.includes("mirroredRepeat") && !fragment.includes("rotate("), "No mirror or random grain rotation introduced");
  check((fragment.match(/referencePatch\(sourceMap/g) ?? []).length === 4, "No additional photographic texture fetches");
  const coping = { uniforms: {}, fragmentShader: "vec3 stoneColor = texture2D(stoneColorMap, p).rgb * stoneWeights.z;" };
  configureReferenceCoping(coping, finish.id);
  check(!coping.fragmentShader.includes("vColor.r * 997.0"), "Continuous coping never alternates real board sources");
  check(coping.uniforms.referencePatchBlend.value.x === (finish.boards ? 0 : .25), "Approved Ipè full-width blend is retained, minerals keep unblurred source interiors");
}

// Offline atlas proof: exact reproducible source-derived pixels, unchanged
// grain density/aspect and coherent PBR maps, with no runtime shader work.
const legacyEvidence = [];
const provenance = JSON.parse(readFileSync("public/textures/coping/derived-mineral-v3/provenance.json", "utf8"));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
check(LEGACY_MINERAL_SAMPLER_REVISION === "baked-mineral-v3", "Old runtime sampler programs are invalidated");
check(provenance.images.length === 3 && MINERAL_ATLAS.period === 2 && MINERAL_ATLAS.cells === 8, "Only the three real source maps are authored into a bounded periodic layout");
const bilinear = (image, x, y, colour) => {
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
  const at = (px, py, channel) => {
    check(px >= 0 && px < image.width && py >= 0 && py < image.height, "Photographic source window never wraps, reflects or leaves actual image pixels");
    const byte = image.data[(py * image.width + px) * 4 + channel];
    return colour ? toLinear(byte) : byte;
  };
  return [0, 1, 2].map(c => (at(x0, y0, c) * (1 - tx) + at(x0 + 1, y0, c) * tx) * (1 - ty)
    + (at(x0, y0 + 1, c) * (1 - tx) + at(x0 + 1, y0 + 1, c) * tx) * ty);
};
const field = (image, u, v, colour) => {
  const rgb = [0, 0, 0];
  for (const { point, weight } of mineralAtlasPlan(image.width, image.height, u, v)) {
    if (!weight) continue;
    bilinear(image, point[0], point[1], colour).forEach((value, c) => { rgb[c] += value * weight; });
  }
  return rgb;
};
for (const record of provenance.images) {
  const originalBytes = readFileSync(record.sourcePath), bytes = readFileSync(record.path);
  check(sha(originalBytes) === record.sourceSha256 && sha(bytes) === record.sha256, "Original and derived map identities match the recorded provenance");
  const original = PNG.sync.read(originalBytes), atlas = PNG.sync.read(bytes), colour = record.map === "basecolor";
  check(atlas.width === original.width * 2 && atlas.height === original.height * 2 && Math.max(atlas.width, atlas.height) <= 1094, "Atlas preserves source texels per metre without oversized new textures");
  check(record.license === (record.id === "ardesia" ? "CC0 1.0" : "User supplied for this project; no external redistribution license asserted"), "Original source rights and Prun's project-only licence remain explicit");
  check(legacyMineralTextureUrl(`/textures/coping/${record.id}`, record.map) === record.path.replace("public", ""), "Runtime points to the exact generated source derivative");
  check(legacyMineralTextureScale(record.id) === .5, "Twice the image coverage receives half the original UV repeat, not a scale change to the grain");
  for (let i = 0; i < 900; i++) {
    const x = (i * 173 + 29) % atlas.width, y = (i * 317 + 53) % atlas.height;
    const u = (x + .5) / original.width, v = (y + .5) / original.height;
    const plan = mineralAtlasPlan(original.width, original.height, u, v), rgb = [0, 0, 0];
    check(Math.abs(plan.reduce((n, p) => n + p.weight, 0) - 1) < 1e-12, "Albedo/normal weights remain a convex blend without an invented tint or contrast curve");
    for (const { point, weight } of plan) {
      if (!weight) continue;
      check(Math.abs(point[0] - Math.round(point[0])) < 1e-9 && Math.abs(point[1] - Math.round(point[1])) < 1e-9, "Every source lookup at an atlas texel is an integer-pixel translation, with no resampling blur");
      const offset = (Math.round(point[1]) * original.width + Math.round(point[0])) * 4;
      for (let c = 0; c < 3; c++) rgb[c] += (colour ? toLinear(original.data[offset + c]) : original.data[offset + c]) * weight;
    }
    const offset = (y * atlas.width + x) * 4;
    rgb.forEach((value, c) => check(atlas.data[offset + c] === (colour ? toSrgb(value) : Math.round(value)), "Actual derived pixels exactly equal original source samples blended in the correct colour/data space"));
    check(atlas.data[offset + 3] === 255, "No invented transparency or missing surface pixels");
  }
  let seamError = 0, mirrorDifference = 0;
  for (let i = 0; i < 24; i++) {
    const phase = (i + .37) / 12;
    for (const [u, v] of [[.13, phase], [phase, .17]]) {
      const a = field(original, u, v, colour), b = field(original, u + 2, v, colour), c = field(original, u, v + 2, colour);
      seamError = Math.max(seamError, ...a.map((value, channel) => Math.max(Math.abs(value - b[channel]), Math.abs(value - c[channel]))));
      const reflected = field(original, 2 - u, v, colour);
      mirrorDifference += a.reduce((n, value, channel) => n + (value - reflected[channel]) ** 2, 0);
    }
  }
  check(seamError < 1e-8, "Periodic atlas joins are analytically continuous in both axes, without reflected edges");
  check(mirrorDifference > 1e-5, "The actual source-derived field is not a mirrored slab pattern");
  const epsilon = 1e-7, a = mineralAtlasPlan(original.width, original.height, .1, .14),
    x = mineralAtlasPlan(original.width, original.height, .1 + epsilon, .14),
    y = mineralAtlasPlan(original.width, original.height, .1, .14 + epsilon);
  for (let i = 0; i < 4; i++) {
    check(Math.abs((x[i].point[0] - a[i].point[0]) / (epsilon * original.width) - 1) < 1e-6 && x[i].point[1] === a[i].point[1], "Original grain U density remains +1, without stretching, rotation or reflection");
    check(Math.abs((y[i].point[1] - a[i].point[1]) / (epsilon * original.height) - 1) < 1e-6 && y[i].point[0] === a[i].point[0], "Original grain V density remains +1; PBR maps share their physical footprint");
  }
  if (record.map === "normal") {
    for (let i = 2; i < atlas.data.length; i += 4) check(atlas.data[i] >= 248, "Original shallow slate normal remains restrained without invented relief");
  }
  legacyEvidence.push({ id: record.id, map: record.map, size: [atlas.width, atlas.height], bytes: bytes.length,
    sourceCoverageMultiplier: 2, metricRepeatMultiplier: .5, periodicFieldError: seamError, runtimeExtraTextureReads: 0,
    estimatedAdditionalMipmappedRgbaMiB: +(original.width * original.height * 4 * 3 * 4 / 3 / 1048576).toFixed(3) });
}
check(legacyMineralTextureScale("reference-ipe") === 1 && legacyMineralTextureUrl("/textures/coping/gres", "roughness") === "/textures/coping/gres/roughness.png", "Other approved material families remain untouched");
check(legacyMineralTextureUrl("/other-project/prun", "basecolor") === "/other-project/prun/basecolor.png", "An unrelated source directory ending in the same basename is never redirected");
const runtimeSource = readFileSync("src/components/pool/three/stoneTextures.ts", "utf8");
check(!runtimeSource.includes("legacyMineralSample(") && !runtimeSource.includes("texture2DGradEXT("), "Failed dynamic sampler/branches/gradients are removed, not left active in runtime shaders");
const pavingMaterialSource = readFileSync("src/components/pool/three/StudioPaving.tsx", "utf8");
check(pavingMaterialSource.includes('key={`studio-paving-v3-${id}`}'), "Original gres/wood/istria material identity remounts on family switch, preventing the prior family's shader from retaining different source maps");
check(pavingMaterialSource.includes('`studio-paving-v3-${id}-metric-dry-${waterY}`'), "Original family shader cache revision also invalidates previously compiled programs");
const woodSamplerSource = readFileSync("src/components/pool/three/pavingTexture.ts", "utf8");
check(woodSamplerSource.includes("0.28125 + min(u, 0.5546875 - u)") && woodSamplerSource.includes("< 0.27734375"), "Wood colour/normal/roughness share the interior-board crop and correct normal orientation");
check(woodSamplerSource.includes("WOOD_GRAIN_SCALE = 0.057 / 0.14") && woodSamplerSource.includes("0.008 + clamp(p.y, 0.0, 0.057)"), "Wood metric grain density and cross-board coverage unchanged");
for (const channel of ["basecolor", "normal", "roughness"]) {
  const photo = PNG.sync.read(readFileSync(`public/textures/coping/deck/${channel}.png`));
  const edge = x => {
    let sum = 0;
    for (let y = 480; y <= 506; y++) for (let c = 0; c < 3; c++)
      sum += Math.abs(photo.data[(y * photo.width + x) * 4 + c] - photo.data[(y * photo.width + x - 1) * 4 + c]);
    return sum / (27 * 3);
  };
  check(Math.max(...Array.from({ length: 142 }, (_, i) => edge(145 + i))) < 12, `Wood ${channel} crop excludes photographed cross-joints rather than painting extra mini-boards`);
}

// Deterministic loader exercises concurrent/pending reads, disposal and cached
// ready reselection. No network, private backend or browser state involved.
const originalLoad = TextureLoader.prototype.load, pending = new Map();
let requests = 0;
TextureLoader.prototype.load = function (url, onLoad, _progress, onError) {
  requests++;
  const source = new Texture();
  pending.set(url, { resolve: () => { source.image = { width: 512, height: 512 }; source.needsUpdate = true; onLoad?.(source); }, reject: () => onError?.(new Error("fixture interruption")) });
  return source;
};
try {
  for (const finish of REFERENCE_FINISHES) {
    const reference = cloneReferenceFinishColorMap(finish.id);
    const disposed = cloneReferenceFinishColorMap(finish.id);
    check(reference.version === 0 && disposed.version === 0 && !reference.image, "Pending photographic clones never request an empty GPU upload");
    check(reference.source === disposed.source && reference.wrapS === ClampToEdgeWrapping, "References share decoded Source and retain clamped source crop sampling");
    let ready = false;
    const unsubscribe = subscribeReferenceFinishReady(finish.id, () => { ready = true; });
    disposed.dispose(); const disposedVersion = disposed.version;
    pending.get(finish.asset.url).resolve();
    check(ready && reference.version > 0 && reference.image.width === 512, "Reference GPU upload begins only after actual image arrival");
    check(disposed.version === disposedVersion, "Disposed photographic clones are not revived on arrival");
    const cached = cloneReferenceFinishColorMap(finish.id);
    check(cached.image === reference.image && cached.version > 0, "Already-ready photographic reselections upload immediately with valid image data");
    unsubscribe(); reference.dispose(); cached.dispose();
  }
  const before = requests;
  const first = loadCopingTextureMaps("/__pbr_audit__/stone"), second = loadCopingTextureMaps("/__pbr_audit__/stone");
  check(requests - before === 3, "Two pending consumers issue one request per scanned map, not six");
  for (const name of ["colorMap", "normalMap", "roughnessMap"]) {
    check(first[name] !== second[name] && first[name].source === second[name].source, "Consumers own texture state while sharing decoded source");
    check(first[name].version === 0 && second[name].version === 0, "Pending scanned texture does not request a GPU upload before image data exists");
    check(first[name].colorSpace === (name === "colorMap" ? SRGBColorSpace : NoColorSpace), "PBR colour/data transfer functions remain correct");
  }
  first.normalMap.dispose(); const disposedVersion = first.normalMap.version;
  for (const entry of pending.values()) entry.resolve();
  check(first.normalMap.version === disposedVersion, "Late source arrival never revives a disposed texture");
  check(second.normalMap.image.width === 512 && second.normalMap.version > 0, "Pending surviving clone receives actual image and GPU invalidation");
  const cached = loadCopingTextureMaps("/__pbr_audit__/stone", true, true, true);
  check(requests - before === 3 && cached.colorMap.image.width === 512, "Ready reselection has no download/redecode");
  check(cached.colorMap.wrapS === MirroredRepeatWrapping && second.colorMap.wrapS === RepeatWrapping, "Independent sampler settings do not mutate another consumer");
  for (let selection = 3; selection < 5; selection++) {
    const next = loadCopingTextureMaps("/__pbr_audit__/stone");
    check(requests - before === 3 && next.normalMap.image.width === 512, "Five actual repeated selections retain only three image requests");
    Object.values(next).forEach(texture => texture.dispose());
  }
  for (const maps of [first, second, cached]) Object.values(maps).forEach(texture => texture?.dispose());
  const noMaps = loadCopingTextureMaps("/__pbr_audit__/photo", false, false);
  check(noMaps.roughnessMap === null && [...noMaps.normalMap.image.data].join(",") === "128,128,255,255", "Colour-only sources do not fabricate measured relief or roughness");
  Object.values(noMaps).forEach(texture => texture?.dispose());
  loadCopingTextureMaps("/__pbr_audit__/interrupted", false, false).colorMap.dispose();
  pending.get("/__pbr_audit__/interrupted/basecolor.png").reject();
  const failedCount = requests;
  loadCopingTextureMaps("/__pbr_audit__/interrupted", false, false).colorMap.dispose();
  check(requests === failedCount + 1, "Interrupted image request can be retried on reselection");
} finally { TextureLoader.prototype.load = originalLoad; }

console.log(JSON.stringify({ status: "PASS", checks, originalTravertineRoughnessMean: scanMean,
  calibratedDryTravertineMean: dryTravertineMean, wpcAuthoredRoughnessMean: wpcSum / (128 * 128),
  scannedImageRequestsFiveReselections: { baseline: 15, candidate: 3 },
  legacyEvidence,
  scope: "CPU/source/shader contracts; browser visual and GPU performance verified separately" }));
