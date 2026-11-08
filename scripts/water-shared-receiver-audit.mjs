import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(process.cwd()+'/package.json'),ts=require('typescript'),T=require('three');
const load=(file,imports)=>{const scope={exports:{},require:imports,queueMicrotask,performance};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,scope);return scope.exports;};
const lens=load('src/components/pool/three/flatWaterProjection.ts',name=>name==='three'?T:{photoModeState:{active:false}});
const {WaterRefractionDepth,WATER_DEPTH_REFRACTION:glsl}=load('src/components/pool/three/waterRefractionDepth.ts',name=>name==='three'?T:lens);
assert.equal((glsl.match(/uniform sampler2D poolOpaque\w+;/g)||[]).length,1,'mutually exclusive world/depth receiver paths must use one GPU sampler');
const owner=new WaterRefractionDepth(),scene=new T.Scene(),camera=new T.PerspectiveCamera(48,1.6,.1,100);
camera.position.set(4,3,5);camera.lookAt(0,-1,0);camera.updateMatrixWorld(true);
let target=null,draws=0,fail=false;const gl={shadowMap:{autoUpdate:true},xr:{enabled:false},getDrawingBufferSize:v=>v.set(1280,800),getRenderTarget:()=>target,setRenderTarget:v=>{target=v;},getClearColor:v=>v.set(0),getClearAlpha:()=>1,setClearColor(){},clear(){},render(){draws++;if(fail)throw Error('controlled failed capture');}};
const binding=owner.uniforms.poolOpaqueReceiver,version=owner.material.version;
assert(binding);
assert(owner.capture(gl,scene,camera,'same geometry'));
assert.equal(binding.value,owner.target.depthTexture,'legacy capture samples the original hardware depth');
assert.equal(owner.uniforms.poolDepthWorld.value,false);
assert(owner.capture(gl,scene,camera,'same geometry',{waterY:-.054,ior:1.333}));
assert.equal(binding.value,owner.target.texture,'metric capture samples the unchanged world-position image');
assert.equal(owner.uniforms.poolDepthWorld.value,true);
assert.equal(owner.uniforms.poolOpaqueReceiver,binding,'same live uniform object across encoding switches');
assert(!owner.capture(gl,scene,camera,'same geometry',{waterY:-.054,ior:1.333}));assert.equal(draws,2,'no additional capture/draw for sampler sharing');
assert(owner.capture(gl,scene,camera,'same geometry'));
assert.equal(binding.value,owner.target.depthTexture);assert.equal(owner.material.version,version,'encoding switches never recompile the capture material');
fail=true;assert.throws(()=>owner.capture(gl,scene,camera,'new geometry',{waterY:-.054,ior:1.333}));assert.equal(owner.uniforms.poolDepthReady.value,false);assert.equal(binding.value,owner.target.depthTexture,'failed capture never publishes another encoding');fail=false;
const fallback=new WaterRefractionDepth(false);fallback.capture(gl,scene,camera,'no float',{waterY:0,ior:1.333});assert.equal(fallback.uniforms.poolOpaqueReceiver.value,fallback.target.depthTexture);assert.equal(fallback.uniforms.poolDepthWorld.value,false);assert.equal(fallback.target.texture.type,T.UnsignedByteType);
// Execute the actual GLSL receiver lookup; translate only vector/matrix syntax
// to real Three operations, keeping the branch and texture-selection code.
let lookup=glsl.slice(glsl.indexOf('vec3 poolOpaqueWorld('),glsl.indexOf('bool poolWetReceiver('));
lookup=lookup.replace(/^#(?:ifdef|endif).*$/gm,'').replace('vec3 poolOpaqueWorld(vec2 uv)','function lookup(uv)').replace('vec4 receiver =','const receiver =').replace('float depth =','const depth =');
lookup=lookup.replace('vec4 view = poolDepthInverseProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);','const view = new T.Vector4(uv.x*2-1,uv.y*2-1,depth*2-1,1).applyMatrix4(poolDepthInverseProjection);');
lookup=lookup.replace('return (poolDepthViewToWorld * vec4(view.xyz / view.w, 1.0)).xyz;','const point = new T.Vector4(view.x/view.w,view.y/view.w,view.z/view.w,1).applyMatrix4(poolDepthViewToWorld); return new T.Vector3(point.x,point.y,point.z);');
let reads=0;
const runLookup=(world,pixel,depthBinding)=>vm.runInNewContext(lookup+';lookup;', {T,poolDepthWorld:world,poolOpaqueReceiver:depthBinding,poolInterfaceY:-.054,poolDepthInverseProjection:camera.projectionMatrixInverse,poolDepthViewToWorld:camera.matrixWorld,vec3:(x,y,z)=>new T.Vector3(x,y,z),texture2D:(texture,uv)=>{reads++;assert.equal(texture,depthBinding);return pixel;}});
for(const world of [false,true])for(const uv of [new T.Vector2(.2,.3),new T.Vector2(.8,.7)]){
 const point=new T.Vector3(.3,-1.5,.7),projected=point.clone().project(camera),depth=(projected.z+1)/2;
 const pixel=world?{xyz:point,a:1}:{x:depth},selected=world?owner.target.texture:owner.target.depthTexture;
 const got=runLookup(world,pixel,selected)(uv);
 if(world)assert(got.equals(point));else{const reference=new T.Vector3(uv.x*2-1,uv.y*2-1,depth*2-1).unproject(camera);assert(got.distanceTo(reference)<1e-10);}
}
assert.equal(reads,4,'each lookup fetches exactly its chosen encoding once');
const invalid=runLookup(true,{xyz:new T.Vector3(8,9,10),a:0},owner.target.texture)(new T.Vector2(.5,.5));assert.equal(invalid.y,-.054+1,'invalid world pixels keep the exact dry-receiver sentinel');
owner.dispose();fallback.dispose();
console.log(JSON.stringify({status:'PASS',scope:'Actual capture and GLSL lookup: one sampler, identical world/depth images and decode, encoding toggles/cache/failure/no-float fallback, no added draws or material recompilation. Native shader acceptance separate.'}));
