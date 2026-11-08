import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const nativeRequire=createRequire(import.meta.url);
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const load=(p,require=nativeRequire)=>runInNewContext(compile(readFileSync(p,'utf8'))+';exports;',{exports:{},require});
assert(existsSync('src/lib/pool/catalogue-availability.ts'),'Outline-based catalogue availability is present');
const {catalogueIndoorAvailable:available,resolveCatalogueSetting:resolve}=load('src/lib/pool/catalogue-availability.ts');
let checks=0;const equal=(a,b,m)=>{checks++;assert.equal(a,b,m);};
const rect=(l,w)=>[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]];
for(const [l,w,expected] of [[3,2,true],[7,3,true],[12,6,true],[6,12,true],[12.1,6,false],[12,6.1,false],[13,3,false],[7,7,false],[25,12,false]])for(const rotated of [false,true]){
 const p=rect(l,w).map(([x,z])=>rotated?[z+37,-x-19]:[x+37,z-19]);equal(available(p),expected,`${l}x${w}, rotated=${rotated}`);
}
for(const p of [[],[[0,0],[1,1]],[[0,0],[1,NaN],[2,0]],[[0,0],[Infinity,1],[2,0]],[[0,0],[0,1],[0,2]]])equal(available(p),false,'Invalid outline cannot enable an indoor context');
for(const [l,w,expected] of [[12,6,true],[12.1,6,false]]){
 const p=rect(l,w);p.splice(2,0,[l/4,0]);equal(available(p),expected,'Custom/L footprint uses full actual bounding dimensions');
}
for(const setting of ['garden','patio','residence','spa-wall','spa-glass','infinity-villa'])for(const infinity of [false,true])for(const indoor of [false,true]){
 const expected=infinity?(setting==='infinity-villa'?'infinity-villa':'garden'):setting==='infinity-villa'||(!indoor&&setting.startsWith('spa-'))?'garden':setting;
 equal(resolve(setting,infinity,indoor),expected,'One resolver covers selection, effective scene and stale settings');
}
const button=load('src/components/ui/button.tsx',id=>id==='@/lib/utils'?{cn:(...v)=>v.filter(Boolean).join(' ')}:nativeRequire(id));
const messages=load('src/lib/i18n/messages.ts',id=>id==='@/lib/pool/reference-finishes'?{REFERENCE_FINISHES:[]}:nativeRequire(id)).messages;
for(const locale of ['it','en'])for(const indoorAvailable of [false,true]){
 const {PresentationContextPicker}=load('src/components/pool/PresentationContextPicker.tsx',id=>id==='@/components/ui/button'?button:id==='@/lib/i18n'?{useI18n:()=>({t:s=>locale==='it'?s:messages.find(([it])=>it===s)?.[1]??s})}:nativeRequire(id));
 const html=renderToStaticMarkup(React.createElement(PresentationContextPicker,{choice:{value:'garden',infinity:false,indoorAvailable,onChange:()=>{throw Error('Rendering must not change selection')}}}));
 const spaButtons=[...html.matchAll(/<button\b([^>]*)>(Spa[^<]*)<\/button>/g)];equal(spaButtons.length,2,'Both indoor choices remain visible');
 for(const [,attrs] of spaButtons){equal(attrs.includes('disabled=""'),!indoorAvailable,'Native disabled state follows eligibility');if(!indoorAvailable)assert(attrs.includes('aria-describedby='));}
 equal(html.includes(locale==='it'?'SPA disponibili fino a 12 × 6 m inclusi.':'SPA settings are available for pools up to and including 12 × 6 m.'),!indoorAvailable,'Localized reason is visible beyond cap');
}
console.log(JSON.stringify({checks,status:'PASS',limit:'12x6m inclusive; actual basin bbox; no engineering/performance certification'}));
