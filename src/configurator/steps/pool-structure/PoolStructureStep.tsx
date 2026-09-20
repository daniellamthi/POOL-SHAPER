import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { POOL_STRUCTURES } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";

export function PoolStructureStep() {
  const { config, setPoolStructure } = useConfigurator();
  const structures = POOL_STRUCTURES.filter((structure) =>
    config.poolType ? structure.poolTypes.includes(config.poolType) : false,
  );

  return (
    <StepSection
      title="Struttura della piscina"
      subtitle="Scegli il sistema costruttivo della tua piscina."
    >
      <div className="grid gap-4" role="group" aria-label="Struttura della piscina">
        {structures.map((structure) => (
          <OptionCard
            key={structure.id}
            title={structure.title}
            selected={config.structure === structure.id}
            onSelect={() => setPoolStructure(structure.id)}
          />
        ))}
      </div>
    </StepSection>
  );
}
