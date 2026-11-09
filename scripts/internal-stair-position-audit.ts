import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {InternalStairPlanControl} from '@/components/pool/InternalStairPlanControl';
import assert from 'node:assert/strict';
import {configuratorTesting} from '@/lib/pool/store';
import {configuredPoolLayout} from '@/lib/pool/resolved-layout';
import {configuredOutline} from '@/lib/pool/configured-outline';
import {currentInternalStairOption,moveInternalStair,nudgeInternalStair,rotateInternalStair} from '@/lib/pool/internal-stair-position';
import {nearestStairWall,isInternalStairPosition} from '@/lib/pool/stair-position';
import {parseProjectConfiguration,serializeProjectConfiguration,toProjectConfiguration} from '@/lib/pool/project';
import {shareableProject} from '@/lib/project-delivery/service';
import {renovationPreviewConfig} from '@/lib/pool/renovation';
import {buildProjectSummary} from '@/lib/project-delivery/summary-model';
import {defaultInfinityEdgeParams,clampInfinityEdgeParams} from '@/lib/pool/infinity-edge';
import {focusForAction} from '@/lib/pool/contextual-camera';
import type {PoolConfig} from '@/lib/pool/types';
const initial=configuratorTesting.createInitialState();
const base:PoolConfig={...initial.config,projectType:'new',poolType:'in-ground',structure:'reinforced-concrete',shape:'rectangle',shapeSelected:true,poolAccess:'internalSteps',features:[],system:'overflow',dimensions:{...initial.config.dimensions,length:10,width:5,depth:1.5,floorProfile:'flat'}};
let checks=0,valid=0,rejected=0;const check=(v:unknown,m:string)=>{assert(v,m);checks++;};
const fixtures:PoolConfig[]=[base,{...base,system:'skimmer'},...(['sw','se','ne','nw'] as const).map(o=>({...base,shape:'l-shape' as const,dimensions:{...base.dimensions,lShapeRecessLength:3,lShapeRecessWidth:2,lShapeOrientation:o}})),{...base,shape:'custom',customMode:'draw',controlPoints:[[-.5,-.5],[.5,-.5],[.5,0],[0,0],[0,.5],[-.5,.5]]},...[0,1,2,3].map(side=>({...base,system:'infinity' as const,infinityEdge:clampInfinityEdgeParams({...defaultInfinityEdgeParams(),enabled:true,side})}))];
for(const config of fixtures)for(const kind of ['linear','corner'] as const){
 const outline=configuredOutline(config), c={...config,internalStairType:kind};
 for(let i=0;i<outline.length;i++){
  const a=outline[i]!,b=outline[(i+1)%outline.length]!,point=kind==='corner'?{x:a[0],z:a[1]}:{x:(a[0]+b[0])/2,z:(a[1]+b[1])/2};
  const result=moveInternalStair(c,point);
  if(!result.move){rejected++;check(!!result.reason,'rejected position has real reason');continue;}
  valid++;const move=result.move,p=move.option.layout.access;
  check(move.option.layout.status!=='UNAVAILABLE'&&!!p.placement,'accepted move is fully resolved');
  check(!!move.position&&isInternalStairPosition(move.position),'canonical position is finite');
  const wall=nearestStairWall(outline,move.position!);
  check(!!wall&&wall.distance<.025,'stair anchor stays on actual perimeter');
  const next={...c,internalStairPosition:move.position};
  check(configuredPoolLayout(next).access.footprint.every((v,i)=>Math.hypot(v[0]-p.footprint[i]![0],v[1]-p.footprint[i]![1])<1e-7),'persisted anchor reproduces geometry within floating-point tolerance');
  check(p.steps>0&&p.rise>=.15-1e-8&&p.rise<=.25+1e-8,'construction preserved');
 }
}
for(const kind of ['linear','corner'] as const){
 const c={...base,internalStairType:kind,internalStairPosition:{x:-5,z:kind==='corner'?-2.5:0}};
 const original=configuredPoolLayout(c).access;
 for(const direction of [-1,1] as const){
  const result=rotateInternalStair(c,direction);check(!!result.move,'both rotation controls work on free rectangle');
  const p=result.move!.option.layout.access;
  check(Math.abs(Math.cos(p.placement!.rotation-original.placement!.rotation))<1e-5,'rotation turns real steps by90 degrees');
 }
}
const centred={...base,internalStairPosition:{x:-5,z:0}};
const nudged=nudgeInternalStair(centred,1);check(!!nudged.move&&Math.abs(nudged.move.position!.z)>.09,'keyboard nudge moves actual stair');
const widened=configuredPoolLayout({...centred,internalStairWidth:2});check(widened.access.width===2&&Math.abs(widened.access.placement!.z)<.01,'custom width stays centred on selected wall');
const above={...centred,poolType:'above-ground' as const,structure:'modular-steel-panels' as const};
check(JSON.stringify(configuredPoolLayout(above).access.footprint)===JSON.stringify(configuredPoolLayout({...above,internalStairPosition:undefined}).access.footprint),'above-ground geometry unaffected');
let state={...initial,config:base};
state=configuratorTesting.reducer(state,{type:'setInternalStairPosition',value:{x:-5,z:0}});
check(state.config.internalStairPosition?.x===-5,'store accepts valid attached placement');
for(const point of [{x:NaN,z:0},{x:Infinity,z:1},{x:201,z:0}])check(configuratorTesting.reducer(state,{type:'setInternalStairPosition',value:point})===state,'invalid coordinate rejected');
const reset=configuratorTesting.reducer(state,{type:'setInternalStairMirrored',value:!!state.config.internalStairMirrored});
check(!reset.config.internalStairPosition,'preset clears manual position even when mirror bit unchanged');
check(focusForAction({type:'setInternalStairPosition',value:{x:-5,z:0}},state.config,'DIMENSIONS_TOP')===undefined,'manual camera preserved');
const project=toProjectConfiguration(state.projectId,state.config,state.renovation);
const loaded=parseProjectConfiguration(serializeProjectConfiguration(project));
check(loaded?.config.internalStairPosition?.x===-5,'Save/Reload retains anchor');
check(shareableProject(project).config.internalStairPosition?.x===-5,'Share allowlist retains anchor');
const corrupt=JSON.parse(serializeProjectConfiguration(project));corrupt.config.internalStairPosition={x:'bad',z:1};
check(!parseProjectConfiguration(JSON.stringify(corrupt))?.config.internalStairPosition,'malformed restore cannot reach geometry');
const reno={...state.renovation,existing:{poolType:'in-ground' as const,poolAccess:'internalSteps' as const,internalStairType:'corner' as const,internalStairPosition:{x:5,z:2.5}}};
const preview=renovationPreviewConfig({...base,projectType:'renovation',internalStairPosition:{x:-5,z:0}},reno,true);
check(preview.internalStairPosition?.x===5,'existing position isolated from new-pool position');
const rp=toProjectConfiguration(state.projectId,{...base,projectType:'renovation'},reno);
check(parseProjectConfiguration(serializeProjectConfiguration(rp))?.renovation.existing?.internalStairPosition?.x===5,'existing placement roundtrip');
check(shareableProject(rp).renovation.existing?.internalStairPosition?.x===5,'existing Share position retained');
const noPosition=renovationPreviewConfig({...base,projectType:'renovation',internalStairPosition:{x:-5,z:0}},{...reno,existing:{...reno.existing,internalStairPosition:undefined}},true);
check(!noPosition.internalStairPosition,'manual new-pool placement cannot leak into existing pool');
for(const locale of ['it','en'] as const)check(JSON.stringify(buildProjectSummary(project,locale)).includes(locale==='it'?'Scala posizionata in pianta':'Stairs positioned in plan'),'actual summary includes translated orientation');
const shelf={...base,features:['sunShelf' as const]};
const left=moveInternalStair(shelf,{x:-5,z:-2.5}),right=moveInternalStair(shelf,{x:-5,z:2.5});
check(!!left.move&&!!right.move&&left.move.mirrored!==right.move.mirrored,'integrated shelf drag keeps its two valid slots');
check(!rotateInternalStair(shelf,1).move,'integrated assembly cannot rotate out of shelf');
check(currentInternalStairOption(centred).available,'manual current mini-plan resolved');
const html=renderToStaticMarkup(React.createElement(InternalStairPlanControl,{config:centred,onPositionChange:()=>{},onSideChange:()=>{}}));
check(html.includes('role="group"'),'interactive plan exposes a group instead of hiding controls in an image');
check((html.match(/aria-label="Trascina la scala lungo il perimetro"/g)??[]).length===1,'exactly one named draggable focus target');
check(html.includes('tabindex="0"')&&html.includes('Da tastiera:'),'keyboard control discoverable in real rendered UI');
check(html.includes('Ruota verso la parete successiva')&&html.includes('Posizione automatica'),'rotation and reset controls rendered');
console.log(JSON.stringify({checks,fixtures:fixtures.length,valid,rejected,status:'PASS'}));
