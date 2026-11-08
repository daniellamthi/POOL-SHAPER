import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
const require=createRequire(process.cwd()+'/package.json'), T=require('three'),ts=require('typescript');
const file='src/components/pool/three/photoCamera.ts';
const {createPhotoCamera}=runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText+';exports;',{exports:{},require:id=>id==='three'?T:require(id)});
let checks=0;
for(const aspect of [390/844,0.79,0.8,1.5])for(const yaw of [0,0.7,-1.2]){
 const editor=new T.PerspectiveCamera(72,aspect,.1,500);editor.position.set(-4.3,1.65,3.25);editor.lookAt(4.5,1.15,-.675);editor.rotateY(yaw);editor.updateMatrixWorld(true);
 const original=editor.matrixWorld.clone(),owner=createPhotoCamera(editor,[],Math.PI/18);
 owner.sync(editor,new T.Vector2(aspect*1000,1000));
 const expected=original.clone();if(aspect<.8)expected.multiply(new T.Matrix4().makeRotationX(-Math.PI/18));
 assert(owner.camera.matrixWorld.elements.every((v,i)=>Math.abs(v-expected.elements[i])<1e-12),'portrait SPA camera must pitch down 10 degrees, preserving the physical eye');checks++;
 assert(editor.matrixWorld.equals(original),'live camera remains unchanged');checks++;
 assert(owner.camera.position.distanceTo(editor.position)<1e-12,'eye is unchanged');checks++;
 assert.equal(owner.camera.fov,editor.fov);checks++;
 assert.equal(owner.camera.zoom,editor.zoom);checks++;
 assert.equal(owner.sync(editor,new T.Vector2(aspect*2000,2000)),false,'sync never accumulates pitch or invalidates DPR-only changes');checks++;
 const neutral=createPhotoCamera(editor,[]);neutral.sync(editor,new T.Vector2(aspect*1000,1000));assert(neutral.camera.matrixWorld.equals(original),'unrelated contexts keep their pose');checks++;
}
// Preserve an inherited world transform, including nonuniform parent scale.
const parent=new T.Group();parent.scale.set(2,1,3);parent.rotation.y=.4;
const child=new T.PerspectiveCamera(72,.46,.1,500);parent.add(child);child.position.set(2,1,3);child.rotation.set(-.2,.7,0);parent.updateMatrixWorld(true);
const world=child.matrixWorld.clone(),parented=createPhotoCamera(child,[],Math.PI/18);
parented.sync(child,new T.Vector2(390,844));parented.camera.updateMatrixWorld(true);
const tilted=world.clone().multiply(new T.Matrix4().makeRotationX(-Math.PI/18));
assert(parented.camera.matrixWorld.equals(tilted),'pitch preserves the complete inherited world matrix');checks++;
assert(child.matrixWorld.equals(world),'parented editor remains unchanged');checks++;
assert.equal(parented.sync(child,new T.Vector2(390,844)),false,'parented pitch remains stable');checks++;
const scene=ts.createSourceFile('PoolScene.tsx',readFileSync('src/components/pool/three/PoolScene.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let pitchExpression;
const visit=node=>{if(ts.isJsxAttribute(node)&&node.name.getText(scene)==='portraitPitch')pitchExpression=node.initializer.expression.getText(scene);ts.forEachChild(node,visit);};visit(scene);
assert(pitchExpression,'actual scene must route the photographic correction');
for(const setting of [undefined,'spa-wall','spa-glass','residence','patio'])for(const focus of ['overview','review','features','stair-lighting','bench-lighting','waterline','top','access','inox','hydromassage']){
 const indoor=!!setting?.startsWith('spa-');
 const value=runInNewContext(pitchExpression,{architecture:setting?{setting,indoor}:null,focus,Math});
 assert.equal(value,indoor&&['overview','review'].includes(focus)?Math.PI/18:0,'actual caller restricts tilt to SPA overview/review');checks++;
}
console.log(`SPA portrait composition: ${checks} checks PASS (owned camera transforms, source/lens/eye preservation; visual framing separate).`);
