import { useEffect, useMemo } from "react";
import { BoxGeometry, ExtrudeGeometry, Quaternion, Shape, Vector3 } from "three";
import { StainlessSteelMaterial } from "./StainlessSteelMaterial";
import { CladdingMaterial } from "./AboveGroundCladding";
import { planExternalStaircase, type ExternalStaircaseProps } from "./externalStaircasePlan";
import { createContactAOGradientMap } from "./textures";
import { createWoodDeckMaps, createWPCMaps, loadCopingTextureMaps, type StoneMaps } from "./stoneTextures";
import type { CopingMaterialId } from "@/lib/pool/coping-materials";
import { DEFAULT_EXTERIOR_PANEL_FINISH, type ExteriorPanelFinishId } from "@/lib/pool/above-ground";

type Point = readonly [number,number,number];
const SLAB = 0.03;
const GUARD_HEIGHT = 1;
const POST_FOLD = 0.045;
const POST_SETBACK = 0.075;

/** Steel construction enclosed in the same panels as the pool references.
 * Only the walking surfaces inherit the selected coping finish. */
export function ExternalStaircase({ outline, groundY, topY, copingOffset, infinityExcluded = null,
  side = "short", accessAnchor = null, finish = DEFAULT_EXTERIOR_PANEL_FINISH, tread }: ExternalStaircaseProps & {
    finish?: ExteriorPanelFinishId;
    tread: { id: CopingMaterialId; color: string; roughness: number; assetDir: string|null };
  }) {
  const timber = tread.id === "wpc" || tread.id === "deck-marrone";
  const maps = useMemo(() => tread.assetDir ? loadCopingTextureMaps(tread.assetDir)
    : tread.id === "wpc" ? createWPCMaps() : tread.id === "deck-marrone" ? createWoodDeckMaps() : null,
    [tread.assetDir,tread.id]);
  useEffect(() => () => { if(maps) Object.values(maps).forEach(map => map?.dispose()); },[maps]);
  const layout = useMemo(() => planExternalStaircase({outline,groundY,topY,copingOffset,infinityExcluded,side,accessAnchor}),
    [outline,groundY,topY,copingOffset,infinityExcluded,side,accessAnchor]);
  const contactAOMap = useMemo(() => createContactAOGradientMap(),[]);
  useEffect(() => () => contactAOMap.dispose(),[contactAOMap]);
  const enclosure = useMemo(() => layout ? createExternalStairEnclosureGeometry(layout) : null,[layout]);
  const postGeometry = useMemo(() => createExternalStairGuardPostGeometry(),[]);
  useEffect(() => () => enclosure?.dispose(),[enclosure]);
  useEffect(() => () => postGeometry.dispose(),[postGeometry]);
  if(!layout) return null;
  const {width,landingDepth,run,rise,treadDepth,stepCount,poolSide} = layout;
  const start = landingDepth/2, railStart = start-treadDepth/2, lowZ = start+run-treadDepth/2;
  const walkingSurface = (y:number,z:number,depth:number,key:string) => (
    <group key={key} position={[0,y-SLAB/2,z]}>
      {timber ? Array.from({length:Math.max(1,Math.round(depth/0.15))},(_,i) => {
        const count=Math.max(1,Math.round(depth/0.15)), boardDepth=depth/count;
        return <Tread key={i} width={width} depth={boardDepth-0.003} z={-depth/2+boardDepth*(i+0.5)}
          maps={maps} color={tread.color} roughness={tread.roughness} timber />;
      }) : <Tread width={width} depth={depth} z={0} maps={maps} color={tread.color} roughness={tread.roughness} timber={false} />}
    </group>
  );
  const post = (s:number,y:number,z:number,key:string) => (
    <group key={key}>
      <mesh name="external-stair-guard-post" position={[s*(width/2-POST_SETBACK),y,z]} scale={[s,1,1]} geometry={postGeometry} castShadow>
        <StainlessSteelMaterial finish="polished" />
      </mesh>
      <mesh position={[s*(width/2-POST_SETBACK),y+0.007,z]} castShadow>
        <boxGeometry args={[0.12,0.014,0.12]} /><StainlessSteelMaterial finish="polished" />
      </mesh>
    </group>
  );
  return (
    <group name="external-staircase" position={[layout.x,0,layout.z]} rotation={[0,layout.rotation,0]}>
      <mesh name="contact-ao-decal" position={[0,groundY+0.003,run/2]} rotation={[-Math.PI/2,0,0]} renderOrder={1}>
        <planeGeometry args={[width*1.15,(landingDepth+run)*1.12]} />
        <meshBasicMaterial map={contactAOMap} transparent depthWrite={false} />
      </mesh>
      <mesh name="external-stair-closed-panel-enclosure" geometry={enclosure!} position={[0,groundY,0]} castShadow receiveShadow>
        <CladdingMaterial finish={finish} />
      </mesh>
      {walkingSurface(topY,0,landingDepth,"landing")}
      {[-1,1].map(s => <group key={`frame-${s}`}>
        <Beam from={[s*width*0.43,topY-SLAB-0.04,-landingDepth/2]} to={[s*width*0.43,topY-SLAB-0.04,start]} width={0.045} depth={0.08} />
      </group>)}
      {Array.from({length:stepCount-1},(_,i) => {
        const level=i+1,y=groundY+rise*level,z=start+(stepCount-level-0.5)*treadDepth;
        return <group key={`step-${level}`}>
          {walkingSurface(y,z,treadDepth,`tread-${level}`)}
          <Beam from={[-width*0.46,y-SLAB-0.025,z]} to={[width*0.46,y-SLAB-0.025,z]} width={0.035} depth={0.045} />
        </group>;
      })}
      {/* Both stair flanks protected; pool-facing landing entry stays open. */}
      {[-1,1].map(s => {
        const x=s*(width/2-POST_SETBACK+POST_FOLD), outer=s!==poolSide;
        return <group key={`guard-${s}`} name="external-stair-steel-guard">
          {[...new Set([1,Math.ceil((stepCount-1)/2),stepCount-1])].map(level =>
            post(s,groundY+rise*level,start+(stepCount-level-0.5)*treadDepth,`post-${level}`))}
          {outer ? [post(s,topY,-landingDepth/2+0.075,"rear"),post(s,topY,railStart,"front")] : post(s,topY,-landingDepth/2+0.075,"rear")}
          {[0.22,0.48,0.74,GUARD_HEIGHT].map(h => <group key={h}>
            <Rail from={[x,topY+h,railStart]} to={[x,groundY+rise+h,lowZ]} radius={h===GUARD_HEIGHT?0.012:0.006} />
            {outer ? <Rail from={[x,topY+h,-landingDepth/2+0.075]} to={[x,topY+h,railStart]} radius={h===GUARD_HEIGHT?0.012:0.006} /> : null}
          </group>)}
        </group>;
      })}
      {[0.22,0.48,0.74,GUARD_HEIGHT].map(h => <Rail key={`rear-${h}`} from={[-width/2+POST_SETBACK-POST_FOLD,topY+h,-landingDepth/2+0.075]}
        to={[width/2-POST_SETBACK+POST_FOLD,topY+h,-landingDepth/2+0.075]} radius={h===GUARD_HEIGHT?0.012:0.006} />)}
    </group>
  );
}

/** A single closed, stepped volume, including the full-height landing.
 * No stacked overlapping blocks, floating platform or exposed underside. */
export function createExternalStairEnclosureGeometry(layout: NonNullable<ReturnType<typeof planExternalStaircase>>) {
  const {height,width,landingDepth,rise,treadDepth,stepCount} = layout;
  const profile=new Shape(), start=landingDepth/2;
  profile.moveTo(-start,0);
  profile.lineTo(-start,height-SLAB);
  profile.lineTo(start,height-SLAB);
  for(let descent=1;descent<stepCount;descent++) {
    const z=start+(descent-1)*treadDepth,y=height-rise*descent-SLAB;
    profile.lineTo(z,y);
    profile.lineTo(z+treadDepth,y);
  }
  profile.lineTo(start+(stepCount-1)*treadDepth,0);
  profile.closePath();
  const geometry=new ExtrudeGeometry(profile,{depth:width,bevelEnabled:false,steps:1});
  geometry.rotateY(-Math.PI/2);
  geometry.translate(width/2,0,0);
  return geometry;
}

/** Broad polished flat-bar stanchion with the folded foot in the references. */
export function createExternalStairGuardPostGeometry() {
  const profile=new Shape();
  profile.moveTo(-0.006,0);
  profile.lineTo(0.006,0);
  profile.lineTo(0.006,0.10);
  profile.lineTo(POST_FOLD+0.006,0.24);
  profile.lineTo(POST_FOLD+0.006,GUARD_HEIGHT);
  profile.lineTo(POST_FOLD-0.006,GUARD_HEIGHT);
  profile.lineTo(POST_FOLD-0.006,0.24);
  profile.lineTo(-0.006,0.10);
  profile.closePath();
  const geometry=new ExtrudeGeometry(profile,{depth:0.065,bevelEnabled:false,steps:1});
  geometry.translate(0,0,-0.0325);
  return geometry;
}

function Tread({width,depth,z,maps,color,roughness,timber}:{width:number;depth:number;z:number;maps:StoneMaps|null;color:string;roughness:number;timber:boolean}) {
  const geometry=useMemo(() => {
    const g=new BoxGeometry(width,SLAB,depth),p=g.getAttribute("position"),uv=g.getAttribute("uv");
    for(let i=0;i<p.count;i++) uv.setXY(i,p.getX(i)/1.2,(p.getZ(i)+z)/1.2);
    return g;
  },[width,depth,z]);
  useEffect(() => () => geometry.dispose(),[geometry]);
  return <mesh name="external-stair-tread" position={[0,0,z]} geometry={geometry} castShadow receiveShadow>
    <meshStandardMaterial color={timber||!maps?color:"#ffffff"} map={timber?null:maps?.colorMap??null}
      normalMap={maps?.normalMap??null} normalScale={[0.3,0.3]} roughnessMap={maps?.roughnessMap??null} roughness={maps?.roughnessMap?1:roughness} metalness={0} />
  </mesh>;
}
function beamPose(from:Point,to:Point) {
  const a=new Vector3(...from),b=new Vector3(...to),delta=b.clone().sub(a);
  return {position:a.add(b).multiplyScalar(0.5),length:delta.length(),quaternion:new Quaternion().setFromUnitVectors(new Vector3(0,1,0),delta.normalize())};
}
function Beam({from,to,width,depth}:{from:Point;to:Point;width:number;depth:number}) {
  const p=beamPose(from,to);
  return <mesh name="external-stair-steel-frame" position={p.position} quaternion={p.quaternion} castShadow><boxGeometry args={[width,p.length,depth]} /><StainlessSteelMaterial finish="brushed" /></mesh>;
}
function Rail({from,to,radius}:{from:Point;to:Point;radius:number}) {
  const p=beamPose(from,to);
  return <mesh position={p.position} quaternion={p.quaternion} castShadow><cylinderGeometry args={[radius,radius,p.length,10]} /><StainlessSteelMaterial finish="polished" /></mesh>;
}
