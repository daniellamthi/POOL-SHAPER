import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {InternalStairPlanControl} from '@/components/pool/InternalStairPlanControl';
import assert from 'node:assert/strict';
import {configuratorTesting} from '@/lib/pool/store';
import {configuredPoolLayout} from '@/lib/pool/resolved-layout';
import {configuredOutline} from '@/lib/pool/configured-outline';
import {internalStairChoice} from '@/lib/pool/internal-stair-options';
import {currentInternalStairOption,internalStairPlanTargets,cornerStairMoves,internalStairDragOrigin,moveInternalStairFromPlan,moveInternalStair,nudgeInternalStair,rotateInternalStair} from '@/lib/pool/internal-stair-position';
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
const aboveMoved=moveInternalStair(above,{x:-5,z:0}).move;
check(!!aboveMoved&&Math.abs(configuredPoolLayout({...above,internalStairPosition:aboveMoved.position}).access.placement!.z)<1e-7,'above-ground manual flight is honoured');
const aboveState=configuratorTesting.reducer({...initial,config:above},{type:'setInternalStairPosition',value:{x:-5,z:0}});
check(aboveState.config.internalStairPosition?.z===0,'above-ground reducer accepts real valid wall');
const aboveLoaded=parseProjectConfiguration(serializeProjectConfiguration(toProjectConfiguration(initial.projectId,aboveState.config,initial.renovation)));
check(aboveLoaded?.config.internalStairPosition?.x===-5,'above-ground Save/Reload retains anchor');
const aboveCorners=cornerStairMoves({...above,internalStairType:'corner'});
check(aboveCorners.length===4&&new Set(aboveCorners.map(m=>JSON.stringify(m.option.footprint))).size===4,'above-ground exposes four distinct real corners');
for(const m of aboveCorners)check(m.option.layout.access.corner?.rectangular===true,'above-ground retains rectangular treads');
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
// Regression: two flights on a2.7m L arm have overlapping footprints.
// Dragging between their visible centres must work in BOTH directions;
// the old wall-pivot offset stuck on the same corner. Both rotation buttons
// must also be reversible when the bounding-box90deg target is unusable.
let returnChecks=0;
const sameFootprint=(a:readonly (readonly [number,number])[],b:readonly (readonly [number,number])[])=>a.length===b.length&&a.every((p,i)=>Math.hypot(p[0]-b[i]![0],p[1]-b[i]![1])<1e-7);
const centreOf=(points:readonly (readonly [number,number])[])=>({x:points.reduce((sum,p)=>sum+p[0]/points.length,0),z:points.reduce((sum,p)=>sum+p[1]/points.length,0)});
for(const orientation of ['sw','se','ne','nw'] as const)for(const system of ['skimmer','overflow','infinity0','infinity1','infinity2','infinity3']){
 const c:PoolConfig={...base,shape:'l-shape',internalStairType:'corner',system:system.startsWith('infinity')?'infinity':system as 'skimmer'|'overflow',
  ...(system.startsWith('infinity')?{infinityEdge:clampInfinityEdgeParams({...defaultInfinityEdgeParams(),enabled:true,side:Number(system.slice(-1))})}:{}),
  dimensions:{...base.dimensions,length:9.7,width:4.5,lShapeRecessLength:4,lShapeRecessWidth:1.8,lShapeOrientation:orientation}};
 const moves=cornerStairMoves(c);
 for(const from of moves){
  const selected={...c,internalStairPosition:from.position},origin=internalStairDragOrigin(from.option),grab=centreOf(from.option.footprint);
  check(Math.hypot(origin.x-grab.x,origin.z-grab.z)<1e-7,'corner pointer follows visible centre');returnChecks++;
  for(const to of moves){
   const end=centreOf(to.option.footprint),request={x:end.x-(grab.x-origin.x),z:end.z-(grab.z-origin.z)};
   const dragged=moveInternalStairFromPlan(selected,request,moves).move;
   check(!!dragged&&sameFootprint(dragged.option.footprint,to.option.footprint),'visual handle reaches requested valid L corner');returnChecks++;
  }
  if(moves.length>1)for(const direction of [-1,1] as const){
   const turned=rotateInternalStair(selected,direction,moves).move;
   check(!!turned&&!sameFootprint(turned.option.footprint,from.option.footprint),'both SX/DX rotation controls leave current corner');returnChecks++;
   const restored=rotateInternalStair({...c,internalStairPosition:turned!.position},direction===1?-1:1,moves).move;
   check(!!restored&&sameFootprint(restored.option.footprint,from.option.footprint),'opposite rotation returns to original corner');returnChecks++;
  }
 }
}
let destinationChecks=0;
for(const poolType of ['in-ground','above-ground'] as const)for(const projectType of ['new','renovation'] as const)for(const shape of ['rectangle','l-shape','custom','organic'] as const)for(const kind of ['linear','corner'] as const){
 const c:PoolConfig={...base,poolType,projectType,shape,internalStairType:kind};
 const targets=internalStairPlanTargets(c),accepted=targets.filter(t=>t.move);
 check(kind==='corner'&&['custom','organic'].includes(shape)?!accepted.length:accepted.length>=2,'every supported pool/shape has distinct meaningful destinations or correctly rejects radial flight on swept walls');destinationChecks++;
 if(kind==='corner'&&shape==='rectangle'){check(accepted.length===4,'all four clear rectangle corners are available for both pool/project types');destinationChecks++;}
 if(kind==='corner'&&shape==='l-shape'){check(targets.length===6&&accepted.length===5,'all L vertices shown and only reflex vertex unavailable');destinationChecks++;}
 for(const target of accepted){
  const move=target.move!,next={...c,...(move.mirrored!==undefined?{internalStairMirrored:move.mirrored,internalStairPosition:undefined}:{internalStairPosition:move.position})};
  const actual=currentInternalStairOption(next);
  check(actual.available&&sameFootprint(actual.footprint,move.option.footprint),'destination and actual 3D layout agree');destinationChecks++;
  if(shape==='organic'){
   assert.throws(()=>toProjectConfiguration(initial.projectId,next,initial.renovation),/non è più disponibile/);checks++;destinationChecks++;
  }else{
   const restored=parseProjectConfiguration(serializeProjectConfiguration(toProjectConfiguration(initial.projectId,next,initial.renovation)))!;
   check(sameFootprint(configuredPoolLayout(restored.config).access.footprint,move.option.footprint),'destination survives Save/Reload in every supported pool/project/shape');destinationChecks++;
   check(JSON.stringify(shareableProject(toProjectConfiguration(initial.projectId,next,initial.renovation)).config.internalStairPosition)===JSON.stringify(next.internalStairPosition),'Share retains destination for every supported pool/project/shape');destinationChecks++;
  }
  if(kind==='linear')for(const direction of [-1,1] as const){
   const rotated=rotateInternalStair(next,direction).move;
   check(!!rotated&&!sameFootprint(rotated.option.footprint,move.option.footprint),'straight flight rotates to another real wall on every supported shape');destinationChecks++;
  }
 }
 const markup=renderToStaticMarkup(React.createElement(InternalStairPlanControl,{config:c,onPositionChange:()=>{},onSideChange:()=>{}}));
 check(markup.includes('Sposta la scala')&&(!targets.length||markup.includes('Destinazioni della scala')),'destination controls rendered for every pool/project/shape');destinationChecks++;
 check(kind!=='corner'||targets.length>0||markup.includes('Scegli Rettilinea'),'swept shape explains the compatible stair choice');destinationChecks++;
}
const radialMarkup=renderToStaticMarkup(React.createElement(InternalStairPlanControl,{config:{...base,internalStairType:'corner'},onPositionChange:()=>{},onSideChange:()=>{}}));
check(radialMarkup.includes('data-stair-treads')&&(radialMarkup.match(/ A/g)??[]).length===configuredPoolLayout({...base,internalStairType:'corner'}).access.steps,'mini-plan draws every actual curved tread');destinationChecks++;
for(const side of [0,1,2,3]){
 const c={...base,system:'infinity' as const,internalStairType:'corner' as const,infinityEdge:clampInfinityEdgeParams({...defaultInfinityEdgeParams(),enabled:true,side})};
 const targets=internalStairPlanTargets(c);
 check(targets.length===4&&targets.filter(t=>t.move).length===2,'Infinity keeps all corners visible and reserves the two edge corners');destinationChecks++;
 check(targets.filter(t=>!t.move).every(t=>!!t.reason),'blocked Infinity destinations explain real rejection');destinationChecks++;
}
for(const poolType of ['in-ground','above-ground'] as const){
 const c={...base,poolType,internalStairType:'corner' as const},move=cornerStairMoves(c)[2]!;
 const renovation={...initial.renovation,existing:{poolType,poolAccess:'internalSteps' as const,internalStairType:'corner' as const,internalStairPosition:move.position}};
 for(const before of [true,false])check(sameFootprint(configuredPoolLayout(renovationPreviewConfig({...c,projectType:'renovation'},renovation,before)).access.footprint,move.option.footprint),'existing manual pose agrees in Before/Proposal for both pool types');
 const loaded=parseProjectConfiguration(serializeProjectConfiguration(toProjectConfiguration(initial.projectId,{...c,projectType:'renovation'},renovation)))!;
 check(sameFootprint(configuredPoolLayout(renovationPreviewConfig(loaded.config,loaded.renovation,true)).access.footprint,move.option.footprint),'existing pool position survives full restore');
 check(!!shareableProject(toProjectConfiguration(initial.projectId,{...c,projectType:'renovation'},renovation)).renovation.existing?.internalStairPosition,'existing pool Share retains manual position');destinationChecks+=4;
}
for(const c of [{...base,system:'skimmer' as const,copingEdge:'rounded' as const},{...base,overflowType:'continuous' as const,copingStyle:'dedicated' as const}]){
 const targets=internalStairPlanTargets({...c,internalStairType:'linear'});
 check(targets.filter(t=>t.move).length>=2,'rounded basin still offers actual straight-flight wall destinations');destinationChecks++;
 check(internalStairPlanTargets({...c,internalStairType:'corner'}).length===0,'radial flight cannot silently claim a swept corner');destinationChecks++;
}
const unavailable={...base,system:'infinity' as const,internalStairType:'corner' as const,infinityEdge:clampInfinityEdgeParams({...defaultInfinityEdgeParams(),enabled:true,side:1}),internalStairPosition:{x:5,z:-2.5}};
const recovery=renderToStaticMarkup(React.createElement(InternalStairPlanControl,{config:unavailable,onPositionChange:()=>{},onSideChange:()=>{}}));
check(!currentInternalStairOption(unavailable).available&&internalStairPlanTargets(unavailable).some(t=>!!t.move),'invalid retained anchor has real recovery destinations');destinationChecks++;
check(recovery.includes('role="group"')&&recovery.includes('Destinazioni della scala'),'valid destination buttons remain accessible without a current flight');destinationChecks++;
for(const poolType of ['in-ground','above-ground'] as const){
 const stale={...base,poolType,shape:'custom' as const,internalStairType:'corner' as const,internalStairPosition:{x:-5,z:2.5}};
 check(internalStairChoice(stale,'linear').available,'old radial anchor does not disable a compatible straight flight on a changed shape');destinationChecks++;
 const changed=configuratorTesting.reducer({...initial,config:stale},{type:'setInternalStairType',value:'linear'});
 check(!changed.config.internalStairPosition&&!!configuredPoolLayout(changed.config).access.placement,'choosing another stair type recovers a real automatic placement');destinationChecks++;
 const same=configuratorTesting.reducer({...initial,config:{...base,poolType,internalStairType:'corner',internalStairPosition:{x:-5,z:2.5}}},{type:'setInternalStairType',value:'corner'});
 check(!!same.config.internalStairPosition,'reselecting the same stair type preserves manual placement');destinationChecks++;
}
const shiftedMarkup=renderToStaticMarkup(React.createElement(InternalStairPlanControl,{config:{...centred,internalStairPosition:{x:-5,z:.1}},onPositionChange:()=>{},onSideChange:()=>{}}));
check((shiftedMarkup.match(/aria-pressed="true"/g)??[]).length===2,'wall stays selected in both SVG and buttons after a fluid slide');destinationChecks++;
check(!rotateInternalStair(unavailable,1).reason.includes('spiaggetta'),'unavailable independent flight never claims an integrated shelf');destinationChecks++;
console.log(JSON.stringify({checks,returnChecks,destinationChecks,fixtures:fixtures.length,valid,rejected,status:'PASS'}));
