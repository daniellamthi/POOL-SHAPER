import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { EQUIPMENT, EQUIPMENT_GROUPS } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";

/** Step 8 (Tecnologia) — equipment grouped into the customer-facing
 * subgroups Trattamento acqua / Temperatura / Protezione. The underlying
 * `equipment` list and `toggleEquipment` action are unchanged; this is a
 * display grouping only. */
export function EquipmentStep() {
  const { config, toggleEquipment } = useConfigurator();

  return (
    <StepSection title="Tecnologia" subtitle="Seleziona la tecnologia da includere nel preventivo.">
      {EQUIPMENT_GROUPS.map((group) => (
        <div key={group.id} className="flex flex-col gap-4">
          <h3 className="label-xs">{group.title}</h3>
          <div className="grid gap-3" role="group" aria-label={group.title}>
            {EQUIPMENT.filter((item) => group.equipmentIds.includes(item.id)).map((item) => (
              <OptionCard
                key={item.id}
                title={item.title}
                description={item.description}
                selected={config.equipment.includes(item.id)}
                onSelect={() => toggleEquipment(item.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </StepSection>
  );
}
