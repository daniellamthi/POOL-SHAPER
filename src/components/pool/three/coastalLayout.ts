import { BufferGeometry, Color, Float32BufferAttribute, MathUtils, PlaneGeometry } from "three";
import type { Outline } from "@/lib/pool/types";
import type { RectangleInfinityZone } from "@/lib/pool/infinity-edge";
import type { CameraPose } from "@/lib/pool/camera";

export const COAST_SEA_Y = -5;
// Simon's Town Rocks: sea-facing sector u=.53; measured sun u=.6328125, v=.591796875.
export const COAST_PHOTO_YAW = -1.3823;
export function coastalPhotoRotation(zone:RectangleInfinityZone) {
  return Math.atan2(zone.normal[0],zone.normal[1])+COAST_PHOTO_YAW;
}
export function coastalPhotoSun(zone:RectangleInfinityZone,distance:number):[number,number,number] {
  const azimuth=(.6328125-.5)*Math.PI*2-coastalPhotoRotation(zone);
  const elevation=(.591796875-.5)*Math.PI;
  return [Math.cos(azimuth)*Math.cos(elevation)*distance,Math.sin(elevation)*distance,Math.sin(azimuth)*Math.cos(elevation)*distance];
}
export function coastFrame(zone: RectangleInfinityZone) {
  return { x: (zone.start[0]+zone.end[0])/2, z: (zone.start[1]+zone.end[1])/2,
    nx: zone.normal[0], nz: zone.normal[1] };
}
export function coastalCamera(
  outline: Outline,
  zone: RectangleInfinityZone,
  waterY: number,
  aspect: number,
  fov: number,
): CameraPose & { fov: number } {
  const f = coastFrame(zone);
  const local = outline.map(([x, z]) => ({
    u: (x - f.x) * f.nz - (z - f.z) * f.nx,
    v: (x - f.x) * f.nx + (z - f.z) * f.nz,
  }));
  const width = Math.max(...local.map((p) => p.u)) - Math.min(...local.map((p) => p.u));
  const length = -Math.min(...local.map((p) => p.v));
  const safeAspect = Math.max(0.25, aspect);
  const halfHorizontal = Math.atan(Math.tan((fov * Math.PI) / 360) * safeAspect);
  // POOL -> INFINITY EDGE -> LANDSCAPE. The pool must read whole, so fit its
  // NEAR wall (where it appears widest) with 0.8m either side, from a
  // standoff behind it that stays inside the seven-metre photographic-site
  // apron -- backing away further exposes the underside of the site.
  const standoff = MathUtils.clamp((width + 1.6) / 2 / Math.tan(halfHorizontal), 2.8, 6.5);
  const neededHorizontal = 2 * Math.atan((width + 1.6) / (2 * standoff));
  const fittedFov = Math.min(
    78,
    Math.max(fov, (2 * Math.atan(Math.tan(neededHorizontal / 2) / safeAspect) * 180) / Math.PI),
  );
  const halfVertical = (fittedFov * Math.PI) / 360;
  // Near coping in the lower frame, the vanishing edge mid-frame, horizon and
  // landscape in the upper third: the eye sits high enough to see into the
  // basin and pitches down by a fixed share of the vertical field of view.
  const height = Math.max(1.6, standoff * Math.tan(Math.min(1.45 * halfVertical, 1.2)));
  const pitch = 0.62 * halfVertical;
  const distance = length + standoff;
  const y = waterY + height;
  return {
    fov: fittedFov,
    position: [f.x - f.nx * distance, y, f.z - f.nz * distance],
    target: [f.x, y - Math.tan(pitch) * distance, f.z],
  };
}
export function coastNoise(x:number,z:number) {
  const hash=(a:number,b:number)=>{const h=Math.sin(a*127.1+b*311.7)*43758.5453;return h-Math.floor(h);};
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  return MathUtils.lerp(MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),u),MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),u),v);
}
/** Retain the surveyed near grade; the distant selected half-space descends to sea. */
export function coastalGrade(geometry:BufferGeometry, zone:RectangleInfinityZone) {
  const f=coastFrame(zone),p=geometry.getAttribute("position");
  for(let i=0;i<p.count;i++) {
    const v=(p.getX(i)-f.x)*f.nx+(p.getZ(i)-f.z)*f.nz;
    p.setY(i,MathUtils.lerp(p.getY(i),COAST_SEA_Y-1.2,MathUtils.smoothstep(v,4.5,15)));
  }
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
}

/** Original asymmetric coastal headlands. Cliff terraces replace radial hill domes. */
export function createCoastalHeadland(side:-1|1) {
  const g=new PlaneGeometry(72,112,112,144);g.rotateX(-Math.PI/2);
  const p=g.getAttribute("position"),colors:number[]=[];
  const limestone=new Color("#958975"),scrub=new Color("#4b5038"),fracture=new Color("#625c50");
  for(let i=0;i<p.count;i++) {
    const a=p.getX(i)+42,z=p.getZ(i)+49;
    const bend=side===-1 ? 7+z*.035+2*Math.sin(z*.065) : 10+z*.045+3*Math.sin(z*.043+1.1);
    const edge=bend+3.4*(coastNoise(z*.12,side*4)-.5)+.7*(coastNoise(z*.7,side)-.5);
    const inland=a-edge;
    const envelope=MathUtils.smoothstep(z,-3,10)*(1-MathUtils.smoothstep(z,68,104));
    const cliff=MathUtils.smoothstep(inland,-2,4);
    const shoulder=MathUtils.smoothstep(inland,2.5,14);
    const strata=1.5*coastNoise(a*.33,z*.27)+.5*coastNoise(a*.9,z*.8);
    const peak=(center:number,width:number)=>Math.exp(-(((z-center)/width)**2));
    const ridge=side===-1
      ? 1.8+5.5*peak(17,11)+9*peak(51,17)+3*peak(79,8)
      : 2+3.4*peak(12,9)+7.5*peak(38,13)+5*peak(75,12);
    const height=ridge*cliff+shoulder*(1.2+1.8*coastNoise(a*.065,z*.05));
    const y=COAST_SEA_Y-1+(height+strata*cliff)*envelope;
    p.setXYZ(i,side*a,y,z);
    const vegetation=MathUtils.smoothstep(inland,3,10)*MathUtils.smoothstep(coastNoise(a*.36,z*.31),.35,.66);
    const c=limestone.clone().lerp(scrub,vegetation*.9).lerp(fracture,coastNoise(a*1.5,z*1.7)*.35);
    c.multiplyScalar(.85+.3*coastNoise(a*.95,z*1.05));colors.push(c.r,c.g,c.b);
  }
  // Mirroring X reverses winding; correct it rather than enabling double-sided rock.
  if(side===-1){const index=g.getIndex()!;for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}}
  g.setAttribute("color",new Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
export function createDistantIsland() {
  const g=new PlaneGeometry(55,20,64,16);g.rotateX(-Math.PI/2);const p=g.getAttribute("position");
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),shore=Math.max(0,1-(x/28)**2-(z/11)**2);
    p.setY(i,COAST_SEA_Y-.4+shore*(2.1+1.3*coastNoise(x*.17,z*.2)));
  }
  g.computeVertexNormals();return g;
}
