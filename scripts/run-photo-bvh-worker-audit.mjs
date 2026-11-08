import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Worker as Thread } from 'node:worker_threads';
import vm from 'node:vm';

const root = process.cwd(), require = createRequire(root + '/package.json'), ts = require('typescript');
const T = await import(pathToFileURL(root + '/node_modules/three/build/three.module.js'));
const B = await import(pathToFileURL(root + '/node_modules/three-mesh-bvh/src/index.js'));
const { WebGLPathTracer, PathTracingSceneGenerator } = await import(pathToFileURL(root + '/node_modules/three-gpu-pathtracer/src/index.js'));
const compile = file => ts.transpileModule(readFileSync(file, 'utf8').replaceAll('import.meta.url', "'file:///audit/'"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const source = compile('src/components/pool/three/photoBvhWorker.ts');
const { createPhotoBvhWorker } = vm.runInNewContext(source + ';exports;', {
  exports: {}, require: name => name === 'three' ? T : name === 'three-mesh-bvh' ? B : require(name),
  ArrayBuffer, DOMException, URL,
});
const workerSource = compile('src/components/pool/three/photoBvh.worker.ts');
const bootstrap = `
  const { parentPort } = require('node:worker_threads');
  const localRequire = require('node:module').createRequire(${JSON.stringify(root + '/package.json')});
  const scope = { postMessage: (message, transfer) => parentPort.postMessage(message, transfer) };
  new Function('require', 'exports', 'self', ${JSON.stringify(workerSource)})(localRequire, {}, scope);
  parentPort.on('message', data => { parentPort.postMessage({ auditStarted: true }); scope.onmessage({ data }); });
`;

class ControlledWorker {
  listeners = new Map(); terminated = 0; messages = []; throwOnPost = false;
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  get listenerCount() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
  dispatch(type, event) { for (const callback of [...(this.listeners.get(type) ?? [])]) callback(event); }
  postMessage(message, transfer) {
    if (this.throwOnPost) throw new Error('controlled post failure');
    this.messages.push(structuredClone(message, { transfer }));
  }
  terminate() { this.terminated++; }
}
class NativeWorker extends ControlledWorker {
  thread = new Thread(bootstrap, { eval: true });
  started = new Promise(resolve => { this.onStarted = resolve; });
  constructor() {
    super();
    this.thread.on('message', data => {
      if (data.auditStarted) this.onStarted();
      else this.dispatch('message', { data });
    });
    this.thread.on('error', error => this.dispatch('error', { message: error.message, preventDefault() {} }));
    this.thread.on('messageerror', () => this.dispatch('messageerror', {}));
  }
  postMessage(message, transfer) { this.thread.postMessage(message, transfer); }
  terminate() { super.terminate(); void this.thread.terminate(); }
}
const bytes = data => data == null ? null : Buffer.from(data instanceof ArrayBuffer ? data : data.buffer,
  data.byteOffset ?? 0, data.byteLength).toString('hex');
const serialized = bvh => {
  const result = B.MeshBVH.serialize(bvh, { cloneBuffers: false });
  return { roots: result.roots.map(bytes), index: bytes(result.index), indirect: bytes(result.indirectBuffer) };
};
const box = () => new T.BoxGeometry(8, 3, 5, 4, 3, 5);
const options = { strategy: B.SAH, maxLeafTris: 1, indirect: true };
const unhandled = [];
const observeUnhandled = error => unhandled.push(error);
process.on('unhandledRejection', observeUnhandled);
const passed = [];
const nextTask = () => new Promise(resolve => setImmediate(resolve));

for (const fixture of [
  { name: 'indexed/groups/indirect', geometry: box(), options },
  { name: 'indexed/groups/direct', geometry: box(), options: { ...options, indirect: false } },
  { name: 'unindexed', geometry: new T.SphereGeometry(2, 32, 16).toNonIndexed(), options },
  { name: 'draw range/no bounding box', geometry: (() => { const geometry = box(); geometry.setDrawRange(12, 72); return geometry; })(), options: { ...options, setBoundingBox: false } },
  { name: 'explicit range/existing bounding box', geometry: box(), options: { ...options, range: { start: 9, count: 75 } } },
]) {
  if (fixture.name.includes('existing')) fixture.geometry.boundingBox = new T.Box3(new T.Vector3(-20, -20, -20), new T.Vector3(20, 20, 20));
  const expectedGeometry = fixture.geometry.clone();
  const expected = new B.MeshBVH(expectedGeometry, fixture.options);
  const normal = fixture.geometry.getAttribute('normal');
  const normalBytes = bytes(normal.array), normalIdentity = normal;
  const groups = structuredClone(fixture.geometry.groups), range = { ...fixture.geometry.drawRange };
  const originalPositions = fixture.geometry.getAttribute('position').array;
  const originalIndex = fixture.geometry.index?.array;
  const raw = new NativeWorker(), owner = createPhotoBvhWorker(() => raw), progress = [];
  try {
    let yielded = false; setImmediate(() => { yielded = true; });
    const resultPromise = owner.generate(fixture.geometry, { ...fixture.options, onProgress: value => progress.push(value) });
    assert.equal(originalPositions.byteLength, 0, 'merged position buffer transfers off-thread');
    if (originalIndex) assert.equal(originalIndex.byteLength, 0, 'merged index buffer transfers off-thread');
    const result = await resultPromise;
    assert(yielded, 'worker computation permits a main-thread event-loop turn');
    assert.deepEqual(serialized(result), serialized(expected), fixture.name + ': exact serialized BVH equality');
    assert.equal(bytes(fixture.geometry.attributes.position.array), bytes(expectedGeometry.attributes.position.array));
    assert.equal(bytes(fixture.geometry.index?.array), bytes(expectedGeometry.index?.array));
    assert.equal(fixture.geometry.getAttribute('normal'), normalIdentity);
    assert.equal(bytes(normal.array), normalBytes, 'non-position attributes remain intact');
    assert.deepEqual(fixture.geometry.groups, groups); assert.deepEqual(fixture.geometry.drawRange, range);
    assert.deepEqual(fixture.geometry.boundingBox, expectedGeometry.boundingBox);
    assert.equal(progress.at(-1), 1); assert.equal(raw.listenerCount, 0);
    passed.push(fixture.name);
  } finally { owner.dispose(); owner.dispose(); assert.equal(raw.terminated, 1); }
}

// Dispose before a request, then reject before transfer or worker CPU work.
{
  const raw = new ControlledWorker(), owner = createPhotoBvhWorker(() => raw), geometry = box();
  owner.dispose(); owner.dispose();
  await assert.rejects(owner.generate(geometry, options), error => error.name === 'AbortError');
  assert(geometry.attributes.position.array.byteLength > 0); assert.equal(raw.messages.length, 0);
  assert.equal(raw.terminated, 1); passed.push('cancel before generation');
}

// Cancel while the actual worker is inside generation; stale results cannot
// restore detached arrays or continue into the path tracer's upload callback.
{
  const raw = new NativeWorker(), owner = createPhotoBvhWorker(() => raw);
  const geometry = new T.SphereGeometry(3, 256, 128), positions = geometry.attributes.position.array;
  const job = owner.generate(geometry, options), lateHandler = [...raw.listeners.get('message')][0];
  const rejected = assert.rejects(job, error => error.name === 'AbortError');
  await raw.started;
  owner.dispose(); owner.dispose(); await rejected;
  lateHandler({ data: { id: 1, type: 'done', position: new Float32Array([1, 2, 3]), bvh: {} } });
  assert.equal(geometry.attributes.position.array, positions);
  assert.equal(positions.byteLength, 0); assert.equal(geometry.boundingBox, null);
  assert.equal(raw.listenerCount, 0); assert.equal(raw.terminated, 1);
  passed.push('cancel during real worker generation / stale message');
}

// Exercise the installed public setSceneAsync continuation with the adapter.
{
  const raw = new ControlledWorker(), owner = createPhotoBvhWorker(() => raw);
  const tracer = Object.create(WebGLPathTracer.prototype);
  tracer._generator = new PathTracingSceneGenerator();
  let uploads = 0; tracer._updateFromResults = () => { uploads++; };
  tracer.setBVHWorker(owner);
  const scene = new T.Scene(), material = new T.MeshStandardMaterial(), geometry = box();
  const livePositions = geometry.attributes.position.array, liveBytes = bytes(livePositions);
  scene.add(new T.Mesh(geometry, material));
  const job = tracer.setSceneAsync(scene, new T.PerspectiveCamera());
  const rejected = assert.rejects(job, error => error.name === 'AbortError');
  const handler = [...raw.listeners.get('message')][0];
  owner.dispose(); await rejected;
  handler({ data: { id: 1, type: 'done', position: new Float32Array(), bvh: {} } });
  await nextTask(); assert.equal(uploads, 0, 'cancelled build cannot reach installed upload continuation');
  assert.equal(geometry.attributes.position.array, livePositions); assert.equal(bytes(livePositions), liveBytes,
    'only generated merged buffers transfer; live scene geometry survives');
  passed.push('cancel prevents actual setSceneAsync upload continuation');
}

// Final progress callbacks may synchronously cancel, before geometry changes.
{
  const raw = new ControlledWorker(), owner = createPhotoBvhWorker(() => raw), geometry = box();
  const positions = geometry.attributes.position.array;
  const job = owner.generate(geometry, { ...options, onProgress: () => owner.dispose() });
  const rejected = assert.rejects(job, error => error.name === 'AbortError');
  raw.dispatch('message', { data: { id: 1, type: 'done', position: new Float32Array(3), bvh: {} } });
  await rejected; assert.equal(geometry.attributes.position.array, positions); assert.equal(positions.byteLength, 0);
  assert.equal(raw.listenerCount, 0); passed.push('cancel inside final progress callback');
}

for (const type of ['error', 'messageerror', 'worker-reply-error', 'post-error']) {
  const raw = new ControlledWorker(); raw.throwOnPost = type === 'post-error';
  const owner = createPhotoBvhWorker(() => raw), job = owner.generate(box(), options);
  const rejected = assert.rejects(job, /controlled|Unreadable/);
  if (type === 'error') {
    let prevented = false;
    raw.dispatch('error', { message: 'controlled worker error', preventDefault() { prevented = true; } });
    assert(prevented);
  } else if (type === 'messageerror') raw.dispatch('messageerror', {});
  else if (type === 'worker-reply-error') raw.dispatch('message', { data: { id: 1, type: 'error', message: 'controlled BVH error' } });
  await rejected; assert.equal(raw.listenerCount, 0); owner.dispose(); owner.dispose();
  assert.equal(raw.terminated, 1); passed.push(type);
}

// The owned worker entry catches errors and returns a serializable failure.
{
  const raw = new NativeWorker();
  try {
    const response = new Promise(resolve => raw.addEventListener('message', event => resolve(event.data)));
    raw.postMessage({ id: 42, position: null, normalized: false, index: null, groups: [], drawRange: { start: 0, count: Infinity }, options }, []);
    const data = await response; assert.equal(data.type, 'error'); assert.equal(data.id, 42); assert(data.message);
    passed.push('worker algorithm failure response');
  } finally { raw.terminate(); }
}
await nextTask(); await nextTask();
process.removeListener('unhandledRejection', observeUnhandled);
assert.deepEqual(unhandled, [], 'errors and cancellation do not create unhandled promise rejections');
console.log(JSON.stringify({ status: 'PASS', cases: passed, scope: 'Real worker-thread execution of owned worker source; byte-identical BVH vs installed synchronous API, transferable buffers, responsive main thread and cancellation/error ownership. Browser bundling/GPU verification separate.' }));
