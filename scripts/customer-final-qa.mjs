/** Remaining real-browser checks; synthetic fixtures, network writes blocked. */
import { readFile } from 'node:fs/promises';
const source = await readFile('scripts/fullscreen-browser-qa.mjs', 'utf8');
let base = source.slice(0, source.indexOf('\ntry {\n  if (mode'))
  .replace('resolve("docs/fullscreen-qa-evidence")', 'resolve("docs/fullscreen-qa-evidence/customer-final")')
  .replace('page.setDefaultTimeout(15000)', 'page.setDefaultTimeout(45000)');
if (['performance-active','comparison'].includes(process.argv[2])) base = base.replace('headless: false', 'headless: false, args: ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"]');
for (const name of ['playwright', 'rolldown']) base = base.replace('from "'+name+'"', 'from "'+import.meta.resolve(name)+'"');
const run = `
try {
 if (mode === 'comparison') {
  for(const port of [3002,3003]){
   const {context,page}=await open(fixture(),{width:1440,height:900},'http://127.0.0.1:'+port+'/');
   await page.bringToFront();await page.waitForTimeout(4000);
   for(let i=0;i<2;i++)await record(page,'comparison-'+port+'-'+i,true);
   await context.close();
  }
 } else if (mode.startsWith('performance')) {
  const {context,page}=await open();
  await phase(page,'Presentazione'); await dock(page,false);
  await page.bringToFront();
  await page.waitForTimeout(4000);
  for(let i=0;i<3;i++)await record(page,'current-performance-'+i,true);
  await context.close();
 } else {
  for(const width of [1440,390,430]) {
   const {context,page}=await open(fixture([{type:'setPoolType',value:'above-ground'},{type:'setPoolStructure',value:'modular-steel-panels'}]),{width,height:width===390?844:width===430?932:900});
   await page.route('**/*',r=>r.request().method()==='POST'?r.abort():r.continue());
   await phase(page,'Finiture');await tab(page,'Pannelli esterni');await choice(page,'Pannelli esterni','WPC');await record(page,width+'-panels-wpc');
   await phase(page,'Accesso & comfort');await choice(page,'Accesso alla piscina','Scala esterna di accesso');
   for(const side of ['Lato corto','Lato lungo']){await choice(page,'Posizione scala esterna',side);await record(page,width+'-external-'+side.replace(' ','-'));}
   await page.getByRole('group',{name:'Accesso alla piscina',exact:true}).getByRole('button',{name:/^Scala esterna di accesso/}).click();
   await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('pool-shaper:project-draft:v1')).config.features.includes('externalStaircase'));
   assert(!(await scene(page)).draft.features.includes('externalStaircase'));
   await phase(page,'Optional');await choice(page,'Optional esterni','Pellicano');await record(page,width+'-pellicano-on');
   await page.getByRole('group',{name:'Optional esterni',exact:true}).getByRole('button',{name:/^Pellicano/}).click();
   await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('pool-shaper:project-draft:v1')).config.equipment.includes('pellicano'));
   assert(!(await scene(page)).draft.equipment.includes('pellicano'));await record(page,width+'-pellicano-off');
   await context.close();
  }
 }
 assert.equal(errors.length,0);
}catch(error){results.push({error:String(error)});console.error(String(error));process.exitCode=1;}
finally{clearTimeout(watchdog);await browser.close();await persist();}
`;
await import('data:text/javascript;base64,'+Buffer.from(base+run).toString('base64'));
