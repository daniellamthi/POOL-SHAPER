import { PerspectiveCamera, Vector3 } from "three";
import type { Outline } from "./types";
import { outlineBounds } from "./geometry";

export type HybridView = "hero" | "raised" | "waterline";
export type HybridEnvironment = "studio" | "panorama-infinity" | "outdoor-villa" | "indoor-wellness";
export const HYBRID_VIEWS = [
  { id: "hero", label: "Hero" },
  { id: "raised", label: "Rialzata" },
  { id: "waterline", label: "Bordo acqua" },
] as const;

/** Asset gate: a reference containing another pool is not a calibrated plate. */
export const HYBRID_ENVIRONMENTS = [
  { id: "outdoor-villa", label: "Outdoor Villa", available: true, reason: "Fondale diurno · fotografia Max Vakhtbovych / Pexels." },
  { id: "indoor-wellness", label: "Indoor Wellness", available: true, reason: "Ambiente architettonico leggero · pietra, legno e luce indiretta." },
  { id: "panorama-infinity", label: "Panorama Infinity", available: true, reason: "Simons Town · solo per la configurazione Infinity." },
] as const;

export interface HybridMetrics { frameMs: number; calls: number; textures: number; geometries: number; dpr: number; samples: number }
export interface HybridPhotoRequest {
  environment: HybridEnvironment;
  view: HybridView;
  exportId: number;
  exportWidth: number;
  onCapture: (url: string | null) => void;
  onMetrics: (metrics: HybridMetrics) => void;
  onReady: (ready: boolean) => void;
  onError: (message: string) => void;
}

/** Fit actual bounds, including above-ground external access. No pool changes. */
export function hybridStudioPose(bounds: Outline, ground: number, rim: number, aspect: number, view: HybridView) {
  const b = outlineBounds(bounds);
  const target = new Vector3((b.minX+b.maxX)/2, (ground+rim)/2, (b.minZ+b.maxZ)/2);
  const direction = new Vector3(...(view === "raised" ? [0.7,1.35,1] : view === "waterline" ? [0.8,0.13,1] : [1,0.75,1]) as [number,number,number]).normalize();
  const right = new Vector3(0,1,0).cross(direction).normalize(), up = direction.clone().cross(right);
  const fov=42, vertical=Math.tan(fov*Math.PI/360)*0.84, horizontal=vertical*Math.max(.25,aspect);
  let distance=2;
  for(const x of [b.minX,b.maxX]) for(const z of [b.minZ,b.maxZ]) for(const y of [ground,rim+1.2]) {
    const point=new Vector3(x,y,z).sub(target), depth=point.dot(direction);
    distance=Math.max(distance,depth+Math.abs(point.dot(right))/horizontal,depth+Math.abs(point.dot(up))/vertical);
  }
  return {position:target.clone().addScaledVector(direction,distance).toArray() as [number,number,number], target:target.toArray() as [number,number,number],fov};
}

/** Photo-set camera: preserve the room's ceiling clearance and fit the real
 * pool/access bounds for portrait screens, without moving any pool geometry. */
export function hybridEnvironmentPose(bounds:Outline,ground:number,rim:number,aspect:number,view:HybridView,environment:HybridEnvironment) {
  const base=hybridStudioPose(bounds,ground,rim,aspect,view);
  if(environment!=="outdoor-villa"&&environment!=="indoor-wellness")return base;
  const outdoor=environment==="outdoor-villa",b=outlineBounds(bounds);
  const aboveGround = rim-ground > .5;
  const target:[number,number,number]=[(b.minX+b.maxX)/2,rim+(outdoor&&!aboveGround?1.25:.15),(b.minZ+b.maxZ)/2];
  const height=outdoor?(view==="waterline"?(aboveGround?3:1.7):view==="raised"?(aboveGround?6.5:3.6):(aboveGround?4.6:2.7)):(view==="waterline"?1.1:view==="raised"?4.6:3.2);
  // Solve from the closest candidate. The studio's elevated-camera distance
  // overfits a low photographic view and leaves the pool tiny in the room.
  let distance=2;
  const camera=new PerspectiveCamera(base.fov,Math.max(.25,aspect),.05,500);
  let position:[number,number,number]=[0,0,0];
  for(let attempt=0;attempt<40;attempt++) {
    position=[target[0]+distance*(outdoor?.32:.35),rim+height,target[2]+distance];
    camera.position.set(...position);camera.lookAt(...target);camera.updateMatrixWorld();
    const corners:Outline=[[b.minX,b.minZ],[b.maxX,b.minZ],[b.maxX,b.maxZ],[b.minX,b.maxZ]];
    const fits=corners.every(([x,z])=>[ground,rim+1.2].every(y=>{
      const p=new Vector3(x,y,z).project(camera);return Math.abs(p.x)<=.88&&Math.abs(p.y)<=.88&&p.z<1;
    }));
    if(fits)break;
    distance*=1.08;
  }
  return {position,target,fov:base.fov};
}
