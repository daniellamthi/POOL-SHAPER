// Local fixtures and actual headed-Chrome captures; no backend requests.
import { chromium } from "playwright";
import { build } from "rolldown";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const stage = process.argv[2] ?? "after";
const out = resolve("docs/fullscreen-qa-evidence/brown-cover");
const cache = resolve("node_modules/.cache/brown-cover-qa");
await mkdir(out, { recursive: true });
await build({ input: ["src/lib/pool/store.tsx", "src/lib/pool/project.ts"], output: { dir: cache, format: "esm" }, platform: "node", resolve: { alias: { "@": resolve("src") } },
  plugins: [{ name: "local-only", resolveId(id) { if (id.endsWith("/projectDelivery.server")) return "\0no-rpc"; }, load(id) { if (id === "\0no-rpc") return "export const loadSharedProjectFn=()=>{throw Error('No QA RPC');};"; } }], external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"] });
const { configuratorTesting } = await import(pathToFileURL(`${cache}/store.js`));
const { toProjectConfiguration } = await import(pathToFileURL(`${cache}/project.js`));
const browser = await chromium.launch({ channel: "chrome", headless: false });
const results = [], errors = [];
const watchdog = setTimeout(() => void browser.close(), 180000);
try {
  for (const [length, width] of [[6, 3], [8, 4], [12, 5]]) for (const view of ["deck", "closed", "open"]) {
    const state = [{ type: "setProjectType", value: "new" }, { type: "setPoolType", value: "in-ground" }, { type: "setPoolStructure", value: "reinforced-concrete" }, { type: "setShape", value: "rectangle" }, { type: "setDimension", key: "length", value: length }, { type: "setDimension", key: "width", value: width }, { type: "setDimension", key: "depth", value: 1.5 }].reduce(configuratorTesting.reducer, configuratorTesting.createInitialState());
    const readyState = configuratorTesting.reducer(state, { type: "setPoolAccess", value: "internalSteps" });
    const project = toProjectConfiguration(randomUUID(), readyState.config, readyState.renovation);
    Object.assign(project.config, { copingMaterial: "deck-marrone", equipment: ["automaticCover"], coverPosition: view === "open" ? "open" : "closed", coverExtension: view === "open" ? 0 : 1, sceneTime: "day" });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await context.route("**/*", route => route.request().method() === "POST" ? route.abort() : route.continue());
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text().slice(0, 900)); });
    await page.addInitScript(project => localStorage.setItem("pool-shaper:project-draft:v1", JSON.stringify(project)), project);
    await page.goto("http://127.0.0.1:3003/", { waitUntil: "domcontentloaded" });
    await page.locator("canvas").waitFor(); await page.waitForTimeout(3500);
    const data = await page.evaluate(async ({ length, width, view }) => {
      const resource = performance.getEntriesByType("resource").find(e => e.name.includes("/@react-three_fiber.js"));
      const fiber = await import(resource.name), s = fiber._roots.get(document.querySelector("canvas")).store.getState();
      const ctx = s.gl.getContext(), extension = ctx.getExtension("WEBGL_debug_renderer_info");
      const renderer = extension ? ctx.getParameter(extension.UNMASKED_RENDERER_WEBGL) : "unknown";
      if (/swiftshader|software|llvmpipe/i.test(renderer)) throw Error("Software GPU");
      const coping = s.scene.getObjectByName("plan-coping"); coping.geometry.computeBoundingBox(); coping.updateWorldMatrix(true, false);
      const rimY = coping.geometry.boundingBox.max.y + coping.getWorldPosition(s.camera.position.clone()).y;
      const frames = coping.geometry.getAttribute("slabFrame"), frameKeys = new Set();
      for (let i = 0; i < frames.count; i++) frameKeys.add([frames.getX(i), frames.getY(i), frames.getZ(i), frames.getW(i)].join(","));
      const group = s.scene.getObjectByName("automatic-cover-closed-mat"), mat = group?.children.find(o => o.isInstancedMesh);
      let matY = null;
      if (mat?.count) { mat.updateWorldMatrix(true, false); const matrix = mat.matrixWorld.clone(); mat.getMatrixAt(0, matrix); matY = s.camera.position.clone().set(0, .009, 0).applyMatrix4(matrix).applyMatrix4(mat.matrixWorld).y; }
      if (!mat || (view !== "open" && mat.count === 0)) throw Error("Cover fixture not rendered");
      const bar = s.scene.getObjectByName("automatic-cover-leading-bar");
      const barY = bar?.visible ? bar.getWorldPosition(s.camera.position.clone()).y + .012 : null;
      // Inspection-only camera; configured product presets are never changed.
      const target = s.camera.position.clone().set(0, rimY, view === "deck" ? width / 2 + .15 : 0);
      s.camera.position.set(view === "deck" ? 0 : length * .35, view === "deck" ? 1.4 : Math.max(4, length * .65), view === "deck" ? width / 2 + 1.8 : width * 1.8);
      s.controls.enabled = false; s.controls.enableDamping = false; s.controls.target.copy(target); s.controls.update(); s.camera.lookAt(target); s.camera.updateMatrixWorld(); s.invalidate();
      return { renderer, copingPieces: frameKeys.size, rimY, matY, barY, deployedSlats: mat?.count ?? 0 };
    }, { length, width, view });
    if (stage === "after") {
      assert.equal(data.copingPieces, 4, "Brown coping must be one element per side");
      if (view === "open") assert.equal(data.deployedSlats, 0, "Cover must retract completely");
      else {
        assert.ok(Math.abs(data.matY - data.rimY) < 1e-6, "Slats must be flush with the actual rim");
        assert.ok(Math.abs(data.barY - data.rimY) < 1e-6, "Leading bar must be flush with the actual rim");
      }
    }
    await page.waitForTimeout(180);
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(done => setTimeout(done, 2000))]));
    await page.evaluate(async () => { const r = performance.getEntriesByType("resource").find(e => e.name.includes("/@react-three_fiber.js")); const f = await import(r.name); const s = f._roots.get(document.querySelector("canvas")).store.getState(); s.setFrameloop("demand"); s.invalidate(); });
    const path = resolve(out, `${stage}-${length}x${width}-${view}.png`);
    results.push({ length, width, view, ...data, screenshot: null });
    await writeFile(resolve(out, `${stage}-results.json`), JSON.stringify({ results, errors }, null, 2));
    try { await page.screenshot({ path, animations: "disabled", timeout: 8000 }); }
    catch {
      const cdp = await context.newCDPSession(page);
      const pixels = await Promise.race([cdp.send("Page.captureScreenshot", { format: "png", fromSurface: false, captureBeyondViewport: false }), new Promise((_, reject) => setTimeout(() => reject(Error("Capture blocked")), 8000))]);
      await writeFile(path, Buffer.from(pixels.data, "base64")); await cdp.detach();
    }
    results[results.length - 1].screenshot = path;
    await writeFile(resolve(out, `${stage}-results.json`), JSON.stringify({ results, errors }, null, 2));
    await context.close();
  }
} finally { clearTimeout(watchdog); await browser.close(); await writeFile(resolve(out, `${stage}-results.json`), JSON.stringify({ results, errors }, null, 2)); }
console.log(JSON.stringify({ stage, captures: results.length, errors, measurements: results.map(({ screenshot, renderer, ...r }) => r) }));
assert.equal(results.length, 9, "Incomplete visual capture matrix");
assert.equal(errors.length, 0, "Runtime or shader errors");
