import { OptionCard, StepSection, SwatchOption } from "@/components/pool/StepSection";
import { useConfigurator } from "@/lib/pool/context";
import { SKIMMER_FINISHES, SKIMMER_TYPES } from "@/lib/pool/config";
import { cn } from "@/lib/utils";
import { InfinitySideSelector } from "./InfinitySideSelector";

/**
 * Step 4 — selects the hydraulic system (Acqua / Linea d'acqua).
 * Engineering values remain derived from the existing configurator store.
 * Coping/border material selection lives in the Style step, not here.
 */
export function PoolSystemStep({ onSkimmerSelect }: { onSkimmerSelect?: () => void } = {}) {
  const {
    config,
    outline,
    setSystem,
    setOverflowType,
    setSkimmerFinish,
    setSkimmerType,
    setInfinitySide,
  } = useConfigurator();

  const selectSkimmer = () => {
    setSystem("skimmer");
    onSkimmerSelect?.();
  };

  // Geometry Pass D: Infinity's real geometry exists for Rectangle and
  // L-shape (see infinity-edge.ts); Organic stays a stub. Mirrors the exact
  // same gate project.ts's normalisation already applies, so the UI never
  // offers a selection the 3D view/export guard would then have to silently
  // reject.
  const infinityAvailable = config.shape === "rectangle" || config.shape === "l-shape";

  return (
    <StepSection
      title="Sistema idraulico"
      subtitle="Principio idraulico e gestione della linea d'acqua."
    >
      <div className="grid gap-4" role="group" aria-label="Sistema idraulico">
        <OptionCard
          title="Piscina a skimmer"
          description="Linea d'acqua 12 cm sotto il bordo. Skimmer dimensionati secondo lo standard di settore."
          selected={config.system === "skimmer"}
          onSelect={selectSkimmer}
        />

        {/* Inline, not a modal/route -- grid-template-rows 0fr/1fr is what
            makes this smoothly animate to its natural height without a
            measured-pixel-height hack. */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            config.system === "skimmer" ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-4 rounded-2xl border border-hairline p-5">
              <p className="label-xs">Tipo skimmer</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {SKIMMER_TYPES.map((option) => (
                  <OptionCard
                    key={option.id}
                    title={option.title}
                    description={option.description}
                    selected={config.skimmerType === option.id}
                    onSelect={() => setSkimmerType(option.id)}
                  />
                ))}
              </div>
              <p className="label-xs">Finitura skimmer</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {SKIMMER_FINISHES.map((option) => (
                  <SwatchOption
                    key={option.id}
                    title={option.title}
                    hex={option.hex}
                    selected={config.skimmerFinish === option.id}
                    onSelect={() => setSkimmerFinish(option.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <OptionCard
          title="Piscina a sfioro"
          description="Linea d'acqua a filo bordo, con raccolta perimetrale a sfioro selezionabile."
          selected={config.system === "overflow"}
          onSelect={() => setSystem("overflow")}
        />
        {config.system === "overflow" ? (
          <div className="mt-4 grid gap-4" role="group" aria-label="Tipo di sfioro">
            <p className="label-xs">Tipo di sfioro</p>
            <OptionCard
              title="Sfioro nascosto"
              description="Canale di sfioro nascosto sotto il bordo perimetrale."
              selected={config.overflowType === "hidden"}
              onSelect={() => setOverflowType("hidden")}
            />
            <OptionCard
              title="Sfioro a vista"
              description="Sfioro a livello del bordo con canale di drenaggio perimetrale a vista."
              selected={config.overflowType === "visible"}
              onSelect={() => setOverflowType("visible")}
            />
          </div>
        ) : null}

        <OptionCard
          title="Piscina Infinity"
          description="Bordo a sfioro totale su un lato, con cascata e canale di raccolta a vista."
          selected={config.system === "infinity"}
          onSelect={() => setSystem("infinity")}
          disabled={!infinityAvailable}
          disabledReason="Infinity non ancora disponibile per questa forma."
        />
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            config.system === "infinity" ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            {infinityAvailable ? (
              <InfinitySideSelector
                outline={outline}
                selectedSide={config.infinityEdge?.side ?? null}
                onSelect={setInfinitySide}
              />
            ) : (
              <div className="rounded-2xl border border-hairline p-5">
                <p className="text-[13px] font-light text-muted-foreground">
                  Infinity non ancora disponibile per questa forma. Torna allo step Forma e
                  seleziona Rettangolare per attivarlo.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </StepSection>
  );
}
