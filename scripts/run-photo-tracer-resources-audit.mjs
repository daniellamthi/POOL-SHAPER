import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),require=createRequire(root+'/package.json'),ts=require('typescript');
const T=await import(pathToFileURL(root+'/node_modules/three/build/three.module.js'));
const {WebGLPathTracer,PhysicalPathTracingMaterial}=await import(pathToFileURL(root+'/node_modules/three-gpu-pathtracer/src/index.js'));
const {PathTracingRenderer}=await import(pathToFileURL(root+'/node_modules/three-gpu-pathtracer/src/core/PathTracingRenderer.js'));
const {FullScreenQuad}=await import(pathToFileURL(root+'/node_modules/three/examples/jsm/postprocessing/Pass.js'));
const warnings=[];
const file='src/components/pool/three/photoTracerResources.ts';
const own=existsSync(file)?runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText+';exports;',{exports:{},console:{warn:(...a)=>warnings.push(a)}}).ownPhotoTracerResources:tracer=>({dispose(restore){restore();tracer.dispose();return Promise.resolve();}});
// Execute the installed disposal methods with real Three resources, avoiding a
// fake claim of GPU memory proof. Native enter/exit cycles verify allocations.
assert(!WebGLPathTracer.prototype.dispose.toString().includes('_lowResPathTracer'),'review wrapper ownership if the installed public cleanup changes');
assert(!PathTracingRenderer.prototype.dispose.toString().includes('.material.dispose()'),'review wrapper ownership if the installed renderer starts disposing its material');
const observed=new Map();
function observe(label,resource){assert(resource?.addEventListener,label);observed.set(label,0);resource.addEventListener('dispose',()=>observed.set(label,observed.get(label)+1));return resource;}
function renderer(material,prefix,compile){const r=Object.create(PathTracingRenderer.prototype);r._fsQuad=new FullScreenQuad(material);r._blendQuad=new FullScreenQuad(observe(prefix+'.blendMaterial',new T.ShaderMaterial()));r._primaryTarget=observe(prefix+'.primary',new T.WebGLRenderTarget());r._blendTargets=[0,1].map(i=>observe(prefix+'.blend'+i,new T.WebGLRenderTarget()));r._sobolTarget=observe(prefix+'.sobol',new T.WebGLRenderTarget());r._task={};r._compilePromise=null;r._compileFunction=compile;r.material=material;return r;}
function fixture(prefix){
 let compiles=0,restores=0,borrowedDisposals=0;const mat=observe(prefix+'.physical',new PhysicalPathTracingMaterial());
 const hdr=new T.DataTexture(new Float32Array(4*2*4).fill(.25),4,2,T.RGBAFormat,T.FloatType);mat.envMapInfo.updateFrom(hdr);
 const borrowed=new T.Texture();hdr.addEventListener('dispose',()=>borrowedDisposals++);borrowed.addEventListener('dispose',()=>borrowedDisposals++);mat.backgroundMap=borrowed;mat.uniforms.borrowedTest={value:hdr};
 const primary=renderer(mat,prefix+'.main',()=>compiles++),low=renderer(mat,prefix+'.low',()=>compiles++);mat.sobolTexture=primary._sobolTarget.texture;
 const rootTracer=Object.create(WebGLPathTracer.prototype);rootTracer._pathTracer=primary;rootTracer._lowResPathTracer=low;rootTracer._quad=new FullScreenQuad(observe(prefix+'.output',new T.ShaderMaterial()));rootTracer._internalBackground=observe(prefix+'.internalBackground',new T.Texture());rootTracer._colorBackground=observe(prefix+'.colorBackground',new T.Texture());
 for(const key of ['index','position','bvhBounds','bvhContents'])observe(prefix+'.bvh.'+key,mat.bvh[key]);
 for(const key of ['attributesArray','materialIndexAttribute','materials','stratifiedTexture','stratifiedOffsetTexture'])observe(prefix+'.'+key,mat[key]);
 observe(prefix+'.lights',mat.lights.tex);

 for(const key of ['map','marginalWeights','conditionalWeights'])observe(prefix+'.environment.'+key,mat.envMapInfo[key]);
 const seenTargets=new Set();let activeTarget=null,copies=0;const clear=new T.Color('#123456');let clearAlpha=.7;
 const gpu={toneMapping:T.ACESFilmicToneMapping,getRenderTarget(){assert.equal(this,gpu);return activeTarget;},setRenderTarget(target){assert.equal(this,gpu);activeTarget=target;if(target&&!seenTargets.has(target)){for(const key of ['textures','iesProfiles'])if(target.texture===mat[key]){seenTargets.add(target);observe(prefix+'.'+key+'.target',target);observe(prefix+'.'+key+'.copy',target.fsQuad.material);}}},getClearAlpha(){return clearAlpha;},getClearColor(out){return out.copy(clear);},setClearColor(color,alpha){clear.set(color);clearAlpha=alpha;},render(){assert.equal(this,gpu);copies++;}};
 return {tracer:rootTracer,material:mat,primary,low,upload(){for(const key of ['textures','iesProfiles'])mat[key].setTextures(gpu,[borrowed],4,4);assert.equal(activeTarget,null);assert.equal(gpu.toneMapping,T.ACESFilmicToneMapping);assert.equal(copies,2,'one copy per atlas, no extra draws');},restore(){restores++;mat.needsUpdate=true;},get compiles(){return compiles;},get restores(){return restores;},get borrowedDisposals(){return borrowedDisposals;}};
}
const f=fixture('normal');const owner=own(f.tracer);f.upload();const job=owner.dispose(f.restore);assert.equal(f.compiles,0,'restoring owned shader adapters must not start new compilations');const again=owner.dispose(f.restore);assert.equal(job,again,'one cleanup job per owner');assert.equal(f.restores,1,'borrowed scene restoration happens once');
await job;for(const [key,count]of observed)assert.equal(count,1,key+' disposed once');assert.equal(f.borrowedDisposals,0,'borrowed scene and HDR source survive');assert.equal(f.primary._task,null);assert.equal(f.low._task,null);
let resolve;const pending=new Promise(done=>resolve=done);const d=fixture('pending');d.primary._compilePromise=pending;const deferredOwner=own(d.tracer);d.upload();const pendingJob=deferredOwner.dispose(d.restore);assert.equal(d.restores,1);assert.equal(observed.get('pending.main.primary'),1,'stop rendering promptly');assert.equal(observed.get('pending.physical'),0,'do not destroy a program while compileAsync polls it');resolve();await pendingJob;for(const [key,count]of observed)if(key.startsWith('pending.'))assert.equal(count,1,key);assert.equal(d.borrowedDisposals,0);
const failure=fixture('failure');const failedOwner=own(failure.tracer);failure.upload();failure.material.lights.tex.dispose=()=>{throw new Error('controlled resource failure');};await failedOwner.dispose(()=>{failure.restore();throw new Error('controlled restore failure');});assert.equal(observed.get('failure.physical'),1,'continue releasing after a failure');assert.equal(observed.get('failure.low.primary'),1);assert.equal(failure.borrowedDisposals,0);assert(warnings.length>0,'cleanup failures stay observable');
console.log(JSON.stringify({status:'PASS',ownedResourcesPerNormalOwner:[...observed.keys()].filter(k=>k.startsWith('normal.')).length,scope:'Installed disposal methods and real resources; shared material/atlas ownership, borrowed-resource survival, idempotency, shader listener removal, pending compile and best-effort failure. Native GPU acceptance separate.'}));
