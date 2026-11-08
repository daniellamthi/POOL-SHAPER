import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const root = process.cwd();
const require = createRequire(root + '/package.json'), ts = require('typescript'), T = require('three');
const { WebGLPathTracer } = await import(pathToFileURL(root + '/node_modules/three-gpu-pathtracer/src/core/WebGLPathTracer.js'));
const { MaterialsTexture } = await import(pathToFileURL(root + '/node_modules/three-gpu-pathtracer/src/uniforms/MaterialsTexture.js'));
const source = path => ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const model = source('src/components/pool/three/PoolModel.tsx');
const photo = source('src/components/pool/three/PhotoModeRenderer.tsx');
const nodes = [];
function walk(node, tree) { nodes.push({ node, tree }); ts.forEachChild(node, child => walk(child, tree)); }
walk(model, model); walk(photo, photo);
const named = name => model.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name).getText(model);
const callback = (tree, hook, match) => nodes.find(p => p.tree === tree && ts.isCallExpression(p.node) && p.node.expression.getText(tree) === hook && p.node.arguments[0].getText(tree).includes(match)).node.arguments[0];
const mapsNode = callback(model, 'useMemo', 'const floorMap = calibratedSurfaceMap.clone()');
const signalNode = callback(model, 'useEffect', 'markPhotoMaterialsChanged');
const frameNode = callback(photo, 'useFrame', 'tracer.renderSample()');
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const ref = current => ({ current });
const signalScope = { exports: {} };
vm.runInNewContext(compile(readFileSync('src/lib/pool/photoModeState.ts', 'utf8')), signalScope);
const { getPhotoMaterialRevision, markPhotoMaterialsChanged } = signalScope.exports;
const hdrTree = source('src/components/pool/three/photoHDRExport.ts');
const hdrSource = hdrTree.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(hdrTree)).join('\n');
const hdrScope = { exports: {}, ...T, PHOTO_MODE_EXPORT_READY_SAMPLES: 190, console, setTimeout: () => 1, clearTimeout() {}, ArrayBuffer };
vm.runInNewContext(compile(hdrSource), hdrScope);
const { installPhotoHDRExport } = hdrScope.exports;

// Drive the real async loader hook and map memo, committing props before its
// actual passive notification. Only React scheduling, image I/O and GPU copies
// are controlled; the Three materials and tracer material packing are real.
function fixture({ loadedInitially = false, uploadInitially = true } = {}) {
  let state, index = 0, slots = [], stateChanges = 0, lastSource, maps;
  const loads = [], warnings = [], exports = [], scene = new T.Scene();
  const context = vm.createContext({
    THREE: { ...T, TextureLoader: class { load(url, success, progress, fail) { loads.push({ url, success, fail }); } } },
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {} }) }) },
    useState: initial => {
      if (!state) state = initial();
      return [state, next => { state = typeof next === 'function' ? next(state) : next; stateChanges++; }];
    },
    useEffect: (effect, deps) => {
      const i = index++, old = slots[i];
      if (old && deps.every((d, j) => d === old.deps[j])) return;
      old?.cleanup?.(); slots[i] = { deps, cleanup: effect() };
    },
    console: { warn: (...args) => warnings.push(args) },
    materials: { surface: { kind: 'liner', tileSize: .5 } },
    ACTIVE_RENDERING_QUALITY: { textureAnisotropy: 4 }, maxAnisotropy: 4, perimeter: 28.4, depth: 1.5,
    getSceneState: () => ({ scene }), markPhotoMaterialsChanged, getPhotoMaterialRevision, scene,
  });
  vm.runInContext(compile(named('createNeutralSurfaceTexture') + '\n' + named('useSafeSurfaceTexture')), context);
  const makeMaps = vm.runInContext(compile('(' + mapsNode.getText(model) + ')'), context);
  const markCommitted = vm.runInContext(compile('(' + signalNode.getText(model) + ')'), context);
  const floor = new T.MeshPhysicalMaterial(), wall = new T.MeshPhysicalMaterial();
  function commit() {
    index = 0;
    const texture = context.useSafeSurfaceTexture('/delayed.png', false);
    if (texture === lastSource) return;
    lastSource = texture; context.calibratedSurfaceMap = texture; maps = makeMaps();
    [floor.map, wall.map] = maps;
    markCommitted();
  }
  function finishLoad() {
    const loaded = new T.DataTexture(new Uint8Array([244, 243, 239, 255]), 1, 1, T.RGBAFormat);
    loaded.needsUpdate = true; loads[0].success(loaded); commit(); return loaded;
  }
  commit();
  if (loadedInitially) finishLoad();
  const copied = [], packed = new MaterialsTexture();
  const tracer = Object.create(WebGLPathTracer.prototype);
  Object.assign(tracer, {
    _materials: [floor, wall], _renderer: {}, textureSize: new T.Vector2(1024, 1024),
    _pathTracer: { samples: 0, material: { materials: packed, textures: {
      setTextures(renderer, textures) { copied.push(textures.map(t => t.source.uuid)); },
    } } },
    renderSample() { this._queueReset = false; this._pathTracer.samples++; },
    renderToCanvasCallback() {}, pausePathTracing: false,
  });
  if (uploadInitially) tracer.updateMaterials();
  const camera = new T.PerspectiveCamera(); camera.updateMatrixWorld();
  const watch = { isLost: () => false, stamp: () => 1, valid: stamp => stamp === 1 };
  Object.assign(context, {
    tracerRef: ref(tracer), camera, contextWatch: ref(watch), lastRestoreRequestId: ref(0),
    lastMaterialRevision: ref(getPhotoMaterialRevision(scene)),
    photoModeState: { contextRestoreRequestId: 0, exportRequestId: 0, samples: 0, preparing: false },
    gl: { getContext: () => ({ isContextLost: () => false }), getDrawingBufferSize: v => v.set(800, 600) },
    bufferSize: ref(new T.Vector2()), lastBufferSize: ref(new T.Vector2(800, 600)),
    lastCameraMatrix: ref(camera.matrixWorld.clone()), lastProjectionMatrix: ref(camera.projectionMatrix.clone()),
    lastHandledExportId: ref(0), hdrExportRef: ref(null), PHOTO_MODE_EXPORT_READY_SAMPLES: 190,
    exportCurrentFrame: (gl, current) => exports.push(current),
  });
  const frame = vm.runInContext(compile('(' + frameNode.getText(photo) + ')'), context);
  return { context, commit, finishLoad, loads, copied, tracer, floor, wall, scene, frame, warnings, exports,
    get stateChanges() { return stateChanges; }, dispose() { slots.forEach(s => s.cleanup?.()); } };
}
const frames = (f, count) => { for (let i = 0; i < count; i++) f.frame(); };

{
  const f = fixture({ loadedInitially: true }); frames(f, 250);
  assert.equal(f.copied.length, 1); assert.equal(f.copied[0][0], f.floor.map.source.uuid);
  assert.equal(f.tracer.samples, 250);
  console.log('PASS maps loaded before setup are uploaded once; unchanged frames never upload');
}
{
  const f = fixture(); frames(f, 215);
  const oldSource = f.copied[0][0], loaded = f.finishLoad();
  assert.notEqual(oldSource, loaded.source.uuid);
  assert.equal(f.copied.length, 1, 'passive signal does not upload during React commit');
  f.context.photoModeState.exportRequestId++;
  f.frame();
  assert.equal(f.copied.length, 2); assert.equal(f.copied[1][0], loaded.source.uuid);
  assert.equal(f.tracer.samples, 1); assert.equal(f.context.photoModeState.samples, 1);
  assert.equal(f.context.lastHandledExportId.current, 1); assert.equal(f.exports.length, 0);
  assert.equal(f.floor.map.source, f.wall.map.source);
  assert.equal(f.floor.map.colorSpace, T.SRGBColorSpace);
  assert.deepEqual(f.wall.map.repeat.toArray(), [56.8, 3]);
  frames(f, 250); assert.equal(f.copied.length, 2);
  console.log('PASS delayed actual loader/map commit refreshes actual tracer packing once before ready/export checks');
}
{
  const f = fixture({ uploadInitially: false });
  let resolveBuild;
  const build = new Promise(resolve => { resolveBuild = resolve; });
  f.tracer.setSceneAsync = () => build.then(() => f.tracer.updateMaterials());
  const text = photo.getFullText();
  const start = text.indexOf('const materialRevision = getPhotoMaterialRevision(scene);');
  const ending = 'lastMaterialRevision.current = materialRevision;';
  const end = text.indexOf(ending, start) + ending.length;
  assert(start >= 0 && end > start, 'exercise actual revision capture around await');
  const worker = { dispose() {} };
  Object.assign(f.context, { tracer: f.tracer, photoFrame: { camera: f.context.camera }, bvhWorker: worker,
    buildWorkerRef: ref(worker), cancelled: false, releaseTracer() { assert.fail('unexpected cancellation'); } });
  const task = vm.runInContext(compile('(async () => {' + text.slice(start, end) + '})()'), f.context);
  const loaded = f.finishLoad();
  resolveBuild(); await task;
  assert.equal(f.copied.length, 1);
  assert(f.context.lastMaterialRevision.current < getPhotoMaterialRevision(f.scene));
  f.frame(); assert.equal(f.copied.length, 2); assert.equal(f.copied.at(-1)[0], loaded.source.uuid);
  frames(f, 50); assert.equal(f.copied.length, 2);
  console.log('PASS map load during actual BVH-await revision window catches up once on first frame');
}
{
  const f = fixture(), other = fixture();
  markPhotoMaterialsChanged(other.scene); frames(f, 10); assert.equal(f.copied.length, 1);
  markPhotoMaterialsChanged(f.scene); markPhotoMaterialsChanged(f.scene);
  f.frame(); frames(f, 10); assert.equal(f.copied.length, 2);
  console.log('PASS independent Canvas revisions and coalesced commits avoid unrelated/repeated uploads');
}
{
  const f = fixture(); frames(f, 215);
  let terminated = 0;
  const worker = { postMessage() {}, terminate() { terminated++; } };
  const hdr = installPhotoHDRExport(f.tracer, () => {}, value => { f.context.photoModeState.preparing = value; }, () => worker);
  f.context.hdrExportRef.current = hdr;
  hdr.request();
  f.tracer.renderToCanvasCallback({ width: 2, height: 2, texture: { type: T.FloatType } },
    { readRenderTargetPixels(target, x, y, w, h, values) { values.fill(.5); } }, { material: { opacity: 1 } });
  assert.equal(hdr.working, true); assert.equal(f.tracer.pausePathTracing, true);
  const staleReply = worker.onmessage;
  f.finishLoad(); f.frame();
  assert.equal(terminated, 1); assert.equal(hdr.working, false); assert.equal(f.tracer.pausePathTracing, false);
  assert.equal(f.tracer.samples, 1); assert.equal(f.context.photoModeState.preparing, false);
  staleReply({ data: { type: 'done', buffer: new Float32Array(16).buffer } });
  assert.equal(hdr.consumeExport(), false); assert.equal(f.exports.length, 0); hdr.dispose();
  console.log('PASS material invalidation cancels actual HDR worker before working/export checks; stale reply cannot publish');
}
{
  const f = fixture(); frames(f, 190); f.context.photoModeState.exportRequestId++; f.frame();
  assert.equal(f.exports.length, 1); assert.equal(f.exports[0](), true);
  f.finishLoad(); assert.equal(f.exports[0](), false);
  console.log('PASS pending PNG callback is invalidated immediately by a later committed material revision');
}
{
  const f = fixture(), revision = getPhotoMaterialRevision(f.scene);
  f.loads[0].fail(new Error('network')); assert.equal(f.stateChanges, 0);
  assert.equal(getPhotoMaterialRevision(f.scene), revision); assert.equal(f.warnings.length, 1);
  f.dispose(); const late = new T.Texture(); let disposed = 0;
  late.addEventListener('dispose', () => disposed++); f.loads[0].success(late);
  assert.equal(disposed, 1); assert.equal(f.stateChanges, 0);
  console.log('PASS failed/canceled loads retain valid fallback and never signal a committed replacement');
}
