import { DimensionControl } from "@/components/pool/DimensionControl";
import { MetricsPanel } from "@/components/pool/MetricsPanel";
import { StepSection } from "@/components/pool/StepSection";
import { DIMENSION_LIMITS, type DimensionKey } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";

const DIMENSION_CONTROLS: ReadonlyArray<{ key: DimensionKey; label: string }> = [
  { key: "length", label: "Length" },
  { key: "width", label: "Width" },
  { key: "depth", label: "Depth" },
];

/**
 * Step 3 — controls the physical dimensions of the pool.
 *
 * Values are written directly to the existing configurator store. Geometry
 * and engineering metrics remain derived state and update synchronously.
 */
export function PoolDimensionsStep() {
  const { config, setDimension, metrics } = useConfigurator();

  return (
    <StepSection title="Pool Dimensions" subtitle="Every value resizes the basin in real time.">
      <div className="flex flex-col gap-7" role="group" aria-label="Pool dimensions">
        {DIMENSION_CONTROLS.map(({ key, label }) => {
          const limits = DIMENSION_LIMITS[key];

          return (
            <DimensionControl
              key={key}
              label={label}
              value={config.dimensions[key]}
              unit={limits.unit}
              min={limits.min}
              max={limits.max}
              step={limits.step}
              onChange={(value) => setDimension(key, value)}
            />
          );
        })}
      </div>

      <div className="flex flex-col gap-6 border-t border-hairline pt-8">
        <h3 className="label-xs">Calculated values</h3>
        <MetricsPanel metrics={metrics} />
      </div>
    </StepSection>
  );
}
