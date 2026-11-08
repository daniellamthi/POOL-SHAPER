import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';

const root = process.argv[2] ?? process.cwd();
const require = createRequire(resolve(root, 'package.json'));
const ts = require('typescript');
const sourcePath = resolve(root, 'src/lib/pool/use-catalogue-presentation.ts');
const compile = path => ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const availability = runInNewContext(compile(resolve(root, 'src/lib/pool/catalogue-availability.ts')) + ';exports;', { exports: {} });
const source = compile(sourcePath);
const prefix = 'pool-shaper:presentation:v1:';
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };
const eq = (actual, expected, label) => { assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, label); checks++; };
const key = id => prefix + id;
const record = (setting, contextEnabled = true) => ({ version: 1, setting, contextEnabled });
function storage() {
  const values = new Map(), calls = [];
  return { values, calls,
    getItem(k) { calls.push(['get', k]); return values.get(k) ?? null; },
    setItem(k, value) { calls.push(['set', k, value]); values.set(k, value); },
    removeItem(k) { calls.push(['remove', k]); values.delete(k); },
  };
}
function load(sessionStorage, React = {}, windowOverride) {
  const exports = {};
  return runInNewContext(source + ';exports;', {
    exports, window: windowOverride ?? { sessionStorage },
    require(id) {
      if (id === 'react') return React;
      if (id.endsWith('catalogue-availability')) return availability;
      return require(id);
    },
  });
}
const settings = ['garden', 'patio', 'spa-wall', 'spa-glass', 'residence', 'infinity-villa'];
{
  const s = storage(), api = load(s);
  for (const setting of settings) for (const contextEnabled of [false, true]) {
    api.writeCataloguePresentation('roundtrip', { setting, contextEnabled });
    eq(api.readCataloguePresentation('roundtrip'), { setting, contextEnabled }, 'six exact settings and both latch states round-trip');
    const saved = JSON.parse(s.values.get(key('roundtrip')));
    eq(saved, record(setting, contextEnabled), 'persist only version and requested UI fields');
  }
  check(api.readCataloguePresentation('missing') === null, 'missing record is ignored');
  for (const invalid of [
    '{', 'null', '[]', '{}',
    JSON.stringify({ setting: 'residence', contextEnabled: true }),
    JSON.stringify({ version: 2, setting: 'residence', contextEnabled: true }),
    JSON.stringify({ version: '1', setting: 'residence', contextEnabled: true }),
    JSON.stringify(record('spa-anything')),
    JSON.stringify(record('SPA-GLASS')),
    JSON.stringify(record(null)),
    JSON.stringify(record(42)),
    JSON.stringify(record('residence', 'true')),
    JSON.stringify({ version: 1, setting: 'residence' }),
  ]) {
    s.values.set(key('invalid'), invalid);
    check(api.readCataloguePresentation('invalid') === null, 'invalid persisted input is ignored: ' + invalid);
  }
  api.writeCataloguePresentation('alpha', { setting: 'residence', contextEnabled: true });
  api.writeCataloguePresentation('beta', { setting: 'patio', contextEnabled: false });
  eq(api.readCataloguePresentation('alpha'), { setting: 'residence', contextEnabled: true }, 'other project cannot overwrite alpha');
  eq(api.readCataloguePresentation('beta'), { setting: 'patio', contextEnabled: false }, 'other project keeps its own latch');
}
{
  const unavailable = load({ getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } });
  check(unavailable.readCataloguePresentation('alpha') === null, 'getItem failures degrade to default');
  unavailable.writeCataloguePresentation('alpha', { setting: 'residence', contextEnabled: true }); checks++;
  const blockedWindow = {};
  Object.defineProperty(blockedWindow, 'sessionStorage', { get() { throw Error('privacy'); } });
  const blocked = load(undefined, {}, blockedWindow);
  check(blocked.readCataloguePresentation('alpha') === null, 'sessionStorage getter failure is contained');
  blocked.writeCataloguePresentation('alpha', { setting: 'residence', contextEnabled: true }); checks++;
  const ssr = runInNewContext(source + ';exports;', { exports: {}, require: id => id === 'react' ? {} : availability });
  check(ssr.readCataloguePresentation('alpha') === null, 'SSR does not access window');
  ssr.writeCataloguePresentation('alpha', { setting: 'residence', contextEnabled: true }); checks++;
}

// Run the actual hook with commit ordering: a layout state update still
// flushes that commit's passive effects before the next render. This catches
// defaults overwriting a saved record during hydration/project transitions.
function mount(props, s) {
  const slots = [];
  let index = 0, dirty = false, layout = [], passive = [], output;
  const changed = (before, after) => !before || !after || before.length !== after.length || after.some((v, i) => !Object.is(v, before[i]));
  const effect = queue => (callback, deps) => {
    const n = index++, old = slots[n];
    if (old && !changed(old.deps, deps)) return;
    slots[n] = { deps, cleanup: old?.cleanup };
    queue.push(() => { old?.cleanup?.(); slots[n].cleanup = callback(); });
  };
  const React = {
    useState(initial) {
      const n = index++;
      if (!(n in slots)) {
        const cell = slots[n] = { value: typeof initial === 'function' ? initial() : initial };
        cell.set = next => { const value = typeof next === 'function' ? next(cell.value) : next; if (!Object.is(value, cell.value)) { cell.value = value; dirty = true; } };
      }
      return [slots[n].value, slots[n].set];
    },
    useRef(initial) { const n = index++; return slots[n] ??= { current: initial }; },
    useMemo(callback, deps) { const n = index++, old = slots[n]; if (!old || changed(old.deps, deps)) slots[n] = { deps, value: callback() }; return slots[n].value; },
    useCallback(callback, deps) { return React.useMemo(() => callback, deps); },
    useLayoutEffect(callback, deps) { return effect(layout)(callback, deps); },
    useEffect(callback, deps) { return effect(passive)(callback, deps); },
  };
  const api = load(s, React);
  function flush(next = props) {
    props = next;
    for (let render = 0; render < 30; render++) {
      index = 0; dirty = false; layout = []; passive = [];
      output = api.useCataloguePresentation(props);
      for (const commit of layout) commit();
      for (const commit of passive) commit();
      if (!dirty) return output;
    }
    throw Error('hook never settles');
  }
  flush();
  return { get output() { return output; }, update: flush,
    select(setting) { output.select(setting); return flush(); },
    unmount() { for (const cell of slots) cell?.cleanup?.(); },
  };
}
const base = { projectId: 'alpha', ready: true, presentation: false, infinity: false, indoorAvailable: true };
{
  const s = storage();
  s.values.set(key('alpha'), JSON.stringify(record('spa-glass')));
  const f = mount({ ...base, projectId: 'provisional', ready: false }, s);
  check(s.calls.length === 0, 'no storage reads/writes before project hydration');
  check(f.output.setting === 'garden' && !f.output.contextEnabled, 'loading uses neutral presentation');
  f.select('residence');
  check(s.calls.length === 0, 'selection during shared loading cannot write a provisional project');
  f.update(base);
  check(f.output.setting === 'spa-glass' && f.output.contextEnabled, 'restore actual project and context latch after ready');
  check(s.calls.filter(c => c[0] === 'set').every(c => JSON.parse(c[2]).setting === 'spa-glass'), 'hydration never overwrites restored setting with initial Garden');
  f.output.select('residence');
  check(JSON.parse(s.values.get(key('alpha'))).setting === 'residence', 'explicit choice saves synchronously before reload');
  f.update(base);
  f.unmount();
  const reload = mount(base, s);
  check(reload.output.setting === 'residence' && reload.output.contextEnabled, 'fresh hook mount restores same-tab same-project view');
  reload.unmount();
}
{
  const s = storage();
  s.values.set(key('alpha'), JSON.stringify(record('residence')));
  s.values.set(key('beta'), JSON.stringify(record('patio', false)));
  const f = mount(base, s);
  f.update({ ...base, projectId: 'beta' });
  check(f.output.setting === 'patio' && !f.output.contextEnabled, 'project switch loads only that project record');
  check(s.calls.filter(c => c[0] === 'set' && c[1] === key('beta')).every(c => JSON.parse(c[2]).setting === 'patio'), 'old project state is never saved to incoming project');
  f.update({ ...base, projectId: 'fresh-reset' });
  check(f.output.setting === 'garden' && !f.output.contextEnabled, 'reset new identity starts in Garden with no presentation latch');
  eq(JSON.parse(s.values.get(key('alpha'))), record('residence'), 'reset preserves other project record');
  f.update({ ...base, projectId: 'loading-shared', ready: false });
  const before = s.calls.length;
  f.update({ ...base, projectId: 'loading-shared', ready: false, presentation: true });
  check(s.calls.length === before, 'shared loading/error gate never writes even when a presentation step is transiently shown');
  f.update(base);
  check(f.output.setting === 'residence' && f.output.contextEnabled, 'leaving async shared load can restore owner project view');
  f.unmount();
}
{
  const s = storage(), f = mount(base, s);
  check(!f.output.contextEnabled, 'new project has no previously visited presentation');
  f.update({ ...base, presentation: true });
  check(f.output.contextEnabled, 'entering presentation latches catalogue context');
  f.update(base);
  check(f.output.contextEnabled, 'context stays enabled after going back');
  f.unmount();
  const reload = mount(base, s);
  check(reload.output.contextEnabled, 'visited presentation remains latched after reload');
  check(!('photoMode' in reload.output), 'UI restoration does not expose or start Photo Mode');
  reload.unmount();
}
for (const [saved, infinity, indoorAvailable, expected] of [
  ['spa-wall', false, false, 'garden'], ['spa-glass', false, false, 'garden'],
  ['residence', false, false, 'residence'], ['infinity-villa', false, true, 'garden'],
  ['spa-glass', true, true, 'garden'], ['residence', true, true, 'garden'],
  ['infinity-villa', true, false, 'infinity-villa'], ['garden', true, true, 'garden'],
]) {
  const s = storage(); s.values.set(key('alpha'), JSON.stringify(record(saved)));
  const f = mount({ ...base, infinity, indoorAvailable }, s);
  check(f.output.setting === expected, `stored ${saved} resolves safely for current pool`);
  check(JSON.parse(s.values.get(key('alpha'))).setting === expected, 'persisted record follows existing availability normalization');
  f.unmount();
}
{
  const s = storage(); s.values.set(key('alpha'), JSON.stringify(record('spa-glass')));
  const f = mount(base, s);
  f.update({ ...base, indoorAvailable: false });
  check(f.output.setting === 'garden', 'resizing an existing SPA out of range clamps the active view');
  check(JSON.parse(s.values.get(key('alpha'))).setting === 'garden', 'normalized oversized view is saved');
  f.update(base);
  check(f.output.setting === 'garden', 'restoring dimensions does not reactivate a rejected view automatically');
  f.select('infinity-villa');
  check(f.output.setting === 'garden', 'explicit incompatible selection is resolved');
  f.unmount();
}
console.log(`Catalogue presentation resume: ${checks} checks PASS (actual storage/hook with simulated React lifecycle; native reload acceptance separate).`);
