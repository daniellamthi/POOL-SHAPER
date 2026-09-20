import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { POOL_TYPES } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";

/** Required new-pool step. Its single selection is owned by the configurator store. */
export function PoolTypeStep() {
  const { config, setPoolType } = useConfigurator();

  return (
    <StepSection
      title="Tipo di piscina"
      subtitle="Scegli la tipologia di installazione della tua nuova piscina."
    >
      <div className="grid gap-4" role="group" aria-label="Tipo di piscina">
        {POOL_TYPES.map((poolType) => (
          <OptionCard
            key={poolType.id}
            title={poolType.title}
            description={poolType.description}
            selected={config.poolType === poolType.id}
            onSelect={() => setPoolType(poolType.id)}
          />
        ))}
      </div>
    </StepSection>
  );
}
