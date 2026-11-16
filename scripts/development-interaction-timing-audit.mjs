import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(readFileSync("src/lib/pool/development-interaction-timing.ts", "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
let checks = 0;
const check = (value, message) => { assert(value, message); checks++; };
function environment(search) {
  let frameId = 0, now = 0;
  const listeners = new Map(), frames = new Map(), logs = [];
  class Element { closest() { return this; } }
  const document = { visibilityState: "visible" };
  const context = { exports: {}, URLSearchParams, Element, document,
    window: { location: { search },
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name); } },
    performance: { now: () => now }, console: { debug: (...args) => logs.push(args) },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  };
  runInNewContext(code, context);
  return { listeners, frames, logs, document,
    install: context.exports.installDevelopmentInteractionTiming,
    event: { isTrusted: true, type: "click", target: new Element() },
    frame: () => { now += 8; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); },
  };
}
const off = environment(""); off.install()();
check(off.listeners.size === 0, "No listeners unless QA explicitly opts in");
const on = environment("?qaInteractionTiming=1"); const cleanup = on.install();
check(on.listeners.size === 3, "Bounded passive capture for the three intended input events");
on.listeners.get("click")({ ...on.event, isTrusted: false });
check(on.frames.size === 0, "Synthetic input is excluded");
on.document.visibilityState = "hidden"; on.listeners.get("click")(on.event);
check(on.frames.size === 0, "Hidden-tab timing is excluded");
on.document.visibilityState = "visible";
for (let i = 0; i < 61; i++) on.listeners.get("click")(on.event);
on.frame(); check(on.logs.length === 0, "First frame is not mislabeled as second-frame feedback");
on.frame(); check(on.logs.length === 60, "At most sixty timing records per opted-in mount");
const records = on.logs.map(([, raw]) => JSON.parse(raw));
check(new Set(records.map(record => record.sample)).size === 60, "Concurrent inputs retain distinct sample identities");
check(records.every(record => record.inputToSecondRafMs === 16), "Timing uses in-page monotonic clock, not tool duration");
check(records.every(record => !Object.keys(record).some(key => /target|value|text|project|token|email/i.test(key))), "No customer values, targets or credentials recorded");
cleanup(); check(on.listeners.size === 0 && on.frames.size === 0, "Unmount removes all listeners and pending frames");
const interrupted = environment("?qaInteractionTiming=1"); const stop = interrupted.install();
interrupted.listeners.get("click")(interrupted.event); interrupted.frame(); stop();
check(interrupted.frames.size === 0 && interrupted.logs.length === 0, "Unmount between frames cancels callbacks without logging");
console.log(JSON.stringify({ status: "PASS", checks, scope: "DEV opt-in timing plumbing only; not browser performance" }));
