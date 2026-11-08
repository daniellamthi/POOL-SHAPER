import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const {constructionPresentation}=runInNewContext(compile(readFileSync('src/lib/pool/construction-presentation.ts','utf8'))+';exports;',{exports:{}});
const ast=ts.createSourceFile('PoolConfigurator.tsx',readFileSync('src/components/pool/PoolConfigurator.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['constructionBase','catalogueContextVisible','construction'];const declarations=new Map();const props={};
const visit=n=>{
 if(ts.isVariableDeclaration(n)&&names.includes(n.name.getText(ast)))declarations.set(n.name.getText(ast),n.initializer.getText(ast));
 if(ts.isJsxAttribute(n)&&['catalogueSetting','cataloguePatio'].includes(n.name.getText(ast)))props[n.name.getText(ast)]=n.initializer.expression.getText(ast);
 ts.forEachChild(n,visit);
};visit(ast);
let cases=0;
for(const setting of ['garden','spa-wall','spa-glass','residence','patio','infinity-villa'])for(const step of ['project','structure','system','access','style','lighting','deck','technology','review'])for(const technical of [false,true])for(const visited of [false,true]){
 const config={projectType:'new',structure:'reinforced-concrete',system:'overflow',overflowType:'hidden'};
 const ctx={constructionPresentation,config,activeStepId:step,technicalView:technical,cleanCapture:false,effectiveCatalogueSetting:setting,premiumPresentationAvailable:step==='review',projectId:'current-project',catalogueContextEnabled:visited};
 const declarationsSource=names.filter(n=>declarations.has(n)).map(n=>`const ${n}=${declarations.get(n)};`).join('\n');
 const result=runInNewContext(compile(declarationsSource)+`;({construction,setting:(${props.catalogueSetting}),patio:(${props.cataloguePatio})});`,ctx);
 const base=constructionPresentation(config,step,technical),expected=base.stage==='water'&&(step==='review'||visited);
 assert.equal(result.setting,expected?setting:'garden',`Keep chosen ${setting} during ${step}, technical=${technical}`);
 assert.equal(result.patio,expected&&setting==='patio');
 if(expected){assert(result.construction.showEnvironment&&result.construction.showDecking&&result.construction.showLoungers,'Same selected environment, paving and furniture stay visible');}
 else assert.equal(JSON.stringify(result.construction),JSON.stringify(base),'Early/raw/technical and unselected garden presentation stay unchanged');
 for(const key of ['stage','raw','structure','showWater','showLighting','showAccessories','showSystemComponents','label'])assert.equal(result.construction[key],base[key],`Preserve ${key}`);
 cases++;
}
console.log(JSON.stringify({status:'PASS',cases,scope:'Actual configurator stage routing and construction flags; native navigation/appearance separately verified'}));
