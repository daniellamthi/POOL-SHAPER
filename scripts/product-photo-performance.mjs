/** Bounded before/after check of card photography, not a new renderer audit. */
import { chromium } from "playwright";
import { build } from "rolldown";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const stage = process.argv[2];
assert(["before", "after"].includes(stage));
const out = resolve("docs/fullscreen-qa-evidence/product-photos");
const cache = resolve("node_modules/.cache/product-photo-performance");
await mkdir(out, { recursive: true });
await build({ input: ["src/lib/pool/store.tsx", "src/lib/pool/project.ts"], output: { dir: cache, format: "esm" }, platform: "node", resolve: { alias: { "@": resolve("src") } }, plugins: [{ name: "no-cloud", resolveId(id) { if (id.endsWith("/projectDelivery.server")) return "\0no-cloud"; }, load(id) { if (id === "\0no-cloud") return "export const loadSharedProjectFn=()=>{throw Error('Cloud forbidden')};"; } }], external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"] });
const { configuratorTesting: { reducer, createInitialState } } = await import(pathToFileURL(`${cache}/store.js`).href);
const { toProjectConfiguration } = await import(pathToFileURL(`${cache}/project.js`).href);
const actions = [{ type: "setProjectType", value: "new" }, { type: "setPoolType", value: "in-ground" }, { type: "setPoolStructure", value: "reinforced-concrete" }, { type: "setShape", value: "rectangle" }, { type: "setDimension", key: "length", value: 8 }, { type: "setDimension", key: "width", value: 4 }, { type: "setSystem", value: "skimmer" }, { type: "setSkimmerType", value: "slim" }, { type: "setPoolAccess", value: "internalSteps" }];
const state = actions.reduce(reducer, createInitialState());
const fixture = toProjectConfiguration("00000000-0000-4000-8000-000000000202", state.config, state.renovation);
const report = { stage, createdAt: new Date().toISOString(), viewport: { width: 1440, height: 900 }, DPR: 1, protocol: "Same local synthetic 8x4 Skimmer; one headed Chrome scene, warmed assets, three loads and 120 RAF intervals per load. No profiler. Desktop hardware only, not mobile hardware or GPU execution time.", resourceTimingLimitation: "Development modules can fill the browser ResourceTiming buffer before optional images load. An empty resources array is NOT evidence of zero requests. Actual decoded currentSrc and on-disk file sizes provide the image identity/payload evidence instead.", samples: [], errors: [], writes: [] };
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"] });
const watchdog = setTimeout(() => { report.errors.push("Bounded measurement timeout"); void browser.close(); }, 120000);
const context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(45000);
page.on("pageerror", e => report.errors.push(e.message));
await context.addInitScript(fixture => {
  try { localStorage.setItem("pool-shaper:project-draft:v1", JSON.stringify(fixture)); localStorage.setItem("pool-shaper.locale", "it"); } catch { /* about:blank */ }
  window.photoShifts = [];
  new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.photoShifts.push(entry.value); }).observe({ type: "layout-shift", buffered: true });
}, fixture);
await page.route("**/*", route => {
  if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) { report.writes.push(route.request().method()); return route.abort(); }
  return route.continue();
});
async function phase(name) { await page.locator(".pool-phase-nav").getByRole("button", { name }).click(); }
async function load(measured, index) {
  await page.goto("about:blank");
  const started = Date.now();
  await page.goto("http://127.0.0.1:3003/?qa=product-photos", { waitUntil: "domcontentloaded" });
  await page.locator("canvas").first().waitFor({ state: "visible" });
  const canvasMs = Date.now() - started;
  await phase(/Presentazione/);
  const dock = page.locator(".pool-dock-toggle");
  if (await dock.getAttribute("aria-expanded") === "true") await dock.click();
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    const url = performance.getEntriesByType("resource").find(e => e.name.includes("/@react-three_fiber.js"))?.name;
    const fiber = await import(url), s = fiber._roots.get(document.querySelector("canvas")).store.getState();
    s.setDpr(1); s.gl.setPixelRatio(1); s.gl.setSize(1440, 900, false);
    s.camera.position.set(9, 6, 9); s.camera.up.set(0, 1, 0); s.camera.fov = 34; s.camera.aspect = 1440 / 900; s.camera.clearViewOffset?.();
    s.controls.target.set(0, -.5, 0); s.controls.enableDamping = false; s.controls.update(); s.camera.lookAt(0, -.5, 0); s.camera.updateProjectionMatrix(); s.camera.updateMatrixWorld(true);
  });
  await page.waitForTimeout(1500);
  const sample = await page.evaluate(async () => {
    const fiber = await import(performance.getEntriesByType("resource").find(e => e.name.includes("/@react-three_fiber.js")).name), s = fiber._roots.get(document.querySelector("canvas")).store.getState();
    const gl = s.gl.getContext(), ext = gl.getExtension("WEBGL_debug_renderer_info"), intervals = [];
    await new Promise(done => { let last; const frame = t => { if (last !== undefined) intervals.push(t - last); last = t; if (intervals.length === 120) done(); else requestAnimationFrame(frame); }; requestAnimationFrame(frame); });
    intervals.sort((a, b) => a - b);
    return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unavailable", medianMs: intervals[60], p95Ms: intervals[114], calls: s.gl.info.render.calls, triangles: s.gl.info.render.triangles, textures: s.gl.info.memory.textures, geometries: s.gl.info.memory.geometries, camera: s.camera.position.toArray(), target: s.controls.target.toArray(), GPUmemoryBytes: null, GPUmemoryReason: "Not exposed reliably by WebGL", draft: JSON.parse(localStorage.getItem("pool-shaper:project-draft:v1")).config };
  });
  assert(!/SwiftShader|llvmpipe|software|unavailable/i.test(sample.renderer));
  const cardStarted = Date.now(); await phase(/^Optional/);
  if (await dock.getAttribute("aria-expanded") !== "true") await dock.click();
  const media = page.locator('[data-product-media="equipment-loungers"]');
  await media.scrollIntoViewIfNeeded();
  await media.locator("img").evaluate(img => img.decode());
  const photoReadyMs = Date.now() - cardStarted;
  await page.waitForTimeout(500);
  const cards = await page.evaluate(() => ({ shifts: window.photoShifts, images: [...document.querySelectorAll('[data-product-media] img')].map(i => ({ src: new URL(i.currentSrc).pathname, width: i.naturalWidth, loading: i.loading })), resources: performance.getEntriesByType("resource").filter(r => /\/product-(photos|previews)\//.test(r.name)).map(r => ({ path: new URL(r.name).pathname, encodedBodySize: r.encodedBodySize, transferSize: r.transferSize })) }));
  if (measured) { report.samples.push({ index, canvasMs, photoReadyMs, ...sample, ...cards }); await writeFile(`${out}/performance-${stage}.json`, JSON.stringify(report, null, 2)); await page.screenshot({ path: `${out}/${stage}-optional-${index}.png` }); }
}
try { await load(false, 0); for (let index = 1; index <= 3; index++) await load(true, index); assert.equal(report.errors.length, 0); assert.equal(report.writes.length, 0); report.status = "PASS"; }
catch (e) { report.status = "FAIL"; report.errors.push(String(e)); process.exitCode = 1; }
finally { clearTimeout(watchdog); await browser.close(); await writeFile(`${out}/performance-${stage}.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ stage, status: report.status, samples: report.samples.map(({ medianMs, p95Ms, calls, canvasMs, photoReadyMs, shifts }) => ({ medianMs, p95Ms, calls, canvasMs, photoReadyMs, shifts })), errors: report.errors }));
