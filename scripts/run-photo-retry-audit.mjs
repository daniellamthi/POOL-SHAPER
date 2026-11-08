import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

// Run from the repository root. Execute the source callbacks with real Three
// cameras; this isolates DOM retry and effect ordering from native GPU QA.
const require = createRequire(process.cwd() + '/package.json');
const ts = require('typescript'), T = require('three');
const parse = file => ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const viewport = parse('src/components/pool/PoolViewport.tsx');
const scene = parse('src/components/pool/three/PoolScene.tsx');
const nodes = (root, predicate) => {
  const found = [];
  const visit = node => { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); };
  visit(root);
  return found;
};
const variable = (root, name) => {
  const found = nodes(root, n => ts.isVariableDeclaration(n) && n.name.getText() === name);
  assert.equal(found.length, 1, `unique source variable ${name}`);
  return found[0].initializer;
};
const fn = (root, name) => nodes(root, n => ts.isFunctionDeclaration(n) && n.name?.text === name)[0];
const compile = source => ts.transpileModule(source.replaceAll('import.meta.env.DEV', 'false'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;
const evaluate = (node, context) => vm.runInContext(compile('(' + node.getText() + ')'), context);
const attr = (node, name) => node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText() === name);
const jsx = (root, tag) => nodes(root, n => (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText() === tag);
const keyedScene = jsx(viewport, 'PoolScene').find(n => attr(n, 'key'));
assert(keyedScene, 'retry must key the real PoolScene');
const status = jsx(viewport, 'PhotoModeStatus')[0];
const retryButton = jsx(fn(viewport, 'PhotoModeStatus'), 'Button').find(n => attr(n, 'onClick'));
assert(status && retryButton);
const rig = fn(scene, 'CameraRig');
const layouts = nodes(rig, n => ts.isCallExpression(n) && n.expression.getText() === 'useLayoutEffect');
const poseHook = layouts.find(n => n.arguments[0].getText().includes('canvas.dataset["cameraProjection"]'));
const recoveryHook = layouts.find(n => n.arguments[0].getText().includes('recovery.capture = capture'));
const flight = nodes(rig, n => ts.isCallExpression(n) && n.expression.getText() === 'useFrame')
  .find(n => n.arguments[0].getText().includes('if (!flying.current) return'));
const planHook = nodes(fn(scene, 'PlanCamera'), n => ts.isCallExpression(n) && n.expression.getText() === 'useLayoutEffect')[0];
assert(poseHook && recoveryHook && flight && planHook);
assert(layouts.indexOf(poseHook) < layouts.indexOf(recoveryHook), 'restore must follow normal camera pose initialization');

const ref = current => ({ current });
const limits = {
  minAzimuthAngle: -0.83, maxAzimuthAngle: 0.91,
  minPolarAngle: 0.21, maxPolarAngle: 1.41, minDistance: 1.17, maxDistance: 41.8,
};
const cameraState = camera => ({
  type: camera.type, position: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
  up: camera.up.toArray(), scale: camera.scale.toArray(), zoom: camera.zoom,
  matrixWorld: camera.matrixWorld.toArray(), projection: camera.projectionMatrix.toArray(),
  projectionInverse: camera.projectionMatrixInverse.toArray(),
  lens: ['fov', 'aspect', 'near', 'far', 'filmGauge', 'filmOffset', 'focus', 'left', 'right', 'top', 'bottom']
    .map(key => [key, camera[key]]), view: JSON.parse(JSON.stringify(camera.view)),
});
const assertCamera = (camera, expected, message) => assert.deepEqual(cameraState(camera), cameraState(expected), message);
const makeCamera = type => type === 'orthographic'
  ? new T.OrthographicCamera(-9, 11, 7, -6, 0.13, 700)
  : new T.PerspectiveCamera(46, 1.71, 0.16, 850);

function makeRig(camera, bridge) {
  const context = vm.createContext({
    camera, cameraRecovery: bridge, controls: ref(null), useRef: ref,
    PerspectiveCamera: T.PerspectiveCamera, OrthographicCamera: T.OrthographicCamera,
    canvas: { dataset: {} }, viewportSize: { width: 1200, height: 800 },
    visibleFrame: { left: 30, top: 40, width: 980, height: 690 },
    goal: ref(new T.Vector3()), lookAt: ref(new T.Vector3()),
    startPosition: ref(new T.Vector3()), startTarget: ref(new T.Vector3()),
    navigationLimits: ref(null), flying: ref(false), elapsed: ref(0), duration: ref(1),
    planFit: ref(null), localFraming: false, opticalDetail: false, coastalHero: false,
    cameraLocked: false, infinityZone: null, focus: 'review', detail: false,
    frameToken: 0, radius: 6, layout: { waterY: 0 }, photoMode: true,
    renderQualityState: { locked: false, idle: false },
    SCENE_VISUAL_PRESET: { camera: { fov: 34 } },
    window: { matchMedia: () => ({ matches: false }) },
  });
  function setCamera(next) {
    context.camera = next;
    context.controls.current = {
      ...limits, target: new T.Vector3(), enableDamping: false,
      update() { context.camera.lookAt(this.target); context.camera.updateMatrixWorld(true); },
    };
  }
  setCamera(camera);
  const setPose = (position, target, focus = 'review', fov = 34) => {
    context.pose = { position, target, fov };
    context.poseKey = JSON.stringify(context.pose);
    context.focus = focus;
  };
  setPose([12, 9, 14], [0, 0, 0]);
  context.recoveryOnMount = evaluate(variable(rig, 'recoveryOnMount'), context);
  const hooks = [poseHook, recoveryHook].map(node => ({ node, deps: null, cleanup: null }));
  const commit = (replay = false) => {
    if (replay) hooks.forEach(hook => hook.cleanup?.());
    for (const hook of hooks) {
      const deps = evaluate(hook.node.arguments[1], context);
      if (replay || !hook.deps || deps.some((value, i) => !Object.is(value, hook.deps[i]))) {
        if (!replay) hook.cleanup?.();
        hook.cleanup = evaluate(hook.node.arguments[0], context)();
        hook.deps = Array.from(deps);
      }
    }
  };
  return {
    context, setCamera, setPose, commit,
    frame: () => evaluate(flight.arguments[0], context)({}, 1 / 60),
    cleanup: () => hooks.forEach(hook => hook.cleanup?.()),
    recoveryCleanup: () => hooks[1].cleanup,
  };
}

function viewportActions(bridge) {
  const config = { focus: 'review', photoMode: true, photoModeQuality: 'high', outline: [[0, 0], [8, 0], [8, 4]],
    materials: { surface: { id: 'chosen' } }, sceneTime: 'night', length: 8, width: 4, features: ['bench'] };
  const context = vm.createContext({
    cameraRecovery: bridge, graphicsGeneration: 0, scene: config,
    samples: 0, preparing: true, contextLost: true,
    PoolScene: 'PoolScene', PhotoModeStatus: 'PhotoModeStatus',
    React: { createElement: (type, props) => ({ type, props }) },
  });
  context.setGraphicsGeneration = update => { context.graphicsGeneration = update(context.graphicsGeneration); };
  context.retryGraphics = evaluate(variable(viewport, 'retryGraphics'), context);
  context.onRetry = evaluate(attr(status, 'onRetry').initializer.expression, context);
  const click = evaluate(attr(retryButton, 'onClick').initializer.expression, context);
  return { context, click, element: () => evaluate(keyedScene, context) };
}

function manualPose(instance, type) {
  const c = instance.context.camera;
  const target = new T.Vector3(1.8, -0.3, 2.4);
  c.position.set(-6.25, 4.4, 12.6);
  c.up.set(0.05, 1, 0.02).normalize();
  c.lookAt(target);
  c.zoom = type === 'orthographic' ? 1.73 : 1.27;
  c.near = 0.19; c.far = 932;
  if (c instanceof T.PerspectiveCamera) { c.fov = 41.6; c.filmGauge = 38; c.filmOffset = 1.2; }
  c.setViewOffset(1600, 1000, 120, 75, 1250, 830);
  c.updateProjectionMatrix(); c.updateMatrixWorld(true);
  instance.context.controls.current.target.copy(target);
  Object.assign(instance.context.controls.current, limits);
  instance.context.flying.current = false;
  return { camera: c.clone(), target: target.clone() };
}

const results = [];
function test(name, run) {
  try { run(); results.push({ name, status: 'PASS' }); }
  catch (error) { results.push({ name, status: 'FAIL', error: error.stack }); }
}

for (const type of ['perspective', 'orthographic']) {
  test(`${type}: stopped-frame DOM retry, complete camera restore, cleanup and StrictMode replay`, () => {
    const bridge = ref({ capture: null, pending: null });
    const old = makeRig(makeCamera(type), bridge); old.commit();
    const expected = manualPose(old, type);
    const ui = viewportActions(bridge), before = ui.element();
    // No frame callback is invoked anywhere between loss, click and remount.
    ui.click();
    const pending = bridge.current.pending, after = ui.element();
    assert.equal(after.props.key, before.props.key + 1, 'DOM retry advances mounted scene identity without a frame');
    const { key: beforeKey, ...beforeProps } = before.props;
    const { key: afterKey, ...afterProps } = after.props;
    assert.deepEqual(afterProps, beforeProps, 'every selected scene prop survives recovery');
    assert.equal(after.props.cameraRecovery, bridge);
    assert(pending); assert.notEqual(pending.camera, old.context.camera);
    assertCamera(pending.camera, expected.camera, 'capture preserves full optical state');
    old.context.camera.position.set(99, 99, 99);
    ui.click();
    assert.equal(bridge.current.pending, pending, 'rapid retries retain the original capture');
    const oldCleanup = old.recoveryCleanup();
    old.cleanup();
    assert.equal(bridge.current.capture, null, 'unmounted owner unregisters capture');
    assert.equal(bridge.current.pending, pending, 'old cleanup preserves queued camera');
    const fresh = makeRig(makeCamera(type), bridge); fresh.commit();
    assert.equal(bridge.current.pending, null, 'new matching camera consumes pending capture');
    assertCamera(fresh.context.camera, expected.camera, 'restore retains pose, zoom and complete projection');
    assert.deepEqual(fresh.context.controls.current.target.toArray(), expected.target.toArray());
    for (const [key, value] of Object.entries(limits)) assert.equal(fresh.context.controls.current[key], value, key);
    assert.deepEqual({ ...fresh.context.navigationLimits.current }, limits);
    assert.equal(fresh.context.flying.current, false, 'first Photo Mode frame cannot snap to preset');
    const newReader = bridge.current.capture;
    oldCleanup();
    assert.equal(bridge.current.capture, newReader, 'late old cleanup does not erase current reader');
    fresh.frame();
    assertCamera(fresh.context.camera, expected.camera, 'first frame preserves restored pose');
    fresh.commit(true);
    assertCamera(fresh.context.camera, expected.camera, 'StrictMode effect replay restores the initial snapshot');
    fresh.frame();
    assertCamera(fresh.context.camera, expected.camera, 'replay must also stop camera flight');
    const currentCapture = bridge.current.capture();
    assertCamera(currentCapture.camera, fresh.context.camera, 'reader belongs to fresh camera');
    bridge.current.pending = currentCapture;
    fresh.cleanup();
    assert.equal(bridge.current.capture, null);
    assert.equal(bridge.current.pending, currentCapture);
  });
}

test('later focus change runs normal camera initialization without restoring old retry snapshot', () => {
  const bridge = ref({ capture: null, pending: null });
  const old = makeRig(makeCamera('perspective'), bridge); old.commit(); manualPose(old, 'perspective');
  viewportActions(bridge).click(); old.cleanup();
  const fresh = makeRig(makeCamera('perspective'), bridge); fresh.commit();
  fresh.setPose([21, 5, 7], [2, 1, -1], 'access', 29);
  fresh.commit(); fresh.frame();
  assert.deepEqual(fresh.context.camera.position.toArray(), [21, 5, 7]);
  assert.deepEqual(fresh.context.controls.current.target.toArray(), [2, 1, -1]);
  assert.equal(fresh.context.camera.fov, 29);
  fresh.cleanup();
});

test('top view round trip does not reapply stale perspective snapshot', () => {
  const bridge = ref({ capture: null, pending: null });
  const old = makeRig(makeCamera('perspective'), bridge); old.commit(); manualPose(old, 'perspective');
  viewportActions(bridge).click(); old.cleanup();
  const fresh = makeRig(makeCamera('perspective'), bridge); fresh.commit();
  const perspective = fresh.context.camera;
  const plan = makeCamera('orthographic');
  const planContext = vm.createContext({ enabled: true, plan,
    get: () => ({ camera: fresh.context.camera }), set: ({ camera }) => fresh.setCamera(camera) });
  const exitTop = evaluate(planHook.arguments[0], planContext)();
  fresh.setPose([3, 30, 2], [3, 0, 2], 'top'); fresh.commit();
  exitTop();
  assert.equal(fresh.context.camera, perspective, 'actual PlanCamera cleanup restores same perspective object');
  fresh.setPose([25, 8, -4], [3, 0, 2], 'review', 37); fresh.commit(); fresh.frame();
  assert.deepEqual(fresh.context.camera.position.toArray(), [25, 8, -4], 'returning to perspective must follow newly selected focus');
  assert.deepEqual(fresh.context.controls.current.target.toArray(), [3, 0, 2]);
  assert.equal(fresh.context.camera.fov, 37);
  fresh.cleanup();
});

test('orthographic handoff waits for matching camera and supports effect replay after handoff', () => {
  const bridge = ref({ capture: null, pending: null });
  const old = makeRig(makeCamera('orthographic'), bridge); old.commit();
  const expected = manualPose(old, 'orthographic'); viewportActions(bridge).click(); old.cleanup();
  const pending = bridge.current.pending;
  const fresh = makeRig(makeCamera('perspective'), bridge); fresh.commit();
  assert.equal(bridge.current.pending, pending, 'initial perspective cannot consume orthographic snapshot');
  fresh.setCamera(makeCamera('orthographic'));
  fresh.setPose([0, 30, 0], [0, 0, 0], 'top'); fresh.commit();
  assertCamera(fresh.context.camera, expected.camera, 'matching camera consumes complete orthographic state');
  assert.equal(bridge.current.pending, null);
  fresh.commit(true);
  assertCamera(fresh.context.camera, expected.camera, 'replay after camera handoff preserves restored orthographic state');
  fresh.cleanup();
});

test('retry still remounts when no camera reader is registered', () => {
  const bridge = ref({ capture: null, pending: null }), ui = viewportActions(bridge);
  ui.click(); assert.equal(ui.element().props.key, 1); assert.equal(bridge.current.pending, null);
});

for (const result of results.filter(result => result.status === 'FAIL')) console.error(result.name + '\n' + result.error);
console.log(JSON.stringify({ status: results.every(result => result.status === 'PASS') ? 'PASS' : 'FAIL',
  scope: 'Actual DOM retry / JSX props / CameraRig layout and frame callbacks / PlanCamera lifecycle with real Three cameras; native GPU evidence separate.',
  tests: results.map(({ name, status }) => ({ name, status })) }, null, 2));
if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
