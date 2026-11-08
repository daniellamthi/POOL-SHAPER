import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=file=>vm.runInNewContext(ts.transpile(fs.readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022})+';exports;',{exports:{}}).planCatalogueArchitecture;
const plan=compile('src/lib/pool/catalogue-architecture.ts');
let cases=0;
for(const [l,w] of [[3,2],[7,3],[12,6],[25,8]])for(const rotate of [false,true])for(const ground of [0,.35]){
 const basin=[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([x,z])=>rotate?[z+7,-x-4]:[x+7,z-4]);
 const p=plan(basin,'residence',.35,ground),rear=p.length/2+4.6;
 const slats=p.parts.filter(part=>part.finish==='wood' && part.s[1]>3 && part.s[0]<.04);
 assert(slats.length>=35 && slats.length<=45,'metric vertical oak battens required, independent of pool size');
 const ordered=[...slats].sort((a,b)=>a.p[2]-b.p[2]);
 for(const b of ordered){
  assert(Math.abs(b.s[1]-3.24)<1e-9 && Math.abs(b.s[0]-.024)<1e-9);
  assert(b.p[1]-b.s[1]/2>=ground+.025 && b.p[1]+b.s[1]/2<=ground+3.28);
  assert(b.p[0]+b.s[0]/2<=rear-.125-0.005,'recess in front of structural backing, no coincident face');
  assert(b.p[2]-b.s[2]/2>=-1.75 && b.p[2]+b.s[2]/2<=1.75,'inside existing opaque bay, never windows');
 }
 for(let i=1;i<ordered.length;i++){
  const gap=ordered[i].p[2]-ordered[i-1].p[2]-(ordered[i].s[2]+ordered[i-1].s[2])/2;
  assert(gap>=.009 && gap<=.013,'physical reveal gap');
 }
 const finishes=new Set(p.parts.map(x=>x.finish));
 assert(p.parts.length<260,'keep existing catalogue part budget');
 assert(finishes.size===9,'no new material batch');
 cases++;
}
console.log(`PASS: ${cases} metric facade layouts including small/large pools, rotations and ground offsets; board size/gaps, glazing clearance, existing material/part budget. Native visual verification separate.`);
