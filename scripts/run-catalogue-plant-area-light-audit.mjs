import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';

// Run from repository root. Optional arg: helper source path; --numeric-only
// runs the reference comparison while a helper is still being prepared.
const root = process.env.POOL_ROOT ?? process.cwd();
const require = createRequire(resolve(root, 'package.json'));
const T = require('three');
const ts = require('typescript');
const chunk = T.ShaderChunk.lights_physical_pars_fragment;
const include = '#include <lights_physical_pars_fragment>';
const signature = 'void RE_Direct_RectArea_Physical(';
const uvAnchor = 'vec2 uv = LTC_Uv( normal, viewDir, roughness );';
const matrixAnchor = 'mat3 mInv = mat3(';
const clearcoatLines = [
  'vec3 Ncc = geometryClearcoatNormal;',
  'vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );',
  'vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );',
  'vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );',
];
const lookupLines = [
  'vec4 t1 = texture2D( ltc_1, uv );',
  'vec4 t2 = texture2D( ltc_2, uv );',
  ...clearcoatLines.slice(2),
];
const helperPath = resolve(process.argv[2] && process.argv[2] !== '--numeric-only'
  ? process.argv[2] : 'src/components/pool/three/cataloguePlantAreaLight.ts');

function section(source) {
  const start = source.indexOf(signature);
  assert(start >= 0, 'installed direct-area function must exist');
  const brace = source.indexOf('{', start);
  let depth = 1, end = brace + 1;
  while (depth && end < source.length) {
    const c = source[end++]; if (c === '{') depth++; if (c === '}') depth--;
  }
  assert.equal(depth, 0, 'balanced installed function');
  return {start, end, text:source.slice(start,end), before:source.slice(0,start), after:source.slice(end)};
}
const originalSection = section(chunk);
assert.equal(originalSection.text.split(uvAnchor).length - 1, 1);
assert.match(chunk, /if\s*\(\s*dot\(\s*lightNormal,\s*P\s*-\s*rectCoords\[\s*0\s*\]\s*\)\s*<\s*0\.0\s*\)\s*return vec3\(\s*0\.0\s*\)/);
assert.match(originalSection.text, /clearcoatSpecularDirect\s*\+=.*LTC_Evaluate\(\s*Ncc,\s*viewDir,\s*position,/);
assert.equal((originalSection.text.match(/\+=/g) ?? []).length, 3,
  'review reference if the installed area function gains more accumulator side effects');

function loadHelper(sourceChunk) {
  const exports = {}, localChunks = {...T.ShaderChunk, lights_physical_pars_fragment:sourceChunk};
  const transpiled = ts.transpileModule(readFileSync(helperPath,'utf8'), {compilerOptions:{
    target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS,
  }}).outputText;
  vm.runInNewContext(transpiled, {exports, console, require(name) {
    assert.equal(name,'three','helper should only depend on Three');
    return {...T,ShaderChunk:localChunks};
  }});
  assert.equal(typeof exports.skipBackFacingPlantAreaLights,'function');
  return {patch:exports.skipBackFacingPlantAreaLights, localChunks};
}
let patchCases = 0;
function patchCheck(sourceChunk, shaderSource, changes) {
  const {patch,localChunks} = loadHelper(sourceChunk);
  const shader = {uniforms:{preserved:{value:17}}, vertexShader:'vertex untouched', fragmentShader:shaderSource};
  const patched=patch(shader);
  assert.equal(patched,changes,'patch reports success only when it safely applies');
  assert.equal(shader.vertexShader,'vertex untouched');
  assert.equal(shader.uniforms.preserved.value,17);
  assert.equal(Object.keys(shader.uniforms).length,1,'no new uniform ownership');
  assert(localChunks.lights_physical_pars_fragment===sourceChunk,'never mutate shared ShaderChunk');
  if (!changes) assert(shader.fragmentShader===shaderSource,'unsafe patch must leave shader unchanged');
  else {
    const actual = section(shader.fragmentShader);
    const expectedBefore = shaderSource.slice(0,shaderSource.indexOf(include)) + originalSection.before;
    const expectedAfter = originalSection.after + shaderSource.slice(shaderSource.indexOf(include)+include.length);
    assert.equal(actual.before,expectedBefore,'helpers and surrounding shader unchanged');
    assert.equal(actual.after,expectedAfter,'all other light/IBL functions unchanged');
    assert.equal((actual.text.match(/\breturn\s*;/g) ?? []).length,1,'one early return inside only the direct-area function');
    const branch=actual.text.indexOf('return;');
    let previousLookup=-1;
    for(const lookup of lookupLines) {
      assert.equal(actual.text.split(lookup).length-1,1,'preserve each original lookup exactly once');
      const offset=actual.text.indexOf(lookup);
      assert(offset>previousLookup && offset<branch,'all original implicit-derivative lookups retain order before divergence');
      previousLookup=offset;
    }
    assert(!/\b(?:dFdx|dFdy|textureGrad|textureLod)\s*\(/.test(actual.text),'do not substitute derivative or LOD evaluation');
    assert(branch<actual.text.indexOf(matrixAnchor),'skip only work following the unchanged lookup stage');
    for(const line of [uvAnchor,...clearcoatLines]) assert.equal(actual.text.split(line).length-1,1);
    assert.match(actual.text.slice(0,branch),/#ifdef USE_CLEARCOAT[\s\S]*t1Clearcoat = texture2D[\s\S]*t2Clearcoat = texture2D[\s\S]*#endif/);
    assert.match(actual.text,/dot\s*\([\s\S]*position\s*-\s*rectCoords\[\s*0\s*\][\s\S]*<\s*0\.0\s*\)\s*return\s*;/);
    assert.match(actual.text,/vec3\s+(\w+)\s*=\s*rectCoords\[\s*1\s*\]\s*-\s*rectCoords\[\s*0\s*\]\s*;\s*vec3\s+(\w+)\s*=\s*rectCoords\[\s*3\s*\]\s*-\s*rectCoords\[\s*0\s*\]\s*;\s*if\s*\(\s*dot\s*\(\s*cross\s*\(\s*\1\s*,\s*\2\s*\)\s*,\s*position\s*-\s*rectCoords\[\s*0\s*\]\s*\)\s*<\s*0\.0\s*\)\s*return\s*;/,
      'actual injected predicate must match the numerical stock-plane reference');
    for (const accumulation of originalSection.text.match(/(?:reflectedLight\.(?:directSpecular|directDiffuse)|clearcoatSpecularDirect)\s*\+=[^;]+;/g))
      assert(actual.text.includes(accumulation),'preserve stock diffuse/specular/clearcoat accumulation');
    const once=shader.fragmentShader; assert.equal(patch(shader),false); assert(shader.fragmentShader===once,'idempotent patch');
  }
  patchCases++;
}
if (process.argv[2] !== '--numeric-only') {
  assert(existsSync(helperPath),`Missing helper: ${helperPath}; --numeric-only does not claim patch verification`);
  patchCheck(chunk,`// existing material patch\n${include}\n// other material code`,true);
  patchCheck(chunk,'// missing chunk include',false);
  patchCheck(chunk,`${include}\n${include}`,false);
  for(const anchor of [matrixAnchor,...clearcoatLines]) {
    patchCheck(chunk.replace(anchor,'/* missing target */'),include,false);
    patchCheck(chunk.replace(anchor,`${anchor}\n${anchor}`),include,false);
  }
  for(const lookup of lookupLines.slice(0,2)) {
    patchCheck(chunk.replace(lookup,'/* missing stock lookup */'),include,false);
    patchCheck(chunk.replace(lookup,`${lookup}\n${lookup}`),include,false);
    patchCheck(chunk.replace(lookup,'').replace(matrixAnchor,`${matrixAnchor}\n${lookup}`),include,false);
  }
  patchCheck('',include,false);
  patchCheck(undefined,include,false);
  patchCheck(chunk.replace(signature,'void renamed_RectArea_Physical('),include,false);
  patchCheck(chunk+`\n${originalSection.text}`,include,false);
  // The same anchor outside the intended function must not redirect or defeat
  // a properly scoped replacement. The added helper is never compiled here.
  const externalDuplicate=chunk+`\nvoid unrelated() { ${matrixAnchor} }`;
  const {patch}=loadHelper(externalDuplicate);
  const shader={uniforms:{},fragmentShader:include}; patch(shader);
  assert.notEqual(shader.fragmentShader,include,'scope anchor uniqueness to the intended area function');
  assert(shader.fragmentShader.endsWith(`void unrelated() { ${matrixAnchor} }`));
  patchCases++;
}

// Numerical port of the installed LTC evaluator. JS doubles are deliberately
// not presented as a GLSL float/driver simulation. Branch classification is
// independently checked against a plane constructed from rectangle corners.
const add=(a,b)=>a.map((v,i)=>v+b[i]), sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s), dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalize=a=>mul(a,1/Math.hypot(...a));
function edge(a,b) {
  const x=dot(a,b), y=Math.abs(x);
  const p=0.8543985+(0.4965155+0.0145206*y)*y;
  const q=3.4175940+(4.1616724+y)*y;
  const v=p/q;
  return mul(cross(a,b),x>0?v:0.5/Math.sqrt(Math.max(1-x*x,1e-7))-v);
}
function referenceLtc(N,V,P,M,rect) {
  const v1=sub(rect[1],rect[0]),v2=sub(rect[3],rect[0]);
  if (dot(cross(v1,v2),sub(P,rect[0]))<0) return 0;
  const t1=normalize(sub(V,mul(N,dot(V,N)))),t2=mul(cross(N,t1),-1);
  const coords=rect.map(c=>{
    const d=sub(c,P),b=[dot(t1,d),dot(t2,d),dot(N,d)];
    return normalize(M.map(row=>dot(row,b)));
  });
  let form=[0,0,0];
  for(let i=0;i<4;i++) form=add(form,edge(coords[i],coords[(i+1)%4]));
  const l=Math.hypot(...form);
  return Math.max((l*l+form[2])/(l+1),0);
}
const identity=[[1,0,0],[0,1,0],[0,0,1]];
const specularMatrix=[[0.7,0,0.12],[0,1,0],[-0.08,0,0.9]];
const coatMatrix=[[0.82,0,0.03],[0,1,0],[-0.025,0,0.95]];
const receiverNormal=normalize([0.1,0.2,1]),view=normalize([0.35,0.11,1]);
const coatNormal=normalize([-0.1,0.14,1]);
const initial={diffuse:[0.25,0.5,0.75],specular:[0.6,0.4,0.2],clearcoat:[0.1,0.2,0.3]};
function shade(P,rect,early,clearcoat) {
  const out=structuredClone(initial),d=dot(cross(sub(rect[1],rect[0]),sub(rect[3],rect[0])),sub(P,rect[0]));
  if(early&&d<0)return {out,calls:0};
  const diffuse=referenceLtc(receiverNormal,view,P,identity,rect);
  const specular=referenceLtc(receiverNormal,view,P,specularMatrix,rect);
  out.diffuse=add(out.diffuse,mul([0.8,0.6,0.4],diffuse));
  out.specular=add(out.specular,mul([0.2,0.4,0.6],specular));
  if(clearcoat)out.clearcoat=add(out.clearcoat,mul([0.07,0.08,0.09],referenceLtc(coatNormal,view,P,coatMatrix,rect)));
  return {out,calls:clearcoat?3:2};
}
function rectFrom(center,w,h) {return [sub(add(center,w),h),sub(sub(center,w),h),add(sub(center,w),h),add(add(center,w),h)];}
let seed=0x5a17b4d1;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
let numericalCases=0,backsideCases=0,frontsideCases=0,degenerateCases=0;
function compare(P,rect,label,{backside=false,boundary=false,degenerate=false}={}) {
  const raw=dot(cross(sub(rect[1],rect[0]),sub(rect[3],rect[0])),sub(P,rect[0]));
  if(boundary)assert.equal(raw,0,'exact plane boundary must retain stock evaluation');
  if(!boundary&&!degenerate)assert.equal(raw<0,backside,label);
  for(const clearcoat of [false,true]) {
    const original=shade(P,rect,false,clearcoat),fast=shade(P,rect,true,clearcoat);
    assert(Object.values(original.out).flat().every(Number.isFinite),'reference uses finite valid material inputs');
    assert.deepEqual(fast.out,original.out,label);
    assert.equal(fast.calls,raw<0?0:original.calls,label);
    if(raw<0)assert.deepEqual(fast.out,initial,'rear emitter adds no diffuse/specular/clearcoat');
    numericalCases++;
  }
  if(degenerate)degenerateCases++;else if(raw<0)backsideCases++;else frontsideCases++;
}
for(let i=0;i<600;i++) {
  const center=[(random()-.5)*200,(random()-.5)*200,(random()-.5)*200];
  const rotation=new T.Matrix4().makeRotationFromEuler(new T.Euler(random()*6.28,random()*6.28,random()*6.28));
  const scale=new T.Matrix4().makeScale((i%2?-1:1)*10**(random()*6-3),10**(random()*6-3),10**(random()*6-3));
  const transform=rotation.multiply(scale);
  const w=new T.Vector3(1,0,0).applyMatrix4(transform).toArray(),h=new T.Vector3(0,1,0).applyMatrix4(transform).toArray();
  const rect=rectFrom(center,w,h),normal=normalize(cross(sub(rect[1],rect[0]),sub(rect[3],rect[0])));
  const plane=new T.Plane().setFromCoplanarPoints(new T.Vector3(...rect[0]),new T.Vector3(...rect[1]),new T.Vector3(...rect[3]));
  const distance=0.05+random()*20;
  for(const side of [-1,1]) {
    const P=add(center,mul(normal,side*distance));
    assert.equal(plane.distanceToPoint(new T.Vector3(...P))<0,side<0,'independent transformed-plane classification');
    compare(P,rect,`transformed rectangle ${i}/${side}`,{backside:side<0});
  }
}
const axisRect=rectFrom([0,0,0],[1,0,0],[0,1,0]);
compare([0.2,0.3,0],axisRect,'exact boundary zero',{boundary:true});
compare([0.2,0.3,Number.EPSILON],axisRect,'strict negative side arbitrarily near plane',{backside:true});
compare([0.2,0.3,-Number.EPSILON],axisRect,'strict positive side arbitrarily near plane');
compare([0.1,0.2,-2],rectFrom([0,0,0],[0,0,0],[0,1,0]),'zero-width rectangle remains stock',{degenerate:true});
compare([0.1,0.2,-2],rectFrom([0,0,0],[1,0,0],[2,0,0]),'collinear rectangle remains stock',{degenerate:true});
console.log(JSON.stringify({status:'PASS',patchCases,numericalCases,backsideCases,frontsideCases,degenerateCases,
  helper:patchCases?helperPath:'NOT VERIFIED (--numeric-only)',
  limits:'Numerical branch/accumulator equivalence for finite valid material inputs only. No NaN equivalence claim. Does not simulate GPU precision, implicit derivatives, texture filtering, compilation or rendered pixels. Native WebGL A/B required; bit-exactness is not claimed.'},null,2));
