import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import {Color,MathUtils,Scene,DirectionalLight,HemisphereLight,SpotLight} from "three";
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const data=file=>runInNewContext(transpile(readFileSync(file,"utf8"))+";exports;",{exports:{}});
const {SCENE_VISUAL_PRESET}=data("src/configurator/3d/scene/visual-preset.ts");
const {CATALOGUE_GARDEN}=data("src/lib/pool/catalogue-garden.ts");
function namedFunction(text,name){const sf=ts.createSourceFile("PoolScene.tsx",text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;const visit=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found=n.getText(sf);ts.forEachChild(n,visit);};visit(sf);assert(found);return found;}
const beforeText=readFileSync("scripts/fixtures/photo-mood-live-before-snapshot.ts.txt","utf8");
const currentText=readFileSync("src/components/pool/three/PoolScene.tsx","utf8");
const before=namedFunction(beforeText,"SceneMood"),current=namedFunction(currentText,"SceneMood");
const daylightSource=ts.createSourceFile("DaylightEnvironment.tsx",readFileSync("src/components/pool/three/DaylightEnvironment.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let coastalInitializer;
const findCoastal=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(daylightSource)==="COASTAL_DAYLIGHT")coastalInitializer=node.initializer.getText(daylightSource);ts.forEachChild(node,findCoastal);};
findCoastal(daylightSource);assert(coastalInitializer);
const COASTAL_DAYLIGHT=runInNewContext(transpile("exports.value="+coastalInitializer)+";exports.value;",{exports:{}});
function driver(source){
 const scene=new Scene();scene.background=new Color("#ffffff");
 const gl={toneMappingExposure:1};
 const refs={sky:{current:new HemisphereLight()},sun:{current:new DirectionalLight()},auxiliary:{current:new SpotLight()}};
 const slots=[];let index=0,layout=[],frame;
 const changed=(a,b)=>!a||b.some((v,i)=>v!==a[i]);
 const hooks={
  useRef(initial){const at=index++;return slots[at]??=( {current:initial});},
  useMemo(create,deps){const at=index++;if(!slots[at]||changed(slots[at].deps,deps))slots[at]={deps,value:create()};return slots[at].value;},
  useCallback(callback,deps){return hooks.useMemo(()=>callback,deps);},
  useLayoutEffect(effect,deps){const at=index++;if(!slots[at]||changed(slots[at].deps,deps)){const old=slots[at];slots[at]={deps};layout.push(()=>{old?.cleanup?.();slots[at].cleanup=effect();});}},
  useFrame(callback){frame=callback;},useThree(selector){return selector?selector({gl,scene}):{gl,scene};},
 };
 const fn=runInNewContext(transpile(source+"\nexports.run=SceneMood;")+";exports.run;",{exports:{},...hooks,Color,MathUtils,SCENE_VISUAL_PRESET,CATALOGUE_GARDEN,COASTAL_DAYLIGHT});
 return {
  render(props){index=0;layout=[];fn({...props,...refs});layout.forEach(run=>run());},
  frame(dt){frame({gl,scene},dt);},
  snapshot(){return {environment:scene.environmentIntensity,exposure:gl.toneMappingExposure,sky:refs.sky.current.intensity,ground:refs.sky.current.groundColor.toArray(),sun:refs.sun.current.intensity,sunColor:refs.sun.current.color.toArray(),auxiliary:refs.auxiliary.current.intensity,background:scene.background.toArray()};},
 };
}
const profiles=[
 {name:"spa",architecturalIndoor:true,architecturalSetting:true,photographicGarden:true,baseEnvironment:CATALOGUE_GARDEN.environmentIntensity},
 {name:"residence",architecturalIndoor:false,architecturalSetting:true,photographicGarden:true,baseEnvironment:CATALOGUE_GARDEN.environmentIntensity},
 {name:"studio",architecturalIndoor:false,architecturalSetting:false,photographicGarden:false,baseEnvironment:SCENE_VISUAL_PRESET.environment.light},
 {name:"coast",architecturalIndoor:false,architecturalSetting:false,coastalDaylight:true,photographicGarden:false,baseEnvironment:COASTAL_DAYLIGHT.environment},
];
const common={baseBackground:"#bfd8ea",baseExposure:SCENE_VISUAL_PRESET.exposure.light};
let snapshotCases=0,liveFrames=0;
for(const profile of profiles)for(const fromPhotoMode of [false,true])for(const from of [false,true])for(const to of [false,true]){
 const expected=driver(before);expected.render({...common,...profile,dusk:to,photoMode:true});expected.frame(100);
 const actual=driver(current);actual.render({...common,...profile,dusk:from,photoMode:fromPhotoMode});actual.frame(100);
 actual.render({...common,...profile,dusk:to,photoMode:true});
 const got=actual.snapshot(),want=expected.snapshot();
 if(JSON.stringify(got)!==JSON.stringify(want)){
  const mismatch={profile:profile.name,from:from?"night":"day",to:to?"night":"day",beforeFirstTracedFrame:got,settledProfile:want};
  console.log(JSON.stringify(mismatch));
 }
 assert.deepEqual(actual.snapshot(),expected.snapshot(),"Photo Mode must snapshot the settled target before passive tracer setup");snapshotCases++;
}
for(const profile of profiles)for(const dusk of [false,true]){
 const expected=driver(before);expected.render({...common,...profile,dusk,photoMode:true});expected.frame(100);
 const actual=driver(current);actual.render({...common,...profile,dusk,photoMode:true});
 assert.deepEqual(actual.snapshot(),expected.snapshot(),"initial photo mount uses its complete target profile");snapshotCases++;
}
for(const profile of profiles)for(const from of [false,true])for(const to of [false,true]){
 const old=driver(before),now=driver(current);
 for(const d of [old,now]){d.render({...common,...profile,dusk:from,photoMode:false});d.frame(100);d.render({...common,...profile,dusk:to,photoMode:false});}
 for(const dt of [.016,.12,.7,1]){old.frame(dt);now.frame(dt);assert.deepEqual(now.snapshot(),old.snapshot(),"existing live fade must remain numerically identical");liveFrames++;}
}
// Room maps already contain sky irradiance plus authored cove emission.
// Applying the sky factor again must not dim the baked fixture contribution.
let roomIrradianceCases=0;
for(const dusk of [false,true])for(const photoMode of [false,true]){
 const actual=driver(current);
 actual.render({...common,...profiles[0],dusk,photoMode,roomEnvironmentReady:true});actual.frame(100);
 const want=photoMode?(dusk?.06:.65):1;
 assert.equal(actual.snapshot().environment,want,"A live captured room preserves authored irradiance; photos keep their separate sky scale");roomIrradianceCases++;
}
console.log(JSON.stringify({status:"PASS",snapshotCases,liveFrames,roomIrradianceCases,nightEnvironment:SCENE_VISUAL_PRESET.dusk.environment,nightSun:SCENE_VISUAL_PRESET.dusk.sunIntensity,nightAuxiliary:SCENE_VISUAL_PRESET.dusk.auxiliaryIntensity,nightExposure:SCENE_VISUAL_PRESET.dusk.exposure,limits:"Actual SceneMood hook logic with controlled React layout/passive ordering, not GPU timing."}));
