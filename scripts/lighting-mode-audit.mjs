import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { Color, MathUtils } from "three";
import * as THREE from "three";
import { build } from "rolldown";

// Real reducer, geometry and delivery readers. No browser, database or email.
const root = process.cwd(), file = resolve("node_modules/.cache/lighting-mode-audit.mjs");
await build({ input: "lighting-mode-audit", output: { file, format: "esm" }, platform: "node",
  external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
  resolve: { alias: { "@": resolve("src") } }, plugins: [{ name: "lighting-production-entry",
    resolveId(id) { if (id === "lighting-mode-audit") return id; if (id.endsWith("/projectDelivery.server")) return "\0unused-lighting-rpc"; },
    load(id) {
      if (id === "\0unused-lighting-rpc") return "export const loadSharedProjectFn=()=>{throw Error('Unexpected network');};";
      if (id !== "lighting-mode-audit") return null;
      return `
        export { configuratorTesting } from "${root}/src/lib/pool/store.tsx";
        export { STEPS, RENOVATION_STEPS } from "${root}/src/lib/pool/config.ts";
        export { configuredPerimeterLights } from "${root}/src/lib/pool/perimeter-lighting.ts";
        export { configuredOutline } from "${root}/src/lib/pool/configured-outline.ts";
        export { parseProjectConfiguration, serializeProjectConfiguration, toProjectConfiguration } from "${root}/src/lib/pool/project.ts";
        export { shareableProject, saveProject, loadSharedProject } from "${root}/src/lib/project-delivery/service.ts";
        export { MemoryProjectStore } from "${root}/src/lib/project-delivery/store.ts";
        export { compatibleInfinityZones } from "${root}/src/lib/pool/infinity-edge.ts";
        export { L_SHAPE_ORIENTATIONS } from "${root}/src/lib/pool/l-shape.ts";
        export { buildProjectSummary } from "${root}/src/lib/project-delivery/summary-model.ts";
        export { createPhotoSceneSpec } from "${root}/src/lib/pool/photo-scene-spec.ts";
        export { SCENE_VISUAL_PRESET } from "${root}/src/configurator/3d/scene/visual-preset.ts";
        export { LED_OPTICS } from "${root}/src/lib/pool/led-optics.ts";
        export { calibratedLedColor, ledIntensityScale } from "${root}/src/lib/pool/led-optics.ts";
        export { translateText } from "${root}/src/lib/i18n/index.tsx";
        export { excludeSubmergedDirectLights } from "${root}/src/components/pool/three/exteriorLightMask.ts";
      `;
    } }] });
const api = await import(pathToFileURL(file).href);
const { reducer, createInitialState } = api.configuratorTesting;
let checks = 0;
const check = (value, label) => { assert(value, label); checks++; };
const equal = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const initial = createInitialState();
equal(initial.config.sceneTime, "day", "New projects start in Day");
equal(initial.config.features.includes("ledLighting"), false, "Main lighting remains optional");

for (const projectType of ["new", "renovation"]) {
  const steps = projectType === "renovation" ? api.RENOVATION_STEPS : api.STEPS;
  const step = steps.findIndex(item => item.id === "lighting");
  if (step < 0) continue;
  const state = { ...initial, step, config: { ...initial.config, projectType, sceneTime: "night", ledColor: "#ff0000", features: ["ledLighting", "stairLighting"] } };
  for (const action of [{ type: "next" }, { type: "previous" }, { type: "goToStep", value: 0 }]) {
    const next = reducer(state, action);
    equal(next.config.sceneTime, "day", "Leaving the lighting step restores Day");
    equal(next.config.features, state.config.features, "Day restoration keeps selected equipment");
    equal(next.config.ledColor, "#ff0000", "Day restoration keeps RGB");
  }
}
const selected = reducer(initial, { type: "setLedType", value: "perimeter" });
equal(selected.config.features.filter(id => id === "ledLighting").length, 1, "Perimeter enables one main lighting system");
const underwater = reducer(selected, { type: "setLedType", value: "underwater" });
equal(underwater.config.features, selected.config.features, "Alternatives share a single mutually exclusive main-light selection");
equal(underwater.config.ledType, "underwater");

let geometryCases = 0;
for (const [length, width] of [[6, 3], [8, 4], [12, 5]]) {
  for (const shape of ["rectangle", "l-shape", "custom"]) {
    for (const system of ["skimmer", "overflow", "infinity"]) {
      for (const copingEdge of ["square", "rounded"]) {
        const config = { ...selected.config, projectType: "new", poolType: "in-ground", structure: "reinforced-concrete",
          shape, shapeSelected: true, system, overflowType: "hidden", copingEdge,
          ...(system === "infinity" && shape !== "custom" ? { infinityEdge: { enabled: true, side: 0, wallType: "glass" } } : {}),
          dimensions: { ...initial.config.dimensions, length, width } };
        if (system === "infinity" && shape === "custom") continue;
        const plan = api.configuredPerimeterLights({ ...config, ledPerimeterSides: undefined });
        const all = api.configuredPerimeterLights({ ...config, ledPerimeterSides: plan.sides.map(side => side.id) });
        check(all.selected.every(side => side.available), "Infinity side cannot receive a strip");
        equal(all.selected.length, all.sides.filter(side => side.available).length, "Every compatible selected side is rendered");
        equal(api.configuredPerimeterLights({ ...config, ledPerimeterSides: [] }).selected.length, 0, "No phantom strip when sides are cleared");
        const outline = api.configuredOutline(config);
        const distance = ([x, , z]) => Math.min(...outline.map((a, i) => {
          const b = outline[(i + 1) % outline.length], dx = b[0] - a[0], dz = b[1] - a[1];
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
          return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
        }));
        for (const side of all.selected) {
          check(side.points.length >= 2 && side.length > 0, "Strip has a usable path");
          for (const point of side.points) check(point.every(Number.isFinite) && distance(point) <= .0041, "Diffuser follows the real wall, including rounded corners");
          let measured = 0;
          for (let i = 1; i < side.points.length; i++) {
            const a = side.points[i - 1], b = side.points[i];
            measured += Math.hypot(b[0] - a[0], b[2] - a[2]);
            check(distance([(a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2]) < .0042, "No interior chord between valid boundary vertices");
          }
          check(Math.abs(measured - side.length) < 1e-9, "Reported length is the constructed strip length");
        }
        if (system === "infinity") check(all.sides.some(side => !side.available), "Infinity overflow edge is kept clear");
        geometryCases++;
      }
    }
  }
}

for (const lShapeOrientation of api.L_SHAPE_ORIENTATIONS) {
  const config = { ...selected.config, poolType: "in-ground", shape: "l-shape", system: "infinity",
    dimensions: { ...initial.config.dimensions, length: 12, width: 5, lShapeOrientation } };
  for (const zone of api.compatibleInfinityZones(api.configuredOutline(config), "l-shape", "in-ground")) {
    const proposal = { ...config, infinityEdge: { enabled: true, side: zone.side, wallType: "glass" }, ledPerimeterSides: [0, 1, 2, 3, 4, 5] };
    const plan = api.configuredPerimeterLights(proposal);
    equal(plan.selected.length, 5, "Each L orientation keeps precisely the selected Infinity edge clear");
    geometryCases++;
  }
}
for (const [length, width] of [[6, 3], [8, 4], [12, 5]]) {
  const config = { ...selected.config, poolType: "above-ground", dimensions: { ...initial.config.dimensions, length, width }, ledPerimeterSides: [0, 1, 2, 3] };
  const plan = api.configuredPerimeterLights(config);
  equal(plan.selected.length, 4, "All four above-ground retaining sides are selectable");
  check(plan.selected.every(side => side.points.every(point => Math.abs(point[1] - (config.dimensions.depth - .02)) < 1e-9)), "Above-ground strip follows the real wall elevation");
  geometryCases++;
}

const state = reducer({ ...selected, config: { ...selected.config, projectType: "new", poolType: "in-ground", structure: "reinforced-concrete", shapeSelected: true } },
  { type: "setLedPerimeterSides", value: [0, 2] });
const snapshot = api.toProjectConfiguration(state.projectId, state.config, state.renovation);
const restored = api.parseProjectConfiguration(api.serializeProjectConfiguration(snapshot));
equal(restored.config.ledType, "perimeter"); equal(restored.config.ledPerimeterSides, [0, 2]);
const shared = api.shareableProject(restored);
equal(shared.config.ledPerimeterSides, [0, 2], "Share keeps the chosen sides");
const store = new api.MemoryProjectStore();
const saved = await api.saveProject(store, { snapshot: api.serializeProjectConfiguration(snapshot) });
const loaded = api.parseProjectConfiguration((await api.loadSharedProject(store, saved.publicRef)).snapshot);
equal(loaded.config.ledPerimeterSides, [0, 2], "Real Save/Reload/Share service round trip through an isolated memory fixture");
const legacy = structuredClone(snapshot); delete legacy.config.ledType; delete legacy.config.ledPerimeterSides;
check(!api.parseProjectConfiguration(JSON.stringify(legacy)).config.ledType, "Old projects remain wall-light projects");
for (const bad of [[0, 0], [-1], [1.5], "all"]) {
  assert.throws(() => api.parseProjectConfiguration(JSON.stringify({ ...snapshot, config: { ...snapshot.config, ledPerimeterSides: bad } })));
  checks++;
}
for (const locale of ["it", "en"]) {
  const summary = api.buildProjectSummary(restored, locale);
  const lighting = summary.sections.find(section => section.id === "lighting");
  check(lighting.rows.some(row => row.value === (locale === "it" ? "Illuminazione perimetrale a LED" : "Perimeter LED lighting")), "Summary/PDF identify the right main lighting system");
  check(!lighting.rows.some(row => /automatici|automatic|Punti luce|Light points/.test(row.value + row.label)), "Perimeter summary does not invent underwater fittings");
  check(summary.technical.some(row => row.label === "LED" && row.value.includes(locale === "it" ? "LED perimetrali" : "Perimeter LEDs")), "Technical/PDF lighting length uses the selected language");
}
equal(api.createPhotoSceneSpec(restored).lighting.perimeter.selected.map(side => side.id), [0, 2], "Photo specification uses the same sides");
equal(api.LED_OPTICS.presentations.day, { output: 0, emission: 0, glow: 0, scatter: 0 }, "Day is free of artificial LED emission");

// Execute the real SceneMood frame callback, including a project opened at
// night. Previously cached first-frame intensities corrupted the next Day.
const sceneSource = readFileSync("src/components/pool/three/PoolScene.tsx", "utf8");
const ast = ts.createSourceFile("scene.tsx", sceneSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const mood = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "SceneMood");
assert(mood);
const envSource = readFileSync("src/components/pool/three/DaylightEnvironment.tsx", "utf8");
const envAst = ts.createSourceFile("env.tsx", envSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const coastalNode = envAst.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(envAst) === "COASTAL_DAYLIGHT"));
const compiled = ts.transpileModule(`${coastalNode.getText(envAst).replace("export ", "")}\n${mood.getText(ast)}\nglobalThis.renderMood=SceneMood;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
for (const initiallyNight of [false, true]) {
  let cursor = 0, frame; const hooks = [];
  const sandbox = { Color, MathUtils, SCENE_VISUAL_PRESET: api.SCENE_VISUAL_PRESET,
    useRef(value) { const i = cursor++; hooks[i] ??= { current: value }; return hooks[i]; },
    useMemo(make, deps) { const i = cursor++; const old = hooks[i]; if (!old || deps.some((dep, n) => dep !== old.deps[n])) hooks[i] = { value: make(), deps }; return hooks[i].value; },
    useFrame(callback) { frame = callback; } };
  runInNewContext(compiled, sandbox);
  const sky = { current: { intensity: initiallyNight ? .15 : .24, groundColor: new Color() } };
  const sun = { current: { intensity: 3.2, color: new Color() } }, auxiliary = { current: { intensity: .2 } };
  const draw = { gl: {}, scene: { environmentIntensity: 0, background: new Color(), fog: { color: new Color() } } };
  const render = dusk => { cursor = 0; sandbox.renderMood({ dusk, baseBackground: "#f3efe9", baseExposure: .95, baseEnvironment: .24, sky, sun, auxiliary }); };
  render(initiallyNight);
  for (const dusk of [true, false, true, false]) {
    render(dusk);
    for (let i = 0; i < 60; i++) frame(draw, 1 / 60);
    if (!dusk) {
      equal(sky.current.intensity, api.SCENE_VISUAL_PRESET.lighting.sky.intensity.light);
      equal(sun.current.intensity, api.SCENE_VISUAL_PRESET.lighting.sun.intensity.light);
      equal(auxiliary.current.intensity, api.SCENE_VISUAL_PRESET.lighting.auxiliary.intensity.light);
      equal(draw.scene.environmentIntensity, .24);
      equal(draw.gl.toneMappingExposure, .95);
      check(draw.scene.background.equals(new Color("#f3efe9")), "Returning Day has the original daylight background");
    }
  }
}
const mask = { uniforms: {}, fragmentShader: "#include <lights_fragment_begin>" };
api.excludeSubmergedDirectLights(mask, -.12);
check(!mask.fragmentShader.includes("RE_Direct_RectArea( rectAreaLight,"), "Dry deck cannot receive strip light through the pool shell");

// Execute the real perimeter component with deterministic hook/JSX stubs.
// This proves resource identity and emitted props, NOT a browser/GPU render.
const perimeterSource = readFileSync("src/components/pool/three/PerimeterLights.tsx", "utf8");
const perimeterCode = ts.transpileModule(`${perimeterSource}\nglobalThis.renderSide=PerimeterSide;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
let resourceCursor = 0, ltcInitializations = 0;
const resourceHooks = [];
const jsx = (type, props) => ({ type, props });
const resourceSandbox = { exports: {}, require(name) {
  if (name === "react") return {
    useRef(value) { const i = resourceCursor++; return resourceHooks[i] ??= { current: value }; },
    useMemo(make, deps) {
      const i = resourceCursor++, old = resourceHooks[i];
      if (!old || deps.some((dep, n) => dep !== old.deps[n])) resourceHooks[i] = { value: make(), deps };
      return resourceHooks[i].value;
    },
    useEffect() {}, useLayoutEffect() {},
  };
  if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
  if (name === "three") return THREE;
  if (name.includes("RectAreaLightUniformsLib")) return { RectAreaLightUniformsLib: { init() { ltcInitializations++; } } };
  if (name === "@/lib/pool/led-optics") return api;
  throw Error(`Unexpected perimeter dependency: ${name}`);
} };
runInNewContext(perimeterCode, resourceSandbox);
const side = api.configuredPerimeterLights(restored.config).selected[0];
const renderSide = (night, colour, output = 1) => {
  resourceCursor = 0;
  return resourceSandbox.renderSide({ side: structuredClone(side), night, colour, output }).props.children;
};
const [originalMesh] = renderSide(false, "#ffffff");
for (const colour of ["#ffffff", "#ff0000", "#0000ff", "#00ff00", "#ff8800", "#9933ff"]) {
  for (const night of [true, false]) {
    const [mesh, light] = renderSide(night, colour);
    check(mesh.props.geometry === originalMesh.props.geometry, "Day/Night and RGB retain the physical diffuser geometry");
    check(mesh.props.material === originalMesh.props.material, "Day/Night and RGB retain the same material");
    equal(light.type, "rectAreaLight", "The emitter remains mounted in both presentations");
    check(night ? light.props.intensity > 0 : light.props.intensity === 0, "Perimeter illuminates only the Night presentation");
    check(night ? mesh.props.material.emissiveIntensity > 0 : mesh.props.material.emissiveIntensity === 0, "Diffuser is not emissive by Day");
    check(light.props.color.toArray().every(Number.isFinite), "All selected RGB colours are finite");
  }
}
equal(ltcInitializations, 1, "Area-light lookup data is initialized once, not on each toggle");
originalMesh.props.geometry.dispose(); originalMesh.props.material.dispose();
console.log(JSON.stringify({ status: "PASS", checks, geometryCases, scope: "Local state, actual-wall geometry, legacy restore/share, summary/Photo data, deterministic day restoration. Browser visuals and GPU frame timing NOT verified." }, null, 2));
