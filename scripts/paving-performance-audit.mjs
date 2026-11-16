// Exact-output regression against the pre-optimization implementation. Timings
// cover CPU geometry creation only: not GPU/FPS, loading, or physical mobile.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";

const root = process.cwd(), baselineCommit = "70ec9390bba606b017a31cc22ba5c0ca8a461e1a";
const baselineSource = execFileSync("git", ["show", `${baselineCommit}:src/components/pool/three/pavingGeometry.ts`], { encoding: "utf8" })
  .replace('"./poolGeometry"', JSON.stringify(join(root, "src/components/pool/three/poolGeometry.ts")));
const file = join(root, "node_modules/.cache/paving-performance-audit.mjs");
await build({ input: "paving-performance-entry", output: { file, format: "esm" }, platform: "node", external: ["three"],
  resolve: { alias: { "@": join(root, "src") } }, plugins: [{ name: "paving-performance-entry",
    resolveId: id => ["paving-performance-entry", "paving-baseline.ts"].includes(id) ? id : null,
    load: id => id === "paving-baseline.ts" ? baselineSource : id === "paving-performance-entry" ? `
      export * as baseline from "paving-baseline.ts";
      export * as candidate from "${root}/src/components/pool/three/pavingGeometry.ts";
      export { buildOutline, offsetOutline } from "${root}/src/lib/pool/geometry.ts";
    ` : null,
  }],
});
const { baseline, candidate, buildOutline, offsetOutline } = await import(pathToFileURL(file).href);
let checks = 0;
const equal = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };
for (const pitch of [.14, .3, .5, .6, 1, 1.2, 2.2]) for (const stagger of [false, true]) {
  for (let i = 0; i < 20; i++) {
    const bounds = [-6.41 + i * .0137, -.25, .25, 6.41 - i * .0071];
    equal(candidate.pavingGridOrigin(bounds, pitch, stagger), baseline.pavingGridOrigin(bounds, pitch, stagger), "unchanged exact bond origin/tie handling");
  }
  equal(candidate.pavingGridOrigin([], pitch, stagger), baseline.pavingGridOrigin([], pitch, stagger), "empty surface origin unchanged");
}
const modules = [[.6,.3],[.6,.6],[1.2,.6],[.5,.5],[1,.5],[2.2,.14]];
const cases = [];
for (const [length, width] of [[6,3],[8,4],[12,5]]) for (const shape of ["rectangle","l-shape","organic"]) {
  const outline = buildOutline(shape, {length,width,depth:1.5,cornerRadius:0}, []);
  const inner = offsetOutline(outline, .32), outer = offsetOutline(inner, 3.6);
  for (const module of modules) cases.push({shape,length,width,inner,outer,module,options:{gap:module[1]===.14?.005:.003,thickness:module[1]===.14?.028:.02,boards:module[1]===.14}});
}
for (const c of cases) {
  const before = baseline.createPavingModules(c.inner,c.outer,c.module,c.options);
  const after = candidate.createPavingModules(c.inner,c.outer,c.module,c.options);
  equal(Object.keys(after.attributes), Object.keys(before.attributes), "same geometry attributes");
  for (const key of Object.keys(before.attributes)) equal(after.attributes[key].array,before.attributes[key].array, `${c.shape} ${c.length}×${c.width} ${c.module}: byte-identical ${key}`);
  equal(after.index?.array,before.index?.array,"same index");
  equal(after.userData,before.userData,"same modules/origin/thickness/gap metadata");
  before.dispose(); after.dispose();
}
const timed = (implementation, c) => {
  const start = performance.now();
  const geometry = implementation.createPavingModules(c.inner,c.outer,c.module,c.options);
  const elapsed = performance.now() - start;
  geometry.dispose();
  return elapsed;
};
const median = a => [...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
const benchmarks = [];
for (const shape of ["rectangle","organic"]) for (const boards of [false,true]) {
  const c = cases.find(c=>c.shape===shape&&c.length===12&&c.options.boards===boards&&(boards||c.module[0]===1.2));
  for (let i=0;i<3;i++) { timed(baseline,c);timed(candidate,c); }
  const before=[],after=[];
  for (let pair=0;pair<3;pair++) {
    for (const implementation of pair%2?[candidate,baseline]:[baseline,candidate]) {
      const samples = Array.from({length:7},()=>timed(implementation,c));
      (implementation===baseline?before:after).push(median(samples));
    }
  }
  benchmarks.push({shape,material:boards?"boards":"stone",baselineMedianMs:median(before),candidateMedianMs:median(after),baselineRunsMs:before,candidateRunsMs:after});
}
const report = {result:"PASS",checks,baselineCommit,cases:cases.length,benchmarks,limits:"CPU geometry generation only; exact same output. Not FPS/GPU or physical-mobile measurements."};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
