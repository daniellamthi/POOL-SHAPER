import assert from 'node:assert/strict';
import { configuratorTesting } from '@/lib/pool/store';
import { configuredPoolLayout } from '@/lib/pool/resolved-layout';
import { configuredInternalStairWidthRange, internalStairWidthFits } from '@/lib/pool/internal-stair-width';
import { parseProjectConfiguration, serializeProjectConfiguration, toProjectConfiguration } from '@/lib/pool/project';
import { shareableProject } from '@/lib/project-delivery/service';
import { renovationPreviewConfig } from '@/lib/pool/renovation';
import { configuredOutline } from '@/lib/pool/configured-outline';
import { clampInfinityEdgeParams } from '@/lib/pool/infinity-edge';
import { buildProjectSummary } from '@/lib/project-delivery/summary-model';
const insideOutline=(o:ReadonlyArray<readonly[number,number]>,x:number,z:number)=>{
 let inside=false;for(let i=0,j=o.length-1;i<o.length;j=i++){
 const a=o[j]!,b=o[i]!,dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
 if(Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<.025)return true;
 if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;
};
import type { PoolConfig } from '@/lib/pool/types';
let checks=0; const check=(v:unknown,m:string)=>{assert(v,m);checks++;};
const base=configuratorTesting.createInitialState();
const config:PoolConfig={...base.config,projectType:'new',poolType:'in-ground',structure:'reinforced-concrete',shape:'rectangle',shapeSelected:true,poolAccess:'internalSteps',internalStairType:'linear',features:[],system:'skimmer',dimensions:{...base.config.dimensions,length:10,width:5,depth:1.5,floorProfile:'flat'}};
const wide={...config,internalStairWidth:1.8};
check(configuredPoolLayout(wide).access.width===1.8,'requested 1.80 m changes actual stair width');
const fixtures:PoolConfig[]=[config,...(['sw','se','ne','nw'] as const).map(o=>({...config,shape:'l-shape' as const,dimensions:{...config.dimensions,lShapeRecessLength:3,lShapeRecessWidth:2,lShapeOrientation:o}})),{...config,shape:'custom',customMode:'draw',controlPoints:[[-.5,-.5],[.5,-.5],[.5,0],[0,0],[0,.5],[-.5,.5]]}];
const results=[];
for(const c of fixtures){
 const outline=configuredOutline(c), automatic=configuredPoolLayout(c), range=configuredInternalStairWidthRange(c);
 check(range.available,`${c.shape} range available`);if(!range.available)continue;
 for(const width of [range.min,range.defaultWidth,(range.defaultWidth+range.max)/2,range.max]){
  check(internalStairWidthFits(c,width),`${c.shape} fit ${width}`);
  const plan=configuredPoolLayout({...c,internalStairWidth:width});
  check(Math.abs(plan.access.width-width)<1e-7,'actual width equals request');
  check(plan.access.steps===automatic.access.steps&&plan.access.tread===automatic.access.tread&&plan.access.rise===automatic.access.rise,'pedates/risers unchanged');
  check(Math.abs(plan.access.placement!.rotation-automatic.access.placement!.rotation)<1e-7,'same selected wall');
  const f=plan.access.footprint,a=automatic.access.footprint;
  check(a.slice(0,2).some(p=>f.slice(0,2).some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<.025)),'same corner while resizing');
  for(const p of f)check(insideOutline(outline,p[0],p[1]),'all flight vertices contained');
 }
 check(!internalStairWidthFits(c,100),'unplaceable width rejected');
 results.push({shape:c.shape,orientation:c.dimensions.lShapeOrientation,range});
}
for(const c of [
 {...config,dimensions:{...config.dimensions,floorProfile:'slope' as const,shallowDepth:1.1}},
 {...config,poolType:'above-ground' as const,structure:'modular-steel-panels' as const},
 ...[0,1,2,3].map(side=>({...config,system:'infinity' as const,infinityEdge:clampInfinityEdgeParams({enabled:true,side})})),
]){
 const range=configuredInternalStairWidthRange(c);check(range.available,'slope/above-ground/Infinity range exists');if(!range.available)continue;
 for(const w of [range.min,range.defaultWidth,range.max]){
  check(internalStairWidthFits(c,w),'slope/above-ground/Infinity real width valid');
  const p=configuredPoolLayout({...c,internalStairWidth:w});check(p.access.placement&&Math.abs(p.access.width-w)<1e-7,'scene resolves requested width');
 }
 results.push({shape:c.system==='infinity'?'Infinity':c.poolType==='above-ground'?'above-ground':'slope',range});
}
// Hydromassage now requires a fixed corner flight; straight width applies to the shelf.
for(const features of [['sunShelf']] as const){
 const c={...config,features};const before=configuredPoolLayout(c),range=configuredInternalStairWidthRange(c);
 check(range.available,features[0]+' range available');if(!range.available)continue;
 const width=Math.min(1.8,range.max);const plan=configuredPoolLayout({...c,internalStairWidth:width});
 const a=before.comfort.elements.find(e=>e.kind===features[0])!,b=plan.comfort.elements.find(e=>e.kind===features[0])!;
 check(!!b?.steps?.length,features[0]+' requested stairs remain');
 check(a.riser===b.riser&&a.steps!.length===b.steps!.length,'comfort rise/count unchanged');
 const foot=b.steps![0]!.footprint;const actual=Math.max(...foot.map(p=>p[1]))-Math.min(...foot.map(p=>p[1]));
 check(Math.abs(actual-width)<.06,'comfort width including existing shell overlap follows request');
 check(internalStairWidthFits(c,range.max),'comfort max fits');
 check(!internalStairWidthFits(c,range.max+.06),'comfort beyond max rejected');
 results.push({shape:features[0],range,actual});
}
// A remembered corner choice must not lock an integrated straight comfort flight
// when the separate internal flight is off or replaced by an inox ladder.
for (const poolAccess of [null, 'stainlessSteelLadder'] as const) {
 const c:PoolConfig={...config,poolAccess,internalStairType:'corner',features:['hydromassage']};
 check(configuredInternalStairWidthRange(c).available,'integrated hydro width remains available with inactive corner selection');
 check(internalStairWidthFits(c,1.8),'integrated hydro accepts requested width');
 const hydro=configuredPoolLayout({...c,internalStairWidth:1.8}).comfort.elements.find(e=>e.kind==='hydromassage');
 check(!!hydro?.steps?.length,'integrated hydro staircase remains present');
 const foot=hydro!.steps![0]!.footprint;
 const width=Math.max(...foot.map(p=>p[1]))-Math.min(...foot.map(p=>p[1]));
 check(Math.abs(width-1.8)<.06,'inactive corner selection must not suppress actual integrated hydro width');
}
const corner={...config,internalStairType:'corner' as const};
check(!configuredInternalStairWidthRange(corner).available,'corner explicitly fixed');
check(JSON.stringify(configuredPoolLayout(corner))===JSON.stringify(configuredPoolLayout({...corner,internalStairWidth:1.8})),'width cannot distort corner stairs');
for(const value of [NaN,Infinity,-1,0,.79,100])check(!internalStairWidthFits(config,value),'invalid value rejected');
let state={...base,config};
state=configuratorTesting.reducer(state,{type:'setInternalStairWidth',value:1.8});check(state.config.internalStairWidth===1.8,'store width');
const validState=state;state=configuratorTesting.reducer(state,{type:'setInternalStairWidth',value:99});check(state===validState,'store rejects geometry-invalid width');
state=configuratorTesting.reducer(state,{type:'setInternalStairWidth',value:undefined});check(!Object.hasOwn(state.config,'internalStairWidth'),'automatic removes field');
check(JSON.stringify(configuredPoolLayout(state.config))===JSON.stringify(configuredPoolLayout(config)),'automatic restores identical complete layout');
const project=toProjectConfiguration(base.projectId,wide,base.renovation);
const restored=parseProjectConfiguration(serializeProjectConfiguration(project));check(restored.config.internalStairWidth===1.8,'Save Reload retains width');
check(shareableProject(restored).config.internalStairWidth===1.8,'Share retains width');
for(const locale of ['it','en'] as const)check(JSON.stringify(buildProjectSummary(restored,locale)).includes(locale==='it'?'Larghezza scala: 1,80 m':'Stair width: 1.80 m'),'summary/PDF width '+locale);
const renovation={...base.renovation,existing:{poolType:'in-ground' as const,poolAccess:'internalSteps' as const,internalStairType:'linear' as const,internalStairWidth:1.7}};
const renovationConfig={...config,projectType:'renovation' as const};
const renovationProject=toProjectConfiguration(base.projectId,renovationConfig,renovation);
check(renovationPreviewConfig(renovationConfig,renovation,true).internalStairWidth===1.7,'renovation preview width');
check(shareableProject(renovationProject).renovation.existing?.internalStairWidth===1.7,'renovation Share width');
check(parseProjectConfiguration(serializeProjectConfiguration(renovationProject)).renovation.existing?.internalStairWidth===1.7,'renovation Reload width');
const {internalStairWidth:_,...existingAutomatic}=renovation.existing;
check(renovationPreviewConfig({...renovationConfig,internalStairWidth:2},{...renovation,existing:existingAutomatic},true).internalStairWidth===undefined,'renovation automatic does not inherit unrelated new-pool width');
console.log(JSON.stringify({checks,results}));
