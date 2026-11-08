import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
const source=readFileSync("src/lib/pool/catalogue-architecture.ts","utf8");
const {planCatalogueArchitecture:plan}=runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText+";exports;",{exports:{}});
let cases=0,minGap=Infinity,minWalkway=Infinity;
const rows=[];
for(const setting of ["spa-wall","spa-glass","residence","infinity-villa"])
for(const [l,w] of [[1,1],[3,2],[10,4.5],[25,8]])
for(const rotate of [false,true])
for(const normal of setting==="infinity-villa"?[[1,0],[-1,0],[0,1],[0,-1]]:[undefined]){
 const outline=[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([x,z])=>rotate?[z+7,x-4]:[x+7,z-4]);
 const p=plan(outline,setting,.35,.4,normal);assert(p);
 const frames=p.parts.filter(part=>part.profile==="lounger-frame").sort((a,b)=>a.p[0]-b.p[0]);
 assert(frames.length>=1&&frames.length<=4);
 for(const frame of frames){
  assert.deepEqual(Array.from(frame.s),setting === "spa-wall" ? [.82,.9,2.02].map(v=>v*.9) : [.82,.9,2.02],"Human-scale lounger must not be stretched with the pool");
  assert(Math.abs(frame.p[1]-frame.s[1]/2-.4)<1e-9,"Lounger stays on its ground datum");
  const walkway=frame.p[2]-frame.s[2]/2-(p.width/2+.35);
  assert(walkway>=.9-1e-9,"Keep at least the project target of 0.9m clear between coping and loungers");minWalkway=Math.min(minWalkway,walkway);
  assert(frame.p[0]-frame.s[0]/2>=-p.length/2-2.4,"Front terrace contains furniture");
  assert(frame.p[0]+frame.s[0]/2<=p.length/2+2.2,"Rear terrace contains furniture");
  if(p.indoor) assert(frame.p[2]+frame.s[2]/2<=p.width/2+3.5-.05+1e-9,"Chair back remains inside the room");
 }
 for(let i=1;i<frames.length;i++){
  const gap=frames[i].p[0]-frames[i].s[0]/2-(frames[i-1].p[0]+frames[i-1].s[0]/2);
  assert(gap>=.6-1e-9,`${setting} ${p.length}m: chairs need 0.6m separation, got ${gap.toFixed(3)}m`);minGap=Math.min(minGap,gap);
 }
 if(p.indoor){
  const windows=p.parts.filter(part=>part.finish==="glass");assert(windows.length);
  assert(windows.every(part=>part.s[1]>=2.4&&part.s[1]<=4),"Room glazing stays human-scale rather than stretching with pool dimensions");
 }
 rows.push({setting,length:p.length,width:p.width,loungers:frames.length});cases++;
}
console.log(JSON.stringify({status:"PASS",cases,loungerMetres:[.82,.9,2.02],spaWallLoungerMetres:[.738,.81,1.818],minimumChairGap:minGap,minimumCopingWalkway:minWalkway,limits:"Metric planner envelopes and intended clearances, not building-code compliance or a visual/performance test."}));
