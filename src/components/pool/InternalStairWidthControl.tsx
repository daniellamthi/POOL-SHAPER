import { useMemo } from "react";
import { DimensionControl } from "./DimensionControl";
import { useI18n } from "@/lib/i18n";
import type { PoolConfig } from "@/lib/pool/types";
import { configuredInternalStairWidthRange, internalStairWidthFits } from "@/lib/pool/internal-stair-width";

export function InternalStairWidthControl({ config, onChange }: {
  config: PoolConfig;
  onChange: (value: number | undefined) => void;
}) {
  const { t, number } = useI18n();
  const range = useMemo(() => configuredInternalStairWidthRange(config),
    // Width alone changes only the live flight, not its range or the automatic anchor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.poolType, config.shape, config.dimensions, config.controlPoints, config.system,
      config.overflowType, config.features, config.poolAccess, config.internalStairType,
      config.internalStairMirrored, config.internalStairPosition, config.hydromassageVariant, config.infinityEdge,
      config.integratedBenchStations, config.copingStyle, config.copingEdge]);
  const requested = config.internalStairWidth;
  const valid = useMemo(() => requested === undefined || internalStairWidthFits(config, requested), [config, requested]);
  return <div className="flex flex-col gap-3" data-internal-stair-width>
    {range.available ? <>
      <DimensionControl label="Larghezza scala" unit="m" step={0.05} precision={2}
        value={requested ?? range.defaultWidth} min={range.min} max={range.max} onChange={onChange} />
      <p className="text-xs text-muted-foreground">{t("Da {min} a {max} m, secondo lo spazio disponibile. Pedate e alzate restano invariate.", {
        min: number(range.min, { maximumFractionDigits: 2 }), max: number(range.max, { maximumFractionDigits: 2 }),
      })}</p>
    </> : <p className="text-xs text-muted-foreground">{t(range.reason)}</p>}
    {!valid && range.available ? <p role="alert" className="text-xs text-destructive">{t("La larghezza salvata non entra nella configurazione attuale. Modifica la misura o ripristina Automatica.")}</p> : null}
    <button type="button" className="self-start text-xs underline underline-offset-4 disabled:text-muted-foreground disabled:no-underline"
      disabled={requested === undefined} onClick={() => onChange(undefined)}>{t("Ripristina larghezza automatica")}</button>
  </div>;
}
