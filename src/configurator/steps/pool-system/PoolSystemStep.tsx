import { DataRow, OptionCard, StepSection } from "@/components/pool/StepSection";
import { formatNumber } from "@/lib/pool/format";
import { useConfigurator } from "@/lib/pool/context";

/**
 * Step 4 — selects the hydraulic system.
 * Engineering values remain derived from the existing configurator store.
 */
export function PoolSystemStep() {
  const { config, setSystem, skimmers, metrics } = useConfigurator();

  return (
    <StepSection title="Pool System" subtitle="Hydraulic principle and water line management.">
      <div className="grid gap-4" role="group" aria-label="Pool system">
        <OptionCard
          title="Skimmer Pool"
          description="Water line 12 cm below the coping. Skimmers sized to industry standard."
          selected={config.system === "skimmer"}
          onSelect={() => setSystem("skimmer")}
        />
        <OptionCard
          title="Overflow Edge Pool"
          description="A flush water line flowing into a concealed perimeter collection gutter."
          selected={config.system === "overflow"}
          onSelect={() => setSystem("overflow")}
        />
      </div>

      {config.system === "skimmer" ? (
        <div className="flex flex-col gap-3 border-t border-hairline pt-8">
          <h3 className="label-xs mb-2">Skimmer sizing — 1 every 25 m²</h3>
          <DataRow label="Water surface" value={`${formatNumber(metrics.waterSurface)} m²`} />
          <DataRow label="Skimmers" value={`${skimmers.count}`} />
          <DataRow label="Spacing" value={`${formatNumber(skimmers.spacing)} m`} />
          <DataRow
            label="Distance from corners"
            value={`${formatNumber(skimmers.cornerDistance)} m`}
          />
        </div>
      ) : (
        <div className="border-t border-hairline pt-8 text-sm font-light leading-relaxed text-muted-foreground">
          The water line rises to the pool edge and flows into a dedicated collection channel.
        </div>
      )}
    </StepSection>
  );
}
