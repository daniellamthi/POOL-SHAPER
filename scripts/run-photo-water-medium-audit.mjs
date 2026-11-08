import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(process.cwd()+'/package.json'),ts=require('typescript'),THREE=require('three');
const file='src/components/pool/three/photoWaterMedium.ts';
assert(fs.existsSync(file),'Photo water medium must attenuate actual bounded ray lengths');
const exports=vm.runInNewContext(ts.transpile(fs.readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022})+';exports;',{exports:{},require:name=>name==='three'?THREE:require(name)});
const {preparePhotoWaterMedium:prepare,installPhotoWaterMedium:install,PHOTO_WATER_LENGTH_GLSL:glsl}=exports;
const spec={outline:[[-2,-1],[2,-1],[2,1],[-2,1]],waterY:0,bottomY:-2,absorption:[.45,.14,.035]};
// Execute the actual scalar GLSL body, stripping only type declarations. No
// separate length implementation can silently disagree with the GPU source.
const body=glsl.replace(/\bfloat\s+poolPhotoWaterLength\s*\(/,'function poolPhotoWaterLength(').replace(/\b(?:vec3|float)\s+(origin|direction|rayDist)\b/g,'$1').replace(/\b(?:float|int|bool)\s+/g,'let ').replace(/\bfloat\(/g,'Number(');
const lengthFor=raw=>{const p=prepare(raw);assert(p);return vm.runInNewContext(body+';poolPhotoWaterLength;',{poolPhotoWaterPoints:p.points,poolPhotoWaterMin:p.min,poolPhotoWaterMax:p.max,poolPhotoWaterWinding:p.winding,POOL_PHOTO_WATER_POINTS:p.points.length,abs:Math.abs,min:Math.min,max:Math.max,sign:Math.sign,clamp:(x,a,b)=>Math.max(a,Math.min(x,b))});};
const vector=(x,y,z)=>({0:x,1:y,2:z,x,y,z}),near=(a,b)=>assert(Math.abs(a-b)<2e-5,`${a} != ${b}`);
let length=lengthFor(spec),cases=0;
for(const [o,d,dist,expected]of [
 [[0,3,0],[0,-1,0],10,2],[[0,-1,0],[0,1,0],10,1],[[0,-1,0],[1,0,0],10,2],
 [[-4,-1,0],[1,0,0],10,4],[[0,1,0],[1,0,0],10,0],[[0,-3,0],[1,0,0],10,0],
 [[0,-1,0],[0,-1,0],.2,.2],[[5,-1,0],[0,-1,0],10,0],[[0,-1,0],[0,1,0],.25,.25]]){near(length(vector(...o),vector(...d),dist),expected);cases++;}
const concave={...spec,outline:[[-2,-2],[2,-2],[2,0],[0,0],[0,2],[-2,2]]};
near(lengthFor(concave)(vector(-3,-1,1),vector(1,0,0),10),2);near(lengthFor({...concave,outline:[...concave.outline].reverse()})(vector(-3,-1,1),vector(1,0,0),10),2);cases+=2;
// Independent numerical midpoint integration checks the exact shader body for
// concave, rotated, reversed, translated, rounded and boundary-crossing rays.
const shapes=[spec.outline,concave.outline,Array.from({length:24},(_,i)=>[2*Math.cos(i*Math.PI/12),Math.sin(i*Math.PI/12)])];
const inside=(point,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>point[2])!==(b[1]>point[2])&&point[0]<(b[0]-a[0])*(point[2]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
for(const shape of shapes)for(const angle of [0,.73])for(const reverse of [false,true]){
 const poly=shape.map(([x,z])=>[x*Math.cos(angle)-z*Math.sin(angle)+7,x*Math.sin(angle)+z*Math.cos(angle)-4]);if(reverse)poly.reverse();
 const raw={...spec,outline:poly},fn=lengthFor(raw);
 for(let i=0;i<28;i++){
  const o=[7+4*Math.sin(i*2.3),-3+4*(.5+.5*Math.cos(i*1.7)),-4+3*Math.cos(i*.9)];
  const d=[Math.cos(i*.53),Math.sin(i*1.13),Math.sin(i*.53)];const norm=Math.hypot(...d);for(let c=0;c<3;c++)d[c]/=norm;
  let sampled=0;const steps=30000,dist=9,step=dist/steps;
  for(let n=0;n<steps;n++){const t=(n+.5)*step,p=o.map((v,c)=>v+d[c]*t);if(p[1]<raw.waterY&&p[1]>raw.bottomY&&inside(p,poly))sampled+=step;}
  assert(Math.abs(fn(vector(...o),vector(...d),dist)-sampled)<.002,'bounded GLSL path must match independent volume integration');cases++;
 }
}
for(const invalid of [{...spec,waterY:NaN},{...spec,bottomY:1},{...spec,absorption:[-1,0,0]},{...spec,outline:[[0,0],[1,0],[2,0]]}])assert.equal(prepare(invalid),null);
const {PhysicalPathTracingMaterial}=await import(process.cwd()+'/node_modules/three-gpu-pathtracer/src/index.js');
const m=new PhysicalPathTracingMaterial(),old=m.fragmentShader,tracer={_pathTracer:{material:m}},retained={value:42};m.uniforms.ownerTest=retained;
const stop=install(tracer,prepare(spec));assert.notEqual(m.fragmentShader,old);assert.equal((m.fragmentShader.match(/uniform\s+(?:[iu]?sampler\w+)/g)||[]).length,(old.match(/uniform\s+(?:[iu]?sampler\w+)/g)||[]).length,'no added GPU sampler');assert(m.fragmentShader.includes('poolPhotoWaterLength( ray.origin, ray.direction, surfaceHit.dist )'));assert(m.fragmentShader.includes('poolPhotoWaterLength( startPoint, ray.direction, rayDist )'));stop();stop();assert.equal(m.fragmentShader,old);assert.equal(m.uniforms.ownerTest,retained);assert(!m.uniforms.poolPhotoWaterPoints);
m.fragmentShader='unsupported revision';assert.throws(()=>install(tracer,prepare(spec)),/water medium shader/);assert.equal(m.fragmentShader,'unsupported revision');m.fragmentShader=old;m.dispose();
const callerSource=fs.readFileSync('src/components/pool/three/PoolScene.tsx','utf8');
const callerTree=ts.createSourceFile('PoolScene.tsx',callerSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let memo;
const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(callerTree)==='photoWaterMedium')memo=node.initializer.getText(callerTree);ts.forEachChild(node,visit);};visit(callerTree);assert(memo,'explicit bounded caller scope');
const integrationSource=fs.readFileSync('src/components/pool/three/PhotoModeRenderer.tsx','utf8');
const integrationTree=ts.createSourceFile('PhotoModeRenderer.tsx',integrationSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let pureArg;
const findWaterCall=node=>{if(ts.isCallExpression(node)&&node.expression.getText(integrationTree)==='createPhotoModeWaterMaterial')pureArg=node.arguments[2]?.getText(integrationTree);ts.forEachChild(node,findWaterCall);};findWaterCall(integrationTree);assert(pureArg);
const evaluate=scope=>vm.runInNewContext(memo,{useMemo:fn=>fn(),...scope});let scopeCases=0;
for(const setting of ['residence','spa-wall','spa-glass','infinity-villa',undefined])for(const time of ['day','night'])for(const water of [false,true])for(const patio of [false,true]){
 const outline=spec.outline,absorption=spec.absorption;
 const got=evaluate({showWater:water,patioContext:patio?{}:null,architecture:setting?{setting,indoor:setting.startsWith('spa-')}:null,sceneTime:time,outline,verticalLayout:{waterY:0,bottomY:-2,floorY:-2},materials:{surface:{underwaterAbsorption:absorption}}});
 if(water&&(((setting==='residence'||setting?.startsWith('spa-'))&&time==='day')||patio)){assert(got,"water medium must be present in the scoped setting and time");assert.equal(got.outline,outline);assert.equal(got.absorption,absorption);assert.equal(got.bottomY,-2);}else assert.equal(got,undefined);
 assert.equal(vm.runInNewContext(pureArg,{preparedWaterMedium:got,theme:time==='night'?'dark':'light'}),Boolean(water&&patio&&time==='night'),'pure interface remains scoped to the actual Night medium caller');scopeCases++;
}
assert(callerSource.includes('waterMedium={photoWaterMedium}'));
const integration=fs.readFileSync('src/components/pool/three/PhotoModeRenderer.tsx','utf8');
assert(integration.includes('if (preparedWaterMedium) override.attenuationColor.setRGB(1, 1, 1);'),'avoid duplicate legacy medium absorption');
assert(integration.indexOf('disposeWaterMedium?.();')<integration.indexOf('disposeLedTransport?.();'),'unwind shader adapters in reverse order');
const setSceneIndex=integration.indexOf('tracer.setScene(scene, photoFrame.camera);');
assert(setSceneIndex>=0 && setSceneIndex<integration.indexOf('installPhotoWaterMedium(tracer, preparedWaterMedium)'),'adapt only owned completed tracer snapshot');
assert(integration.includes('projectPhotoWaterPreservation(waterMedium, photoFrame.camera)'),'water ROI uses the exact traced full-frame camera');
console.log(`PASS: ${scopeCases} actual caller-scope combinations, original coefficient/outline identity and adapter ordering.`);
console.log(`PASS: ${cases} actual-GLSL bounded path checks; independent volume integration; orientation/concavity/height/finite-distance limits; shader ownership/cleanup and sampler budget. GPU/image acceptance separate.`);

let hdriGate;
const findGate=node=>{if(ts.isIfStatement(node)&&node.thenStatement.getText(integrationTree).startsWith('new HDRLoader().load'))hdriGate=node.expression.getText(integrationTree);ts.forEachChild(node,findGate);};findGate(integrationTree);assert(hdriGate);
let skyCases=0;
for(const indoor of [false,true])for(const theme of ['light','dark'])for(const medium of [null,{}])for(const ledTransportWaterY of [undefined,-.054]){
 const got=vm.runInNewContext(hdriGate,{indoor,theme,preparedWaterMedium:medium,ledTransportWaterY});
 assert.equal(Boolean(got),!(theme==='dark'&&(indoor||(medium&&ledTransportWaterY!==undefined))),'actual HDRI load gate keeps the live Night sky for the bounded Patio case');skyCases++;
}
console.log(`PASS: ${skyCases} actual HDRI-gate combinations; existing indoor Night and all other sky routes preserved.`);
