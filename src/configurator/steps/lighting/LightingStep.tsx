import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { useConfigurator } from "@/lib/pool/context";
import { LedColorWheel } from "@/configurator/steps/pool-features/LedColorWheel";
import { LedIntensityControl } from "@/configurator/steps/pool-features/LedIntensityControl";

/** Step 7 (Luce) — underwater LED lighting: on/off, colour and intensity.
 * Split out of the old, bundled "Pool Features" step so this is its own
 * dedicated decision instead of being buried under access/comfort. */
export function LightingStep() {
  const { config, togglePoolFeature, setLedColor, setLedIntensity } = useConfigurator();
  const hasLed = config.features.includes("ledLighting");

  return (
    <StepSection
      title="Illuminazione"
      subtitle="Illuminazione subacquea a LED: colore e intensità."
    >
      <div className="grid gap-3" role="group" aria-label="Illuminazione subacquea">
        <OptionCard
          title="Illuminazione LED"
          description="Illuminazione subacquea a LED, colore e intensità regolabili."
          selected={hasLed}
          onSelect={() => togglePoolFeature("ledLighting")}
        />
        {hasLed ? (
          <>
            <LedColorWheel value={config.ledColor ?? "#ffffff"} onChange={setLedColor} />
            <LedIntensityControl value={config.ledIntensity} onChange={setLedIntensity} />
          </>
        ) : null}
      </div>
    </StepSection>
  );
}
