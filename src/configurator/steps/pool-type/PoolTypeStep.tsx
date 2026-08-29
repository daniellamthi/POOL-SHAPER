import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { POOL_TYPES } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";

/** Required new-pool step. Its single selection is owned by the configurator store. */
export function PoolTypeStep() {
  const { config, setPoolType } = useConfigurator();

  return (
    <StepSection title="Pool Type" subtitle="Choose the installation type for your new pool.">
      <div className="grid gap-4" role="group" aria-label="Pool type">
        {POOL_TYPES.map((poolType) => (
          <OptionCard
            key={poolType.id}
            title={poolType.title}
            selected={config.poolType === poolType.id}
            onSelect={() => setPoolType(poolType.id)}
          />
        ))}
      </div>
    </StepSection>
  );
}
