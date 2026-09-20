import { Footprints } from "lucide-react";
import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { useConfigurator } from "@/lib/pool/context";

/** Step 6 (Comfort) — pool access (internal stairs / external ladder) and
 * the in-water comfort feature (hydromassage). Split out of the old,
 * bundled "Pool Features" step so lighting and access are each their own
 * clear decision. */
export function AccessStep() {
  const { config, togglePoolFeature, setPoolAccess, setInternalStairType } = useConfigurator();
  const stairType = config.internalStairType ?? "linear";

  return (
    <StepSection title="Accesso e comfort" subtitle="Scale, scaletta e comfort in acqua.">
      <div className="flex flex-col gap-5">
        <h3 className="label-xs">Accesso alla piscina</h3>
        <div className="grid gap-4" role="group" aria-label="Accesso alla piscina">
          <div className="grid gap-3">
            <OptionCard
              title="Scala interna"
              description="Scala integrata in cemento, coordinata con la finitura interna selezionata."
              selected={config.poolAccess === "internalSteps"}
              onSelect={() => setPoolAccess("internalSteps")}
            />
            {config.poolAccess === "internalSteps" ? (
              <section
                aria-label="Tipo di scala interna"
                className="rounded-2xl border border-hairline px-5 py-5"
              >
                <h4 className="label-xs mb-4">Tipo di scala</h4>
                <div className="grid gap-3" role="group" aria-label="Tipo di scala interna">
                  <OptionCard
                    title="Scala lineare"
                    description="Gradini dritti sul lato corto, addossati alla parete lunga."
                    selected={stairType === "linear"}
                    onSelect={() => setInternalStairType("linear")}
                  />
                  <OptionCard
                    title="Scala ad angolo"
                    description="Gradini a quarto di cerchio che si aprono dall'angolo della vasca."
                    selected={stairType === "corner"}
                    onSelect={() => setInternalStairType("corner")}
                  />
                </div>
              </section>
            ) : null}
          </div>
          <OptionCard
            title="Scaletta esterna"
            description="Scaletta classica in acciaio inox con tre pedate antiscivolo."
            selected={config.poolAccess === "stainlessSteelLadder"}
            onSelect={() => setPoolAccess("stainlessSteelLadder")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-5 border-t border-hairline pt-8">
        <h3 className="label-xs">Comfort in acqua</h3>
        <OptionCard
          title="Idromassaggio"
          description="Ugelli idromassaggio integrati."
          selected={config.features.includes("hydromassage")}
          onSelect={() => togglePoolFeature("hydromassage")}
        />
      </div>

      {config.poolType === "above-ground" ? (
        <div className="flex flex-col gap-5 border-t border-hairline pt-8">
          <h3 className="label-xs">Accesso piscina fuori terra</h3>
          <OptionCard
            title="Scala esterna"
            description="Accesso esterno alla piscina."
            selected={config.features.includes("externalStaircase")}
            onSelect={() => togglePoolFeature("externalStaircase")}
            meta={<Footprints className="size-5 text-muted-foreground" strokeWidth={1.25} />}
          />
        </div>
      ) : null}
    </StepSection>
  );
}
