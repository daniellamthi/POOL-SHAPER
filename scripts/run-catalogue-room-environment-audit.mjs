import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import * as THREE from "three";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";
import {TessellateModifier} from "three/addons/modifiers/TessellateModifier.js";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";
const load = (file, require, logger=console) => runInNewContext(ts.transpileModule(readFileSync(file,"utf8"), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText+";exports;",{exports:{},require,console:logger,performance});
const proxyTools=load("src/components/pool/three/catalogueRoomProxy.ts",()=>THREE);
const catalogue=load("src/lib/pool/catalogue-architecture.ts");
const {planCatalogueArchitecture:plan,CATALOGUE_COVE_POWER}=catalogue;
const garden=load("src/lib/pool/catalogue-garden.ts");
const lounger=load("src/components/pool/three/catalogueLounger.ts",id=>id==="three"?THREE:id.includes("RoundedBoxGeometry")?{RoundedBoxGeometry}:id.includes("TessellateModifier")?{TessellateModifier}:id.includes("BufferGeometryUtils")?{mergeGeometries}:catalogue);
const {createCataloguePartGeometry:partGeometry}=load("src/components/pool/three/cataloguePartGeometry.ts",id=>id==="three"?THREE:id.includes("RoundedBoxGeometry")?{RoundedBoxGeometry}:lounger);
let cases=0;
for(const setting of ["spa-wall","spa-glass"])for(const [l,w] of [[3,2],[10,4.5],[25,8]])for(const rotate of [false,true]) {
  const outline=[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([x,z])=>rotate?[z+7,x-4]:[x+7,z-4]);
  const p=plan(outline,setting,0,0), room=new THREE.Group();
  room.position.set(p.centre[0],0,p.centre[1]);room.rotation.y=p.angle;
  const sourceMaterials=[];
  for(const part of p.parts) {
    const material=part.finish==="glass"?new THREE.MeshPhysicalMaterial({transmission:.92,opacity:1}):part.finish==="linen"?new THREE.MeshPhysicalMaterial({sheen:.6}):new THREE.MeshStandardMaterial();
    sourceMaterials.push(material);room.add(new THREE.Mesh(partGeometry(part),material));
  }
  const borrowedMap=new THREE.Texture();sourceMaterials[0].map=borrowedMap;
  const before=sourceMaterials.map(m=>m.clone());
  let originalDisposals=0;
  for(const mesh of room.children) mesh.geometry.addEventListener("dispose",()=>originalDisposals++);
  for(const material of sourceMaterials)material.addEventListener("dispose",()=>originalDisposals++);
  borrowedMap.addEventListener("dispose",()=>originalDisposals++);
  const proxy=proxyTools.createCatalogueRoomProxy(room,0);proxy.scene.updateMatrixWorld(true);
  const cloned=proxy.scene.children[0];
  assert.notEqual(cloned,room);assert.equal(cloned.children.length,room.children.length);
  for(let i=0;i<room.children.length;i++) {
    assert.equal(cloned.children[i].geometry,room.children[i].geometry);
    assert.notEqual(cloned.children[i].material,room.children[i].material);
    assert.equal(cloned.children[i].castShadow,false);
    if(sourceMaterials[i].transmission>0) {
      assert.equal(cloned.children[i].material.transmission,0);
      assert.equal(cloned.children[i].material.opacity,.18);
      assert.equal(sourceMaterials[i].transmission,.92);
    } else if(sourceMaterials[i].isMeshPhysicalMaterial) {
      assert.equal(cloned.children[i].material.opacity,1);
      assert.equal(cloned.children[i].material.transparent,false);
      assert.equal(cloned.children[i].material.sheen,.6);
    }
  }
  const origin=new THREE.Vector3(p.centre[0],1.55,p.centre[1]);
  for(const direction of [new THREE.Vector3(0,1,0),new THREE.Vector3(.4,1,.2).normalize(),new THREE.Vector3(-.4,1,-.2).normalize()]) {
    const hit=new THREE.Raycaster(origin,direction).intersectObject(cloned,true)[0];
    assert(hit,"Upward room reflection hits its ceiling instead of the outdoor sky");
    assert(hit.point.y>3 && hit.point.y<3.5);
  }
  let cloneDisposals=0;cloned.traverse(o=>{if(o.isMesh)o.material.addEventListener("dispose",()=>cloneDisposals++);});
  proxy.dispose();assert.equal(cloneDisposals,room.children.length);assert.equal(originalDisposals,0,"borrowed geometry, maps and material owners are intact");
  room.children.forEach(mesh=>{mesh.geometry.dispose();mesh.material.dispose();});before.forEach(m=>m.dispose());borrowedMap.dispose();cases++;
}
const night=proxyTools.createNightRoomSky();
assert.equal(night.mapping,THREE.EquirectangularReflectionMapping);
assert(night.image.data.every(Number.isFinite));
for(let i=0;i<night.image.data.length;i+=4) {
 assert(night.image.data[i+2]>night.image.data[i]);assert(night.image.data[i+2]<.04,"night contains no daylight capture");assert.equal(night.image.data[i+3],1);
}
night.dispose();
console.log(`PASS: ${cases} metric/rotated room captures retain the ceiling; cloned materials, borrowed resources and dark night sky`);

let previousDeps,cleanup,captures=0,disposed=0,callbackMaps=null;
const day=new THREE.Texture(), root=new THREE.Group();
root.add(new THREE.Mesh(new THREE.BoxGeometry(2,1,2),new THREE.MeshStandardMaterial()));
root.add(new THREE.RectAreaLight(0xffffff,1,10,.18));
const down=new THREE.RectAreaLight(0xffffff,1,10,.035);down.name="catalogue-cove-down";down.rotation.x=-Math.PI/2;root.add(down);
const ref={current:root};
const fixture=plan([[-5,-2.25],[5,-2.25],[5,2.25],[-5,2.25]],"spa-wall",0,0);
const originalTarget={},gl={shadowMap:{autoUpdate:true},xr:{enabled:true},target:originalTarget,autoClear:true,toneMapping:THREE.ACESFilmicToneMapping,domElement:{dataset:{}},
 getRenderTarget(){return this.target;},getActiveCubeFace(){return 2;},getActiveMipmapLevel(){return 3;},
 setRenderTarget(target,face,mip){this.target=target;assert.equal(face,2);assert.equal(mip,3);}};
let fail=false;
const capturedEnergy=[];
class Generator {
 fromScene(scene,sigma,near,far,options) {
  capturedEnergy.push({sky:scene.environmentIntensity,background:scene.backgroundIntensity});
  captures++;gl.target={temporary:true};gl.xr.enabled=false;gl.autoClear=false;gl.toneMapping=THREE.NoToneMapping;
  assert.equal(scene.environmentRotation.y,scene.environment===day?fixture.angle+garden.CATALOGUE_GARDEN.rotation:0,"day follows the photographic sky; night rotation remains original");
  assert.equal(scene.backgroundRotation.y,scene.environmentRotation.y);
  assert.equal(options.size,128);assert(Math.abs(scene.children[0].children[1].power-10*CATALOGUE_COVE_POWER.wall[scene.environment===day?"day":"night"])<1e-9);
  assert(Math.abs(scene.children[0].children[2].power-10*CATALOGUE_COVE_POWER.down[scene.environment===day?"day":"night"])<1e-9);
  if(fail && scene.environment!==day) throw new Error("Simulated second-face capture failure");
  const target=new THREE.WebGLRenderTarget(128,128);target.addEventListener("dispose",()=>disposed++);return target;
 }
 dispose(){}
}
const hook={useEffect(effect,deps){if(!previousDeps||deps.some((value,i)=>value!==previousDeps[i])){cleanup?.();previousDeps=deps;cleanup=effect();}}};
const expectedWarnings=[];
const {CatalogueRoomEnvironment:Component}=load("src/components/pool/three/CatalogueRoomEnvironment.tsx",id=>{
 if(id==="react")return hook;
 if(id==="three")return {...THREE,PMREMGenerator:Generator};
 if(id==="@react-three/fiber")return {useThree:selector=>selector({gl}),useLoader:(loader,url)=>{assert.equal(url,garden.CATALOGUE_GARDEN.url);return day;}};
 if(id==="@/lib/pool/catalogue-garden")return garden;
 if(id==="@/configurator/3d/scene/visual-preset")return load("src/configurator/3d/scene/visual-preset.ts");
 if(id==="./catalogueRoomProxy")return proxyTools;
 if(id==="@/lib/pool/catalogue-architecture")return catalogue;
 return {};
},{...console,warn(...args){expectedWarnings.push(args);}});
const onMaps=maps=>{callbackMaps=maps;};
const cache={key:"fixture",targets:null,generator:{current:null}};
const props={room:ref,plan:fixture,onMaps,cache};Component(props);
assert.equal(captures,2);assert(callbackMaps.day.isTexture&&callbackMaps.night.isTexture);
assert.deepEqual(capturedEnergy.slice(0,2),[{sky:.65,background:.65},{sky:.06,background:.06}],"Capture sky irradiance must match the Day/Night photo while physical cove powers remain unscaled");
const initialMaps=callbackMaps;
for(const propsChange of [{night:true},{night:false},{photoMode:true},{photoMode:false}])Component({...props,...propsChange});
assert.equal(captures,2,"Night/Day and Photo Mode do not recapture the room");assert.equal(callbackMaps,initialMaps);
assert.equal(gl.target,originalTarget);assert.equal(gl.shadowMap.autoUpdate,true);assert.equal(gl.xr.enabled,true);assert.equal(gl.autoClear,true);assert.equal(gl.toneMapping,THREE.ACESFilmicToneMapping);
cleanup();assert.equal(callbackMaps,null);assert.equal(disposed,0,"parent owns retained targets");
previousDeps=null;cleanup=undefined;Component(props);assert.equal(captures,2,"Suspense remount reuses parent-owned maps");
cleanup();cache.targets.forEach(target=>target.dispose());cache.targets=null;assert.equal(disposed,2);
previousDeps=null;cleanup=undefined;fail=true;Component(props);
assert.equal(gl.target,originalTarget);assert.equal(gl.shadowMap.autoUpdate,true);assert.equal(gl.xr.enabled,true);assert.equal(gl.autoClear,true);assert.equal(gl.toneMapping,THREE.ACESFilmicToneMapping);assert.equal(callbackMaps,null);
cleanup();cache.generator.current?.dispose();cache.generator.current=null;assert.equal(disposed,3,"partial failed capture releases its first owned target");assert.equal(expectedWarnings.length,1);root.children[0].geometry.dispose();root.children[0].material.dispose();day.dispose();
console.log("PASS: actual capture effect builds two maps once, survives toggles and Suspense remount, restores render state, disposes owned/partial targets and falls back after failure; GPU/visual acceptance separate");

// Execute the actual fixture JSX callback, then check emitting-face geometry.
const arch=ts.createSourceFile("CatalogueArchitecture.tsx",readFileSync("src/components/pool/three/CatalogueArchitecture.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let fixtureCallback;
const visit=n=>{if(ts.isArrowFunction(n)&&n.parameters.length===2&&n.parameters[0].name.getText(arch)==="part"&&n.getText(arch).includes("catalogue-cove-down"))fixtureCallback=n;ts.forEachChild(n,visit);};visit(arch);assert(fixtureCallback);
let fixtureCases=0;
for(const isNight of [false,true]) {
 const build=runInNewContext(ts.transpileModule("const build="+fixtureCallback.getText(arch)+";exports.build=build;",{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText+";exports.build;",{exports:{},night:isNight,CATALOGUE_COVE_POWER,require:()=>({jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})})});
 for(const setting of ["spa-wall","spa-glass"])for(const [l,w]of [[3,2],[10,4.5],[25,8]]) {
  const roomPlan=plan([[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]],setting,0,0);
  for(const part of roomPlan.parts.filter(part=>part.finish==="light")) {
   const fixture=build(part,0),[wall,down]=fixture.props.children;
   assert.equal(wall.props.name,"catalogue-cove-wall");assert.equal(down.props.name,"catalogue-cove-down");
   const direction=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(...down.props.rotation));
   assert(direction.y<-.999999);assert(Math.abs(direction.x)+Math.abs(direction.z)<1e-9);
   assert.equal(down.props.width,part.s[0]);assert.equal(down.props.height,part.s[2]);
   assert(Math.abs(down.props.position[1]-(part.p[1]-part.s[1]/2-.002))<1e-9,"sampled underside stays below the luminous geometry");
   assert.equal(wall.props.power,part.s[0]*CATALOGUE_COVE_POWER.wall[isNight?"night":"day"],"fixture and room capture share calibrated wall flux");
   assert(down.props.power>0&&down.props.power/part.s[0]<=300);fixtureCases++;
  }
 }
}
console.log(`PASS: ${fixtureCases} actual cove JSX fixtures — correct downward normal, underside dimensions/clearance, physical flux and calibrated wall wash; captured day/night powers match`);
