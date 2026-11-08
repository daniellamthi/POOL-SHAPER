import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';const ts=createRequire(process.cwd()+'/package.json')('typescript');
const root=process.cwd(),source=fs.readFileSync(process.argv[2]??'src/components/pool/three/PoolModel.tsx','utf8'),sceneSource=fs.readFileSync(process.argv[3]??'src/components/pool/three/PoolScene.tsx','utf8');
const parse=(file,text)=>ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const ast=parse('PoolModel.tsx',source),vars=new Map(),obstacles=[];
function scan(n){if(ts.isVariableDeclaration(n))vars.set(n.name.getText(ast),n.initializer?.getText(ast));if(ts.isJsxAttribute(n)&&n.name.getText(ast)==='obstacles')obstacles.push(n.initializer.expression.getText(ast));ts.forEachChild(n,scan);}scan(ast);
const construction=parse('poolConstruction.ts',fs.readFileSync('src/components/pool/three/poolConstruction.ts','utf8'));let profileSource;
function find(n){if(ts.isVariableDeclaration(n)&&n.name.getText(construction)==='SKIMMER_PROFILES')profileSource=n.initializer.getText(construction);ts.forEachChild(n,find);}find(construction);
const run=(s,scope)=>vm.runInNewContext(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,scope),profiles=run('('+profileSource+')',{});
const positions=[{x:1,z:2,rotation:0},{x:3,z:2,rotation:0}];let cases=0;
for(const type of Object.keys(profiles))for(const showSkimmers of [false,true]){
 const ctx={system:'skimmer',showSkimmers,isInfinity:false,infinityEdge:null,outline:[],shape:'rectangle',waterLevel:-.143,verticalLayout:{wallTopY:0},skimmers:{positions},materials:{skimmer:{type}},SKIMMER_PROFILES:profiles,useMemo:fn=>fn()};
 const result=run(vars.get('openings'),ctx);assert.equal(result.length,showSkimmers?positions.length:0,'Initial/raw stage must have no skimmer holes');
 for(const opening of result){assert(opening.width>0&&opening.top>opening.bottom);}
 for(const expr of obstacles){assert.equal(run(expr,ctx).length,showSkimmers?positions.length:0,'Coping must not reserve unseen skimmer apertures');}
 cases++;
}
for(const showSkimmers of [false,true]){
 const ctx={system:'infinity',showSkimmers,isInfinity:true,infinityEdge:{side:0,wallType:'glass'},outline:[],shape:'rectangle',waterLevel:-.143,verticalLayout:{wallTopY:0},skimmers:{positions},materials:{skimmer:{type:'standard'}},useMemo:fn=>fn(),infinityZonesForOutline:()=>[{side:0,points:[[0,0],[4,0]]}],clampInfinityEdgeDimensions:()=>({}),infinityContainmentLevels:()=>({baseY:-1.5})};
 assert.equal(run(vars.get('openings'),ctx).length,1,'Glass Infinity opening remains independent of skimmer reveal');cases++;
}
const scene=parse('PoolScene.tsx',sceneSource);let passed=false;
function findProp(n){if((ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))&&n.tagName.getText(scene)==='PoolModel'){const attr=n.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(scene)==='showSkimmers');passed=attr?.initializer.expression.getText(scene)==='showSkimmers';}ts.forEachChild(n,findProp);}findProp(scene);assert(passed,'Wall openings must receive the same reveal flag as Skimmer bodies');
console.log(JSON.stringify({status:'PASS',cases,scope:'Actual opening/obstacle expressions across real skimmer profiles, Infinity glass branch and Scene propagation; native appearance checked separately'}));
