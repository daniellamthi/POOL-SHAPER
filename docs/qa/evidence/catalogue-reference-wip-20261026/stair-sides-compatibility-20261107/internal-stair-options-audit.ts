import {sunShelfCameraSubject,comfortCameraSubject,accessCameraSubject} from '@/lib/pool/camera';
import {configuredOutline} from '@/lib/pool/configured-outline';
import {getPoolVerticalLayout} from '@/lib/pool/vertical-layout';
import {POOL_BORDER_PRESET} from '@/configurator/materials/visual-presets';
import assert from 'node:assert/strict';
import {configuratorTesting} from '@/lib/pool/store';
import {configuredPoolLayout} from '@/lib/pool/resolved-layout';
import {normalizeComfortFeatures} from '@/lib/pool/comfort-plan';
const b=configuratorTesting.createInitialState().config;
const base={...b,projectType:'new',poolType:'in-ground',structure:'reinforced-concrete',shape:'rectangle',shapeSelected:true,poolAccess:'internalSteps',features:[],system:'skimmer',dimensions:{...b.dimensions,length:10,width:5,depth:1.5,floorProfile:'flat'}} as any;
let checks=0;const check=(v:unknown,m:string)=>{assert(v,m);checks++;};
for(const kind of ['linear','corner']){
 const at=(mirror:boolean,features:string[]=[])=>configuredPoolLayout({...base,internalStairType:kind,internalStairMirrored:mirror,features});
 const a=at(false),d=at(true);
 check(!!a.access.placement&&!!d.access.placement,kind+' both sides available');
 check(JSON.stringify(a.access.footprint)!==JSON.stringify(d.access.footprint),kind+' SX/DX changes real geometry');
 check(a.access.steps===d.access.steps&&a.access.rise===d.access.rise,kind+' mirroring preserves construction');
 for(const mirrored of [false,true]){
 const p=at(mirrored,['sunShelf']);const shelf=p.comfort.elements.find(e=>e.kind==='sunShelf');
 check(p.comfort.availability.sunShelf.available&&!!shelf,kind+' shelf actually compatible');
 check(kind==='corner'?!!p.access.corner&&!shelf!.steps?.length:!!shelf!.steps?.length,kind+' shelf uses selected stair geometry');
 }
}
const hydroLinear=configuredPoolLayout({...base,internalStairType:'linear',features:['hydromassage']});
check(!hydroLinear.comfort.availability.hydromassage.available,'linear + hydro is explicitly unavailable');
for(const mirrored of [false,true]){
 const h=configuredPoolLayout({...base,internalStairType:'corner',internalStairMirrored:mirrored,features:['hydromassage']});
 check(h.comfort.availability.hydromassage.available&&!!h.access.corner,'corner + hydro works on both sides');
}

import {configuredInternalStairSides, internalStairChoice} from '@/lib/pool/internal-stair-options';
import {parseProjectConfiguration, serializeProjectConfiguration, toProjectConfiguration} from '@/lib/pool/project';
import {shareableProject} from '@/lib/project-delivery/service';
import {renovationPreviewConfig} from '@/lib/pool/renovation';
import {defaultInfinityEdgeParams,clampInfinityEdgeParams} from '@/lib/pool/infinity-edge';
import {buildProjectSummary} from '@/lib/project-delivery/summary-model';
for(const type of ['linear','corner'] as const)for(const features of [[],['sunShelf'],['hydromassage']]){
 const c={...base,internalStairType:type,features};
 const choice=internalStairChoice(c,type);
 check(choice.available===!(type==='linear'&&features.includes('hydromassage')),'advertised compatibility equals real geometry');
 const sides=configuredInternalStairSides(c);
 check(sides.length===2&&sides[0]!.side==='left'&&sides[1]!.side==='right','both side controls remain in fixed order');
 if(choice.available)check(sides.every(s=>s.available),'rectangle valid both SX/DX');
}
// L shapes, a sloping floor and Infinity exclusions must reject unusable choices.
const fixtures=[...(['sw','se','ne','nw'] as const).map(o=>({...base,shape:'l-shape',dimensions:{...base.dimensions,width:7,lShapeRecessLength:8,lShapeRecessWidth:3,lShapeOrientation:o}})),
 {...base,dimensions:{...base.dimensions,floorProfile:'slope',shallowDepth:1.1}},
 ...[0,1,2,3].map(side=>({...base,system:'infinity',infinityEdge:clampInfinityEdgeParams({...defaultInfinityEdgeParams(),enabled:true,side})}))];
for(const c of fixtures)for(const type of ['linear','corner'] as const){
 const candidate={...c,internalStairType:type};
 for(const side of configuredInternalStairSides(candidate)){
 const plan=configuredPoolLayout({...candidate,internalStairMirrored:side.mirrored});
 check(side.available===(plan.status!=='UNAVAILABLE'&&!!plan.access.placement),'side availability follows actual constraints');
 if(plan.access.placement)check(plan.access.steps>0&&plan.access.rise>0&&Number.isFinite(plan.access.rise),'real construction remains valid '+JSON.stringify({type,system:c.system,shape:c.shape,mirror:side.mirrored,rise:plan.access.rise,steps:plan.access.steps}));
 }
}
let state={...configuratorTesting.createInitialState(),config:{...base,internalStairType:'linear'}};
state=configuratorTesting.reducer(state as any,{type:'setInternalStairMirrored',value:true});
check(state.config.internalStairMirrored===true,'store accepts actual in-ground mirrored flight');
const project=toProjectConfiguration(state.projectId,{...state.config,projectType:'new'},state.renovation);
const loaded=parseProjectConfiguration(serializeProjectConfiguration(project));
check(loaded?.config.internalStairMirrored===true,'new-pool mirror survives actual serialization');
check(shareableProject(project).config.internalStairMirrored===true,'new-pool mirror survives Share');
const reno={...state.renovation,existing:{poolType:'in-ground',poolAccess:'internalSteps',internalStairType:'corner',internalStairMirrored:true}} as any;
const preview=renovationPreviewConfig({...base,projectType:'renovation',internalStairMirrored:false},reno,true);
check(preview.internalStairMirrored===true,'existing-pool mirror is isolated from new-pool mirror');
const rp=toProjectConfiguration(state.projectId,{...base,projectType:'renovation'},reno);
check(parseProjectConfiguration(serializeProjectConfiguration(rp))?.renovation.existing?.internalStairMirrored===true,'existing-pool mirror survives actual serialization');
check(shareableProject(rp).renovation.existing?.internalStairMirrored===true,'existing-pool mirror survives Share allowlist');
const defaultExisting=renovationPreviewConfig({...base,projectType:'renovation',internalStairMirrored:true},{...reno,existing:{...reno.existing,internalStairMirrored:undefined}},true);
check(defaultExisting.internalStairMirrored===undefined,'new-pool side must not leak into an unconfigured existing pool');
const hydro={...state.config,features:['hydromassage'],internalStairType:'corner'};
const current={...state,config:hydro};
check(configuratorTesting.reducer(current as any,{type:'setInternalStairType',value:'linear'})===current,'store rejects linear + hydro without deleting requested comfort');
for(const locale of ['it','en'] as const){
 const text=JSON.stringify(buildProjectSummary(project,locale));
 const selected=configuredInternalStairSides(project.config).find(side=>side.mirrored===true)!;
 check(text.includes(locale==='it'?(selected.side==='left'?'Sinistra (SX)':'Destra (DX)'):(selected.side==='left'?'Left (L)':'Right (R)')),'actual summary contains translated selected stair side');
}
for(const feature of ['sunShelf','hydromassage'])for(const mirrored of [false,true]){
 const config={...b,poolType:'in-ground',structure:'reinforced-concrete',shape:'rectangle',shapeSelected:true,poolAccess:'internalSteps',internalStairType:'corner',internalStairMirrored:mirrored,system:'skimmer',features:[feature],dimensions:{...b.dimensions,length:10,width:5,depth:1.5,floorProfile:'flat'}} as any;
 const resolved=configuredPoolLayout(config),outline=configuredOutline(config);
 const layout=getPoolVerticalLayout({poolType:config.poolType,system:config.system,overflowType:config.overflowType,depth:config.dimensions.depth,copingThickness:POOL_BORDER_PRESET.thickness,copingStyle:config.copingStyle});
 const subject=feature==='sunShelf'?sunShelfCameraSubject(resolved,layout,outline):comfortCameraSubject('hydromassage',resolved,layout,outline);
 const stairs=accessCameraSubject(resolved.access,layout,outline);
 assert(subject&&stairs,'real component subjects exist');checks++;
 assert(stairs.points.every(point=>subject.points.some(p=>p.every((v,i)=>Math.abs(v-point[i]!)<1e-8))),'combined comfort view must contain the entire selected independent corner flight');checks++;
}
console.log(JSON.stringify({checks,status:'PASS'}));
