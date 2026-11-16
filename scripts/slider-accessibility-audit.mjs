import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const exports = {};
runInNewContext(ts.transpileModule(readFileSync("src/components/ui/slider.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
  exports,
  require: name => name === "@/lib/utils" ? { cn: (...values) => values.filter(Boolean).join(" ") } : require(name),
});

let checks = 0;
for (const label of ["Lunghezza", "Larghezza", "Profondità spiaggetta", "Length", "Width", "Sun shelf depth"]) {
  const html = renderToStaticMarkup(React.createElement(exports.Slider, {
    "aria-label": label, value: [8], min: 3, max: 15, step: .1,
  }));
  const thumb = html.match(/<span role="slider"[^>]*>/)?.[0];
  assert(thumb?.includes(`aria-label="${label}"`), `${label}: interactive thumb must carry the name`);
  assert(thumb.includes('tabindex="0"') && thumb.includes('aria-valuemin="3"') && thumb.includes('aria-valuemax="15"'));
  checks += 2;
}
const html = renderToStaticMarkup(React.createElement(exports.Slider, {
  "aria-labelledby": "dimension-label", "aria-describedby": "dimension-hint", value: [8],
}));
const thumb = html.match(/<span role="slider"[^>]*>/)?.[0];
assert(thumb?.includes('aria-labelledby="dimension-label"'));
assert(thumb.includes('aria-describedby="dimension-hint"'));
checks += 2;
const radioExports = {};
runInNewContext(ts.transpileModule(readFileSync("src/components/ui/radio-group.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
  exports: radioExports,
  require: name => name === "@/lib/utils" ? { cn: (...values) => values.filter(Boolean).join(" ") } : require(name),
});
const lead = readFileSync("src/configurator/steps/final-review/LeadRequestDialog.tsx", "utf8");
assert.match(lead, /<RadioGroup\s+aria-label=\{t\("Quando vuoi realizzarla\?"\)\}\s+required\s/);
checks++;
assert.match(lead, /<Button ref=\{requestTrigger\}/);
assert.match(lead, /onCloseAutoFocus=\{\(event\) => \{\s+event\.preventDefault\(\);\s+requestTrigger\.current\?\.focus\(\);/);
checks += 2;
for (const label of ["Quando vuoi realizzarla?", "When would you like to build it?"]) {
  const markup = renderToStaticMarkup(React.createElement(radioExports.RadioGroup, { "aria-label": label, required: true }));
  assert(markup.includes('role="radiogroup"') && markup.includes(`aria-label="${label}"`));
  assert(markup.includes('aria-required="true"'));
  checks += 2;
}
console.log(JSON.stringify({ status: "PASS", checks, scope: "Actual React/Radix SSR markup and lead timing wiring; keyboard behaviour and translated names additionally require browser QA" }));
