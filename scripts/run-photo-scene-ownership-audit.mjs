import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
const require=createRequire(process.cwd()+'/package.json'),ts=require('typescript'),T=require('three');
const source=ts.createSourceFile('PhotoModeRenderer.tsx',readFileSync('src/components/pool/three/PhotoModeRenderer.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let teardown;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='teardown')teardown=n.initializer.getText(source);ts.forEachChild(n,visit);}visit(source);assert(teardown);
let checks=0;
for(const replacement of [false,true])for(const loadedHDR of [false,true]){
 const previousEnvironment=new T.Texture(),previousBackground=new T.Texture(),gradient=new T.Texture(),hdriTexture=loadedHDR?new T.Texture():null,newEnvironment=new T.Texture(),newBackground=new T.Texture();
 const scene=new T.Scene();scene.environment=replacement?newEnvironment:hdriTexture??gradient;scene.background=replacement?newBackground:hdriTexture??gradient;scene.environmentRotation.set(1,2,3);scene.backgroundRotation.set(3,2,1);scene.backgroundBlurriness=.7;
 const sandbox={disposeRefractedSun:undefined,disposeOutputFilter:undefined,disposeWaterMedium:undefined,disposeLedTransport:undefined,scene,previousEnvironment,previousBackground,gradient,hdriTexture,previousEnvironmentRotation:new T.Euler(.1,.2,.3),previousBackgroundRotation:new T.Euler(.3,.2,.1),previousBackgroundBlurriness:.4,hdrExportRef:{current:null},restoreVisibility:[],waterOverrides:[],pavingOverrides:[],geometryOverrides:[],waterNormalMap:new T.Texture()};
 runInNewContext(ts.transpileModule('('+teardown+')()',{}).outputText,sandbox);
 assert.equal(scene.environment,replacement?newEnvironment:previousEnvironment,'must not overwrite environment installed by the returning live view');checks++;
 assert.equal(scene.background,replacement?newBackground:previousBackground);checks++;
 assert.equal(scene.environmentRotation.x,replacement?1:.1);checks++;
 assert.equal(scene.backgroundRotation.x,replacement?3:.3);checks++;
 assert.equal(scene.backgroundBlurriness,replacement?.7:.4);checks++;
}
console.log('Photo scene ownership: '+checks+' checks PASS');
