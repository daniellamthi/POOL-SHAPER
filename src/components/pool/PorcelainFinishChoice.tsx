import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { isPorcelainSelection, PORCELAIN_FINISHES, type ReferenceFinishId } from "@/lib/pool/reference-finishes";
import { ReferenceFinishSwatch } from "./ReferenceFinishSwatch";
import { ChoiceCard } from "./wizard/ChoiceCard";

/** A material disclosure, not a fifth porcelain colour or a config migration. */
export function PorcelainFinishChoice({ value, onSelect }: {
  value: unknown;
  onSelect: (id: ReferenceFinishId) => void;
}) {
  const { t } = useI18n();
  const selected = isPorcelainSelection(value);
  const [expanded, setExpanded] = useState(selected);
  useEffect(() => { if (selected) setExpanded(true); }, [selected]);
  return <>
    <ChoiceCard compact title={t("Gres porcellanato")} description={t("Quattro finiture")}
      image={<ReferenceFinishSwatch id="reference-light" />} selected={selected}
      expanded={expanded}
      onSelect={() => setExpanded(open => !open)} />
    {expanded ? <div className="col-span-full space-y-3 rounded-xl border border-hairline p-3"
      role="group" aria-label={t("Finiture gres porcellanato")}>
      <p className="text-xs text-muted-foreground">{t("Seleziona una tonalità per applicarla.")}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PORCELAIN_FINISHES.map(finish => <ChoiceCard key={finish.id} compact
          title={t(finish.subtitle)} image={<ReferenceFinishSwatch id={finish.id} />}
          selected={value === finish.id} onSelect={() => onSelect(finish.id)} />)}
      </div>
    </div> : null}
  </>;
}
