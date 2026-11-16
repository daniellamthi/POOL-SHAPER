import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useI18n } from "@/lib/i18n";
import type { Mesh, Material } from "three";
import { LinearSRGBColorSpace, WebGLRenderTarget } from "three";

/** Let the driver compile a new lighting variant in parallel before its first
 * draw would synchronously wait on every program. React/controls remain live;
 * geometry, material settings and the last presented frame are retained. */
export function ShaderPreparation({ enabled, signature, onPreparing }: {
  enabled:boolean;signature:string;onPreparing:(preparing:boolean)=>void;
}) {
  const get = useThree(state=>state.get);
  const { t } = useI18n();
  const [pending,setPending] = useState(false);
  const [announce,setAnnounce] = useState(false);
  const prepared=useRef(new Set<string>());
  // Three's opaque transmission/mirror passes use linear output without the
  // canvas tone mapper. They are different programs, even for the same mesh.
  const linearOutput=useMemo(()=>new WebGLRenderTarget(1,1,{colorSpace:LinearSRGBColorSpace}),[]);
  useEffect(()=>()=>linearOutput.dispose(),[linearOutput]);
  useEffect(()=>{
    if (!pending) {setAnnounce(false);return;}
    const timer = window.setTimeout(()=>setAnnounce(true),120);
    return ()=>window.clearTimeout(timer);
  },[pending]);
  useLayoutEffect(()=>{
    const state=get();
    if(!enabled || prepared.current.has(signature) || state.frameloop === "never" || !state.gl.extensions.has("KHR_parallel_shader_compile")) {setPending(false);return;}
    const previousMode=state.frameloop;
    const elapsed=state.clock.elapsedTime;
    let live=true,released=false;
    const started=performance.now();
    const release=()=>{
      if(released)return;
      released=true;
      onPreparing(false);
      state.setFrameloop(previousMode);
      state.clock.elapsedTime=elapsed;
      state.invalidate();
    };
    onPreparing(true);
    state.setFrameloop("never");
    // R3F's loop still executes queued demand frames even in "never" mode.
    // A pending invalidation must not draw the just-linked programs before
    // parallel compilation completes. Only this root's queue is drained;
    // release() schedules its fresh frame after restoring the original mode.
    state.internal.frames=0;
    setPending(true);
    const finish=(success=true)=>{
      if(!live)return;
      if(success){
        if(prepared.current.size>=32)prepared.current.delete(prepared.current.values().next().value!);
        prepared.current.add(signature);
      }
      release();setPending(false);
      if(import.meta.env.DEV)console.debug("[Pool3D shader preparation]",JSON.stringify({durationMs:Number((performance.now()-started).toFixed(1)),parallel:true}));
    };
    const prepare=async()=>{
      // Present the DOM change before any driver work. Compile only visible
      // material/geometry variants, yielding between them; Three.compile on
      // the whole scene also visits retained, invisible construction meshes.
      // Embedded/background webviews may throttle rAF even while reporting
      // visible. Shader readiness must not depend on presentation frames.
      const yieldTask=()=>new Promise<void>(resolve=>{
        const channel=new MessageChannel();
        channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};
        channel.port2.postMessage(null);
      });
      await yieldTask();await yieldTask();
      const meshes:Mesh[]=[];
      const seen=new Set<string>();
      state.scene.traverseVisible(object=>{
        const mesh=object as Mesh;
        if(!mesh.isMesh || !mesh.layers.test(state.camera.layers))return;
        const materials=(Array.isArray(mesh.material)?mesh.material:[mesh.material]) as Material[];
        const variant=Object.keys(mesh.geometry.attributes).sort().join(",")+":"+object.type;
        const key=materials.map(material=>material.uuid).join(",")+":"+variant;
        if(!seen.has(key)){seen.add(key);meshes.push(mesh);}
      });
      let sliceStarted=performance.now();
      for(const mesh of meshes){
        if(!live)return;
        const previousTarget=state.gl.getRenderTarget();
        try {
          state.gl.setRenderTarget(null); state.gl.compile(mesh,state.camera,state.scene);
          state.gl.setRenderTarget(linearOutput); state.gl.compile(mesh,state.camera,state.scene);
        } finally { state.gl.setRenderTarget(previousTarget); }
        if(performance.now()-sliceStarted>4){await yieldTask();sliceStarted=performance.now();}
      }
      // Wait once for the submitted batch, not once per material. Background
      // webviews throttle timers; a timer per mesh serialized parallel driver
      // work into a minute-long queue. MessageChannel stays cooperative without
      // depending on presentation frames or a throttled timer.
      // Raw handles also survive React replacing/disposal of a material,
      // unlike Three.compileAsync's mutable currentProgram timer callback.
      const context=state.gl.getContext();
      const extension=context.getExtension("KHR_parallel_shader_compile");
      const programs=(state.gl.info.programs ?? []).map(item=>item.program as WebGLProgram);
      const deadline=performance.now()+10000;
      while(live && extension && programs.some(program=>context.isProgram(program) && !context.getProgramParameter(program,extension.COMPLETION_STATUS_KHR))){
        if(performance.now()>deadline)throw new Error("Shader preparation timed out");
        await yieldTask();
      }
    };
    void prepare().then(()=>finish(),error=>{console.warn("[Pool3D] Shader preparation failed; using normal rendering.",error);finish(false);});
    return ()=>{live=false;release();};
  },[enabled,signature,get,onPreparing,linearOutput]);
  return enabled && announce && pending ? <Html fullscreen style={{pointerEvents:"none"}}>
    <div role="status" aria-live="polite" className="absolute left-1/2 top-28 -translate-x-1/2 rounded-full border border-border bg-background/95 px-5 py-3 text-sm text-foreground shadow-sm">
      {t("Preparazione della scena 3D")}
    </div>
  </Html> : null;
}
