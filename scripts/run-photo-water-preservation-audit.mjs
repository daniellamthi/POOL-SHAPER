import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(process.cwd()+'/package.json'),ts=require('typescript'),THREE=require('three');
const path='src/components/pool/three/photoWaterPreservation.ts';assert(fs.existsSync(path),'HDR cleanup must preserve projected water rather than smooth its ripple signal');
const {projectPhotoWaterPreservation:project}=vm.runInNewContext(ts.transpile(fs.readFileSync(path,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022})+';exports;',{exports:{},require:id=>id==='three'?THREE:require(id)});
const {createPreservationMask:mask}=await import(process.cwd()+'/public/vendor/photo-denoise/preserve-regions.js');
const inside=(x,z,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const shapes=[[[-2,-1],[2,-1],[2,1],[-2,1]],[[-2,-2],[2,-2],[2,0],[0,0],[0,2],[-2,2]],Array.from({length:24},(_,i)=>[2*Math.cos(i*Math.PI/12),Math.sin(i*Math.PI/12)])];let views=0,pixels=0,boundaryPixels=0;
for(const outline of shapes)for(const position of [[-7,3,.45],[-1,.4,.3],[0,3,0],[4,2,4]])for(const reverse of [false,true]){
 const camera=new THREE.PerspectiveCamera(70,1.5,.1,50);camera.position.set(...position);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const poly=reverse?[...outline].reverse():outline,polygons=project({outline:poly,waterY:0},camera),w=90,h=60,result=mask(w,h,polygons);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((x+.5)/w*2-1,(y+.5)/h*2-1),camera);const point=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
  let expected=!!point&&inside(point.x,point.z,poly);
  if(point){const depth=point.clone().project(camera).z;expected=expected&&depth>=-1&&depth<=1;}
  const onEdge=point&&poly.some((a,i)=>{const b=poly[(i+1)%poly.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((point.x-a[0])*dx+(point.z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(point.x-a[0]-t*dx,point.z-a[1]-t*dz)<1e-7;});
  if(onEdge){boundaryPixels++;continue;} // Exact edge centres have no unique binary coverage; native AA is not modelled here.
  assert.equal(!!result?.[y*w+x],expected,'projection/raster mask matches independent camera-ray/outline intersection');pixels++;
 }
 views++;
}
assert.equal(mask(8,8,[]),null,'existing unmasked export allocates no mask');
assert.throws(()=>mask(2,2,[[[NaN,0],[1,0],[1,1]]]),/preservation/i);
// Execute the real worker with controlled inference/transfer boundaries. The
// learned model is NOT simulated as visual evidence; test only exact HDR
// ownership, orientation and protected-pixel bypass after its reply.
const worker=fs.readFileSync('public/vendor/photo-denoise/photo-hdr-worker.js','utf8').replace(/^import .*;\n/gm,'');let output,modelInput,disposed=0;
class Denoiser{backendReady=true;setInputData(_name,data){modelInput=data;}async execute(){return new Float32Array(12).fill(.75);}dispose(){disposed++;}}
const self={addEventListener(){},removeEventListener(){},location:{href:'http://local/vendor/photo-denoise/photo-hdr-worker.js'},postMessage:msg=>{output=msg;}};
vm.runInNewContext(worker,{Denoiser,createPreservationMask:mask,hdrTransferFuncCPU:({data})=>data,hdrTransferFuncInverseCPU:({data})=>data,self,URL,Float32Array,ArrayBuffer,Number,Math,Error,Promise});
const original=new Float32Array([20,2,.3,1,.2,.3,.4,1,.3,.4,.5,1,.4,.5,.6,1]);
await self.onmessage({data:{width:2,height:2,buffer:original.buffer,preservePolygons:[[[0,0],[.5,0],[.5,1],[0,1]]]}});assert.equal(output.type,'done');const clean=new Float32Array(output.buffer);
for(const pixel of [0,2])for(let c=0;c<4;c++)assert.equal(clean[pixel*4+c],original[pixel*4+c],'protected bottom-up HDR pixels bit-identical');
for(const pixel of [1,3])for(let c=0;c<3;c++)assert.equal(clean[pixel*4+c],.75,'unprotected pixels use model result');assert.equal(disposed,1);
const overlay=new Float32Array([.91,.82,.73,1,.64,.55,.46,1]);
await self.onmessage({data:{width:2,height:2,buffer:original.buffer,preservePolygons:[[[0,0],[.5,0],[.5,1],[0,1]]],preserveRect:{x:0,y:0,width:1,height:2,buffer:overlay.buffer}}});assert.equal(output.type,'done');const combined=new Float32Array(output.buffer);
for(const [pixel,source]of [[0,0],[2,1]])for(let c=0;c<4;c++)assert.equal(combined[pixel*4+c],overlay[source*4+c],'protected pixels use the filtered display ROI');
assert(modelInput.includes(20),'model still receives original raw HDR, not prefiltered overlay');
for(const pixel of [1,3])for(let c=0;c<3;c++)assert.equal(combined[pixel*4+c],.75,'dry areas retain model output');
const corner=new Float32Array([9,8,7,1]);await self.onmessage({data:{width:2,height:2,buffer:original.buffer,preservePolygons:[[[.5,.5],[1,.5],[1,1],[.5,1]]],preserveRect:{x:1,y:1,width:1,height:1,buffer:corner.buffer}}});assert.equal(output.type,'done');const shifted=new Float32Array(output.buffer);for(let c=0;c<4;c++)assert.equal(shifted[12+c],corner[c],'nonzero bottom-up ROI offset');for(const pixel of [0,1,2])for(let c=0;c<3;c++)assert.equal(shifted[pixel*4+c],.75,'translated ROI leaves every other pixel denoised');
await self.onmessage({data:{width:2,height:2,buffer:original.buffer,preserveRect:{x:2,y:0,width:1,height:2,buffer:overlay.buffer}}});assert.equal(output.type,'error');assert.match(output.message,/preservation pixels/);
await self.onmessage({data:{width:2,height:2,buffer:original.buffer,preservePolygons:[[[0,0],[.5,0],[.5,1],[0,1]]],preserveRect:{x:1,y:0,width:1,height:2,buffer:overlay.buffer}}});assert.equal(output.type,'error');assert.match(output.message,/outside captured ROI/);
console.log(`PASS: ${views} clipped/reversed perspective views, ${pixels} actual projection/mask pixels (${boundaryPixels} exact edge centres excluded); raw-model input, separate filtered HDR ROI preservation, shifted offsets, unprotected output and worker disposal. Native learned-model acceptance separate.`);
