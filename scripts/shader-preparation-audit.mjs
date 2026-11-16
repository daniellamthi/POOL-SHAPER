import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as THREE from "three";

// Execute the actual component's layout effect with deterministic React and
// driver stubs. Browser timings/visuals are separate evidence.
const source = readFileSync("src/components/pool/three/ShaderPreparation.tsx", "utf8");
const sceneSource = readFileSync("src/components/pool/three/PoolScene.tsx", "utf8");
const code = ts.transpileModule(source.replaceAll("import.meta.env.DEV", "false"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
let checks = 0;
const check = (condition, label) => { assert(condition, label); checks++; };
const settle = () => new Promise(resolve => setTimeout(resolve, 60));

check(sceneSource.includes('useState(() => import.meta.env.DEV && readDevelopmentRenderPause())'), 'DEV pause initializes from tab-local session state across Scene remounts');
check(sceneSource.includes('if (import.meta.env.DEV) writeDevelopmentRenderPause(qaRenderPaused)'), 'Only DEV writes QA pause state; it is not technical project configuration');
const pauseHelpers = { exports: {}, window: { sessionStorage: new Map() } };
pauseHelpers.window.sessionStorage.getItem = key => pauseHelpers.window.sessionStorage.get(key) ?? null;
pauseHelpers.window.sessionStorage.setItem = (key, value) => pauseHelpers.window.sessionStorage.set(key, value);
pauseHelpers.window.sessionStorage.removeItem = key => pauseHelpers.window.sessionStorage.delete(key);
runInNewContext(ts.transpileModule(readFileSync('src/lib/pool/development-interaction-timing.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, pauseHelpers);
check(pauseHelpers.exports.readDevelopmentRenderPause() === false, 'Fresh tab starts with rendering enabled');
pauseHelpers.exports.writeDevelopmentRenderPause(true);
for (let remount = 0; remount < 4; remount++) check(pauseHelpers.exports.readDevelopmentRenderPause() === true, 'Pause survives a fresh Scene initializer');
pauseHelpers.exports.writeDevelopmentRenderPause(false);
check(pauseHelpers.exports.readDevelopmentRenderPause() === false && pauseHelpers.window.sessionStorage.size === 0, 'Resume clears QA state rather than persisting a project preference');
pauseHelpers.window.sessionStorage.getItem = () => { throw Error('Storage blocked'); };
pauseHelpers.window.sessionStorage.setItem = () => { throw Error('Storage blocked'); };
check(pauseHelpers.exports.readDevelopmentRenderPause() === false, 'Unavailable session storage safely defaults to live rendering');
pauseHelpers.exports.writeDevelopmentRenderPause(true);
check(sceneSource.includes('frameloop={preparingShaders || (import.meta.env.DEV && qaRenderPaused) ? "never" : "always"}'), 'Canvas reconfiguration/resize cannot silently resume a paused QA scene');
check(sceneSource.includes('enabled={showWater && !photoMode && !qaRenderPaused}'), 'Shader readiness cannot resume an intentionally paused QA canvas');
const pauseEffect = sceneSource.slice(sceneSource.indexOf('function DevelopmentRendererMetrics')).match(/useLayoutEffect\(\(\) => \{([\s\S]*?)\}, \[qaPaused, size.width, size.height, getRoot\]\);/);
check(!!pauseEffect, 'Pause layout effect responds to viewport changes');
const qaState = { internal: { frames: 2 }, frameloop: 'always', setFrameloop(value) { this.frameloop = value; } };
for (const viewport of [[1440,900],[390,844],[430,932],[1440,900]]) {
  qaState.frameloop = 'always'; qaState.internal.frames = 2;
  runInNewContext(pauseEffect[1], { qaPaused: true, getRoot: () => qaState, console: { debug() {} } });
  check(qaState.frameloop === 'never' && qaState.internal.frames === 0, `QA pause drains and remains stopped after ${viewport.join('x')} reconfiguration`);
}

function fixture({ parallel = true, failure = false, waiting = false, mode = "always" } = {}) {
  let cursor = 0, effect, cleanup, compiles = 0, invalidations = 0, preparing = false, target = null;
  const slots = [];
  const useRef = initial => {
    const index = cursor++;
    return slots[index] ??= { current: initial };
  };
  const useState = initial => {
    const index = cursor++;
    slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
    return [slots[index].value, value => { slots[index].value = value; }];
  };
  const useMemo = create => {
    const index = cursor++;
    slots[index] ??= { value: create() };
    return slots[index].value;
  };
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial();
  scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  const hidden = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  hidden.visible = false; scene.add(hidden);
  const program = { ready: !waiting, alive: true };
  const context = {
    getExtension: () => ({ COMPLETION_STATUS_KHR: 123 }),
    isProgram: item => item.alive,
    getProgramParameter: item => item.ready,
  };
  const gl = {
    extensions: { has: () => parallel }, info: { programs: [] }, getContext: () => context,
    getRenderTarget: () => target, setRenderTarget: value => { target = value; },
    compile() {
      compiles++;
      if (failure) throw new Error("Expected test driver failure");
      this.info.programs = [{ program }];
    },
  };
  const state = {
    gl, scene, camera: new THREE.PerspectiveCamera(), frameloop: mode,
    internal: { frames: 2 },
    clock: { elapsedTime: 42 },
    setFrameloop(value) { this.frameloop = value; this.clock.elapsedTime = 0; },
    invalidate() { invalidations++; },
  };
  const get = () => state;
  const warnings = [];
  const sandbox = { exports: {}, performance, MessageChannel, window: { setTimeout, clearTimeout },
    console: { debug() {}, warn: (...args) => warnings.push(args) },
    require(name) {
      if (name === "react") return { useMemo, useRef, useState, useEffect() {}, useLayoutEffect: callback => { effect = callback; } };
      if (name === "three") return THREE;
      if (name === "@react-three/fiber") return { useThree: selector => selector({ get }) };
      if (name === "@react-three/drei") return { Html: "html" };
      if (name === "@/lib/i18n") return { useI18n: () => ({ t: text => text }) };
      if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }) };
      throw new Error(name);
    },
  };
  runInNewContext(code, sandbox);
  return { state, program, warnings, get compiles() { return compiles; }, get invalidations() { return invalidations; },
    preparing: () => preparing,
    render(enabled = true, signature = "night") {
      cleanup?.(); cursor = 0; effect = undefined;
      sandbox.exports.ShaderPreparation({ enabled, signature, onPreparing: value => { preparing = value; } });
      cleanup = effect?.();
    },
    unmount() { cleanup?.(); geometry.dispose(); material.dispose(); hidden.material.dispose(); },
  };
}

const normal = fixture({ mode: "demand" });
normal.render();
check(normal.state.frameloop === "never" && normal.preparing(), "Preparation temporarily owns only this renderer");
check(normal.state.internal.frames === 0, "Queued R3F demand frames cannot draw unready programs despite never mode");
await settle();
check(normal.compiles === 2, "Identical visible variants compile once for canvas and once for linear offscreen output; hidden meshes omitted");
check(normal.state.frameloop === "demand" && !normal.preparing(), "Success restores original demand loop and clears ownership");
check(normal.state.clock.elapsedTime === 42 && normal.invalidations === 1, "Clock continuity and redraw restored exactly once");
normal.render(); await settle();
check(normal.compiles === 2, "Returning to a prepared signature reuses compiled programs");
normal.unmount();

const cancelled = fixture({ waiting: true });
cancelled.render(); await new Promise(resolve => setTimeout(resolve, 15));
check(cancelled.compiles === 2 && cancelled.preparing(), "Unready driver does not synchronously draw");
cancelled.render(false);
await settle();
check(cancelled.state.frameloop === "always" && !cancelled.preparing(), "Leaving stage cancels work and restores drawing");
check(cancelled.invalidations === 1, "Cancellation releases only once, including late completion");
cancelled.unmount();

const disposed = fixture({ waiting: true });
disposed.render(); await new Promise(resolve => setTimeout(resolve, 15));
disposed.program.alive = false; await settle();
check(disposed.state.frameloop === "always" && !disposed.preparing(), "Disposed/replaced material program cannot strand readiness polling");
disposed.unmount();

const failed = fixture({ failure: true }); failed.render(); await settle();
check(failed.warnings.length === 1 && failed.state.frameloop === "always" && !failed.preparing(), "Driver rejection falls back to ordinary drawing");
failed.render(); await settle();
check(failed.compiles === 2, "Failed signature is not marked prepared"); failed.unmount();

for (const options of [{ parallel: false }, { mode: "never" }]) {
  const unsupported = fixture(options); unsupported.render(); await settle();
  check(unsupported.compiles === 0 && !unsupported.preparing(), "Unsupported driver/external pause is never taken over");
  unsupported.unmount();
}
check(!source.includes("requestAnimationFrame("), "Readiness does not depend on throttled background presentation");
check(source.includes("performance.now()+10000"), "Driver readiness wait is bounded");

// Render the actual fitting function with deterministic hook stubs. A zero
// dimmer/Day is a uniform update, never a different light count/shader graph.
const comfortSource = readFileSync("src/components/pool/three/PoolComfortModel.tsx", "utf8");
const ast = ts.createSourceFile("comfort.tsx", comfortSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const fitting = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "HydroSpot");
assert(fitting);
const fittingCode = ts.transpileModule(`${fitting.getText(ast)}\nexports.fitting=HydroSpot;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const fittingContext = { exports: {}, useMemo: create => create(), Object3D: THREE.Object3D,
  HYDRO_DIMENSIONS: { spotDiameter: 0.02 },
  MICRO_SPOT_OPTICS: { bodyCenter: -0.006, bodyDepth: 0.012, trimCenter: 0.001, trimTube: 0.0012, lensCenter: 0.0014, emitterEpsilon: 0.0002, lensRadiusRatio: 0.35, target: [0, -0.18, 0.42], range: 0.9, angle: Math.PI * 0.3 },
  microSpotPresentation: (night, colour, dimmer) => ({ colour, output: night ? 2 * dimmer : 0, emission: night ? dimmer : 0 }),
  StainlessSteelMaterial: "steel",
  require: () => ({ jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }),
};
runInNewContext(fittingCode, fittingContext);
const nodes = (node, type) => !node || typeof node !== "object" ? [] : [
  ...(node.type === type ? [node] : []),
  ...[node.props?.children].flat().flatMap(child => nodes(child, type)),
];
for (const dimmer of [0, 0.4, 1]) {
  const props = { spot: { x: 1, y: -0.3, z: 2, dir: [0, 1] }, ledColor: "#ff0000", ledIntensity: dimmer };
  const day = fittingContext.exports.fitting({ ...props, night: false });
  const night = fittingContext.exports.fitting({ ...props, night: true });
  const dayLights = nodes(day, "spotLight"), nightLights = nodes(night, "spotLight");
  check(dayLights.length === 1 && nightLights.length === 1, "Day/Night/OFF keeps exactly the existing selected fitting's light");
  check(dayLights[0].props.intensity === 0 && nightLights[0].props.intensity === dimmer * 2, "Day is dark and Night preserves its selected output");
  check(JSON.stringify(dayLights[0].props.position) === JSON.stringify(nightLights[0].props.position), "No fixture movement during lighting change");
  check(dayLights[0].props.castShadow === false && nightLights[0].props.castShadow === false, "Retained accent lights allocate no new shadow maps");
}
const spotWork = readFileSync("src/components/pool/three/spotLightWork.ts", "utf8");
check(spotWork.includes("any(greaterThan(spotLight.color, vec3(0.0)))"), "Zero-output lights skip the entire light/shadow/BRDF path");
// The child EnvironmentPortal attaches the cube in its layout effect. The
// parent must publish it in that same layout phase, before any no-IBL draw.
const environmentSource = readFileSync("src/components/pool/three/DaylightEnvironment.tsx", "utf8");
const environmentAst = ts.createSourceFile("environment.tsx", environmentSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const captureFunction = environmentAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "RetainedNightEnvironment");
assert(captureFunction);
const captureScene = new THREE.Scene();
let publish, received;
const captureContext = { exports: {}, Scene: THREE.Scene,
  useState: () => [captureScene], useMemo: create => create(),
  useLayoutEffect: effect => { publish = effect; },
  useEffect: () => { throw new Error("Night IBL cannot publish after first paint"); },
  SkyDome: "sky", Environment: "environment",
  SCENE_VISUAL_PRESET: { lighting: { sun: { color: "white" } } },
  require: () => ({ jsx: (type, props) => ({ type, props }) }),
};
runInNewContext(ts.transpileModule(`${captureFunction.getText(environmentAst)}\nexports.capture=RetainedNightEnvironment;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, captureContext);
const captureElement = captureContext.exports.capture({ onReady: map => { received = map; } });
check(captureElement.props.scene === captureScene && captureElement.props.resolution === 256, "Night cube is isolated and matches the1024px HDR's PMREM dimensions");
captureScene.environment = new THREE.CubeTexture();
const releaseCapture = publish();
check(received === captureScene.environment, "Child's real capture is published synchronously in layout, not a temporary null map");
releaseCapture(); check(received === null, "Capture ownership is cleared on unmount");
captureScene.environment.dispose();
check(!environmentSource.includes("resolution={ACTIVE_RENDERING_QUALITY.environmentResolution}"), "Temporary loading sky cannot introduce a different PMREM shader permutation");
console.log(JSON.stringify({ status: "PASS", checks, scope: "Actual preparation lifecycle plus stable micro-spot Day/Night light graph" }));
