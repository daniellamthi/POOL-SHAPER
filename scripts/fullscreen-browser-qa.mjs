// Actual UI in isolated headed Chrome; synthetic projects, no direct database access.
import { chromium } from "playwright";
import { build } from "rolldown";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

const url = process.env.QA_URL ?? "http://127.0.0.1:3003/";
const out = resolve("docs/fullscreen-qa-evidence");
const cache = resolve("node_modules/.cache/fullscreen-browser-qa");
const mode = process.argv[2] ?? "layout";
const selectedCases = process.argv.find(argument => argument.startsWith("--cases="))?.slice(8).split(",");
await mkdir(out, { recursive: true });
await build({
  input: ["src/lib/pool/store.tsx", "src/lib/pool/project.ts"],
  output: { dir: cache, format: "esm" }, platform: "node",
  resolve: { alias: { "@": resolve("src") } },
  plugins: [{ name: "fixture-no-rpc", resolveId(id) { if (id.endsWith("/projectDelivery.server")) return "\0fixture-rpc"; }, load(id) { if (id === "\0fixture-rpc") return "export const loadSharedProjectFn=()=>{throw Error('Fixture RPC forbidden')};"; } }],
  external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
});
const { configuratorTesting } = await import(pathToFileURL(`${cache}/store.js`).href);
const { toProjectConfiguration } = await import(pathToFileURL(`${cache}/project.js`).href);
const { reducer, createInitialState } = configuratorTesting;
const initialActions = [
  { type: "setProjectType", value: "new" }, { type: "setPoolType", value: "in-ground" },
  { type: "setPoolStructure", value: "reinforced-concrete" }, { type: "setShape", value: "rectangle" },
  { type: "setDimension", key: "length", value: 8 }, { type: "setDimension", key: "width", value: 4 },
  { type: "setDimension", key: "depth", value: 1.5 }, { type: "setPoolAccess", value: "internalSteps" },
  { type: "togglePoolFeature", value: "ledLighting" }, { type: "togglePoolFeature", value: "stairLighting" },
];
const fixture = (actions = []) => {
  const state = [...initialActions, ...actions].reduce(reducer, createInitialState());
  return toProjectConfiguration(randomUUID(), state.config, state.renovation);
};
const browser = await chromium.launch({ channel: "chrome", headless: false });
const watchdog = setTimeout(() => { void browser.close(); }, 600000);
const results = [], errors = [];
async function persist() { await writeFile(resolve(out, `${mode}${selectedCases ? "-selected" : ""}-results.json`), JSON.stringify({ url, mode, results, errors }, null, 2)); }
async function open(project = fixture(), viewport = { width: 1440, height: 900 }, endpoint = url, expireToast = true) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce", acceptDownloads: true });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 350)); });
  await page.addInitScript(p => { if (!localStorage.getItem("pool-shaper:project-draft:v1")) localStorage.setItem("pool-shaper:project-draft:v1", JSON.stringify(p)); }, project);
  await page.goto(endpoint, { waitUntil: "domcontentloaded" });
  await page.locator("canvas").first().waitFor({ state: "visible" });
  await page.waitForTimeout(2000);
  // The existing 8-second restore toast pauses while hovered and can cover
  // the mobile dock toggle. Let that transient notice expire before controls.
  if (expireToast) {
    await page.mouse.move(1, 1);
    await page.locator("[data-sonner-toast]").first().waitFor({ state: "hidden", timeout: 11000 });
  }
  return { context, page };
}
async function scene(page, benchmark = false) {
  return page.evaluate(async benchmark => {
    const resource = performance.getEntriesByType("resource").find(e => e.name.includes("/@react-three_fiber.js"));
    if (!resource) throw Error("Fiber module missing");
    const fiber = await import(resource.name), s = fiber._roots.get(document.querySelector("canvas"))?.store.getState();
    if (!s?.scene.getObjectByName("pool-basin")) throw Error("Pool scene missing");
    const gl = s.gl.getContext(), ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unavailable";
    if (/software|swiftshader|llvmpipe|unavailable/i.test(renderer)) throw Error(`Actual GPU required: ${renderer}`);
    s.scene.updateMatrixWorld(true); s.camera.updateMatrixWorld(true);
    const points = [], names = [];
    s.scene.traverse(object => {
      if (object.name) names.push(object.name);
      if (!object.geometry || !["plan-basin-walls", "plan-coping"].includes(object.name)) return;
      object.geometry.computeBoundingBox(); const box = object.geometry.boundingBox;
      if (!box || box.isEmpty()) return;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const p = s.camera.position.clone().set(x, y, z).applyMatrix4(object.matrixWorld).project(s.camera); points.push(p);
      }
    });
    const intervals = [];
    if (benchmark) await new Promise(done => { let prior; const next = t => { if (prior !== undefined) intervals.push(t - prior); prior = t; if (intervals.length === 90) done(); else requestAnimationFrame(next); }; requestAnimationFrame(next); });
    intervals.sort((a, b) => a - b);
    const canvas = document.querySelector("canvas").getBoundingClientRect();
    const module = await import("/src/lib/pool/camera.ts");
    const safeFrame = module.visibleCameraFrame(canvas, Array.from(document.querySelectorAll('[data-camera-occluder], [aria-label^="Passo "], [data-testid="construction-stage"], main [aria-label="Strumenti vista"], [data-technical-panel]')).map(e => e.getBoundingClientRect()));
    const occluders = Array.from(document.querySelectorAll("[data-camera-occluder]")).map(e => ({ name: e.dataset.cameraOccluder, rect: e.getBoundingClientRect().toJSON() }));
    return { renderer, pixelRatio: s.gl.getPixelRatio(), drawingBuffer: { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight }, calls: s.gl.info.render.calls, triangles: s.gl.info.render.triangles, textures: s.gl.info.memory.textures, geometries: s.gl.info.memory.geometries,
      medianRafMs: intervals[45] ?? null, p95RafMs: intervals[85] ?? null, contextLost: gl.isContextLost(),
      camera: s.camera.position.toArray(), target: s.controls?.target.toArray(), fov: s.camera.fov, names,
      poolProjection: { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)) },
      canvas: canvas.toJSON(), safeFrame, occluders, time: document.querySelector("[data-scene-time]")?.dataset.sceneTime,
      draft: JSON.parse(localStorage.getItem("pool-shaper:project-draft:v1") ?? "{}").config,
      pageOverflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
    };
  }, benchmark);
}
async function capture(page, name) {
  const path = resolve(out, `${name}.png`);
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(done => setTimeout(done, 2000))]));
  const previous = await page.evaluate(async () => {
    const resource = performance.getEntriesByType("resource").find(e => e.name.includes("/@react-three_fiber.js"));
    const fiber = await import(resource.name), s = fiber._roots.get(document.querySelector("canvas")).store.getState();
    const previous = s.frameloop; s.setFrameloop("demand"); s.invalidate(); return previous;
  });
  try {
    try { await page.screenshot({ path, animations: "disabled", timeout: 8000 }); }
    catch (error) {
      const cdp = await page.context().newCDPSession(page);
      const pixels = await Promise.race([cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false }), new Promise((_, reject) => setTimeout(() => reject(Error("CDP capture exceeded 8 seconds")), 8000))]);
      await writeFile(path, Buffer.from(pixels.data, "base64")); await cdp.detach();
      results.push({ screenshotFallback: name, originalError: String(error) });
    }
  } finally {
    await page.evaluate(async previous => { const resource = performance.getEntriesByType("resource").find(e => e.name.includes("/@react-three_fiber.js")); const fiber = await import(resource.name); fiber._roots.get(document.querySelector("canvas")).store.getState().setFrameloop(previous); }, previous);
  }
  return path;
}
async function phase(page, name) { await page.getByRole("navigation", { name: "Fasi della configurazione" }).getByRole("button", { name: new RegExp(name) }).click(); await page.waitForTimeout(1100); }
async function dock(page, expanded) {
  const button = page.locator(".pool-dock-toggle");
  if ((await button.getAttribute("aria-expanded")) !== String(expanded)) await button.click();
  await page.waitForTimeout(1200);
}
async function record(page, name, benchmark = false) {
  const info = await scene(page, benchmark);
  const screenshot = await capture(page, name);
  results.push({ name, screenshot, ...info }); await persist();
  console.log(JSON.stringify({ name, renderer: info.renderer, projection: info.poolProjection, safeFrame: info.safeFrame, medianRafMs: info.medianRafMs, calls: info.calls, pageOverflow: info.pageOverflow }));
}
async function tab(page, name) { await page.getByRole("tab", { name, exact: true }).click(); await page.waitForTimeout(350); }
async function choice(page, group, title) {
  const button = page.getByRole("group", { name: group, exact: true }).getByRole("button", { name: new RegExp(`^${title}`) }).first();
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
  await page.waitForTimeout(1400);
  // Infinity and finish choices can intentionally move directly to their detail tab.
  if (await button.count()) assert.equal(await button.getAttribute("aria-pressed"), "true", `${title} selected`);
}
try {
  if (mode === "inspect") {
    const { context, page } = await open();
    await writeFile(resolve(out, "initial-ui.txt"), await page.locator("body").innerText());
    console.log(await page.locator("body").innerText());
    await record(page, "initial-inspect", true); await context.close();
  } else if (mode === "layout" || mode === "latest") {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
      const { context, page } = await open(fixture(), viewport);
      await phase(page, "Presentazione");
      for (const expanded of mode === "latest" && viewport.width === 1440 ? [true] : [false, true]) {
        await dock(page, expanded);
        for (const time of mode === "latest" ? [viewport.width === 1440 ? "Giorno" : "Notte"] : ["Giorno", "Notte"]) {
          await page.getByRole("group", { name: "Ora della scena" }).getByRole("button", { name: time }).click();
          await page.waitForTimeout(1300);
          await record(page, `${mode}-${viewport.width}-${expanded ? "open" : "closed"}-${time === "Giorno" ? "day" : "night"}`, mode === "layout" && !expanded && time === "Giorno");
        }
      }
      await context.close();
    }
  } else if (mode === "flows" || mode === "materials") {
    const { context, page } = await open();
    if (mode === "flows") {
    await phase(page, "Piscina"); await dock(page, true);
    const trail = [];
    for (let i = 0; i < 35; i++) {
      const marker = await page.locator(".pool-dock-heading").innerText();
      trail.push(marker);
      if (/Richiedi proposta/.test(marker)) break;
      const button = page.locator(".pool-dock-continue");
      if (await button.isDisabled()) throw Error(`Continue disabled at ${marker}`);
      await button.click(); await page.waitForTimeout(400);
      const next = await page.locator(".pool-dock-heading").innerText();
      if (next === marker) throw Error(`Continue did not advance at ${marker}`);
    }
    const phases = [...new Set(trail.map(text => text.match(/Fase\s+(\d+)/i)?.[1]).filter(Boolean))];
    assert.equal(phases.length, 7, "Continua traverses all seven phases");
    await page.getByRole("button", { name: "Indietro", exact: true }).click();
    await page.waitForTimeout(300);
    assert((await page.locator(".pool-dock-heading").innerText()).includes("Riepilogo"), "Indietro restores preceding decision");
    results.push({ navigation: { phases, trail, back: "Riepilogo" } }); await persist();
    await page.getByRole("group", { name: "Ora della scena" }).getByRole("button", { name: "Giorno" }).click();
    await phase(page, "Sistema acqua"); await dock(page, true); await tab(page, "Sistema");
    await choice(page, "Sistema idraulico", "Skimmer");
    await record(page, "system-skimmer");
    await choice(page, "Sistema idraulico", "Sfioro"); await tab(page, "Tipo di sfioro");
    await choice(page, "Tipo di sfioro", "Sfioro nascosto");
    await record(page, "system-hidden");
    await choice(page, "Tipo di sfioro", "Sfioro a griglia");
    await record(page, "system-grille");
    await tab(page, "Sistema"); await choice(page, "Sistema idraulico", "Infinity"); await tab(page, "Lato Infinity");
    await writeFile(resolve(out, "infinity-options.txt"), await page.locator(".pool-dock-options").innerText());
    const side = page.getByRole("button", { name: /Lato.*(?:lungo|corto)|Lato [1-4]/ }).first();
    if (await side.count()) { await side.click(); await page.waitForTimeout(1800); }
    await record(page, "system-infinity");
    await tab(page, "Sistema"); await choice(page, "Sistema idraulico", "Skimmer");
    await phase(page, "Accesso & comfort"); await dock(page, true); await tab(page, "Accesso");
    await choice(page, "Accesso alla piscina", "Scala interna");
    await choice(page, "Tipo di scala interna", "Angolare");
    await record(page, "access-corner-stair");
    await choice(page, "Tipo di scala interna", "Rettilinea");
    await record(page, "access-linear-stair");
    }
    await phase(page, "Finiture"); await dock(page, true);
    await choice(page, "Rivestimento interno", "Mosaico");
    await record(page, "finish-mosaic");
    await choice(page, "Rivestimento interno", "Liner / PVC");
    await choice(page, "Colore liner PVC", "Sand Beach");
    await record(page, "finish-liner-sand");
    await page.locator(".pool-dock-continue").click(); await page.waitForTimeout(1000); await dock(page, true);
    await writeFile(resolve(out, "lighting-entry-ui.txt"), await page.locator("body").innerText());
    const colorTab = page.getByRole("tab", { name: "Colore LED", exact: true });
    for (let attempt = 0; attempt < 3 && !await colorTab.count() && !await page.getByRole("group", { name: "Illuminazione subacquea", exact: true }).count(); attempt++) {
      await page.locator(".pool-dock-continue").click(); await page.waitForTimeout(900); await dock(page, true);
    }
    if (!await colorTab.count()) await choice(page, "Illuminazione subacquea", "LED subacquei");
    await tab(page, "Colore LED");
    await page.getByRole("button", { name: "LED Rosso", exact: true }).click(); await page.waitForTimeout(1400);
    await page.getByRole("group", { name: "Ora della scena" }).getByRole("button", { name: "Notte" }).click(); await page.waitForTimeout(1300);
    await record(page, "led-red-night");
    await page.getByRole("button", { name: "LED Blu", exact: true }).click(); await page.waitForTimeout(1400);
    await record(page, "led-blue-night");
    await context.close();
    const above = await open(fixture([{ type: "setPoolType", value: "above-ground" }, { type: "setPoolStructure", value: "modular-steel-panels" }]));
    await phase(above.page, "Presentazione"); await dock(above.page, false);
    await record(above.page, "above-ground-presentation", true); await above.context.close();
  } else if (mode === "toast") {
    const { context, page } = await open(fixture(), { width: 390, height: 844 }, url, false);
    const notice = page.locator("[data-sonner-toast]").first();
    assert(await notice.isVisible(), "restore notice present during real interaction");
    const before = await notice.boundingBox();
    await page.locator(".pool-dock-toggle").click(); await page.waitForTimeout(400);
    assert.equal(await page.locator(".pool-dock-toggle").getAttribute("aria-expanded"), "true");
    const dockBox = await page.locator(".pool-config-dock").boundingBox(), toastBox = await notice.boundingBox();
    assert(toastBox.y + toastBox.height <= dockBox.y, "restore toast stays above expanded dock");
    await page.locator(".pool-dock-continue").click(); await page.waitForTimeout(400);
    assert((await page.locator(".pool-dock-heading").innerText()).includes("Riepilogo"), "Continue works while notice remains visible");
    await capture(page, "mobile-live-toast-controls");
    results.push({ toast: { before, after: toastBox, dock: dockBox, expanded: true, continued: "Riepilogo" } }); await context.close();
  } else if (mode === "performance") {
    const project = fixture();
    for (const port of [3002, 3003]) {
      const { context, page } = await open(project, { width: 1440, height: 900 }, `http://127.0.0.1:${port}/`);
      await record(page, `performance-${port}`, true); await context.close();
    }
  } else if (mode === "variants") {
    for (const [name, actions, viewport] of [
      ["hidden-presentation", [{ type: "setSystem", value: "overflow" }, { type: "setOverflowType", value: "hidden" }]],
      ["grille-presentation", [{ type: "setSystem", value: "overflow" }, { type: "setOverflowType", value: "visible" }]],
      ["infinity-presentation", [{ type: "setSystem", value: "infinity" }, { type: "setInfinitySide", value: 0 }]],
      ["infinity-portrait", [{ type: "setSystem", value: "infinity" }, { type: "setInfinitySide", value: 0 }], { width: 390, height: 844 }],
    ].filter(([name]) => !selectedCases || selectedCases.includes(name))) {
      const { context, page } = await open(fixture(actions), viewport);
      await phase(page, "Presentazione"); await dock(page, false);
      await record(page, `${name}${selectedCases ? "-pixel-budget" : ""}`); await context.close();
    }
    if (!selectedCases || selectedCases.includes("above-ground-wpc")) {
    const above = await open(fixture([{ type: "setPoolType", value: "above-ground" }, { type: "setPoolStructure", value: "modular-steel-panels" }]));
    await phase(above.page, "Finiture"); await dock(above.page, true); await tab(above.page, "Pannelli esterni");
    await choice(above.page, "Pannelli esterni", "WPC");
    await phase(above.page, "Presentazione"); await dock(above.page, false);
    await record(above.page, "above-ground-wpc"); await above.context.close();
    }
  } else if (mode === "bench") {
    const { context, page } = await open(fixture([{ type: "togglePoolFeature", value: "hydromassage" }, { type: "setHydromassageVariant", value: "open" }]));
    await phase(page, "Finiture"); await dock(page, true);
    const toggle = page.getByRole("group", { name: "Illuminazione subacquea", exact: true }).getByRole("button", { name: /^Micro-spot sulla panca/ });
    for (let attempt = 0; attempt < 3 && !await toggle.count(); attempt++) { await page.locator(".pool-dock-continue").click(); await page.waitForTimeout(900); await dock(page, true); }
    await page.getByRole("group", { name: "Ora della scena" }).getByRole("button", { name: "Notte" }).click();
    const count = () => page.evaluate(async () => {
      const resource = performance.getEntriesByType("resource").find(e => e.name.includes("/@react-three_fiber.js"));
      const fiber = await import(resource.name), s = fiber._roots.get(document.querySelector("canvas")).store.getState();
      let count = 0; s.scene.getObjectByName("pool-comfort")?.traverse(object => { if (object.name === "pool-hydro-spot") count++; }); return count;
    });
    assert.equal(await count(), 0, "bench spots absent while optional disabled");
    await toggle.click(); await page.waitForTimeout(1500);
    const enabled = await count(); assert(enabled > 0, "optional mounts bench spot geometry");
    await record(page, "bench-lighting-on");
    await toggle.click(); await page.waitForTimeout(1500);
    assert.equal(await count(), 0, "optional removes bench spot geometry");
    await record(page, "bench-lighting-off");
    results.push({ benchOptional: { off: 0, on: enabled, offAgain: 0 } }); await context.close();
  } else if (mode === "grille-detail") {
    const { context, page } = await open(fixture([{ type: "setSystem", value: "overflow" }, { type: "setOverflowType", value: "hidden" }]));
    await phase(page, "Sistema acqua"); await dock(page, true); await tab(page, "Tipo di sfioro");
    await choice(page, "Tipo di sfioro", "Sfioro a griglia");
    await record(page, "grille-detail-pixel-budget"); await context.close();
  } else if (mode === "local-pdf") {
    const project = fixture();
    const { context, page } = await open(project);
    const blockedPosts = [];
    await page.route("**/*", route => {
      if (route.request().method() === "POST") { blockedPosts.push(new URL(route.request().url()).pathname); return route.abort(); }
      return route.continue();
    });
    await phase(page, "Presentazione"); await dock(page, false);
    const presentation = {};
    const imageEvidence = [];
    for (const [time, label] of [["day", "Giorno"], ["night", "Notte"]]) {
      await page.getByRole("group", { name: "Ora della scena" }).getByRole("button", { name: label }).click();
      await page.waitForTimeout(800);
      const capture = await page.evaluate(async () => {
        const module = await import("/src/lib/project-delivery/heroCapture.ts");
        const resource = performance.getEntriesByType("resource").find(e => e.name.includes("/@react-three_fiber.js"));
        const fiber = await import(resource.name), s = fiber._roots.get(document.querySelector("canvas")).store.getState();
        let maximumPixelRatio = s.gl.getPixelRatio(), sampling = true;
        const sample = () => { maximumPixelRatio = Math.max(maximumPixelRatio, s.gl.getPixelRatio()); if (sampling) requestAnimationFrame(sample); }; sample();
        const data = await module.requestHeroCapture(); sampling = false;
        const image = new Image(); image.src = data; await image.decode();
        return { data, width: image.naturalWidth, height: image.naturalHeight, maximumPixelRatio };
      });
      presentation[time] = capture.data;
      imageEvidence.push({ time, width: capture.width, height: capture.height, maximumPixelRatio: capture.maximumPixelRatio });
      assert(presentation[time]?.startsWith("data:image/"), "actual local scene captured for PDF");
    }
    await page.getByRole("group", { name: "Ora della scena" }).getByRole("button", { name: "Giorno" }).click();
    const downloadPromise = page.waitForEvent("download", { timeout: 60000 });
    const metadata = await page.evaluate(async ({ project, presentation }) => {
      const { buildProjectSummary } = await import("/src/lib/project-delivery/summary-model.ts");
      const { buildProjectBook } = await import("/src/lib/project-delivery/projectBook.ts");
      const doc = await buildProjectBook({ model: buildProjectSummary(project), publicRef: "QA-LOCAL-ONLY", shareUrl: "http://127.0.0.1:3003/#qa-local-only", heroDataUrl: presentation.day, presentation, issuedAt: new Date() });
      const metadata = { pages: doc.getNumberOfPages(), bytes: doc.output("arraybuffer").byteLength };
      doc.save("QA-local-fixture-project-book.pdf"); return metadata;
    }, { project, presentation });
    const download = await downloadPromise;
    const pdf = resolve(out, "local-fixture-project-book.pdf"); await download.saveAs(pdf);
    assert.equal(blockedPosts.length, 0, "local PDF generator sends no backend requests");
    results.push({ localPdf: { projectId: project.projectId, pdf, ...metadata, actualDayNightImages: true, imageEvidence, blockedPosts, scope: "client PDF generator/download; Save/Share roundtrip not tested" } });
    await context.close();
  } else if (mode === "delivery-surface") {
    const { context, page } = await open();
    const posts = [];
    page.on("request", request => { if (request.method() === "POST") posts.push(new URL(request.url()).pathname); });
    await phase(page, "Presentazione"); await dock(page, true); await tab(page, "Riepilogo");
    const available = {};
    for (const name of ["save", "share", "pdf"]) available[name] = { visible: await page.getByTestId(`delivery-${name}`).isVisible(), enabled: await page.getByTestId(`delivery-${name}`).isEnabled() };
    await record(page, "delivery-controls-read-only");
    await tab(page, "Richiedi proposta");
    await page.getByRole("button", { name: "Valuta il progetto con un consulente", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Invia richiesta", exact: true }).click();
    assert(await dialog.getByText("Il nome è obbligatorio", { exact: true }).isVisible());
    assert(await dialog.getByText("È necessario accettare l'informativa privacy", { exact: true }).isVisible());
    assert.equal(posts.length, 0, "empty-form validation sends no backend request");
    await capture(page, "quote-validation-read-only");
    results.push({ deliverySurface: { available, localValidation: true, posts, externalRoundTrip: "blocked by automatic approval review; no synthetic backend records created" } });
    await context.close();
  } else throw Error(`Unknown mode ${mode}`);
} catch (error) { results.push({ error: String(error) }); console.error(error); process.exitCode = 1; }
finally { clearTimeout(watchdog); await browser.close(); await persist(); }
