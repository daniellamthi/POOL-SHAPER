import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { EQUIPMENT, EQUIPMENT_GROUPS } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import { resolveAutomaticCover } from "@/lib/pool/cover-plan";
import { TechnicalDataPanel, useTechnicalData } from "@/components/pool/TechnicalDataPanel";

/** Step 8 (Tecnologia) — equipment grouped into the customer-facing
 * subgroups Trattamento acqua / Temperatura / Protezione. The underlying
 * `equipment` list and `toggleEquipment` action are unchanged; this is a
 * display grouping only. */
export function EquipmentStep() {
  const { config, toggleEquipment, setCoverPosition } = useConfigurator();
  const coverSelected = config.equipment.includes("automaticCover");
  const coverPlan = resolveAutomaticCover(coverSelected
    ? config
    : { ...config, equipment: [...config.equipment, "automaticCover"] });
  const coverUnavailable = coverPlan.status === "UNAVAILABLE";
  const { technical, cover } = useTechnicalData();

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
                disabled={item.id === "automaticCover" && !coverSelected && coverUnavailable}
                {...(item.id === "automaticCover" ? { disabledReason: coverPlan.reason ?? "Copertura non disponibile per questa configurazione." } : {})}
              />
            ))}
          </div>
          {group.id === "protection" && coverSelected ? (
            <div className="flex flex-col gap-3 border-l border-hairline pl-3">
              <p className="text-xs text-muted-foreground">Posizione della copertura</p>
              <div className="flex gap-2" role="group" aria-label="Posizione della copertura automatica">
                {(["open", "closed"] as const).map((position) => (
                  <button
                    key={position}
                    type="button"
                    aria-pressed={(config.coverPosition ?? "open") === position}
                    onClick={() => setCoverPosition(position)}
                    className={`min-h-11 rounded-xl border px-4 text-sm ${
                      (config.coverPosition ?? "open") === position
                        ? "border-brand bg-brand/10"
                        : "border-hairline bg-card"
                    }`}
                  >
                    {position === "open" ? "Aperta" : "Chiusa"}
                  </button>
                ))}
              </div>
              {coverPlan.reason ? (
                <p className="text-xs text-muted-foreground" role="status">{coverPlan.reason}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
      <TechnicalDataPanel technical={technical} cover={cover} />
    </StepSection>
  );
}
