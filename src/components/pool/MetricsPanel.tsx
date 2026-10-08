import { formatNumber } from "@/lib/pool/format";
import type { PoolMetrics } from "@/lib/pool/types";

const METRIC_ROWS: ReadonlyArray<{
  key: keyof PoolMetrics;
  label: string;
  unit: string;
  digits: number;
}> = [
  { key: "waterVolume", label: "Volume d’acqua", unit: "m³", digits: 2 },
  { key: "waterSurface", label: "Specchio d’acqua", unit: "m²", digits: 2 },
  { key: "internalSurface", label: "Superficie interna", unit: "m²", digits: 2 },
  { key: "floorSurface", label: "Fondo", unit: "m²", digits: 2 },
  { key: "wallSurface", label: "Pareti", unit: "m²", digits: 2 },
  { key: "perimeter", label: "Perimetro", unit: "m", digits: 2 },
];

/** The two figures a customer actually reads; the rest is supporting detail. */
const PRIMARY_KEYS: ReadonlyArray<keyof PoolMetrics> = ["waterVolume", "waterSurface"];

export function MetricsPanel({
  metrics,
  compact = false,
}: {
  metrics: PoolMetrics;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {METRIC_ROWS.map((row) => (
          <div
            key={row.key}
            className="flex items-baseline justify-between gap-4 border-b border-hairline py-2.5"
          >
            <dt className="text-[10px] font-normal uppercase tracking-[0.13em] text-muted-foreground/75">
              {row.label}
            </dt>
            <dd className="text-[12px] font-normal tabular-nums text-muted-foreground">
              {formatNumber(metrics[row.key], row.digits)} {row.unit}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  const primary = METRIC_ROWS.filter((row) => PRIMARY_KEYS.includes(row.key));
  const secondary = METRIC_ROWS.filter((row) => !PRIMARY_KEYS.includes(row.key));
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-hairline bg-card px-5 py-5">
      <dl className="grid grid-cols-2 divide-x divide-hairline">
        {primary.map((row) => (
          <div key={row.key} className="flex flex-col items-center gap-1.5 px-2 text-center">
            <dt className="text-[10.5px] tracking-[0.04em] text-muted-foreground">{row.label}</dt>
            <dd className="numeric flex items-baseline gap-1 text-[19px] font-normal leading-none text-foreground">
              {formatNumber(metrics[row.key], row.digits)}
              <span className="text-[11px] font-light text-muted-foreground">{row.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      <dl className="flex flex-col gap-2 border-t border-hairline pt-4">
        {secondary.map((row) => (
          <div key={row.key} className="flex items-baseline justify-between gap-3">
            <dt className="truncate text-[11px] text-muted-foreground">{row.label}</dt>
            <dd className="shrink-0 text-[11.5px] tabular-nums text-foreground/80">
              {formatNumber(metrics[row.key], row.digits)} {row.unit}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
