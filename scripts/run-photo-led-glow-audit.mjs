import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
const load=(code,scope={})=>runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:{},THREE,...scope});
const parse=file=>ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const lightSource=parse('src/components/pool/three/PoolLights.tsx');
const fixture=lightSource.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='RecessedPoolLight');assert(fixture);
const optics=load(readFileSync('src/lib/pool/led-optics.ts','utf8')+'\nexports;', {exports:{},require:()=>THREE});
const lighting=parse('src/lib/pool/lighting.ts');const constants={};
for(const name of ['POOL_LIGHTING_DESIGN','POOL_LUMINAIRE']) {
 let node;const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(lighting)===name)node=n.initializer;ts.forEachChild(n,visit);};visit(lighting);assert(node,name);
 constants[name]=load('('+node.getText(lighting)+')',constants);
}
const element=(type,props)=>({type,props});
const render=load(fixture.getText(lightSource)+'\nRecessedPoolLight;',{
 require:name=>{assert.equal(name,'react/jsx-runtime');return{jsx:element,jsxs:element};},
 useRef:()=>({current:null}),useMemo:fn=>fn(),useLayoutEffect:()=>{},
 LED_OPTICS:optics.LED_OPTICS,POOL_LED_PRESENTATIONS:optics.LED_OPTICS.presentations,...constants,
 StainlessSteelMaterial:()=>{},
});
const photoSource=parse('src/components/pool/three/PhotoModeRenderer.tsx');
let names,traverse;
const visit=n=>{
 if(ts.isVariableDeclaration(n)&&n.name.getText(photoSource)==='PHOTO_MODE_EXCLUDED_NAMES')names=n.initializer;
 if(ts.isCallExpression(n)&&n.expression.getText(photoSource)==='scene.traverse'&&n.arguments[0]?.getText(photoSource).includes('PHOTO_MODE_EXCLUDED_NAMES.has'))traverse=n.arguments[0];
 ts.forEachChild(n,visit);
};visit(photoSource);assert(names&&traverse);
const excluded=load('('+names.getText(photoSource)+')');
const exclusion=traverse.body.statements.find(n=>ts.isIfStatement(n)&&n.expression.getText(photoSource).includes('PHOTO_MODE_EXCLUDED_NAMES.has'));assert(exclusion);
const restored=[];const hide=load('(object=>{'+exclusion.getText(photoSource)+'})',{PHOTO_MODE_EXCLUDED_NAMES:excluded,restoreVisibility:restored});
const children=node=>[node,...[node?.props?.children].flat(Infinity).filter(n=>n&&typeof n==='object').flatMap(children)];
let rays=0;
for(const rotation of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
 const tree=render({position:{x:2,y:-.65,z:-1,rotation,throwDistance:3},floorY:-1.5,powered:true,presentation:'night',revision:'qa',colour:new THREE.Color('#ff8000'),intensity:100,dimmer:{output:1,emission:1},diffuser:new THREE.Texture(),glow:new THREE.Texture(),scatterGeometry:new THREE.CylinderGeometry(),scatterMaterial:new THREE.ShaderMaterial(),occlusion:true});
 const nodes=children(tree);const glow=nodes.find(n=>n.type==='mesh'&&children(n).some(c=>c.type==='meshBasicMaterial'&&c.props.blending===THREE.AdditiveBlending));
 const spot=nodes.find(n=>n.type==='spotLight');assert(glow&&spot);
 const disc=children(glow).find(n=>n.type==='circleGeometry'),surface=children(glow).find(n=>n.type==='meshBasicMaterial');
 const scene=new THREE.Scene(),root=new THREE.Group();root.position.fromArray(tree.props.position);root.rotation.fromArray([...tree.props.rotation,'XYZ']);scene.add(root);
 const material=new THREE.MeshBasicMaterial(surface.props),mesh=new THREE.Mesh(new THREE.CircleGeometry(...disc.props.args),material);mesh.name=glow.props.name??'';mesh.position.fromArray(glow.props.position);root.add(mesh);
 const source=new THREE.Vector3(...spot.props.position);root.updateMatrixWorld(true);root.localToWorld(source);
 const checkRays=blocked=>{// Avoid a ray exactly on a fan-triangle seam after a quarter-turn.
 for(const lateral of [-.5,.173,.5]){
   const sample=root.localToWorld(new THREE.Vector3(lateral,-.8,2));const ray=new THREE.Raycaster(sample,source.clone().sub(sample).normalize(),0,sample.distanceTo(source)-1e-6);
   const visible=[];scene.traverseVisible(o=>{if(o.isMesh)visible.push(o);});
   assert.equal(ray.intersectObjects(visible,false).length>0,blocked,'opaque glow blocks the direct shadow ray despite depthWrite=false: '+JSON.stringify({rotation,lateral,source:source.toArray(),sample:sample.toArray()}));rays++;
 }};
 checkRays(true);
 assert(excluded.has(mesh.name),'raster-only additive glow must be excluded from the photographic BVH');
 hide(mesh);assert.equal(mesh.visible,false);checkRays(false);
 restored.splice(0).forEach(fn=>fn());assert.equal(mesh.visible,true);checkRays(true);
 assert.equal(material.blending,THREE.AdditiveBlending);assert.equal(material.depthWrite,false);assert.equal(spot.props.intensity,100);
 mesh.geometry.dispose();material.dispose();
}
console.log(JSON.stringify({status:'PASS',rays,orientations:4,scope:'Actual fixture JSX/optics and photographic exclusion branch; direct-ray blockage, traced visibility, live restoration. Native GPU and photographic quality separate.'}));
