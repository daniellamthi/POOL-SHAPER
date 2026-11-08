import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=process.cwd();
const require=createRequire(root+'/package.json'),ts=require('typescript');
const src=fs.readFileSync(process.argv[2] ?? root+'/src/components/pool/PoolViewport.tsx','utf8');
const ast=ts.createSourceFile('PoolViewport.tsx',src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),functions={};
for(const n of ast.statements)if(ts.isFunctionDeclaration(n)&&n.name)functions[n.name.text]=n.getText(ast);
const run=(source,scope)=>vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,scope);
const React={createElement:(tag,props,...children)=>({tag,props:props??{},children})};
const status=run(functions.PhotoModeStatus+';PhotoModeStatus;',{React,useRef:()=>({current:null}),useEffect:()=>{},useI18n:()=>({t:s=>s}),PHOTO_MODE_EXPORT_READY_SAMPLES:190,Button:'button'});
const nodes=(node)=>node&&typeof node==='object'?[node,...node.children.flat(Infinity).flatMap(nodes)]:[];
let cases=0;
for(const [samples,preparing,percent] of [[0,true,0],[0,false,0],[95,false,50],[189,false,99],[190,true,100]]){
 const tree=status({samples,preparing,contextLost:false,onRetry(){}}),all=nodes(tree);
 assert(Object.hasOwn(tree.props,'data-photo-loading'),'Unfinished image must be covered by loading surface');
 assert.match(tree.props.className,/absolute inset-0/);assert.match(tree.props.className,/bg-neutral-950/);
 const bar=all.find(n=>n.props.role==='progressbar');assert(bar);assert.equal(bar.props['aria-valuenow'],percent);cases++;
}
for(const samples of [190,200]){const tree=status({samples,preparing:false,contextLost:false,onRetry(){}});assert(!Object.hasOwn(tree.props,'data-photo-loading'));assert(!nodes(tree).find(n=>n.props.role==='progressbar'));cases++;}
let cancels=0;const loading=status({samples:5,preparing:false,contextLost:false,onCancel(){cancels++;}});let prevented=0;loading.props.onKeyDown({key:'Escape',preventDefault(){prevented++;}});assert.equal(cancels,1);assert.equal(prevented,1);assert.equal(loading.props.role,'dialog');assert.equal(loading.props['aria-modal'],'true');cases++;
let retries=0;const lost=status({samples:0,preparing:false,contextLost:true,onRetry(){retries++;}});assert(Object.hasOwn(lost.props,'data-photo-loading'));nodes(lost).find(n=>n.tag==='button').props.onClick();assert.equal(retries,1);cases++;
let stored,hasState=false,prevDeps,cleanup,pendingEffect,tick,intervals=0,clears=0;
const state={active:true,samples:210,preparing:false,contextLost:false};
const scope={photoModeState:state,window:{setInterval(fn){tick=fn;intervals++;return intervals;},clearInterval(){tick=null;clears++;}},
 useState(initial){if(!hasState){stored=initial;hasState=true;}return[stored,v=>stored=typeof v==='function'?v(stored):v];},
 useEffect(fn,deps){if(!prevDeps||deps.some((d,i)=>d!==prevDeps[i])){pendingEffect=fn;prevDeps=deps;}}};
const hook=run(functions.usePhotoModeSamples+';usePhotoModeSamples;',scope);
const render=key=>{const value=hook(key);if(pendingEffect){cleanup?.();cleanup=pendingEffect();pendingEffect=null;}return value;};
let s=render('standard:0');assert.equal(s.samples,0);assert(s.preparing);tick();s=render('standard:0');assert.equal(s.samples,210);assert(!s.preparing);cases++;
s=render('high:0');assert.equal(s.samples,0);assert(s.preparing,'quality restart covered synchronously');assert.equal(clears,1);cases++;
state.active=false;state.samples=0;tick();s=render('high:0');assert(s.preparing);state.active=true;state.samples=95.9;tick();s=render('high:0');assert.equal(s.samples,95);assert(!s.preparing);cases++;
s=render(null);assert.equal(s.samples,0);assert(!s.preparing);assert.equal(tick,null);s=render('standard:0');assert.equal(s.samples,0);assert(s.preparing);cases++;
state.contextLost=true;tick();assert(render('standard:0').contextLost);cleanup?.();assert.equal(tick,null);cases++;
console.log(JSON.stringify({status:'PASS',cases,scope:'Actual loading component and polling hook, controlled React lifecycle: opaque surface, progress, ready, lost/retry, restart and interval cleanup'}));
