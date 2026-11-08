import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const root=process.cwd();
const native=createRequire(root+'/package.json');
const ts=native('typescript'), React=native('react');
const {renderToStaticMarkup}=native('react-dom/server');
const cache=new Map();
function load(path,overrides={}) {
 const file=resolve(root,path);if(cache.has(file)&&!Object.keys(overrides).length)return cache.get(file).exports;
 const module={exports:{}};if(!Object.keys(overrides).length)cache.set(file,module);
 const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const require=id=>Object.hasOwn(overrides,id)?overrides[id]:id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):id.startsWith('@/')?load(id.slice(2)+'.ts'):native(id);
 runInNewContext(js,{exports:module.exports,module,require,console});return module.exports;
}
const {configuredOutline}=load('src/lib/pool/configured-outline.ts');
const {DEFAULT_DIMENSIONS,DEFAULT_CONTROL_POINTS}=load('src/lib/pool/config.ts');
const {catalogueIndoorAvailable:available,resolveCatalogueSetting:resolveSetting}=load('src/lib/pool/catalogue-availability.ts');
let checks=0;
const eq=(a,b,why)=>{checks++;assert.equal(a,b,why);};
const base={shape:'rectangle',dimensions:DEFAULT_DIMENSIONS,controlPoints:DEFAULT_CONTROL_POINTS,poolType:'in-ground',system:'overflow',overflowType:'continuous',copingStyle:'dedicated',copingEdge:'rounded'};
for(const shape of ['rectangle','l-shape'])for(const [length,width,expected]of[[12,6,true],[6,12,true],[12.1,6,false],[12,6.1,false]]) {
 const p=configuredOutline({...base,shape,dimensions:{...DEFAULT_DIMENSIONS,length,width,lShapeRecessLength:1.5,lShapeRecessWidth:1.5}});
 eq(available(p),expected,`${shape} actual configured outline ${length}x${width}`);
}
for(const rounding of ['skimmer','dedicated']){
 const p=configuredOutline({...base,system:rounding==='skimmer'?'skimmer':'overflow',dimensions:{...DEFAULT_DIMENSIONS,length:12,width:6}});
 eq(p.length>4,true,'Actual rounded pool perimeter is exercised');eq(available(p),true,'Roundover tangencies preserve inclusive dimensional cap');
}
const controls=[[-.5,-.5],[.5,-.5],[.5,0],[0,0],[0,.5],[-.5,.5]];
for(const [length,width,expected]of[[12,6,true],[12.1,6,false]])eq(available(configuredOutline({...base,shape:'custom',controlPoints:controls,dimensions:{...DEFAULT_DIMENSIONS,length,width}})),expected,'Canonical custom outline is measured in actual metres');
const button=load('src/components/ui/button.tsx',{'@/lib/utils':{cn:(...args)=>args.filter(Boolean).join(' ')}});
const {PresentationContextPicker}=load('src/components/pool/PresentationContextPicker.tsx',{'@/components/ui/button':button,'@/lib/i18n':{useI18n:()=>({t:s=>s})}});
for(const stale of ['spa-wall','spa-glass']){
 const html=renderToStaticMarkup(React.createElement(PresentationContextPicker,{choice:{value:stale,infinity:false,indoorAvailable:false,onChange:()=>{throw new Error('Unexpected selection during render');}}}));
 const buttons=[...html.matchAll(/<button\b([^>]*)>(Spa[^<]*)<\/button>/g)];eq(buttons.length,2,'Stale selected spa remains visible with the other option');
 for(const [,attrs]of buttons){eq(attrs.includes('disabled=""'),true,'Stale indoor button uses native disabled');eq(attrs.includes('aria-pressed="false"'),true,'Stale disabled button is not presented as active');}
 eq(resolveSetting(stale,false,false),'garden','Derived fallback is immediately the visible outdoor garden');
 eq(resolveSetting('garden',false,true),'garden','Availability recovery does not reselect an indoor room');
}
console.log(JSON.stringify({status:'PASS',checks,scope:'Canonical outline and stale-picker supplement only; no real DOM input, GPU, or visual acceptance',fixture:import.meta.url}));
