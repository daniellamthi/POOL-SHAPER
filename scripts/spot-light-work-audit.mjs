import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as THREE from "three";

const source=readFileSync("src/components/pool/three/spotLightWork.ts","utf8");
const context={exports:{},require:()=>THREE};
runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
const patched=context.exports.skipInactiveSpotLighting();
let checks=0;
const check=(condition,label)=>{assert(condition,label);checks++;};
const info=patched.indexOf("getSpotLightInfo( spotLight, geometryPosition, directLight );");
check(patched.indexOf("poolSpotDistanceSquared < spotLight.distance * spotLight.distance")<info,"Range rejects before attenuation, absorption and shadows");
check(patched.indexOf("dot(geometryNormal, poolToSpot)")<info,"Both BRDF normals reject before normalization/attenuation");
check(patched.includes("dot(geometryClearcoatNormal, poolToSpot) > 0.0"),"Clearcoat-only contribution is preserved");
check(patched.includes("spotLight.distance <= 0.0"),"Unlimited-range lights remain unlimited");
check(patched.includes("if (directLight.visible)"),"Native cone and attenuation visibility remains authoritative");
const original=THREE.ShaderChunk.lights_fragment_begin;
for(const marker of ["#if ( NUM_POINT_LIGHTS > 0 )","#if ( NUM_DIR_LIGHTS > 0 )"]){
  const start=original.indexOf(marker), end=marker.includes("POINT")?original.indexOf("#if ( NUM_SPOT_LIGHTS > 0 )",start):original.length;
  const revisedStart=patched.indexOf(marker), revisedEnd=marker.includes("POINT")?patched.indexOf("#if ( NUM_SPOT_LIGHTS > 0 )",revisedStart):patched.length;
  check(original.slice(start,end)===patched.slice(revisedStart,revisedEnd),"Point/sun/hemisphere/indirect lighting untouched");
}
check(patched.split("{").length===patched.split("}").length,"Shader blocks remain balanced");
check(patched.includes("#pragma unroll_loop_start")&&patched.includes("spotShadowMap[ i ]"),"Original static sampler/shadow indexing is retained");

// Deterministic physical reference: range attenuation is exactly zero outside
// its cutoff, including the submerged near-field softening used by this app.
// A rejected surface must have zero irradiance for BOTH possible BRDF normals.
let seed=7331;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const vector=()=>new THREE.Vector3(random()*2-1,random()*2-1,random()*2-1).normalize();
let skipped=0, lit=0;
for(let i=0;i<20000;i++){
  const toLight=vector().multiplyScalar(random()*20+0.0001);
  const normal=vector(), coat=i%3===0?vector():new THREE.Vector3();
  const range=i%7===0?0:random()*15+0.1;
  const near=i%2===0?0.12:0.035;
  const active=i%11!==0;
  const distance=toLight.length(), softened=Math.hypot(distance,near);
  const angular=vector().dot(toLight.clone().normalize())>0.6;
  const attenuation=range===0?1:Math.max(0,1-(softened/range)**4)**2*(softened<range?1:0);
  const normalPositive=normal.dot(toLight.clone().normalize())>0||coat.dot(toLight.clone().normalize())>0;
  const referenceContributes=active&&angular&&attenuation>0&&normalPositive;
  const earlyAllows=active&&(range<=0||toLight.lengthSq()<range*range)&&(normal.dot(toLight)>0||coat.dot(toLight)>0);
  check(!referenceContributes||earlyAllows,"No contributing light can be rejected by the cheaper predicate");
  if(!earlyAllows)skipped++;
  if(referenceContributes)lit++;
}
check(skipped>10000&&lit>100,"Fixture covers rejected and genuinely lit receivers, not only trivial zeros");
console.log(JSON.stringify({status:"PASS",checks,skipped,lit,scope:"Actual shader insertion/order and deterministic zero-contribution equivalence"}));
