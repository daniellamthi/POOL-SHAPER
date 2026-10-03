import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OrthographicCamera, Vector3 } from "three";
import { focusForAction, contextualIntent, nextFocusRequest } from "../src/lib/pool/contextual-camera";
import { contextualAccessCamera, dimensionFrustum, getAccessDetailCamera, getCameraPose } from "../src/lib/pool/camera";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { buildOutline } from "../src/lib/pool/geometry";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { DEFAULT_CUSTOMER } from "../src/lib/pool/config";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import { toProjectConfiguration, serializeProjectConfiguration } from "../src/lib/pool/project";
import type { PoolConfig } from "../src/lib/pool/types";

const base: PoolConfig = { projectType:"new", poolType:"in-ground", structure:"reinforced-concrete", shape:"rectangle", shapeSelected:true,
 customMode:"draw", controlPoints:[], dimensions:{length:10,width:4.5,depth:1.5,cornerRadius:0}, system:"skimmer", overflowType:"hidden",
 skimmerFinish:"white",skimmerType:"standard",finish:"liner",linerColor:"motionSandBeach179",mosaicFinish:DEFAULT_MOSAIC_FINISH_ID,
 copingMaterial:"travertine",features:[],poolAccess:"internalSteps",internalStairType:"linear",equipment:[],customer:DEFAULT_CUSTOMER,uploads:[] };
let checks=0;
function equal(a: unknown,b: unknown) { assert.deepEqual(a,b); checks++; }
function ok(value: unknown,message: string) { assert.ok(value,message); checks++; }
equal(focusForAction({type:"setDimension",key:"length"},base),"DIMENSIONS_TOP");
equal(focusForAction({type:"setDimension",key:"width"},base),"DIMENSIONS_TOP");
for(const key of ["depth","shallowDepth"]) equal(focusForAction({type:"setDimension",key},base),"DEPTH");
equal(contextualIntent("DIMENSIONS_TOP",base),"top"); equal(contextualIntent("DEPTH",base),"depth");
let request=nextFocusRequest(null,"DIMENSIONS_TOP");
for(let tick=0;tick<200;tick++) equal(nextFocusRequest(request,"DIMENSIONS_TOP"),request);
request=nextFocusRequest(request,"DEPTH");
for(let tick=0;tick<20;tick++) equal(nextFocusRequest(request,"DEPTH"),request);
equal(nextFocusRequest(request,null),null);
equal(focusForAction({type:"toggleInoxLadder"},{...base,features:["inoxLadder"]}),"INOX");
equal(focusForAction({type:"toggleInoxLadder"},base),"STAIRS");
equal(focusForAction({type:"togglePoolFeature",value:"sunShelf"},{...base,features:["sunShelf"]}),"SUN_SHELF");
equal(focusForAction({type:"setHydromassageVariant",value:"open"},{...base,features:["hydromassage"]}),"HYDROMASSAGE");
equal(focusForAction({type:"togglePoolFeature",value:"ledLighting"},base),"LIGHTING");
equal(focusForAction({type:"setPremiumEnvironment",value:"indoor-wellness"},base),undefined);
equal(focusForAction({type:"next"},base),null);
for(const system of ["skimmer","overflow","infinity"] as const) {
 const c={...base,system}; equal(focusForAction({type:"setSystem",value:system},c),system==="infinity"?"INFINITY":system==="overflow"?"OVERFLOW":"SKIMMER");
}
for(const [length,width] of [[6,3],[8,4],[10,4.5],[12,5]]) for(const aspect of [0.65,1,1.6]) {
 const c={...base,dimensions:{...base.dimensions,length:length!,width:width!},features:["inoxLadder"] as PoolConfig["features"]};
 const outline=buildOutline(c.shape,c.dimensions,c.controlPoints), fit=dimensionFrustum(outline,aspect);
 const camera=new OrthographicCamera(-fit.width/2,fit.width/2,fit.height/2,-fit.height/2,0.1,1000);
 camera.up.set(0,0,-1); camera.position.set(0,30,0); camera.lookAt(0,0,0); camera.updateMatrixWorld();
 for(const [x,z] of outline) { const p=new Vector3(x,0,z).project(camera); ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,"plan fully inside frustum"); }
 const a=new Vector3(0,0,0).project(camera), b=new Vector3(1,0,0).project(camera), d=new Vector3(0,0,1).project(camera);
 ok(Math.abs(Math.abs(b.x-a.x)*aspect-Math.abs(d.y-a.y))<1e-10,"same metric scale X/Z, no perspective");
 const layout=getPoolVerticalLayout({poolType:"in-ground",system:"skimmer",overflowType:"hidden",depth:1.5,copingThickness:0.04});
 const resolved=configuredPoolLayout(c);
 const inox=contextualAccessCamera("inox",resolved,layout,outline,34,aspect);
 ok(inox&&inox.position.every(Number.isFinite),"resolved optional inox framing");
 equal(getCameraPose({intent:"access",accessPlan:resolved.access,outline,layout,depth:1.5,skimmers:{positions:[],count:0} as never,viewportAspect:aspect,verticalFov:34}),getAccessDetailCamera(resolved.access,layout,34,aspect));
 for(const kind of ["sunShelf","hydromassage"] as const) {
  const comfort={...c,features:[kind]};
  const open=configuredPoolLayout({...comfort,hydromassageVariant:"open"});
  const closed=configuredPoolLayout({...comfort,hydromassageVariant:"closed"});
  const intent=kind==="sunShelf"?"shelf":"hydromassage";
  const pose=contextualAccessCamera(intent,open,layout,outline,34,aspect);
  if(open.comfort.elements.some(e=>e.kind===kind)) ok(pose?.position.every(Number.isFinite),"comfort uses actual geometry");
  if(kind==="hydromassage") equal(pose,contextualAccessCamera(intent,closed,layout,outline,34,aspect));
 }
}
const project=toProjectConfiguration("camera-audit",base,{areas:[],currentFinish:"liner",filtrationWorks:[],replaceCoping:null,copingMaterial:"",structureIssues:[],equipmentUpgrades:[]});
ok(!serializeProjectConfiguration(project).includes("visualFocus"),"presentation never persisted");
const scene=readFileSync("src/components/pool/three/PoolScene.tsx","utf8");
ok(scene.includes('new OrthographicCamera(')&&scene.includes('.manual = true'),"real manual orthographic camera survives DPR changes");
ok(scene.includes('maxPolarAngle={focus === "top" ? Math.PI / 2'),"true downward plan cannot tilt under controls");
ok(scene.includes('if (cameraLocked || infinityZone ||'),"Infinity switches directly");
ok(scene.includes('if (editingPose.current?.key !== editKey)'),"depth editing freezes pose");
console.log(`PASS: ${checks} contextual camera checks — semantics, orthographic metric scale, persistence isolation, actual access/comfort, stable edits, mobile aspect.`);
