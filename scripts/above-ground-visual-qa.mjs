// Run against an existing dev server:
// PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium node scripts/above-ground-visual-qa.mjs <url> <output-dir>
// Screenshots need human review; scene/state assertions do not certify photorealism.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "rolldown";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.argv[2] ?? "http://127.0.0.1:3000/";
const output = resolve(process.argv[3] ?? join(tmpdir(), "pool-shaper-above-ground-qa"));
await mkdir(output, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), "above-ground-qa-fixture-"));
const fixtureEntry = join(scratch, "fixture.mjs");
await writeFile(
  fixtureEntry,
  `
import { configuratorTesting } from ${JSON.stringify(join(root, "src/lib/pool/store.tsx"))};
import { toProjectConfiguration } from ${JSON.stringify(join(root, "src/lib/pool/project.ts"))};
const { reducer, createInitialState } = configuratorTesting;
const actions = [
  { type: "setProjectType", value: "new" },
  { type: "setPoolType", value: "above-ground" },
  { type: "setPoolStructure", value: "modular-steel-panels" },
  { type: "setShape", value: "rectangle" },
  { type: "setDimension", key: "length", value: 6 },
  { type: "setDimension", key: "width", value: 3 },
  { type: "setDimension", key: "depth", value: 1.3 },
  { type: "setLinerColor", value: "motionSandBeach179" },
  { type: "togglePoolFeature", value: "externalStaircase" },
  { type: "toggleEquipment", value: "pellicano" },
];
const state = actions.reduce(reducer, createInitialState());
export default toProjectConfiguration("above-ground-visual-qa", state.config, state.renovation);
`,
);
const bundle = join(scratch, "fixture-bundle.mjs");
await build({
  input: fixtureEntry,
  output: { file: bundle, format: "esm" },
  platform: "node",
  resolve: { alias: { "@": join(root, "src") } },
});
const { default: base } = await import(pathToFileURL(bundle).href);
const desktop = { width: 1440, height: 900 };
const cases = [
  { name: "steel-day", finish: "steel-satin" },
  { name: "composite-day", finish: "composite-light" },
  { name: "gres-day", finish: "gres" },
  { name: "access-options-off", finish: "steel-satin", off: true },
  { name: "stainless-basin", finish: "composite-light", stainless: true },
  { name: "led-night", finish: "gres", night: true },
  { name: "elevation-long", finish: "steel-satin", view: "Prospetto lato lungo" },
  { name: "elevation-short", finish: "gres", view: "Prospetto lato corto" },
  { name: "mobile", finish: "composite-light", viewport: { width: 390, height: 844 } },
  {
    name: "mobile-expanded",
    finish: "gres",
    viewport: { width: 390, height: 844 },
    expanded: true,
  },
];
const requestedCases = process.argv
  .find((arg) => arg.startsWith("--cases="))
  ?.slice(8)
  .split(",");
if (requestedCases)
  assert(requestedCases.every((name) => cases.some((test) => test.name === name)));
const selectedCases = process.argv.includes("--controls-only")
  ? []
  : cases.filter((test) => !requestedCases || requestedCases.includes(test.name));
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const results = [];
let controls;

// Dispatch the existing UI event as the repository's visual harness does:
// software WebGL can stall the compositor long enough for mouse clicks to time out.
async function click(page, role, name) {
  await page
    .getByRole(role, { name, exact: true })
    .filter({ visible: true })
    .first()
    .evaluate((el, dropdown) => {
      if (dropdown)
        el.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }),
        );
      else el.click();
    }, name === "Vista della piscina");
}

async function sceneSnapshot(page) {
  const snapshot = await page.waitForFunction(async () => {
    const resource = performance
      .getEntriesByType("resource")
      .find((entry) => entry.name.includes("/@react-three_fiber.js"));
    if (!resource) return false;
    const fiber = await import(resource.name);
    const canvas = document.querySelector("canvas");
    const state = fiber._roots.get(canvas)?.store.getState();
    if (!state || !state.scene.getObjectByName("pool-basin")) return false;
    const names = [];
    const bounds = {};
    state.scene.updateMatrixWorld(true);
    state.camera.updateMatrixWorld(true);
    state.scene.traverse((object) => {
      if (object.name) names.push(object.name);
    });
    for (const name of ["above-ground-cladding", "external-staircase", "pellicano"]) {
      const object = state.scene.getObjectByName(name);
      if (!object) continue;
      const projected = [];
      object.traverse((mesh) => {
        if (!mesh.geometry) return;
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox;
        for (const x of [box.min.x, box.max.x])
          for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z])
              projected.push(
                state.camera.position
                  .clone()
                  .set(x, y, z)
                  .applyMatrix4(mesh.matrixWorld)
                  .project(state.camera),
              );
      });
      bounds[name] = {
        minX: Math.min(...projected.map((p) => p.x)),
        maxX: Math.max(...projected.map((p) => p.x)),
        minY: Math.min(...projected.map((p) => p.y)),
        maxY: Math.max(...projected.map((p) => p.y)),
      };
    }
    return {
      names,
      bounds,
      calls: state.gl.info.render.calls,
      triangles: state.gl.info.render.triangles,
      contextLost: state.gl.getContext().isContextLost(),
      camera: state.camera.position.toArray(),
      orbitTarget: state.controls?.target.toArray() ?? null,
      pellicanoMaterial: state.scene.getObjectByName("pellicano-spout")?.material.name ?? null,
    };
  });
  try {
    return await snapshot.jsonValue();
  } finally {
    await snapshot.dispose();
  }
}

async function captureStill(page, screenshot) {
  const previous = await page.evaluate(async () => {
    const resource = performance
      .getEntriesByType("resource")
      .find((entry) => entry.name.includes("/@react-three_fiber.js"));
    const fiber = await import(resource.name);
    const state = fiber._roots.get(document.querySelector("canvas")).store.getState();
    const previous = state.frameloop;
    state.setFrameloop("demand");
    state.invalidate();
    return previous;
  });
  try {
    await page.screenshot({ path: screenshot, timeout: 60000 });
  } finally {
    await page.evaluate(async (previous) => {
      const resource = performance
        .getEntriesByType("resource")
        .find((entry) => entry.name.includes("/@react-three_fiber.js"));
      const fiber = await import(resource.name);
      const state = fiber._roots.get(document.querySelector("canvas")).store.getState();
      state.setFrameloop(previous);
    }, previous);
  }
}

async function verifyControls() {
  const page = await browser.newPage({ viewport: desktop, reducedMotion: "reduce" });
  page.setDefaultTimeout(60000);
  const errors = [];
  let hotReloadConnected = false;
  let orbit;
  page.on("websocket", (socket) => {
    socket.on("framereceived", ({ payload }) => {
      if (String(payload).includes('"type":"connected"')) hotReloadConnected = true;
    });
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(
    (project) => localStorage.setItem("pool-shaper:project-draft:v1", JSON.stringify(project)),
    base,
  );
  const choice = async (group, name, expected) => {
    const button = page
      .getByRole("group", { name: group, exact: true })
      .getByRole("button", { name: new RegExp(`^${name}`) })
      .first();
    await button.evaluate((el) => el.click());
    await page.waitForFunction(
      ({ el, expected }) => el.getAttribute("aria-pressed") === String(expected),
      { el: await button.elementHandle(), expected },
    );
  };
  const saved = async (property, value) => {
    await page.waitForFunction(
      ({ property, value }) =>
        JSON.parse(localStorage.getItem("pool-shaper:project-draft:v1"))?.config[property] ===
        value,
      { property, value },
    );
    return page.evaluate(
      () => JSON.parse(localStorage.getItem("pool-shaper:project-draft:v1")).config,
    );
  };
  try {
    await page.goto(url, { waitUntil: "load", timeout: 60000 });
    await page.getByRole("heading", { name: "Presentazione", exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector("div[aria-hidden].fixed.inset-0"));
    await page.waitForTimeout(4000);
    const beforeDrag = await sceneSnapshot(page);
    const canvas = await page.locator("canvas").boundingBox();
    assert(canvas);
    const x = canvas.x + canvas.width / 2;
    const y = canvas.y + canvas.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 180, y + 20, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(1000);
    const afterDrag = await sceneSnapshot(page);
    const cameraMovement = Math.hypot(
      ...afterDrag.camera.map((value, i) => value - beforeDrag.camera[i]),
    );
    assert(cameraMovement > 0.5, "Dragging the real canvas must rotate the camera");
    const distance = (scene) =>
      Math.hypot(...scene.camera.map((value, i) => value - scene.orbitTarget[i]));
    await page.mouse.wheel(0, -900);
    await page.mouse.wheel(0, -900);
    await page.waitForTimeout(1000);
    const afterZoom = await sceneSnapshot(page);
    assert(distance(afterZoom) < distance(afterDrag) - 0.1, "Mouse wheel must zoom in");
    assert.equal(afterZoom.contextLost, false);
    assert(afterZoom.calls > 0 && afterZoom.triangles > 0);
    await captureStill(page, join(output, "interactive-orbit.png"));
    orbit = { cameraMovement, beforeDrag, afterDrag, afterZoom };
    assert(hotReloadConnected, "The live browser must connect to Vite hot reload");
    await click(page, "button", /^Accesso & comfort/);
    await page.getByRole("group", { name: "Accesso alla piscina", exact: true }).waitFor();
    assert.equal(await page.getByRole("tab", { name: "Comfort in acqua", exact: true }).count(), 0);
    await choice("Accesso alla piscina", "Scala interna", false);
    assert.equal(
      await page
        .getByRole("button", { name: /^Continua/ })
        .filter({ visible: true })
        .first()
        .isEnabled(),
      true,
    );
    assert((await page.locator("body").innerText()).includes("Scala interna disattivata"));
    await choice("Accesso alla piscina", "Scala esterna di accesso", false);
    assert(!(await sceneSnapshot(page)).names.includes("external-staircase"));
    await choice("Accesso alla piscina", "Scala esterna di accesso", true);
    await choice("Accesso alla piscina", "Scala interna", true);
    assert((await sceneSnapshot(page)).names.includes("external-staircase"));
    await click(page, "button", /^Finiture/);
    await click(page, "tab", "Pannelli esterni");
    for (const [title, finish] of [
      ["Composito chiaro", "composite-light"],
      ["Gres porcellanato", "gres"],
      ["Acciaio satinato", "steel-satin"],
    ]) {
      await choice("Pannelli esterni", title, true);
      const config = await saved("exteriorPanelFinish", finish);
      assert.equal(config.linerColor, base.config.linerColor);
      assert.equal(config.copingMaterial, base.config.copingMaterial);
      assert((await sceneSnapshot(page)).names.includes(`cladding-boards-${finish}`));
      if (finish === "gres") await captureStill(page, join(output, "exterior-panel-controls.png"));
    }
    await click(page, "tab", "Rivestimento interno");
    await choice("Colore liner PVC", "Arctic White", true);
    assert.equal(
      (await saved("linerColor", "motionArcticWhite180")).exteriorPanelFinish,
      "steel-satin",
    );
    await click(page, "button", /^Optional/);
    await choice("Optional esterni", "Pellicano", false);
    await page.waitForFunction(
      () =>
        !JSON.parse(localStorage.getItem("pool-shaper:project-draft:v1")).config.equipment.includes(
          "pellicano",
        ),
    );
    assert(!(await sceneSnapshot(page)).names.includes("pellicano"));
    await choice("Optional esterni", "Pellicano", true);
    await page.waitForFunction(() =>
      JSON.parse(localStorage.getItem("pool-shaper:project-draft:v1")).config.equipment.includes(
        "pellicano",
      ),
    );
    assert((await sceneSnapshot(page)).names.includes("pellicano"));
    await click(page, "button", /^Piscina/);
    await click(page, "button", /^Continua/);
    await choice("Tipo di piscina", "Piscina interrata", true);
    const config = await saved("poolType", "in-ground");
    assert(!config.features.includes("externalStaircase"));
    assert(!config.equipment.includes("pellicano"));
    assert.equal(config.exteriorPanelFinish, undefined);
    assert.deepEqual(errors, []);
    console.log(
      "PASS controls: real canvas rotation/zoom, hot reload, access ON/OFF, panel/liner independence, pellicano ON/OFF, installation switch",
    );
    return { passed: true, errors, hotReloadConnected, orbit };
  } finally {
    await page.close();
  }
}

try {
  for (const test of selectedCases) {
    const page = await browser.newPage({
      viewport: test.viewport ?? desktop,
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    page.setDefaultTimeout(60000);
    const errors = [];
    const badResponses = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
    });
    const project = structuredClone(base);
    project.config.exteriorPanelFinish = test.finish;
    if (test.off || test.stainless)
      project.config.dimensions = { ...project.config.dimensions, length: 8, width: 4 };
    if (test.off) {
      project.config.poolAccess = null;
      project.config.features = [];
      project.config.equipment = [];
    }
    if (test.stainless) project.config.structure = "visible-stainless-steel";
    if (test.night) {
      project.config.features.push("ledLighting");
      project.config.sceneTime = "night";
    }
    await page.addInitScript(
      (project) => localStorage.setItem("pool-shaper:project-draft:v1", JSON.stringify(project)),
      project,
    );
    const response = await page.goto(url, { waitUntil: "load", timeout: 60000 });
    assert.equal(response.status(), 200);
    await page.getByRole("heading", { name: "Presentazione", exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector("div[aria-hidden].fixed.inset-0"));
    if (test.expanded) await click(page, "button", "Espandi piscina");
    if (test.view) {
      await click(page, "button", "Vista della piscina");
      await click(page, "menuitem", test.view);
    }
    await page.waitForTimeout(test.night ? 10000 : 4000);
    const scene = await sceneSnapshot(page);
    assert.equal(scene.contextLost, false);
    assert(scene.triangles > 0 && scene.calls > 0, "The real renderer must draw geometry");
    assert(
      scene.names.includes(`cladding-boards-${test.finish}`),
      "Selected panels must be in the live scene",
    );
    assert.equal(scene.names.includes("external-staircase"), !test.off);
    assert.equal(scene.names.includes("pellicano"), !test.off);
    assert.equal(scene.pellicanoMaterial, test.off ? null : "stainless-satin");
    assert.equal(
      scene.names.some((name) => name.startsWith("pool-access-internalSteps")),
      !test.off,
    );
    assert(
      !scene.names.some((name) => name.startsWith("local-paving-")),
      "No terrace for an above-ground pool",
    );
    for (const [name, bounds] of Object.entries(scene.bounds)) {
      assert(
        bounds.minX >= -1 && bounds.maxX <= 1 && bounds.minY >= -1 && bounds.maxY <= 1,
        `${test.name}: ${name} must fit the viewport: ${JSON.stringify(bounds)}`,
      );
    }
    const screenshot = join(output, `${test.name}.png`);
    // Capture a still after validating a live draw. Demand rendering keeps
    // continuous software WebGL from delaying the compositor's screenshot.
    await captureStill(page, screenshot);
    assert.deepEqual(errors, [], "No browser errors");
    assert.deepEqual(badResponses, [], "All requested assets must load");
    results.push({ name: test.name, screenshot, scene, errors, badResponses });
    console.log(`PASS ${test.name}`);
    await page.close();
  }
  if (!process.argv.includes("--scenes-only")) controls = await verifyControls();
} finally {
  await writeFile(
    join(output, "results.json"),
    JSON.stringify({ scenes: results, controls }, null, 2),
  );
  await browser.close();
}
assert.equal(results.length, selectedCases.length);
if (results.length)
  console.log(
    `Above-ground visual QA: ${results.length} scene checks passed; screenshots ready for review in ${output}`,
  );
else console.log(`Above-ground UI controls passed; report in ${output}`);
