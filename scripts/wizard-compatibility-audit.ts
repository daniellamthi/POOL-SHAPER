import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {configuratorTesting} from '@/lib/pool/store';
import {configuredPoolLayout} from '@/lib/pool/resolved-layout';
import {STEPS} from '@/lib/pool/config';
import {configuredInternalStairSides} from '@/lib/pool/internal-stair-options';
import {AccessPlanPreview} from '@/components/pool/AccessPlanPreview';
import {focusForAction} from '@/lib/pool/contextual-camera';
import {translateText} from '@/lib/i18n';
{
const initial=configuratorTesting.createInitialState();
const base={...initial.config,projectType:'new',poolType:'in-ground',structure:'reinforced-concrete',shape:'rectangle',shapeSelected:true,poolAccess:'internalSteps',system:'skimmer',features:['sunShelf'],internalStairType:'corner',dimensions:{...initial.config.dimensions,length:10,width:5,depth:1.5,floorProfile:'flat'}} as any;
const access=STEPS.findIndex(s=>s.id==='access');
const invalid={...base,dimensions:{...base.dimensions,length:25,width:4.5}};
assert.equal(configuratorTesting.accessSelectionComplete(invalid),false,'Live gate blocks retained capacity conflict');
assert.equal(configuratorTesting.accessSelectionComplete(base),true,'Live gate accepts valid shelf');
const p=configuredPoolLayout(invalid);
assert(p.comfort.elements.some(e=>e.kind==='sunShelf')&&!p.comfort.availability.sunShelf.available,'actual retained-invalid fixture');
assert.equal(configuratorTesting.firstIncompleteStepIndex(invalid,initial.renovation),access,'Restoring an invalid retained shelf must stop at Access');
assert.equal(configuratorTesting.firstIncompleteStepIndex(base,initial.renovation),STEPS.length-1,'valid shelf still completes');
for(const mirrored of [false,true]) for(const type of ['linear','corner']){
 const c={...base,internalStairType:type,internalStairMirrored:mirrored};
 assert.equal(configuratorTesting.firstIncompleteStepIndex(c,initial.renovation),STEPS.length-1,'valid SX/DX flights complete');
}
assert.equal(configuratorTesting.firstIncompleteStepIndex({...base,features:[],poolAccess:null},initial.renovation),access,'in-ground no entrance remains incomplete');
assert.equal(configuratorTesting.firstIncompleteStepIndex({...base,features:[],poolType:'above-ground',poolAccess:null},initial.renovation),STEPS.length-1,'above-ground explicit stairs OFF remains valid');
console.log(JSON.stringify({status:'PASS',checks:11,scope:'Real restore/access completion, retained capacity conflict and valid side/entrance regressions'}));

}
{
const initial=configuratorTesting.createInitialState();const base={...initial.config,projectType:'new',poolType:'in-ground',structure:'reinforced-concrete',shape:'rectangle',shapeSelected:true,poolAccess:'internalSteps',system:'skimmer',features:['sunShelf'],internalStairType:'linear',dimensions:{...initial.config.dimensions,length:10,width:5,depth:1.5,floorProfile:'flat'}} as any;
let checks=0;const check=(v:any,m:string)=>{assert(v,m);checks++;};
for(const type of ['linear','corner'])for(const mirrored of [false,true]){
 const c={...base,internalStairType:type,internalStairMirrored:mirrored};const option=configuredInternalStairSides(c).find(s=>s.mirrored===mirrored)!;
 const html=renderToStaticMarkup(React.createElement(AccessPlanPreview,{option}));
 check(html.includes('role="img"')&&!/NaN|Infinity/.test(html),'finite actual diagram');
 check((html.match(/<circle/g)??[]).length===option.skimmers.positions.length,'same actual fitting row');
 check(html.includes('Nuoto residuo')&&html.includes('Lunghezza spiaggetta'),'real shelf dimensions shown');
 check(focusForAction({type:'setInternalStairMirrored'},c,'SUN_SHELF')===undefined,'side comparison keeps current comfort view');
}
const invalid=configuredInternalStairSides({...base,internalStairType:'corner',dimensions:{...base.dimensions,length:25,width:4.5}});
check(invalid.every(s=>!s.available&&s.reason.includes('skimmer')),'capacity reason retained on both sides');
for(const side of invalid){const html=renderToStaticMarkup(React.createElement(AccessPlanPreview,{option:side}));check(!html.includes('Nuoto residuo'),'invalid geometry does not advertise valid dimensions');}
check(focusForAction({type:'setInternalStairMirrored'},base)===undefined,'first side toggle also preserves manual projection');
check(translateText('Nuoto residuo','en')==='Remaining swim length','English measurement label');
check(translateText('Misura adattata a {value} {unit}. Intervallo consentito: {min}–{max} {unit}.','en',{value:'2.67',unit:'m',min:'.9',max:'2.67'}).includes('Value adjusted'),'English recovery message');
console.log(JSON.stringify({status:'PASS',checks,scope:'Real SSR diagram on both flights/sides, same fittings, capacity reasons, stable focus and IT/EN'}));

}