import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {createRequire} from 'node:module';import {runInNewContext} from 'node:vm';
const require=createRequire(process.cwd()+'/package.json'),T=require('three'),ts=require('typescript');
const file='src/components/pool/three/photoCamera.ts';
const create=existsSync(file)?runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText+';exports;',{exports:{},require:id=>id==='three'?T:require(id)}).createPhotoCamera:source=>({camera:source,sync(){return false;}});
let checks=0;const check=(value,message)=>{assert(value,message);checks++;};
const snapshot=c=>JSON.stringify({world:c.matrixWorld.elements,projection:c.projectionMatrix.elements,position:c.position.toArray(),quaternion:c.quaternion.toArray(),view:c.view,aspect:c.aspect,fov:c.fov});
for(const [width,height,top,bottom]of [[1042,929,100,320],[1113,929,90,100],[390,844,90,280],[1920,1080,90,220]])for(const fov of [34,52,64]){
 const editor=new T.PerspectiveCamera(fov,1,.1,500),target=new T.Vector3(0,.35,0);editor.position.set(-7.1,3,.45);editor.lookAt(target);editor.updateMatrixWorld();editor.setViewOffset(width,height-top-bottom,0,-top,width,height);
 const original=snapshot(editor),owner=create(editor,[]);owner.sync(editor,new T.Vector2(width*2,height*2));const photo=owner.camera;
 const centre=target.clone().project(photo);check(Math.abs(centre.x)<1e-9&&Math.abs(centre.y)<1e-9,'photographic look target must be centred independently of editor panels');
 check(photo!==editor&&photo.parent===null,'owned camera never replaces/reparents the editor camera');check(snapshot(editor)===original,'editor pose, lens and inset are untouched');
 const expected=new T.PerspectiveCamera(fov,width/height,.1,500);check(photo.projectionMatrix.equals(expected.projectionMatrix),'actual full-buffer aspect/lens projection');check(photo.matrixWorld.equals(editor.matrixWorld),'same optical viewpoint');
 check(owner.sync(editor,new T.Vector2(width*2,height*2))===false,'stationary sync has no optical invalidation');
 editor.setViewOffset(width,height-top-bottom-40,0,-top-20,width,height);check(owner.sync(editor,new T.Vector2(width*2,height*2))===false,'panel-only projection changes do not restart a full-frame photograph');
 editor.zoom=1.2;editor.filmOffset=1.1;editor.updateProjectionMatrix();check(owner.sync(editor,new T.Vector2(width*2,height*2))===true,'real zoom/lens shift invalidates');check(photo.zoom===1.2&&photo.filmOffset===1.1,'retain intentional user optical settings');
 editor.position.x+=1;editor.updateMatrixWorld();check(owner.sync(editor,new T.Vector2(width*2,height*2))===true,'world pose changes invalidate');
 photo.updateMatrixWorld(true);check(photo.matrixWorld.equals(editor.matrixWorld),'installed tracer camera world update preserves the copied viewpoint');
 check(owner.sync(editor,new T.Vector2(width,height))===false,'DPR-only size changes keep optical projection (caller still invalidates output size)');
}
const parent=new T.Group(),editor=new T.PerspectiveCamera(52,1,.1,300);parent.position.set(4,2,-3);parent.rotation.y=.4;parent.add(editor);editor.position.set(2,1,3);parent.updateMatrixWorld(true);const before=snapshot(editor),owner=create(editor,[]);owner.sync(editor,new T.Vector2(1000,800));owner.camera.updateMatrixWorld(true);check(owner.camera.matrixWorld.equals(editor.matrixWorld),'parented editor camera retains exact world transform');check(snapshot(editor)===before,'parented editor stays untouched');
const ortho=new T.OrthographicCamera(-4,4,3,-3,.1,100);ortho.position.set(0,10,0);ortho.lookAt(0,0,0);ortho.updateMatrixWorld();ortho.setViewOffset(1000,800,10,20,500,400);const orthoOwner=create(ortho,[]);orthoOwner.sync(ortho,new T.Vector2(1000,800));check(orthoOwner.camera.projectionMatrix.equals(ortho.projectionMatrix),'orthographic projection remains unchanged');

for(const [width,height] of [[1042,929],[390,844],[1920,1080]]){
 const editor=new T.PerspectiveCamera(50,1,.1,500);editor.position.set(-7.1,3,.45);editor.lookAt(1.26,.35,.36);editor.updateMatrixWorld(true);editor.setViewOffset(width,height-300,0,-100,width,height);
 const points=[[-3.5,.1,-1.5],[-3.5,.1,1.5],[3.5,.1,1.5],[3.5,.1,-1.5]],owner=create(editor,points),before=snapshot(editor);owner.sync(editor,new T.Vector2(width,height));
 for(const p of points){const projected=new T.Vector3(...p).project(owner.camera);check(Math.abs(projected.x)<=.880001 && Math.abs(projected.y)<=.880001,'full pool perimeter must remain inside the photographic safety margin');}
 check(snapshot(editor)===before,'subject fitting never changes editor optics');
 check(owner.sync(editor,new T.Vector2(width,height))===false,'fitted camera remains stable across accumulation');
 const detail=create(editor);detail.sync(editor,new T.Vector2(width,height));check(detail.camera.projectionMatrix.equals(editor.projectionMatrix),'default/detail contexts retain the exact existing inset projection');
}
let requiredFit=0;
for(const [length,width] of [[4,2],[7,3],[12,6]])for(const angle of [0,.4,-1.5])for(const aspect of [.46,1.12,1.78]){
 const world=(x,y,z)=>new T.Vector3(2+Math.cos(angle)*x+Math.sin(angle)*z,y,-3-Math.sin(angle)*x+Math.cos(angle)*z);
 const editor=new T.PerspectiveCamera(50,aspect,.1,500);editor.position.copy(world(-length/2-3.6,3,width*.15));editor.lookAt(world(length*.18,.35,width*.12));editor.updateMatrixWorld(true);
 const points=[[-length/2,.1,-width/2],[-length/2,.1,width/2],[length/2,.1,width/2],[length/2,.1,-width/2]].map(p=>world(...p).toArray());
 const canonical=points.map(p=>new T.Vector3(...p).project(editor));if(canonical.some(p=>Math.max(Math.abs(p.x),Math.abs(p.y))>.88))requiredFit++;
 const owner=create(editor,points);owner.sync(editor,new T.Vector2(aspect*1000,1000));
 for(const p of points){const projected=new T.Vector3(...p).project(owner.camera);check(Math.abs(projected.x)<=.880001&&Math.abs(projected.y)<=.880001,'scaled/rotated basin retains its complete perimeter');}
 check(owner.camera.matrixWorld.equals(editor.matrixWorld),'fitting preserves the exact existing world viewpoint');
 check(owner.sync(editor,new T.Vector2(aspect*1000,1000))===false,'scaled fit is optically stable');
}
check(requiredFit>0,'fixtures exercise an actual clipping regression before fitting');
const inside=new T.PerspectiveCamera(50,1,.1,100);inside.lookAt(0,0,-1);inside.updateMatrixWorld(true);inside.setViewOffset(1000,700,0,-100,1000,1000);
const fallback=create(inside,[[0,0,1],[0,0,-1],[1,0,-1]]);fallback.sync(inside,new T.Vector2(1000,1000));check(fallback.camera.projectionMatrix.equals(inside.projectionMatrix),'inside/near-plane viewpoints retain their previous optical projection');
const sceneSource=ts.createSourceFile('PoolScene.tsx',readFileSync('src/components/pool/three/PoolScene.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let subjectInitializer;
const findSubject=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(sceneSource)==='photoSubject')subjectInitializer=n.initializer;ts.forEachChild(n,findSubject);};findSubject(sceneSource);assert(subjectInitializer);
const subjectCode=ts.transpileModule(subjectInitializer.getText(sceneSource),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
for(const setting of [undefined,'residence','spa-wall','spa-glass','patio'])for(const focus of ['overview','review','features','stair-lighting','bench-lighting','waterline','top','access','inox','hydromassage']){
 const indoor=!!setting?.startsWith('spa-');
 const value=runInNewContext(subjectCode,{architecture:setting?{setting,indoor}:null,focus,outline:[[0,0],[7,0],[7,3],[0,3]],verticalLayout:{copingY:.1},useMemo:fn=>fn()});
 const villa=setting==='residence'&&['overview','review'].includes(focus);
 const spa=indoor&&['overview','review','features','stair-lighting','bench-lighting'].includes(focus);
 check(!!value===(villa||spa),'actual caller clears editor insets for SPA architectural photos and villa overview only');
 if(spa)check(value.length===0,'SPA keeps the chosen physical eye and lens without fitting the basin from an inside viewpoint');
 for(const [width,height] of [[390,844],[1113,929],[1920,1080]]){
  const editor=new T.PerspectiveCamera(58,1,.1,500),target=new T.Vector3(3.5,1.15,-.6);
  editor.position.set(-3.3,1.65,3);editor.lookAt(target);editor.updateMatrixWorld(true);
  editor.setViewOffset(width,height-300,0,-90,width,height);
  const original=snapshot(editor),owner=create(editor,value);owner.sync(editor,new T.Vector2(width,height));
  check(snapshot(editor)===original,'actual SPA route preserves live editor pose, lens and UI insets');
  if(spa){
   const projected=target.clone().project(owner.camera);
   check(Math.abs(projected.x)<1e-9&&Math.abs(projected.y)<1e-9,'SPA optical target is centred on the exported full frame, independent of UI panels');
   check(owner.camera.matrixWorld.equals(editor.matrixWorld),'SPA photograph retains exact world viewpoint');
   check(owner.camera.fov===editor.fov&&owner.camera.zoom===editor.zoom,'SPA retains physical lens and user zoom');
   editor.setViewOffset(width,height-320,0,-110,width,height);
   check(owner.sync(editor,new T.Vector2(width,height))===false,'SPA panel-only changes do not discard photographic accumulation');
  }else if(!villa)check(owner.camera.projectionMatrix.equals(editor.projectionMatrix),'detail, top, Patio and unrelated views retain their previous projection');
 }
}
console.log(JSON.stringify({status:'PASS',checks,requiredFit,scope:'Real Three cameras; full-frame projection; scaled/rotated pool safety margin; owned world transforms; source preservation; panel/lens/pose/DPR changes; unchanged default/detail/inside/orthographic projections. Native composition acceptance separate.'}));
