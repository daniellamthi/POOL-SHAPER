import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  SUN_SHELF_LOUNGER_COLORS,
  sunShelfLoungerColor,
  type SunShelfLoungerColorId,
} from "@/lib/pool/sun-shelf-lounger-colors";

export function SunShelfLoungerColorPicker({
  value,
  onChange,
}: {
  value: SunShelfLoungerColorId | undefined;
  onChange: (value: SunShelfLoungerColorId) => void;
}) {
  const { t } = useI18n();
  const selected = sunShelfLoungerColor(value);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm">
        {t("Colore lettini")}{" "}
        <span aria-live="polite" className="text-xs text-muted-foreground">
          · {t(selected.label)}
        </span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {SUN_SHELF_LOUNGER_COLORS.map((color) => (
          <button
            key={color.id}
            type="button"
            aria-label={t(color.label)}
            aria-pressed={selected.id === color.id}
            title={t(color.label)}
            onClick={() => onChange(color.id)}
            className={cn(
              "flex size-11 items-center justify-center rounded-full border border-foreground/20 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
              selected.id === color.id && "ring-2 ring-brand ring-offset-2",
            )}
            style={{ backgroundColor: color.hex }}
          >
            {selected.id === color.id ? (
              <Check aria-hidden="true" className="size-4 text-black/70" />
            ) : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
