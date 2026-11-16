// Read-only evaluator for real CUA browser console samples. This does not launch
// a browser, alter application state, or substitute a CPU benchmark for FPS.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const input = process.argv[2];
assert(input, "Usage: node scripts/materials-upgrade-performance-qa.mjs evidence.json");
const report = JSON.parse(await readFile(input, "utf8"));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const groups = { baseline: [], candidate: [] };
const mainSamples = report.samples.filter(record => record.group === "main");
const supplemental = [];
const hash = text => createHash("sha256").update(text).digest("hex");
const recordedDOM = new Map([report.configurationDOM, ...Object.values(report.configurationDOMVariants ?? {})].map(dom => [hash(dom), dom]));
const semanticConfigurationHash = sample => {
  const dom = sample.configurationDOM ?? recordedDOM.get(sample.configurationEvidenceSHA256);
  assert(dom && hash(dom) === sample.configurationEvidenceSHA256, "Exact recorded DOM preimage, not an inferred configuration");
  return hash(dom.replaceAll(" [active]", ""));
};
for (const record of report.samples) {
  assert(groups[record.checkout], "Known checkout");
  assert(record.metrics.length >= 3, "At least three settled 2-second windows per bounded run");
  for (const metric of record.metrics) {
    assert(!/software|swiftshader|llvmpipe|unavailable/i.test(metric.renderer), "Actual hardware renderer");
    assert.equal(metric.visibility, "visible", "Foreground measurement");
    assert.deepEqual(metric.viewport, report.viewport, "Matched viewport");
    assert.equal(metric.dpr, report.dpr, "Matched actual renderer DPR");
    assert(metric.frameCount >= 15, "Sufficient real R3F frame samples in each window");
    assert(metric.medianFrameTimeMs > 0 && metric.p95FrameTimeMs >= metric.medianFrameTimeMs);
    assert(metric.peakProgramSamplers <= metric.maxTextureUnits, "GPU sampler budget");
  }
  const run = {
    pair: record.pair,
    medianFrameTimeMs: median(record.metrics.map(m => m.medianFrameTimeMs)),
    p95FrameTimeMs: median(record.metrics.map(m => m.p95FrameTimeMs)),
    fps: median(record.metrics.map(m => m.fps)),
    calls: Math.max(...record.metrics.map(m => m.calls)),
    triangles: Math.max(...record.metrics.map(m => m.triangles)),
    observedPassCalls: [Math.min(...record.metrics.map(m => m.calls)), Math.max(...record.metrics.map(m => m.calls))],
    textures: median(record.metrics.map(m => m.textures)),
    geometries: median(record.metrics.map(m => m.geometries)),
    renderer: record.metrics[0].renderer,
  };
  if (record.group === "main") groups[record.checkout].push(run);
  else supplemental.push({ checkout: record.checkout, group: record.group, ...run });
}
for (const checkout of Object.keys(groups)) {
  assert.equal(groups[checkout].length, 3, "Exactly three bounded matched runs");
  assert.deepEqual(groups[checkout].map(r => r.pair).sort(), [1, 2, 3]);
}
assert.equal(new Set(report.samples.flatMap(s => s.metrics.map(m => m.renderer))).size, 1, "Same hardware renderer");
assert.equal(new Set(mainSamples.map(s => s.configurationEvidenceSHA256)).size, 1, "Same visible UI configuration evidence");
assert.equal(new Set(mainSamples.map(s => s.cameraEvidenceSHA256)).size, 1, "Same DOM camera/frame evidence");
for (const group of new Set(supplemental.map(record => record.group))) {
  const samples = report.samples.filter(record => record.group === group);
  const replicated = group.startsWith("ardesia");
  assert.equal(samples.length, replicated ? 6 : 2, "Bounded supplemental matched samples");
  if (replicated) for (const checkout of ["baseline", "candidate"]) {
    assert.deepEqual(samples.filter(s => s.checkout === checkout).map(s => s.pair).sort(), [1, 2, 3], "Three replicated Ardesia pairs");
  }
  assert.equal(new Set(samples.map(semanticConfigurationHash)).size, 1, "Matched supplemental technical configuration; only literal focused-control marker is ignored");
  assert.equal(new Set(samples.map(s => s.cameraEvidenceSHA256)).size, 1, "Matched supplemental camera");
}
report.summary = {
  measurementValidity: "PASS",
  aggregation: "Median of the three run medians; each run is the median of three settled R3F console windows. The p95 value is a median of window p95s, not a pooled p95.",
  runs: groups,
  supplemental,
  renderPassCounterLimitation: "Existing gl.info console counters can report an internal render pass (4 calls/4424 triangles, or 1 call/2 triangles) instead of the dominant full-scene pass. Run calls/triangles below use the observed maximum, not a claimed frame-total or a false draw-call improvement. Raw samples and ranges are retained.",
  supplementalAggregation: Object.fromEntries([...new Set(supplemental.map(s => s.group))].map(group => [group, Object.fromEntries(["baseline", "candidate"].map(checkout => {
    const runs = supplemental.filter(s => s.group === group && s.checkout === checkout);
    return [checkout, Object.fromEntries(["medianFrameTimeMs", "p95FrameTimeMs", "fps", "calls", "triangles", "textures", "geometries"].map(key => [key, median(runs.map(r => r[key]))]))];
  }))])),
  aggregate: Object.fromEntries(Object.entries(groups).map(([name, runs]) => [name, Object.fromEntries(["medianFrameTimeMs", "p95FrameTimeMs", "fps", "calls", "triangles", "textures", "geometries"].map(key => [key, median(runs.map(r => r[key]))]))])),
  limitations: "Desktop hardware only. 390/430 viewport QA is emulation, not real mobile performance. R3F delta includes browser scheduling; no GPU execution timer or reliable VRAM allocation API. This evaluator validates evidence, not a broad photorealism acceptance gate.",
};
const baseline = report.summary.aggregate.baseline, candidate = report.summary.aggregate.candidate;
report.summary.change = {
  medianFrameTimePercent: 100 * (candidate.medianFrameTimeMs / baseline.medianFrameTimeMs - 1),
  p95FrameTimePercent: 100 * (candidate.p95FrameTimeMs / baseline.p95FrameTimeMs - 1),
  drawCalls: candidate.calls - baseline.calls,
  triangles: candidate.triangles - baseline.triangles,
  textures: candidate.textures - baseline.textures,
  geometries: candidate.geometries - baseline.geometries,
};
report.summary.reselection = report.switches.filter(run => run.acceptedForFPS).map(run => {
  assert.equal(run.events.length, 10, "Ten actual material selections per checkout");
  assert(run.events.every(event => event.pressed === "true" && event.metrics.length > 0), "Selection committed and a following real console window exists");
  const windows = run.events.flatMap(event => event.metrics);
  return {
    checkout: run.checkout,
    selections: run.events.length,
    medianWindowP95Ms: median(windows.map(m => m.p95FrameTimeMs)),
    maximumWindowP95Ms: Math.max(...windows.map(m => m.p95FrameTimeMs)),
    maximumWindowMeanMs: Math.max(...windows.map(m => m.frameTimeMs)),
    calls: [Math.min(...windows.map(m => m.calls)), Math.max(...windows.map(m => m.calls))],
    geometries: [Math.min(...windows.map(m => m.geometries)), Math.max(...windows.map(m => m.geometries))],
    textures: [Math.min(...windows.map(m => m.textures)), Math.max(...windows.map(m => m.textures))],
    limitation: "Transient camera/reselection windows, not steady FPS, individual-frame maxima or application latency. SourceUUID/loader identity remains separate unit evidence, not network traffic evidence.",
  };
});
report.derivedAssetPayload = await Promise.all(["ardesia-basecolor.png", "ardesia-normal.png", "prun-basecolor.png"].map(async name => {
  const path = `public/textures/coping/derived-mineral-v3/${name}`;
  const png = await readFile(path);
  assert.equal(png.subarray(1, 4).toString(), "PNG", "Actual PNG asset header");
  return { path, bytes: png.length, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}));
report.derivedAssetPayloadNote = "Actual encoded on-disk PNG bytes, not measured network transfer/loading latency or allocated GPU VRAM. Atlases are larger than the original photographs to bake variation at unchanged physical grain density; unchanged GPU resource count is not unchanged texture byte weight.";
await writeFile(input, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({
  status: report.status,
  measurementValidity: report.summary.measurementValidity,
  main: report.summary.aggregate,
  mainChange: report.summary.change,
  supplemental: report.summary.supplementalAggregation,
  reselection: report.summary.reselection,
}, null, 2));
