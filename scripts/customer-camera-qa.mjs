/** Current contextual camera checks using actual customer controls. */
import { readFile } from 'node:fs/promises';
const source=await readFile('scripts/fullscreen-browser-qa.mjs','utf8');
let base=source.slice(0,source.indexOf('\ntry {\n  if (mode')).replace('resolve("docs/fullscreen-qa-evidence")','resolve("docs/fullscreen-qa-evidence/customer-cameras")').replace('page.setDefaultTimeout(15000)','page.setDefaultTimeout(45000)').replace('if (expireToast) {','if (false) {');
for(const name of ['playwright','rolldown'])base=base.replace('from "'+name+'"','from "'+import.meta.resolve(name)+'"');
const run=`
const pick=async(page,group,title)=>{const b=page.getByRole('group',{name:group,exact:true}).getByRole('button',{name:new RegExp('^'+title)}).first();await b.waitFor();if(await b.getAttribute('aria-pressed')!=='true')await b.click();await page.waitForTimeout(700);};
try{
for(const width of process.env.QA_WIDTH?[Number(process.env.QA_WIDTH)]:[1440,390,430]){
 const {context,page}=await open(fixture(),{width,height:width===390?844:width===430?932:900},url,false);
 await page.route('**/*',route=>route.request().method()==='POST'?route.abort():route.continue());
 const shot=async name=>{await page.waitForTimeout(700);await record(page,width+'-'+name);};
 try{
  if(!process.env.QA_CAMERA_TAIL){
  await phase(page,'Sistema acqua');await tab(page,'Modello skimmer');await shot('skimmer-entry');
  assert.equal(await page.locator('canvas').getAttribute('data-camera-focus'),'skimmer-detail');
  await tab(page,'Sistema');await pick(page,'Sistema idraulico','Sfioro');await tab(page,'Tipo di sfioro');
  await pick(page,'Tipo di sfioro','Sfioro a griglia');await shot('grille');await pick(page,'Tipo di sfioro','Sfioro nascosto');await shot('hidden');
  await tab(page,'Sistema');await pick(page,'Sistema idraulico','Skimmer');
  await phase(page,'Accesso & comfort');await pick(page,'Tipo di scala interna','Angolare');await shot('corner-stair');
  await pick(page,'Tipo di scala interna','Rettilinea');await shot('straight-stair');
  await pick(page,'Accesso alla piscina','Scaletta inox');await shot('inox-ladder');
  await page.getByRole('group',{name:'Accesso alla piscina',exact:true}).getByRole('button',{name:/^Scaletta inox/}).click();
  await tab(page,'Comfort in acqua');await pick(page,'Zona comfort','Sun shelf');await shot('shelf');
  await pick(page,'Zona comfort','Idromassaggio A');await shot('hydro-A');await pick(page,'Zona comfort','Idromassaggio B');await shot('hydro-B');
  await phase(page,'Finiture');await pick(page,'Rivestimento interno','Mosaico');await shot('mosaic');
  await pick(page,'Rivestimento interno','Liner / PVC');await shot('liner');
  await page.locator('.pool-dock-continue').click();await page.waitForTimeout(400);
  await tab(page,'Colore LED');
  for(const color of ['Rosso','Blu','Bianco']){await page.getByRole('button',{name:color==='Bianco'?'Bianco':'LED '+color,exact:true}).click();await shot('led-'+color);}
  }
  await phase(page,'Esterno');await pick(page,'Materiale del bordo','Deck Marrone');await shot('coping-brown');
  await tab(page,'Pavimentazione');await shot('paving');
  await phase(page,'Optional');await pick(page,'Optional esterni','Copertura automatica');await shot('cover');
  await phase(page,'Presentazione');await shot('presentation');
  const technical=page.getByRole('button',{name:'Vista tecnica',exact:true});
  if(await technical.count())await technical.click();
  else {await page.getByRole('button',{name:'Altri strumenti',exact:true}).click();await page.getByRole('menuitem',{name:'Vista tecnica',exact:true}).click();}
  await shot('technical-panel');
  await page.getByRole('button',{name:'Vista della piscina',exact:true}).click();
  await page.getByRole('menuitem',{name:'Dall’alto',exact:true}).click();
  await shot('technical-top');
  assert.equal(await page.locator('canvas').getAttribute('data-camera-projection'),'orthographic');
 }finally{await context.close();}
}
assert.equal(errors.length,0);
}catch(error){results.push({error:String(error)});console.error(String(error));process.exitCode=1;}
finally{clearTimeout(watchdog);await browser.close();await persist();}
`;
await import('data:text/javascript;base64,'+Buffer.from(base+run).toString('base64'));
