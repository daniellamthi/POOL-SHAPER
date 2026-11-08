import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const require=createRequire(process.cwd()+'/package.json'),ts=require('typescript'),T=await import(pathToFileURL(process.cwd()+'/node_modules/three/build/three.module.js'));
const {PhysicalPathTracingMaterial}=await import(pathToFileURL(process.cwd()+'/node_modules/three-gpu-pathtracer/src/index.js'));
const load=(file,deps)=>{const m={exports:{}};new Function('require','exports','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>{assert(id in deps,id);return deps[id];},m.exports,m);return m.exports;};
const field=load('src/components/pool/three/photoSunCausticField.ts',{three:T}),medium=load('src/components/pool/three/photoWaterMedium.ts',{three:T});
const file='src/components/pool/three/photoRefractedSun.ts',api=fs.existsSync(file)?load(file,{three:T,'./photoSunCausticField':field}):{};
assert(typeof api.prepareRefractedSun==='function','photo adapter must use the actual water-normal refraction field');
const scene=new T.Scene(),sun=new T.DirectionalLight(0xffffff,3);sun.position.set(1,3,1);scene.add(sun);scene.updateMatrixWorld(true);
const spec={outline:[[-3.5,-1.5],[3.5,-1.5],[3.5,1.5],[-3.5,1.5]],waterY:0,bottomY:-1.5,absorption:[.45,.14,.035]},normal=new T.DataTexture(new Uint8Array(64*64*4),64,64);
for(let y=0;y<64;y++)for(let x=0;x<64;x++){const o=(y*64+x)*4;normal.image.data.set([128+18*Math.sin(x*.6),128+12*Math.cos(y*.7),252,255],o);}normal.repeat.set(.635,.635);
let normalDisposals=0;normal.addEventListener('dispose',()=>normalDisposals++);const sceneBefore=JSON.stringify(scene.toJSON()),bitmapBefore=normal.image.data.slice();
const prepared=api.prepareRefractedSun(scene,spec,normal,new T.Vector2(.6,.6),1.333);assert(prepared);assert(prepared.gain.minGain<1&&prepared.gain.maxGain>1);
assert(Math.abs(prepared.gain.targetFlux-prepared.gain.encodedFlux)<1e-5);assert.deepEqual(normal.image.data,bitmapBefore);assert.equal(JSON.stringify(scene.toJSON()),sceneBefore);
const material=new PhysicalPathTracingMaterial(),tracer={_pathTracer:{material}},original=material.fragmentShader;const undoMedium=medium.installPhotoWaterMedium(tracer,medium.preparePhotoWaterMedium(spec)),before=material.fragmentShader;
let uploads;material.iesProfiles.setTextures=(_gl,items)=>uploads=[...items];const preserved={value:11};material.uniforms.poolRefractedSunFloorY=preserved;
const restore=api.installRefractedSun(tracer,scene,{},prepared);
assert(material.fragmentShader!==before);assert(material.fragmentShader.includes('poolRefractedSunGain(rayOrigin)'));assert(material.fragmentShader.includes('lightRec.type == DIR_LIGHT_TYPE'));assert(material.fragmentShader.includes('diffuseEval('));
assert.equal((material.fragmentShader.match(/uniform\s+(?:[iu]?sampler\w+)/g)||[]).length,(original.match(/uniform\s+(?:[iu]?sampler\w+)/g)||[]).length);
assert.equal(uploads.length,1);assert.equal(uploads[0].image.width,prepared.field.resolution);assert(uploads[0].image.data.some(v=>v>1),'HDR density ratios retained');
restore();restore();assert(material.fragmentShader===before);assert.equal(material.uniforms.poolRefractedSunFloorY,preserved);assert.equal(normalDisposals,0);undoMedium();assert(material.fragmentShader===original);
sun.visible=false;assert.equal(api.prepareRefractedSun(scene,spec,normal,new T.Vector2(.6,.6),1.333),null);sun.visible=true;
assert.throws(()=>api.installRefractedSun(tracer,scene,{},prepared),/water medium|shader/);
console.log(JSON.stringify({status:'PASS',scope:'actual normal bitmap/scale/transform, directional-sun snapshot, conserved capped field, installed owned shader/atlas with no new sampler, unchanged scene/borrowed map, idempotent reverse cleanup; native image acceptance separate',range:[prepared.gain.minGain,prepared.gain.maxGain]}));

sun.intensity=0;
const hdri=api.prepareRefractedSun(scene,spec,normal,new T.Vector2(.6,.6),1.333,[.2457,.9123,-.3276]);
assert(hdri && hdri.environmentSun,'captured HDRI sun must activate even when the duplicate directional light is intentionally off');
const undoHDRIMedium=medium.installPhotoWaterMedium(tracer,medium.preparePhotoWaterMedium(spec));const undoHDRI=api.installRefractedSun(tracer,scene,{},hdri);
assert(material.fragmentShader.includes('dot(envDirection,poolRefractedSunDirection)'),'only the actual captured solar cone receives the correction');
assert(material.fragmentShader.includes('environmentIntensity * envColor * state.throughputColor * diffuseColor'));
undoHDRI();undoHDRIMedium();console.log('PASS: real catalogue photo lighting uses the HDRI solar cone with zero duplicate directional energy');

normal.dispose();material.dispose();

const caller=fs.readFileSync('src/components/pool/three/PoolScene.tsx','utf8').match(/refractedSun=\{([^\n]+)\}/)?.[1];assert(caller);
const resolve=new Function('sceneTime','photoWaterMedium','floorProfileSetting','photographicSpa',`return (${caller});`);
for(const time of ['day','night'])for(const medium of [undefined,{}])for(const profile of ['flat','slope'])for(const indoor of [false,true])assert.equal(resolve(time,medium,profile,indoor),time==='day'&&!!medium&&!indoor&&profile==='flat');
const integration=fs.readFileSync('src/components/pool/three/PhotoModeRenderer.tsx','utf8'),sunCleanup=integration.indexOf('disposeRefractedSun?.();'),mediumCleanup=integration.indexOf('disposeWaterMedium?.();');assert(sunCleanup>=0&&mediumCleanup>sunCleanup,'unwind refracted field before its borrowed medium shader');
console.log('PASS: actual Day/medium/flat caller gate and reverse adapter teardown; no temporary baseline override');
