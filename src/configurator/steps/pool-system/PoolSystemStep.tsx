import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { useConfigurator } from "@/lib/pool/context";

/**
 * Step 4 — selects the hydraulic system.
 * Engineering values remain derived from the existing configurator store.
 */
export function PoolSystemStep({ onSkimmerSelect }: { onSkimmerSelect?: () => void } = {}) {
  const { config, setSystem, setOverflowType } = useConfigurator();

  const selectSkimmer = () => {
    setSystem("skimmer");
    onSkimmerSelect?.();
  };

  return (
    <StepSection title="Pool System" subtitle="Hydraulic principle and water line management.">
      <div className="grid gap-4" role="group" aria-label="Pool system">
        <OptionCard
          title="Skimmer Pool"
          description="Water line 12 cm below the coping. Skimmers sized to industry standard."
          selected={config.system === "skimmer"}
          onSelect={selectSkimmer}
        />
        <OptionCard
          title="Overflow Edge Pool"
          description="A flush water line with selectable perimeter overflow collection."
          selected={config.system === "overflow"}
          onSelect={() => setSystem("overflow")}
        />
        {config.system === "overflow" ? (
          <div className="mt-4 grid gap-4" role="group" aria-label="Overflow type">
            <p className="label-xs">Overflow Type</p>
            <OptionCard
              title="Hidden Overflow"
              description="Overflow channel concealed beneath the perimeter coping."
              selected={config.overflowType === "hidden"}
              onSelect={() => setOverflowType("hidden")}
            />
            <OptionCard
              title="Visible Overflow"
              description="Deck-level overflow with visible perimeter drainage channel."
              selected={config.overflowType === "visible"}
              onSelect={() => setOverflowType("visible")}
            />
          </div>
        ) : null}
      </div>
    </StepSection>
  );
}
