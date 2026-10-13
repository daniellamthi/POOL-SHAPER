import { useEffect, useMemo, useState } from "react";
import { BoxGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from "three";
import { useThree } from "@react-three/fiber";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { Environment, Lightformer } from "@react-three/drei";
import { CoastalPhotoBackdrop } from "./CoastalPhotoBackdrop";
import { COAST_PHOTO_YAW } from "./coastalLayout";
import type { Outline } from "@/lib/pool/types";
import { outlineBounds } from "@/lib/pool/geometry";
import type { HybridEnvironment as EnvironmentId } from "@/lib/pool/hybrid-photo";

RectAreaLightUniformsLib.init();

function metricBoxUV(geometry:BoxGeometry) {
  const p=geometry.getAttribute("position"),n=geometry.getAttribute("normal"),uv=geometry.getAttribute("uv");
  for(let i=0;i<p.count;i++)uv.setXY(i,Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i),Math.abs(n.getY(i))>.5?p.getZ(i):p.getY(i));
  uv.needsUpdate=true;
}

/** Presentation-only resources. Every texture belongs to this mounted scene;
 * no useLoader cache and no background downloads in the configuration wizard. */
export default function HybridEnvironment({id,bounds,ground,rim,night,onReady,onError}:{
  id:EnvironmentId;bounds:Outline;ground:number;rim:number;night:boolean;onReady:(ready:boolean)=>void;onError:(message:string)=>void;
}) {
  const [photo,setPhoto]=useState<Texture|null>(null),[stone,setStone]=useState<Texture|null>(null);
  const b=useMemo(()=>outlineBounds(bounds),[bounds]);
  const indoor=id==="indoor-wellness", w=b.maxX-b.minX+8, back=b.minZ-4.5, front=b.maxZ+18, roof=rim+5.2;
  const {scene,size}=useThree();
  useEffect(()=>{
    onReady(false);let live=true;const owned:Texture[]=[];
    const loader=new TextureLoader();
    const url=indoor?"/textures/coping/travertino/basecolor.png":"/photo-environments/villa-garden.jpg";
    let pending=indoor?2:1;
    const loaded=()=>{if(--pending===0)onReady(true);};
    loader.load(url,t=>{if(!live){t.dispose();return;}owned.push(t);t.colorSpace=SRGBColorSpace;t.anisotropy=4;
      if(indoor){t.wrapS=t.wrapT=RepeatWrapping;t.repeat.set(.5,.5);setStone(t);}else setPhoto(t);
      loaded();
    },undefined,()=>{if(live){onReady(false);onError("Ambiente non caricato. Seleziona un altro ambiente e riprova.");}});
    if(indoor)loader.load("/hdri/simons-town-rocks-background.jpg",t=>{
      if(!live){t.dispose();return;}owned.push(t);t.colorSpace=SRGBColorSpace;setPhoto(t);loaded();
    },undefined,()=>{if(live)onError("Vista panoramica non caricata. Riprova.");});
    return()=>{live=false;owned.forEach(t=>t.dispose());};
  },[indoor,w,front,back,onReady,onError]);
  useEffect(()=>{const prior=scene.fog;scene.fog=null;return()=>{scene.fog=prior;};},[scene]);
  useEffect(()=>{
    if(indoor||!photo)return;
    const prior=scene.background;scene.background=photo;
    return()=>{scene.background=prior;};
  },[scene,indoor,photo]);
  useEffect(()=>{
    if(!photo||indoor)return;
    const aspect=size.width/size.height,sourceAspect=2400/1602;
    photo.repeat.set(Math.min(1,aspect/sourceAspect),Math.min(1,sourceAspect/aspect));
    photo.offset.set((1-photo.repeat.x)/2,0);
    photo.updateMatrix();
  },[photo,indoor,size.width,size.height]);
  const wallStone=useMemo(()=>{
    if(!stone)return null;
    const t=stone.clone();t.repeat.set(.5,.5);t.needsUpdate=true;return t;
  },[stone,w,roof]);
  useEffect(()=>()=>wallStone?.dispose(),[wallStone]);
  const slats=useMemo(()=>{
    const count=Math.ceil(w/.16),geo=new BoxGeometry(.065,.08,front-back);
    const mat=new MeshStandardMaterial({color:"#796951",roughness:.8});
    const mesh=new InstancedMesh(geo,mat,count),m=new Matrix4();
    for(let i=0;i<count;i++)mesh.setMatrixAt(i,m.makeTranslation(-w/2+i*.16,roof,(front+back)/2));
    mesh.instanceMatrix.needsUpdate=true;return mesh;
  },[w,front,back,roof]);
  useEffect(()=>()=>{slats.geometry.dispose();(slats.material as MeshStandardMaterial).dispose();},[slats]);
  if(!indoor)return null;
  // Open-front architectural set: four floor strips leave the original basin
  // and independently selected local paving completely untouched.
  const innerX=(b.maxX-b.minX)/2+1.25,innerZ=(b.maxZ-b.minZ)/2+1.25;
  const floorStrips: [number,number,number,number][] = [[0,back/2-innerZ/2,w,-back-innerZ],[0,(front+innerZ)/2,w,front-innerZ],[-(w/2+innerX)/2,0,w/2-innerX,innerZ*2],[(w/2+innerX)/2,0,w/2-innerX,innerZ*2]];
  return <group name="photo-indoor-environment">
    {/* A small room-only IBL, captured once. No outdoor sun/HDR in the SPA.
        The window and coves provide the same reflection directions as the set. */}
    <Environment key={night?"night":"day"} resolution={128} frames={1}>
      <mesh><sphereGeometry args={[20,16,8]}/><meshBasicMaterial color={night?"#28231d":"#837969"} side={1}/></mesh>
      <Lightformer position={[0,1,-8]} scale={[12,4,1]} color={night?"#839399":"#ecf3ed"} intensity={night?.2:2}/>
      <Lightformer position={[-5,4,0]} rotation={[0,Math.PI/2,0]} scale={[9,.3,1]} color="#ffe2b2" intensity={night?4:2}/>
    </Environment>
    {floorStrips.map(([x,z,sx,sz],i)=><mesh key={i} position={[x,ground-.045,z]} receiveShadow><boxGeometry args={[sx,.08,sz]} onUpdate={metricBoxUV}/><meshStandardMaterial map={stone} color="#c2b7a2" roughness={.78}/></mesh>)}
    {/* Actual spherical landscape beyond the glazing, not a stretched lawn
        image on a vertical wall. Existing licensed pool-free coastal capture. */}
    {photo?<CoastalPhotoBackdrop map={photo} rotation={Math.PI+COAST_PHOTO_YAW} timeOfDay={night?"night":"day"}/>:null}
    {[ground+.1,roof-.25].map(y=><mesh key={y} position={[0,y,back]} castShadow><boxGeometry args={[w,.2,.24]}/><meshStandardMaterial color="#333430" roughness={.45} metalness={.35}/></mesh>)}
    {Array.from({length:6},(_,i)=><mesh key={i} position={[-w/2+i*w/5,(roof+ground)/2,back]} castShadow><boxGeometry args={[.055,roof-ground,.12]}/><meshStandardMaterial color="#343530" roughness={.4} metalness={.45}/></mesh>)}
    <mesh position={[0,(roof+ground)/2,back+.01]}><planeGeometry args={[w,roof-ground]}/><meshStandardMaterial transparent opacity={.06} depthWrite={false} color="#d7e2df" roughness={.14} metalness={.4}/></mesh>
    <mesh position={[-w/2,(roof+ground)/2,(front+back)/2]} receiveShadow><boxGeometry args={[.18,roof-ground,front-back]} onUpdate={metricBoxUV}/><meshStandardMaterial map={wallStone} color="#beb39f" roughness={.84}/></mesh>
    <mesh position={[w/2,roof/2,(front+back)/2]} receiveShadow><boxGeometry args={[.18,roof,front-back]}/><meshStandardMaterial color="#746551" roughness={.88}/></mesh>
    <primitive object={slats}/>
    <mesh position={[0,roof+.09,(front+back)/2]}><boxGeometry args={[w,.1,front-back]}/><meshStandardMaterial color="#463f36" roughness={1}/></mesh>
    <mesh position={[0,roof-.2,back+.12]}><boxGeometry args={[w-.6,.035,.025]}/><meshBasicMaterial color="#ffe2ad" toneMapped={false}/></mesh>
    <mesh position={[-w/2+.12,roof-.2,(front+back)/2]}><boxGeometry args={[.025,.035,front-back]}/><meshBasicMaterial color="#ffe2ad" toneMapped={false}/></mesh>
    <rectAreaLight position={[0,roof-.35,back+1]} rotation={[-Math.PI/2,0,0]} width={w-1} height={2} color="#ffe3b7" intensity={night?5:2}/>
    <rectAreaLight position={[0,2,back+.3]} rotation={[0,Math.PI,0]} width={w-1} height={3.5} color="#e5eeea" intensity={night?.15:5}/>
    <rectAreaLight position={[-w/2+.25,roof-.4,0]} rotation={[0,Math.PI/2,0]} width={front-back-2} height={.5} color="#ffe3b7" intensity={night?3:1.5}/>
    <directionalLight position={[0,roof-1,back]} color="#edf0dc" intensity={night?.06:1.1} castShadow
      shadow-autoUpdate={false} shadow-needsUpdate
      shadow-mapSize={[1024,1024]} shadow-camera-left={-w/2} shadow-camera-right={w/2}
      shadow-camera-top={10} shadow-camera-bottom={-10} shadow-camera-far={60} shadow-normalBias={.025} shadow-radius={4}/>
    {/* Low stone relaxation bench outside the configured paving envelope. */}
    <group position={[w/2-1.05,ground,back+3.3]}>
      <mesh position={[0,.2,0]} castShadow receiveShadow><boxGeometry args={[1.4,.4,3.2]}/><meshStandardMaterial color="#5b4b37" roughness={.8}/></mesh>
      <mesh position={[0,.46,0]} castShadow receiveShadow><boxGeometry args={[1.32,.14,3.08]}/><meshStandardMaterial color="#d9d0bc" roughness={1}/></mesh>
      <mesh position={[.44,.72,0]} rotation={[0,0,-.22]} castShadow><boxGeometry args={[.2,.56,3.08]}/><meshStandardMaterial color="#d9d0bc" roughness={1}/></mesh>
    </group>
    <ambientLight intensity={night?.18:.22} color="#e9ded1"/>
  </group>;
}
