import { Footprints } from "lucide-react";
import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { POOL_FEATURES } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import { LedColorWheel } from "./LedColorWheel";
import { LedIntensityControl } from "./LedIntensityControl";

export function PoolFeaturesStep() {
  const {
    config,
    togglePoolFeature,
    setPoolAccess,
    setLedColor,
    setLedIntensity,
    setInternalStairType,
  } = useConfigurator();
  const stairType = config.internalStairType ?? "linear";

  return (
    <StepSection
      title="Pool Features"
      subtitle="Select the essential features built into the pool."
    >
      <div className="flex flex-col gap-5">
        <h3 className="label-xs">Pool features</h3>
        <div className="grid gap-3" role="group" aria-label="Pool features">
          {POOL_FEATURES.map((feature) => (
            <div key={feature.id} className="grid gap-3">
              <OptionCard
                title={feature.title}
                description={feature.description}
                selected={config.features.includes(feature.id)}
                onSelect={() => togglePoolFeature(feature.id)}
              />
              {feature.id === "ledLighting" && config.features.includes(feature.id) ? (
                <>
                  <LedColorWheel value={config.ledColor ?? "#ffffff"} onChange={setLedColor} />
                  <LedIntensityControl value={config.ledIntensity} onChange={setLedIntensity} />
                </>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5 border-t border-hairline pt-8">
        <h3 className="label-xs">Pool access</h3>
        <div className="grid gap-4" role="group" aria-label="Pool access">
          <div className="grid gap-3">
            <OptionCard
              title="Internal stairs"
              description="Integrated concrete stairs, matching the selected interior finish."
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
            title="External ladder"
            description="Classic stainless-steel pool ladder with three non-slip treads."
            selected={config.poolAccess === "stainlessSteelLadder"}
            onSelect={() => setPoolAccess("stainlessSteelLadder")}
          />
        </div>
      </div>
      {config.poolType === "above-ground" ? (
        <div className="flex flex-col gap-5 border-t border-hairline pt-8">
          <h3 className="label-xs">Above-ground approach</h3>
          <OptionCard
            title="Scala esterna"
            description="Accesso esterno alla piscina"
            selected={config.features.includes("externalStaircase")}
            onSelect={() => togglePoolFeature("externalStaircase")}
            meta={<Footprints className="size-5 text-muted-foreground" strokeWidth={1.25} />}
          />
        </div>
      ) : null}
    </StepSection>
  );
}
