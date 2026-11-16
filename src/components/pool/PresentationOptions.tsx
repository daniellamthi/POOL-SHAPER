import { useI18n } from "@/lib/i18n";
import { useConfigurator } from "@/lib/pool/context";
import { pavingMaterialsForPool, pavingId } from "@/lib/pool/presentation";
import { isReferenceFinish, isPorcelainReference } from "@/lib/pool/reference-finishes";
import { ReferenceFinishSwatch } from "./ReferenceFinishSwatch";
import { PorcelainFinishChoice } from "./PorcelainFinishChoice";

export function PavingOptions() {
  const { t } = useI18n();
  const { config, setPaving } = useConfigurator();
  return <section className="flex flex-col gap-3 border-t border-hairline pt-6">
    <h3 className="label-xs">{t("Pavimentazione · indipendente dal bordo")}</h3>
    {config.system === "infinity" ? <p className="text-xs text-muted-foreground">{t("La scelta è salvata per la presentazione finale. Il contesto Simons Town realtime rimane invariato.")}</p> : null}
    <div className="grid gap-2" role="group" aria-label={t("Pavimentazione")}>
      {pavingMaterialsForPool(config.poolType).filter(p => config.poolType === "above-ground" || !isPorcelainReference(p.id)).map(p =>
        config.poolType === "in-ground" && p.id === "gres" ? <PorcelainFinishChoice key={p.id} value={pavingId(config.paving)} onSelect={setPaving} /> :
        <button key={p.id} type="button" aria-pressed={pavingId(config.paving) === p.id}
        onClick={() => setPaving(p.id)} className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition-colors ${pavingId(config.paving) === p.id ? "border-brand bg-brand/10" : "border-hairline bg-card"}`}>
        {isReferenceFinish(p.id) ? <ReferenceFinishSwatch id={p.id} className="size-10 shrink-0 rounded-md" /> : <span aria-hidden className="size-10 shrink-0 rounded-md border border-black/10" style={{background: p.color}} />}
        <span><span className="block text-sm">{t(p.label)}</span><span className="block text-xs text-muted-foreground">{t(p.note)}</span></span>
      </button>)}
    </div>
  </section>;
}
