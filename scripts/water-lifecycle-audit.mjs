import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as THREE from "three";
import ts from "typescript";

// Execute the actual reflection hook with a deterministic hook/renderer stub.
// This checks resource ownership and pause/resume, not visual quality or FPS.
const water = readFileSync("src/components/pool/three/WaterSurfaceMaterial.tsx", "utf8");
const pool = readFileSync("src/components/pool/three/PoolModel.tsx", "utf8");
const ast = ts.createSourceFile("water.tsx", water, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const hook = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "useWaterReflection");
assert(hook);
const code = ts.transpileModule(`${hook.getText(ast)}\nexports.hook = useWaterReflection;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
let checks = 0;
const check = (value, message) => { assert(value, message); checks++; };
const hooks = [];
let cursor = 0, frames = [], pendingEffects = [], renderCount = 0, target = null;
const equal = (a, b) => a?.length === b?.length && a.every((value, index) => Object.is(value, b[index]));
const useMemo = (create, deps) => {
  const index = cursor++;
  if (!hooks[index] || !equal(deps, hooks[index].deps)) hooks[index] = { deps, value: create() };
  return hooks[index].value;
};
const useRef = value => useMemo(() => ({ current: value }), []);
const useEffect = (effect, deps) => {
  const index = cursor++;
  if (!hooks[index] || !equal(deps, hooks[index].deps)) {
    const previous = hooks[index];
    pendingEffects.push(() => {
      previous?.cleanup?.();
      hooks[index] = { deps, cleanup: effect() };
    });
  }
};
const scene = new THREE.Scene();
const basin = new THREE.Group(); basin.name = "pool-basin"; scene.add(basin);
const camera = new THREE.PerspectiveCamera(34, 1.6, 0.1, 100);
camera.position.set(3, 2, 5); camera.lookAt(0, -0.4, 0); camera.updateMatrixWorld(true);
const gl = {
  shadowMap: { autoUpdate: true }, xr: { enabled: true },
  getRenderTarget: () => target,
  setRenderTarget: value => { target = value; },
  clear: () => {}, render: () => { renderCount++; },
};
let disposals = 0;
class TrackedTarget extends THREE.WebGLRenderTarget {
  constructor(...args) {
    super(...args);
    this.addEventListener("dispose", () => { disposals++; });
  }
}
const context = {
  exports: {}, THREE: { ...THREE, WebGLRenderTarget: TrackedTarget }, useMemo, useRef, useEffect,
  useThree: () => ({ gl, scene, camera }), useFrame: callback => frames.push(callback),
  REFLECTION_ENABLED: true, REFLECTION_RESOLUTION: 64, REFLECTION_IDLE_RESOLUTION: 128,
  REFLECTION_FALLBACK_MARGIN: 0.22,
  photoModeState: { active: false }, renderQualityState: { idle: true },
  scratchForward: new THREE.Vector3(), scratchTargetPoint: new THREE.Vector3(),
  scratchMirroredTarget: new THREE.Vector3(), isWaterSurfaceMesh: () => false,
};
runInNewContext(code, context);
const render = (active, enabled = true) => {
  cursor = 0; frames = []; pendingEffects = [];
  const result = context.exports.hook(0, enabled, active);
  pendingEffects.forEach(effect => effect());
  return result;
};
const frame = elapsedTime => frames.forEach(callback => callback({ clock: { elapsedTime } }));
const initial = render(false);
frame(1);
check(renderCount === 0, "Inactive retained water never renders a reflection");
const shown = render(true);
check(shown.texture === initial.texture, "Activating does not allocate another target/texture");
frame(1);
check(renderCount === 1, "Activation renders a fresh reflection");
const resizeDisposals = disposals;
check(basin.visible && gl.shadowMap.autoUpdate && gl.xr.enabled && target === null, "Render restores scene and renderer state");
frame(1.001);
check(renderCount === 1, "Unchanged active reflection keeps its original refresh throttle");
const hidden = render(false);
frame(1.002);
check(hidden.texture === shown.texture && disposals === resizeDisposals, "Hiding retains resources without disposal");
check(renderCount === 1, "Hidden frames do not submit reflection work");
render(true); frame(1.003);
check(renderCount === 2, "Resume invalidates cached reflection even within refresh interval");
hooks.forEach(state => state.cleanup?.());
check(disposals === resizeDisposals + 1, "Actual unmount disposes retained target exactly once");

check(pool.includes("useState(showWater)") && pool.includes("if (showWater) setWaterPrepared(true)"), "Water is prepared lazily on first visible stage");
check(pool.includes("showWater || waterPrepared") && pool.includes("visible={showWater}") && pool.includes("active={showWater}"), "Retained water is hidden and paused in dry stages");
check(water.includes("active = true"), "Other existing water callers retain their default active behavior");
const materialFrame = water.slice(water.indexOf("const stillness = useRef(0)"));
check(materialFrame.indexOf("if (!active) return;") < materialFrame.indexOf("clock.getElapsedTime()"), "Inactive material skips per-frame uniform work");

hooks.length = 0;
const retainedCode = ts.transpileModule(readFileSync("src/components/pool/three/RetainedStageMaterial.tsx", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const retainedContext = { exports: {}, require: name => {
  if (name === "react") return { useMemo, useEffect };
  if (name === "three") return THREE;
  if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }) };
  throw new Error(`Unexpected dependency: ${name}`);
} };
runInNewContext(retainedCode, retainedContext);
const shader = () => {};
const props = { color: "#789abc", roughness: 0.71, onBeforeCompile: shader, customProgramCacheKey: () => "unchanged" };
const raw = { type: "raw-construction" };
function materialRender(construction, programKey = "wet") {
  cursor = 0; pendingEffects = [];
  const result = retainedContext.exports.RetainedStageMaterial({ raw: construction, programKey, children: { props } });
  pendingEffects.forEach(effect => effect());
  return result;
}
check(materialRender(raw) === raw, "Construction stage renders only its original raw material");
const finished = materialRender(null);
const owned = finished.props.object;
let materialDisposals = 0;
owned.addEventListener("dispose", () => { materialDisposals++; });
check(finished.type === "primitive" && finished.props.attach === "material", "Finished material occupies only the existing material slot");
check(Object.entries(props).every(([key, value]) => finished.props[key] === value), "All original material values and shader callbacks are forwarded unchanged");
check(materialRender(raw) === raw && materialDisposals === 0, "Returning to construction does not release the compiled finished material");
check(materialRender(null).props.object === owned, "Returning to finished view reuses the exact material instance");
const changed = materialRender(null, "wet-mosaic");
check(changed.props.object !== owned && materialDisposals === 1, "A real shader-variant change replaces and disposes the previous material");
let finalDisposals = 0;
changed.props.object.addEventListener("dispose", () => { finalDisposals++; });
hooks.forEach(state => state.cleanup?.());
check(finalDisposals === 1, "True unmount releases the final owned material");
check((pool.match(/<RetainedStageMaterial programKey=/g) ?? []).length === 4, "Access, comfort, walls and floor retain their distinct material owners");
console.log(JSON.stringify({ status: "PASS", checks, scope: "Actual reflection/material hook ownership, pause/resume and mount guards; GPU/browser QA separate" }));
