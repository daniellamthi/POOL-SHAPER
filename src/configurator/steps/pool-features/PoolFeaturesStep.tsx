import { Footprints } from "lucide-react";
import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { POOL_FEATURES } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";

export function PoolFeaturesStep() {
  const { config, togglePoolFeature, setPoolAccess } = useConfigurator();

  return (
    <StepSection
      title="Pool Features"
      subtitle="Select the essential features built into the pool."
    >
      <div className="flex flex-col gap-5">
        <h3 className="label-xs">Pool features</h3>
        <div className="grid gap-3" role="group" aria-label="Pool features">
          {POOL_FEATURES.map((feature) => (
            <OptionCard
              key={feature.id}
              title={feature.title}
              description={feature.description}
              selected={config.features.includes(feature.id)}
              onSelect={() => togglePoolFeature(feature.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5 border-t border-hairline pt-8">
        <h3 className="label-xs">Pool access</h3>
        <div className="grid gap-4" role="group" aria-label="Pool access">
          <OptionCard
            title="Internal Steps"
            selected={config.poolAccess === "internalSteps"}
            onSelect={() => setPoolAccess("internalSteps")}
          />
          <OptionCard
            title="Stainless Steel Ladder"
            selected={config.poolAccess === "stainlessSteelLadder"}
            onSelect={() => setPoolAccess("stainlessSteelLadder")}
          />
          {config.poolType === "above-ground" ? (
            <OptionCard
              title="Scala esterna"
              description="Accesso esterno alla piscina"
              selected={config.features.includes("externalStaircase")}
              onSelect={() => togglePoolFeature("externalStaircase")}
              meta={<Footprints className="size-5 text-muted-foreground" strokeWidth={1.25} />}
            />
          ) : null}
        </div>
      </div>
    </StepSection>
  );
}
