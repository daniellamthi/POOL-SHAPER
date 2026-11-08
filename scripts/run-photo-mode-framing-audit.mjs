import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import {StaticGeometryGenerator} from '../node_modules/three-gpu-pathtracer/src/core/utils/StaticGeometryGenerator.js';
const {Matrix4}=THREE;
const source=ts.createSourceFile('PhotoModeRenderer.tsx',readFileSync('src/components/pool/three/PhotoModeRenderer.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let callback;
const visit=n=>{if(ts.isCallExpression(n)&&n.expression.getText(source)==='useFrame') callback=n.arguments[0];ts.forEachChild(n,visit);};visit(source);assert(callback);
const cameraModule={exports:{}};
runInNewContext(ts.transpileModule(readFileSync('src/components/pool/three/photoCamera.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:cameraModule.exports,require:id=>{assert.equal(id,'three');return THREE;}});
let updates=0,resets=0,exports=0,hdrResets=0;
const tracer={samples:200,updateCamera(){updates++;},reset(){resets++;this.samples=0;},renderSample(){this.samples++;}};
const camera=new THREE.PerspectiveCamera(52,1280/720,.1,500);
camera.updateMatrixWorld(true);
const size=new THREE.Vector2(1280,720),photoFrame=cameraModule.exports.createPhotoCamera(camera,[]);
photoFrame.sync(camera,size);
const refs={hdrExportRef:{current:null},bufferSize:{current:size.clone()},lastBufferSize:{current:size.clone()},tracerRef:{current:tracer},lastCameraMatrix:{current:camera.matrixWorld.clone()},lastProjectionMatrix:{current:camera.projectionMatrix.clone()},lastHandledExportId:{current:0}};
const state={samples:200,exportRequestId:0,contextRestoreRequestId:0,contextLost:false};
Object.assign(refs,{lastRestoreRequestId:{current:0},contextWatch:{current:{isLost:()=>false,stamp:()=>0,valid:()=>true}}});
const frame=runInNewContext(ts.transpileModule('('+callback.getText(source)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{...refs,camera,photoFrame,photoModeState:state,PHOTO_MODE_EXPORT_READY_SAMPLES:190,gl:{getContext:()=>({isContextLost:()=>false}),getDrawingBufferSize:target=>target.copy(size)},exportCurrentFrame(){exports++;}});
frame();assert.equal(updates,0);assert.equal(state.samples,201);
camera.zoom=1.1;camera.updateProjectionMatrix();state.exportRequestId++;frame();assert.equal(updates,1);assert.equal(resets,1);assert.equal(state.samples,1);assert.equal(exports,0,'stale enabled button cannot export new noisy projection');
frame();assert.equal(updates,1,'stationary frames keep convergence');
const fullProjection=photoFrame.camera.projectionMatrix.clone();
camera.setViewOffset(1280,420,0,-100,1280,720);frame();
assert.equal(resets,1,'panel-only projection changes preserve photographic convergence');
assert(photoFrame.camera.projectionMatrix.equals(fullProjection));
camera.position.set(2,1,3);camera.updateMatrixWorld(true);frame();assert.equal(updates,2);assert.equal(resets,2);
tracer.samples=190;state.exportRequestId++;frame();assert.equal(exports,1);frame();assert.equal(exports,1,'one export per request');
refs.hdrExportRef.current={reset(){hdrResets++;},working:true};
size.multiplyScalar(2);frame();assert.equal(resets,3,'DPR-only output resize cancels stale accumulation');assert.equal(hdrResets,1);assert.equal(tracer.samples,0,'busy worker pauses rendering after invalidation');
assert(photoFrame.camera.projectionMatrix.equals(fullProjection),'DPR resize retains optical framing');
refs.hdrExportRef.current=null;refs.tracerRef.current=null;frame();assert.equal(exports,1);
console.log('PASS: actual render callback — owned photo camera, pose/lens/size invalidation, panel-only convergence, HDR cancellation, stale-export guard and unmount');

let normalize;
const findNormalize=n=>{if(ts.isCallExpression(n)&&n.expression.getText(source)==='scene.traverseVisible') normalize=n.arguments[0];ts.forEachChild(n,findNormalize);};findNormalize(source);assert(normalize);
const geometryOverrides=[];
const convert=runInNewContext(ts.transpileModule('('+normalize.getText(source)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{THREE,geometryOverrides});
const geometry=new THREE.BoxGeometry();
const values=new Float32Array(geometry.getAttribute('position').count*3).fill(.73);
geometry.setAttribute('color',new THREE.BufferAttribute(values,3));
const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true}));
convert(mesh);
assert.notEqual(mesh.geometry,geometry);assert.equal(geometry.getAttribute('color').itemSize,3);
const rgba=mesh.geometry.getAttribute('color');assert.equal(rgba.itemSize,4);
for(let i=0;i<rgba.count;i++){assert.equal(rgba.getX(i),values[0]);assert.equal(rgba.getW(i),1);}
convert(mesh);assert.equal(geometryOverrides.length,1);
for(const item of geometryOverrides){item.mesh.geometry=item.original;item.override.dispose();}
assert.equal(mesh.geometry,geometry);geometry.dispose();mesh.material.dispose();
console.log('PASS: traced RGB→RGBA preserves every colour, alpha 1, original geometry and restoration');

const tracedScene=new THREE.Scene();
for(const value of [null,.73]){
 const geo=new THREE.BoxGeometry();
 if(value!==null) geo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count*3).fill(value),3));
 tracedScene.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:value!==null})));
}
tracedScene.updateMatrixWorld(true);tracedScene.traverse(convert);
const merged=new StaticGeometryGenerator(tracedScene).generate().geometry;
const mergedColor=merged.getAttribute('color');
for(let i=0;i<mergedColor.count;i++) {assert(mergedColor.getX(i)>.7);assert.equal(mergedColor.getW(i),1);}
merged.dispose();tracedScene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
console.log('PASS: installed path-tracer merger retains mixed coloured/uncoloured meshes without black vertices');

const water=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='createPhotoModeWaterMaterial');assert(water);
const waterPreset=runInNewContext(ts.transpileModule(readFileSync('src/configurator/materials/visual-presets.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText+';exports;',{exports:{}}).WATER_VISUAL_PRESET;
const createWater=runInNewContext(ts.transpileModule('('+water.getText(source)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{THREE,WATER_VISUAL_PRESET:waterPreset,PHOTO_MODE_WATER_NORMAL_SCALE:.6});
const texture=new THREE.Texture(),outdoorWater=createWater(texture),indoorWater=createWater(texture,true);
assert.equal(outdoorWater.color.getHex(),0xffffff,'clear surface does not double-tint the selected liner');
assert.equal(indoorWater.color.getHex(),0xffffff);assert.equal(indoorWater.attenuationColor.getHex(),outdoorWater.attenuationColor.getHex());
assert.equal(indoorWater.ior,waterPreset.ior);assert.equal(indoorWater.attenuationDistance,waterPreset.attenuationDistance);
assert.equal(indoorWater.normalScale.x,.18);assert.equal(outdoorWater.normalScale.x,.6);
assert.equal(indoorWater.normalMap,texture);assert.equal(indoorWater.opacity,1);assert(indoorWater.transmission>.9);
const pureWater=createWater(texture,false,true);
assert.equal(pureWater.transmission,1,'bounded Night water has no diffuse white surface lobe');
assert.equal(outdoorWater.transmission,.92,'previous contexts retain the accepted interface');
assert.equal(indoorWater.transmission,.92,'indoor interface remains unchanged');
assert.equal(pureWater.normalScale.x,outdoorWater.normalScale.x);assert.equal(pureWater.ior,outdoorWater.ior);
pureWater.dispose();indoorWater.dispose();outdoorWater.dispose();texture.dispose();
console.log('PASS: clear photographic water, retained IOR/attenuation, calmer indoor normals, unchanged outdoor normal strength');
