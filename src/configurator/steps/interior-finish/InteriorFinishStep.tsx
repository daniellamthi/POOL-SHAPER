import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { FINISHES } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";

/**
 * Step 5 — selects the interior finish and its colour.
 * The existing material resolver translates these choices for the 3D scene.
 */
export function InteriorFinishStep() {
  const { config, setFinish } = useConfigurator();

  return (
    <StepSection
      title="Interior Finish"
      subtitle="Select the material that defines the character and colour of the water."
    >
      <div className="grid gap-4" role="group" aria-label="Interior finish">
        {FINISHES.map((finish) => (
          <OptionCard
            key={finish.id}
            title={finish.title}
            description={finish.description}
            selected={config.finish === finish.id}
            onSelect={() => setFinish(finish.id)}
          />
        ))}
      </div>
    </StepSection>
  );
}
