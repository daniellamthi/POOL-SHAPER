import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const root=process.cwd();
const require=createRequire(path.join(root,'package.json'));
const ts=require('typescript');
const load=(file,names)=>{
  const text=fs.readFileSync(file,'utf8');
  const ast=ts.createSourceFile(file,text,ts.ScriptTarget.ESNext,true);
  const functions=ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.includes(node.name?.text))
    .map(node=>node.getText(ast)).join('\n');
  const context={exports:{}};
  vm.runInNewContext(ts.transpileModule(functions,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  return context.exports;
};
const { visibleCameraFrame }=load(process.env.POOL_CAMERA_SOURCE || path.join(root,'src/lib/pool/camera.ts'),['visibleCameraFrame']);
const { centeredArchitecturalFrame,architecturalFrustum }=load(path.join(root,'src/components/pool/three/architecturalPlan.ts'),['centeredArchitecturalFrame','architecturalFrustum']);
const rect=(left,top,width,height)=>({left,top,width,height});
// Observed native 390×844 DOM bounds: new custom pool4×2.7 with expanded shape tray.
const canvas=rect(0,0,390,844);
const header=rect(8,8,374,119),menu=rect(12,143,131.9140625,36),stage=rect(215.71875,179,162.28125,35.046875);
const tools=rect(180.921875,143,193.078125,40),expand=rect(289,147,32,32),more=rect(334,143,40,40);
const hidden=rect(0,0,0,0),dock=rect(8,330.40625,374,505.59375);
const overlays=[header,menu,stage,tools,expand,more,hidden,dock];
const planBounds=[[-2.72,-2.07],[2.72,2.07]];
const aspect=5.44/4.14;
const center=frame=>centeredArchitecturalFrame(frame,canvas.width);
const raw=visibleCameraFrame(canvas,overlays,aspect,center);
const frame=center(raw);
const frustum=architecturalFrustum(planBounds,canvas.width,canvas.height,frame,false,true);
const poolPixels=4/frustum.width*canvas.width;
let checks=0;
const check=(condition,message)=>{assert(condition,message);checks++;};
check(poolPixels>=70,`4m custom pool must remain visible in the native mobile free frame (actual ${poolPixels.toFixed(3)}px)`);
check(frame.width>68&&frame.height>32,'usable frame exceeds the real plan annotation margins');
for(const overlay of overlays){
  if(!overlay.width||!overlay.height)continue;
  const padding=overlay.width>=canvas.width*.55?0:8;
  const left=Math.max(0,overlay.left-padding),right=Math.min(canvas.width,overlay.left+overlay.width+padding);
  const top=Math.max(0,overlay.top-padding),bottom=Math.min(canvas.height,overlay.top+overlay.height+padding);
  check(frame.left+frame.width<=left||frame.left>=right||frame.top+frame.height<=top||frame.top>=bottom,'selected plan frame does not overlap a native overlay');
}
const renovation=visibleCameraFrame(canvas,overlays.filter(r=>r!==stage),aspect,center);
check(JSON.stringify(renovation)===JSON.stringify(rect(0,191,390,139.40625)),'renovation without stage badge preserves its already valid framing');
// No callback is the untouched perspective/default contract, including the original raw choice.
const ordinary=visibleCameraFrame(canvas,overlays,aspect);
check(JSON.stringify(ordinary)===JSON.stringify(rect(0,191,207.71875,139.40625)),'other camera modes keep the original native frame');
const empty=visibleCameraFrame(canvas,[],aspect,center);
check(JSON.stringify(empty)===JSON.stringify(rect(0,0,390,844)),'unoccluded top view keeps the full canvas');
const desktopCanvas=rect(0,0,1095,927);
const desktopOverlays=[rect(16,12,1063,72),rect(16,96,130,36),rect(770,96,309,40),rect(16,542,1063,369)];
const desktop=visibleCameraFrame(desktopCanvas,desktopOverlays,aspect,f=>centeredArchitecturalFrame(f,desktopCanvas.width));
const desktopOrdinary=visibleCameraFrame(desktopCanvas,desktopOverlays,aspect);
check(desktop.width>68&&desktop.height>32,'desktop top view retains usable plan space');
console.log(JSON.stringify({checks,raw,frame,frustum,poolPixels,renovation,ordinary,desktop},null,2));
