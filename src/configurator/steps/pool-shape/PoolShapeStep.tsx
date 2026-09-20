import { FileDrop } from "@/components/pool/FileDrop";
import { DimensionControl } from "@/components/pool/DimensionControl";
import { MetricsPanel } from "@/components/pool/MetricsPanel";
import { ShapeEditor } from "@/components/pool/ShapeEditor";
import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { DIMENSION_LIMITS, POOL_SHAPES } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import { formatNumber } from "@/lib/pool/format";
import { MIN_SLOPE_DIFFERENCE, slopeEligibleForDepth } from "@/lib/pool/floor-profile";
import { cn } from "@/lib/utils";
import type { PoolShapeId } from "@/lib/pool/types";

/**
 * Step 2 — selects the pool silhouette.
 *
 * Shape state remains owned by the configurator store. Updating it triggers
 * the existing outline calculation and 3D rendering pipeline immediately.
 */
export function PoolShapeStep() {
  const { config, setShape, setCustomMode, setDimension, metrics } = useConfigurator();

  const planDimensions = (disabled: boolean) => (
    <fieldset
      disabled={disabled}
      className="flex min-w-0 flex-col gap-7 border-0 p-0"
      aria-label="Dimensioni in pianta"
    >
      {(
        [
          ["length", "Lunghezza"],
          ["width", "Larghezza"],
        ] as ReadonlyArray<readonly ["length" | "width", string]>
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

  // Slope is only ever built for a rectangle, in-ground pool -- see
  // `buildFloorProfile` (floor-profile.ts). Custom shapes and above-ground
  // pools keep the single "Profondità" control they always had.
  const supportsFloorProfile = config.poolType === "in-ground";

  const depthSection = (shape: PoolShapeId, disabled: boolean) =>
    shape === "rectangle" && supportsFloorProfile ? (
      <FloorProfileSection disabled={disabled} />
    ) : (
      <fieldset disabled={disabled} className="border-0 p-0">
        <DimensionControl
          label="Profondità"
          value={config.dimensions.depth}
          unit={DIMENSION_LIMITS.depth.unit}
          min={DIMENSION_LIMITS.depth.min}
          max={DIMENSION_LIMITS.depth.max}
          step={DIMENSION_LIMITS.depth.step}
          onChange={(value) => setDimension("depth", value)}
        />
      </fieldset>
    );

  return (
    <StepSection
      title="Forma e dimensioni"
      subtitle="Scegli la sagoma e dimensiona la vasca in tempo reale."
    >
      <div className="grid gap-4" role="group" aria-label="Forma della piscina">
        {POOL_SHAPES.map((shape) => {
          const selected = config.shapeSelected === true && config.shape === shape.id;
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
                          aria-label="Metodo di inserimento forma personalizzata"
                        >
                          {(
                            [
                              ["draw", "Disegna perimetro"],
                              ["upload", "Carica planimetria"],
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
                            label="Riferimento architettonico"
                            hint="PDF, planimetria, disegno tecnico o immagine di riferimento. Usato solo come riferimento progettuale."
                          />
                        )}
                      </>
                    ) : null}
                    {planDimensions(!selected)}
                    <div className="flex flex-col gap-7 border-t border-hairline pt-7">
                      {depthSection(shape.id, !selected)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-6 border-t border-hairline pt-8">
        <h3 className="label-xs">Valori calcolati</h3>
        <MetricsPanel metrics={metrics} />
      </div>
    </StepSection>
  );
}

/**
 * "Profilo del fondo" -- Geometry Pass A. A refined two-state selector (the
 * same segmented-pill pattern the custom-shape draw/upload control already
 * uses, not a checkbox), then the depth control(s) that state calls for.
 * Only ever rendered for a rectangle, in-ground pool -- see
 * `supportsFloorProfile` above and `buildFloorProfile` (floor-profile.ts).
 */
function FloorProfileSection({ disabled }: { disabled: boolean }) {
  const { config, setDimension, setFloorProfile, toggleSlopeReversed } = useConfigurator();
  const depth = config.dimensions.depth;
  const eligible = slopeEligibleForDepth(depth, DIMENSION_LIMITS.depth.min);
  const profile = eligible ? (config.dimensions.floorProfile ?? "flat") : "flat";
  const sloped = profile === "slope";
  const shallowDepth = config.dimensions.shallowDepth ?? depth;
  const shallowMax = Math.min(DIMENSION_LIMITS.shallowDepth.max, depth - MIN_SLOPE_DIFFERENCE);
  const dislivelloCm = Math.round((depth - shallowDepth) * 100);

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-6 border-0 p-0">
      <p className="label-xs">Profilo del fondo</p>
      <div
        className="grid grid-cols-2 gap-2 rounded-full border border-hairline p-1"
        role="group"
        aria-label="Profilo del fondo"
      >
        {(
          [
            ["flat", "Fondo piano"],
            ["slope", "Fondo in pendenza"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFloorProfile(value)}
            aria-pressed={profile === value}
            disabled={value === "slope" && !eligible}
            title={
              value === "slope" && !eligible
                ? "Aumenta la profondità per attivare il fondo in pendenza"
                : undefined
            }
            className={cn(
              "rounded-full px-4 py-2 text-[11.5px] tracking-tight transition-all duration-500 disabled:cursor-not-allowed disabled:opacity-40",
              profile === value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {sloped ? (
        <div className="flex flex-col gap-7">
          <DimensionControl
            label="Profondità iniziale"
            value={shallowDepth}
            unit={DIMENSION_LIMITS.shallowDepth.unit}
            min={DIMENSION_LIMITS.shallowDepth.min}
            max={shallowMax}
            step={DIMENSION_LIMITS.shallowDepth.step}
            onChange={(value) => setDimension("shallowDepth", value)}
          />
          <DimensionControl
            label="Profondità finale"
            value={depth}
            unit={DIMENSION_LIMITS.depth.unit}
            min={DIMENSION_LIMITS.depth.min}
            max={DIMENSION_LIMITS.depth.max}
            step={DIMENSION_LIMITS.depth.step}
            onChange={(value) => setDimension("depth", value)}
          />
          <div className="flex items-baseline justify-between gap-4 text-[12px] font-light text-muted-foreground">
            <span>
              {formatNumber(shallowDepth, 2)} → {formatNumber(depth, 2)} m
            </span>
            <span>Dislivello {dislivelloCm} cm</span>
          </div>
          <button
            type="button"
            onClick={toggleSlopeReversed}
            className="self-start text-[11px] font-light text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            ⇄ Inverti pendenza
          </button>
        </div>
      ) : (
        <DimensionControl
          label="Profondità"
          value={depth}
          unit={DIMENSION_LIMITS.depth.unit}
          min={DIMENSION_LIMITS.depth.min}
          max={DIMENSION_LIMITS.depth.max}
          step={DIMENSION_LIMITS.depth.step}
          onChange={(value) => setDimension("depth", value)}
        />
      )}
    </fieldset>
  );
}
