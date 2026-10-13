import { useConfigurator } from "@/lib/pool/context";
import { PAVING, pavingId } from "@/lib/pool/presentation";

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
