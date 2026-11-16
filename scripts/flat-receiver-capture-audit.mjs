import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
const load=(file,require)=>{const context={exports:{},require,queueMicrotask,performance};runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);return context.exports;};
const lens=load('src/components/pool/three/flatWaterProjection.ts',name=>name==='three'?THREE:{photoModeState:{active:false}});
const {WaterRefractionDepth}=load('src/components/pool/three/waterRefractionDepth.ts',name=>name==='three'?THREE:lens);
let checks=0;const check=(value,label)=>{assert(value,label);checks++;};
const owner=new WaterRefractionDepth(),scene=new THREE.Scene(),basin=new THREE.Group();basin.name='pool-basin';scene.add(basin);
const geometry=new THREE.BoxGeometry(),floor=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial()),dry=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
const water=new THREE.Mesh(geometry,new THREE.MeshPhysicalMaterial({transmission:1}));basin.add(floor,water);scene.add(dry);
const opaque=new THREE.MeshStandardMaterial(),transparent=new THREE.MeshBasicMaterial({transparent:true});
const mixed=new THREE.Mesh(geometry,[opaque,transparent]);basin.add(mixed);
const originals=[floor.onBeforeRender,dry.onBeforeRender];
scene.background=new THREE.Color('blue');const background=scene.background;
const camera=new THREE.PerspectiveCamera(45,1.6,.1,500);camera.position.set(8,6,5);camera.lookAt(0,-1.5,0);camera.updateMatrixWorld();
const previous=new THREE.WebGLRenderTarget(1,1);let target=previous,renders=0,fail=false,expectedOptical=true,clearColor=new THREE.Color('red'),clearAlpha=.7;
const gl={shadowMap:{autoUpdate:true},xr:{enabled:true},getDrawingBufferSize:v=>v.set(1440,900),getRenderTarget:()=>target,setRenderTarget:v=>{target=v;},getClearColor:v=>v.copy(clearColor),getClearAlpha:()=>clearAlpha,setClearColor:(c,a)=>{clearColor.set(c);clearAlpha=a;},clear(){},render(){
 renders++;check(scene.background===null&&clearAlpha===0,'Receiver target cleared to invalid transparent pixels');
 check(!water.visible,'No self-feedback');
 floor.onBeforeRender(gl,scene,camera,geometry,owner.material,null);check(owner.receiverUniforms.poolLensActive.value===expectedOptical,'Only active basin uses same optical vertex projection');
 dry.onBeforeRender(gl,scene,camera,geometry,owner.material,null);check(!owner.receiverUniforms.poolLensActive.value,'Exterior/dry receiver not projected');
 check(owner.material.uniformsNeedUpdate,'Per-mesh scope uploads on override ShaderMaterial');
 mixed.onBeforeRender(gl,scene,camera,geometry,owner.material,{materialIndex:0});check(owner.receiverUniforms.poolReceiverVisible.value,'Opaque group contributes receiver depth');
 mixed.onBeforeRender(gl,scene,camera,geometry,owner.material,{materialIndex:1});check(!owner.receiverUniforms.poolReceiverVisible.value,'Transparent group never becomes an opaque override occluder');
 if(fail)throw Error('expected');
}};
owner.retain();check(owner.capture(gl,scene,camera,'g1',{waterY:0,ior:1.333}),'First receiver capture');
check(owner.target.texture.type===THREE.HalfFloatType&&owner.target.texture.minFilter===THREE.LinearFilter,'Bounded filtered physical world field');
check(owner.target.width===1024&&owner.target.height===640,'Aspect-preserving max1024 capture');
check(target===previous&&scene.overrideMaterial===null&&scene.background===background&&clearAlpha===.7&&clearColor.equals(new THREE.Color('red')),'Target/override/background/clear restored');
check(floor.onBeforeRender===originals[0]&&dry.onBeforeRender===originals[1]&&water.visible&&gl.xr.enabled&&gl.shadowMap.autoUpdate,'Callbacks/visibility/XR/shadows restored');
check(!owner.capture(gl,scene,camera,'g1',{waterY:0,ior:1.333})&&renders===1,'Stable frame no extra pass');
check(owner.capture(gl,scene,camera,'g1',{waterY:.1,ior:1.333}),'Water plane invalidates cache');
expectedOptical=false;check(owner.capture(gl,scene,camera,'g1'),'Infinity legacy projection invalidates optical field');
expectedOptical=true;fail=true;assert.throws(()=>owner.capture(gl,scene,camera,'g2',{waterY:0,ior:1.333}));checks++;
check(!owner.uniforms.poolDepthReady.value&&target===previous&&scene.background===background&&floor.onBeforeRender===originals[0]&&water.visible,'Failed capture disabled and all owners restored');
owner.release();await new Promise(queueMicrotask);check(!owner.uniforms.poolDepthReady.value,'Unmount invalidates field');
const fallback = new WaterRefractionDepth(false);fail=false;expectedOptical=false;
// Same capture behaviour without a float colour target; no false hardware claim.
check(fallback.target.texture.type===THREE.UnsignedByteType,'No-float devices keep a supported colour attachment');
check(!fallback.uniforms.poolDepthWorld.value,'No-float world-field sampling disabled');
fallback.dispose();
const waterSource=readFileSync('src/components/pool/three/WaterSurfaceMaterial.tsx','utf8');
check(waterSource.includes('interfaceY.current.value = waterLevel')&&waterSource.includes('shader.uniforms["poolInterfaceY"] = interfaceY.current'),'Retained material receives live Slim/High water elevation without recompilation');
// CPU reference of the bounded shader solve, not a claim of measured browser pixels.
const error=(r,h,d,a,ior)=>a/Math.hypot(h,a)-ior*(r-a)/Math.hypot(d,r-a);
for(const h of [.15,1,6,14])for(const d of [.02,.2,.5,1.5,3])for(const r of [.01,.5,5,15]){
 let lo=0,hi=r;for(let i=0;i<16;i++){const a=(lo+hi)*.5;if(error(r,h,d,a,1.333)>0)hi=a;else lo=a;}
 const a=(lo+hi)*.5;check(Math.abs(error(r,h,d,a,1.333))<.006,'Bounded flat Snell residual across shallow/deep/grazing cases');
}
for(const m of [floor,dry,water])m.material.dispose();opaque.dispose();transparent.dispose();geometry.dispose();previous.dispose();
console.log(JSON.stringify({status:'PASS',checks,scope:'Actual capture ownership/cache/failure/format; numerical bounded Snell solve, separate from browser QA'}));
