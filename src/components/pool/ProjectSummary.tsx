import { normalisedLedIntensity } from "@/lib/pool/led-optics";
import type { ReactNode } from "react";
import { EQUIPMENT, LINER_COLORS, SKIMMER_FINISHES, STEPS } from "@/lib/pool/config";
import { COPING_MATERIALS } from "@/lib/pool/coping-materials";
import { useConfigurator } from "@/lib/pool/context";
import { formatNumber } from "@/lib/pool/format";
import { getMosaicFinish } from "@/configurator/materials/interior-textures";
import {
  EQUIPMENT_LABEL,
  linerWaterCharacter,
  MOSAIC_WATER_CHARACTER,
  POOL_ACCESS_LABEL,
  INTERNAL_STAIR_LABEL,
  POOL_FEATURE_LABEL,
  poolTypeLabel,
  shapeLabel,
  SKIMMER_TYPE_LABEL,
  STRUCTURE_LABEL,
  systemHeadline,
} from "@/configurator/steps/final-review/summary-labels";

const stepIndex = (id: string) => STEPS.findIndex((step) => step.id === id);

function EditLink({ label = "Modifica", onEdit }: { label?: string; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="shrink-0 text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
    >
      {label}
    </button>
  );
}

function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-hairline pt-7 first:border-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h3>
        {onEdit ? <EditLink onEdit={onEdit} /> : null}
      </div>
      <dl className="flex flex-col gap-3.5">{children}</dl>
    </section>
  );
}

function Swatch({ hex, texture }: { hex: string; texture?: string | undefined }) {
  return (
    <span
      aria-hidden
      className="inline-block size-4 shrink-0 rounded-full border border-hairline/80 bg-cover bg-center"
      style={{ backgroundColor: hex, backgroundImage: texture ? `url(${texture})` : undefined }}
    />
  );
}

function Row({
  label,
  value,
  hint,
  swatch,
  onEdit,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  swatch?: ReactNode;
  onEdit?: (() => void) | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <dt className="pt-0.5 text-[11px] font-light text-muted-foreground">{label}</dt>
      <dd className="flex max-w-[64%] flex-col items-end gap-1 text-right">
        <span className="flex items-center gap-2 text-[13px] font-light text-foreground">
          {swatch}
          {value}
          {onEdit ? <EditLink label="Modifica" onEdit={onEdit} /> : null}
        </span>
        {hint ? (
          <span className="text-[11px] font-light text-muted-foreground/85 italic">{hint}</span>
        ) : null}
      </dd>
    </div>
  );
}

/** The premium, Italian, customer-facing recap of the canonical
 * `ProjectConfiguration` (see `src/lib/pool/project.ts`) -- every value
 * shown here is read directly off `config`/`metrics`/`projectId`, nothing
 * is re-collected or re-derived into a second summary model. */
export function ProjectSummary() {
  const { config, metrics, projectId, goToStep } = useConfigurator();

  const dimensionsStepIndex = stepIndex("shape-dimensions");
  const systemStepIndex = stepIndex("system");
  const finishStepIndex = stepIndex("finish");
  const featuresStepIndex = stepIndex("features");
  const equipmentStepIndex = stepIndex("equipment");
  const editStep = (index: number) => (index >= 0 ? () => goToStep(index) : undefined);

  const poolType = poolTypeLabel(config.poolType);
  const dimensionsSentence = `Piscina ${shapeLabel(config.shape)} ${formatNumber(config.dimensions.length, 2)} × ${formatNumber(config.dimensions.width, 2)} m, profondità ${formatNumber(config.dimensions.depth, 2)} m`;
  const systemLine = systemHeadline(config.system, config.overflowType);

  const copingMaterial = COPING_MATERIALS.find((option) => option.id === config.copingMaterial);
  const isMosaic = config.finish === "mosaic";
  const mosaicFinish = isMosaic ? getMosaicFinish(config.mosaicFinish) : null;
  const linerColor = LINER_COLORS.find((option) => option.id === config.linerColor);
  const finishTitle = isMosaic ? (mosaicFinish?.name ?? "Mosaico") : (linerColor?.title ?? "Liner");
  const finishHint = isMosaic ? MOSAIC_WATER_CHARACTER : linerWaterCharacter(config.linerColor);

  const comfortItems = [
    ...(config.poolAccess
      ? [
          config.poolAccess === "internalSteps"
            ? `${POOL_ACCESS_LABEL[config.poolAccess]} — ${INTERNAL_STAIR_LABEL[config.internalStairType ?? "linear"]}`
            : POOL_ACCESS_LABEL[config.poolAccess],
        ]
      : []),
    ...config.features
      .filter((id) => id === "hydromassage" || id === "externalStaircase")
      .map((id) => POOL_FEATURE_LABEL[id]),
  ];

  const hasLed = config.features.includes("ledLighting");
  const ledColor = config.ledColor ?? "#ffffff";
  const ledIntensity = Math.round(normalisedLedIntensity(config.ledIntensity) * 100);

  const selectedEquipment = EQUIPMENT.filter((option) => config.equipment.includes(option.id));

  const deferredItems = [
    ...(config.structure === null ? ["Verifica della soluzione strutturale"] : []),
    ...(config.equipment.includes("heatPump")
      ? ["Dimensionamento della potenza di riscaldamento"]
      : []),
    ...(config.equipment.length > 0 ? ["Dimensionamento definitivo dell'impianto tecnico"] : []),
  ];

  const shortProjectId = projectId.replace(/-/g, "").slice(0, 8).toUpperCase();

  return (
    <section className="animate-rise flex flex-col gap-9 rounded-2xl border border-hairline bg-card/40 p-7">
      <header className="flex flex-col gap-3">
        <p className="text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
          Il tuo progetto
        </p>
        <h2 className="text-[26px] leading-[1.08] font-extralight tracking-[-0.02em] text-foreground sm:text-[30px]">
          {dimensionsSentence}
        </h2>
        <p className="text-[12px] font-light text-muted-foreground">
          {poolType} · {systemLine} · circa {formatNumber(metrics.waterVolume, 0)} m³ d&apos;acqua
        </p>
        <p className="text-[10px] font-light tracking-[0.08em] text-muted-foreground/60">
          Rif. progetto {shortProjectId}
        </p>
        <a
          href="#pool-viewport"
          className="w-fit text-[11px] font-light text-muted-foreground underline-offset-4 hover:text-foreground hover:underline lg:hidden"
        >
          ↑ Espandi piscina
        </a>
      </header>

      <Section title="La tua piscina" onEdit={editStep(dimensionsStepIndex)}>
        <Row label="Tipologia" value={poolType} />
        <Row label="Dimensioni" value={dimensionsSentence} />
        <Row label="Sistema idraulico" value={systemLine} onEdit={editStep(systemStepIndex)} />
      </Section>

      <Section title="Materiali e atmosfera" onEdit={editStep(finishStepIndex)}>
        <Row
          label="Rivestimento"
          value={finishTitle}
          hint={finishHint}
          swatch={
            isMosaic ? (
              <Swatch hex="#c9c2b4" texture={mosaicFinish?.preview} />
            ) : (
              <Swatch hex={linerColor?.hex ?? "#dfe9ec"} texture={linerColor?.texture} />
            )
          }
        />
        <Row
          label="Bordo"
          value={copingMaterial?.title ?? "Da selezionare"}
          swatch={copingMaterial ? <Swatch hex={copingMaterial.color} /> : undefined}
          onEdit={editStep(systemStepIndex)}
        />
      </Section>

      {comfortItems.length > 0 ? (
        <Section title="Accesso e comfort" onEdit={editStep(featuresStepIndex)}>
          {comfortItems.map((item) => (
            <Row key={item} label="Incluso" value={item} />
          ))}
        </Section>
      ) : null}

      {hasLed ? (
        <Section title="Illuminazione" onEdit={editStep(featuresStepIndex)}>
          <Row label="Impianto" value="Illuminazione subacquea a LED" />
          <Row
            label="Colore selezionato"
            value={ledColor.toUpperCase()}
            swatch={<Swatch hex={ledColor} />}
          />
          <Row label="Intensità luce" value={`${ledIntensity}%`} />
        </Section>
      ) : null}

      {selectedEquipment.length > 0 ? (
        <Section title="Gestione della piscina" onEdit={editStep(equipmentStepIndex)}>
          {selectedEquipment.map((option) => (
            <Row key={option.id} label="Incluso" value={EQUIPMENT_LABEL[option.id]} />
          ))}
        </Section>
      ) : null}

      {deferredItems.length > 0 ? (
        <section className="flex flex-col gap-4 border-t border-hairline pt-7">
          <h3 className="text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
            Da definire con il consulente
          </h3>
          <ul className="flex flex-col gap-2.5">
            {deferredItems.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-[12px] font-light text-muted-foreground"
              >
                <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-brand" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="group border-t border-hairline pt-7">
        <summary className="cursor-pointer list-none text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground">
          Scopri i dettagli tecnici
        </summary>
        <dl className="mt-5 flex flex-col gap-3.5">
          {config.structure ? (
            <Row label="Struttura" value={STRUCTURE_LABEL[config.structure]} />
          ) : null}
          {config.system === "skimmer" ? (
            <Row
              label="Skimmer"
              value={`${SKIMMER_TYPE_LABEL[config.skimmerType]} · ${SKIMMER_FINISHES.find((option) => option.id === config.skimmerFinish)?.title ?? config.skimmerFinish}`}
            />
          ) : null}
          <Row label="Codice progetto" value={projectId} />
          {config.uploads.length > 0 ? (
            <Row label="Allegati" value={config.uploads.map((file) => file.name).join(", ")} />
          ) : null}
        </dl>
      </details>
    </section>
  );
}
