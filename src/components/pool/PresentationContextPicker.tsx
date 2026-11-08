import { useId } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { CatalogueSetting } from "@/lib/pool/catalogue-architecture";
export interface PresentationContextChoice {
  value: CatalogueSetting;
  onChange: (value: CatalogueSetting) => void;
  infinity: boolean;
  indoorAvailable: boolean;
}
export function PresentationContextPicker({ choice }: { choice: PresentationContextChoice }) {
  const { t } = useI18n();
  const limitId = useId();
  const options: [CatalogueSetting, string][] = choice.infinity
    ? [
        ["garden", "Panorama aperto"],
        ["infinity-villa", "Villa Infinity"],
      ]
    : [
        ["garden", "Giardino aperto"],
        ["residence", "Villa privata"],
        ["spa-wall", "Spa · parete in pietra"],
        ["spa-glass", "Spa · vetrata"],
        ["patio", "Patio contemporaneo"],
      ];
  return (
    <section className="space-y-2">
      <p className="label-xs">{t("Ambientazione")}</p>
      <div
        role="group"
        aria-label={t("Ambientazione della presentazione")}
        className="flex flex-wrap gap-2"
      >
        {options.map(([value, label]) => {
          const disabled = value.startsWith("spa-") && !choice.indoorAvailable;
          return (
            <Button
              key={value}
              variant={!disabled && choice.value === value ? "default" : "outline"}
              aria-pressed={!disabled && choice.value === value}
              disabled={disabled}
              aria-describedby={disabled ? limitId : undefined}
              className={disabled ? "text-muted-foreground" : undefined}
              onClick={() => { if (!disabled) choice.onChange(value); }}
            >
              {t(label)}
            </Button>
          );
        })}
      </div>
      {!choice.infinity && !choice.indoorAvailable && (
        <p id={limitId} className="text-xs text-muted-foreground">
          {t("SPA disponibili fino a 12 × 6 m inclusi.")}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t(
          "Ambientazione illustrativa: architettura e arredi non fanno parte della fornitura piscina.",
        )}
      </p>
    </section>
  );
}
