/** Three bounded pairs on isolated checkouts. Runtime normalization is QA-only. */
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const out=resolve('docs/fullscreen-qa-evidence/residual-gates');await mkdir(out,{recursive:true});
const prior=JSON.parse(await readFile('docs/fullscreen-qa-evidence/customer-final/performance-results.json','utf8'));
const config=prior.results.find(r=>r.draft)?.draft;assert(config?.dimensions.length===8);
// Existing canonical fixture from the accepted run, not a customer snapshot.
// The helper's Node fixture export contains no server credentials or network calls.
const {configuratorTesting}=await import(new URL('../node_modules/.cache/fullscreen-browser-qa/store.js',import.meta.url));
const {toProjectConfiguration}=await import(new URL('../node_modules/.cache/fullscreen-browser-qa/project.js',import.meta.url));
const state=configuratorTesting.createInitialState();state.config=config;
const fixture=toProjectConfiguration('00000000-0000-4000-8000-000000000099',state.config,state.renovation);
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling']});
const errors=[],results=[];const watchdog=setTimeout(()=>void browser.close(),480000);
const output={schema:1,created:new Date().toISOString(),viewport:{width:1440,height:900},DPR:1,drawBuffer:{width:1440,height:900},configurationSHA256:createHash('sha256').update(JSON.stringify(fixture)).digest('hex'),baseline:'2afb0544d4f51fa243cc3962fa4931d4f76229f6',candidate:'backup manifest residual-gates-20261015-sWK0s4 (uncommitted)',normalization:'Same fixed perspective camera/FOV, 1440×900 framebuffer and DPR1 via transient runtime override; application sources and user-selected details unchanged. Desktop hardware only, not real mobile.',results,errors};
const persist=()=>writeFile(resolve(out,'performance-controlled.json'),JSON.stringify(output,null,2));
let context,page;
async function open(port){
 context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
 page=await context.newPage();page.setDefaultTimeout(60000);
 page.on('pageerror',e=>errors.push({port,error:e.message}));
 await page.route('**/*',r=>r.request().method()==='POST'?r.abort():r.continue());
 await page.addInitScript(p=>localStorage.setItem('pool-shaper:project-draft:v1',JSON.stringify(p)),fixture);
 await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
 await page.locator('canvas').waitFor({state:'visible'});
 await page.bringToFront();
 const nav=page.getByRole('navigation',{name:'Fasi della configurazione'});
 await nav.getByRole('button',{name:/Presentazione/}).click();
 // Both use the same existing review selection. No capture/profiler while timing.
 const toggle=page.locator('.pool-dock-toggle');
 if(await toggle.count() && await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
 await page.waitForTimeout(6500);
 await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/@react-three_fiber.js'))?.name;
  if(!url)throw Error('Fiber resource unavailable');
  const f=await import(url),s=f._roots.get(document.querySelector('canvas')).store.getState();
  s.setDpr(1);s.gl.setPixelRatio(1);s.gl.setSize(1440,900,false);
  s.camera.position.set(11,7,10);s.camera.up.set(0,1,0);s.camera.fov=34;s.camera.aspect=1440/900;s.camera.clearViewOffset?.();
  s.controls?.target.set(0,-.5,0);if(s.controls)s.controls.enableDamping=false;
  s.camera.lookAt(0,-.5,0);s.camera.updateProjectionMatrix();s.camera.updateMatrixWorld(true);
 });
 await page.waitForTimeout(3000);
}
try{
 // Cache/assets warmup in the same browser, closing the scene before the next.
 for(const port of [3012,3013]){await open(port);await context.close();}
 for(let pair=0;pair<3;pair++){
  for(const port of pair===1?[3013,3012]:[3012,3013]){
   await open(port);
   const sample=await page.evaluate(async()=>{
    const resource=performance.getEntriesByType('resource').find(e=>e.name.includes('/@react-three_fiber.js'));
    const fiber=await import(resource.name),s=fiber._roots.get(document.querySelector('canvas')).store.getState();
    const gl=s.gl.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    const renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable';
    const start=s.camera.position.toArray(),intervals=[];
    await new Promise(done=>{let previous;const frame=t=>{if(previous!==undefined)intervals.push(t-previous);previous=t;if(intervals.length>=120)done();else requestAnimationFrame(frame)};requestAnimationFrame(frame)});
    intervals.sort((a,b)=>a-b);
    return {renderer,medianMs:intervals[60],p95Ms:intervals[114],calls:s.gl.info.render.calls,triangles:s.gl.info.render.triangles,textures:s.gl.info.memory.textures,geometries:s.gl.info.memory.geometries,buffer:{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight},dpr:s.gl.getPixelRatio(),camera:start,cameraEnd:s.camera.position.toArray(),fov:s.camera.fov,aspect:s.camera.aspect,visibility:document.visibilityState,contextLost:gl.isContextLost(),GPUmemoryBytes:null,GPUmemoryReason:'WebGL exposes resource counts, not reliable allocated VRAM bytes'};
   });
   assert(!/software|swiftshader|unavailable/i.test(sample.renderer));assert.equal(sample.dpr,1);assert.deepEqual(sample.buffer,{width:1440,height:900});
   for(let i=0;i<3;i++){assert(Math.abs(sample.camera[i]-[11,7,10][i])<1e-9,'fixed camera');assert(Math.abs(sample.camera[i]-sample.cameraEnd[i])<1e-9,'stable camera');}
   assert.equal(sample.fov,34);assert.equal(sample.aspect,1.6);assert.equal(sample.visibility,'visible');
   results.push({pair:pair+1,checkout:port===3012?'baseline':'candidate',...sample});await persist();console.log(JSON.stringify(results.at(-1)));
   await context.close();context=null;
  }
 }
 assert.equal(errors.length,0);
}catch(e){errors.push({error:String(e)});process.exitCode=1;}
finally{if(context)await context.close();clearTimeout(watchdog);await browser.close();await persist();}
