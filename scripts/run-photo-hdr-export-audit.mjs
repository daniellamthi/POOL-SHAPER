import assert from 'node:assert/strict';
import { build } from 'rolldown';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { FloatType, LinearSRGBColorSpace } from 'three';
const file = join(process.cwd(), 'node_modules/.cache/photo-hdr-export-audit.mjs');
await build({input:'src/components/pool/three/photoHDRExport.ts',output:{file,format:'esm'},platform:'node',
 external:['three','three-gpu-pathtracer'],resolve:{alias:{'@':join(process.cwd(),'src')}}});
const {installPhotoHDRExport}=await import(pathToFileURL(file).href);
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;};
class TestWorker {
 onmessage=null;onerror=null;onmessageerror=null;terminated=0;
 postMessage(data,transfer){this.input=structuredClone(data,{transfer});}
 terminate(){this.terminated++;}
 reply(buffer){this.onmessage({data:{type:'done',buffer}});}
}
function fixture(preserveRegions,captureFrame){
 const source=new Float32Array([.1,.2,.3,1,.4,.5,.6,1]);
 const raw={id:'borrowed texture'},target={width:2,height:1,texture:{type:FloatType}};
 const draws=[],preparing=[],workers=[],reads=[];
 const stock=(_target,_gl,quad)=>draws.push({kind:'stock',map:quad.material.map});
 const fallback=(_target,_gl,quad)=>draws.push({kind:'fallback',map:quad.material.map});
 const tracer={samples:189,pausePathTracing:false,renderToCanvasCallback:fallback};
 const gl={readRenderTargetPixels(_target,_x,_y,_w,_h,pixels){reads.push(_target);pixels.set(source.subarray(0,pixels.length));}};
 const quad={material:{opacity:1,map:raw}};
 const session=installPhotoHDRExport(tracer,stock,v=>preparing.push(v),()=>{const w=new TestWorker();workers.push(w);return w;},preserveRegions,captureFrame);
 return {source,raw,target,draws,preparing,workers,reads,tracer,gl,quad,session,
  draw(){tracer.renderToCanvasCallback(target,gl,quad);},fallback};
}
const warn=console.warn;let warnings=0;console.warn=()=>warnings++;
try {
 const f=fixture();try {
  f.session.request();f.draw();check(f.workers.length===0,'190 sample gate is retained');
  f.tracer.samples=190;f.draw();check(f.workers.length===1&&f.session.working,'one worker starts after gate');
  check(f.tracer.pausePathTracing&&f.preparing.at(-1)===true,'tracing paused while worker owns GPU work');
  check(f.workers[0].input.buffer.byteLength===32,'snapshot transferred with its full original length');
  check(f.source.byteLength===32&&f.source[0]>.09,'borrowed accumulator not transferred or changed');
  f.session.request();f.draw();check(f.workers.length===1,'duplicate export does not spawn another worker');
  f.workers[0].reply(new Float32Array([1,2,3,1,4,5,6,1]).buffer);
  check(!f.session.working&&f.workers[0].terminated===1,'completed worker terminated exactly once');
  check(f.preparing.at(-1)===false&&f.tracer.pausePathTracing,'UI released and clean photo frozen');
  check(!f.session.consumeExport(),'worker reply cannot export before a canvas draw');
  f.draw();const texture=f.draws.at(-1).map;
  check(f.draws.at(-1).kind==='stock'&&texture.isDataTexture,'stock reconstruction draws the clean HDR');
  check(texture.colorSpace===LinearSRGBColorSpace&&texture.image.data[0]===1,'output stays linear HDR');
  check(f.quad.material.map===f.raw,'borrowed interpolation material map restored');
  check(f.session.consumeExport()&&!f.session.consumeExport(),'one export after the actual draw');
  f.session.request();check(!f.session.consumeExport(),'cached photo still needs a fresh draw');f.draw();
  check(f.session.consumeExport()&&f.workers.length===1,'repeat download reuses the matching clean photo');
  let disposed=0;texture.addEventListener('dispose',()=>disposed++);f.session.reset();
  check(disposed===1&&!f.tracer.pausePathTracing,'reset disposes owned texture and resumes tracing');
  check(!f.session.consumeExport(),'reset never exports a stale photo');
 }finally{f.session.dispose();}check(f.tracer.renderToCanvasCallback===f.fallback,'dispose restores prior output callback');
 const c=fixture();try {
  c.tracer.samples=190;c.session.request();c.draw();const stale=c.workers[0];
  c.session.reset();stale.reply(new Float32Array(8).buffer);c.draw();
  check(stale.terminated===1&&!c.session.working,'cancel terminates the live worker');
  check(c.draws.at(-1).kind==='fallback'&&!c.session.consumeExport(),'late reply cannot publish or export an old pose');
  c.session.request();c.draw();check(c.workers.length===2,'new pose can start a fresh export');
  c.workers[1].reply(new ArrayBuffer(4));check(!c.session.working&&!c.tracer.pausePathTracing,'malformed output releases resources');
  check(!c.session.consumeExport(),'failure also waits for a new canvas draw');c.draw();
  check(c.session.consumeExport()&&c.draws.at(-1).kind==='fallback','failed cleanup exports the existing visible fallback');
 }finally{c.session.dispose();}
 const n=fixture();try {
  n.tracer.samples=190;n.session.request();n.draw();const values=new Float32Array(8);values[2]=NaN;n.workers[0].reply(values.buffer);n.draw();
  check(n.session.consumeExport()&&n.draws.at(-1).kind==='fallback','non-finite output rejected without contaminating canvas');
  const external=()=>{};n.tracer.renderToCanvasCallback=external;n.session.dispose();n.session.dispose();
  check(n.tracer.renderToCanvasCallback===external,'idempotent dispose preserves a newer callback owner');
 }finally{n.session.dispose();}
 const regions=[[[0,0],[.5,0],[.5,1],[0,1]]];let captures=0;
 const p=fixture(()=>{captures++;return regions;});try{p.tracer.samples=190;p.session.request();p.draw();check(captures===1,'preservation camera snapshot captured once with the HDR frame');check(JSON.stringify(p.workers[0].input.preservePolygons)===JSON.stringify(regions),'projected normalized water region reaches actual worker payload');regions[0][0][0]=.25;check(p.workers[0].input.preservePolygons[0][0][0]===0,'worker receives an owned snapshot, not changing live coordinates');}finally{p.session.dispose();}
 const display={width:2,height:1,texture:{type:FloatType}};const d=fixture(()=>[[[0,0],[.5,0],[.5,1],[0,1]]],()=>display);try{d.tracer.samples=190;d.session.request();d.draw();check(d.reads[0]===d.target,'the learned model must receive the original noisy accumulator');check(d.reads[1]===display,'only the preserved water region is read from the filtered display');check(d.workers[0].input.preserveRect.width===1&&d.workers[0].input.preserveRect.buffer.byteLength===16,'copy only the bounding water ROI, not a second full image');}finally{d.session.dispose();}
 const staleDisplay=fixture(undefined,()=>({width:1,height:1,texture:{type:FloatType}}));try{staleDisplay.tracer.samples=190;staleDisplay.session.request();staleDisplay.draw();check(staleDisplay.reads.length===0&&staleDisplay.workers.length===0,'stale dimensions cannot capture or start a worker');check(!staleDisplay.tracer.pausePathTracing,'stale display retains live tracing');staleDisplay.draw();check(staleDisplay.session.consumeExport(),'stale capture falls back to the current visible frame');}finally{staleDisplay.session.dispose();}
 const startup=fixture();try {
  startup.tracer.samples=190;startup.session.request();startup.draw();
  startup.workers[0].onmessage({data:{type:'error',message:'WebGL backend failed'}});
  check(!startup.session.working&&!startup.tracer.pausePathTracing,'backend failure releases worker and resumes tracing');
  check(startup.preparing.at(-1)===false&&startup.workers[0].terminated===1,'backend failure clears preparing and terminates once');
  check(!startup.session.consumeExport(),'backend failure cannot export before a canvas draw');startup.draw();
  check(startup.session.consumeExport()&&startup.draws.at(-1).kind==='fallback','backend failure exports the existing accumulated photo after drawing');
 }finally{startup.session.dispose();}
 check(warnings===4,'only deliberate invalid replies/display/startup trigger fallback warnings');
}finally{console.warn=warn;}
console.log(`Photo HDR export: ${checks} checks PASS (actual helper; simulated worker/GL, not visual/GPU acceptance).`);
