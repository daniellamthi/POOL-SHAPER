/** Capture only: original configurator geometry, lights and materials; no remote writes. */
import { chromium } from "playwright";
import { build } from "rolldown";
import { resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const endpoint = process.env.QA_URL ?? "http://127.0.0.1:3003/";
const output = resolve("public/product-previews");
const cache = resolve("node_modules/.cache/product-previews");
await mkdir(output, { recursive: true });
let priorResults = [];
try { priorResults = JSON.parse(await readFile(resolve(output, "capture-audit.json"), "utf8")).results ?? []; } catch { /* First capture. */ }
await build({
  input: ["src/lib/pool/store.tsx", "src/lib/pool/project.ts"],
  output: { dir: cache, format: "esm" }, platform: "node",
  resolve: { alias: { "@": resolve("src") } },
  plugins: [{ name: "preview-no-rpc", resolveId(id) { if (id.endsWith("/projectDelivery.server")) return "\0preview-rpc"; }, load(id) { if (id === "\0preview-rpc") return "export const loadSharedProjectFn=()=>{throw Error('Preview RPC forbidden')};"; } }],
  external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
});
const { configuratorTesting: { reducer, createInitialState } } = await import(pathToFileURL(`${cache}/store.js`).href);
const { toProjectConfiguration } = await import(pathToFileURL(`${cache}/project.js`).href);
const actions = [
  { type: "setProjectType", value: "new" }, { type: "setPoolType", value: "in-ground" },
  { type: "setPoolStructure", value: "reinforced-concrete" }, { type: "setShape", value: "rectangle" },
  { type: "setDimension", key: "length", value: 8 }, { type: "setDimension", key: "width", value: 4 },
  { type: "setDimension", key: "depth", value: 1.5 }, { type: "setPoolAccess", value: "internalSteps" },
];
const fixture = extra => {
  const state = [...actions, ...extra].reduce(reducer, createInitialState());
  return toProjectConfiguration(randomUUID(), state.config, state.renovation);
};
const aboveGround = [
  { type: "setPoolType", value: "above-ground" },
  { type: "setPoolStructure", value: "modular-steel-panels" },
];
const cases = [
  { key: "skimmer-slim", actions: [{ type: "setSkimmerType", value: "slim" }], object: "pool-skimmers", firstChild: true, originTarget: true, direction: [0.65, 0.3, 1.8], targetOffset: [0, 0.035, 0], distance: 1.25 },
  { key: "skimmer-high", actions: [{ type: "setSkimmerType", value: "highWaterline" }], object: "pool-skimmers", firstChild: true, originTarget: true, direction: [0.65, 0.3, 1.8], targetOffset: [0, 0.035, 0], distance: 1.25 },
  { key: "overflow-visible", actions: [{ type: "setSystem", value: "overflow" }, { type: "setOverflowType", value: "visible" }], object: "overflow-grille", target: [0, 0.02, -2.12], direction: [0.65, 0.95, 1.5], distance: 2.3 },
  { key: "overflow-hidden", actions: [{ type: "setSystem", value: "overflow" }, { type: "setOverflowType", value: "hidden" }], object: "overflow-edge-without-grille", target: [0, 0.02, -2.12], direction: [0.65, 0.95, 1.5], distance: 2.3 },
  { key: "access-ladder", actions: [{ type: "setPoolAccess", value: "stainlessSteelLadder" }], object: "pool-access-stainlessSteelLadder-linear", direction: [1, 0.8, 1.4] },
  { key: "access-external", actions: [...aboveGround, { type: "togglePoolFeature", value: "externalStaircase" }], object: "external-staircase", direction: [-1.1, 0.6, 1.4] },
  { key: "equipment-pellicano", actions: [...aboveGround, { type: "toggleEquipment", value: "pellicano" }], object: "pellicano", direction: [0.9, 0.5, 1.4] },
  { key: "equipment-loungers", actions: [{ type: "toggleEquipment", value: "loungers" }], object: "deck-furniture", direction: [0.7, 0.7, 1.1] },
  { key: "comfort-sunShelf", actions: [{ type: "togglePoolFeature", value: "sunShelf" }], object: "pool-comfort-sunShelf", direction: [0.9, 1.4, 1.4], targetOffset: [0, 0.35, 0] },
  { key: "equipment-sunShelfLoungers", actions: [{ type: "setDimension", key: "length", value: 12 }, { type: "setDimension", key: "width", value: 5 }, { type: "togglePoolFeature", value: "sunShelf" }, { type: "togglePoolFeature", value: "sunShelfLoungers" }, { type: "setSunShelfLoungerCount", value: 2 }], object: "sun-shelf-loungers", direction: [0.8, 0.9, 1.2], distance: 3.6 },
];
const selected = process.argv.find(v => v.startsWith("--cases="))?.slice(8).split(",");
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"] });
const results = [];
try {
  for (const item of cases.filter(item => !selected || selected.includes(item.key))) {
    const context = await browser.newContext({ viewport: { width: 900, height: 500 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await context.newPage();
    try {
      await page.route("**/*", route => route.request().method() === "POST" ? route.abort() : route.continue());
      await page.addInitScript(project => localStorage.setItem("pool-shaper:project-draft:v1", JSON.stringify(project)), fixture(item.actions));
      await page.goto(endpoint, { waitUntil: "domcontentloaded" });
      await page.locator("canvas").first().waitFor({ state: "visible", timeout: 45000 });
      await page.waitForTimeout(3800);
      const { pixels, ...evidence } = await page.evaluate(async item => {
        const resource = performance.getEntriesByType("resource").find(e => e.name.includes("/@react-three_fiber.js"));
        if (!resource) throw Error("Fiber module missing");
        const fiber = await import(resource.name);
        const s = fiber._roots.get(document.querySelector("canvas"))?.store.getState();
        if (!s) throw Error("Scene missing");
        const gl = s.gl.getContext(), ext = gl.getExtension("WEBGL_debug_renderer_info");
        const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
        if (/swiftshader|llvmpipe|software|unknown/i.test(renderer)) throw Error(`GPU unavailable: ${renderer}`);
        let object = s.scene.getObjectByName(item.object);
        if (!object) {
          const names = []; s.scene.traverse(o => { if (o.name) names.push(o.name); });
          throw Error(`${item.object} missing: ${names.join(",")}`);
        }
        if (item.firstChild) object = object.children[0];
        s.setFrameloop("never");
        if (s.controls) s.controls.enabled = false;
        s.scene.updateMatrixWorld(true);
        const mod = await import("/node_modules/.vite/deps/three.js");
        const box = new mod.Box3().setFromObject(object);
        const center = box.getCenter(new mod.Vector3());
        if (item.originTarget) object.getWorldPosition(center);
        if (item.target) center.fromArray(item.target);
        if (item.targetOffset) center.add(new mod.Vector3(...item.targetOffset));
        const size = box.getSize(new mod.Vector3());
        const direction = new mod.Vector3(...item.direction).normalize();
        if (!item.target) direction.transformDirection(object.matrixWorld);
        const distance = item.distance ?? Math.max(size.x / 1.8, size.y, size.z / 1.8) * 2.3;
        s.camera.position.copy(center).addScaledVector(direction, distance);
        s.camera.near = 0.01; s.camera.far = 150; s.camera.fov = 38;
        s.camera.lookAt(center); s.camera.updateProjectionMatrix(); s.camera.updateMatrixWorld(true);
        s.gl.render(s.scene, s.camera);
        const pixels = s.gl.domElement.toDataURL("image/jpeg", 0.9);
        return { pixels, renderer, object: item.object, camera: s.camera.position.toArray(), target: center.toArray(), box: { min: box.min.toArray(), max: box.max.toArray() }, config: JSON.parse(localStorage.getItem("pool-shaper:project-draft:v1")).config };
      }, item);
      const filename = `${item.key}.jpg`;
      await writeFile(resolve(output, filename), Buffer.from(pixels.split(",")[1], "base64"));
      results.push({ key: item.key, filename, kind: "3d-preview", capturedAt: new Date().toISOString(), source: "Actual configurator geometry/materials/lighting, synthetic local fixture; camera only changed for capture. Direct WebGL canvas export without UI.", ...evidence });
      console.log(JSON.stringify({ key: item.key, filename, renderer: evidence.renderer }));
    } catch (error) { console.error(item.key, String(error)); process.exitCode = 1; }
    finally { await context.close(); }
  }
} finally {
  await browser.close();
  const merged = new Map([...priorResults, ...results].map(result => [result.key, result]));
  await writeFile(resolve(output, "capture-audit.json"), JSON.stringify({ endpoint, capturedAt: new Date().toISOString(), results: [...merged.values()] }, null, 2));
}
