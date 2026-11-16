import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PORCELAIN_FINISHES, type ReferenceFinishId } from "@/lib/pool/reference-finishes";
import { ReferenceFinishSwatch } from "./ReferenceFinishSwatch";
import { ChoiceCard } from "./wizard/ChoiceCard";
import { GuidedFinishSection, useFinishGuide } from "./wizard/GuidedFinishSection";
import { finishFamily, TRAVERTINE_FINISHES, type FinishFamily } from "./wizard/finish-guide";

/** A family disclosure only: never overwrite a saved generic/variant ID just
 * to reveal the available choices. Repeated activation keeps them visible. */
export function FinishFamilyChoice({ family, value, onSelect, open, onOpen }: {
  family: FinishFamily;
  value: unknown;
  onSelect: (id: ReferenceFinishId) => void;
  open?: boolean;
  onOpen?: () => void;
}) {
  const { t } = useI18n();
  const selected = finishFamily(value) === family;
  const [expanded, setExpanded] = useState(selected);
  const { guide, request } = useFinishGuide();
  useEffect(() => { setExpanded(selected); }, [selected]);
  const porcelain = family === "porcelain";
  const variants = porcelain ? PORCELAIN_FINISHES : TRAVERTINE_FINISHES;
  const retained = selected && !variants.some(finish => finish.id === value);
  return <>
    <ChoiceCard compact title={t(porcelain ? "Gres porcellanato" : "Travertino")}
      description={t(porcelain ? "Quattro finiture" : "Chiaro o venato · due varianti")}
      image={<ReferenceFinishSwatch id={porcelain ? "reference-light" : "reference-travertine-light"} />}
      selected={selected} expanded={open ?? expanded}
      onSelect={() => { setExpanded(true); request(); onOpen?.(); }} />
    {(open ?? expanded) ? <GuidedFinishSection guide={guide}
      label={t(porcelain ? "Finiture gres porcellanato" : "Varianti del travertino")}
      description={t(retained ? "Finitura attuale conservata fino alla scelta." : "Seleziona una tonalità per applicarla.")}>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 max-sm:[&>button>span:first-child]:h-14 max-sm:[&>button>span:first-child]:aspect-auto max-sm:[&>button>span:first-child>span:first-child]:p-1.5 max-sm:[&>button>span:last-child]:p-2">
        {variants.map(finish => <ChoiceCard key={finish.id} compact
          title={t(porcelain ? finish.subtitle : finish.title)}
          {...(porcelain ? {} : { description: t(finish.id === "reference-travertine-light"
            ? "Tono chiaro con pori naturali." : "Venatura sedimentaria longitudinale.") })}
          image={<ReferenceFinishSwatch id={finish.id} />}
          selected={value === finish.id} onSelect={() => onSelect(finish.id)} />)}
      </div>
    </GuidedFinishSection> : null}
  </>;
}

export function PorcelainFinishChoice(props: {
  value: unknown;
  onSelect: (id: ReferenceFinishId) => void;
}) {
  return <FinishFamilyChoice family="porcelain" {...props} />;
}
