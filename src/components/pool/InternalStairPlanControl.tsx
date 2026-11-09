import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import { AccessPlanPreview } from './AccessPlanPreview';
import { useI18n } from '@/lib/i18n';
import { outlineBounds } from '@/lib/pool/geometry';
import { currentInternalStairOption, moveInternalStair, nudgeInternalStair, rotateInternalStair, type StairMove } from '@/lib/pool/internal-stair-position';
import type { InternalStairPosition, PoolConfig } from '@/lib/pool/types';

export function InternalStairPlanControl({ config, onPositionChange, onSideChange }: {
  config: PoolConfig;
  onPositionChange: (position: InternalStairPosition | undefined) => void;
  onSideChange: (mirrored: boolean) => void;
}) {
  const { t }=useI18n(), helpId=useId();
  const option=useMemo(()=>currentInternalStairOption(config),[config]);
  const rotations=useMemo(()=>[-1,1].map(direction=>rotateInternalStair(config,direction as -1|1)),[config]);
  const [preview,setPreview]=useState<typeof option|null>(null), [notice,setNotice]=useState('');
  const drag=useRef<{pointer:number; x:number; y:number; offset:InternalStairPosition; moved:boolean}|null>(null);
  const frame=useRef<number|undefined>(undefined);
  const point=(event:ReactPointerEvent<SVGGElement>):InternalStairPosition|null=>{
    const svg=event.currentTarget.ownerSVGElement, matrix=svg?.getScreenCTM();
    if(!svg||!matrix)return null;
    const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    const b=outlineBounds(option.outline), scale=Math.min(208/Math.max(b.spanX,.1),112/Math.max(b.spanZ,.1));
    return {x:(p.x-120)/scale+(b.minX+b.maxX)/2,z:(p.y-72)/scale+(b.minZ+b.maxZ)/2};
  };
  const apply=(move:StairMove|null,reason='')=>{
    if(!move){setNotice(reason);return;}
    if(move.mirrored!==undefined)onSideChange(move.mirrored);else onPositionChange(move.position);
    setNotice('Posizione della scala aggiornata.');
  };
  const cancel=()=>{
    if(frame.current!==undefined)cancelAnimationFrame(frame.current);
    frame.current=undefined;drag.current=null;setPreview(null);
  };
  useEffect(()=>()=>{if(frame.current!==undefined)cancelAnimationFrame(frame.current);},[]);
  const target=(event:ReactPointerEvent<SVGGElement>)=>{
    const p=point(event), active=drag.current;
    return p&&active ? {x:p.x-active.offset.x,z:p.z-active.offset.z}:null;
  };
  const integrated=option.layout.comfort.elements.some(e=>!!e.steps?.length);
  return <div className="grid gap-3" data-stair-plan-control>
    <AccessPlanPreview option={preview??option} interaction={option.available ? {
      role:'button',tabIndex:0,'aria-label':t('Trascina la scala lungo il perimetro'),'aria-describedby':helpId,
      className:'cursor-grab touch-none outline-none focus-visible:stroke-brand focus-visible:stroke-2',
      onPointerDown:event=>{
        if(event.button!==0)return;
        const p=point(event);if(!p)return;
        const anchor=option.layout.access.corner ? option.layout.access.footprint[0] : option.layout.access.placement ? [option.layout.access.placement.x,option.layout.access.placement.z] : null;
        const centre=anchor ?? [option.footprint.reduce((s,p)=>s+p[0]/option.footprint.length,0),option.footprint.reduce((s,p)=>s+p[1]/option.footprint.length,0)];
        drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,offset:{x:p.x-centre[0]!,z:p.z-centre[1]!},moved:false};
        event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();setNotice('');
      },
      onPointerMove:event=>{
        if(!drag.current||drag.current.pointer!==event.pointerId)return;
        if(Math.hypot(event.clientX-drag.current.x,event.clientY-drag.current.y)<4&&!drag.current.moved)return;
        drag.current.moved=true;const p=target(event);if(!p)return;
        if(frame.current!==undefined)cancelAnimationFrame(frame.current);
        frame.current=requestAnimationFrame(()=>{frame.current=undefined;const result=moveInternalStair(config,p);if(result.move)setPreview(result.move.option);setNotice(result.reason);});
      },
      onPointerUp:event=>{
        if(!drag.current||drag.current.pointer!==event.pointerId)return;
        const p=target(event), moved=drag.current.moved;
        cancel();if(moved&&p){const result=moveInternalStair(config,p);apply(result.move,result.reason);}
        if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
      },
      onPointerCancel:cancel,onLostPointerCapture:cancel,
      onKeyDown:event=>{
        if(event.key==='Escape'){cancel();setNotice('Spostamento annullato.');return;}
        if(event.key==='Home'){event.preventDefault();cancel();onPositionChange(undefined);return;}
        const direction=event.key==='ArrowLeft'||event.key==='ArrowUp'||(event.key.toLowerCase()==='r'&&event.shiftKey)?-1:1;
        if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','r','R'].includes(event.key)){
          event.preventDefault();const result=['ArrowLeft','ArrowRight'].includes(event.key)?nudgeInternalStair(config,direction,event.shiftKey?.5:.1):rotateInternalStair(config,direction);apply(result.move,result.reason);
        }
      },
    }:undefined} />
    <p id={helpId} className="text-xs leading-relaxed text-muted-foreground">{t(integrated
      ? 'La scala integrata alla spiaggetta mantiene il suo orientamento. Trascina per scegliere SX o DX.'
      : config.internalStairType==='corner' ? 'Trascina la scala su un angolo libero. La rotazione mantiene i gradini aderenti alle pareti.'
      : 'Trascina la scala lungo il perimetro. Si aggancia alla parete e ruota verso l’interno.')}</p>
    <div className="flex flex-wrap gap-2">
      {rotations.map((result,index)=>{const Icon=index?RotateCw:RotateCcw;return <button key={index} type="button"
        disabled={!result.move} title={result.reason?t(result.reason):undefined} aria-label={t(index?'Ruota verso la parete successiva':'Ruota verso la parete precedente')}
        onClick={()=>apply(result.move,result.reason)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-xs transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-45">
        <Icon className="size-4" aria-hidden="true" />{t(index?'Ruota a destra':'Ruota a sinistra')}
      </button>;})}
      <button type="button" disabled={!config.internalStairPosition} onClick={()=>onPositionChange(undefined)} className="min-h-11 px-2 text-xs underline underline-offset-4 disabled:text-muted-foreground disabled:no-underline">{t('Posizione automatica')}</button>
    </div>
    <p className="text-[11px] text-muted-foreground">{t('Da tastiera: ← → sposta, ↑ ↓ ruota, Esc annulla, Home ripristina.')}</p>
    <p role="status" aria-live="polite" className="min-h-4 text-xs text-muted-foreground">{notice?t(notice):!option.available?t(option.reason):''}</p>
  </div>;
}
