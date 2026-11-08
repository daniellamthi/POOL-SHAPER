import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PerspectiveCamera,Vector3} from 'three';
const require=createRequire(import.meta.url);
const load=path=>runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText+';exports;',{exports:{},require});
const {planCatalogueArchitecture:plan}=load('src/lib/pool/catalogue-architecture.ts');
const {fitCatalogueCamera:fit}=load('src/lib/pool/catalogue-camera.ts');
let cases=0;
for(const setting of ['residence','infinity-villa'])for(const [l,w] of [[3,2],[10,4.5],[25,8]])for(const normal of [[1,0],[-1,0],[0,1],[0,-1]]){
 const p=plan([[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]],setting,0,0,setting==='infinity-villa'?normal:undefined);
 const before=JSON.stringify(p);
 for(const aspect of [390/401,390/844,430/560]){
  const pose=fit(p,aspect,true),camera=new PerspectiveCamera(pose.fov,aspect,.05,1000);
  camera.position.set(...pose.position);camera.lookAt(new Vector3(...pose.target));camera.updateMatrixWorld(true);
  for(const x of [-p.length/2,p.length/2])for(const z of [-p.width/2,p.width/2]){
   const q=new Vector3(p.centre[0]+Math.cos(p.angle)*x+Math.sin(p.angle)*z,0,p.centre[1]-Math.sin(p.angle)*x+Math.cos(p.angle)*z).project(camera);
   assert(Math.abs(q.x)<.91&&Math.abs(q.y)<.91&&q.z>-1&&q.z<1,'entire metric pool fits the portrait free frame');
  }
  assert.equal(pose.position[1],p.camera.position[1]);cases++;
 }
 assert.equal(fit(p,1.4,false),p.camera,'desktop pose unchanged');
 assert.equal(JSON.stringify(p),before,'no mutation of plan');
}
for(const setting of ['spa-wall','spa-glass']){
 const p=plan([[-5,-2],[5,-2],[5,2],[-5,2]],setting,.35,0);
 assert.equal(fit(p,.7,true).fov,72);assert.equal(fit(p,.98,true).fov,p.camera.fov,'indoor lens retains previous visible-frame behaviour');
}
console.log(`PASS: ${cases} outdoor portrait fits, pool corners in frustum, unchanged eye height/desktop/indoor lens policy`);

for(const setting of ['spa-wall','spa-glass'])for(const [l,w] of [[3,2],[10,4.5],[25,8]])for(const rotate of [false,true]){
 const outline=[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([x,z])=>rotate?[z,x]:[x,z]);
 const p=plan(outline,setting,0,0),pos=p.camera.position;
 const u=(pos[0]-p.centre[0])*Math.cos(p.angle)-(pos[2]-p.centre[1])*Math.sin(p.angle);
 const v=(pos[0]-p.centre[0])*Math.sin(p.angle)+(pos[2]-p.centre[1])*Math.cos(p.angle);
 assert(u>-p.length/2&&u<p.length/2,'eye stands alongside the long pool edge');
 assert(v>p.width/2&&v<p.width/2+3.5,'eye remains inside the poolside aisle');
 assert.equal(pos[1],1.65);
}
console.log('PASS: 12 metric indoor viewpoints alongside the basin, within the aisle at 1.65 m');

const sceneAst=ts.createSourceFile('PoolScene.tsx',readFileSync('src/components/pool/three/PoolScene.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let heroExpression;const findHero=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(sceneAst)==='architectureHero')heroExpression=n.initializer.getText(sceneAst);ts.forEachChild(n,findHero);};findHero(sceneAst);
const usesIndoorCamera=runInNewContext(`(architecture,focus)=>(${heroExpression})`);let routingCases=0;
for(const architecture of [null,{indoor:true},{indoor:false}])for(const focus of ['review','overview','features','stair-lighting','bench-lighting','top','structure','cover','access','paving','coping','waterline']){
 const expected=!!architecture&&(['review','overview'].includes(focus)||(architecture.indoor&&['features','stair-lighting','bench-lighting'].includes(focus)));
 assert.equal(usesIndoorCamera(architecture,focus),expected,`SPA lighting stays under the roof; other cameras are preserved: ${focus}`);routingCases++;
}
console.log(`PASS: ${routingCases} indoor-lighting camera routes, unchanged outdoor/raw/detail routes`);
