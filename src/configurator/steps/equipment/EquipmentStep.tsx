import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { EQUIPMENT } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";

export function EquipmentStep() {
  const { config, toggleEquipment } = useConfigurator();

  return (
    <StepSection title="Equipment" subtitle="Select equipment to include in the quotation.">
      <div className="grid gap-3" role="group" aria-label="Pool equipment">
        {EQUIPMENT.map((equipment) => (
          <OptionCard
            key={equipment.id}
            title={equipment.title}
            description={equipment.description}
            selected={config.equipment.includes(equipment.id)}
            onSelect={() => toggleEquipment(equipment.id)}
          />
        ))}
      </div>
    </StepSection>
  );
}
