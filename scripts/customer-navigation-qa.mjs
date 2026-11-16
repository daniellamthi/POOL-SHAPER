import { chromium } from 'playwright';
import { build } from 'rolldown';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const stage = process.argv[2] ?? 'after';
const output = resolve('docs/fullscreen-qa-evidence/customer-navigation');
const cache = resolve('node_modules/.cache/customer-navigation');
await mkdir(output, {recursive:true});
await build({input:['src/lib/pool/store.tsx','src/lib/pool/project.ts'],output:{dir:cache,format:'esm'},platform:'node',resolve:{alias:{'@':resolve('src')}},external:['react','react/jsx-runtime','three','@react-three/fiber','@react-three/drei'],plugins:[{name:'no-rpc',resolveId(id){if(id.endsWith('/projectDelivery.server'))return '\0rpc';},load(id){if(id==='\0rpc')return 'export const loadSharedProjectFn=()=>{throw Error("No fixture RPC")};';}}]});
const {configuratorTesting:{reducer,createInitialState}}=await import(pathToFileURL(`${cache}/store.js`).href);
const {toProjectConfiguration}=await import(pathToFileURL(`${cache}/project.js`).href);
let state=createInitialState();
for(const action of [{type:'setProjectType',value:'new'},{type:'setPoolType',value:'in-ground'},{type:'setPoolStructure',value:'reinforced-concrete'},{type:'setShape',value:'rectangle'},{type:'setDimension',key:'length',value:8},{type:'setDimension',key:'width',value:4},{type:'setPoolAccess',value:'internalSteps'}])state=reducer(state,action);
const project=toProjectConfiguration(randomUUID(),state.config,state.renovation);
const browser=await chromium.launch({channel:'chrome',headless:false});
const results=[];
try{
for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:430,height:932}]){
 const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage();
 page.setDefaultTimeout(30000);
 await page.route('**/*',route=>route.request().method()==='POST'?route.abort():route.continue());
 await page.addInitScript(project=>{if(!localStorage.getItem('pool-shaper:project-draft:v1'))localStorage.setItem('pool-shaper:project-draft:v1',JSON.stringify(project));},project);
 await page.goto('http://127.0.0.1:3003/',{waitUntil:'domcontentloaded'});
 await page.locator('canvas').waitFor();await page.waitForTimeout(2000);
 await page.mouse.move(1,1);
 await page.locator('[data-sonner-toast]').first().waitFor({state:'hidden',timeout:11000});
 const nav=page.getByRole('navigation',{name:'Fasi della configurazione'});
 const system=nav.getByRole('button',{name:/Sistema acqua/});
 await system.scrollIntoViewIfNeeded();
 await system.click();await page.waitForTimeout(500);
 await page.locator('.pool-dock-continue').click();await page.waitForTimeout(200);
 await page.locator('.pool-dock-continue').click();await page.waitForTimeout(200);
 const toggle=page.locator('.pool-dock-toggle');
 if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
 if(stage!=='before'){await toggle.focus();await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'true','only the explicit pool toggle reduces the panel');}
 const snapshot=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pool-shaper:project-draft:v1')).config);
 const before=await snapshot(), samples=[];
 const read=async()=>({heading:await page.locator('.pool-dock-heading').innerText(),expanded:await toggle.getAttribute('aria-expanded'),box:await page.locator('.pool-config-dock').boundingBox()});
 samples.push(await read());
 for(let i=0;i<20;i++){
  await page.getByRole('button',{name:'Indietro',exact:true}).click();await page.waitForTimeout(100);
  await page.locator('.pool-dock-continue').click();await page.waitForTimeout(100);
  samples.push(await read());
 }
 await page.screenshot({path:resolve(output,`${stage}-${viewport.width}-20cycles.png`)});
 const collapsed=samples.some(s=>s.expanded!=='true');
 if(stage!=='before'){
  assert(!collapsed,'navigation must preserve expanded panel');
  assert.deepEqual(await snapshot(),before,'navigation must preserve complete product configuration');
  assert(samples.every(s=>Math.abs(s.box.width-samples[0].box.width)<1&&Math.abs(s.box.height-samples[0].box.height)<1),'repeated cycles keep panel size');
  await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  await page.locator('.pool-dock-continue').click();await page.waitForTimeout(100);
  assert.equal(await toggle.getAttribute('aria-expanded'),'false','manual reduced state persists through Next');
  await page.getByRole('button',{name:'Indietro',exact:true}).click();await page.waitForTimeout(100);
  assert.equal(await toggle.getAttribute('aria-expanded'),'false','manual reduced state persists through Back');
  await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
  await nav.getByRole('button',{name:/Accesso & comfort/}).click();await page.waitForTimeout(200);
  assert.equal(await toggle.getAttribute('aria-expanded'),'true','reopened state persists across phases');
  const initialBox=await page.locator('.pool-config-dock').boundingBox();
  await page.locator('.pool-dock-continue').click();await page.waitForTimeout(150);
  const nextBox=await page.locator('.pool-config-dock').boundingBox();
  assert(Math.abs(initialBox.height-nextBox.height)<1,'different card contents do not shrink the expanded panel');
  await page.screenshot({path:resolve(output,`${stage}-${viewport.width}-reopened.png`)});
 }
 results.push({viewport,cycles:20,collapsed,samples,configurationUnchanged:JSON.stringify(await snapshot())===JSON.stringify(before)});
 await context.close();
}
}finally{await browser.close();await writeFile(resolve(output,`${stage}.json`),JSON.stringify(results,null,2));}
console.log(JSON.stringify(results.map(({viewport,cycles,collapsed,configurationUnchanged})=>({viewport,cycles,collapsed,configurationUnchanged}))));
