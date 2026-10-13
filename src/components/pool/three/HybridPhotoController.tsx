import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import { useProgress } from "@react-three/drei";
import type { Outline } from "@/lib/pool/types";
import type { RectangleInfinityZone } from "@/lib/pool/infinity-edge";
import { hybridEnvironmentPose, type HybridPhotoRequest } from "@/lib/pool/hybrid-photo";
import { coastalCamera, coastFrame } from "./coastalLayout";

/** Raster export deliberately preserves water, LEDs, covers and shader materials.
 * Mounts only in the explicit photo dialog; no path-tracer substitutions. */
export default function HybridPhotoController({request,bounds,outline,ground,rim,water,zone,environmentReady,time}:{
  request:HybridPhotoRequest; bounds:Outline; outline:Outline; ground:number; rim:number; water:number;
  zone:RectangleInfinityZone|null; environmentReady:boolean; time:string;
}) {
  const {gl,scene,camera,size}=useThree();
  const loading=useProgress(s=>s.active);
  const settled=useRef(0), elapsed=useRef(0), frames=useRef(0), handled=useRef(request.exportId), readySent=useRef(false);
  useLayoutEffect(()=>{
    if(!(camera instanceof PerspectiveCamera))return;
    let pose: import("@/lib/pool/camera").CameraPose & {fov:number}=hybridEnvironmentPose(bounds,ground,rim,size.width/size.height,request.view,request.environment);
    if(zone&&request.environment==="panorama-infinity"){
      pose=coastalCamera(outline,zone,water,size.width/size.height,50,{outset:.55,y:rim});
      const frame=coastFrame(zone);
      const edgeSpan=Math.hypot(zone.end[0]-zone.start[0],zone.end[1]-zone.start[1]);
      // Small, controlled lateral move within the existing coastal apron.
      // The original wizard camera and the configured edge never change.
      const lateral=Math.min(1.2,edgeSpan*.1);
      pose={...pose,position:[pose.position[0]+frame.nz*lateral,pose.position[1],pose.position[2]-frame.nx*lateral]};
      if(request.view==="raised")pose={...pose,position:[pose.position[0],pose.position[1]+1.2,pose.position[2]]};
      if(request.view==="waterline") {
        // Move to the near rim, not down into the outer terrain at the hero's
        // distant standoff. This is a detail view, not a whole-pool elevation.
        const f=coastFrame(zone);
        const length=-Math.min(...outline.map(([x,z])=>(x-f.x)*f.nx+(z-f.z)*f.nz));
        pose={fov:50,position:[f.x-f.nx*(length+1.2),rim+.8,f.z-f.nz*(length+1.2)],
          target:[f.x,water+.05,f.z]};
      }
    }
    camera.up.set(0,1,0);camera.position.set(...pose.position);camera.lookAt(...pose.target);
    camera.fov=pose.fov;camera.aspect=size.width/size.height;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    settled.current=0;readySent.current=false;request.onReady(false);
  },[camera,bounds,outline,ground,rim,water,zone,size.width,size.height,request.view,request.environment,environmentReady,loading,time]);
  useFrame((_,delta)=>{
    gl.render(scene,camera);
    // Tab suspension is not a rendered-frame sample. Reset the window rather
    // than reporting minutes of inactivity as GPU/rendering work.
    if(delta>0.25||document.hidden){elapsed.current=0;frames.current=0;}
    else {elapsed.current+=delta;frames.current++;}
    if(!loading&&environmentReady)settled.current+=delta;else settled.current=0;
    if(settled.current>2&&!readySent.current){readySent.current=true;request.onReady(true);}
    if(elapsed.current>=3){
      request.onMetrics({frameMs:1000*elapsed.current/frames.current,calls:gl.info.render.calls,textures:gl.info.memory.textures,
        geometries:gl.info.memory.geometries,dpr:gl.getPixelRatio(),samples:frames.current});
      elapsed.current=0;frames.current=0;
    }
    if(request.exportId===handled.current)return;
    handled.current=request.exportId;
    if(!readySent.current){request.onCapture(null);return;}
    const ratio=gl.getPixelRatio();
    try {
      const limit=Math.min(2560,gl.capabilities.maxTextureSize);
      const next=Math.min(request.exportWidth,limit)/Math.max(1,size.width);
      gl.setPixelRatio(Math.min(next,limit/Math.max(1,size.height)));
      gl.render(scene,camera);
      request.onCapture(gl.domElement.toDataURL("image/png"));
    }catch{request.onCapture(null);}finally{gl.setPixelRatio(ratio);gl.render(scene,camera);}
  },1);
  return null;
}
