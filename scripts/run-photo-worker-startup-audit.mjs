import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('public/vendor/photo-denoise/photo-hdr-worker.js', 'utf8').replace(/^import .*;\n/gm, '');
let checks = 0;
function fixture(mode) {
  const listeners = new Map(), messages = [], state = { disposed: 0, unsubscribed: 0, executes: 0 };
  const self = {
    location: { href: 'http://local/vendor/photo-denoise/photo-hdr-worker.js' },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
    postMessage(message) { messages.push(message); },
  };
  class Denoiser {
    backendReady = mode === 'ready';
    constructor() { if (mode === 'throw') throw new Error('Constructor failed'); }
    onBackendReady(callback) { state.ready = callback; return () => { state.unsubscribed++; state.ready = null; }; }
    setInputData() {}
    async execute() { state.executes++; return new Float32Array([.1, .2, .3]); }
    dispose() { state.disposed++; }
  }
  vm.runInNewContext(source, {
    self, Denoiser, createPreservationMask: () => null,
    hdrTransferFuncCPU: ({data}) => data, hdrTransferFuncInverseCPU: ({data}) => data,
    URL, Float32Array, ArrayBuffer, Number, Math, Error, Promise,
  });
  let settled = false;
  const pending = self.onmessage({ data: { width: 1, height: 1, buffer: new Float32Array([.1, .2, .3, 1]).buffer } }).then(() => { settled = true; });
  return { listeners, messages, state, pending, get settled() { return settled; } };
}
// An orphaned rejection from the vendor's async constructor setup must finish
// the real worker handler, without waiting for the parent's three-minute guard.
const rejected = fixture('pending');
rejected.listeners.get('unhandledrejection')?.({ reason: new Error('WebGL backend failed') });
for (let i = 0; i < 12; i++) await Promise.resolve();
assert.equal(rejected.settled, true, 'backend initialization rejection must settle the worker promptly'); checks++;
assert.equal(rejected.messages.length, 1); checks++;
assert.equal(rejected.messages[0].type, 'error'); checks++;
assert.match(rejected.messages[0].message, /WebGL backend failed/); checks++;
assert.equal(rejected.state.disposed, 1); checks++;
assert.equal(rejected.state.executes, 0); checks++;
assert.equal(rejected.state.unsubscribed, 1); checks++;
assert.equal(rejected.listeners.size, 0); checks++;

for (const mode of ['ready', 'pending', 'throw']) {
  const f = fixture(mode);
  f.state.ready?.();
  await f.pending;
  assert.equal(f.messages.length, 1); checks++;
  assert.equal(f.messages[0].type, mode === 'throw' ? 'error' : 'done'); checks++;
  assert.equal(f.listeners.size, 0); checks++;
  assert.equal(f.state.disposed, mode === 'throw' ? 0 : 1); checks++;
  assert.equal(f.state.unsubscribed, mode === 'pending' ? 1 : 0); checks++;
}
console.log(`Photo worker startup: ${checks} checks PASS (actual worker; simulated backend events, no GPU or visual acceptance).`);
