import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const load=(file,require=()=>({}))=>runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText+';exports;',{exports:{},require});
const helper=load('src/components/pool/three/cataloguePlantGeometry.ts',id=>id==='three'?THREE:{mergeGeometries});
const coverage=load('src/components/pool/three/catalogueFoliageCoverage.ts');
const {planCatalogueArchitecture:plan}=load('src/lib/pool/catalogue-architecture.ts');
const proxyTools=load('src/components/pool/three/catalogueRoomProxy.ts',id=>id==='three'?THREE:coverage);
const bytes=readFileSync('public/models/catalogue/canopy-packed.glb');
assert.equal(createHash('sha256').update(bytes).digest('hex'),'ec85a5db96544d2e23946ae26a0bdecb812b5cc1c72df206e0049f4a92f0051d');
const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
assert(json.extensionsRequired.includes('EXT_meshopt_compression'));assert(json.extensionsRequired.includes('KHR_mesh_quantization'));
const derivation=JSON.parse(readFileSync('public/models/catalogue/canopy-derivation.json','utf8'));
for(const image of derivation.images)assert.equal(createHash('md5').update(readFileSync('public/textures/catalogue/canopy/'+image.name)).digest('hex'),image.md5,'original photograph bytes retained');
globalThis.self=globalThis;const manager=new THREE.LoadingManager();manager.addHandler(/\.(jpg|png)$/, {load(url,onLoad){const texture=new THREE.Texture();queueMicrotask(()=>onLoad(texture));return texture;}});
const asset=await new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
let sourceDisposals=0;const sourceHashes=new Map();asset.scene.traverse(object=>{if(object.isMesh){const a=object.geometry.attributes.position;assert(a.array instanceof Uint16Array,'fixture exercises quantized positions');sourceHashes.set(object.geometry,createHash('sha256').update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength)).digest('hex'));object.geometry.addEventListener('dispose',()=>sourceDisposals++);}});
const shrubGeometries=new Set();
asset.scene.getObjectByName('shrub').traverse(object=>{if(object.isMesh)shrubGeometries.add(object.geometry);});
let cases=0,drawGroups=0;
for(const setting of ['spa-wall','spa-glass','residence','infinity-villa'])for(const [length,width] of [[3,2],[10,4.5],[25,8]])for(const ground of [0,1.2]){
 const p=plan([[-length/2,-width/2],[length/2,-width/2],[length/2,width/2],[-length/2,width/2]],setting,.35,ground),before=JSON.stringify(p),started=performance.now();
 const groups=helper.createCataloguePlantInstances(asset.scene,p);assert.equal(groups.length,p.shrubs.length?6:3);
 const meshes=groups.map(g=>{const mesh=new THREE.InstancedMesh(g.geometry,g.material,g.matrices.length);g.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingBox();return mesh;});
 const bounds=new THREE.Box3();let triangles=0;
 for(let i=0;i<groups.length;i++){
  const g=groups[i],mesh=meshes[i];assert.equal(mesh.geometry,g.geometry,'live view borrows one source geometry');triangles+=g.geometry.index.count/3*g.matrices.length;bounds.union(mesh.boundingBox);
  for(const matrix of g.matrices)assert(matrix.elements.every(Number.isFinite));
 }
 assert(Math.abs(bounds.min.y-ground)<.0001);assert(Math.abs(bounds.max.y-(ground+4*Math.max(...p.trees.map(t=>t[2]))))<.0001);
 assert.equal(triangles,p.trees.length*393104+p.shrubs.length*6302);
 if(p.indoor){
  const end=Math.max(...p.parts.filter(part=>part.finish==='glass'&&part.s[0]<.1).map(part=>part.p[0]));
  const sideGlass=p.parts.filter(part=>part.finish==='glass'&&part.s[2]<.1);
  const side=sideGlass.length?Math.min(...sideGlass.map(part=>part.p[2])):-Infinity;
  const walls=p.parts.filter(part=>part.finish==='plaster').map(part=>new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...part.p),new THREE.Vector3(...part.s)));
  assert(p.shrubs.length>0&&p.shrubs.length<=60,'bounded indoor planting');
  for(const group of groups)for(const matrix of group.matrices){
   const b=group.geometry.boundingBox.clone().applyMatrix4(matrix);
   assert(b.min.x>=end-.001||b.max.z<=side+.001,'canopy stays outside the glazing');
   if(shrubGeometries.has(group.geometry)){
    assert(b.min.x>=end+1||b.max.z<=side-1,'actual scanned shrub leaves a metre clear at glazing');
    assert(!walls.some(wall=>wall.intersectsBox(b)),'actual scanned shrub does not intersect courtyard walls');
    assert(b.min.y>=ground-.0001&&b.max.y<=ground+1.5,'low planting rests at ground within a human-scale height');
   }
  }
 }
 assert.equal(JSON.stringify(p),before);drawGroups+=groups.length;cases++;
 console.log(JSON.stringify({setting,length,width,ground,liveGroups:groups.length,triangles,placementMs:+(performance.now()-started).toFixed(2)}));meshes.forEach(mesh=>mesh.dispose());
}
// Trace one representative placement of each primitive. Ordinary geometry must
// match the live instance matrix, with floats instead of wrapped integer writes.
const p=plan([[-5,-2.25],[5,-2.25],[5,2.25],[-5,2.25]],'residence',.35,0);
const instances=helper.createCataloguePlantInstances(asset.scene,p).map(entry=>({...entry,matrices:entry.matrices.slice(0,1)}));
const batches=helper.bakeCataloguePlantInstances(instances);assert.equal(batches.length,6);
for(let n=0;n<batches.length;n++){
 const b=batches[n],entry=instances.find(entry=>entry.material===b.material);assert(b.geometry.attributes.position.array instanceof Float32Array);assert(b.geometry.attributes.normal.array.every(Number.isFinite));assert(b.geometry.attributes.uv.array.every(Number.isFinite));
 for(const index of [0,Math.floor(entry.geometry.attributes.position.count/2),entry.geometry.attributes.position.count-1]){
  const expected=new THREE.Vector3().fromBufferAttribute(entry.geometry.attributes.position,index).applyMatrix4(entry.matrices[0]),actual=new THREE.Vector3().fromBufferAttribute(b.geometry.attributes.position,index);
  assert(expected.distanceTo(actual)<.0001,'baked and instanced positions agree');
 }
 b.geometry.dispose();
}
const root=new THREE.Group(),g=instances[0],mesh=new THREE.InstancedMesh(g.geometry,g.material,1);mesh.setMatrixAt(0,g.matrices[0]);root.add(mesh);let originalInstanceDisposals=0;mesh.addEventListener('dispose',()=>originalInstanceDisposals++);
const proxy=proxyTools.createCatalogueRoomProxy(root,0),copy=proxy.scene.children[0].children[0];let cloneDisposals=0;copy.addEventListener('dispose',()=>cloneDisposals++);proxy.dispose();assert.equal(cloneDisposals,1);assert.equal(originalInstanceDisposals,0);assert.equal(sourceDisposals,0);
asset.scene.traverse(object=>{if(object.isMesh){const a=object.geometry.attributes.position;assert.equal(createHash('sha256').update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength)).digest('hex'),sourceHashes.get(object.geometry));}});
console.log(JSON.stringify({status:'PASS',cases,drawGroups,tracedPrimitives:batches.length,borrowedSourcesPreserved:true,ownedProxyInstanceReleased:true,limits:'Geometry/resource/placement evidence; image decoding stubbed. GPU appearance, Photo Mode snapshot and real-hardware performance are separate checks.'}));
