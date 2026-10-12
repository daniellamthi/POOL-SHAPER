import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BoxGeometry, Matrix4, OrthographicCamera, Vector3 } from "three";
import { architecturalEdges, architecturalFrustum } from "../src/components/pool/three/architecturalPlan";
import { createSurfaceGeometry, createRingGeometry } from "../src/components/pool/three/poolGeometry";
import { buildOutline, offsetOutline } from "../src/lib/pool/geometry";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { shelfStairGeometry } from "../src/components/pool/three/PoolComfortModel";
import { DEFAULT_CUSTOMER } from "../src/lib/pool/config";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import type { PoolConfig } from "../src/lib/pool/types";
let checks = 0;
function ok(value: unknown, message: string) { assert.ok(value,message); checks++; }
const box = new BoxGeometry(2,1,3);
for (const geometry of [box,box.toNonIndexed()]) {
 const edges=architecturalEdges(geometry);
 ok(edges.length===8,"box: exactly four upper edges, no diagonals/underside");
 ok(edges.every(p=>Math.abs(p[1]-.506)<1e-6),"only upper surface");
 const moved=architecturalEdges(geometry,new Matrix4().makeTranslation(8,2,4));
 ok(moved.every(p=>p[0]>=7&&p[0]<=9&&p[2]>=2.5&&p[2]<=5.5),"actual world transform");
 geometry.dispose();
}
for(const shape of ["rectangle","l-shape"] as const) for(const [length,width] of [[6,3],[8,4],[12,5]]) {
 const outline=buildOutline(shape,{length:length!,width:width!,depth:1.5,cornerRadius:.35},[]);
 for(const geometry of [createSurfaceGeometry(outline),createRingGeometry(outline,offsetOutline(outline,.35))]) {
  const edges=architecturalEdges(geometry);
  ok(edges.length>0,"real configured surface boundary");
  ok(edges.every(p=>p.every(Number.isFinite)),"no invalid edge coordinates");
  // A convex rectangle surface has its four construction edges, never its diagonal.
  if(shape==="rectangle"&&geometry.getAttribute("position").count===4) ok(edges.length===8,"no triangulation");
  geometry.dispose();
 }
 for(const [w,h] of [[1440,900],[390,844],[430,932]]) for(const reserve of [0,180]) {
  const frame={left:20,top:44,width:w!-40,height:h!-100-reserve};
  const fit=architecturalFrustum(outline,w!,h!,frame);
  const camera=new OrthographicCamera(-fit.width/2,fit.width/2,fit.height/2,-fit.height/2,.1,1000);
  camera.up.set(0,0,-1);camera.position.set(fit.centre[0],30,fit.centre[1]);camera.lookAt(fit.centre[0],0,fit.centre[1]);camera.updateMatrixWorld();
  for(const [x,z] of outline) {
   const p=new Vector3(x,0,z).project(camera),px=(p.x+1)*w!/2,py=(1-p.y)*h!/2;
   ok(px>frame.left+16&&px<frame.left+frame.width-16&&py>frame.top+16&&py<frame.top+frame.height-16,"unobscured margins");
  }
  const a=new Vector3(0,0,0).project(camera),b=new Vector3(1,0,0).project(camera),c=new Vector3(0,0,1).project(camera);
  ok(Math.abs((b.x-a.x)*w!+ (c.y-a.y)*h!)<1e-8,"same metric scale both axes");
  const deep=new Vector3(1,-2,1).project(camera),shallow=new Vector3(1,0,1).project(camera);
  ok(Math.abs(deep.x-shallow.x)+Math.abs(deep.y-shallow.y)<1e-8,"perpendicular: depth cannot shift plan coordinates");
 }
}
// Actual resolved comfort solids, not hand-drawn 8x4 annotation fixtures.
for(const [length,width] of [[6,3],[8,4],[12,5]]) for(const system of ["skimmer","overflow","infinity"] as const)
for(const feature of ["sunShelf","hydromassage"] as const) for(const variant of ["open","closed"] as const) {
 const config:PoolConfig={projectType:"new",poolType:"in-ground",structure:"reinforced-concrete",shape:"rectangle",
  shapeSelected:true,customMode:"draw",controlPoints:[],dimensions:{length:length!,width:width!,depth:1.5,cornerRadius:0},
  system,overflowType:"visible",skimmerFinish:"white",skimmerType:"standard",finish:"liner",linerColor:"motionSandBeach179",
  mosaicFinish:DEFAULT_MOSAIC_FINISH_ID,copingMaterial:"travertine",features:[feature],poolAccess:"internalSteps",
  internalStairType:"linear",hydromassageVariant:variant,equipment:[],customer:DEFAULT_CUSTOMER,uploads:[],
  ...(system==="infinity"?{infinityEdge:{enabled:true,side:2,startT:0,endT:1,dropDirection:"outward" as const}}:{})};
 for(const element of configuredPoolLayout(config).comfort.elements) {
  const geometry=shelfStairGeometry(element,{floorYAt:()=>-1.5} as never);
  const edges=architecturalEdges(geometry);
  ok(edges.length>0,`${length}x${width} ${system} ${feature}/${variant}: contours from actual solid`);
  ok(edges.every(p=>p.every(Number.isFinite)&&p[1]>-1.49),"no floor-following underside or invalid coordinates");
  geometry.dispose();
 }
}
const scene=readFileSync("src/components/pool/three/PoolScene.tsx","utf8");
ok(scene.includes('focus === "top" && !photoMode'),"Photo Mode excludes outlines");
ok(scene.includes('if (outlines) outlines.visible = false;'),"hero capture hides technical overlay");
ok(scene.includes('if (outlines) outlines.visible = outlinesVisible ?? true;'),"hero restores previous visibility");
ok(!scene.includes("InfinityTechnicalOutline"),"no duplicate legacy annotation");
const overlay=readFileSync("src/components/pool/three/ArchitecturalOutline.tsx","utf8");
ok(!overlay.includes('["overflow-grille"'),"dense grille slats do not become a black wireframe band");
console.log(`PASS: ${checks} architectural geometry/framing/export checks`);
