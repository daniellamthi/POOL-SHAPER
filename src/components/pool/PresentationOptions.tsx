import { useConfigurator } from "@/lib/pool/context";
import { PAVING, PREMIUM_ENVIRONMENTS, pavingId, premiumEnvironment } from "@/lib/pool/presentation";
import { createPhotoSceneSpec } from "@/lib/pool/photo-scene-spec";
import { useMemo } from "react";

export function PavingOptions() {
  const { config, setPaving } = useConfigurator();
  return <section className="flex flex-col gap-3 border-t border-hairline pt-6">
    <h3 className="label-xs">Pavimentazione · indipendente dal bordo</h3>
    {config.system === "infinity" ? <p className="text-xs text-muted-foreground">La scelta è salvata per la presentazione finale. Il contesto Simons Town realtime rimane invariato.</p> : null}
    <div className="grid gap-2" role="group" aria-label="Pavimentazione">
      {PAVING.map(p => <button key={p.id} type="button" aria-pressed={pavingId(config.paving) === p.id}
        onClick={() => setPaving(p.id)} className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition-colors ${pavingId(config.paving) === p.id ? "border-brand bg-brand/10" : "border-hairline bg-card"}`}>
        <span aria-hidden className="size-10 shrink-0 rounded-md border border-black/10" style={{background: p.color}} />
        <span><span className="block text-sm">{p.label}</span><span className="block text-xs text-muted-foreground">{p.note}</span></span>
      </button>)}
    </div>
  </section>;
}

export function PremiumPresentation() {
  const { config, setPremiumEnvironment, projectConfiguration } = useConfigurator();
  const spec = useMemo(() => createPhotoSceneSpec(projectConfiguration), [projectConfiguration]);
  return <section id="premium-presentation" className="flex flex-col gap-4 rounded-2xl border border-hairline bg-card/40 p-5">
    <h3 className="text-lg font-light">Ambiente premium</h3>
    <p className="text-sm text-muted-foreground">Scegli il contesto della futura vista fotografica. La piscina e la preview realtime non cambiano.</p>
    <div className="grid gap-2" role="group" aria-label="Ambiente premium">
      {PREMIUM_ENVIRONMENTS.map(e => <button type="button" key={e.id}
        aria-pressed={premiumEnvironment(config.premiumEnvironment) === e.id}
        onClick={() => setPremiumEnvironment(e.id)}
        className={`min-h-16 rounded-xl border p-3 text-left ${premiumEnvironment(config.premiumEnvironment) === e.id ? "border-brand bg-brand/10" : "border-hairline"}`}>
        <span className="block text-sm">{e.label}</span><span className="block text-xs text-muted-foreground">{e.description}</span>
      </button>)}
    </div>
    <button type="button" disabled aria-describedby="photo-mode-status" className="min-h-11 rounded-xl border border-hairline px-3 text-sm text-muted-foreground">Genera vista fotorealistica · prossimamente</button>
    <p id="photo-mode-status" className="text-xs leading-relaxed text-muted-foreground">Configurazione preparata: {spec.selection.dimensions.length} × {spec.selection.dimensions.width} m. Il rendering fotografico non è ancora disponibile. Nessuna immagine viene generata o reinterpretata.</p>
  </section>;
}
