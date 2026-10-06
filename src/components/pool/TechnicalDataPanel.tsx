import { useMemo } from "react";
import { technicalRows, TECHNICAL_NOTE } from "@/lib/project-delivery/summary-model";
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

function Row({ label, value, note }: { label: string; value: string; note?: string | undefined }) {
  return <div className="flex justify-between gap-4 border-b border-hairline/60 py-2 last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="max-w-[58%] text-right text-foreground" title={note}>{value}</span>
  </div>;
}

/** Viewport technical sheet: the same `technicalRows` the Summary and the
 * Project Book PDF render. */
export function TechnicalDataPanel({ technical, cover, compact = false }: {
  technical: TechnicalPlan;
  cover: CoverPlan;
  compact?: boolean;
}) {
  return <div className="rounded-2xl border border-hairline bg-card/95 p-4 text-xs shadow-sm" data-testid="technical-data-panel">
    <h3 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Scheda tecnica indicativa</h3>
    {technicalRows(technical, cover, compact).map((row) => (
      <Row key={row.label} label={row.label} value={row.value} note={row.hint} />
    ))}
    {!compact ? <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{TECHNICAL_NOTE}</p> : null}
  </div>;
}
