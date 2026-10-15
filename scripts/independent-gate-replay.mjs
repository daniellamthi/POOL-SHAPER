// Independent, read-only browser replay. Backend writes are always intercepted.
import { chromium } from 'playwright';
import { build } from 'rolldown';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

if (process.env.QA_ALLOW_BROWSER !== '1') throw Error('Await root VIA BROWSER; set QA_ALLOW_BROWSER=1 only after permission.');
const url = process.env.QA_URL || 'http://127.0.0.1:3003/';
const out = resolve('docs/fullscreen-qa-evidence/independent-gate');
const cache = resolve('node_modules/.cache/independent-gate');
await mkdir(out, { recursive: true });
await build({ input: ['src/lib/pool/store.tsx','src/lib/pool/project.ts'], output:{dir:cache,format:'esm'}, platform:'node', resolve:{alias:{'@':resolve('src')}}, external:['react','react/jsx-runtime','three','@react-three/fiber','@react-three/drei'], plugins:[{name:'no-rpc',resolveId(id){if(id.endsWith('/projectDelivery.server'))return '\0no-rpc';},load(id){if(id==='\0no-rpc')return "export const loadSharedProjectFn=()=>{throw Error('RPC forbidden')};";}}] });
const {configuratorTesting:{reducer,createInitialState}} = await import(pathToFileURL(`${cache}/store.js`));
const {toProjectConfiguration} = await import(pathToFileURL(`${cache}/project.js`));
const seed = [{type:'setProjectType',value:'new'},{type:'setPoolType',value:'in-ground'},{type:'setPoolStructure',value:'reinforced-concrete'},{type:'setShape',value:'rectangle'},{type:'setDimension',key:'length',value:8},{type:'setDimension',key:'width',value:4},{type:'setDimension',key:'depth',value:1.5},{type:'setPoolAccess',value:'internalSteps'}];
function fixture(kind){
 const extra = kind==='Sfioro'?[{type:'setSystem',value:'overflow'},{type:'setOverflowType',value:'hidden'}]:kind==='Infinity'?[{type:'setSystem',value:'infinity'},{type:'setInfinitySide',value:0}]:kind==='FuoriTerra'?[{type:'setPoolType',value:'above-ground'},{type:'setPoolStructure',value:'modular-steel-panels'}]:kind==='Ristrutturazione'?[{type:'setProjectType',value:'renovation'},{type:'setShape',value:'rectangle'},{type:'updateRenovation',value:{areas:['interiorFinish'],existing:{poolType:'in-ground',structure:'reinforced-concrete',system:'skimmer',finish:'liner',linerColor:'motionBlueSky602',copingMaterial:'travertine',poolAccess:'internalSteps',internalStairType:'linear'}}}]:[];
 const customer=Object.entries({name:'QA Independent',email:'independent@example.invalid',phone:'+390000000000',city:'Test',country:'Italia'}).map(([key,value])=>({type:'setCustomerField',key,value}));
 const s=[...seed,...extra,...customer].reduce(reducer,createInitialState());return toProjectConfiguration(randomUUID(),s.config,s.renovation);
}
const records=[],errors=[],blockedPosts=[];
const browser=await chromium.launch({channel:'chrome',headless:false});
const watchdog=setTimeout(()=>void browser.close(),900000);
async function persist(){await writeFile(resolve(out,'results.json'),JSON.stringify({url,scope:'Two independent browser gates; no live cloud rerun',records,errors,blockedPosts},null,2));}
async function snapshot(page){return page.evaluate(async()=>{
 const resource=performance.getEntriesByType('resource').find(e=>e.name.includes('/@react-three_fiber.js'));if(!resource)throw Error('R3F missing');
 const fiber=await import(resource.name),s=fiber._roots.get(document.querySelector('canvas'))?.store.getState();if(!s)throw Error('No live scene');
 const meshes=[],names=[];s.scene.updateMatrixWorld(true);s.camera.updateMatrixWorld(true);
 let points=[];s.scene.traverse(o=>{if(o.name)names.push(o.name);if(!o.geometry)return;const p=o.geometry.attributes.position;
  const materials=(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean).map(m=>({type:m.type,color:m.color?.getHexString(),roughness:m.roughness,map:m.map?.image?.currentSrc||m.map?.image?.src||null}));
  meshes.push({name:o.name,parent:o.parent?.name,vertices:p?.count,materials});
  if(!['plan-basin-walls','plan-coping'].includes(o.name))return;o.geometry.computeBoundingBox();let b=o.geometry.boundingBox;if(!b||b.isEmpty())return;
  for(let x of[b.min.x,b.max.x])for(let y of[b.min.y,b.max.y])for(let z of[b.min.z,b.max.z]){let v=s.camera.position.clone().set(x,y,z).applyMatrix4(o.matrixWorld).project(s.camera);points.push({x:v.x,y:v.y,z:v.z});}
 });
 const canvas=document.querySelector('canvas').getBoundingClientRect(),g=s.gl.getContext(),e=g.getExtension('WEBGL_debug_renderer_info');
 return {draft:JSON.parse(localStorage.getItem('pool-shaper:project-draft:v1')||'{}'),camera:{position:s.camera.position.toArray(),target:s.controls?.target.toArray(),near:s.camera.near,far:s.camera.far},renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):null,contextLost:g.isContextLost(),meshes,names,projection:points,canvas:canvas.toJSON(),overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,heading:document.querySelector('.pool-dock-heading')?.innerText,expanded:document.querySelector('.pool-dock-toggle')?.getAttribute('aria-expanded')};
});}
async function capture(page,name){
 const path=resolve(out,`${name}.png`);await page.screenshot({path,animations:'disabled',timeout:10000}).catch(async()=>{const cdp=await page.context().newCDPSession(page);const result=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await writeFile(path,Buffer.from(result.data,'base64'));await cdp.detach();});return path;
}
async function check(page,id,fn){try{const detail=await fn();const screenshot=await capture(page,id);records.push({id,status:'PASS',detail,screenshot});}catch(error){records.push({id,status:'FAIL',error:String(error),screenshot:await capture(page,`${id}-failure`).catch(()=>null)});}await persist();}
async function blocked(page,id,reason,detail){records.push({id,status:'BLOCKED',reason,detail,screenshot:await capture(page,id)});await persist();}
async function settle(page,ms=1000){await page.waitForTimeout(ms);}
async function dock(page,expanded=true){let t=page.locator('.pool-dock-toggle');if(await t.getAttribute('aria-expanded')!==String(expanded))await t.click();await settle(page,400);}
async function phase(page,label){await page.getByRole('navigation',{name:'Fasi della configurazione'}).getByRole('button',{name:new RegExp(label)}).click();await settle(page);}
async function tab(page,label){await page.getByRole('tab',{name:label,exact:true}).click();await settle(page);}
async function choice(page,group,label){let b=page.getByRole('group',{name:group,exact:true}).getByRole('button',{name:new RegExp(`^${label}`)}).first();await b.click();await settle(page,1400);return b;}
function materials(s){return JSON.stringify(s.meshes.filter(m=>m.name?.includes('basin')||m.name?.includes('stair')).map(m=>m.materials));}
try{
 for(const [kind,width] of [['Skimmer',1440],['Sfioro',1440],['Infinity',1440],['FuoriTerra',1440],['Ristrutturazione',1440],['Skimmer',390],['Infinity',430]]){
  const id=`${kind}-${width}`,context=await browser.newContext({viewport:{width,height:width===1440?900:width===390?844:932},deviceScaleFactor:1,reducedMotion:'reduce'});
  await context.route('**/*',route=>{if(route.request().method()==='POST'){blockedPosts.push({id,url:route.request().url()});return route.abort();}return route.continue();});
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push({id,error:e.message}));
  await page.addInitScript(p=>localStorage.setItem('pool-shaper:project-draft:v1',JSON.stringify(p)),fixture(kind));
  try{
   await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('canvas').waitFor({state:'visible'});await settle(page,2000);await page.mouse.move(1,1);await page.locator('[data-sonner-toast]').first().waitFor({state:'hidden',timeout:11000}).catch(()=>{});await dock(page);
   await check(page,`${id}-next-back-open`,async()=>{await phase(page,kind==='Ristrutturazione'?'Esistente':'Sistema acqua');await dock(page);await page.getByRole('tab').last().click();await settle(page,300);const before=await snapshot(page);let next=page.locator('.pool-dock-continue');assert(await next.isEnabled());await next.click();await settle(page,500);let after=await snapshot(page);assert.equal(after.expanded,'true','Cross-phase Next must keep panel open');assert.notEqual(after.heading,before.heading,'Cross-phase transition');let back=page.getByRole('button',{name:'Indietro',exact:true});assert(await back.isEnabled());await back.click();await settle(page);assert.equal(await page.locator('.pool-dock-toggle').getAttribute('aria-expanded'),'true','Cross-phase Back must keep panel open');return {before:before.heading,next:after.heading,back:(await snapshot(page)).heading};});
   await check(page,`${id}-explicit-collapse`,async()=>{await dock(page,false);assert.equal(await page.locator('.pool-dock-toggle').getAttribute('aria-expanded'),'false');await dock(page,true);assert.equal(await page.locator('.pool-dock-toggle').getAttribute('aria-expanded'),'true');return {collapse:'toggle',reopen:'toggle'};});
   if(kind==='Ristrutturazione'){
    await check(page,`${id}-renovation-subtabs`,async()=>{await phase(page,'Esistente');await dock(page);let tabs=await page.getByRole('tab').allTextContents();assert(tabs.length>=3);for(let t of ['Struttura','Sistema']){const b=page.getByRole('tab',{name:t,exact:true});if(await b.count())await b.click();}await settle(page);return {tabs,scene:await snapshot(page)};});
    await check(page,`${id}-renovation-material`,async()=>{await phase(page,'Proposta');await dock(page);let before=await snapshot(page);let b=await choice(page,'Nuovo rivestimento','Mosaico');assert.equal(await b.getAttribute('aria-pressed'),'true');let after=await snapshot(page);assert.equal(after.draft.config.finish,'mosaic');assert.notEqual(materials(before),materials(after),'Actual scene materials change');return {before,after};});
   }else{
    await check(page,`${id}-system-subtabs`,async()=>{await phase(page,'Sistema acqua');await dock(page);const tabs=await page.getByRole('tab').allTextContents();assert(tabs.length>0);if(kind==='Sfioro'){await tab(page,'Tipo di sfioro');await choice(page,'Tipo di sfioro','Sfioro a griglia');}if(kind==='Infinity'){await tab(page,'Lato Infinity');let side=page.getByRole('group',{name:'Selezione lato Infinity'}).getByRole('button',{name:'Lato 2',exact:true});await side.click();assert.equal(await side.getAttribute('aria-pressed'),'true');await choice(page,'Parete di sfioro Infinity','Parete Infinity in vetro');}await settle(page);const s=await snapshot(page);assert(!s.contextLost);assert.equal(s.draft.config.system,kind==='Infinity'?'infinity':kind==='Sfioro'?'overflow':'skimmer');return {tabs,scene:s};});
    await check(page,`${id}-material-live`,async()=>{await phase(page,'Finiture');await dock(page);const before=await snapshot(page);if(kind!=='FuoriTerra')await choice(page,'Rivestimento interno','Mosaico');else{const group=page.getByRole('group',{name:'Colore liner PVC',exact:true});let buttons=group.getByRole('button');let next=buttons.filter({hasNot:page.locator('[aria-pressed="true"]')});const count=await buttons.count();assert(count>1);for(let n=0;n<count;n++){let b=buttons.nth(n);if(await b.getAttribute('aria-pressed')!=='true'){await b.click();break;}}await settle(page,1400);}const after=await snapshot(page);assert.notEqual(materials(before),materials(after),'Scene material must update');return {before,after};});
    if(kind==='Skimmer'){
     await check(page,`${id}-sunshelf-external-optional`,async()=>{await phase(page,'Accesso & comfort');await dock(page);await tab(page,'Comfort in acqua');await choice(page,'Zona comfort','Sun shelf');const shelf=await snapshot(page);assert(shelf.names.includes('pool-comfort-sunShelf'),'Real SunShelf solid');await phase(page,'Optional');await dock(page);await tab(page,'Esterni');let button=await choice(page,'Optional esterni','Chaise longue');const on=await snapshot(page);assert(on.draft.config.equipment.includes('loungers'));assert(on.names.some(n=>n.startsWith('deck-lounger-')),'Real external lounger meshes');await button.click();await settle(page,1400);const off=await snapshot(page);assert(!off.names.some(n=>n.startsWith('deck-lounger-')));assert(off.names.includes('pool-comfort-sunShelf'),'SunShelf preserved independently');return {shelf,on,off};});
     await blocked(page,`${id}-submerged-sunshelf-loungers`,'No separate submerged SunShelf lounger selection was found; external equipment is a separate row.',{visibleOptions:await page.locator('.pool-dock-options').innerText()});
    }
   }
   await check(page,`${id}-images-icons`,async()=>{const options=page.locator('.pool-dock-options');let images=options.locator('img');const sample=[];for(let n=0;n<Math.min(await images.count(),6);n++){let image=images.nth(n);await image.scrollIntoViewIfNeeded();await image.evaluate(e=>e.decode());sample.push(await image.evaluate(e=>({src:e.currentSrc,width:e.naturalWidth,height:e.naturalHeight})));}const icons=await options.locator('svg').count(),phaseIcons=await page.locator('.pool-phase-nav svg').count();assert(phaseIcons>0);assert(sample.length+icons>0);return {sample,icons,phaseIcons,scope:'Rendered sample images and vector illustrations; image presence does not prove real product photography'};});
   await check(page,`${id}-camera-presentation`,async()=>{const nav=page.getByRole('navigation',{name:'Fasi della configurazione'});let present=nav.getByRole('button',{name:/Presentazione|Riepilogo/}).last();if(await present.isEnabled())await present.click();else throw Error('Presentation unreachable');await dock(page,false);await settle(page,1800);let s=await snapshot(page);assert(!s.contextLost);assert(s.meshes.length>0);assert(!s.overflow,'Fullscreen does not overflow');assert(s.projection.length>0);assert(s.projection.every(p=>Math.abs(p.x)<=1.02&&Math.abs(p.y)<=1.02&&p.z>=-1&&p.z<=1),'Presentation basin is within camera frustum');return s;});
   await check(page,`${id}-recap-delivery-access`,async()=>{await dock(page);let recap=page.getByRole('tab',{name:'Riepilogo',exact:true});if(await recap.count())await recap.click();const controls={};for(let n of ['save','share','pdf']){let b=page.getByTestId(`delivery-${n}`);await b.scrollIntoViewIfNeeded();controls[n]={visible:await b.isVisible(),enabled:await b.isEnabled()};assert(controls[n].visible,`${n} UI reachable`);}return {controls,backend:'Not exercised; previously passed live cloud gate out of replay scope'};});
   await blocked(page,`${id}-it-en`,'An English-language switch is required to replay EN, but none was found in the rendered UI.',{htmlLang:await page.locator('html').getAttribute('lang'),languageControls:await page.getByRole('button',{name:/English|Italiano|Lingua|Language|^EN$|^IT$/}).allTextContents(),body:await page.locator('body').innerText()});
  }catch(error){records.push({id,status:'FAIL',error:String(error),screenshot:await capture(page,`${id}-fatal`).catch(()=>null)});await persist();}
  finally{await context.close();console.log(`Finished ${id}`);}
 }
}finally{clearTimeout(watchdog);await browser.close();await persist();}
console.log(JSON.stringify({counts:records.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),report:resolve(out,'results.json')}));
