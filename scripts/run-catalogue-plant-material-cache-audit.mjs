import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {resolve,dirname} from 'node:path';import {createRequire} from 'node:module';import vm from 'node:vm';
const root=process.cwd(),require=createRequire(root+'/package.json'),T=require('three'),ts=require('typescript');let slots=[],index=0,pending=[];
const same=(a,b)=>a&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
const hooks={useMemo(fn,deps){const i=index++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={value:fn(),deps};return slots[i].value;},useRef(value){const i=index++;return(slots[i]??={value:{current:value}}).value;},useEffect(fn,deps){const i=index++;if(!slots[i]||!same(slots[i].deps,deps))pending.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
const scene=new T.Group(),borrowedMap=new T.Texture();let borrowedDisposals=0;
for(const name of ['tree','shrub']){const group=new T.Group();group.name=name;const material=new T.MeshStandardMaterial({map:borrowedMap});material.name=name==='tree'?'tree_small_02_leaves':'evergreen_twigs';material.addEventListener('dispose',()=>borrowedDisposals++);group.add(new T.Mesh(new T.BoxGeometry(1,2,1),material));scene.add(group);}
const asset={scene},alpha=[new T.Texture(),new T.Texture()],outside=new T.Texture(),modules=new Map();
function load(file){file=resolve(file);if(modules.has(file))return modules.get(file);const box={exports:{}};modules.set(file,box.exports);const req=name=>{
 if(name==='react')return hooks;if(name==='@react-three/fiber')return{useFrame(){},useThree:fn=>fn({gl:{capabilities:{getMaxAnisotropy:()=>8}}}),useLoader:(_loader,url)=>typeof url!=='string'?alpha:url.endsWith('.glb')?asset:outside};
 if(name.startsWith('three/addons/loaders/')||name.includes('meshopt_decoder'))return{};
 if(name.startsWith('@/')||name.startsWith('.')){let p=name.startsWith('@/')?resolve(root,'src',name.slice(2)):resolve(dirname(file),name);return load(p+(existsSync(p+'.ts')?'.ts':'.tsx'));}return require(name);};
 vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:box.exports,require:req,console});return box.exports;}
const {CataloguePlants}=load('src/components/pool/three/CataloguePlants.tsx');
const firstPlan={indoor:true,ground:0,trees:[[0,0,1]],shrubs:[[2,0,1]]},secondPlan={...firstPlan,trees:[[1.5,0,1]],shrubs:[[3.5,0,1]]};
const render=plan=>{index=0;pending=[];const view=CataloguePlants({plan,night:false,photoMode:false,waterY:0});pending.forEach(fn=>fn());return view.props.children.map(child=>child.props.object);};
const a=render(firstPlan),oldMaterials=a.map(m=>m.material),oldMatrix=a[0].instanceMatrix.array.slice();let clonedDisposals=0;oldMaterials.forEach(m=>m.addEventListener('dispose',()=>clonedDisposals++));
const b=render(secondPlan);assert(b[0].material===oldMaterials[0],'context placement changes must retain identical plant materials and their GPU programs');assert.equal(clonedDisposals,0);assert.notDeepEqual(b[0].instanceMatrix.array,oldMatrix,'actual metric placement matrices still update');
for(let i=0;i<4;i++)assert.equal(render(i%2?firstPlan:secondPlan)[0].material,oldMaterials[0]);
const c=render({...secondPlan,indoor:false});assert.notEqual(c[0].material,oldMaterials[0],'outdoor environment semantics require new materials');assert.equal(clonedDisposals,oldMaterials.length);assert.equal(borrowedDisposals,0);
slots.forEach(s=>s?.cleanup?.());assert.equal(borrowedDisposals,0,'source materials stay borrowed on final cleanup');assert.equal(scene.children[0].children[0].material.map,borrowedMap);
scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});borrowedMap.dispose();alpha.forEach(a=>a.dispose());outside.dispose();
console.log(JSON.stringify({status:'PASS',scope:'Actual CataloguePlants hooks/Three instances: stable materials/maps/program owners across metric placement changes and repeated contexts; outdoor invalidation, exact owned cleanup and borrowed-source preservation.'}));
