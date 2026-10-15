/** Real browser/server/cloud roundtrip, synthetic QA only; no notification credentials. */
import { chromium } from 'playwright';
import { build } from 'rolldown';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const env=parseEnv(await readFile('.env.local','utf8'));
assert.equal(env.SUPABASE_URL,'https://waetxxqdlsuanqescuye.supabase.co');
assert(env.SUPABASE_SERVICE_ROLE_KEY,'server credential missing');
assert(!env.RESEND_API_KEY&&!process.env.RESEND_API_KEY,'QA never sends real emails');
const kind=process.argv[2]??'skimmer',width=Number(process.env.QA_WIDTH??1440);
const viewport={width,height:width===390?844:width===430?932:900};
const renovation=kind.startsWith('renovation');
const out=resolve('docs/fullscreen-qa-evidence/customer-cloud',kind==='skimmer'&&width===1440?'':kind+'-'+width),cache=resolve('node_modules/.cache/customer-cloud');
await mkdir(out,{recursive:true});
await build({input:['scripts/backend-fixtures.ts','src/lib/project-delivery/client.ts','src/lib/project-delivery/service.ts'],platform:'node',resolve:{alias:{'@':resolve('src')}},output:{dir:cache,format:'esm'},external:['react','react/jsx-runtime','three']});
const {backendFixture}=await import(pathToFileURL(`${cache}/backend-fixtures.js`).href);
const {projectSnapshotFingerprint}=await import(pathToFileURL(`${cache}/client.js`).href);
const {shareableProject}=await import(pathToFileURL(`${cache}/service.js`).href);
const rows=async(table,query)=>{
 const response=await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`}});
 assert(response.ok,`QA verification unavailable (${response.status})`);return response.json();
};
const browser=await chromium.launch({channel:'chrome',headless:false});
const results=[],errors=[];
const context=await browser.newContext({viewport,permissions:['clipboard-read','clipboard-write'],acceptDownloads:true,reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',error=>errors.push(error.message));
const ready=async p=>{await p.locator('canvas').waitFor();await p.waitForTimeout(2200);await p.mouse.move(1,1);};
const phase=async(p,name)=>{const button=p.getByRole('navigation',{name:'Fasi della configurazione'}).getByRole('button',{name:new RegExp(name)});await button.scrollIntoViewIfNeeded();await button.click();await p.waitForTimeout(500);};
const summary=async p=>{await phase(p,renovation?'Riepilogo':'Presentazione');if(await p.locator('.pool-dock-toggle').getAttribute('aria-expanded')!=='true')await p.locator('.pool-dock-toggle').click();if(!renovation)await p.getByRole('tab',{name:'Riepilogo',exact:true}).click();};
const draft=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('pool-shaper:project-draft:v1')));
const save=async p=>{await p.getByTestId('delivery-save').click();await p.getByTestId('delivery-project-ref').waitFor();await p.getByTestId('delivery-save').getByText('Salvato',{exact:true}).waitFor();return p.getByTestId('delivery-project-ref').innerText();};
try{
 const fixture=backendFixture(kind==='above'?'C':kind.startsWith('infinity')?'B':'A');
 if(kind==='grille'||kind==='hidden'){fixture.config.system='overflow';fixture.config.overflowType=kind==='grille'?'visible':'hidden';}
 if(kind==='infinity-glass')fixture.config.infinityEdge={...fixture.config.infinityEdge,enabled:true,side:0,wallType:'glass'};
 if(kind==='sunshelf'){
  fixture.config.dimensions={...fixture.config.dimensions,length:12,width:5};
  fixture.config.features=['sunShelf','sunShelfLoungers','ledLighting'];
  fixture.config.sunShelfLoungerCount=2;
  fixture.config.internalStairType='linear';
  fixture.config.equipment=['loungers'];
 }
 if(renovation){
  fixture.config.projectType='renovation';fixture.config.finish=kind.endsWith('mosaic')?'mosaic':'liner';
  fixture.config.customer={...fixture.config.customer,name:'QA',surname:'Cliente',email:'pool-shaper-qa@example.com',phone:'+39 000 0000000',city:'Test locale',country:'Italia'};
  fixture.renovation={areas:['interiorFinish'],currentFinish:'liner',filtrationWorks:[],replaceCoping:null,copingMaterial:'',structureIssues:[],equipmentUpgrades:[],existing:{poolType:'in-ground',structure:'reinforced-concrete',system:'skimmer',finish:'liner',linerColor:fixture.config.linerColor,mosaicFinish:fixture.config.mosaicFinish,copingMaterial:'travertine',poolAccess:'internalSteps',internalStairType:'corner'}};
 }
 await page.addInitScript(project=>{if(!localStorage.getItem('pool-shaper:project-draft:v1'))localStorage.setItem('pool-shaper:project-draft:v1',JSON.stringify(project));},fixture);
 await page.goto('http://127.0.0.1:3003/',{waitUntil:'domcontentloaded'});await ready(page);await summary(page);
 const source=await save(page);results.push({step:'save',source});console.log(JSON.stringify({step:'save',source}));
 const saved=(await rows('projects',`public_ref=eq.${source}&select=project_id,snapshot`))[0];
 assert(saved,'real persisted row');
 if(kind==='sunshelf'){
  assert.equal(saved.snapshot.config.sunShelfLoungerCount,2);
  assert(saved.snapshot.config.features.includes('sunShelfLoungers'));
  assert(saved.snapshot.config.equipment.includes('loungers'));
 }
 assert.equal(projectSnapshotFingerprint(shareableProject(await draft(page))),projectSnapshotFingerprint(saved.snapshot));
 await page.reload({waitUntil:'domcontentloaded'});await ready(page);await summary(page);
 assert(!(await page.getByTestId('project-delivery').innerText()).includes('modifiche non salvate'),'clean reload remains clean');
 if(kind==='skimmer'){
  await phase(page,'Esterno');
  await page.getByRole('group',{name:'Materiale del bordo',exact:true}).getByRole('button',{name:/^Deck Marrone/}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pool-shaper:project-draft:v1')).config.copingMaterial==='deck-marrone');
 }else {
  const target=fixture.config.sceneTime==='night'?'day':'night';
  await page.getByRole('group',{name:'Ora della scena'}).getByRole('button',{name:target==='day'?'Giorno':'Notte',exact:true}).click();
  await page.waitForFunction(target=>JSON.parse(localStorage.getItem('pool-shaper:project-draft:v1')).config.sceneTime===target,target);
 }
 const edited=await draft(page);
 await page.reload({waitUntil:'domcontentloaded'});await ready(page);await summary(page);
 assert.equal(projectSnapshotFingerprint(await draft(page)),projectSnapshotFingerprint(edited),'owner reload preserves newer local changes');
 assert((await page.getByTestId('project-delivery').innerText()).includes('modifiche non salvate'),'real unsaved state retained');
 await page.getByTestId('delivery-share').click();await page.getByTestId('delivery-share').getByText('Link copiato',{exact:true}).waitFor();
 const url=await page.evaluate(()=>navigator.clipboard.readText());
 assert.equal(new URL(url).searchParams.get('p'),source);
 const updated=(await rows('projects',`public_ref=eq.${source}&select=project_id,snapshot`))[0];
 assert.equal(projectSnapshotFingerprint(updated.snapshot),projectSnapshotFingerprint(shareableProject(await draft(page))),'Share persists complete edited snapshot');
 results.push({step:'reload-dirty-share',pass:true});
 await page.screenshot({path:resolve(out,'owner-saved.png')});
 const visitor=await browser.newContext({viewport,acceptDownloads:true,reducedMotion:'reduce'}),viewer=await visitor.newPage();viewer.setDefaultTimeout(45000);
 await viewer.goto(url,{waitUntil:'domcontentloaded'});await ready(viewer);await summary(viewer);
 assert((await viewer.getByTestId('project-delivery').innerText()).includes('Sola lettura'));
 const copy=await save(viewer);assert.notEqual(copy,source);
 const copied=(await rows('projects',`public_ref=eq.${copy}&select=project_id,snapshot`))[0];
 assert.notEqual(copied.project_id,updated.project_id);
 assert.equal(projectSnapshotFingerprint(copied.snapshot),projectSnapshotFingerprint(shareableProject({...updated.snapshot,projectId:copied.project_id})));
 if(kind==='sunshelf'){
  assert.equal(copied.snapshot.config.sunShelfLoungerCount,2);
  // Save Copy changes identity; wait for the existing debounced draft writer
  // before comparing a later presentation-only language change.
  await viewer.waitForFunction(id=>JSON.parse(localStorage.getItem('pool-shaper:project-draft:v1')).projectId===id,copied.project_id);
  const beforeLanguage=await draft(viewer);
  assert.equal(projectSnapshotFingerprint(shareableProject(beforeLanguage)),projectSnapshotFingerprint(copied.snapshot));
  await viewer.locator('button[lang="en"]').click();await viewer.waitForTimeout(1200);
  assert.equal(projectSnapshotFingerprint(await draft(viewer)),projectSnapshotFingerprint(beforeLanguage));
  assert((await viewer.getByTestId('project-delivery').innerText()).includes('Saved'));
 }
 const download=viewer.waitForEvent('download',{timeout:120000});await viewer.getByTestId('delivery-pdf').click();
 const pdf=await download;await pdf.saveAs(resolve(out,`Project-Book-${copy}.pdf`));
 const bytes=await readFile(resolve(out,`Project-Book-${copy}.pdf`));assert(bytes.byteLength>10000);assert(bytes.subarray(0,4).toString()==='%PDF');
 if(kind==='sunshelf'){
  assert(bytes.toString('latin1').includes('Materials and finishes'),'Actual downloaded PDF is English');
  assert(bytes.toString('latin1').includes('Sun shelf loungers'),'Loungers included in downloaded PDF');
  await viewer.screenshot({path:resolve(out,'english-summary.png')});
  await viewer.getByRole('tab',{name:'Request a proposal',exact:true}).click();
  await viewer.getByRole('button',{name:'Review your project with a consultant',exact:true}).click();
  const englishDialog=viewer.getByRole('dialog');
  await englishDialog.getByRole('button',{name:'Submit request',exact:true}).click();
  assert(await englishDialog.getByText('Name is required',{exact:true}).isVisible());
  assert(await englishDialog.getByRole('textbox',{name:/^Name/}).isVisible());
  assert(await englishDialog.getByRole('textbox',{name:/^Phone/}).isVisible());
  await viewer.screenshot({path:resolve(out,'english-quote-validation.png')});
  await englishDialog.getByRole('button',{name:'Close',exact:true}).click();
  await viewer.locator('button[lang="it"]').click();await viewer.waitForTimeout(800);
 }
 if(!renovation)await viewer.getByRole('tab',{name:'Richiedi proposta',exact:true}).click();
 await viewer.getByRole('button',{name:'Valuta il progetto con un consulente',exact:true}).click();
 const dialog=viewer.getByRole('dialog');await dialog.getByRole('button',{name:'Invia richiesta',exact:true}).click();
 assert(await dialog.getByText('Il nome è obbligatorio',{exact:true}).isVisible());
 await dialog.getByRole('textbox',{name:/^Nome/}).fill('POOL-SHAPER CUSTOMER QA 20261013');
 await dialog.getByRole('textbox',{name:/^Email/}).fill('pool-shaper-qa@example.com');
 await dialog.getByRole('textbox',{name:/^Telefono/}).fill('+39 000 0000000');
 await dialog.getByRole('textbox',{name:/^Località del progetto/}).fill('QA locale — non contattare');
 await dialog.getByRole('radio').last().click();await dialog.getByLabel('Note (opzionale)',{exact:true}).fill(`CUSTOMER QA ${kind} — no email`);
 await dialog.getByRole('checkbox').first().check();await dialog.getByRole('button',{name:'Invia richiesta',exact:true}).click();
 await dialog.getByText('Progetto inviato',{exact:true}).waitFor();
 const leads=await rows('leads',`project_reference=eq.${copy}&select=request_id,project_id,project_reference,project_configuration,customer_email,notes,status`);
 assert.equal(leads.length,1);assert.equal(leads[0].customer_email,'pool-shaper-qa@example.com');
 assert.equal(leads[0].project_id,copied.project_id);assert.equal(projectSnapshotFingerprint(shareableProject(leads[0].project_configuration)),projectSnapshotFingerprint(copied.snapshot));
 const notification=await rows('lead_notifications',`request_id=eq.${leads[0].request_id}&select=provider_id,state,error_code`);
 assert.equal(notification.length,1);assert.equal(notification[0].provider_id,null);assert.equal(notification[0].error_code,'EMAIL_NOT_CONFIGURED');
 await viewer.screenshot({path:resolve(out,'quote-confirmed.png')});
 results.push({step:'read-only-copy-pdf-quote',source,copy,projectId:copied.project_id,leadPersisted:true,emailSent:false,pdfBytes:bytes.byteLength});await visitor.close();
 // Hold a real read-only load response, start over, then release the response.
 if(kind!=='sunshelf'){
 const delayedContext=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),delayed=await delayedContext.newPage();delayed.setDefaultTimeout(45000);
 let release, interceptedResolve;const hold=new Promise(r=>release=r),intercepted=new Promise(r=>interceptedResolve=r);
 await delayed.route('**/*',async route=>{if(route.request().method()==='POST'){const response=await route.fetch();interceptedResolve();await hold;return route.fulfill({response});}return route.continue();});
 await delayed.goto(url,{waitUntil:'domcontentloaded'});await intercepted;await delayed.getByRole('button',{name:'Ricomincia',exact:true}).click();await delayed.waitForTimeout(1000);
 await delayed.waitForFunction(()=>localStorage.getItem('pool-shaper:project-draft:v1')!==null);
 const fresh=await draft(delayed);release();await delayed.waitForTimeout(2500);assert.equal((await draft(delayed)).projectId,fresh.projectId);assert.notEqual(fresh.projectId,fixture.projectId);assert.equal((await draft(delayed)).config.projectType,null);assert(!new URL(delayed.url()).searchParams.has('p'));
 await delayed.screenshot({path:resolve(out,'reset-late-load-safe.png')});results.push({step:'reset-delayed-load',pass:true});await delayedContext.close();
 }
 assert.equal(errors.length,0);console.log(JSON.stringify({results,errors}));
}catch(error){results.push({error:String(error)});console.error(String(error));for(const [index,p] of browser.contexts().flatMap(c=>c.pages()).entries()){await p.screenshot({path:resolve(out,`failure-${index}.png`)}).catch(()=>{});await writeFile(resolve(out,`failure-${index}.txt`),await p.locator('body').innerText().catch(()=>''));}process.exitCode=1;}
finally{await browser.close();await writeFile(resolve(out,'smoke.json'),JSON.stringify({results,errors},null,2));}
