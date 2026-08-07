import { FileDrop } from "@/components/pool/FileDrop";
import { ShapeEditor } from "@/components/pool/ShapeEditor";
import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { POOL_SHAPES } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import { cn } from "@/lib/utils";

/**
 * Step 2 — selects the pool silhouette.
 *
 * Shape state remains owned by the configurator store. Updating it triggers
 * the existing outline calculation and 3D rendering pipeline immediately.
 */
export function PoolShapeStep() {
  const { config, setShape, setCustomMode } = useConfigurator();

  return (
    <StepSection
      title="Pool Shape"
      subtitle="The 3D geometry regenerates the moment you pick a silhouette."
    >
      <div className="grid gap-4" role="group" aria-label="Pool shape">
        {POOL_SHAPES.map((shape) => (
          <OptionCard
            key={shape.id}
            title={shape.title}
            description={shape.description}
            selected={config.shape === shape.id}
            onSelect={() => setShape(shape.id)}
          />
        ))}
      </div>

      {config.shape === "custom" ? (
        <div className="flex flex-col gap-7 border-t border-hairline pt-8">
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
        </div>
      ) : null}
    </StepSection>
  );
}
