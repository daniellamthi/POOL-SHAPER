import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import * as THREE from "three";
import {DenoiseMaterial} from "../node_modules/three-gpu-pathtracer/src/materials/fullscreen/DenoiseMaterial.js";
const source=readFileSync("src/components/pool/three/photoOutputFilter.ts","utf8");
let quads=0,draws=0,quadDisposals=0,targetDisposals=0,resizes=0,targetAllocations=0,throwDraw=false,lastMaterial,lastOutput;
class Quad {
 constructor(material){this.material=material;lastMaterial=material;quads++;}
 render(gl){assert.equal(gl.autoClear,false);assert.equal(gl.target,lastOutput);if(throwDraw)throw new Error("simulated output failure");draws++;}
 dispose(){quadDisposals++;}
}
class Target extends THREE.WebGLRenderTarget {
 constructor(w,h,options){super(w,h,options);targetAllocations++;lastOutput=this;}
 setSize(w,h){resizes++;super.setSize(w,h);}
 dispose(){targetDisposals++;super.dispose();}
}
const warnings=[];
const {installPhotoOutputFilter:install}=runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText+";exports;",{
 exports:{},console:{warn(...args){warnings.push(args);}},require:id=>{
  if(id==="three-gpu-pathtracer")return {DenoiseMaterial};
  if(id==="three/addons/postprocessing/Pass.js")return {FullScreenQuad:Quad};
  if(id==="three")return {...THREE,WebGLRenderTarget:Target};
  return {PHOTO_MODE_EXPORT_READY_SAMPLES:190};
 }
});
let originalDraws=0,textureDisposals=0;
const previousTarget={name:"previous"};
const gl={autoClear:true,target:previousTarget,face:2,mip:3,getRenderTarget(){return this.target;},getActiveCubeFace(){return this.face;},getActiveMipmapLevel(){return this.mip;},setRenderTarget(target,face=0,mip=0){this.target=target;this.face=face;this.mip=mip;}};
const original=(target,renderer,quad)=>{assert.equal(renderer.autoClear,true);assert.equal(renderer.target,previousTarget);assert.equal(renderer.face,2);assert.equal(renderer.mip,3);assert.equal(quad.material.map,target.texture);originalDraws++;};
const tracer={samples:0,renderToCanvasCallback:original,reset(){throw new Error("filter must not reset accumulation");},setScene(){throw new Error("filter must not resnapshot scene");}};
const texture=new THREE.Texture();texture.type=THREE.FloatType;texture.addEventListener("dispose",()=>textureDisposals++);
const target={texture,width:640,height:360},sourceQuad={material:{opacity:1,map:texture}};
const published=[];const dispose=install(tracer,frame=>published.push(frame)),callback=tracer.renderToCanvasCallback;
assert.equal(quads,1);assert(lastMaterial instanceof DenoiseMaterial);assert.equal(targetAllocations,0);
assert(lastMaterial.fragmentShader.includes("any(isnan(walkPx))"));
assert(lastMaterial.fragmentShader.includes("any(isinf(walkPx))"));
assert(lastMaterial.fragmentShader.includes("!(deltaFactor > 0.0)"));
assert(lastMaterial.fragmentShader.includes("!(zBuff > 0.0)"));
assert(lastMaterial.fragmentShader.includes("any(isnan(aBuff))"));
assert.equal(lastMaterial.toneMapped,false);assert.equal(lastMaterial.premultipliedAlpha,false);assert.equal(lastMaterial.blending,THREE.NoBlending);
assert.equal(Math.round(lastMaterial.sigma*lastMaterial.kSigma),2,"bounded two-source-pixel radius");
for(const samples of [0,5,189]){tracer.samples=samples;callback(target,gl,sourceQuad);assert.equal(tracer.samples,samples);}
tracer.samples=190;sourceQuad.material.opacity=.5;callback(target,gl,sourceQuad);
assert.equal(published.at(-1),null,"no stale frame during preview/fade");assert.equal(draws,0);assert.equal(targetAllocations,0);assert.equal(originalDraws,4,"early and fading previews retain original output");
sourceQuad.material.opacity=1;
for(let i=0;i<30;i++)callback(target,gl,sourceQuad);
assert.equal(published.at(-1),lastOutput,"publish the existing linear display copy without another draw");assert.equal(draws,30);assert.equal(originalDraws,34);assert.equal(quads,1);assert.equal(targetAllocations,1);assert.equal(resizes,0);
assert.equal(lastOutput.texture.type,THREE.FloatType,"HDR precision retained");assert.equal(lastOutput.texture.colorSpace,THREE.LinearSRGBColorSpace);
assert.equal(lastOutput.depthBuffer,false);assert.equal(lastOutput.stencilBuffer,false);assert.equal(lastMaterial.map,texture);
assert.equal(sourceQuad.material.map,texture,"borrowed interpolation map restored");assert.equal(gl.autoClear,true);assert.equal(tracer.samples,190);assert.equal(textureDisposals,0);
target.width=800;target.height=450;callback(target,gl,sourceQuad);callback(target,gl,sourceQuad);
assert.equal(targetAllocations,1);assert.equal(resizes,1);assert.equal(lastOutput.width,800);assert.equal(lastOutput.height,450);
let materialDisposals=0;lastMaterial.addEventListener("dispose",()=>materialDisposals++);
throwDraw=true;callback(target,gl,sourceQuad);callback(target,gl,sourceQuad);
assert.equal(published.at(-1),null,"failed draw invalidates exported display target");assert.equal(warnings.length,1);assert.equal(originalDraws,38);assert.equal(gl.autoClear,true);assert.equal(gl.target,previousTarget);assert.equal(sourceQuad.material.map,texture);
const disposedBefore=targetDisposals;dispose();dispose();assert.equal(published.at(-1),null,"disposal clears the display handle");assert.equal(materialDisposals,1);assert.equal(quadDisposals,1);assert.equal(targetDisposals,disposedBefore+1);assert.equal(textureDisposals,0);assert.equal(tracer.renderToCanvasCallback,original);
throwDraw=false;const nextDispose=install(tracer),otherOwner=()=>{};tracer.renderToCanvasCallback=otherOwner;nextDispose();assert.equal(tracer.renderToCanvasCallback,otherOwner);
texture.dispose();
console.log("PASS: actual filter callback — bounded linear-HDR copy, original reconstruction/colour conversion, preview/fade bypass, lazy/reused resizeable target, untouched accumulation, render-state/map restoration, failure fallback and owned cleanup; GPU/visual comparison separate");

const renderer=ts.createSourceFile("PhotoModeRenderer.tsx",readFileSync("src/components/pool/three/PhotoModeRenderer.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=renderer.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="PhotoModeRenderer");
const flag=component.parameters[0].name.elements.find(n=>n.name.getText(renderer)==="filterOutput");assert.equal(flag.initializer.kind,ts.SyntaxKind.FalseKeyword,"legacy photo mode stays opt-in");
const scene=ts.createSourceFile("PoolScene.tsx",readFileSync("src/components/pool/three/PoolScene.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let attribute;const visit=n=>{if(ts.isJsxAttribute(n)&&n.name.getText(scene)==="filterOutput")attribute=n;ts.forEachChild(n,visit);};visit(scene);
const optsIn=runInNewContext(`(architecture,patioContext)=>(${attribute.initializer.expression.getText(scene)})`);
assert.equal(optsIn(null,undefined),false,"Original open garden stays opt-in");
assert.equal(optsIn({},undefined),true,"Catalogue architecture keeps filtering");
assert.equal(optsIn(null,{}),true,"Patio explicitly opts into filtering");
console.log("PASS: catalogue architecture and Patio opt into filtering; original open garden remains unchanged");

const hdrFlag=component.parameters[0].name.elements.find(n=>n.name.getText(renderer)==="denoiseExport");
assert(hdrFlag,"HDR export has an independent opt-in, without making an outdoor scene indoor");
assert.equal(hdrFlag.initializer.getText(renderer),"indoor","Existing indoor callers retain HDR cleanup by default");
let hdrAttribute,hdrGuard;
const findHDRAttribute=n=>{if(ts.isJsxAttribute(n)&&n.name.getText(scene)==="denoiseExport")hdrAttribute=n;ts.forEachChild(n,findHDRAttribute);};findHDRAttribute(scene);
assert(hdrAttribute,"Caller explicitly scopes HDR cleanup");
const hdrScope=runInNewContext(`(architecture,patioContext,sceneTime)=>(${hdrAttribute.initializer.expression.getText(scene)})`);
for(const [architecture,patioContext,time,expected] of [[{indoor:false,setting:"residence"},undefined,"day",true],[{indoor:false,setting:"residence"},undefined,"night",false],[{indoor:false,setting:"infinity-villa"},undefined,"day",false],[{indoor:false,setting:"infinity-villa"},undefined,"night",false],[null,undefined,"day",false],[null,undefined,"night",false],[{indoor:false},undefined,"day",false],[{indoor:false},undefined,"night",false],[{indoor:true},undefined,"day",true],[{indoor:true},undefined,"night",true],[null,{},"day",false],[null,{},"night",true]])assert.equal(hdrScope(architecture,patioContext,time),expected,"HDR export adds Villa Day; Patio Night and existing scopes stay unchanged");
const findHDRGuard=n=>{if(ts.isIfStatement(n)&&n.thenStatement.getText(renderer).includes("hdrExportRef.current = installPhotoHDRExport("))hdrGuard=n.expression.getText(renderer);ts.forEachChild(n,findHDRGuard);};findHDRGuard(component);
const guard=runInNewContext(`(denoiseExport,filterOutput,indoor)=>(${hdrGuard})`);
for(const denoise of [false,true])for(const filter of [false,true])assert.equal(guard(denoise,filter,false),denoise&&filter,"An outdoor HDR worker starts only when both flags opt in");
console.log("PASS: independent HDR export scope preserves indoor/default callers and adds Patio Night and Villa Day");
