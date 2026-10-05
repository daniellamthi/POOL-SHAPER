import { useMemo } from "react";
import { STRUCTURE_LABEL } from "@/configurator/steps/final-review/summary-labels";
import { useConfigurator } from "@/lib/pool/context";
import { configuredPoolLayout } from "@/lib/pool/resolved-layout";
import { buildTechnicalPlan, type TechnicalPlan } from "@/lib/pool/technical-plan";
import { resolveAutomaticCover, type CoverPlan } from "@/lib/pool/cover-plan";

export function useTechnicalData(): { technical: TechnicalPlan; cover: CoverPlan } {
  const { config, outline, metrics, skimmers } = useConfigurator();
  return useMemo(() => ({
    technical: buildTechnicalPlan({ config, outline, metrics, skimmers, layout: configuredPoolLayout(config) }),
    cover: resolveAutomaticCover(config),
  }), [config, outline, metrics, skimmers]);
}

const provenance = {
  CALCULATED: "Calcolato",
  RULE_BASED: "Da layout",
  ESTIMATED: "Stima",
  NOT_AVAILABLE: "Da verificare",
} as const;

function Row({ label, value, note }: { label: string; value: string; note?: string | undefined }) {
  return <div className="flex justify-between gap-4 border-b border-hairline/60 py-2 last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="max-w-[58%] text-right text-foreground" title={note}>{value}</span>
  </div>;
}

export function TechnicalDataPanel({ technical, cover, compact = false }: {
  technical: TechnicalPlan;
  cover: CoverPlan;
  compact?: boolean;
}) {
  const systemName = technical.system === "infinity" ? "Infinity"
    : technical.system === "skimmer" ? "Skimmer"
      : technical.overflow?.kind === "VISIBLE_CHANNEL" ? "Sfioro visibile" : "Sfioro nascosto";
  const coverName = !cover.enabled ? "Non selezionata"
    : cover.status === "UNAVAILABLE" ? "Richiesta · da verificare"
      : cover.extension > 0.02 && cover.extension < 0.98
        ? `Automatica · chiusa al ${Math.round(cover.extension * 100)}%`
        : cover.position === "closed" ? "Automatica · chiusa" : "Automatica · aperta";
  return <div className="rounded-2xl border border-hairline bg-card/95 p-4 text-xs shadow-sm" data-testid="technical-data-panel">
    <h3 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Scheda tecnica indicativa</h3>
    <Row label="Sistema" value={systemName} />
    <Row label="Struttura" value={technical.structure ? STRUCTURE_LABEL[technical.structure] : "Da definire"} />
    <Row label="Volume acqua" value={`${technical.waterVolume.value?.toFixed(1) ?? "—"} m³`} note={provenance[technical.waterVolume.provenance]} />
    <Row label="Superficie acqua" value={`${technical.waterSurface.value?.toFixed(1) ?? "—"} m²`} note={provenance[technical.waterSurface.provenance]} />
    {!compact ? <>
      <Row label="Superficie vasca base" value={`${technical.internalSurface.value?.toFixed(1) ?? "—"} m²`} note="Calcolata sul guscio base; comfort e dettagli esclusi." />
      <Row label="Finitura interna" value={`≈ ${technical.finishArea.value?.toFixed(1) ?? "—"} m² · stima`} note={technical.finishArea.note} />
      <Row label="LED" value={`${technical.leds.count.value ?? 0} · disposizione automatica`} note={provenance[technical.leds.count.provenance]} />
    </> : null}
    {technical.system === "skimmer"
      ? <Row label="Skimmer" value={`${technical.skimmers.count.value ?? 0} · posizionati`} note={provenance[technical.skimmers.count.provenance]} />
      : <Row label="Raccolta" value={`${technical.overflow?.collectionLength.value?.toFixed(1) ?? "—"} m · ${technical.overflow?.kind === "INFINITY_EDGE" ? "bordo Infinity" : "perimetro"}`} note={technical.overflow?.note} />}
    <Row label="Mandate / scarichi" value="Posizionamento da progettare" note={`${technical.returns.note} ${technical.drains.note}`} />
    {technical.compensation.required ? <Row label="Compensazione" value="Volume da verificare" note={technical.compensation.note} /> : null}
    <Row label="Copertura" value={coverName} note={cover.reason ?? undefined} />
    {!compact ? <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Dati di configurazione, non progetto esecutivo. Portate, aspirazioni, compensazione e compatibilità di cantiere richiedono verifica tecnica.</p> : null}
  </div>;
}
