// Offline derivative only. Run from this repo with TREE_GLTF TREE_SOURCE_DIR
// SEARSIA_GLTF SEARSIA_SOURCE_DIR. Source files/credits are documented beside GLB.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {MeshoptSimplifier as simplify} from 'meshoptimizer';
await simplify.ready;
const [treeFile,treeDir,shrubFile,shrubDir]=process.argv.slice(2);
const leafError=Number(process.argv[6]??.004);
assert(leafError>0&&leafError<=.008);
assert(treeFile&&treeDir&&shrubFile&&shrubDir,'Four source paths required');
const tree=JSON.parse(fs.readFileSync(treeFile,'utf8')),shrub=JSON.parse(fs.readFileSync(shrubFile,'utf8'));
const treeBin=fs.readFileSync(path.join(treeDir,'tree_small_02.bin')),shrubBin=fs.readFileSync(path.join(shrubDir,'searsia_lucida.bin'));
const digest=(bytes,algorithm='md5')=>createHash(algorithm).update(bytes).digest('hex');
assert.equal(digest(fs.readFileSync(treeFile)),'63f42b19687332f7b3a5c8b531734d8e');
assert.equal(digest(treeBin),'7a7019a87e6fe0d7475c0fa2e08d8962');
assert.equal(digest(shrubBin),'aa4c42ee903a3ac22d53386d82480e6d');
function read(source,bytes,id){
 const a=source.accessors[id],v=source.bufferViews[a.bufferView],k={VEC3:3,VEC2:2,SCALAR:1}[a.type],T={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType];
 assert(!v.byteStride||v.byteStride===k*T.BYTES_PER_ELEMENT,'Expected packed source accessor');
 return new T(bytes.buffer,bytes.byteOffset+(v.byteOffset??0)+(a.byteOffset??0),a.count*k);
}
const out={asset:{version:'2.0',generator:'POOL-SHAPER / meshoptimizer 1.1.1 canopy derivative'},scene:0,scenes:[{nodes:[0,1]}],nodes:[{mesh:0,name:'tree'},{mesh:1,name:'shrub'}],meshes:[],materials:structuredClone(tree.materials),textures:structuredClone(tree.textures),images:structuredClone(tree.images),samplers:tree.samplers,accessors:[],bufferViews:[],buffers:[]};
for(const image of out.images)image.uri='../../textures/catalogue/canopy/'+path.basename(image.uri);
// Consolidate the shrub's duplicate image/texture references into three maps.
out.materials.push(...structuredClone(shrub.materials));
for(const material of out.materials.slice(3)){
 material.normalTexture.index=9;material.pbrMetallicRoughness.baseColorTexture.index=10;material.pbrMetallicRoughness.metallicRoughnessTexture.index=11;
}
for(const image of shrub.images.slice(0,3))out.images.push({...image,uri:'../../textures/catalogue/evergreen/'+path.basename(image.uri)});
for(let i=0;i<3;i++)out.textures.push({sampler:0,source:9+i});
const chunks=[];let byteLength=0;
function accessor(array,type){
 const k={SCALAR:1,VEC2:2,VEC3:3}[type];while(byteLength%4){chunks.push(Buffer.alloc(1));byteLength++;}
 const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=out.bufferViews.length;
 out.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:bytes.length,target:type==='SCALAR'?34963:34962});chunks.push(bytes);byteLength+=bytes.length;
 const value={bufferView:view,componentType:array instanceof Float32Array?5126:array instanceof Uint16Array?5123:5125,count:array.length/k,type};
 if(type==='VEC3') {value.min=[Infinity,Infinity,Infinity];value.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<array.length;i++) {const a=i%3;value.min[a]=Math.min(value.min[a],array[i]);value.max[a]=Math.max(value.max[a],array[i]);}}
 out.accessors.push(value);return out.accessors.length-1;
}
function area(pos,ix){let sum=0;for(let i=0;i<ix.length;i+=3){const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;const ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2],vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2];sum+=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)/2;}return sum;}
const report=[];
for(const [source,bytes,meshId,materialOffset,name]of [[tree,treeBin,0,0,'tree'],[shrub,shrubBin,6,3,'shrub']]){
 const primitives=[];
 for(const p of source.meshes[meshId].primitives){
  const pos=read(source,bytes,p.attributes.POSITION),nor=read(source,bytes,p.attributes.NORMAL);let uv=Float32Array.from(read(source,bytes,p.attributes.TEXCOORD_0)),ix=Uint32Array.from(read(source,bytes,p.indices));
  const material=out.materials[p.material+materialOffset];
  const textureInfos=[material.normalTexture,material.pbrMetallicRoughness.baseColorTexture,material.pbrMetallicRoughness.metallicRoughnessTexture];
  const transform=textureInfos[0].extensions?.KHR_texture_transform;
  if(transform){
   for(const info of textureInfos){assert.equal(info.texCoord,1);assert.deepEqual(info.extensions.KHR_texture_transform,transform);delete info.texCoord;delete info.extensions;}
   const raw=read(source,bytes,p.attributes.TEXCOORD_1);uv=Float32Array.from(raw,(value,i)=>value*transform.scale[i%2]+transform.offset[i%2]);
  }
  const before=ix.length/3;let error=0,areaRatio=1;
  if(name==='tree'){
   const attributes=new Float32Array(pos.length/3*5);
   for(let i=0;i<pos.length/3;i++){attributes.set(nor.subarray(i*3,i*3+3),i*5);attributes.set(uv.subarray(i*2,i*2+2),i*5+3);}
   const target=p.material===1?150000:Math.round(before*.3),original=ix;
   [ix,error]=simplify.simplifyWithAttributes(ix,pos,3,attributes,5,[.01,.01,.01,.1,.1],null,target*3,p.material===1?leafError:.004,['ErrorAbsolute','Permissive']);
   areaRatio=area(pos,ix)/area(pos,original);
  }
  const [remap,count]=simplify.compactMesh(ix);
  const compact=(array,k)=>{const result=new Float32Array(count*k);for(let i=0;i<remap.length;i++)if(remap[i]!==0xffffffff)for(let axis=0;axis<k;axis++)result[remap[i]*k+axis]=array[i*k+axis];return result;};
  const cp=compact(pos,3),cn=compact(nor,3),cu=compact(uv,2);assert(cp.every(Number.isFinite)&&cn.every(Number.isFinite)&&cu.every(Number.isFinite));
  primitives.push({attributes:{POSITION:accessor(cp,'VEC3'),NORMAL:accessor(cn,'VEC3'),TEXCOORD_0:accessor(cu,'VEC2')},indices:accessor(count<=65535?Uint16Array.from(ix):ix,'SCALAR'),material:p.material+materialOffset});
  report.push({name,material:material.name,before,after:ix.length/3,vertices:count,reportedError:error,geometricAreaRatio:areaRatio});
 }
 out.meshes.push({name,primitives});
}
const binary=Buffer.concat(chunks);out.buffers=[{byteLength:binary.length}];let json=Buffer.from(JSON.stringify(out));json=Buffer.concat([json,Buffer.alloc((-json.length)&3,32)]);const data=Buffer.concat([binary,Buffer.alloc((-binary.length)&3)]),header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+data.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(data.length,0);binHeader.writeUInt32LE(0x004e4942,4);const glb=Buffer.concat([header,json,binHeader,data]);
const modelDir='public/models/catalogue',textureDir='public/textures/catalogue/canopy';fs.mkdirSync(modelDir,{recursive:true});fs.mkdirSync(textureDir,{recursive:true});fs.writeFileSync(path.join(modelDir,'canopy.glb'),glb);
const imageHashes=[];
for(const image of tree.images){const name=path.basename(image.uri),bytes=fs.readFileSync(path.join(treeDir,image.uri));fs.writeFileSync(path.join(textureDir,name),bytes);imageHashes.push({name,md5:digest(bytes),bytes:bytes.length});}
const alpha=fs.readFileSync(path.join(treeDir,'textures/leaves_alpha.png'));fs.writeFileSync(path.join(textureDir,'leaves_alpha.png'),alpha);imageHashes.push({name:'leaves_alpha.png',md5:digest(alpha),bytes:alpha.length});
const result={meshoptimizer:'1.1.1',parameters:{leafError,branchError:.004,weights:[.01,.01,.01,.1,.1]},sha256:digest(glb,'sha256'),glbBytes:glb.length,treeTriangles:report.filter(x=>x.name==='tree').reduce((sum,x)=>sum+x.after,0),parts:report,images:imageHashes,limits:'Simplifier-reported error and geometric area are not image-space silhouette/alpha fidelity or hardware performance acceptance. Vertex positions/normals/UVs are selected from source; branch UV1 transform is baked into UV0.'};
const packTool=process.argv[7];
if(packTool){
 const packed=path.join(modelDir,'canopy-packed.glb'),packReport=path.join(modelDir,'canopy-pack-report.json');
 execFileSync(packTool,['-i',path.join(modelDir,'canopy.glb'),'-o',packed,'-c','-ce','ext','-vp','16','-vt','16','-vn','16','-kn','-km','-ke','-tr','-r',packReport],{stdio:'inherit'});
 const bytes=fs.readFileSync(packed);result.packed={gltfpack:'1.3.0',bytes:bytes.length,sha256:digest(bytes,'sha256')};
 fs.unlinkSync(path.join(modelDir,'canopy.glb'));
}
fs.writeFileSync(path.join(modelDir,'canopy-derivation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
