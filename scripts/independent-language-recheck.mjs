import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const out=resolve('docs/fullscreen-qa-evidence/independent-gate');
const loaderOnly=process.argv.includes('--loader-only');
const prior=JSON.parse(await readFile(resolve(out,'results.json'),'utf8'));
const fixture=prior.records.find(r=>r.id==='Skimmer-1440-material-live').detail.before.draft;
const browser=await chromium.launch({channel:'chrome',headless:false});
const report={scope:'One Skimmer metadata-language defect recheck; previous feature BLOCKED results unchanged',checks:[],blockedPosts:[],pageErrors:[]};
if(loaderOnly)report.scope='One isolated loading-fallback label check; no navigation replay or change to previous feature results';
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
await context.route('**/*',route=>{if(route.request().method()==='POST'){report.blockedPosts.push(route.request().url());return route.abort();}return route.continue();});
const page=await context.newPage();page.setDefaultTimeout(12000);
page.on('pageerror',error=>report.pageErrors.push(error.message));
await page.addInitScript(p=>{if(!localStorage.getItem('pool-shaper:project-draft:v1'))localStorage.setItem('pool-shaper:project-draft:v1',JSON.stringify(p));},fixture);
async function ui(){return {lang:await page.locator('html').getAttribute('lang'),title:await page.title(),h1:await page.getByRole('heading',{level:1}).allTextContents(),heading:await page.locator('.pool-dock-heading').innerText(),expanded:await page.locator('.pool-dock-toggle').getAttribute('aria-expanded'),draft:await page.evaluate(()=>JSON.parse(localStorage.getItem('pool-shaper:project-draft:v1')))};}
async function check(id,fn){try{report.checks.push({id,status:'PASS',detail:await fn()});}catch(error){report.checks.push({id,status:'FAIL',error:String(error)});}}
let releaseLoader;
try{
 if(loaderOnly){
  const pause=new Promise(done=>{releaseLoader=done;});report.delayedModules=[];let sceneHeld;const held=new Promise(done=>{sceneHeld=done;});
  await page.route('**/*PoolScene.tsx*',async route=>{report.delayedModules.push(route.request().url());sceneHeld();await pause;await route.continue().catch(()=>{});});
  await page.goto(process.env.QA_URL||'http://127.0.0.1:3003/',{waitUntil:'domcontentloaded'});
  await check('loading-fallback-italian',async()=>{await Promise.race([held,page.waitForTimeout(10000).then(()=>{throw Error('No delayed scene module request observed');})]);const loader=page.getByText('Preparazione della scena 3D',{exact:true});await loader.waitFor({state:'visible'});assert(report.delayedModules.length>0,'Scene module deliberately delayed');assert.equal(await page.getByText('Preparing the 3D studio',{exact:true}).count(),0);return {text:await loader.innerText(),moduleDelayed:true};});
  await page.screenshot({path:resolve(out,'loader-recheck.png'),animations:'disabled'});releaseLoader();await page.waitForTimeout(250);
 }else{
 await page.goto(process.env.QA_URL||'http://127.0.0.1:3003/',{waitUntil:'domcontentloaded'});await page.locator('canvas').waitFor({state:'visible'});await page.waitForTimeout(1500);await page.mouse.move(1,1);await page.locator('[data-sonner-toast]').first().waitFor({state:'hidden',timeout:11000}).catch(()=>{});
 report.before=await ui();
 await check('metadata-italian',async()=>{assert.equal(report.before.lang,'it');assert(report.before.h1.includes('Configuratore piscine 3D'));assert(/Configuratore piscine 3D/i.test(report.before.title));return {lang:report.before.lang,title:report.before.title,h1:report.before.h1};});
 await check('panel-navigation-before-reload',async()=>{assert.equal(report.before.expanded,'true');let before=await page.locator('.pool-dock-heading').innerText();await page.locator('.pool-dock-continue').click();await page.waitForTimeout(400);let next=await page.locator('.pool-dock-heading').innerText();assert.notEqual(next,before);assert.equal(await page.locator('.pool-dock-toggle').getAttribute('aria-expanded'),'true');await page.getByRole('button',{name:'Indietro',exact:true}).click();await page.waitForTimeout(400);assert.equal(await page.locator('.pool-dock-heading').innerText(),before);return {before,next,back:await page.locator('.pool-dock-heading').innerText()};});
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('canvas').waitFor({state:'visible'});await page.waitForTimeout(1500);report.after=await ui();
 await check('draft-and-panel-stable-on-reload',async()=>{assert.deepEqual(report.after.draft.config,report.before.draft.config);assert.equal(report.after.heading,report.before.heading);assert.equal(report.after.expanded,report.before.expanded);assert.equal(report.after.lang,'it');assert.equal(report.after.title,report.before.title);return {configUnchanged:true,headingUnchanged:true,expanded:report.after.expanded};});
 await check('panel-navigation-after-reload',async()=>{const before=await page.locator('.pool-dock-heading').innerText();await page.locator('.pool-dock-continue').click();await page.waitForTimeout(400);assert.notEqual(await page.locator('.pool-dock-heading').innerText(),before);assert.equal(await page.locator('.pool-dock-toggle').getAttribute('aria-expanded'),'true');await page.getByRole('button',{name:'Indietro',exact:true}).click();await page.waitForTimeout(400);assert.equal(await page.locator('.pool-dock-heading').innerText(),before);return {nextAndBackWork:true};});
 const cdp=await context.newCDPSession(page);const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await writeFile(resolve(out,'language-recheck.png'),Buffer.from(shot.data,'base64'));await cdp.detach();
 }
}catch(error){report.error=String(error);}finally{releaseLoader?.();await browser.close();await writeFile(resolve(out,loaderOnly?'loader-recheck.json':'language-recheck.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks,blockedPosts:report.blockedPosts,pageErrors:report.pageErrors,error:report.error}));
