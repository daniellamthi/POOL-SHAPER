import assert from 'node:assert/strict';
import { buildOutline, outlineArea } from '@/lib/pool/geometry';
import { planSkimmers } from '@/lib/pool/engineering';
import { DEFAULT_DIMENSIONS, DEFAULT_CONTROL_POINTS } from '@/lib/pool/config';
import { boundaryRuns } from '@/lib/pool/boundary-placement';
import { configuratorTesting } from '@/lib/pool/store';
import { shapeDimensionLimits } from '@/lib/pool/shape-dimensions';
import { constrainControlPoints } from '@/lib/pool/geometry';
let cases=0;
for(const orientation of ['nw','ne','sw','se'] as const)for(const [length,width,recessLength,recessWidth] of [[10,7,8,3],[20,12,18,10],[8,6,4,3]]){
 const outline=buildOutline('l-shape',{...DEFAULT_DIMENSIONS,length,width,lShapeRecessLength:recessLength,lShapeRecessWidth:recessWidth,lShapeOrientation:orientation},DEFAULT_CONTROL_POINTS);
 const plan=planSkimmers(outline,outlineArea(outline)),expectedZ=['nw','ne'].includes(orientation)?-width/2:width/2;
 assert.equal(plan.count,Math.ceil(outlineArea(outline)/25));
 assert(plan.positions.every(p=>Math.abs(p.z-expectedZ)<1e-7),'L skimmers should occupy the uninterrupted long wall, not cluster around the notch: '+orientation);
 if(plan.count>1) assert(Math.hypot(plan.positions[0]!.x-plan.positions[1]!.x,plan.positions[0]!.z-plan.positions[1]!.z)>=length/plan.count-1e-7);
 cases++;
}
for(const shape of ['rectangle','custom'] as const)for(const [length,width] of [[3,2],[10,4.5],[25,12]]){
 const outline=buildOutline(shape,{...DEFAULT_DIMENSIONS,length,width},DEFAULT_CONTROL_POINTS),plan=planSkimmers(outline,outlineArea(outline));
 assert.equal(plan.count,Math.ceil(outlineArea(outline)/25));
 for(const [i,p] of plan.positions.entries()){
  assert(plan.positions.slice(i+1).every(q=>Math.hypot(p.x-q.x,p.z-q.z)>=.9-1e-7));
  const runs=boundaryRuns(outline);assert(runs.some(r=>r.points.slice(0,-1).some((a,j)=>{const b=r.points[j+1]!,dx=b[0]-a[0],dz=b[1]-a[1],u=((p.x-a[0])*dx+(p.z-a[1])*dz)/(dx*dx+dz*dz);return u>=-1e-6&&u<=1+1e-6&&Math.hypot(a[0]+u*dx-p.x,a[1]+u*dz-p.z)<1e-6;})));
 }
 cases++;
}
const rect=buildOutline('rectangle',{...DEFAULT_DIMENSIONS,length:10,width:4.5},DEFAULT_CONTROL_POINTS);
assert.deepEqual(planSkimmers(rect,45).positions,[{x:-2.5,z:-2.25,rotation:-0},{x:2.5,z:-2.25,rotation:-0}]);
assert(planSkimmers(rect,45,true,{axis:'z',coordinate:-2.25}).positions.every(p=>Math.abs(p.z+2.25)>1e-6));
assert.equal(planSkimmers(rect,45,false).count,0);
cases += 3;
const base=configuratorTesting.createInitialState();
for(const projectType of ['new','renovation'] as const){
 const config={...base.config,projectType,shape:'l-shape' as const,system:'skimmer' as const,features:[],dimensions:{...DEFAULT_DIMENSIONS,lShapeRecessLength:8,lShapeRecessWidth:2}};
 for(const [key,value,expected] of [['width',2,4],['length',3,5],['lShapeRecessLength',20,8],['lShapeRecessWidth',12,2.5]] as const){
  const result=configuratorTesting.reducer({...base,config},{type:'setDimension',key,value}).config;
  assert.equal(result.dimensions[key],expected);
  const outline=buildOutline(result.shape,result.dimensions,result.controlPoints);
  assert.equal(Math.max(...outline.map(p=>p[0]))-Math.min(...outline.map(p=>p[0])),result.dimensions.length);
  assert.equal(Math.max(...outline.map(p=>p[1]))-Math.min(...outline.map(p=>p[1])),result.dimensions.width);
  const limits=shapeDimensionLimits(result.shape,key,result.dimensions);
  assert(result.dimensions[key]!>=limits.min&&result.dimensions[key]!<=limits.max);cases++;
 }
 const previous={...config,shape:'rectangle' as const,dimensions:{...config.dimensions,length:3,width:2}};
 const selected=configuratorTesting.reducer({...base,config:previous},{type:'setShape',value:'l-shape'}).config;
 assert.equal(selected.dimensions.length,5);assert.equal(selected.dimensions.width,4);cases++;
 assert.equal(configuratorTesting.reducer({...base,config:previous},{type:'setDimension',key:'width',value:2}).config.dimensions.width,2);cases++;
}
for(const requested of [[NaN,0],[Infinity,0],DEFAULT_CONTROL_POINTS[0]!] as const){
 assert.equal(constrainControlPoints(DEFAULT_CONTROL_POINTS,0,requested,DEFAULT_DIMENSIONS),DEFAULT_CONTROL_POINTS);cases++;
}
console.log(JSON.stringify({status:'PASS',cases}));
