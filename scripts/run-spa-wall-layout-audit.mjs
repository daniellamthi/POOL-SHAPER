import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import * as THREE from "three";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";
import {TessellateModifier} from "three/addons/modifiers/TessellateModifier.js";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const load=(p,require)=>runInNewContext(compile(readFileSync(p,"utf8"))+";exports;",{exports:{},require});
const catalogue=load("src/lib/pool/catalogue-architecture.ts");
const lounger=load("src/components/pool/three/catalogueLounger.ts",id=>id==="three"?THREE:id.includes("RoundedBoxGeometry")?{RoundedBoxGeometry}:id.includes("TessellateModifier")?{TessellateModifier}:id.includes("BufferGeometryUtils")?{mergeGeometries}:catalogue);
const parts=load("src/components/pool/three/cataloguePartGeometry.ts",id=>id==="three"?THREE:id.includes("RoundedBoxGeometry")?{RoundedBoxGeometry}:lounger);
const deckSource=ts.createSourceFile("studioDeck.ts",readFileSync("src/components/pool/three/studioDeck.ts","utf8"),ts.ScriptTarget.Latest,true);
let helper;deckSource.forEachChild(n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text==="extendStudioDeckToRoom")helper=n.getText(deckSource);});
const extend=helper?runInNewContext(compile(helper)+";extendStudioDeckToRoom;",{exports:{}}):undefined;
const failures=[];const check=(ok,name)=>{if(!ok)failures.push(name);};let cases=0;
for(const [l,w] of [[3,2],[7,3],[10,4.5]])for(const rotated of [false,true]){
 const outline=[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([x,z])=>rotated?[z+7,x-4]:[x+7,z-4]);
 const plan=catalogue.planCatalogueArchitecture(outline,"spa-wall",.35,.4);
 check(!!plan.pavingOutline,"SPA wall has a complete room floor boundary");
 for(const part of plan.parts.filter(p=>p.profile==="lounger-frame")){
  check(Math.abs(part.s[0]-.738)<1e-8&&Math.abs(part.s[2]-1.818)<1e-8,"SPA wall chaise footprint is reduced by 10%");
  const g=parts.createCataloguePartGeometry(part);g.computeBoundingBox();const b=g.boundingBox;
  check(b.min.x>=part.p[0]-part.s[0]/2-1e-5&&b.max.x<=part.p[0]+part.s[0]/2+1e-5,"Actual frame fits its reduced metric width");
  check(b.min.y>=.4-1e-5,"Reduced frame remains grounded");g.dispose();
 }
 if(plan.pavingOutline&&extend){
  const terrace=outline.map(([x,z])=>[x*1.02,z*1.02]);const outer=extend(terrace,plan.pavingOutline);
  const xs=outer.map(p=>p[0]),zs=outer.map(p=>p[1]);
  for(const [x,z] of [...terrace,...plan.pavingOutline])check(x>=Math.min(...xs)-1e-9&&x<=Math.max(...xs)+1e-9&&z>=Math.min(...zs)-1e-9&&z<=Math.max(...zs)+1e-9,"Paving covers the whole room without shrinking the existing terrace");
 }
 cases++;
}
for(const [l,w] of [[3,2],[7,3],[12,6]])for(const rotated of [false,true]){
 const outline=[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([x,z])=>rotated?[z+7,-x-4]:[x+7,z-4]);
 const plan=catalogue.planCatalogueArchitecture(outline,"spa-glass",.35,.4);
 check(!!plan.pavingOutline,"SPA glass has a complete room floor boundary");
 check(plan.parts.filter(p=>p.profile==="lounger-frame").every(p=>Math.abs(p.s[0]-.82)<1e-8),"SPA glass furniture keeps its existing metric size");
 if(plan.pavingOutline&&extend){
  const terrace=outline.map(([x,z])=>[x*1.02,z*1.02]);const outer=extend(terrace,plan.pavingOutline);
  const xs=outer.map(p=>p[0]),zs=outer.map(p=>p[1]);
  const inside=([x,z])=>x>=Math.min(...xs)-1e-8&&x<=Math.max(...xs)+1e-8&&z>=Math.min(...zs)-1e-8&&z<=Math.max(...zs)+1e-8;
  for(const p of [...terrace,...plan.pavingOutline])check(inside(p),"SPA glass paving covers the room without shrinking the terrace");
  // All full-height side/far walls and glazing must meet paving, not grass.
  for(const part of plan.parts.filter(p=>p.s[1]>3&&p.p[1]<3))for(const dx of [-1,1])for(const dz of [-1,1]){
   const u=part.p[0]+dx*part.s[0]/2,v=part.p[2]+dz*part.s[2]/2;
   const c=Math.cos(plan.angle),s=Math.sin(plan.angle);
   check(inside([plan.centre[0]+c*u+s*v,plan.centre[1]-s*u+c*v]),"SPA glass paving reaches every room wall/glazing base");
  }
 }
 cases++;
}
check(!!extend,"Paving can extend to a room boundary");
if(extend){const outline=[[0,0],[1,0],[1,1],[0,1]];assert.equal(extend(outline),outline,"Other environments retain their exact original terrace");}
for(const setting of ["spa-glass","residence","infinity-villa"]){
 const plan=catalogue.planCatalogueArchitecture([[-3.5,-1.5],[3.5,-1.5],[3.5,1.5],[-3.5,1.5]],setting,.35,0);
 check(setting === "infinity-villa" ? !plan.pavingOutline : !!plan.pavingOutline,"Both SPAs and residence extend their selected paving; Infinity stays unchanged");
 check(plan.parts.filter(p=>p.profile==="lounger-frame").every(p=>Math.abs(p.s[0]-.82)<1e-8),"Other contexts retain their chaise size");
}
console.log(JSON.stringify({cases,failures:[...new Set(failures)]}));assert.equal(failures.length,0,"SPA wall floor and chaise regression");
