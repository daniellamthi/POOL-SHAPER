import { chromium } from "playwright";
import { build } from "rolldown";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const stage = process.argv[2] ?? "after";
const out = resolve("docs/fullscreen-qa-evidence/infinity-only");
const cache = resolve("node_modules/.cache/infinity-only");
await mkdir(out, { recursive: true });
await build({ input: ["src/lib/pool/store.tsx", "src/lib/pool/project.ts"], output: { dir: cache, format: "esm" }, platform: "node", resolve: { alias: { "@": resolve("src") } },
  plugins: [{ name: "local-only", resolveId(id) { if (id.endsWith("/projectDelivery.server")) return "\0no-rpc"; }, load(id) { if (id === "\0no-rpc") return "export const loadSharedProjectFn=()=>{throw Error('No QA RPC');};"; } }], external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"] });
const { configuratorTesting: testing } = await import(pathToFileURL(`${cache}/store.js`));
const { toProjectConfiguration } = await import(pathToFileURL(`${cache}/project.js`));
const browser = await chromium.launch({ channel: "chrome", headless: false });
const results = [], errors = [];
const watchdog = setTimeout(() => void browser.close(), 180000);
try {
  for (const vw of process.env.QA_WIDTH ? [Number(process.env.QA_WIDTH)] : [1440, 390, 430]) for (const wallType of stage === "before" ? ["traditional"] : ["traditional", "glass"]) {
    const actions = [{ type: "setProjectType", value: "new" }, { type: "setPoolType", value: "in-ground" }, { type: "setPoolStructure", value: "reinforced-concrete" }, { type: "setShape", value: "rectangle" }, { type: "setDimension", key: "length", value: 8 }, { type: "setDimension", key: "width", value: 4 }, { type: "setDimension", key: "depth", value: 1.5 }, { type: "setPoolAccess", value: "internalSteps" }, { type: "setSystem", value: "infinity" }, { type: "setInfinitySide", value: 2 }, { type: "setInfinityWall", value: wallType }];
    const state = actions.reduce(testing.reducer, testing.createInitialState());
    const project = toProjectConfiguration(randomUUID(), state.config, state.renovation);
    const context = await browser.newContext({ viewport: { width: vw, height: vw === 390 ? 844 : vw === 430 ? 932 : 900 }, deviceScaleFactor: 1 });
    await context.route("**/*", route => route.request().method() === "POST" ? route.abort() : route.continue());
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 500)); });
    await page.addInitScript(p => localStorage.setItem("pool-shaper:project-draft:v1", JSON.stringify(p)), project);
    await page.goto("http://127.0.0.1:3003/", { waitUntil: "domcontentloaded" });
    await page.locator("canvas").waitFor(); await page.waitForTimeout(11000);
    const data = await page.evaluate(async () => {
      const r = performance.getEntriesByType("resource").find(e => e.name.includes("/@react-three_fiber.js"));
      const f = await import(r.name), s = f._roots.get(document.querySelector("canvas")).store.getState();
      const glass = s.scene.getObjectByName("infinity-glass-wall"), crest = s.scene.getObjectByName("infinity-crest-water");
      assertScene();
      function assertScene() { if (!crest) throw Error("Missing Infinity water"); }
      const bounds = mesh => { mesh.geometry.computeBoundingBox(); return { min: mesh.geometry.boundingBox.min.toArray(), max: mesh.geometry.boundingBox.max.toArray() }; };
      return { glass: glass ? bounds(glass) : null, water: bounds(crest), camera: s.camera.position.toArray(), target: s.controls.target.toArray(), triangles: s.gl.info.render.triangles, calls: s.gl.info.render.calls };
    });
    assert.equal(Boolean(data.glass), wallType === "glass");
    if (data.glass) assert.ok(Math.abs(data.water.max[1] - data.glass.max[1] - .006) < 1e-6);
    const path = resolve(out, `${stage}-${vw}-${wallType}.png`);
    await page.screenshot({ path, timeout: 15000 });
    results.push({ vw, wallType, ...data, screenshot: path });
    if (wallType === "glass" && vw === 1440) {
      await page.evaluate(async () => {
        const r = performance.getEntriesByType("resource").find(e => e.name.includes("/@react-three_fiber.js"));
        const f = await import(r.name), s = f._roots.get(document.querySelector("canvas")).store.getState();
        s.setFrameloop("never");
        s.controls.enabled = false; s.controls.enableDamping = false;
        s.controls.target.set(0, -.2, 1.8); s.camera.position.set(5, 1.3, 6.5); s.camera.lookAt(0, -.2, 1.8);
        s.camera.updateMatrixWorld(); s.gl.render(s.scene, s.camera);
      });
      await page.waitForTimeout(250);
      await page.screenshot({ path: resolve(out, `${stage}-glass-exterior.png`), timeout: 15000 });
      if (process.env.QA_UI) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: /Sistema acqua/ }).first().click();
        await page.getByRole("button", { name: /Continua/ }).click();
        await page.getByRole("button", { name: /Parete Infinity tradizionale/ }).click();
        await page.waitForTimeout(800);
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("pool-shaper:project-draft:v1")).config.infinityEdge.wallType === "glass"), false);
        await page.getByRole("button", { name: /Parete Infinity in vetro/ }).click();
        for (const side of [1,2,3,4]) {
          await page.getByRole("button", { name: `Lato ${side}`, exact: true }).click();
          await page.waitForTimeout(900);
          const selected = await page.evaluate(() => JSON.parse(localStorage.getItem("pool-shaper:project-draft:v1")).config.infinityEdge);
          assert.equal(selected.side, side - 1); assert.equal(selected.wallType, "glass");
          await page.screenshot({ path: resolve(out, `${stage}-ui-side-${side}.png`), timeout: 15000 });
        }
        results.push({ ui: "traditional/glass and four side selections persisted" });
      }
    }
    await context.close();
    await writeFile(resolve(out, `${stage}.json`), JSON.stringify({ results, errors }, null, 2));
  }
} finally { clearTimeout(watchdog); await browser.close(); await writeFile(resolve(out, `${stage}.json`), JSON.stringify({ results, errors }, null, 2)); }
assert.equal(errors.length, 0, errors.join("\n"));
console.log(JSON.stringify({ captures: results.length, errors, results }));
