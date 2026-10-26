import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
export interface PresentationContextChoice {
  active: boolean;
  setActive: (active: boolean) => void;
}
export function PresentationContextPicker({ choice }: { choice: PresentationContextChoice }) {
  const { t } = useI18n();
  return (
    <section className="space-y-2">
      <p className="label-xs">{t("Ambientazione")}</p>
      <div
        role="group"
        aria-label={t("Ambientazione della presentazione")}
        className="flex flex-wrap gap-2"
      >
        <Button
          variant={choice.active ? "outline" : "default"}
          aria-pressed={!choice.active}
          onClick={() => choice.setActive(false)}
        >
          {t("Giardino aperto")}
        </Button>
        <Button
          variant={choice.active ? "default" : "outline"}
          aria-pressed={choice.active}
          onClick={() => choice.setActive(true)}
        >
          {t("Patio contemporaneo")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("Ambientazione illustrativa, indipendente dalla piscina configurata.")}
      </p>
    </section>
  );
}
