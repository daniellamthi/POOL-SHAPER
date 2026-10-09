import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";
import { focusForAction, contextualIntent, nextFocusRequest, wholePoolIntent } from "../src/lib/pool/contextual-camera";
import { contextualAccessCamera, dimensionFrustum, getAccessDetailCamera, getCameraPose, infinityNavigationLimits, visibleCameraFrame, cameraFrameFit, offsetCameraToFrame } from "../src/lib/pool/camera";
import { reducer } from "../src/lib/pool/store";
import { infinityZonesForOutline } from "../src/lib/pool/infinity-edge";
import { coastalCamera } from "../src/components/pool/three/coastalLayout";
import { parseProjectConfiguration } from "../src/lib/pool/project";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { buildOutline, offsetOutline } from "../src/lib/pool/geometry";
import { copingOuterOffset } from "../src/components/pool/three/poolConstruction";
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
let state=reducer({config:base,renovation:project.renovation,projectId:"infinity-camera-audit",step:4},{type:"setSystem",value:"infinity"});
ok(state.config.infinityEdge?.enabled && state.config.infinityEdge.side!==null,"Infinity selection atomically includes valid side");
equal(state.visualFocus?.focus,"INFINITY");
const zones=infinityZonesForOutline(buildOutline(base.shape,base.dimensions,base.controlPoints),base.shape);
for(const zone of zones) {
 state=reducer(state,{type:"setInfinitySide",value:zone.side});
 state=reducer(state,{type:"setSystem",value:"skimmer"});
 ok(!state.config.infinityEdge,"inactive Infinity stripped from canonical data");
 state=reducer(state,{type:"setSystem",value:"infinity"});
 equal(state.config.infinityEdge?.side,zone.side);
 equal(state.visualFocus?.focus,"INFINITY");
}
const legacyProject={...project,config:{...base,system:"infinity" as const}};
const restored=parseProjectConfiguration(JSON.stringify(legacyProject));
ok(restored.config.infinityEdge?.enabled,"legacy Infinity without side restores directly to valid edge");
const partialEdge={enabled:true,side:1,startT:0.15,endT:0.85,dropDirection:"outward" as const};
// Partial lips are not supported by the existing renderer: its canonical
// clamp explicitly restores whole-side coverage. Preserve that contract.
const fullEdge={...partialEdge,startT:0,endT:1};
equal(parseProjectConfiguration(JSON.stringify({...legacyProject,config:{...legacyProject.config,infinityEdge:partialEdge}})).config.infinityEdge,fullEdge);
const partialState={...state,config:{...state.config,infinityEdge:partialEdge}};
equal(reducer(partialState,{type:"setSystem",value:"infinity"}).config.infinityEdge,fullEdge);
equal(reducer(partialState,{type:"setDimension",key:"length",value:12}).config.infinityEdge,fullEdge);
for(const intent of ["access","inox","shelf","hydromassage","bench"] as const) {
 equal(wholePoolIntent(intent,"access","infinity"),intent);
 equal(wholePoolIntent(intent,"review","infinity"),"review");
 equal(wholePoolIntent(intent,"access","skimmer"),"review");
 equal(wholePoolIntent(intent,"access","overflow"),"review");
}
equal(visibleCameraFrame({left:0,top:0,width:390,height:350},[{left:0,top:100,width:390,height:600}]),{left:0,top:0,width:390,height:100});
equal(visibleCameraFrame({left:0,top:0,width:1100,height:450},[{left:0,top:470,width:1100,height:400}]),{left:0,top:0,width:1100,height:450});
equal(visibleCameraFrame({left:0,top:0,width:372,height:310},[{left:190,top:60,width:170,height:35},{left:170,top:250,width:190,height:40}]),{left:0,top:103,width:372,height:139});
const shortMobileOverlays=[{left:0,top:100,width:390,height:600},{left:12,top:12,width:150,height:36},{left:208,top:64,width:170,height:35}];
const shortMobileFrame=visibleCameraFrame({left:0,top:0,width:390,height:350},shortMobileOverlays);
ok(shortMobileFrame.width>=180&&shortMobileFrame.height>=40,"real mobile HUD retains a viable rectangle beside badges");
for(const [length,width] of [[6,3],[8,4],[12,5],[16,4.5],[20,4.5],[25,5]]) {
 const c={...base,system:"infinity" as const,dimensions:{...base.dimensions,length:length!,width:width!}};
 const outline=buildOutline(c.shape,c.dimensions,c.controlPoints);
 const layout=getPoolVerticalLayout({poolType:"in-ground",system:"infinity",overflowType:"hidden",depth:1.5,copingThickness:0.04});
 for(const zone of infinityZonesForOutline(outline,c.shape)) {
  for(const aspect of [2.406,1.7,1,0.6,0.5]) {
   const outset=copingOuterOffset("infinity","hidden");
   const hero=coastalCamera(outline,zone,layout.waterY,aspect,34,{outset,y:layout.copingY}), limits=infinityNavigationLimits(hero,false,layout.waterY);
   const heroCamera=new PerspectiveCamera(hero.fov,aspect,0.05,1000);heroCamera.position.set(...hero.position);heroCamera.lookAt(new Vector3(...hero.target));heroCamera.updateMatrixWorld();
   for(const [x,z] of offsetOutline(outline,outset)) { const corner=new Vector3(x,layout.copingY,z).project(heroCamera);ok(Math.abs(corner.x)<0.98&&corner.y>-.73&&corner.y<0.98,`Infinity Hero coping fit ${length}x${width}, side${zone.side}, aspect${aspect}: ${corner.toArray()}`); }
   ok(limits.minDistance<=limits.maxDistance,"navigation remains nonempty");
   ok(hero.target[1]+limits.minDistance*Math.cos(limits.maxPolarAngle)>=layout.waterY+0.399,"closest/lowest orbit remains above real waterline");
  }
  for(const kind of ["sunShelf","hydromassage"] as const) for(const variant of ["open","closed"] as const) {
   const resolved=configuredPoolLayout({...c,features:[kind],hydromassageVariant:variant,infinityEdge:{enabled:true,side:zone.side,startT:0,endT:1,dropDirection:"outward"}});
   const element=resolved.comfort.elements.find(e=>e.kind===kind); if(!element) continue;
   for(const [w,h,visibleHeight] of [[390,350,100],[430,450,180],[1100,450,450],[390,350,101]]) {
    const frame=visibleHeight===101 ? shortMobileFrame : visibleCameraFrame({left:0,top:0,width:w!,height:h!},[{left:0,top:visibleHeight!,width:w!,height:600},
     {left: w!*.6,top:10,width: w!*.35,height:20},{left: w!*.6,top: visibleHeight! - 25,width: w!*.35,height:20}]);
    const fit=cameraFrameFit(34,h!,frame);
    const rawPose=contextualAccessCamera(kind==="sunShelf"?"shelf":"hydromassage",resolved,layout,outline,fit.verticalFov,fit.aspect,zone)!;
    const pose=offsetCameraToFrame(rawPose,34,w!,h!,frame);
    const camera=new PerspectiveCamera(34,w!/h!,0.05,500); camera.position.set(...pose.position);camera.lookAt(new Vector3(...pose.target));camera.updateMatrixWorld();
    const parts=[element,...(element.tiers??[]),...(element.steps??[]),...(element.landing?[element.landing]:[])];
    for(const part of parts) for(const [x,z] of part.footprint) {
     const point=new Vector3(x,part.topY,z).project(camera), px=(point.x+1)*w!/2, py=(1-point.y)*h!/2;
     ok(px>frame.left+frame.width*.02 && px<frame.left+frame.width*.98 && py>frame.top+frame.height*.02 && py<frame.top+frame.height*.98,"actual full-canvas projection fits unobscured frame");
     ok(point.z>-1&&point.z<1,"detail lies inside actual near/far clipping planes");
    }
   }
  }
 }
}
ok(!serializeProjectConfiguration(project).includes("visualFocus"),"presentation never persisted");
const scene=readFileSync("src/components/pool/three/PoolScene.tsx","utf8");
ok(scene.includes('cameraFrameFit(SCENE_VISUAL_PRESET.camera.fov') && scene.includes('pose = offsetCameraToFrame(pose,'),"rendered camera uses tested visible-frame fitting");
ok(scene.includes('new OrthographicCamera(')&&scene.includes('.manual = true'),"real manual orthographic camera survives DPR changes");
ok(scene.includes('maxPolarAngle={focus === "top" ? Math.PI / 2'),"true downward plan cannot tilt under controls");
ok(scene.includes('if (cameraLocked || infinityZone ||'),"Infinity switches directly");
ok(scene.includes('if (editingPose.current?.key !== editKey)'),"depth editing freezes pose");
console.log(`PASS: ${checks} contextual camera checks — semantics, orthographic metric scale, persistence isolation, actual access/comfort, stable edits, mobile aspect.`);
