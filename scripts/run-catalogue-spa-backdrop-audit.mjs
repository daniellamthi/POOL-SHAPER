import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as THREE from "three";
const load=(file,require=()=>({}))=>runInNewContext(ts.transpileModule(readFileSync(file,"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText+";exports;",{exports:{},require});
const garden=load("src/lib/pool/catalogue-garden.ts");
const scene=new THREE.Scene(),map=new THREE.Texture(),environment=new THREE.Texture();
const originalBackground=new THREE.Color("#91a2b3");
scene.background=originalBackground;scene.backgroundRotation.set(.1,.2,.3);scene.backgroundIntensity=.8;
scene.environment=environment;scene.environmentRotation.set(.2,.5,.1);scene.environmentIntensity=.41;
scene.fog=new THREE.Fog("#778899",5,30);
const fog=scene.fog,roomMap=new THREE.Texture(),sun=[1,2,3];
let deps,cleanup,sourceDisposals=0,checks=0;
map.addEventListener("dispose",()=>sourceDisposals++);
const same=(actual,expected,message)=>{assert.equal(actual,expected,message);checks++;};
const unchangedEnvironment=()=>{
 same(scene.environment,environment,"room probe is retained");same(scene.environmentIntensity,.41);
 assert.deepEqual(scene.environmentRotation.toArray(),[.2,.5,.1,"XYZ"]);checks++;
 same(scene.fog,fog);same(scene.children.length,0,"no backdrop mesh or extra scene geometry");
};
const hooks={useLayoutEffect(effect,next){if(!deps||next.some((value,i)=>value!==deps[i])){cleanup?.();deps=next;cleanup=effect();}}};
const DaylightEnvironment=()=>{};
const Component=load("src/components/pool/three/CatalogueSpaEnvironment.tsx",id=>{
 if(id==="react")return hooks;
 if(id==="@react-three/fiber")return {useThree:()=>({scene}),useLoader:(loader,url)=>{same(url,garden.CATALOGUE_GARDEN.url);return map;}};
 if(id==="three")return THREE;
 if(id.includes("HDRLoader"))return {HDRLoader:class {}};
 if(id==="@/lib/pool/catalogue-garden")return garden;
 if(id==="./DaylightEnvironment")return {DaylightEnvironment};
 if(id==="react/jsx-runtime")return {jsx:(type,props)=>({type,props})};
 throw Error("Unexpected import "+id);
}).CatalogueSpaEnvironment;
const props={theme:"light",timeOfDay:"day",roomMap,sunDirection:sun,showBackdrop:true,rotation:1.2};
let jsx=Component(props);
same(jsx.type,DaylightEnvironment);same(jsx.props.roomMap,roomMap);same(jsx.props.sunDirection,sun);
same(jsx.props.showBackdrop,false,"procedural sky does not cover the photograph in Day");
same(scene.background,map);same(scene.backgroundRotation.y,1.2);same(scene.backgroundIntensity,1);unchangedEnvironment();
Component({...props,rotation:2.1});same(scene.backgroundRotation.y,2.1);unchangedEnvironment();
jsx=Component({...props,timeOfDay:"night",theme:"dark"});
same(scene.background,originalBackground);same(scene.backgroundRotation.y,.2);same(scene.backgroundIntensity,.8);
same(jsx.props.showBackdrop,true,"Night keeps the existing procedural sky");same(jsx.props.roomMap,roomMap);unchangedEnvironment();
jsx=Component({...props,showBackdrop:false});same(scene.background,originalBackground);same(jsx.props.showBackdrop,false);unchangedEnvironment();
Component(props);cleanup();deps=undefined;cleanup=undefined;
same(scene.background,originalBackground);same(scene.backgroundRotation.y,.2);same(scene.backgroundIntensity,.8);unchangedEnvironment();
// A newer owner must survive a late backdrop cleanup, including its rotation.
Component(props);const later=new THREE.Texture();scene.background=later;scene.backgroundRotation.y=.77;scene.backgroundIntensity=.36;
cleanup();deps=undefined;cleanup=undefined;
same(scene.background,later);same(scene.backgroundRotation.y,.77);same(scene.backgroundIntensity,.36);unchangedEnvironment();
same(sourceDisposals,0,"URL-cached panorama is borrowed, never disposed by this consumer");
// An initial Night mount must not attach the daytime panorama at any point.
scene.background=originalBackground;scene.backgroundRotation.y=.2;scene.backgroundIntensity=.8;
jsx=Component({...props,timeOfDay:"night",theme:"dark"});same(scene.background,originalBackground);same(jsx.props.showBackdrop,true);unchangedEnvironment();
cleanup?.();console.log(JSON.stringify({status:"PASS",checks,limits:"Actual component effect with simulated hooks/loader; GPU appearance and frame performance require browser verification."}));
