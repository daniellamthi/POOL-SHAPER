import { FileDrop } from "@/components/pool/FileDrop";
import { DimensionControl } from "@/components/pool/DimensionControl";
import { MetricsPanel } from "@/components/pool/MetricsPanel";
import { ShapeEditor } from "@/components/pool/ShapeEditor";
import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { DIMENSION_LIMITS, POOL_SHAPES, type DimensionKey } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import { cn } from "@/lib/utils";

/**
 * Step 2 — selects the pool silhouette.
 *
 * Shape state remains owned by the configurator store. Updating it triggers
 * the existing outline calculation and 3D rendering pipeline immediately.
 */
export function PoolShapeStep() {
  const { config, setShape, setCustomMode, setDimension, metrics } = useConfigurator();

  const dimensions = (disabled: boolean) => (
    <fieldset
      disabled={disabled}
      className="flex min-w-0 flex-col gap-7 border-0 p-0"
      aria-label="Pool dimensions"
    >
      {(
        [
          ["length", "Length"],
          ["width", "Width"],
          ["depth", "Depth"],
        ] as ReadonlyArray<readonly [DimensionKey, string]>
      ).map(([key, label]) => {
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
    </fieldset>
  );

  return (
    <StepSection
      title="Shape & Dimensions"
      subtitle="Choose the silhouette and size the basin in real time."
    >
      <div className="grid gap-4" role="group" aria-label="Pool shape">
        {POOL_SHAPES.map((shape) => {
          const selected = config.shape === shape.id;
          return (
            <div key={shape.id} className="flex flex-col">
              <OptionCard
                title={shape.title}
                description={shape.description}
                selected={selected}
                onSelect={() => setShape(shape.id)}
              />
              <div
                className={`grid transition-[grid-template-rows,opacity,transform,margin] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  selected
                    ? "mt-4 grid-rows-[1fr] translate-y-0 opacity-100"
                    : "pointer-events-none mt-0 grid-rows-[0fr] -translate-y-1 opacity-0"
                }`}
                aria-hidden={!selected}
              >
                <div className="overflow-hidden">
                  <div className="ml-3 flex flex-col gap-7 border-l border-hairline py-2 pl-4">
                    {shape.id === "custom" ? (
                      <>
                        <div
                          className="grid grid-cols-2 gap-2 rounded-full border border-hairline p-1"
                          role="group"
                          aria-label="Custom shape input method"
                        >
                          {(
                            [
                              ["draw", "Draw outline"],
                              ["upload", "Upload plan"],
                            ] as const
                          ).map(([mode, label]) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setCustomMode(mode)}
                              aria-pressed={config.customMode === mode}
                              disabled={!selected}
                              className={cn(
                                "rounded-full px-4 py-2 text-[11.5px] tracking-tight transition-all duration-500",
                                config.customMode === mode
                                  ? "bg-foreground text-background"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {config.customMode === "draw" ? (
                          <ShapeEditor />
                        ) : (
                          <FileDrop
                            category="reference"
                            label="Architectural reference"
                            hint="PDF, floor plan, architectural drawing or reference image. Used as design reference only."
                          />
                        )}
                      </>
                    ) : null}
                    {dimensions(!selected)}
                  </div>
                </div>
              </div>
            </div>
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
