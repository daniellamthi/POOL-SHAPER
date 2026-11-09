import { configuredLayoutWithSkimmers } from "./resolved-layout";
import { configuredInternalStairSides } from "./internal-stair-options";
import { configuredOutline } from "./configured-outline";
import { outlineBounds } from "./geometry";
import { nearestStairWall } from "./stair-position";
import { mergedWallChords } from "./lighting";
import { infinityExclusion } from "./infinity-edge";
import type { InternalStairPosition, PoolConfig } from "./types";

type Option = ReturnType<typeof configuredInternalStairSides>[number];
export type StairMove = { option: Option; position?: InternalStairPosition; mirrored?: boolean };
const centre = (points: Option["outline"]) => ({
  x: points.reduce((s,p) => s+p[0]/points.length,0), z: points.reduce((s,p) => s+p[1]/points.length,0),
});

export function currentInternalStairOption(config: PoolConfig): Option {
  const options = configuredInternalStairSides(config);
  const automatic = options.find(o => o.mirrored === !!config.internalStairMirrored)!;
  if (!config.internalStairPosition) return automatic;
  const { layout, skimmers } = configuredLayoutWithSkimmers(config);
  const integrated=layout.comfort.elements.find(e=>!!e.steps?.length);
  return { ...automatic, layout, skimmers, footprint: layout.access.placement ? layout.access.footprint : integrated?.steps?.[0]?.footprint ?? [],
    available: layout.status !== "UNAVAILABLE" && (!!layout.access.placement || !!integrated),
    reason: layout.access.reason };
}

/** Solve once for the pointer's wall; never mutate the global project during a drag. */
export function moveInternalStair(config: PoolConfig, point: InternalStairPosition): { move: StairMove | null; reason: string } {
  const current = configuredLayoutWithSkimmers(config).layout;
  if (current.comfort.elements.some(e => !!e.steps?.length)) {
    const options = configuredInternalStairSides(config).filter(o => o.available);
    options.sort((a,b) => {
      const ac=centre(a.footprint), bc=centre(b.footprint);
      return Math.hypot(ac.x-point.x,ac.z-point.z)-Math.hypot(bc.x-point.x,bc.z-point.z);
    });
    const option=options[0];
    return { move: option ? { option, mirrored: option.mirrored } : null,
      reason: option ? "" : "Nessuna posizione compatibile con la spiaggetta." };
  }
  const next={...config,internalStairPosition:point};
  const { layout, skimmers }=configuredLayoutWithSkimmers(next);
  const reason=layout.access.reason || Object.values(layout.comfort.availability).find(a=>!a.available)?.reason || "Posizione non disponibile.";
  if (layout.status === "UNAVAILABLE" || !layout.access.placement) return { move:null, reason };
  const anchor=layout.access.corner ? {x:layout.access.footprint[0]![0],z:layout.access.footprint[0]![1]} : layout.access.placement;
  const bounds=outlineBounds(configuredOutline(config));
  const left=(bounds.spanX>=bounds.spanZ ? anchor.z-(bounds.minZ+bounds.maxZ)/2 : anchor.x-(bounds.minX+bounds.maxX)/2)<0;
  const position={x:anchor.x,z:anchor.z};
  return { move:{position,option:{outline:configuredOutline(config),layout,skimmers,footprint:layout.access.footprint,
    available:true,reason:"",mirrored:!!config.internalStairMirrored,position:left?-1:1,side:left?"left":"right"}},reason:"" };
}

/** Pointer movement follows the visible footprint, not the wall pivot. On a
 * narrow L arm those two anchors move in opposite directions when yaw changes. */
export function internalStairDragOrigin(option: Option): InternalStairPosition {
  const access=option.layout.access;
  return access.placement && !access.corner ? access.placement : centre(option.footprint);
}

export type StairPlanTarget = {
  point: InternalStairPosition;
  kind: "corner" | "wall" | "shelf";
  move: StairMove | null;
  reason: string;
};

/** Destinations and their real rejection reasons use the same solver as 3D. */
export function internalStairPlanTargets(config: PoolConfig): StairPlanTarget[] {
  const automatic={...config,internalStairPosition:undefined};
  const plan=configuredLayoutWithSkimmers(automatic).layout;
  if(plan.comfort.elements.some(e=>!!e.steps?.length))return configuredInternalStairSides(automatic).map(option=>({
    point:centre(option.footprint),kind:"shelf",move:option.available?{option,mirrored:option.mirrored}:null,reason:option.reason,
  }));
  const outline=configuredOutline(config);
  const exclusion=config.system==='infinity'&&config.infinityEdge?infinityExclusion(outline,config.infinityEdge,config.shape):null;
  const explain=(point:InternalStairPosition,result:ReturnType<typeof moveInternalStair>)=>{
    if(result.move||!exclusion)return result;
    const onEdge=exclusion.edgeIndices?.some(index=>{
      const a=outline[index]!,b=outline[(index+1)%outline.length]!,dx=b[0]-a[0],dz=b[1]-a[1];
      const f=Math.max(0,Math.min(1,((point.x-a[0])*dx+(point.z-a[1])*dz)/(dx*dx+dz*dz)));
      return Math.hypot(point.x-a[0]-dx*f,point.z-a[1]-dz*f)<.02;
    })??Math.abs((exclusion.axis==='x'?point.x:point.z)-exclusion.coordinate)<.02;
    return onEdge?{...result,reason:"Lato Infinity: questa posizione deve rimanere libera."}:result;
  };
  if(config.internalStairType==="corner")return outline.flatMap((point,index)=>{
    const a=outline[(index+outline.length-1)%outline.length]!,b=outline[(index+1)%outline.length]!;
    const ax=a[0]-point[0],az=a[1]-point[1],bx=b[0]-point[0],bz=b[1]-point[1];
    if(Math.abs((ax*bx+az*bz)/(Math.hypot(ax,az)*Math.hypot(bx,bz)))>.001)return [];
    const p={x:point[0],z:point[1]},result=explain(p,moveInternalStair(config,p));
    return [{point:p,kind:"corner" as const,...result}];
  });
  const width=plan.access.width||config.internalStairWidth||1.15;
  return mergedWallChords(outline,.06).filter(wall=>wall.length>=width+.2).map(wall=>{
    const point={x:(wall.a[0]+wall.b[0])/2,z:(wall.a[1]+wall.b[1])/2};
    const samples=[.5,(width/2+.02)/wall.length,1-(width/2+.02)/wall.length];
    const results=samples.map(f=>moveInternalStair(config,{x:wall.a[0]+(wall.b[0]-wall.a[0])*f,z:wall.a[1]+(wall.b[1]-wall.a[1])*f}));
    return {point,kind:"wall" as const,...explain(point,results.find(result=>result.move)??results[0]!)};
  });
}

/** Only real, fully validated corner poses; derived once per configuration. */
export function cornerStairMoves(config: PoolConfig): StairMove[] {
  return config.internalStairType==="corner" ? internalStairPlanTargets(config).flatMap(target=>target.move?[target.move]:[]) : [];
}

/** Snap the visual handle to the nearest valid visual target. This also avoids
 * selecting an L's reflex vertex when aiming at a neighbouring valid flight. */
export function moveInternalStairFromPlan(config: PoolConfig, point: InternalStairPosition, corners: readonly StairMove[] = cornerStairMoves(config)) {
  if(config.internalStairType!=="corner")return moveInternalStair(config,point);
  const target=corners.reduce<StairMove|null>((best,move)=>{
    const c=centre(move.option.footprint),b=best?centre(best.option.footprint):null;
    return !b||Math.hypot(c.x-point.x,c.z-point.z)<Math.hypot(b.x-point.x,b.z-point.z) ? move : best;
  },null);
  if(target){
    const c=centre(target.option.footprint),reach=Math.max(target.option.layout.access.width,target.option.layout.access.run)*.8+.1;
    if(Math.hypot(c.x-point.x,c.z-point.z)<=reach)return {move:target,reason:""};
  }
  return {move:null,reason:moveInternalStair(config,point).reason||"Posizione non disponibile."};
}

/** Turning follows the next wall/corner, keeping the flight attached and inward. */
export function rotateInternalStair(config: PoolConfig, direction: -1 | 1, corners?: readonly StairMove[]) {
  const plan=configuredLayoutWithSkimmers(config).layout;
  if (plan.comfort.elements.some(e=>!!e.steps?.length)) return {move:null,reason:"La scala integrata alla spiaggetta mantiene il suo orientamento. Trascina per scegliere SX o DX."};
  if (!plan.access.placement) return {move:null,reason:plan.access.reason||"Posizione non disponibile."};
  if(plan.access.corner){
    const positions=corners??cornerStairMoves(config);
    if(positions.length<2)return {move:null,reason:"Nessuna parete compatibile in questa direzione."};
    const anchor=plan.access.footprint[0]!;
    let current=0;
    positions.forEach((move,index)=>{const p=move.position!,b=positions[current]!.position!;
      if(Math.hypot(p.x-anchor[0],p.z-anchor[1])<Math.hypot(b.x-anchor[0],b.z-anchor[1]))current=index;});
    const outline=configuredOutline(config),area=outline.reduce((sum,p,i)=>{const q=outline[(i+1)%outline.length]!;return sum+p[0]*q[1]-q[0]*p[1];},0);
    const step=direction*(area>=0?1:-1);
    return {move:positions[(current+step+positions.length)%positions.length]!,reason:""};
  }
  const outline=configuredOutline(config),wall=nearestStairWall(outline,plan.access.placement,plan.access.width);
  if(!wall)return {move:null,reason:"Nessuna parete compatibile in questa direzione."};
  const walls=mergedWallChords(outline,.06),current=walls.findIndex(w=>Math.hypot(w.a[0]-wall.a[0],w.a[1]-wall.a[1])<1e-6);
  const area=outline.reduce((sum,p,i)=>{const q=outline[(i+1)%outline.length]!;return sum+p[0]*q[1]-q[0]*p[1];},0);
  const step=direction*(area>=0?1:-1),fraction=wall.along/wall.length;
  for(let distance=1;distance<walls.length;distance++){
    const next=walls[(current+step*distance+walls.length)%walls.length]!;
    if(next.length<plan.access.width+.2)continue;
    const result=moveInternalStair(config,{x:next.a[0]+(next.b[0]-next.a[0])*fraction,z:next.a[1]+(next.b[1]-next.a[1])*fraction});
    if(result.move&&Math.abs(Math.sin((result.move.option.layout.access.placement!.rotation-plan.access.placement.rotation)/2))>1e-5)return result;
  }
  return {move:null,reason:"Nessuna parete compatibile in questa direzione."};
}

export function nudgeInternalStair(config: PoolConfig, direction: -1 | 1, distance = .1) {
  const plan=configuredLayoutWithSkimmers(config).layout;
  if (plan.access.corner || !plan.access.placement) return rotateInternalStair(config,direction);
  const wall=nearestStairWall(configuredOutline(config),plan.access.placement);
  return wall ? moveInternalStair(config,{x:plan.access.placement.x+wall.tx*distance*direction,z:plan.access.placement.z+wall.tz*distance*direction}) : {move:null,reason:"Posizione non disponibile."};
}
