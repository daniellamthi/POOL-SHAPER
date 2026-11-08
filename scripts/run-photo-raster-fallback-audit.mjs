// Regression trigger: using each newly owned photographic camera for the
// preparation raster allocates another persistent Three185 transmission FBO.
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {runInNewContext} from 'node:vm';
const root=process.cwd(),require=createRequire(root+'/package.json');
const T=await import(pathToFileURL(root+'/node_modules/three/build/three.module.js'));
const ts=require('typescript'),file=root+'/src/components/pool/three/photoRasterFallback.ts';
const render=existsSync(file)?runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText+';exports;', {exports:{},require:n=>{assert.equal(n,'three');return T;}}).renderPhotoRasterFallback:(gl,scene,editor,photo)=>gl.render(scene,photo);
const scene=new T.Scene(),editor=new T.PerspectiveCamera(45,1.2,.1,100),parent=new T.Group();
parent.position.set(2,3,4); parent.rotation.y=.4; parent.add(editor); editor.position.set(1,2,3); parent.updateMatrixWorld(true);
const editorBefore=JSON.stringify(editor.toJSON()), ids=new Set(); let latest;
const gl={render(s,c){assert.equal(s,scene); latest=c; ids.add(c.id);}};
for(let i=0;i<12;i++){
 const photo=new T.PerspectiveCamera(34+i,1.2,.1,100);
 photo.position.set(-5+i*.1,3,2);photo.rotation.set(-.4,.5,0);photo.updateMatrixWorld(true);
 photo.matrixAutoUpdate=false; photo.matrixWorldAutoUpdate=true;
 photo.setViewOffset(1000,800,120,30,800,700);
 const before=JSON.stringify(photo.toJSON());
 render(gl,scene,editor,photo);
 assert.notEqual(latest,editor,'never render/mutate the editor camera');
 assert.notEqual(latest,photo,'fallback has a bounded persistent camera identity');
 assert.deepEqual(latest.matrixWorld.elements,photo.matrixWorld.elements);
 assert.deepEqual(latest.matrixWorldInverse.elements,photo.matrixWorldInverse.elements);
 assert.deepEqual(latest.projectionMatrix.elements,photo.projectionMatrix.elements);
 latest.updateMatrixWorld();
 assert.deepEqual(latest.matrixWorld.elements,photo.matrixWorld.elements,'renderer update keeps the exact photographic pose');
 assert.equal(JSON.stringify(photo.toJSON()),before,'photo camera stays untouched');
}
assert.equal(ids.size,1,'reopening photo must reuse one camera-indexed transmission target');
assert.equal(JSON.stringify(editor.toJSON()),editorBefore,'parented editor camera stays untouched');
const cycleCameras=ids.size;
const previous=latest,second=new T.PerspectiveCamera();render(gl,scene,second,second);
assert.notEqual(latest,previous,'different editors stay isolated');
const ortho=new T.OrthographicCamera(-2,3,4,-1,.1,100);ortho.position.set(1,5,2);ortho.updateMatrixWorld(true);
render(gl,scene,ortho,ortho);assert(latest.isOrthographicCamera);assert.deepEqual(latest.projectionMatrix.elements,ortho.projectionMatrix.elements);
// Confirm the real installed dependency still uses the diagnosed cache key.
const rendererSource=readFileSync(root+'/node_modules/three/src/renderers/WebGLRenderer.js','utf8');
assert(rendererSource.includes('transmissionRenderTarget[ camera.id ]'));
if(existsSync(file))assert(readFileSync(root+'/src/components/pool/three/PhotoModeRenderer.tsx','utf8').includes('tracer.rasterizeSceneCallback = (scene, photoCamera) => renderPhotoRasterFallback(gl, scene, camera, photoCamera);'),'actual tracer callback must use the bounded fallback');
console.log(JSON.stringify({status:'PASS',cycles:12,uniqueFallbackCameras:cycleCameras,scope:'Real Three cameras, exact world/projection, parented editor isolation, perspective/orthographic and caller integration. Native GPU cycle validation remains separate.'}));
