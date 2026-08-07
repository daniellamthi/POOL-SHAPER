import { formatNumber } from "@/lib/pool/format";
import type { PoolMetrics } from "@/lib/pool/types";

const METRIC_ROWS: ReadonlyArray<{
  key: keyof PoolMetrics;
  label: string;
  unit: string;
  digits: number;
}> = [
  { key: "waterVolume", label: "Water Volume", unit: "m³", digits: 2 },
  { key: "waterSurface", label: "Water Surface", unit: "m²", digits: 2 },
  { key: "internalSurface", label: "Internal Surface", unit: "m²", digits: 2 },
  { key: "floorSurface", label: "Floor Surface", unit: "m²", digits: 2 },
  { key: "wallSurface", label: "Wall Surface", unit: "m²", digits: 2 },
  { key: "perimeter", label: "Perimeter", unit: "m", digits: 2 },
];

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
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-6">
      {METRIC_ROWS.map((row) => (
        <div key={row.key} className="flex flex-col gap-2">
          <dt className="label-xs">{row.label}</dt>
          <dd className="numeric flex items-baseline gap-1.5 text-[22px] leading-none text-foreground">
            {formatNumber(metrics[row.key], row.digits)}
            <span className="text-[11px] font-light text-muted-foreground">{row.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
