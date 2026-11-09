import { configuredLayoutWithSkimmers } from "./resolved-layout";
import { configuredInternalStairSides } from "./internal-stair-options";
import { configuredOutline } from "./configured-outline";
import { outlineBounds } from "./geometry";
import { nearestStairWall } from "./stair-position";
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

/** Turning follows the next wall/corner, keeping the flight attached and inward. */
export function rotateInternalStair(config: PoolConfig, direction: -1 | 1) {
  const plan=configuredLayoutWithSkimmers(config).layout;
  if (!plan.access.placement || plan.comfort.elements.some(e=>!!e.steps?.length)) return {move:null,reason:"La scala integrata alla spiaggetta mantiene il suo orientamento. Trascina per scegliere SX o DX."};
  const p=plan.access.corner ? {x:plan.access.footprint[0]![0],z:plan.access.footprint[0]![1]} : plan.access.placement;
  const b=outlineBounds(configuredOutline(config)), cx=(b.minX+b.maxX)/2, cz=(b.minZ+b.maxZ)/2;
  const x=(p.x-cx)/b.spanX, z=(p.z-cz)/b.spanZ;
  const result=moveInternalStair(config,{x:cx-direction*z*b.spanX,z:cz+direction*x*b.spanZ});
  if (result.move && Math.abs(Math.sin((result.move.option.layout.access.placement!.rotation-plan.access.placement.rotation)/2))<1e-5)
    return {move:null,reason:"Nessuna parete compatibile in questa direzione."};
  return result;
}

export function nudgeInternalStair(config: PoolConfig, direction: -1 | 1, distance = .1) {
  const plan=configuredLayoutWithSkimmers(config).layout;
  if (plan.access.corner || !plan.access.placement) return rotateInternalStair(config,direction);
  const wall=nearestStairWall(configuredOutline(config),plan.access.placement);
  return wall ? moveInternalStair(config,{x:plan.access.placement.x+wall.tx*distance*direction,z:plan.access.placement.z+wall.tz*distance*direction}) : {move:null,reason:"Posizione non disponibile."};
}
