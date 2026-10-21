/** Execute the real provider autosave effect with deterministic browser/timers.
 * This catches quick-reload loss which synchronous persistence tests cannot. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync("src/lib/pool/store.tsx", "utf8");
const ast = ts.createSourceFile("store.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const provider = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "ConfiguratorProvider");
const statement = provider?.body?.statements.find(node => ts.isExpressionStatement(node)
  && ts.isCallExpression(node.expression) && node.expression.expression.getText(ast) === "useEffect"
  && node.expression.arguments[0]?.getText(ast).includes("saveTimeoutRef.current"));
assert(statement, "Actual provider autosave effect must be tested, not a duplicated implementation");
const effect = statement.expression.arguments[0];
const compiled = ts.transpileModule(`exports.run = ${effect.getText(ast)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };
function fixture(ready = true) {
  const listeners = new Map(), documentListeners = new Map(), timers = new Map(), saved = [];
  let id = 0;
  const window = {
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => { if (listeners.get(name) === listener) listeners.delete(name); },
  };
  const document = {
    visibilityState: "visible",
    addEventListener: (name, listener) => documentListeners.set(name, listener),
    removeEventListener: (name, listener) => { if (documentListeners.get(name) === listener) documentListeners.delete(name); },
  };
  const context = {
    exports: {}, window, document, draftReady: ready, saveTimeoutRef: { current: null },
    projectConfiguration: { projectId: "local-test", config: { paving: "reference-greige", pavingFormat: "60x120" } },
    saveProjectDraft: project => saved.push(JSON.parse(JSON.stringify(project))),
    setTimeout: (callback, delay) => { const token = ++id; timers.set(token, { callback, delay }); return token; },
    clearTimeout: token => timers.delete(token),
  };
  runInNewContext(compiled, context);
  const run = () => context.exports.run();
  return { context, listeners, documentListeners, timers, saved, run };
}
const loading = fixture(false);
loading.run();
check(loading.timers.size === 0 && loading.listeners.size === 0, "Loading a shared project cannot overwrite a local draft with defaults");

const quickReload = fixture();
const stopQuick = quickReload.run();
check(quickReload.saved.length === 0 && [...quickReload.timers.values()][0]?.delay === 800, "Ordinary editing remains debounced, without synchronous input writes");
quickReload.listeners.get("pagehide")?.({ persisted: false });
check(quickReload.saved.length === 1 && quickReload.saved[0].config.paving === "reference-greige", "Reload before 800ms flushes the actual most recent finish");
check(quickReload.timers.size === 0 && quickReload.context.saveTimeoutRef.current === null, "Page exit cancels the pending duplicate timer");
quickReload.listeners.get("pagehide")?.({ persisted: true });
check(quickReload.saved.length === 1, "Repeated exit/BFCache events do not duplicate a completed write");
stopQuick?.();
check(quickReload.listeners.size === 0 && quickReload.documentListeners.size === 0, "Effect cleanup removes its exact listener identities");

const hidden = fixture();
hidden.run();
hidden.documentListeners.get("visibilitychange")?.();
check(hidden.saved.length === 0, "A visible-page event does not force synchronous saving");
hidden.context.document.visibilityState = "hidden";
hidden.documentListeners.get("visibilitychange")?.();
check(hidden.saved.length === 1 && hidden.timers.size === 0, "Tab background/mobile suspension preserves a pending selection");

const latest = fixture();
const cancelOld = latest.run();
cancelOld?.();
check(latest.saved.length === 0 && latest.timers.size === 0, "Dependency cleanup retains debounce rather than saving every stale intermediate value");
latest.context.projectConfiguration = { projectId: "local-test", config: { paving: "reference-beige", pavingFormat: "60x60" } };
latest.run();
latest.listeners.get("pagehide")?.();
check(latest.saved.length === 1 && latest.saved[0].config.paving === "reference-beige" && latest.saved[0].config.pavingFormat === "60x60", "Exit saves the latest committed configuration, never the stale closure");

const idle = fixture();
const cancelIdle = idle.run();
[...idle.timers.values()][0].callback();
check(idle.saved.length === 1 && idle.context.saveTimeoutRef.current === null, "Idle debounce writes once and clears its pending marker");
idle.listeners.get("pagehide")?.();
check(idle.saved.length === 1, "Already saved idle state is not written again on exit");
cancelIdle?.();
console.log(JSON.stringify({ status: "PASS", checks, scope: "Actual provider debounce/pagehide/visibility lifecycle; independent quick-reload browser proof required separately" }));
