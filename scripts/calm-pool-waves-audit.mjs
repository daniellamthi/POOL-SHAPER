import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import * as THREE from "three";
const checks={count:0};
const check=(value,label)=>{assert(value,label);checks.count++;};
const context={exports:{}};
runInNewContext(ts.transpileModule(readFileSync("src/components/pool/three/calmPoolWaves.ts","utf8"),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText,context);
const {CALM_POOL_WAVES:waves,writeCalmWavePhases:write,CALM_POOL_WAVE_SLOPE:glsl}=context.exports;
check(waves.length===4,"One shared four-wave field, not per-finish shader systems");
for(let i=0;i<waves.length;i++){
  const wave=waves[i],length=2*Math.PI/Math.hypot(...wave.k);
  const period=2*Math.PI/Math.sqrt(9.81*Math.hypot(...wave.k));
  check(length>.3&&length<1.2,"Metre-space wavelengths remain pool-scale ripples");
  check(period>.45&&period<.85,"Gravity-wave phase rate, not minute-long texture drift");
  check(wave.height>0&&wave.height<.008,"Individual illustrative wave amplitudes remain millimetric");
}
const heightBound=waves.reduce((sum,wave)=>sum+wave.height,0);
const slopeBound=waves.reduce((sum,wave)=>sum+wave.height*Math.hypot(...wave.k),0);
check(heightBound<.017&&slopeBound<.13,"No large/discontinuous or breaking-wave normal field");
const value=new THREE.Vector4(), later=new THREE.Vector4();
for(const time of [0,.1,123.45,3600,86400,1e6]){
  write(value,time);write(later,time+1/120);
  value.toArray().forEach((phase,index)=>{
    check(Number.isFinite(phase)&&phase>=0&&phase<Math.PI*2,"Uniform phases stay finite and bounded during long sessions");
    const advance=(later.getComponent(index)-phase+Math.PI*2)%(Math.PI*2);
    const expected=Math.sqrt(9.81*Math.hypot(...waves[index].k))/120;
    check(Math.abs(advance-expected)<1e-7,"Phase wrap preserves continuous movement, including long sessions");
  });
}
check((glsl.match(/cos\(/g)||[]).length===4&&!glsl.includes("texture"),"Same four analytic modes: no new texture samples or draws");

// Execute the actual canonical water geometry constructor, not an invented UV.
const geometrySource=readFileSync("src/components/pool/three/poolGeometry.ts","utf8");
const ast=ts.createSourceFile("geometry.ts",geometrySource,ts.ScriptTarget.Latest,true);
const constructor=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="createSurfaceGeometry");
assert(constructor);
const geometryContext={exports:{},THREE};
runInNewContext(ts.transpileModule(constructor.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,geometryContext);
for(const [length,width] of [[6,3],[8,4],[12,5]]){
  const geometry=geometryContext.exports.createSurfaceGeometry([[-length/2,-width/2],[length/2,-width/2],[length/2,width/2],[-length/2,width/2]]);
  const position=geometry.getAttribute("position"),uv=geometry.getAttribute("uv");
  for(let i=0;i<position.count;i++){
    check(Math.abs(position.getX(i)-uv.getX(i))<1e-6&&Math.abs(position.getZ(i)+uv.getY(i))<1e-6,"Canonical water UVs remain metres across all three sizes");
  }
  geometry.dispose();
}
const water=readFileSync("src/components/pool/three/WaterSurfaceMaterial.tsx","utf8");
check(water.includes("const metricWaves = !!outline && !flowing && !planView"),"New field excluded from Infinity, film/tongue and technical view");
check(water.includes("material.current.needsUpdate = true")&&water.includes("}, [metricWaves])")&&water.includes("${metricWaves ? 1 : 0}"),"Program identity and invalidation update when switching system/view");
check(water.includes("if(outline&&!flowing&&!planView) writeCalmWavePhases(wavePhases.current,time * 0.85)"),"Surface ripples run 15% slower; inactive and Infinity profiles remain unchanged");
check(water.includes("#ifdef WATER_METRIC_WAVES")&&!water.includes("uniform bool waterMetricWaves"),"Only the selected profile is compiled; no per-fragment profile branch");
const legacy=water.slice(water.indexOf("#else\ncalmSlope ="),water.indexOf("vec2 combinedSlope = calmSlope"));
for(const coefficient of ["0.0026","0.0018","0.0008","0.0003"])check(legacy.includes(coefficient),"Exact approved legacy Infinity amplitude retained, not the earlier x3 WIP experiment");
console.log(JSON.stringify({status:"PASS",checks:checks.count,heightBound,slopeBound,scope:"Actual phase module, metric UV geometry, bounded envelope and integration contracts; visual/GPU proof separate"}));
