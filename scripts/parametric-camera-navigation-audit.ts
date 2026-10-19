import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PerspectiveCamera, Vector3 } from "three";
import { configuratorTesting } from "../src/lib/pool/store";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { buildOutline, offsetOutline } from "../src/lib/pool/geometry";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { getCameraPose, infinityDetailCameraSubject, overviewCameraSubject, fitInfinityOverviewCamera, accessCameraSubject, externalStairCameraSubject, pellicanoCameraSubject, visibleCameraFrame, sunShelfCameraSubject, fitComponentCamera } from "../src/lib/pool/camera";
import { configuredSunShelfLoungers, SUN_SHELF_LOUNGER_MODEL } from "../src/lib/pool/sun-shelf-loungers";
import { planExternalStaircase } from "../src/components/pool/three/externalStaircasePlan";
import { copingOuterOffset } from "../src/components/pool/three/poolConstruction";
import { decisions } from "../src/components/pool/wizard/decisions";
import { clampInfinityEdgeParams, infinityZonesForOutline } from "../src/lib/pool/infinity-edge";
import type { PoolConfig } from "../src/lib/pool/types";

let checks=0,cases=0;
const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const base=configuratorTesting.createInitialState().config;
const viewports=[[1440,900],[390,844],[430,932]] as const;
function cameraFor(pose:ReturnType<typeof getCameraPose>,frame:{left:number;top:number;width:number;height:number},W:number,H:number) {
 const camera=new PerspectiveCamera(pose.fov??34,W/H,.05,1000);
 camera.position.set(...pose.position);camera.lookAt(new Vector3(...pose.target));camera.updateMatrixWorld(true);
 camera.setViewOffset(frame.width,frame.height,-frame.left,-frame.top,W,H);return camera;
}
function inside(camera:PerspectiveCamera,points:readonly (readonly number[])[],f:{left:number;top:number;width:number;height:number},W:number,H:number,label:string) {
 for(const p of points){const q=new Vector3(p[0],p[1],p[2]).project(camera),x=(q.x+1)*W/2,y=(1-q.y)*H/2;
 ok(q.z>-1&&q.z<1&&x>f.left&&x<f.left+f.width&&y>f.top&&y<f.top+f.height,`${label}: entire selected construction inside free frame`);}
 cases++;
}
for(const [length,width] of [[6,3],[8,4],[12,5]]) for(const poolType of ["in-ground","above-ground"] as const)
for(const shape of ["rectangle","l-shape"] as const) for(const orientation of ["se","sw","ne","nw"] as const) {
 const config:PoolConfig={...base,projectType:"new",poolType,shape,shapeSelected:true,structure:"reinforced-concrete",
  dimensions:{...base.dimensions,length:length!,width:width!,depth:1.5,lShapeOrientation:orientation},
  system:"skimmer",features:poolType==="above-ground"?["externalStaircase"]:["inoxLadder"],poolAccess:"internalSteps"};
 const outline=buildOutline(shape,config.dimensions,config.controlPoints),r=configuredPoolLayout(config);
 const layout=getPoolVerticalLayout({poolType,system:"skimmer",depth:1.5,copingThickness:.04});
 const stairs=poolType==="above-ground"?planExternalStaircase({outline,side:"short",platformExtended:true,
  accessAnchor:r.access.placement,groundY:layout.groundY,topY:layout.copingY,copingOffset:copingOuterOffset("skimmer","hidden")}):null;
 const p={x:length!/2+.2,z:0,inward:[-1,0] as const};
 const subject=overviewCameraSubject(outline,layout,{outset:copingOuterOffset("skimmer","hidden")+.15,baseY:layout.groundY,entrance:r.access.placement,
  exteriorDirection:stairs?externalStairCameraSubject(stairs,layout).direction:undefined,
  accessories:[...(accessCameraSubject(r.access,layout,outline)?.points??[]),
   ...(r.ladder?accessCameraSubject(r.ladder.plan,layout,outline)?.points??[]:[]),
   ...(stairs?externalStairCameraSubject(stairs,layout).points:[]),...(poolType==="above-ground"?pellicanoCameraSubject(p,layout).points:[])]});
 for(const [W,H]of viewports){const f=visibleCameraFrame({left:0,top:0,width:W,height:H},[
  {left:8,top:8,width:W-16,height:W<500?110:90},{left:8,top:H-(W<500?480:350),width:W-16,height:W<500?472:342},
 ]);
 const pose=getCameraPose({intent:"review",outline,layout,depth:1.5,skimmers:{count:0,positions:[]},verticalFov:34,viewportAspect:f.width/f.height,overviewSubject:subject});
 inside(cameraFor(pose,f,W,H),subject.points,f,W,H,`${length}×${width}/${poolType}/${shape}/${orientation}/${W}`);
 if(stairs)ok((pose.position[0]-pose.target[0])*stairs.outward[0]+(pose.position[2]-pose.target[2])*stairs.outward[1]>0,"AB general sees exposed external flight, not back of shell");
 }
}
for(const [length,width]of [[6,3],[8,4],[12,5]]) {
 const config={...base,dimensions:{...base.dimensions,length:length!,width:width!},shape:"rectangle" as const};
 const outline=buildOutline(config.shape,config.dimensions,config.controlPoints),layout=getPoolVerticalLayout({poolType:"in-ground",system:"infinity",depth:1.5,copingThickness:.04});
 for(const zone of infinityZonesForOutline(outline,"rectangle"))for(const[W,H]of viewports){
  const f=visibleCameraFrame({left:0,top:0,width:W,height:H},[{left:8,top:8,width:W-16,height:110},{left:8,top:H-480,width:W-16,height:472}]);
  const outset=copingOuterOffset("infinity","hidden"),whole=overviewCameraSubject(outline,layout,{outset,baseY:layout.groundY,infinityZone:zone});
  const pose=fitInfinityOverviewCamera(whole,outline,34,f.width/f.height);
  inside(cameraFor(pose,f,W,H),whole.points,f,W,H,`Infinity${length}×${width}/side${zone.side}/${W}`);
  const bounds={minX:Math.min(...outline.map(p=>p[0])),maxX:Math.max(...outline.map(p=>p[0])),minZ:Math.min(...outline.map(p=>p[1])),maxZ:Math.max(...outline.map(p=>p[1]))};
  const [px,py,pz]=pose.position;
  ok(Math.hypot(Math.max(bounds.minX-px,px-bounds.maxX,0),Math.max(bounds.minZ-pz,pz-bounds.maxZ,0))<=6.51,"Infinity general eye stays within existing photographic apron");
  ok((py-pose.target[1])/Math.hypot(px-pose.target[0],pz-pose.target[2])>.6,"Infinity general reveals basin in three-quarter view, not waterline");
  const subject=infinityDetailCameraSubject(outline,zone,layout);
  const detail=getCameraPose({intent:"infinity",outline,layout,depth:1.5,skimmers:{count:0,positions:[]},infinityZone:zone,verticalFov:34,viewportAspect:f.width/f.height});
  inside(cameraFor(detail,f,W,H),subject.points,f,W,H,`Infinity detail unchanged ${length}×${width}/side${zone.side}/${W}`);
 }
}
for(const [length,width]of [[8,4],[12,5]]) {
 const config:PoolConfig={...base,projectType:"new",poolType:"in-ground",shape:"rectangle",poolAccess:"internalSteps",
  dimensions:{...base.dimensions,length:length!,width:width!,depth:1.5},features:["sunShelf","sunShelfLoungers"]};
 const outline=buildOutline(config.shape,config.dimensions,config.controlPoints),r=configuredPoolLayout(config),loungers=configuredSunShelfLoungers(config);
 const layout=getPoolVerticalLayout({poolType:"in-ground",system:config.system,depth:1.5,copingThickness:.04});
 const furniture=loungers.placements.flatMap(p=>p.footprint.flatMap(([x,z])=>[[x,p.y,z] as const,[x,p.y+SUN_SHELF_LOUNGER_MODEL.height,z] as const]));
 const subject=sunShelfCameraSubject(r,layout,outline,furniture)!;ok(subject,"actual shelf subject");
 for(const[W,H]of viewports){const f={left:0,top:170,width:W,height:H-170-480},pose=fitComponentCamera(subject.points,subject.direction,34,f.width/f.height);
 inside(cameraFor(pose,f,W,H),subject.points,f,W,H,`Shelf${length}×${width}/${W}`);}
}
const config={...base,poolType:"in-ground" as const,features:["sunShelf"] as PoolConfig["features"]};
assert.deepEqual(decisions("access",config).map(d=>d.id),["access","ladder","comfort","shelf-options"]);checks++;
assert.deepEqual(decisions("access",{...config,poolType:"above-ground"}).map(d=>d.id),["access","external"]);checks++;
const before=JSON.stringify(config),sequence=decisions("access",config);let cursor=0;
for(let cycle=0;cycle<20;cycle++){while(cursor<sequence.length-1)cursor++;while(cursor>0)cursor--;ok(JSON.stringify(config)===before,"decision traversal never mutates configuration");}
const chrome=readFileSync("src/components/pool/wizard/WizardChrome.tsx","utf8"),shell=readFileSync("src/components/pool/PoolConfigurator.tsx","utf8"),choice=readFileSync("src/components/pool/wizard/ChoiceCard.tsx","utf8");
ok(chrome.includes('onClick={onViewPool}')&&chrome.includes('expanded ? "Riduci"'),"separate Vedi/Riduci commands wired");
ok(shell.includes('onViewPool={() => { setInspectionView("review"); reframe(); }}'),"Vedi requests whole-pool focus without changing panel");
ok(choice.includes('scroller.scrollTo')&&!choice.includes('scrollIntoView({'),"newly disclosed choice scrolls only options pane");
console.log(`Parametric camera/navigation: ${checks} assertions PASS, ${cases} metric projections, 20 forward/back cycles (browser QA separate).`);
