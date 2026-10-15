/** Controlled desktop comparison. Do not run with --go until root gives GO. */
import { chromium } from "playwright";
import { build } from "rolldown";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

if (!process.argv.includes("--go")) {
  console.log("Prepared only. Explicit GO and --go are required before opening Chrome.");
  process.exit(0);
}

const baselinePort = 3012, candidatePort = 3003;
const viewport = { width: 1440, height: 900 };
const camera = [11, 7, 10], target = [0, -0.5, 0], fov = 34;
const outputPath = resolve("docs/fullscreen-qa-evidence/customer-additions-performance.json");
const cache = resolve("node_modules/.cache/customer-additions-performance");
let supersededRun = null;
if (process.argv.includes("--discard-prior")) {
  supersededRun = {
    accepted: false,
    reason: "Root reported TypeScript/HMR activity potentially overlapping this first diagnostic run; exact overlap was not recorded. None of these measurements count toward the accepted three pairs.",
    report: JSON.parse(await readFile(outputPath, "utf8")),
  };
}
const fingerprintPaths = [
  "src/components/pool/PoolConfigurator.tsx", "src/components/pool/PoolViewport.tsx",
  "src/components/pool/three/PoolScene.tsx", "src/components/pool/three/SunShelfLoungers.tsx",
  "src/components/pool/wizard/StepTrays.tsx", "src/components/pool/wizard/product-media.tsx",
  "src/lib/pool/store.tsx", "src/lib/pool/types.ts", "src/lib/pool/config.ts",
  "src/lib/pool/sun-shelf-loungers.ts", "src/lib/i18n/index.tsx", "src/lib/i18n/messages.ts",
];
async function fingerprint() {
  const entries = await Promise.all(fingerprintPaths.map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")]));
  return { files: Object.fromEntries(entries), sha256: createHash("sha256").update(JSON.stringify(entries)).digest("hex") };
}
const artifactBefore = await fingerprint();
await mkdir(resolve("docs/fullscreen-qa-evidence"), { recursive: true });
await build({
  input: ["src/lib/pool/store.tsx", "src/lib/pool/project.ts"],
  output: { dir: cache, format: "esm" }, platform: "node",
  resolve: { alias: { "@": resolve("src") } },
  plugins: [{ name: "performance-no-rpc", resolveId(id) { if (id.endsWith("/projectDelivery.server")) return "\0performance-rpc"; }, load(id) { if (id === "\0performance-rpc") return "export const loadSharedProjectFn=()=>{throw Error('Performance fixture RPC forbidden')};"; } }],
  external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
});
const { configuratorTesting: { reducer, createInitialState } } = await import(pathToFileURL(`${cache}/store.js`).href);
const { toProjectConfiguration } = await import(pathToFileURL(`${cache}/project.js`).href);
const baseActions = [
  { type: "setProjectType", value: "new" }, { type: "setPoolType", value: "in-ground" },
  { type: "setPoolStructure", value: "reinforced-concrete" }, { type: "setShape", value: "rectangle" },
  { type: "setDimension", key: "length", value: 12 }, { type: "setDimension", key: "width", value: 5 },
  { type: "setDimension", key: "depth", value: 1.5 }, { type: "setSystem", value: "skimmer" },
  { type: "setSkimmerType", value: "slim" }, { type: "setPoolAccess", value: "internalSteps" },
  { type: "togglePoolFeature", value: "sunShelf" },
];
function fixture(enabled) {
  const extra = enabled ? [
    { type: "togglePoolFeature", value: "sunShelfLoungers" },
    { type: "setSunShelfLoungerCount", value: 2 },
  ] : [];
  const state = [...baseActions, ...extra].reduce(reducer, createInitialState());
  assert.equal(state.config.features.includes("sunShelfLoungers"), enabled);
  if (enabled) assert.equal(state.config.sunShelfLoungerCount, 2);
  return toProjectConfiguration(enabled ? "00000000-0000-4000-8000-000000000102" : "00000000-0000-4000-8000-000000000101", state.config, state.renovation);
}
const fixtures = { off: fixture(false), on: fixture(true) };
const results = [], errors = [], blockedWrites = [], hmrEvents = [], loads = [];
const output = {
  schema: 1, accepted: false, createdAt: new Date().toISOString(),
  protocol: "Three alternating baseline/candidate OFF pairs, 120 RAF intervals each; then one candidate OFF/ON pair with two immersed loungers. One isolated Chrome context and one page; prior document is unloaded before the next scene.",
  baseline: { url: `http://127.0.0.1:${baselinePort}/`, revision: process.env.QA_BASELINE_REV ?? null, backupManifest: "SMl3YB; root verified 59 files against SHA256", description: "Isolated checkout from immediately before customer additions, prepared by root." },
  candidate: { url: `http://127.0.0.1:${candidatePort}/`, revision: process.env.QA_CANDIDATE_REV ?? null, description: "Current working tree with customer additions." },
  fixture: { dimensions: fixtures.off.config.dimensions, system: "skimmer", skimmerType: "slim", features: ["sunShelf"], immersedComparisonCount: 2 },
  configurationSHA256: createHash("sha256").update(JSON.stringify(fixtures.off.config)).digest("hex"),
  viewport, DPR: 1, drawingBuffer: viewport, camera, target, fov,
  normalization: "Transient runtime camera/FOV, DPR1 and 1440×900 framebuffer, presentation phase and dock collapsed. Same synthetic fixture, daylight and selected finishes. Application files are not changed.",
  warmup: "Both origins and their assets/shader programs are loaded before measured pairs; each load settles 6.5+3 seconds before timing. HTTP cache is not assumed because the write-blocking route guard may disable it.",
  limitations: "Desktop hardware RAF intervals, not real mobile measurements or GPU execution time. WebGL exposes resource counts, not reliable allocated VRAM bytes. Optional ON/OFF is one descriptive pair.",
  exclusiveRun: "Root confirmed other 3D scenes closed/about:blank and no concurrent CPU tests or application edits during the accepted run.",
  artifact: { before: artifactBefore, after: null, unchanged: null },
  results, errors, blockedWrites, hmrEvents, loads, supersededRun, lazyMedia: null, summary: null,
};
const persist = () => writeFile(outputPath, JSON.stringify(output, null, 2));
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"] });
let context, page, requestStage = "unloaded", previewRequests = [];
const watchdog = setTimeout(() => void browser.close(), 480000);

async function setDock(expanded) {
  const button = page.locator(".pool-dock-toggle");
  if (await button.count() && await button.getAttribute("aria-expanded") !== String(expanded)) await button.click();
}

async function phase(name) {
  await page.getByRole("navigation", { name: /Fasi della configurazione|Configuration phases/ }).getByRole("button", { name }).click();
}

async function open(port, condition = "off", presentation = true) {
  // One context/page; about:blank releases the previous scene before the next.
  requestStage = "unloaded";
  await page.goto("about:blank");
  await page.waitForTimeout(350);
  previewRequests = [];
  requestStage = "first-phase";
  const navigationStartedAt = Date.now();
  await page.goto(`http://127.0.0.1:${port}/?qa_loungers=${condition}`, { waitUntil: "domcontentloaded" });
  const domContentLoadedAt = Date.now();
  await page.locator("canvas").first().waitFor({ state: "visible" });
  const canvasVisibleAt = Date.now();
  await page.bringToFront();
  const load = { port, condition, presentation, navigationStartedAt: new Date(navigationStartedAt).toISOString(), domContentLoadedMs: domContentLoadedAt - navigationStartedAt, canvasVisibleMs: canvasVisibleAt - navigationStartedAt, presentationClickCompletedMs: null, timingMeaning: "Observed navigation-to-DOM, canvas visibility and successful presentation phase click. Not LCP, TTI or a claim of visual readiness." };
  loads.push(load);
  if (!presentation) { await page.waitForTimeout(3500); return; }
  requestStage = "presentation";
  await phase(/Presentazione|Presentation/);
  load.presentationClickCompletedMs = Date.now() - navigationStartedAt;
  await setDock(false);
  await page.waitForTimeout(6500);
  await page.evaluate(async ({ camera, target, fov, viewport }) => {
    const resource = performance.getEntriesByType("resource").find(entry => entry.name.includes("/@react-three_fiber.js"));
    if (!resource) throw Error("Fiber resource unavailable");
    const fiber = await import(resource.name), state = fiber._roots.get(document.querySelector("canvas"))?.store.getState();
    if (!state) throw Error("Pool scene unavailable");
    state.setDpr(1); state.gl.setPixelRatio(1); state.gl.setSize(viewport.width, viewport.height, false);
    state.camera.position.fromArray(camera); state.camera.up.set(0, 1, 0);
    state.camera.fov = fov; state.camera.aspect = viewport.width / viewport.height; state.camera.clearViewOffset?.();
    if (state.controls) { state.controls.target.fromArray(target); state.controls.enableDamping = false; state.controls.update(); }
    state.camera.lookAt(...target); state.camera.updateProjectionMatrix(); state.camera.updateMatrixWorld(true);
  }, { camera, target, fov, viewport });
  await page.waitForTimeout(3000);
}

async function sample(port, condition, group, pair) {
  const measurement = await page.evaluate(async () => {
    const resource = performance.getEntriesByType("resource").find(entry => entry.name.includes("/@react-three_fiber.js"));
    if (!resource) throw Error("Fiber resource unavailable");
    const fiber = await import(resource.name), state = fiber._roots.get(document.querySelector("canvas"))?.store.getState();
    if (!state?.scene.getObjectByName("pool-basin")) throw Error("Pool scene unavailable");
    const gl = state.gl.getContext(), extension = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : "unavailable";
    const cameraStart = state.camera.position.toArray(), intervals = [];
    const sampleStartedAt = Date.now();
    await new Promise(done => { let previous; const frame = time => { if (previous !== undefined) intervals.push(time - previous); previous = time; if (intervals.length === 120) done(); else requestAnimationFrame(frame); }; requestAnimationFrame(frame); });
    intervals.sort((a, b) => a - b);
    const draft = JSON.parse(localStorage.getItem("pool-shaper:project-draft:v1")).config;
    let immersedMeshes = 0;
    state.scene.traverse(object => { if (object.name.startsWith("sun-shelf-immersed-chaise-")) immersedMeshes++; });
    return {
      sampleStartedAt: new Date(sampleStartedAt).toISOString(), sampleEndedAt: new Date().toISOString(),
      renderer, intervalCount: intervals.length, medianMs: intervals[60], p95Ms: intervals[114],
      calls: state.gl.info.render.calls, triangles: state.gl.info.render.triangles,
      textures: state.gl.info.memory.textures, geometries: state.gl.info.memory.geometries,
      buffer: { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight }, dpr: state.gl.getPixelRatio(),
      camera: cameraStart, cameraEnd: state.camera.position.toArray(), target: state.controls?.target.toArray() ?? null,
      fov: state.camera.fov, aspect: state.camera.aspect, visibility: document.visibilityState,
      contextLost: gl.isContextLost(), immersedMeshes,
      draft: { dimensions: draft.dimensions, system: draft.system, skimmerType: draft.skimmerType, features: draft.features, equipment: draft.equipment, poolAccess: draft.poolAccess, sunShelfLoungerCount: draft.sunShelfLoungerCount ?? null, sceneTime: draft.sceneTime ?? "day" },
      GPUmemoryBytes: null, GPUmemoryReason: "WebGL exposes resource counts, not reliable allocated VRAM bytes",
    };
  });
  const overlappingHmr = hmrEvents.filter(event => event.timestamp >= Date.parse(measurement.sampleStartedAt) && event.timestamp <= Date.parse(measurement.sampleEndedAt));
  assert.equal(overlappingHmr.length, 0, "No HMR during the measured interval");
  assert(!/software|swiftshader|llvmpipe|unavailable/i.test(measurement.renderer), "Actual GPU required");
  assert.equal(measurement.intervalCount, 120); assert.equal(measurement.dpr, 1);
  assert.deepEqual(measurement.buffer, viewport); assert.equal(measurement.contextLost, false);
  assert.equal(measurement.fov, fov); assert.equal(measurement.aspect, 1.6); assert.equal(measurement.visibility, "visible");
  for (let i = 0; i < 3; i++) {
    assert(Math.abs(measurement.camera[i] - camera[i]) < 1e-9, "Fixed camera");
    assert(Math.abs(measurement.cameraEnd[i] - camera[i]) < 1e-9, "Stable camera");
    assert(measurement.target && Math.abs(measurement.target[i] - target[i]) < 1e-9, "Same camera target");
  }
  assert.equal(measurement.draft.dimensions.length, 12); assert.equal(measurement.draft.dimensions.width, 5);
  assert.equal(measurement.draft.system, "skimmer"); assert.equal(measurement.draft.skimmerType, "slim");
  assert(measurement.draft.features.includes("sunShelf"), "Same Sun Shelf fixture");
  assert.equal(measurement.draft.features.includes("sunShelfLoungers"), condition === "on");
  assert.equal(measurement.immersedMeshes, condition === "on" ? 2 : 0);
  if (condition === "on") assert.equal(measurement.draft.sunShelfLoungerCount, 2);
  const result = { group, pair, checkout: port === baselinePort ? "baseline" : "candidate", condition, ...measurement };
  results.push(result); await persist();
  console.log(JSON.stringify({ group, pair, checkout: result.checkout, condition, medianMs: result.medianMs, p95Ms: result.p95Ms, calls: result.calls, triangles: result.triangles, textures: result.textures, geometries: result.geometries }));
  return result;
}

function summarize() {
  const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };
  const aggregate = checkout => {
    const samples = results.filter(result => result.group === "paired-off" && result.checkout === checkout);
    return { samples: samples.length, medianMs: median(samples.map(sample => sample.medianMs)), p95Ms: median(samples.map(sample => sample.p95Ms)), calls: median(samples.map(sample => sample.calls)), triangles: median(samples.map(sample => sample.triangles)), textures: median(samples.map(sample => sample.textures)), geometries: median(samples.map(sample => sample.geometries)) };
  };
  const baseline = aggregate("baseline"), candidate = aggregate("candidate");
  const optionalOff = results.find(result => result.group === "optional" && result.condition === "off");
  const optionalOn = results.find(result => result.group === "optional" && result.condition === "on");
  const change = (a, b) => ({ medianMsPercent: (b.medianMs / a.medianMs - 1) * 100, p95MsPercent: (b.p95Ms / a.p95Ms - 1) * 100, calls: b.calls - a.calls, triangles: b.triangles - a.triangles, textures: b.textures - a.textures, geometries: b.geometries - a.geometries });
  output.summary = { baseline, candidate, candidateVsBaseline: change(baseline, candidate), optionalTwoLoungersVsOff: optionalOff && optionalOn ? change(optionalOff, optionalOn) : null, optionalPairIsDescriptiveOnly: true };
}

try {
  context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
  page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on("pageerror", error => errors.push({ url: page.url(), error: error.message }));
  page.on("request", request => { if (/\/product-previews\/[^?]+\.jpg(?:\?|$)/.test(request.url())) previewRequests.push({ stage: requestStage, path: new URL(request.url()).pathname, method: request.method() }); });
  page.on("websocket", socket => socket.on("framereceived", ({ payload }) => {
    try {
      const message = JSON.parse(typeof payload === "string" ? payload : payload.toString());
      if (["update", "full-reload", "prune", "error"].includes(message.type)) hmrEvents.push({ timestamp: Date.now(), at: new Date().toISOString(), type: message.type, url: socket.url() });
    } catch { /* Non-JSON application sockets are not Vite HMR. */ }
  }));
  await page.route("**/*", route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) { blockedWrites.push({ method: route.request().method(), url: route.request().url() }); return route.abort(); }
    return route.continue();
  });
  await context.addInitScript(fixtures => {
    const condition = new URLSearchParams(location.search).get("qa_loungers") === "on" ? "on" : "off";
    try { localStorage.setItem("pool-shaper:project-draft:v1", JSON.stringify(fixtures[condition])); localStorage.setItem("pool-shaper.locale", "it"); } catch { /* about:blank has no storage origin. */ }
  }, fixtures);
  // Warm both origins, assets and shader programs before measured pairs.
  for (const port of [baselinePort, candidatePort]) await open(port);
  for (let pair = 1; pair <= 3; pair++) {
    for (const port of pair === 2 ? [candidatePort, baselinePort] : [baselinePort, candidatePort]) {
      await open(port); await sample(port, "off", "paired-off", pair);
    }
    const samples = results.filter(result => result.group === "paired-off" && result.pair === pair);
    assert.deepEqual(samples[0].draft, samples[1].draft, "Identical baseline/candidate OFF configuration");
    assert.equal(samples[0].renderer, samples[1].renderer, "Same actual GPU");
  }
  for (const condition of ["off", "on"]) { await open(candidatePort, condition); await sample(candidatePort, condition, "optional", 1); }
  // After timing, verify first-phase requests vs the visible access/comfort tray.
  await open(candidatePort, "off", false);
  const firstPhase = [...previewRequests];
  requestStage = "access-comfort";
  await phase(/Accesso|Access/); await setDock(true);
  await page.getByRole("tab", { name: /Comfort in acqua|In.water comfort/ }).click();
  const preview = page.locator('[data-product-media="equipment-sunShelfLoungers"] img');
  await preview.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => { const image = document.querySelector('[data-product-media="equipment-sunShelfLoungers"] img'); return image?.complete && image.naturalWidth > 0; });
  const visibleMedia = await page.locator('[data-product-media] img').evaluateAll(images => images.map(image => ({ src: new URL(image.src).pathname, loading: image.loading, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight })));
  output.lazyMedia = { firstPhase, accessComfort: previewRequests.filter(request => request.stage === "access-comfort"), visibleMedia };
  await persist();
  assert.equal(firstPhase.length, 0, "No product preview image requests in the first phase");
  assert(output.lazyMedia.accessComfort.length > 0, "Product previews requested when access/comfort is opened");
  assert(visibleMedia.length > 0 && visibleMedia.every(image => image.loading === "lazy"), "Product preview images remain lazy");
  assert.equal(errors.length, 0, "No browser page errors");
  output.artifact.after = await fingerprint();
  output.artifact.unchanged = output.artifact.before.sha256 === output.artifact.after.sha256;
  assert.equal(output.artifact.unchanged, true, "Relevant application sources unchanged during accepted run");
  summarize(); output.accepted = true;
  console.log(JSON.stringify({ accepted: output.accepted, summary: output.summary, lazyMedia: { firstPhaseRequests: firstPhase.length, accessComfortRequests: output.lazyMedia.accessComfort.length } }));
} catch (error) {
  errors.push({ error: String(error) }); process.exitCode = 1;
} finally {
  if (context) await context.close();
  clearTimeout(watchdog); await browser.close(); await persist();
  console.log(`Evidence: ${outputPath}`);
}
