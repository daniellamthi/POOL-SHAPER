import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
const require=createRequire(process.cwd()+'/package.json'),ts=require('typescript'),T=require('three');
const source=ts.createSourceFile('DaylightEnvironment.tsx',readFileSync('src/components/pool/three/DaylightEnvironment.tsx','utf8'),99,true,4);
let component;function find(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='RetainedNightEnvironment')component=n;ts.forEachChild(n,find);}find(source);
let effect;function effectFind(n){if(ts.isCallExpression(n)&&n.expression.getText(source)==='useLayoutEffect')effect=n.arguments[0].getText(source);ts.forEachChild(n,effectFind);}effectFind(component);assert(effect);
const three=ts.createSourceFile('three.js',readFileSync('node_modules/three/build/three.module.js','utf8'),99,true,1);
const needed={};function libFind(n){if(ts.isFunctionDeclaration(n)&&['getPMREM','onPMREMDispose','isCubeTextureComplete'].includes(n.name?.text))needed[n.name.text]=n.getText(three);ts.forEachChild(n,libFind);}libFind(three);assert.equal(Object.keys(needed).length,3);
let created=0,disposed=0;
const cacheContext={pmremMaps:new WeakMap(),pmremGenerator:{fromCubemap(tex,target){if(target)return target;created++;const rt=new T.WebGLRenderTarget();rt.addEventListener('dispose',()=>disposed++);return rt;}},...T};
const cache=runInNewContext(Object.values(needed).join('\n')+';({getPMREM})',cacheContext);
for(let i=0;i<3;i++){
 const capture=new T.Scene(),target=new T.WebGLCubeRenderTarget(256);target.texture.pmremVersion=1;capture.environment=target.texture;let published;
 const context={captureScene:capture,onReady:map=>published=map};
 const cleanup=runInNewContext(ts.transpileModule('('+effect+')()',{}).outputText,context);
 assert.equal(published,target.texture);const pmrem=cache.getPMREM(published);assert(pmrem?.isTexture);assert.equal(cache.getPMREM(published),pmrem,'reuse cache within one capture');
 cleanup();target.dispose();assert.equal(published,null);assert.equal(disposed,created,'release the actual installed Three PMREM cache on unmount');
}
assert.equal(created,3);console.log('Night environment: 3 real-resource cycles; installed PMREM cache ownership PASS');
