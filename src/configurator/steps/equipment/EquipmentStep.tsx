import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { EQUIPMENT, EQUIPMENT_GROUPS } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import { resolveAutomaticCover } from "@/lib/pool/cover-plan";
import { TechnicalDataPanel, useTechnicalData } from "@/components/pool/TechnicalDataPanel";

/** Same slider styling as the LED dimmer, so the two live controls match. */
const RANGE_CLASS =
  "h-11 w-full cursor-pointer appearance-none bg-transparent outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-hairline [&::-moz-range-thumb]:bg-card [&::-moz-range-thumb]:shadow [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-hairline [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-hairline [&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-hairline [&::-webkit-slider-thumb]:bg-card [&::-webkit-slider-thumb]:shadow";

/** Step 8 (Tecnologia) — equipment grouped into the customer-facing
 * subgroups Trattamento acqua / Temperatura / Protezione. The underlying
 * `equipment` list and `toggleEquipment` action are unchanged; this is a
 * display grouping only. */
export function EquipmentStep() {
  const { config, toggleEquipment, setCoverPosition, setCoverExtension } = useConfigurator();
  const coverSelected = config.equipment.includes("automaticCover");
  const coverPlan = resolveAutomaticCover(coverSelected
    ? config
    : { ...config, equipment: [...config.equipment, "automaticCover"] });
  const coverUnavailable = coverPlan.status === "UNAVAILABLE";
  const coverPercent = Math.round(coverPlan.extension * 100);
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
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-xs text-muted-foreground">Apertura della copertura</p>
                <output aria-live="off" className="font-mono text-xs tabular-nums text-muted-foreground">
                  {coverPercent}% chiusa
                </output>
              </div>
              {/* Live, progressive position: the 3D mat follows the thumb in
                  real time; the two presets below jump to the end stops. */}
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={coverPercent}
                aria-label="Estensione copertura automatica"
                aria-valuetext={`${coverPercent} per cento chiusa`}
                onChange={(event) => setCoverExtension(Number(event.target.value) / 100)}
                className={RANGE_CLASS}
              />
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
