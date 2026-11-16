/** Real UI navigation from a blank project. Local fixtures only; POSTs blocked. */
import { readFile } from 'node:fs/promises';
const source=await readFile('scripts/fullscreen-browser-qa.mjs','utf8');
let base=source.slice(0,source.indexOf('\ntry {\n  if (mode'))
 .replace('resolve("docs/fullscreen-qa-evidence")','resolve("docs/fullscreen-qa-evidence/customer-journeys")')
 .replace('page.setDefaultTimeout(15000)','page.setDefaultTimeout(45000)')
 .replace('if (expireToast) {','if (false) {');
for(const name of ['playwright','rolldown'])base=base.replace(`from "${name}"`,`from "${import.meta.resolve(name)}"`);
const run=`
const cases = process.env.QA_JOURNEYS?.split(',') ?? ['skimmer','grille','hidden','infinity','above','renovation-liner','renovation-mosaic','mobile390','mobile430'];
const pressedChoice=async(page,group,pattern)=>{
 const buttons=page.getByRole('group',{name:group,exact:true}).getByRole('button',{name:pattern});
 if(await buttons.count()){
  const button=buttons.first();
  for(let attempt=0;attempt<3&&await button.count()&&await button.getAttribute('aria-pressed')!=='true';attempt++){
   await button.click();await page.waitForTimeout(300);
  }
  if(await button.count())assert.equal(await button.getAttribute('aria-pressed'),'true','choice accepted: '+group);
 }
};
try{
 for(const kind of cases){
  const width=kind==='mobile390'?390:kind==='mobile430'?430:1440;
  const initial=createInitialState();
  const blank=toProjectConfiguration(randomUUID(),initial.config,initial.renovation);
  const {context,page}=await open(blank,{width,height:width===390?844:width===430?932:900},url,false);
  await page.route('**/*',route=>route.request().method()==='POST'?route.abort():route.continue());
  const trail=[],screenshots=[];
  try{
   await pressedChoice(page,'Tipo di progetto',kind.startsWith('renovation')?/Ristrutturazione/:/Nuova/);
   if(kind.startsWith('renovation'))await page.getByRole('navigation',{name:'Fasi della configurazione'}).getByRole('button',{name:/Interventi/}).waitFor();
   const captured=new Set();
   for(let i=0;i<45;i++){
    const heading=await page.locator('.pool-dock-heading').innerText();
    if(kind==='above')await pressedChoice(page,'Tipo di piscina',/fuori terra/i);
    else await pressedChoice(page,'Tipo di piscina',/interrata/i);
    if(kind.startsWith('renovation')){
     await pressedChoice(page,'Interventi di ristrutturazione',/Rivestimento/);
     await pressedChoice(page,'Installazione esistente',/^Interrata/);
     await pressedChoice(page,'Struttura esistente',/^Calcestruzzo/);
     await pressedChoice(page,'Sistema idraulico esistente',/^Skimmer/);
     await pressedChoice(page,'Rivestimento esistente',/^Liner/);
     await pressedChoice(page,'Liner del catalogo',/Blue Sky/);
     await pressedChoice(page,'Nuovo rivestimento',kind.endsWith('mosaic')?/^Mosaico/:/^Liner/);
     for(const [label,value] of [['Nome','QA'],['Cognome','Cliente'],['Email','pool-shaper-qa@example.com'],['Telefono','+39 000 0000000'],['Località intervento','Test locale'],['Paese','Italia']]){
      const field=page.getByRole('textbox',{name:new RegExp('^'+label)});
      if(await field.count()&&await field.first().isVisible()&&!await field.first().inputValue())await field.first().fill(value);
     }
    }
    if(kind==='grille'||kind==='hidden'){
     await pressedChoice(page,'Sistema idraulico',/^Sfioro/);
     await pressedChoice(page,'Tipo di sfioro',kind==='grille'?/^Sfioro a griglia/:/^Sfioro nascosto/);
    }
    if(kind==='infinity')await pressedChoice(page,'Sistema idraulico',/^Infinity/);
    const next=page.locator('.pool-dock-continue');
    if(await next.isDisabled()){
     const groups=page.locator('.pool-dock-options [role="group"]');
     for(let g=0;g<await groups.count();g++){
      const group=groups.nth(g);
      if(await group.locator('button[aria-pressed="true"]').count())continue;
      const available=group.locator('button[aria-pressed="false"]:not([disabled])');
      if(await available.count())await available.first().click();
     }
     await page.waitForTimeout(120);
    }
    const current=await page.locator('.pool-dock-heading').innerText();
    trail.push(current);
    assert.equal(await page.locator('.pool-dock-toggle').getAttribute('aria-expanded'),'true','panel remains open throughout customer flow');
    assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),'no horizontal overflow');
    const phaseId=current.match(/Fase\\s+(\\d+)/i)?.[1];
    if((kind==='skimmer'&&!captured.has(phaseId)) || /Riepilogo/.test(current)){
     captured.add(phaseId);screenshots.push(await capture(page,kind+'-'+i));
    }
    if((kind.startsWith('renovation')&&/Riepilogo/.test(current))||(!kind.startsWith('renovation')&&/Richiedi proposta/.test(current)))break;
    assert(!await next.isDisabled(),'required choice unresolved at '+current);
    await next.click();await page.waitForTimeout(200);
    assert.notEqual(await page.locator('.pool-dock-heading').innerText(),current,'Continue advances '+current);
   }
   await page.waitForTimeout(1500);
   const snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('pool-shaper:project-draft:v1')));
   assert.equal(snapshot.config.projectType,kind.startsWith('renovation')?'renovation':'new','correct customer workflow persisted');
   if(!kind.startsWith('renovation'))assert.equal(snapshot.config.poolType,kind==='above'?'above-ground':'in-ground','correct installation persisted');
   if(['grille','hidden'].includes(kind)){assert.equal(snapshot.config.system,'overflow');assert.equal(snapshot.config.overflowType,kind==='grille'?'visible':'hidden');}
   if(kind==='infinity')assert.equal(snapshot.config.system,'infinity');
   results.push({kind,width,trail,screenshots,projectType:snapshot.config.projectType,poolType:snapshot.config.poolType,system:snapshot.config.system,finish:snapshot.config.finish});
   await persist();console.log(JSON.stringify({kind,width,decisions:trail.length,last:trail.at(-1)}));
  }catch(error){results.push({kind,error:String(error),screenshot:await capture(page,kind+'-failure')});await persist();throw error;}
  finally{await context.close();}
 }
 assert.equal(errors.length,0,'no runtime errors');
}catch(error){console.error(String(error));process.exitCode=1;}
finally{clearTimeout(watchdog);await browser.close();await persist();}
`;
await import('data:text/javascript;base64,'+Buffer.from(base+run).toString('base64'));
