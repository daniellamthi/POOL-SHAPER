/** Focused runtime evidence: actual selected Infinity camera, no cloud writes. */
import { chromium } from "playwright";
import { build } from "rolldown";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const stage = process.argv[2];
assert(["before", "after"].includes(stage));
const out = resolve("docs/fullscreen-qa-evidence/infinity-low-camera");
const cache = resolve("node_modules/.cache/infinity-low-camera");
await mkdir(out, { recursive: true });
await build({ input: ["src/lib/pool/store.tsx", "src/lib/pool/project.ts"], output: { dir: cache, format: "esm" }, platform: "node", resolve: { alias: { "@": resolve("src") } }, plugins: [{ name: "no-rpc", resolveId(id) { if (id.endsWith("/projectDelivery.server")) return "\0no-rpc"; }, load(id) { if (id === "\0no-rpc") return "export const loadSharedProjectFn=()=>{throw Error('No cloud in camera QA')};"; } }], external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"] });
const { configuratorTesting: testing } = await import(pathToFileURL(`${cache}/store.js`));
const { toProjectConfiguration } = await import(pathToFileURL(`${cache}/project.js`));
const report = { stage, samples: [], errors: [], blockedWrites: [], mobile: "390/430 viewport emulation, not physical devices" };
const browser = await chromium.launch({ channel: "chrome", headless: false });
const watchdog = setTimeout(() => void browser.close(), 180000);
try {
  for (const width of stage === "before" ? [1440] : [1440, 390, 430]) {
    const actions = [{ type: "setProjectType", value: "new" }, { type: "setPoolType", value: "in-ground" }, { type: "setPoolStructure", value: "reinforced-concrete" }, { type: "setShape", value: "rectangle" }, { type: "setDimension", key: "length", value: 8 }, { type: "setDimension", key: "width", value: 4 }, { type: "setDimension", key: "depth", value: 1.5 }, { type: "setPoolAccess", value: "internalSteps" }, { type: "setSystem", value: "infinity" }, { type: "setInfinitySide", value: 2 }];
    const s = actions.reduce(testing.reducer, testing.createInitialState());
    const project = toProjectConfiguration("00000000-0000-4000-8000-000000000303", s.config, s.renovation);
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : width === 430 ? 932 : 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    await context.addInitScript(project => { performance.setResourceTimingBufferSize(3000); try { localStorage.setItem("pool-shaper:project-draft:v1", JSON.stringify(project)); localStorage.setItem("pool-shaper.locale", "it"); } catch { /* about:blank */ } }, project);
    await context.route("**/*", route => { if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) { report.blockedWrites.push(route.request().method()); return route.abort(); } return route.continue(); });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto("http://127.0.0.1:3003/", { waitUntil: "domcontentloaded" });
    await page.locator("canvas").waitFor({ state: "visible" });
    await page.getByText("Abbiamo ripristinato il tuo progetto.", { exact: true }).waitFor({ state: "hidden" });
    for (const side of stage === "before" ? [3] : [3, 2]) {
      await page.locator(".pool-phase-nav").getByRole("button", { name: /Sistema acqua/ }).click();
      await page.getByRole("tab", { name: "Lato Infinity", exact: true }).click();
      await page.getByRole("button", { name: `Lato ${side}`, exact: true }).click();
      await page.waitForTimeout(1100);
      assert.equal(await page.locator("canvas").getAttribute("data-camera-focus"), "infinity");
      // Preserve the approved dry/wet progression: the system step is dry.
      // Presentation uses the same Infinity pose and exposes the real water.
      await page.locator(".pool-phase-nav").getByRole("button", { name: /Presentazione/ }).click();
      await page.waitForFunction(async () => {
        const resource = performance.getEntriesByType("resource").find(e => e.name.includes("/@react-three_fiber.js"));
        if (!resource) return false;
        const fiber = await import(resource.name);
        return Boolean(fiber._roots.get(document.querySelector("canvas"))?.store.getState().scene.getObjectByName("infinity-crest-water"));
      }, null, { timeout: 20000 });
      await page.waitForTimeout(1500);
      const detail = await page.evaluate(async () => {
        const r = performance.getEntriesByType("resource").find(e => e.name.includes("/@react-three_fiber.js"));
        const f = await import(r.name), state = f._roots.get(document.querySelector("canvas")).store.getState();
        const gl = state.gl.getContext(), ext = gl.getExtension("WEBGL_debug_renderer_info");
        const position = state.camera.position.toArray(), target = state.controls.target.toArray();
        return { position, target, fov: state.camera.fov, pitchDegrees: Math.atan2(position[1] - target[1], Math.hypot(position[0] - target[0], position[2] - target[2])) * 180 / Math.PI, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unavailable", focus: document.querySelector("canvas").dataset.cameraFocus, config: JSON.parse(localStorage.getItem("pool-shaper:project-draft:v1")).config, contextLost: gl.isContextLost(), hasCrest: Boolean(state.scene.getObjectByName("infinity-crest-water")) };
      });
      assert.equal(detail.config.infinityEdge.side, side - 1);
      assert.equal(detail.focus, "infinity"); assert(detail.hasCrest && !detail.contextLost);
      assert(!/swiftshader|software|unavailable/i.test(detail.renderer));
      const screenshot = `${out}/${stage}-${width}-side${side}.png`;
      await page.screenshot({ path: screenshot }); report.samples.push({ width, side, ...detail, screenshot });
      await page.getByRole("button", { name: "Vedi la piscina", exact: true }).click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${out}/${stage}-${width}-side${side}-expanded-view.png` });
      await page.getByRole("button", { name: "Scegli le opzioni", exact: true }).click();
      await writeFile(`${out}/${stage}.json`, JSON.stringify(report, null, 2));
    }
    await context.close();
  }
  assert.equal(report.errors.length, 0); assert.equal(report.blockedWrites.length, 0);
} catch (error) { report.failure = String(error); process.exitCode = 1; }
finally { clearTimeout(watchdog); await browser.close(); await writeFile(`${out}/${stage}.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ stage, captures: report.samples.length, failure: report.failure, errors: report.errors }));
