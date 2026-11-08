import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(process.cwd() + '/package.json'), ts = require('typescript'), T = require('three');
const file = 'src/components/pool/three/PhotoModeRenderer.tsx';
const tree = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const effects = [];
const walk = node => {
  if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect') effects.push(node.arguments[0]);
  ts.forEachChild(node, walk);
};
walk(tree);
const setup = effects.find(node => node.getText(tree).includes('const previousEnvironment ='));
const watch = effects.find(node => node.getText(tree).includes('watchPhotoContext'));
assert(setup && watch, 'exercise actual setup and native-context hooks');
const compile = source => ts.transpileModule(source.replaceAll('import.meta.env.DEV', 'false'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const { watchPhotoContext } = vm.runInNewContext(compile(readFileSync('src/components/pool/three/photoContextGuard.ts', 'utf8')) + ';exports;', { exports: {}, console });
const run = (node, context) => vm.runInContext(compile('(' + node.getText(tree) + ')'), context)();
const ref = current => ({ current });
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture({ cancelRejects = false } = {}) {
  const state = { active: false, samples: 27, preparing: false, contextLost: false, exportRequestId: 9, contextRestoreRequestId: 0 };
  const events = [], warnings = [], errors = [], hdrLoads = [], installations = [];
  const counts = { workerDispose: 0, resources: 0, unsupported: 0, restored: 0, hdrDispose: 0, hdrReset: 0, environment: 0 };
  const scene = new T.Scene(), camera = new T.PerspectiveCamera();
  const liveEnvironment = new T.Texture(), liveBackground = new T.Texture();
  scene.environment = liveEnvironment; scene.background = liveBackground;
  const originalMaterial = new T.MeshPhysicalMaterial(), geometry = new T.PlaneGeometry();
  const water = new T.Mesh(geometry, originalMaterial); scene.add(water);
  const excluded = new T.Object3D(); excluded.name = 'excluded-test'; scene.add(excluded);
  const canvas = new EventTarget(); canvas.dataset = {};
  let lost = false, completed = false, resolveBuild, rejectBuild;
  const build = new Promise((resolve, reject) => {
    resolveBuild = () => { completed = true; events.push('build-resolve'); resolve(); };
    rejectBuild = error => { completed = true; events.push('build-reject'); reject(error); };
  });
  const worker = { disposed: false, dispose() {
    if (this.disposed) return;
    this.disposed = true; counts.workerDispose++; events.push('worker-dispose');
    if (cancelRejects && !completed) rejectBuild(new DOMException('cancelled', 'AbortError'));
  } };
  let tracer;
  class Tracer {
    constructor() { tracer = this; events.push('constructor'); this.renderToCanvasCallback = () => {}; }
    setBVHWorker(value) { assert.equal(value, worker); }
    setSceneAsync(actualScene, actualCamera) {
      assert.equal(actualScene, scene); assert.equal(actualCamera, camera);
      events.push('build-start'); return build;
    }
    updateEnvironment() { counts.environment++; }
    dispose() { events.push('tracer-dispose'); }
  }
  class Gradient extends T.Texture {
    topColor = new T.Color(); bottomColor = new T.Color(); update() {}
  }
  const hdr = { dispose() { counts.hdrDispose++; }, reset() { counts.hdrReset++; } };
  const context = vm.createContext({
    THREE: T, scene, camera, gl: { domElement: canvas, capabilities: { isWebGL2: true },
      getContext: () => ({ isContextLost: () => lost }), forceContextRestore() {},
      getDrawingBufferSize: vector => vector.set(800, 600) },
    theme: 'light', quality: 'high', environmentRotation: 0, environmentUrl: '/test.hdr',
    indoor: false, filterOutput: true, denoiseExport: true, refractedSun: true,
    waterMedium: { outline: [[0, 0], [4, 0], [4, 2]], waterY: 0, bottomY: -1 }, ledTransportWaterY: 0,
    photoFrame: { camera, sync() {} },
    GRADIENT_PALETTE: { light: { zenith: '#ffffff', horizon: '#999999' } }, GradientEquirectTexture: Gradient,
    PHOTO_MODE_EXCLUDED_NAMES: new Set(['excluded-test']),
    PHOTO_MODE_QUALITY_PRESETS: { high: { bounces: 10, transmissiveBounces: 10, renderScale: 1 } },
    WATER_VISUAL_PRESET: { normals: { large: { strength: 1 }, micro: { strength: 1 } } },
    PHOTO_MODE_RIPPLE_BAKE_GAIN: 30, PHOTO_MODE_WATER_NORMAL_REPEAT: 0.635,
    createDualRippleNormalMap: () => new T.Texture(), preparePhotoWaterMedium: value => value,
    isWaterSurfaceMaterial: material => material === originalMaterial,
    createPhotoModeWaterMaterial: () => new T.MeshPhysicalMaterial(),
    WebGLPathTracer: Tracer, createPhotoBvhWorker: () => worker,
    ownPhotoTracerResources: () => ({ dispose(restore) { counts.resources++; restore(); tracer.dispose(); return Promise.resolve(); } }),
    renderPhotoRasterFallback() {}, CATALOGUE_GARDEN: { rotation: 0, sun: [1, 2, 3], url: '/test.hdr' },
    prepareRefractedSun: () => ({ environmentSun: true, toSun: [0, 1, 0], bakeMs: 0,
      field: { resolution: 1 }, gain: { minGain: 1, maxGain: 1, targetFlux: 1, encodedFlux: 1 } }),
    projectPhotoWaterPreservation: () => [], HDRI_BY_THEME: { light: '/test.hdr' },
    HDRLoader: class { load(url, onLoad) { hdrLoads.push(onLoad); events.push('hdr-load'); } },
    photoModeState: state, tracerRef: ref(null), buildWorkerRef: ref(null), hdrExportRef: ref(null),
    contextWatch: ref(null), lastHandledExportId: ref(0), lastMaterialRevision: ref(0), getPhotoMaterialRevision: () => 0,
    lastCameraMatrix: ref(new T.Matrix4()), lastProjectionMatrix: ref(new T.Matrix4()),
    lastBufferSize: ref(new T.Vector2()), bufferSize: ref(new T.Vector2()),
    watchPhotoContext, onContextRestored: () => { counts.restored++; },
    onUnsupported: () => { counts.unsupported++; }, performance,
    console: { error: (...args) => errors.push(args), warn: (...args) => warnings.push(args), debug() {} },
  });
  for (const [name, label] of [['installPhotoLedTransport', 'led'], ['installPhotoWaterMedium', 'water'],
    ['installRefractedSun', 'sun'], ['installPhotoOutputFilter', 'filter']]) {
    context[name] = actualTracer => {
      installations.push({ actualTracer, published: context.tracerRef.current, completed });
      events.push(label); return () => events.push('dispose-' + label);
    };
  }
  context.installPhotoHDRExport = actualTracer => {
    installations.push({ actualTracer, published: context.tracerRef.current, completed });
    events.push('hdr-install'); return hdr;
  };
  const watchCleanup = run(watch, context), setupCleanup = run(setup, context);
  assert.equal(typeof setupCleanup, 'function', 'React receives synchronous cleanup while build is pending');
  return { state, context, counts, events, errors, warnings, installations, scene, water, originalMaterial, excluded,
    liveEnvironment, liveBackground, hdrLoads, hdr, worker, resolveBuild, rejectBuild,
    get tracer() { return tracer; },
    lose() { lost = true; canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })); },
    stop() { watchCleanup(); setupCleanup(); },
  };
}
function assertRestored(f) {
  assert.equal(f.water.material, f.originalMaterial); assert.equal(f.excluded.visible, true);
  assert.equal(f.scene.environment, f.liveEnvironment); assert.equal(f.scene.background, f.liveBackground);
  assert.equal(f.counts.resources, 1); assert.equal(f.counts.workerDispose, 1);
}
function replaceWithNewOwner(f) {
  const newTracer = {}, newWorker = {}, newHDR = { dispose() { assert.fail('old job disposed new HDR owner'); } };
  const environment = new T.Texture(), background = new T.Texture();
  f.context.tracerRef.current = newTracer; f.context.buildWorkerRef.current = newWorker; f.context.hdrExportRef.current = newHDR;
  f.scene.environment = environment; f.scene.background = background;
  Object.assign(f.state, { active: true, samples: 321, preparing: true, contextLost: false, exportRequestId: 77 });
  const state = { ...f.state };
  return () => {
    assert.equal(f.context.tracerRef.current, newTracer); assert.equal(f.context.buildWorkerRef.current, newWorker);
    assert.equal(f.context.hdrExportRef.current, newHDR); assert.equal(f.scene.environment, environment);
    assert.equal(f.scene.background, background); assert.deepEqual(f.state, state);
  };
}
const passed = [], unhandled = [];
const observeUnhandled = error => unhandled.push(error);
process.on('unhandledRejection', observeUnhandled);

{
  const f = fixture();
  assert.equal(f.context.tracerRef.current, null); assert.equal(f.state.preparing, true); assert.equal(f.state.samples, 0);
  assert.deepEqual(f.events, ['constructor', 'build-start']); assert.equal(f.hdrLoads.length, 0);
  f.resolveBuild(); await settle();
  assert.deepEqual(f.events.slice(3), ['worker-dispose', 'led', 'water', 'sun', 'filter', 'hdr-install', 'hdr-load']);
  assert.equal(f.installations.length, 5);
  for (const install of f.installations) {
    assert.equal(install.actualTracer, f.tracer); assert.equal(install.published, null, 'publish only after all adapters');
    assert.equal(install.completed, true);
  }
  assert.equal(f.context.tracerRef.current, f.tracer); assert.equal(f.context.buildWorkerRef.current, null);
  assert.equal(f.context.hdrExportRef.current, f.hdr); assert.equal(f.state.preparing, false);
  assert.equal(f.state.active, true); assert.equal(f.context.lastHandledExportId.current, 9);
  const texture = new T.Texture(); f.hdrLoads[0](texture);
  assert.equal(f.scene.environment, texture); assert.equal(f.counts.environment, 1);
  assert.equal(f.counts.unsupported, 0); f.stop(); assertRestored(f);
  passed.push('success publishes only after await and adapters');
}
for (const outcome of ['resolve', 'reject']) {
  const f = fixture(); f.stop(); assertRestored(f);
  const unchanged = replaceWithNewOwner(f);
  if (outcome === 'resolve') f.resolveBuild(); else f.rejectBuild(new Error('late failure'));
  await settle(); unchanged();
  assert.equal(f.hdrLoads.length, 0); assert.equal(f.counts.unsupported, 0); assert.equal(f.counts.resources, 1);
  assert.equal(f.errors.length, 0); assert(!f.events.includes('led'));
  passed.push('unmount then late ' + outcome + ' preserves next owner');
}
{
  const f = fixture({ cancelRejects: true }); f.lose(); await settle();
  assertRestored(f); assert.equal(f.state.contextLost, true); assert.equal(f.state.samples, 0);
  assert.equal(f.state.preparing, false); assert.equal(f.context.tracerRef.current, null);
  assert.equal(f.context.buildWorkerRef.current, null); assert.equal(f.counts.unsupported, 0);
  assert.equal(f.hdrLoads.length, 0); assert.equal(f.errors.length, 0);
  f.lose(); assert.equal(f.counts.workerDispose, 1); f.stop(); assert.equal(f.counts.resources, 1);
  passed.push('native context loss cancels await and remains paused');
}
{
  const f = fixture(); f.rejectBuild(new Error('controlled BVH failure')); await settle();
  assertRestored(f); assert.equal(f.state.preparing, false); assert.equal(f.context.tracerRef.current, null);
  assert.equal(f.counts.unsupported, 1); assert.equal(f.errors.length, 1); assert.equal(f.hdrLoads.length, 0);
  f.stop(); assert.equal(f.counts.unsupported, 1); assert.equal(f.counts.resources, 1);
  passed.push('setup failure releases once and reports unsupported once');
}
{
  const f = fixture(); f.resolveBuild(); await settle();
  const deliverHDR = f.hdrLoads[0]; f.stop(); assertRestored(f);
  const unchanged = replaceWithNewOwner(f), lateTexture = new T.Texture(); let disposed = 0;
  lateTexture.addEventListener('dispose', () => { disposed++; }); deliverHDR(lateTexture); await settle();
  unchanged(); assert.equal(disposed, 1); assert.equal(f.counts.environment, 0);
  assert.equal(f.counts.hdrDispose, 1);
  passed.push('late HDR response after unmount cannot alter next owner');
}
await settle(); process.removeListener('unhandledRejection', observeUnhandled);
assert.deepEqual(unhandled, []);
console.log(JSON.stringify({ status: 'PASS', cases: passed, scope: 'Actual PhotoModeRenderer setup and context-loss effect callbacks, deferred scene promise and controlled expensive/GPU collaborators; native rendering acceptance separate.' }));
