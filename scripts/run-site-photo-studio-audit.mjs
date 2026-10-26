import { build } from "rolldown";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PerspectiveCamera, Quaternion, Vector2, Vector3 } from "three";
const output = "/tmp/pool-site-photo-studio-audit.mjs";
await build({
  input: "scripts/site-photo-studio-audit.ts",
  platform: "node",
  output: { file: output, format: "esm" },
});
await import(pathToFileURL(output).href + `?audit=${Date.now()}`);
const path = "src/components/pool/three/SitePhotoCameraRig.tsx";
const source = ts.createSourceFile(
  path,
  readFileSync(path, "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const fn = source.statements.find(
  (n) => ts.isFunctionDeclaration(n) && n.name?.text === "SitePhotoCameraRig",
);
assert(fn);
const camera = new PerspectiveCamera();
const base = new PerspectiveCamera(50, 1400 / 900, 0.01, 2000);
base.position.set(12, 10, 16);
base.lookAt(0, 0, 0);
base.updateMatrixWorld(true);
let exportedResolution;
let dpr = 2,
  dimensions = [350, 225];
const state = {
  camera,
  scene: {},
  size: { width: 700, height: 450 },
  gl: {
    getSize: (target) => target.set(350, 225),
    getPixelRatio: () => 2,
    setPixelRatio: (value) => {
      dpr = value;
    },
    setSize: (w, h) => {
      dimensions = [w, h];
    },
    render: () => {},
    domElement: {
      toDataURL: () => {
        exportedResolution = [...dimensions, dpr];
        return "data:image/png;base64,fixture";
      },
    },
  },
};
let active = false,
  frame,
  slot = 0,
  refs = [],
  dependencies = [],
  effects = 0,
  captures = [],
  ready = [];
const mount = runInNewContext(
  ts.transpileModule(fn.getText(source).replace(/^export /, "") + "; SitePhotoCameraRig;", {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    PerspectiveCamera,
    Quaternion,
    Vector3,
    Vector2,
    useThree: () => state,
    useProgress: (f) => f({ active }),
    useRef: (initial) => refs[slot++] ?? (refs[slot - 1] = { current: initial }),
    useLayoutEffect: (effect, deps) => {
      if (deps.some((d, i) => d !== dependencies[i])) {
        dependencies = deps;
        effects++;
        effect();
      }
    },
    useFrame: (f) => {
      frame = f;
    },
  },
);
let view = {
  camera: {
    position: base.position.toArray(),
    quaternion: base.quaternion.toArray(),
    verticalFov: 50,
    aspect: 1400 / 900,
    maxErrorPixels: 0,
  },
  offsetX: 0,
  offsetZ: 0,
  rotation: 0,
  exportRequest: 0,
  exportWidth: 1400,
  exportHeight: 900,
  onReady: (value) => ready.push(value),
  onCapture: (value) => captures.push(value),
};
const render = () => {
  slot = 0;
  mount({ view: { ...view } });
};
render();
const initialEffects = effects;
render();
assert.equal(effects, initialEffects, "New view wrapper must not reset readiness");
active = true;
render();
for (let i = 0; i < 10; i++) frame({}, 0.1);
assert(!ready.includes(true));
active = false;
render();
for (let i = 0; i < 7; i++) frame({}, 0.1);
assert.equal(ready.at(-1), true);
view.exportRequest = 1;
render();
frame({}, 0.1);
frame({}, 0.1);
assert.equal(captures.length, 1, "Exactly one capture per request");
for (const [offsetX, offsetZ] of [
  [0, 0],
  [1.5, -0.5],
  [-3, 2],
])
  for (const rotation of [0, 20, -90, 180]) {
    view = { ...view, offsetX, offsetZ, rotation };
    render();
    const turn = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      (rotation * Math.PI) / 180,
    );
    for (const p of [
      new Vector3(-5, 0, -2.25),
      new Vector3(5, 0, 2.25),
      new Vector3(0, 1.2, 0),
      new Vector3(1, -1.5, -1),
    ]) {
      const expected = p
        .clone()
        .applyQuaternion(turn)
        .add(new Vector3(offsetX, 0, offsetZ))
        .project(base);
      assert(
        p.clone().project(camera).distanceTo(expected) < 1e-10,
        "Placement must preserve 3D projective geometry",
      );
    }
  }
state.size = { width: 319, height: 204 };
render();
assert.equal(camera.aspect, base.aspect);
view.exportRequest = 2;
render();
state.gl.domElement.toDataURL = () => {
  throw new Error("context lost");
};
for (let i = 0; i < 7; i++) frame({}, 0.1);
assert.equal(captures.at(-1), null);
refs = [];
dependencies = [];
view.exportRequest = 0;
render();
const before = captures.length;
for (let i = 0; i < 7; i++) frame({}, 0.1);
assert.equal(captures.length, before, "Remounted preview with reset request does not export");
console.log(
  "Site photo rig PASS: 12 placements / 48 projected points, stable rerenders, asset readiness, resize, capture-once and failure recovery. Hooks simulated; no GPU claim.",
);

assert.equal(dpr, 2);
assert.deepEqual(dimensions, [350, 225], "Restore preview renderer size after capture failure");

assert.deepEqual(
  exportedResolution,
  [1400, 900, 1],
  "Capture at source photo resolution regardless of viewport",
);
