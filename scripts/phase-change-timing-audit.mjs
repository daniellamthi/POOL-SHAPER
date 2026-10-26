import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

const require = createRequire(resolve("package.json"));
const ts = require("typescript");
let checks = 0;
const check = (value, message) => {
  assert(value, message);
  checks++;
};
const equal = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks++;
};
const parse = (path) => {
  const text = readFileSync(path, "utf8");
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
};
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
const scene = parse("src/components/pool/three/PoolScene.tsx");
const adaptive = scene.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "AdaptiveQuality",
);
const rig = scene.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "CameraRig",
);
assert(adaptive && rig);
let movement;
const visit = (node) => {
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(scene) === "useFrame" &&
    node.arguments[0]?.getText(scene).includes("const moving = flying.current")
  )
    movement = node;
  ts.forEachChild(node, visit);
};
visit(rig);
assert(movement);

function pipeline({ width, height, ceiling, motion, legacy = false, locked = false }) {
  const callbacks = [],
    allocations = [];
  let ratio = ceiling;
  const state = {
    size: { width, height },
    gl: { domElement: { closest: () => ({}) }, getPixelRatio: () => ratio },
    setDpr: (value) => {
      ratio = value;
      allocations.push(value);
    },
  };
  const sandbox = {
    Math,
    cameraLocked: locked,
    photoMode: false,
    ACTIVE_RENDERING_QUALITY: { dpr: [1, ceiling] },
    RENDER_QUALITY_IDLE_DELAY: 0.3,
    renderQualityState: { idle: true },
    idleElapsed: { current: 0 },
    flying: { current: motion === "flight" },
    interacting: { current: motion === "drag" },
    useThree: (selector) => selector(state),
    useRef: (value) => ({ current: value }),
    useEffect: () => {},
    useFrame: (callback, priority = 0) => callbacks.push({ callback, priority }),
  };
  // Same mount order as the real Canvas: AdaptiveQuality precedes CameraRig.
  if (!locked) runInNewContext(compile(`${adaptive.getText(scene)}\nAdaptiveQuality();`), sandbox);
  const call = legacy
    ? `useFrame(${movement.arguments[0].getText(scene)}, 0)`
    : movement.getText(scene);
  runInNewContext(compile(call), sandbox);
  callbacks.sort((a, b) => a.priority - b.priority);
  const frame = (delta) => callbacks.forEach(({ callback }) => callback({}, delta));
  frame(1 / 60);
  return { sandbox, allocations, frame, ratio: () => ratio };
}

for (const [width, height] of [
  [1440, 900],
  [390, 844],
  [430, 932],
]) {
  for (const ceiling of [1.5, 2]) {
    for (const motion of ["flight", "drag"]) {
      const args = { width, height, ceiling, motion };
      const idleRatio = Math.min(ceiling, Math.max(0.85, Math.sqrt(2560000 / (width * height))));
      const before = pipeline({ ...args, legacy: true });
      equal(
        before.ratio(),
        idleRatio,
        "Old ordering renders the first moving frame at idle resolution",
      );
      const after = pipeline(args);
      equal(after.ratio(), 1, "First moving frame immediately uses the existing interactive DPR");
      check(
        after.ratio() < before.ratio(),
        "Regression would fail with the original callback ordering",
      );
      after.sandbox.flying.current = false;
      after.sandbox.interacting.current = false;
      after.frame(0.1);
      equal(after.ratio(), 1, "Retain the existing idle debounce");
      after.frame(0.21);
      equal(after.ratio(), idleRatio, "Restore exactly the original settled image resolution");
      const count = after.allocations.length;
      for (let i = 0; i < 5; i++) after.frame(1 / 60);
      equal(
        after.allocations.length,
        count,
        "Unchanged idle frames do not resize buffers repeatedly",
      );
      const locked = pipeline({ ...args, locked: true });
      equal(locked.ratio(), ceiling, "Locked/export rendering retains its original resolution");
    }
  }
}

const layout = parse("src/components/pool/PoolConfigurator.tsx");
const component = layout.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "ConfiguratorLayout",
);
assert(component?.body);
const effects = component.body.statements.flatMap((statement) => {
  if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) return [];
  const call = statement.expression;
  if (!["useEffect", "useLayoutEffect"].includes(call.expression.getText(layout))) return [];
  const callback = call.arguments[0]?.getText(layout) ?? "";
  return callback.includes("setInspectionView(null)") ||
    callback.includes('activeStepId === "deck"') ||
    callback.includes('activeStepId === "system"')
    ? [call.getText(layout)]
    : [];
});
equal(effects.length, 3, "Exercise the actual cleanup, system and deck effects");
for (const id of ["coping", "paving"]) {
  const pending = { layout: [], passive: [] };
  let view = "features",
    reframes = 0;
  const sandbox = {
    step: 8,
    visualFocus: null,
    activeStepId: "deck",
    decision: { id },
    config: { system: "skimmer", overflowType: "hidden" },
    setInspectionView: (value) => {
      view = value;
    },
    reframe: () => {
      reframes++;
    },
    useLayoutEffect: (callback) => pending.layout.push(callback),
    useEffect: (callback) => pending.passive.push(callback),
  };
  runInNewContext(compile(effects.join(";\n")), sandbox);
  pending.layout.forEach((callback) => callback());
  equal(view, id, "First paint already receives the final deck inspection target");
  equal(reframes, 1, "Request the deck framing once before paint");
  pending.passive.forEach((callback) => callback());
  equal(view, id, "Passive effects do not replace the final target");
  equal(reframes, 1, "No delayed second deck reframe");
}
console.log(
  JSON.stringify(
    {
      status: "PASS",
      checks,
      scope:
        "Actual phase effects and first-frame adaptive DPR ordering; browser/GPU timing requires separate evidence.",
    },
    null,
    2,
  ),
);
