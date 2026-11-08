import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const {planCatalogueArchitecture:plan}=runInNewContext(compile(readFileSync('src/lib/pool/catalogue-architecture.ts','utf8'))+';exports;',{exports:{}});
const deck=ts.createSourceFile('studioDeck.ts',readFileSync('src/components/pool/three/studioDeck.ts','utf8'),ts.ScriptTarget.Latest,true);
let helper;deck.forEachChild(n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text==='extendStudioDeckToRoom')helper=n.getText(deck);});
const extend=runInNewContext(compile(helper)+';extendStudioDeckToRoom;',{exports:{}});
const failures=[];let cases=0,checks=0;
const check=(ok,message)=>{checks++;if(!ok)failures.push(message);};
for(const [l,w] of [[3,2],[7,3],[12,6]])for(const rotated of [false,true])for(const ground of [0,.35]){
 const basin=[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([x,z])=>rotated?[z+7,-x-4]:[x+7,z-4]);
 const p=plan(basin,'residence',.35,ground);
 check(!!p.pavingOutline,'Residence supplies a paving footprint');
 check(!p.parts.some(b=>b.finish==='stone'&&b.s[1]<.17&&b.p[1]>ground&&b.p[2]>-w/2-3),'No raised building slab masks the chosen paving');
 const plinths=p.parts.filter(b=>b.finish==='plaster'&&b.s[1]===3&&b.p[1]<ground);
 check(plinths.length===2,'Both supporting plinths remain');
 check(plinths.every(b=>b.p[1]+b.s[1]/2<ground-.001),'Foundation top avoids a coplanar face at the paving surface');
 if(p.pavingOutline){
  const outer=extend(basin,p.pavingOutline),xs=outer.map(v=>v[0]),zs=outer.map(v=>v[1]);
  const inside=([x,z])=>x>=Math.min(...xs)-1e-8&&x<=Math.max(...xs)+1e-8&&z>=Math.min(...zs)-1e-8&&z<=Math.max(...zs)+1e-8;
  for(const b of p.parts.filter(b=>b.finish==='plaster'&&b.s[1]>=3&&b.p[1]<ground+2))for(const dx of [-1,1])for(const dz of [-1,1]){
   const x=b.p[0]+dx*b.s[0]/2,z=b.p[2]+dz*b.s[2]/2,c=Math.cos(p.angle),s=Math.sin(p.angle);
   check(inside([p.centre[0]+c*x+s*z,p.centre[1]-s*x+c*z]),'Chosen paving covers both wings and all exterior wall bases');
  }
  check(outer.length===4,'Outer paved corners remain square');
 }
 cases++;
}
console.log(JSON.stringify({cases,checks,failures:[...new Set(failures)]}));
assert.equal(failures.length,0,'Residence floor continuity');
