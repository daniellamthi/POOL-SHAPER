import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(process.cwd()+'/package.json'),ts=require('typescript'),T=require('three');
const file='src/components/pool/three/photoSunCausticField.ts';let bake=()=>null,makeSampler,makeGain;
if(fs.existsSync(file)){const m={exports:{}};new Function('require','exports','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>{assert.equal(id,'three');return T;},m.exports,m);bake=m.exports.bakeRefractedSunField;makeSampler=m.exports.createPhotoWaterNormalSampler;makeGain=m.exports.normaliseRefractedSunGain;}
let checks=0;const check=(v,msg)=>{assert(v,msg);checks++;};const near=(a,b,e,msg)=>check(Math.abs(a-b)<=e,`${msg}: ${a} vs ${b}`);
const base={outline:[[-2,-1.5],[2,-1.5],[2,1.5],[-2,1.5]],waterY:0,floorY:-1.5,toSun:[0,1,0],resolution:64,ior:1.333};
const flat=bake(base);check(!!flat,'Flat water must transport sunlight to its actual submerged floor');
const sum=a=>Array.from(a).reduce((s,v)=>s+v,0);
const auditFlux=field=>{const area=(field.bounds[2]-field.bounds[0])*(field.bounds[3]-field.bounds[1])/(field.resolution**2);for(const pass of [field.flat,field.refracted]){near(sum(pass.density)*area,pass.floorFlux,2e-5,'deposited map conserves floor flux');near(pass.launchedFlux,pass.floorFlux+pass.wallFlux+pass.reflectedFlux+pass.rejectedFlux,2e-5,'all incident energy accounted');for(const v of pass.density)check(Number.isFinite(v)&&v>=0,'finite nonnegative irradiance');}};
auditFlux(flat);for(let i=0;i<flat.flat.density.length;i++)near(flat.flat.density[i],flat.refracted.density[i],0,'no artificial pattern for flat normals');
near(flat.refracted.wallFlux,0,1e-9,'vertical flat water loses no light to side walls');
const tilted=bake({...base,toSun:[1,2,0]});auditFlux(tilted);let sx=0,weight=0;const [minX,,maxX]=tilted.bounds;for(let y=0;y<tilted.resolution;y++)for(let x=0;x<tilted.resolution;x++){const v=tilted.flat.density[y*tilted.resolution+x];sx+=(minX+(x+.5)*(maxX-minX)/tilted.resolution)*v;weight+=v;}
const thetaAir=Math.atan(.5),thetaWater=Math.asin(Math.sin(thetaAir)/base.ior),shift=-1.5*Math.tan(thetaWater);near(sx/weight,shift/2,.035,'floor footprint follows independently calculated Snell refraction');check(tilted.flat.wallFlux>0,'finite pool walls intercept oblique rays');
const sampleNormal=(x,z,out)=>out.set(.14*Math.sin(x*7),1,.1*Math.cos(z*8));
const waves=bake({...base,resolution:96,sampleNormal});auditFlux(waves);check(waves.refracted.density.some((v,i)=>Math.abs(v-waves.flat.density[i])>.1),'actual surface normals focus and disperse sunlight');
for(const outline of [base.outline,[...base.outline].reverse(),[[-2,-2],[2,-2],[2,0],[0,0],[0,2],[-2,2]]])for(const toSun of [[1,3,1],[-1,3,-1]])auditFlux(bake({...base,outline,toSun,sampleNormal}));
for(const bad of [{floorY:0},{toSun:[0,-1,0]},{ior:0},{waterY:NaN},{outline:[[0,0],[1,0],[2,0]]}])check(bake({...base,...bad})===null,'invalid or non-illuminated inputs produce no field');
console.log(JSON.stringify({status:'PASS',checks,scope:'Snell floor footprint, finite-pool interception, conserved incident/deposited flux, flat-surface identity, actual ripple focusing, concave/reversed outlines and invalid inputs; not GPU or native-image acceptance'}));

check(typeof makeSampler==='function','CPU optics must read the same texture/TBN as the photographic water');
const pixels=new Uint8Array([128,128,255,255, 128,128,255,255, 255,128,255,255, 128,255,255,255]);
const image={data:pixels,width:2,height:2},out=new T.Vector3();
const sampler=makeSampler(image,new T.Matrix3(),true,new T.Vector2(.6,.6));sampler(.25,-.25,out);
const expected=new T.Vector3(.6,1,-.6/255).normalize();near(out.distanceTo(expected),0,1e-10,'Canvas flipY and actual +X/-Z pool tangent basis');
const raw=makeSampler(image,new T.Matrix3(),false,new T.Vector2(.6,.6));raw(.25,-.25,out);check(out.x<.01,'raw DataTexture row orientation preserved');
const unit=makeGain(flat);check(!!unit,'flat transport produces a neutral gain map');for(let i=0;i<unit.data.length;i+=4)near(unit.data[i],1,1e-6,'flat normal map cannot add a cellular brightness pattern');
const gain=makeGain(waves);check(!!gain,'real ripple transport produces bounded gain');let beforeFlux=0,afterFlux=0,minGain=1,maxGain=1;
for(let i=0;i<waves.flat.density.length;i++)if(gain.data[i*4+1]){const r=gain.data[i*4];check(Number.isFinite(r)&&r>=0&&r<=4,'finite capped HDR modulation');beforeFlux+=waves.refracted.density[i];afterFlux+=waves.flat.density[i]*r;minGain=Math.min(minGain,r);maxGain=Math.max(maxGain,r);}
near(afterFlux,beforeFlux,.005,'bounded gain preserves transported energy on supported floor cells');check(minGain<.95&&maxGain>1.05,'real focusing has darker and brighter regions rather than a uniform energy lift');
console.log(JSON.stringify({status:'PASS',checks,gainRange:[minGain,maxGain],scope:'actual texture/TBN/flip orientation plus bounded, mean-energy-preserving focusing ratio; native GPU/image gate remains open'}));
