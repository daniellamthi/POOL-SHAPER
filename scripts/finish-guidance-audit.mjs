import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = process.cwd();
const file = join(root, "node_modules/.cache/finish-guidance-audit.mjs");
await build({ input: "finish-guidance-entry", output: { file, format: "esm" }, platform: "node",
  external: ["react", "react/jsx-runtime"], resolve: { alias: { "@": join(root, "src") } },
  plugins: [{ name: "finish-guidance-entry", resolveId(id) {
    if (id === "finish-guidance-entry") return id;
    if (id.endsWith("/projectDelivery.server")) return "\0finish-unused-rpc";
    return null;
  }, load(id) {
    if (id === "\0finish-unused-rpc") return "export const loadSharedProjectFn = () => { throw new Error('Unexpected RPC in finish UX audit'); };";
    if (id !== "finish-guidance-entry") return null;
    return `
      export * from "${join(root, "src/components/pool/wizard/finish-guide.ts")}";
      export { FinishFamilyChoice } from "${join(root, "src/components/pool/PorcelainFinishChoice.tsx")}";
      export { PORCELAIN_FINISHES } from "${join(root, "src/lib/pool/reference-finishes.ts")}";
      export { translateText } from "${join(root, "src/lib/i18n/index.tsx")}";
      export { configuratorTesting } from "${join(root, "src/lib/pool/store.tsx")}";
      export { parseProjectConfiguration, serializeProjectConfiguration, toProjectConfiguration } from "${join(root, "src/lib/pool/project.ts")}";
    `;
  } }],
});
const { finishFamily, TRAVERTINE_FINISHES, PORCELAIN_FINISHES, revealWizardFinish,
  FinishFamilyChoice, translateText, configuratorTesting, parseProjectConfiguration,
  serializeProjectConfiguration, toProjectConfiguration } = await import(pathToFileURL(file).href);
let checks = 0;
const equal = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const ok = (value, label) => { assert(value, label); checks++; };

equal(PORCELAIN_FINISHES.map(f => f.id), ["reference-grigio", "reference-avorio", "reference-beige", "reference-greige"], "Exactly four real porcelain variants");
equal(TRAVERTINE_FINISHES.map(f => f.id), ["reference-travertine-light", "reference-travertine-veined"], "Exactly two existing travertine variants");
for (const id of ["gres", "anthracite-gres", "reference-light", ...PORCELAIN_FINISHES.map(f => f.id)]) equal(finishFamily(id), "porcelain", `${id}: family without migration`);
for (const id of ["travertine", ...TRAVERTINE_FINISHES.map(f => f.id)]) equal(finishFamily(id), "travertine", `${id}: family without migration`);
for (const id of ["prun", "limestone", "wpc", undefined]) equal(finishFamily(id), null, "Other materials unchanged");

for (const family of ["porcelain", "travertine"]) {
  const variants = family === "porcelain" ? PORCELAIN_FINISHES : TRAVERTINE_FINISHES;
  for (const value of [family === "porcelain" ? "anthracite-gres" : "travertine", ...variants.map(f => f.id)]) {
    let changes = 0;
    const html = renderToStaticMarkup(React.createElement(FinishFamilyChoice, { family, value, onSelect: () => changes++ }));
    equal(changes, 0, "Rendering/opening a selected category does not dispatch changes");
    equal((html.match(/<button /g) ?? []).length, variants.length + 1, "Native keyboard-operable parent + variants");
    equal((html.match(/aria-pressed="true"/g) ?? []).length, variants.some(f => f.id === value) ? 2 : 1, "Saved generic or exact variant selected correctly");
    ok(html.includes('aria-expanded="true"'), "Selected category remains expanded");
    for (const finish of variants) ok(html.includes(finish.title) || html.includes(finish.subtitle), "Every supported variant readable");
    if (!variants.some(f => f.id === value)) ok(html.includes("Finitura attuale conservata"), "Generic saved finish remains valid and explained");
  }
}

// A deliberately opened family can differ from the applied material. Its
// disclosure is not a replacement/default selection, including after Back.
for (const family of ["porcelain", "travertine"]) {
  const variants = family === "porcelain" ? PORCELAIN_FINISHES : TRAVERTINE_FINISHES;
  for (const [value, open] of [["wpc", true], [variants[0].id, false]]) {
    let writes = 0;
    const html = renderToStaticMarkup(React.createElement(FinishFamilyChoice, {
      family, value, open, onOpen: () => writes++, onSelect: () => writes++,
    }));
    equal(writes, 0, "Controlled disclosure never changes the applied material on render");
    equal((html.match(/<button /g) ?? []).length, open ? variants.length + 1 : 1,
      "Explicit disclosure state, not the saved material, controls variant visibility");
    ok(html.includes(`aria-expanded="${open}"`), "Family exposes its actual disclosure state");
    equal((html.match(/aria-pressed="true"/g) ?? []).length, open ? 0 : 1,
      "Exploring a different family leaves the old selection untouched");
  }
}

// The scroll boundary is tested with an ancestor mock: no window/page scrolling
// or scrollIntoView is available, so accidental ancestor scrolling fails.
for (const reduced of [false, true]) for (const sectionTop of [-50, 180, 1200]) {
  const calls = [];
  const scroller = { scrollTop: 100, scrollHeight: 900, clientHeight: 260,
    getBoundingClientRect: () => ({ top: 100 }), scrollTo: options => calls.push(options) };
  const section = { closest: selector => { equal(selector, ".pool-dock-scroll", "Only wizard scrollport selected"); return scroller; },
    getBoundingClientRect: () => ({ top: sectionTop }), focus: options => calls.push({ focus: options }) };
  equal(revealWizardFinish(section, reduced), true, "Wizard guide succeeds");
  equal(calls[0], { focus: { preventScroll: true } }, "Keyboard destination focus cannot move the outer page");
  equal(calls[1], { top: Math.max(0, Math.min(sectionTop - 12, 640)), behavior: reduced ? "auto" : "smooth" }, "Bounded internal scroll respects reduced motion");
}
equal(revealWizardFinish({ closest: () => null }, false), false, "No wizard ancestor means no page scrolling fallback");

// Real reducer + canonical snapshots: changing a variant touches only the
// intended material (plus existing valid format rules), never other options.
const { reducer, createInitialState } = configuratorTesting;
let state = createInitialState();
state = reducer(state, { type: "setProjectType", value: "new" });
state = reducer(state, { type: "setPoolType", value: "in-ground" });
state = reducer(state, { type: "setPavingFormat", value: "60x60" });
for (let cycle = 0; cycle < 20; cycle++) for (const finish of [...PORCELAIN_FINISHES, ...TRAVERTINE_FINISHES]) {
  for (const [action, field] of [["setCopingMaterial", "copingMaterial"], ["setPaving", "paving"]]) {
    const before = state;
    state = reducer(state, { type: action, value: finish.id });
    equal(state.config, { ...before.config, [field]: finish.id }, "Explicit variant changes only intended material; format and all unrelated selections retained");
    const project = toProjectConfiguration(state.projectId, state.config, state.renovation);
    const restored = parseProjectConfiguration(serializeProjectConfiguration(project));
    equal(restored.config[field], finish.id, "Canonical Save/Reload keeps exact finish ID");
  }
}
for (const text of ["Chiaro o venato · due varianti", "Varianti del travertino", "Tono chiaro con pori naturali.", "Venatura sedimentaria longitudinale.",
  "Finitura attuale conservata fino alla scelta.",
  "Micro-spot discreti nelle alzate, coordinati al colore dei fari piscina. Optional indipendente.",
  "Micro-spot sotto la seduta, coordinati al colore dei fari piscina. Optional indipendente."]) {
  ok(translateText(text, "en") !== text, "New customer copy has authored English translation");
  equal(translateText(translateText(text, "en"), "it"), text, "IT/EN round-trip leaves exact source copy");
}

// Source contracts supplement, but do not replace, real browser interaction QA.
const source = readFileSync("src/components/pool/PorcelainFinishChoice.tsx", "utf8");
const ast = ts.createSourceFile("PorcelainFinishChoice.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let categoryHandler;
function walk(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "ChoiceCard" && !categoryHandler)
    categoryHandler = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(ast) === "onSelect")?.initializer;
  ts.forEachChild(node, walk);
}
walk(ast);
const handler = categoryHandler.getText(ast);
ok(handler.includes("setExpanded(true)") && handler.includes("request()"), "Repeated category activation keeps variants open and guides again");
ok(!handler.includes("onSelect(") && !handler.includes("!open") && !handler.includes("!expanded"), "Category activation never applies a default variant or toggles options shut");
ok(source.includes("max-sm:[&>button>span:first-child]:h-14") && source.includes("max-sm:[&>button>span:last-child]:p-2"), "Only family cards use compact 56px mobile samples with original readable names");
ok(source.includes("max-sm:[&>button>span:first-child>span:first-child]:p-1.5"), "Mobile sample padding leaves 44px of image height rather than compressing the photograph");
const guided = readFileSync("src/components/pool/wizard/GuidedFinishSection.tsx", "utf8");
ok(guided.includes("consumed.current >= activation"), "Consumed request is not replayed on navigation/remount");
ok(guided.includes("}, [activation, consumed])"), "Locale or unrelated renders do not trigger auto-scroll");
ok(guided.includes("motion-reduce:transition-none"), "Highlight respects reduced-motion preference");
console.log(`Finish guidance: ${checks} checks PASS (family markup, bounded scroll, reduced motion, 20 reducer cycles, canonical persistence, IT/EN, event-only wiring). Browser QA is separate.`);
