import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync("src/lib/pool/development-gl-diagnostic.ts", "utf8");
const transpiled = ts.transpileModule(source, {
  reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
assert.equal(transpiled.diagnostics?.length ?? 0, 0);
let checks = 1;
const check = (value, message) => { assert(value, message); checks++; };

function environment(search) {
  let frameId = 0, now = 0, clockReads = 0;
  const listeners = new Map(), frames = new Map(), logs = [], calls = [];
  const sentinel = { marker: "NEVER_LOG_ARGUMENT_OR_RESULT" };
  const nativeError = new Error("NEVER_LOG_NATIVE_EXCEPTION");
  const method = (name, duration, fail = false) => function (...args) {
    calls.push({ name, receiver: this, args }); now += duration;
    if (fail) throw nativeError;
    return sentinel;
  };
  const inherited = { linkProgram: method("linkProgram", 5) };
  const gl = Object.create(inherited);
  gl.getProgramParameter = method("getProgramParameter", 2);
  gl.bufferData = method("bufferData", 3, true);
  gl.drawElements = method("drawElements", 7);
  const unwrappable = method("getShaderInfoLog", 1);
  Object.defineProperty(gl, "getShaderInfoLog", { value: unwrappable, configurable: false, writable: false });
  gl.getExtension = () => { throw Error("The diagnostic must never introduce a GL inspection call"); };
  const original = Object.fromEntries(["linkProgram", "getProgramParameter", "bufferData", "drawElements", "getShaderInfoLog"].map(name => [name, gl[name]]));
  const context = {
    exports: {}, URLSearchParams,
    window: {
      location: { search },
      addEventListener: (name, callback, options) => { assert.equal(options.capture, true); assert.equal(options.passive, true); listeners.set(name, callback); },
      removeEventListener: (name, callback, capture) => { assert.equal(capture, true); if (listeners.get(name) === callback) listeners.delete(name); },
    },
    performance: { now: () => { clockReads++; return now; } },
    console: { debug: (...args) => logs.push(args) },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  };
  runInNewContext(transpiled.outputText, context);
  return {
    gl, original, sentinel, nativeError, listeners, frames, logs, calls, context,
    install: () => context.exports.installDevelopmentGlDiagnostic(gl),
    clockReads: () => clockReads,
    input: (type = "click", trusted = true) => listeners.get(type)?.({ type, isTrusted: trusted, target: sentinel, value: sentinel }),
    frame: () => { now += 8; const queued = [...frames.values()]; frames.clear(); queued.forEach(callback => callback()); },
  };
}

for (const search of ["", "?qaGlDiagnostic=0", "?other=1"]) {
  const off = environment(search); const stop = off.install();
  check(off.gl.linkProgram === off.original.linkProgram && off.gl.getProgramParameter === off.original.getProgramParameter, "No wrapper without explicit flag=1");
  check(off.listeners.size === 0 && off.frames.size === 0 && off.clockReads() === 0 && off.calls.length === 0, "No diagnostic work, callbacks or native GL calls without opt-in");
  stop();
}

const on = environment("?qaGlDiagnostic=1"); const stop = on.install();
check(on.listeners.size === 2 && on.calls.length === 0, "Only passive click/input observers, no GL inspection on install");
check(on.gl.getShaderInfoLog === on.original.getShaderInfoLog && !Object.hasOwn(on.gl, "texStorage2D"), "Non-wrappable and missing optional methods are untouched");
check(on.gl.linkProgram(on.sentinel) === on.sentinel, "Original result identity preserved outside a sampling window");
check(on.clockReads() === 0 && on.calls.at(-1).receiver === on.gl && on.calls.at(-1).args[0] === on.sentinel, "Idle wrappers preserve receiver/arguments and skip timing");
on.input("click", false);
check(on.frames.size === 0, "Synthetic inputs do not arm the probe");
on.input();
check(on.gl.getProgramParameter(on.sentinel, "NEVER_LOG_VALUE") === on.sentinel, "Native result is not cloned or replaced");
on.gl.getProgramParameter(on.sentinel, 123);
on.gl.linkProgram(on.sentinel);
let caught;
try { on.gl.bufferData(on.sentinel); } catch (error) { caught = error; }
check(caught === on.nativeError, "Native exception identity is preserved");
check(on.calls.every(call => call.receiver === on.gl), "Every native method retains its actual GL context receiver");
on.frame();
check(on.logs.length === 0, "First rAF does not finalize the two-rAF window");
on.gl.drawElements(on.sentinel);
on.frame();
check(on.logs.length === 1 && on.frames.size === 0, "Second rAF emits exactly one record and clears callbacks");
const first = JSON.parse(on.logs[0][1]);
assert.deepEqual(first.methods, {
  getProgramParameter: { count: 2, totalMs: 4, maxMs: 2 },
  linkProgram: { count: 1, totalMs: 5, maxMs: 5 },
  bufferData: { count: 1, totalMs: 3, maxMs: 3 },
  drawElements: { count: 1, totalMs: 7, maxMs: 7 },
}); checks++;
check(on.logs[0][0] === "[Pool3D GL diagnostic]" && first.event === "click" && first.sample === 1, "Stable log prefix and input/sample identity");
check(!JSON.stringify(on.logs).includes("NEVER_LOG") && Object.values(first.methods).every(metric => Object.keys(metric).sort().join() === "count,maxMs,totalMs"), "No arguments, return values, exceptions, targets or shader data reach logs");

on.input(); on.gl.linkProgram(on.sentinel); on.frame();
on.input("input"); on.gl.getProgramParameter(on.sentinel); on.frame(); on.frame();
const latest = JSON.parse(on.logs.at(-1)[1]);
check(on.logs.length === 2 && latest.sample === 3 && latest.event === "input" && !latest.methods.linkProgram, "A newer trusted input cancels and resets the previous measurement window");
check(latest.methods.getProgramParameter.totalMs === 2, "New window does not retain old method durations");

on.input(); on.frame(); const beforeCleanup = on.logs.length; stop(); stop(); on.frame();
check(on.frames.size === 0 && on.listeners.size === 0 && on.logs.length === beforeCleanup, "Cleanup is idempotent and cancels pending listeners/rAF/logging");
check(on.gl.linkProgram === on.original.linkProgram && !Object.hasOwn(on.gl, "linkProgram"), "Inherited native method restored without leaving an own wrapper");
check(on.gl.getProgramParameter === on.original.getProgramParameter && on.gl.bufferData === on.original.bufferData, "Own native methods restored exactly");
check(on.gl.getProgramParameter(on.sentinel) === on.sentinel, "Cleaned-up context still returns the original object");

const cap = environment("?qaGlDiagnostic=1"); const endCap = cap.install();
for (let i = 0; i < 61; i++) { cap.input(); cap.frame(); cap.frame(); }
check(cap.logs.length === 60 && cap.frames.size === 0, "Probe is bounded to sixty trusted-input windows"); endCap();
const brokenClock = environment("?qaGlDiagnostic=1"); const endClock = brokenClock.install(); brokenClock.input();
brokenClock.context.performance.now = () => { throw Error("Unusable diagnostic clock"); };
check(brokenClock.gl.linkProgram(brokenClock.sentinel) === brokenClock.sentinel, "Diagnostic clock failure cannot replace the native return value");
let clockError; try { brokenClock.gl.bufferData(brokenClock.sentinel); } catch (error) { clockError = error; }
check(clockError === brokenClock.nativeError, "Diagnostic clock failure cannot replace the native exception"); endClock();
const receiver = environment("?qaGlDiagnostic=1"); const endReceiver = receiver.install(); const otherContext = {};
receiver.input();
check(receiver.gl.linkProgram.call(otherContext, receiver.sentinel) === receiver.sentinel && receiver.calls.at(-1).receiver === otherContext, "Borrowed calls preserve the original receiver semantics as well"); endReceiver();
const anotherOwner = environment("?qaGlDiagnostic=1"); const endOwner = anotherOwner.install();
const replacement = () => "another-owner"; anotherOwner.gl.linkProgram = replacement; endOwner();
check(anotherOwner.gl.linkProgram === replacement, "Cleanup preserves a later wrapper owned by another integration");

console.log(JSON.stringify({ status: "PASS", checks, scope: "Opt-in GL timing plumbing with fake GL/clock only; not browser performance" }));
