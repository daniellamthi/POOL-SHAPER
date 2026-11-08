import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const root=process.cwd(),require=createRequire(root+'/package.json'),ts=require('typescript'),T=require('three');
const source=readFileSync('src/components/pool/three/PoolScene.tsx','utf8');
const tree=ts.createSourceFile('PoolScene.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let effect,bookkeeping,adaptive;
function visit(node){
 if(ts.isFunctionDeclaration(node)&&node.name?.text==='AdaptiveQuality')adaptive=node.getText(tree);
 if(ts.isFunctionDeclaration(node)&&node.name?.text==='CameraRig'){
 const inner=n=>{if(ts.isCallExpression(n)&&n.expression.getText(tree)==='useEffect'&&n.getText(tree).includes('control.addEventListener("start"'))effect=n.getText(tree);if(ts.isCallExpression(n)&&n.expression.getText(tree)==='useFrame'&&n.arguments[0]?.getText(tree).includes('const moving = flying.current'))bookkeeping=n.getText(tree);ts.forEachChild(n,inner);};inner(node);
 }ts.forEachChild(node,visit);
}visit(tree);assert(effect&&bookkeeping&&adaptive);
const control=new T.EventDispatcher(),state={idle:true,locked:false},refs={flying:{current:false},interacting:{current:false},idleElapsed:{current:1},motionPending:{current:false}};
let cleanup,tick,qualityTick,dpr=2,sets=0;
const context={...refs,controls:{current:control},camera:new T.PerspectiveCamera(),infinityZone:null,layout:{waterY:0},navigationLimits:{current:null},renderQualityState:state,RENDER_QUALITY_IDLE_DELAY:.3,cameraLocked:false,photoMode:false,
 useEffect:fn=>{cleanup=fn();},useFrame:fn=>{tick=fn;},useRef:value=>({current:value}),ACTIVE_RENDERING_QUALITY:{dpr:[1,2]},
 useThree:selector=>selector({setDpr:value=>{dpr=value;sets++;},size:{width:1113,height:929},gl:{domElement:{closest:()=>({})},getPixelRatio:()=>dpr}})};
const run=code=>vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
run(effect);run(bookkeeping);context.useEffect=()=>{};context.useFrame=fn=>{qualityTick=fn;};run(adaptive+';AdaptiveQuality();');
qualityTick();const settled=dpr;assert(settled>1.5&&settled<1.6);
// OrbitControls emits both events synchronously in one wheel callback.
control.dispatchEvent({type:'start'});control.dispatchEvent({type:'end'});
tick(null,.4);qualityTick();assert.equal(dpr,1,'wheel zoom must enter the responsive DPR before rendering its first moving frame');
tick(null,.2);qualityTick();assert.equal(dpr,1);
control.dispatchEvent({type:'change'});tick(null,.2);qualityTick();assert.equal(dpr,1,'damping movement restarts the settle debounce');
tick(null,.31);qualityTick();assert.equal(dpr,settled,'same full stationary quality after actual motion stops');
const stableSets=sets;qualityTick();qualityTick();assert.equal(sets,stableSets,'settled frames do not resize render targets');
control.dispatchEvent({type:'start'});tick(null,.4);qualityTick();assert.equal(dpr,1,'a held interaction stays responsive');control.dispatchEvent({type:'end'});tick(null,.31);qualityTick();assert.equal(dpr,settled);
cleanup();state.idle=true;refs.idleElapsed.current=1;control.dispatchEvent({type:'change'});assert.equal(state.idle,true,'unmount removes the change listener');
console.log(JSON.stringify({status:'PASS',scope:'Actual CameraRig event effect/frame bookkeeping and AdaptiveQuality callback: synchronous wheel, damping change debounce, held input, full idle restoration, no repeated resize, listener cleanup.',movingDpr:1,stationaryDpr:settled,movingPixelsRatio:1/(settled*settled)}));
