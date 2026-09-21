import { FileDrop } from "@/components/pool/FileDrop";
import { DimensionControl } from "@/components/pool/DimensionControl";
import { MetricsPanel } from "@/components/pool/MetricsPanel";
import { ShapeEditor } from "@/components/pool/ShapeEditor";
import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { DIMENSION_LIMITS, POOL_SHAPES } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import { formatNumber } from "@/lib/pool/format";
import { MIN_SLOPE_DIFFERENCE, slopeEligibleForDepth } from "@/lib/pool/floor-profile";
import { L_SHAPE_ORIENTATIONS, type LShapeOrientation } from "@/lib/pool/l-shape";
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

  // Slope is only ever built for a rectangle, L-shape or Organic, in-ground
  // pool -- see `buildFloorProfile` (floor-profile.ts). Custom shapes and
  // above-ground pools keep the single "Profondità" control they always had.
  const supportsFloorProfile = config.poolType === "in-ground";

  const depthSection = (shape: PoolShapeId, disabled: boolean) =>
    (shape === "rectangle" || shape === "l-shape" || shape === "organic") &&
    supportsFloorProfile ? (
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
                    {shape.id === "l-shape" ? (
                      <LShapeOrientationSelector disabled={!selected} />
                    ) : null}
                    {planDimensions(!selected)}
                    {shape.id === "l-shape" ? (
                      <div className="flex flex-col gap-7 border-t border-hairline pt-7">
                        <LShapeRecessControls disabled={!selected} />
                      </div>
                    ) : null}
                    {shape.id === "organic" ? (
                      <div className="flex flex-col gap-7 border-t border-hairline pt-7">
                        <OrganicShapeControls disabled={!selected} />
                      </div>
                    ) : null}
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

const L_SHAPE_ORIENTATION_LABEL: Record<LShapeOrientation, string> = {
  nw: "Rientro in alto a sinistra",
  ne: "Rientro in alto a destra",
  sw: "Rientro in basso a sinistra",
  se: "Rientro in basso a destra",
};

/** A small, literal top-down L diagram for one orientation -- the polygon a
 * customer would actually see in plan, not a compass label. Coordinates are
 * a fixed illustrative L (not the live dimensions): this is an orientation
 * picker, not a live schematic -- the 3D viewport is the live feedback. */
function LShapeOrientationIcon({ orientation }: { orientation: LShapeOrientation }) {
  const full = "4,4 28,4 28,28 4,28";
  const points: Record<LShapeOrientation, string> = {
    se: "4,4 20,4 20,16 28,16 28,28 4,28",
    sw: "12,4 28,4 28,28 4,28 4,16 12,16",
    ne: "4,4 28,4 28,28 12,28 12,16 4,16",
    nw: "4,4 28,4 28,16 20,16 20,28 4,28",
  };
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
      <polygon points={full} className="fill-none" />
      <polygon points={points[orientation]} className="fill-current" />
    </svg>
  );
}

/** Orientation picker: four diagrams, never NE/SW-style compass naming --
 * the customer recognises the shape, not a coordinate system. Changing it
 * immediately regenerates the outline (`buildOutline` reads
 * `dimensions.lShapeOrientation` live), which cascades through camera,
 * floor, walls, stairs, systems and lights exactly like any other dimension
 * edit -- no separate "rebuild" step. */
function LShapeOrientationSelector({ disabled }: { disabled: boolean }) {
  const { config, setLShapeOrientation } = useConfigurator();
  const current = config.dimensions.lShapeOrientation ?? "se";
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-4 border-0 p-0">
      <p className="label-xs">Orientamento</p>
      <div
        className="grid grid-cols-4 gap-2"
        role="group"
        aria-label="Orientamento della forma a L"
      >
        {L_SHAPE_ORIENTATIONS.map((orientation) => (
          <button
            key={orientation}
            type="button"
            onClick={() => setLShapeOrientation(orientation)}
            aria-pressed={current === orientation}
            aria-label={L_SHAPE_ORIENTATION_LABEL[orientation]}
            title={L_SHAPE_ORIENTATION_LABEL[orientation]}
            className={cn(
              "flex items-center justify-center rounded-xl border p-2 transition-all duration-300",
              current === orientation
                ? "border-foreground bg-foreground text-background"
                : "border-hairline text-muted-foreground hover:text-foreground",
            )}
          >
            <LShapeOrientationIcon orientation={orientation} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** The recess dimensions -- what customer-facing language calls "il
 * rientro" -- kept as its own compact group, visually distinct from the
 * overall length/width above it (`planDimensions`) so the two never blur
 * into one long, undifferentiated list of sliders. */
function LShapeRecessControls({ disabled }: { disabled: boolean }) {
  const { config, setDimension } = useConfigurator();
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-7 border-0 p-0">
      <p className="label-xs">Rientro</p>
      {(
        [
          ["lShapeRecessLength", "Profondità del rientro"],
          ["lShapeRecessWidth", "Larghezza del rientro"],
        ] as const
      ).map(([key, label]) => {
        const limits = DIMENSION_LIMITS[key];
        const value = config.dimensions[key] ?? (key === "lShapeRecessLength" ? 4 : 3);
        return (
          <DimensionControl
            key={key}
            label={label}
            value={value}
            unit={limits.unit}
            min={limits.min}
            max={limits.max}
            step={limits.step}
            onChange={(next) => setDimension(key, next)}
          />
        );
      })}
    </fieldset>
  );
}

/**
 * Organic shape controls -- Geometry Pass C. A single "character" slider
 * (how pronounced the kidney-style bay is) plus a mirror toggle for which
 * side it sits on. Changing either immediately regenerates the outline
 * (`buildOutline` reads `dimensions.organicCurvature`/`organicMirror` live),
 * cascading through the same pipeline any other dimension edit does.
 */
function OrganicShapeControls({ disabled }: { disabled: boolean }) {
  const { config, setDimension, setOrganicMirror } = useConfigurator();
  const limits = DIMENSION_LIMITS.organicCurvature;
  const curvature = config.dimensions.organicCurvature ?? 0.5;
  const mirror = config.dimensions.organicMirror === true;
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-7 border-0 p-0">
      <p className="label-xs">Carattere organico</p>
      <DimensionControl
        label="Insenatura"
        value={curvature}
        unit={limits.unit}
        min={limits.min}
        max={limits.max}
        step={limits.step}
        onChange={(next) => setDimension("organicCurvature", next)}
      />
      <div
        className="grid grid-cols-2 gap-2 rounded-full border border-hairline p-1"
        role="group"
        aria-label="Lato dell'insenatura"
      >
        {(
          [
            [false, "Insenatura a destra"],
            [true, "Insenatura a sinistra"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => setOrganicMirror(value)}
            aria-pressed={mirror === value}
            className={cn(
              "rounded-full px-4 py-2 text-[11.5px] tracking-tight transition-all duration-500",
              mirror === value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * "Profilo del fondo" -- Geometry Pass A. A refined two-state selector (the
 * same segmented-pill pattern the custom-shape draw/upload control already
 * uses, not a checkbox), then the depth control(s) that state calls for.
 * Only ever rendered for a rectangle, L-shape or Organic, in-ground pool --
 * see `supportsFloorProfile` above and `buildFloorProfile` (floor-profile.ts).
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
