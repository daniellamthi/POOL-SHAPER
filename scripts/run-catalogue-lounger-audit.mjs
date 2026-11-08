import assert from 'node:assert/strict';
import {build} from 'rolldown';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import * as THREE from 'three';
const output=join(process.cwd(),'node_modules/.cache/catalogue-lounger-audit.mjs');
await build({input:'src/components/pool/three/catalogueLounger.ts',output:{file:output,format:'esm'},platform:'node',external:['three','three/*'],resolve:{alias:{'@':join(process.cwd(),'src')}}});
const model=await import(pathToFileURL(output).href);
let checks=0;
const check=(condition,label)=>{assert.ok(condition,label);checks++;};
const frame=model.createCatalogueLoungerFrame();
try {
 frame.computeBoundingBox();const bounds=frame.boundingBox;
 check(bounds.min.x>=-.41001&&bounds.max.x<=.41001,'frame stays in the declared metric width');
 check(bounds.min.y>=-.45001&&bounds.max.y<=.45001,'frame stays above its ground and below the envelope');
 check(bounds.min.z>=-1.01001&&bounds.max.z<=1.01001,'frame stays in the declared longitudinal envelope');
 check(frame.getAttribute('position').array.every(Number.isFinite),'finite compound positions');
 check(frame.getAttribute('uv').array.every(Number.isFinite),'finite physical grain coordinates');
 const mesh=new THREE.Mesh(frame,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 mesh.position.set(0,.45,.04);mesh.updateMatrixWorld(true);
 const down=new THREE.Vector3(0,-1,0);
 check(new THREE.Raycaster(new THREE.Vector3(0,.20,0),down).intersectObject(mesh).length===0,'real open space below the bed, no solid plinth');
 check(new THREE.Raycaster(new THREE.Vector3(.365,1,0),down).intersectObject(mesh).length>0,'load-bearing side rail present');
 check(new THREE.Raycaster(new THREE.Vector3(0,1,-.8),down).intersectObject(mesh).length>0,'supporting seat slats present');
 mesh.material.dispose();
 check(frame.getAttribute('position').count/3<3000,'bounded frame triangle count');
}finally{frame.dispose();}
for(const size of [[.77,.14,1.25],[.77,.14,.85],[.58,.08,.24]]){
 const geometry=model.createCatalogueCushion(size);try{
  geometry.computeBoundingBox();const bounds=geometry.boundingBox;
  for(const [i,axis] of ['x','y','z'].entries()) check(bounds.min[axis]>=-size[i]/2-.00001&&bounds.max[axis]<=size[i]/2+.00001,'soft crown/welt remains in metric box');
  const normal=geometry.getAttribute('normal');let maxError=0;
  for(let i=0;i<normal.count;i++)maxError=Math.max(maxError,Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1));
  check(maxError<1e-6,'smooth normals stay normalized after deformation');
  check(geometry.getAttribute('position').array.every(Number.isFinite),'finite cushion geometry');
  check(bounds.max.y>=size[1]/2-.006,'soft crown fills the top without changing total height');
  check(geometry.getAttribute('position').count/3<2300,'bounded cushion/welt triangles');
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);
  const ray=y=>new THREE.Raycaster(new THREE.Vector3(size[0]/2+.02,y,0),new THREE.Vector3(-1,0,0)).intersectObject(mesh)[0];
  const welt=ray(0),side=ray(-size[1]*.12);
  check(!!welt&&!!side&&welt.point.x>side.point.x+.001,'welt is exposed above the fabric side, not buried inside the cushion');
  mesh.material.dispose();
 }finally{geometry.dispose();}
}
const first=model.createCatalogueLinen(4),second=model.createCatalogueLinen(4);
try {
 check(first.material.isMeshPhysicalMaterial&&first.material.sheen>0,'physical textile material with grazing response');
 check(first.material.opacity===1&&!first.material.transparent,'opaque cloth for live and traced views');
 check(first.material.map===first.maps.map&&first.material.normalMap===first.maps.normalMap,'material uses its owned texture set');
 for(const [name,texture] of Object.entries(first.maps)){
  check(texture!==second.maps[name]&&texture.image.data!==second.maps[name].image.data,'independent ownership for scene lifetimes');
  check(texture.image.width===128&&texture.image.height===128,'bounded textile texture dimensions');
  check(texture.wrapS===THREE.RepeatWrapping&&texture.wrapT===THREE.RepeatWrapping&&texture.repeat.x===25,'metric 4 cm textile repeat');
  check(texture.generateMipmaps&&texture.minFilter===THREE.LinearMipmapLinearFilter,'mipmapped subpixel weave');
  check(texture.colorSpace===(name==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace),'colour and data maps use correct spaces');
  assert.deepEqual(texture.image.data,second.maps[name].image.data);checks++;
 }
 let disposals=0;first.material.addEventListener('dispose',()=>disposals++);
 for(const texture of Object.values(first.maps))texture.addEventListener('dispose',()=>disposals++);
 first.material.dispose();Object.values(first.maps).forEach(texture=>texture.dispose());
 check(disposals===4,'one material and three owned textures are disposable without shared owners');
}finally{second.material.dispose();Object.values(second.maps).forEach(texture=>texture.dispose());}
console.log(`Catalogue loungers: ${checks} geometry/texture/ownership checks PASS (browser appearance and frame time separate).`);
