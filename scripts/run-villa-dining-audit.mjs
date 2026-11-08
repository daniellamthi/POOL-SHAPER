import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const ts=createRequire(process.cwd()+'/package.json')('typescript');
const source=fs.readFileSync('src/lib/pool/catalogue-architecture.ts','utf8');
const plan=vm.runInNewContext(ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022})+';exports;',{exports:{}}).planCatalogueArchitecture;
let layouts=0;
for(const [l,w] of [[3,2],[7,3],[12,6],[25,8]])for(const rotated of [false,true])for(const ground of [0,.35]){
 const outline=[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([x,z])=>rotated?[z+7,-x-4]:[x+7,z-4]);
 const p=plan(outline,'residence',.35,ground),rear=p.length/2+4.6;
 const interior=p.parts.filter(b=>b.p[0]>rear+.4&&b.p[0]<rear+3.8&&b.p[1]>ground&&b.p[1]<ground+1.1&&b.p[2]>1.75);
 const table=interior.find(b=>b.finish==='wood'&&Math.abs(b.s[0]-1.6)<1e-8&&Math.abs(b.s[2]-.85)<1e-8);
 assert(table,'Human-scale dining table behind rear residence glazing');
 assert(Math.abs(table.p[1]+table.s[1]/2-ground-.75)<1e-8,'750mm dining top, independent of pool size');
 const seats=interior.filter(b=>b.finish==='linen'&&Math.abs(b.s[0]-.48)<1e-8&&Math.abs(b.s[2]-.44)<1e-8);
 assert.equal(seats.length,4,'Four fixed-size dining chairs');
 for(const b of interior){
  assert(b.p[0]-b.s[0]/2>=rear+.6,'Clear passage behind the front glass');
  assert(b.p[0]+b.s[0]/2<=rear+3.6,'Clear of rear wall');
  assert(b.p[2]-b.s[2]/2>=1.75+.5,'Clear of opaque centre bay');
  assert(b.p[2]+b.s[2]/2<=p.width/2+4.7-.5,'Fits even the smallest window bay');
  assert(b.p[1]-b.s[1]/2>=ground-.0001,'No floating below-ground furniture');
 }
 for(const seat of seats){
  assert(Math.abs(seat.p[1]+seat.s[1]/2-ground-.46)<1e-8,'460mm seat height');
  const legs=interior.filter(b=>b.finish==='wood'&&b.s[0]===.035&&b.s[2]===.035&&Math.abs(b.p[0]-seat.p[0])<.25&&Math.abs(b.p[2]-seat.p[2])<.24);
  assert.equal(legs.length,4,'Every chair has four grounded legs');
  const back=interior.find(b=>b.finish==='wood'&&b.s[0]===.48&&Math.abs(b.p[0]-seat.p[0])<1e-8&&Math.abs(b.p[2]-seat.p[2])<.24);
  assert(back,'Chair backrest present');
  assert.equal(legs.filter(leg=>Math.abs(leg.p[2]-back.p[2])<.01&&leg.p[1]+leg.s[1]/2>=back.p[1]-back.s[1]/2).length,2,'Backrest is supported by two grounded rear posts');

  assert(legs.every(b=>Math.abs(b.p[1]-b.s[1]/2-ground)<1e-8),'Chair legs touch the selected paving');
 }
 assert(p.parts.length<260,'Existing static part budget');
 layouts++;
}
console.log(`PASS: ${layouts} metric dining layouts; table/seat heights, fixed furniture scale, 4 grounded chairs, passage/wall/glazing clearance and existing part budget. Visual acceptance separate.`);
