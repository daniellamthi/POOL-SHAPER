import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useConfigurator } from "@/lib/pool/context";
import { HYBRID_ENVIRONMENTS, HYBRID_VIEWS, type HybridMetrics, type HybridView, type HybridEnvironment } from "@/lib/pool/hybrid-photo";
import type { SceneProps } from "./three/PoolScene";

const PoolScene=lazy(()=>import("./three/PoolScene"));

/** A view-only session of the canonical configuration. Neither rendering nor
 * download writes back to the project, its materials, or its optional features. */
export default function HybridPhotoStudio({scene,onClose}:{scene:SceneProps;onClose:()=>void}) {
  const {projectConfiguration}=useConfigurator();
  const source=useRef(scene).current;
  const snapshot=useRef(JSON.stringify(projectConfiguration)).current;
  const [view,setView]=useState<HybridView>("hero");
  const [environment,setEnvironment]=useState<HybridEnvironment>(source.system==="infinity"?"panorama-infinity":"outdoor-villa");
  const [time,setTime]=useState(source.system==="infinity"?source.sceneTime:"day");
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false);
  const [exportId,setExportId]=useState(0),[width,setWidth]=useState(1920);
  const [image,setImage]=useState<string|null>(null),[error,setError]=useState("");
  const [downloadUrl,setDownloadUrl]=useState<string|null>(null);
  useEffect(()=>{
    if(!image){setDownloadUrl(null);return;}
    const raw=atob(image.slice(image.indexOf(",")+1));
    const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    const url=URL.createObjectURL(new Blob([bytes],{type:"image/png"}));
    setDownloadUrl(url);return()=>URL.revokeObjectURL(url);
  },[image]);
  const [metrics,setMetrics]=useState<HybridMetrics|null>(null);
  const intact=snapshot===JSON.stringify(projectConfiguration);
  const onCapture=useCallback((url:string|null)=>{setImage(url);setBusy(false);setError(url?"":"Immagine non acquisita. Riprova con risoluzione 1280 px.");},[]);
  const hasLight=source.features.includes("ledLighting")||source.features.includes("stairLighting");
  const selectView=(next:HybridView)=>{setReady(false);setImage(null);setView(next);};
  const controls="min-h-11 rounded-xl border border-hairline px-3 py-2 text-sm disabled:opacity-45";
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}>
    <DialogContent className="flex h-auto max-h-[96dvh] w-[calc(100vw-16px)] max-w-[1500px] flex-col gap-2 overflow-hidden p-3 sm:h-[96dvh] sm:p-5">
      <DialogTitle className="pr-8 font-light">Photo Mode · {HYBRID_ENVIRONMENTS.find(e=>e.id===environment)?.label ?? "Studio"}</DialogTitle>
      <DialogDescription className="text-xs">La tua piscina 3D originale. Viste bloccate, nessuna ricostruzione AI. Download senza interfaccia.</DialogDescription>
      <div className="relative aspect-[4/3] min-h-0 flex-none overflow-hidden rounded-xl bg-viewport sm:aspect-auto sm:min-h-[220px] sm:flex-1" aria-label="Anteprima Photo Mode">
        <Suspense fallback={<p role="status">Caricamento della scena…</p>}>
          <PoolScene key={environment} {...source} photoMode={false} technicalView={false} showMeasurements={false}
            onSelectInfinitySide={undefined} cameraLocked focus="review" sceneTime={time}
            hybridPhoto={{environment,view,exportId,exportWidth:width,onCapture,onMetrics:setMetrics,onReady:setReady,onError:setError}} />
        </Suspense>
        {!ready?<div role="status" className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-white/95 px-3 py-2 text-xs text-black">{error||"Preparazione immagine…"}</div>:null}
      </div>
      <div className="max-h-[38dvh] shrink-0 overflow-y-auto space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Viste fotografiche">
          {HYBRID_VIEWS.map(v=><button key={v.id} className={controls+(view===v.id?" border-brand bg-brand/10":"")} aria-pressed={view===v.id}
            disabled={busy} onClick={()=>selectView(v.id)}>{v.label}</button>)}
          <button className={controls} disabled={busy||environment==="outdoor-villa"||(!hasLight&&environment!=="indoor-wellness")} aria-label="Cambia giorno e notte" title={environment==="outdoor-villa"?"Fondale fotografico disponibile solo di giorno":undefined} onClick={()=>{setReady(false);setImage(null);setTime(t=>t==="day"?"night":"day");}}>{time==="day"?"Giorno":"Notte"}</button>
        </div>
        <details><summary className="cursor-pointer text-sm">Ambientazioni disponibili</summary>
          <div className="grid gap-2 pt-2 sm:grid-cols-3">{HYBRID_ENVIRONMENTS.map(e=><button key={e.id} disabled={busy||(e.id==="panorama-infinity"&&source.system!=="infinity")} aria-pressed={environment===e.id}
            onClick={()=>{setReady(false);setImage(null);setError("");setMetrics(null);setEnvironment(e.id);if(e.id==="outdoor-villa")setTime("day");}} className={controls+" text-left"}>
            <strong className="block font-medium">{e.label}</strong>
            <span>{e.reason}</span>
          </button>)}</div>
        </details>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs">Larghezza immagine <select className={controls} aria-label="Risoluzione immagine" value={width} disabled={busy} onChange={e=>setWidth(Number(e.target.value))}>
            <option value={1280}>1280 px · leggera</option><option value={1920}>1920 px</option><option value={2560}>2560 px · alta</option>
          </select></label>
          <button className={controls+" bg-brand text-white"} disabled={!ready||busy||!intact} onClick={()=>{setBusy(true);setError("");setExportId(id=>id+1);}}>{busy?"Acquisizione…":"Genera immagine"}</button>
          {downloadUrl?<a className={controls} href={downloadUrl} download={`pool-shaper-${environment}-${view}-${time}.png`}>Scarica PNG</a>:null}
        </div>
        <p role="status" className="text-xs">{error||(!intact?"La configurazione è cambiata: chiudi e riapri Photo Mode.":image?"Immagine pronta, senza overlay. Nessun dato del progetto modificato.":"Esportazione raster ad alta risoluzione; non è un rendering offline.")}</p>
        {metrics?<details className="text-xs"><summary>Misure runtime</summary><p>{metrics.frameMs.toFixed(1)} ms/frame · {metrics.calls} draw call (render finale) · {metrics.textures} texture · {metrics.geometries} geometrie · DPR {metrics.dpr.toFixed(1)} · {metrics.samples} frame. Memoria GPU e tempi GPU non disponibili.</p></details>:null}
      </div>
    </DialogContent>
  </Dialog>;
}
