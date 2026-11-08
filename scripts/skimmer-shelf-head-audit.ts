import {resolveAutomaticCover} from "@/lib/pool/cover-plan";
import assert from 'node:assert/strict';
import {configuratorTesting} from '@/lib/pool/store';
import {projectGeometry} from '@/lib/pool/project-metrics';
import {configuredLayoutWithSkimmers,configuredSkimmerPlan,comfortFootprints} from '@/lib/pool/resolved-layout';
import {planSkimmers} from '@/lib/pool/engineering';
import {outlineBounds} from '@/lib/pool/geometry';
import {pointInBasin} from '@/lib/pool/boundary-placement';
import {SQM_PER_SKIMMER} from '@/lib/pool/config';
import {ACCESS_DIMENSIONS} from '@/components/pool/three/PoolAccessModel';
import {toProjectConfiguration,serializeProjectConfiguration,parseProjectConfiguration} from '@/lib/pool/project';
import {createPhotoSceneSpec} from '@/lib/pool/photo-scene-spec';
import {renovationPreviewConfig} from '@/lib/pool/renovation';
const initial=configuratorTesting.createInitialState(),b=initial.config;
const base={...b,projectType:'new',poolType:'in-ground',structure:'reinforced-concrete',shape:'rectangle',shapeSelected:true,poolAccess:'internalSteps',features:['sunShelf'],system:'skimmer',dimensions:{...b.dimensions,length:10,width:5,depth:1.5,floorProfile:'flat'}} as any;
let checks=0;const check=(v:unknown,m:string)=>{assert(v,m);checks++;};
const distance=(point:{x:number;z:number},outline:ReadonlyArray<readonly[number,number]>)=>Math.min(...outline.map((a,i)=>{const d=outline[(i+1)%outline.length]!,dx=d[0]-a[0],dz=d[1]-a[1],t=Math.max(0,Math.min(1,((point.x-a[0])*dx+(point.z-a[1])*dz)/Math.max(1e-10,dx*dx+dz*dz)));return Math.hypot(point.x-a[0]-t*dx,point.z-a[1]-t*dz);}));
const rows=[];
for(const [length,width] of [[10,5],[10,4.5],[12,6],[5,10]])for(const type of ['linear','corner'])for(const mirrored of [false,true]){
 const config={...base,internalStairType:type,internalStairMirrored:mirrored,dimensions:{...base.dimensions,length,width}};
 const {layout,skimmers}=configuredLayoutWithSkimmers(config),geo=projectGeometry(config);
 const shelf=layout.comfort.elements.find(e=>e.kind==='sunShelf');
 check(!!shelf&&layout.comfort.availability.sunShelf.available,'requested shelf remains available with the selected flight '+JSON.stringify({length,width,type,mirrored,reason:layout.comfort.availability.sunShelf,skimmers}));
 if(!shelf)continue;
 const bounds=outlineBounds(geo.outline),sb=outlineBounds(shelf.footprint),axis=bounds.spanX>=bounds.spanZ?'x':'z';
 const min=axis==='x'?bounds.minX:bounds.minZ,max=axis==='x'?bounds.maxX:bounds.maxZ;
 const target=Math.abs((axis==='x'?sb.minX:sb.minZ)-min)<Math.abs((axis==='x'?sb.maxX:sb.maxZ)-max)?max:min;
 check(skimmers.count===Math.ceil(geo.metrics.waterSurface/SQM_PER_SKIMMER),'hydraulic count is retained');
 check(skimmers.positions.every(p=>Math.abs(p[axis]-target)<1e-5),'row is entirely on the actual head opposite the shelf');
 check(JSON.stringify(skimmers)===JSON.stringify(geo.skimmers),'project geometry uses the shared row');
 check(JSON.stringify(skimmers)===JSON.stringify(configuredSkimmerPlan(config)),'shared wrapper uses the same final row');
 const reserved=[...comfortFootprints(layout.comfort),...(layout.access.placement?[layout.access.footprint]:[])];
 for(const p of skimmers.positions){
  check(distance(p,geo.outline)<1e-5,'each fitting stays on the true wall');
  check(pointInBasin(p.x+Math.sin(p.rotation)*.02,p.z+Math.cos(p.rotation)*.02,geo.outline),'fitting front points into water');
  check(reserved.every(poly=>!pointInBasin(p.x,p.z,poly)&&distance(p,poly)>=ACCESS_DIMENSIONS.fittingClearance-1e-6),'no opening intersects platform, landing or stair');
 }
 for(let i=0;i<skimmers.positions.length;i++)for(let j=i+1;j<skimmers.positions.length;j++)check(Math.hypot(skimmers.positions[i]!.x-skimmers.positions[j]!.x,skimmers.positions[i]!.z-skimmers.positions[j]!.z)>=.9-1e-6,'existing minimum row spacing retained');
 rows.push({length,width,type,mirrored,positions:skimmers.positions});
}
// Changing corner side must move the safe fitting span, not the shelf head.
const sides=[false,true].map(mirrored=>configuredLayoutWithSkimmers({...base,internalStairType:'corner',internalStairMirrored:mirrored}));
check(JSON.stringify(sides[0]!.skimmers.positions)!==JSON.stringify(sides[1]!.skimmers.positions),'corner SX/DX changes the free fitting span');
for(const reversed of [false,true]){
 const c={...base,internalStairType:'linear',dimensions:{...base.dimensions,floorProfile:'slope',shallowDepth:1.1,slopeReversed:reversed}};
 const pair=configuredLayoutWithSkimmers(c),shelf=pair.layout.comfort.elements.find(e=>e.kind==='sunShelf')!;
 check(!!shelf&&pair.layout.comfort.availability.sunShelf.available,'sloping shelf remains valid');
 const sb=outlineBounds(shelf.footprint),opposite=sb.minX<-4.9?5:-5;
 check(pair.skimmers.positions.every(p=>Math.abs(p.x-opposite)<1e-5),'reversed shelf end reverses the skimmer end');
}
// A short occupied head cannot silently spill the missing row onto the shelf wall.
const tooLarge={...base,internalStairType:'corner',dimensions:{...base.dimensions,length:25,width:4.5}};
const limited=configuredLayoutWithSkimmers(tooLarge);
check(limited.layout.status==='UNAVAILABLE'&&!!limited.skimmers.reason,'insufficient head capacity has an explicit unavailable result');
check(!limited.layout.comfort.availability.sunShelf.available,'capacity conflict blocks completion through the real comfort gate');
check(limited.skimmers.positions.every(p=>Math.abs(p.x-12.5)<1e-5),'even capacity failure never falls back to a shelf-side wall');
for(const c of [{...base,features:[]},{...base,features:[],shape:'l-shape',dimensions:{...base.dimensions,width:7,lShapeRecessLength:8,lShapeRecessWidth:3,lShapeOrientation:'se'}},{...base,features:[],poolType:'above-ground',structure:'modular-steel-panels'}]){
 const geo=projectGeometry(c);check(JSON.stringify(geo.skimmers)===JSON.stringify(planSkimmers(geo.outline,geo.metrics.waterSurface,true)),'non-shelf legacy row remains exactly unchanged');
}
for(const system of ['overflow','infinity'])check(configuredSkimmerPlan({...base,system}).positions.length===0,'non-skimmer systems remain empty');
const project=toProjectConfiguration(initial.projectId,{...base,internalStairType:'corner',internalStairMirrored:true},initial.renovation);
const parsed=parseProjectConfiguration(serializeProjectConfiguration(project));
check(JSON.stringify(projectGeometry(parsed.config).skimmers)===JSON.stringify(projectGeometry(project.config).skimmers),'save/reload derives the same adapted row');
check(JSON.stringify(createPhotoSceneSpec(project).pool.skimmers)===JSON.stringify(projectGeometry(project.config).skimmers),'photo scene specification uses the same row');
const renovation={...initial.renovation,existing:{poolType:'in-ground',poolAccess:'internalSteps',internalStairType:'corner',internalStairMirrored:true}} as any;
const preview=renovationPreviewConfig({...base,projectType:'renovation',internalStairMirrored:false},renovation,true);
check(JSON.stringify(configuredSkimmerPlan(preview))===JSON.stringify(configuredSkimmerPlan({...preview,internalStairMirrored:true})),'existing-pool side drives its own fitting row');
const coverConfig={...base,internalStairType:'linear',equipment:['automaticCover']};
const cover=resolveAutomaticCover(coverConfig);
check(!!cover.geometry,'approved cover remains available above the submerged shelf');
const rollerHead=cover.housingSide==='minX'?cover.footprint.minX:cover.footprint.maxX;
check(configuredSkimmerPlan(coverConfig).positions.every(p=>Math.abs(p.x-rollerHead)>=.36),'cover roller does not share the actual skimmer head');
console.log(JSON.stringify({checks,status:'PASS',rows}));
