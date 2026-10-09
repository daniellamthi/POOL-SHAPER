import {useEffect,useMemo} from "react";
import type {Texture} from "three";
import {GroundedSkybox} from "three/addons/objects/GroundedSkybox.js";
import type { SceneTimeOfDay } from "./PoolScene";
import { COAST_PHOTO_CAPTURE } from "./coastalLayout";

/** Spherical photographic environment with its lower hemisphere projected onto
 * a ground plane below the real near terrain. No billboard or camera-facing quad. */
export function CoastalPhotoBackdrop({map,rotation,timeOfDay="day"}:{map:Texture;rotation:number;timeOfDay?:SceneTimeOfDay}) {
  const dome=useMemo(()=>{
    const mesh=new GroundedSkybox(map,COAST_PHOTO_CAPTURE.height,COAST_PHOTO_CAPTURE.radius,64);
    mesh.material.toneMapped=false;
    mesh.renderOrder=-1000;
    mesh.frustumCulled=false;
    return mesh;
  },[map]);
  useEffect(() => {
    dome.material.color.set(timeOfDay === "night" ? "#526579" : "#ffffff");
    dome.material.needsUpdate = true;
  }, [dome, timeOfDay]);
  useEffect(()=>()=>{dome.geometry.dispose();dome.material.dispose();},[dome]);
  return <primitive object={dome} position={[0,COAST_PHOTO_CAPTURE.eyeY,0]} rotation={[0,rotation,0]}/>;
}
