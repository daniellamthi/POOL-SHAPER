/**
 * Builds the human-readable commercial email body Piscine Wellness actually
 * reads -- plain text (primary) + a light HTML version. Reuses the same
 * catalogues and Italian translations as the P2 premium summary
 * (`summary-labels.ts`, `config.ts`, `coping-materials.ts`) so the email
 * and the on-screen summary can never quietly disagree about what a value
 * means. This file does NOT re-derive pricing/engineering data -- it only
 * formats fields already present on the canonical `ProjectConfiguration`.
 *
 * P6B: branches on `config.projectType` -- a renovation lead shows its
 * own relevant fields (current situation, requested interventions,
 * problems/needs) instead of the new-pool-specific ones (skimmer detail,
 * LED, etc.) that may not even be meaningfully set for a renovation.
 */
import { exteriorPanelFinishTitle } from "@/lib/pool/above-ground";
import { normalisedLedIntensity } from "@/lib/pool/led-optics";
import { configuredPerimeterLights } from "@/lib/pool/perimeter-lighting";
import { EQUIPMENT, LINER_COLORS, SKIMMER_FINISHES, getShapeDefinition } from "@/lib/pool/config";
import { configuredLightingPlan } from "@/lib/pool/lighting-plan";
import { configuredStairMicroSpots } from "@/lib/pool/resolved-layout";
import { COPING_MATERIALS } from "@/lib/pool/coping-materials";
import { integratedCoping, supportsCopingEdge } from "@/lib/pool/coping-style";
import { configuredPoolLayout } from "@/lib/pool/resolved-layout";
import { pavingLayout } from "@/lib/pool/presentation";
import { getMosaicFinish } from "@/configurator/materials/interior-textures";
import { formatNumber } from "@/lib/pool/format";
import {
  EQUIPMENT_LABEL,
  poolTypeLabel,
  POOL_ACCESS_LABEL,
  INTERNAL_STAIR_LABEL,
  POOL_FEATURE_LABEL,
  SKIMMER_TYPE_LABEL,
  systemHeadline,
  STRUCTURE_LABEL,
} from "@/configurator/steps/final-review/summary-labels";
import { finishDescription } from "@/lib/pool/structure-finish";
import { buildProjectSummary } from "@/lib/project-delivery/summary-model";
import {
  EQUIPMENT_UPGRADE_LABEL,
  FILTRATION_WORK_LABEL,
  RENOVATION_AREA_LABEL,
  STRUCTURE_ISSUE_LABEL,
} from "./renovationLabels";
import { LEAD_TIMING_OPTIONS, type LeadSubmission } from "./types";

function deferredItems(config: LeadSubmission["project"]["config"]): string[] {
  const items: string[] = [];
  if (config.structure === null) items.push("Verifica della soluzione strutturale");
  if (config.equipment.includes("heatPump")) {
    items.push("Dimensionamento della potenza di riscaldamento");
  }
  if (config.equipment.length > 0) items.push("Dimensionamento definitivo dell'impianto tecnico");
  return items;
}

function newPoolLines(submission: LeadSubmission): string[] {
  const config = submission.project.config;
  const isMosaic = config.finish === "mosaic";
  const finishTitle = config.finish === "none"
    ? finishDescription(config.structure, config.finish)
    : isMosaic
      ? (getMosaicFinish(config.mosaicFinish).name ?? "Mosaico")
      : (LINER_COLORS.find((c) => c.id === config.linerColor)?.title ?? config.linerColor);
  const copingFinishTitle = integratedCoping(config)
    ? `${pavingLayout(config.paving, config.pavingFormat).label} — bordo a filo pavimentazione`
    : COPING_MATERIALS.find((c) => c.id === config.copingMaterial)?.title ?? "Non selezionato";
  const copingTitle = copingFinishTitle + (supportsCopingEdge(config) ? config.copingEdge === "rounded" ? " — angoli arrotondati R20 cm" : " — angoli retti" : "");
  const skimmerDetail =
    config.system === "skimmer"
      ? `${SKIMMER_TYPE_LABEL[config.skimmerType as keyof typeof SKIMMER_TYPE_LABEL] ?? config.skimmerType} · ${SKIMMER_FINISHES.find((s) => s.id === config.skimmerFinish)?.title ?? config.skimmerFinish}`
      : null;
  const accessLabel = config.poolAccess
    ? config.poolAccess === "internalSteps"
      ? `${POOL_ACCESS_LABEL.internalSteps} — ${INTERNAL_STAIR_LABEL[config.internalStairType ?? "linear"]}`
      : (POOL_ACCESS_LABEL[config.poolAccess as keyof typeof POOL_ACCESS_LABEL] ??
        config.poolAccess)
    : "Non selezionato";
  const featureLabels = config.features
    .filter((id) => id === "hydromassage" || id === "externalStaircase" || id === "integratedBench")
    .map((id) => id === "integratedBench" ? (() => {
      const bench = configuredPoolLayout(config).comfort.elements.find(element => element.kind === "integratedBench");
      return `Panca integrata · ${bench?.stations?.count ?? 0} postazioni · ${bench?.jets?.length ?? 0} bocchette`;
    })() : POOL_FEATURE_LABEL[id as keyof typeof POOL_FEATURE_LABEL] ?? id);
  const hasLed = config.features.includes("ledLighting");
  const equipmentLabels = EQUIPMENT.filter((option) => config.equipment.includes(option.id)).map(
    (option) => EQUIPMENT_LABEL[option.id],
  );
  const deferred = deferredItems(config);

  return [
    `--- PISCINA ---`,
    `Tipologia: ${poolTypeLabel(config.poolType)}`,
    `Struttura: ${config.structure ? STRUCTURE_LABEL[config.structure] : "Da definire"}`,
    `Forma: ${getShapeDefinition(config.shape).title}`,
    ...(config.system === "infinity" &&
    config.infinityEdge?.enabled &&
    config.infinityEdge.side !== null
      ? [`Lato Infinity: Lato ${config.infinityEdge.side + 1}`]
      : []),
    `Dimensioni: ${formatNumber(config.dimensions.length, 2)} × ${formatNumber(config.dimensions.width, 2)} m, profondità ${formatNumber(config.dimensions.depth, 2)} m`,
    `Sistema idraulico: ${systemHeadline(config.system, config.overflowType)}${skimmerDetail ? ` (${skimmerDetail})` : ""}`,
    `Rivestimento: ${finishTitle}`,
    `Bordo/coping: ${copingTitle}`,
    ...(config.poolType === "above-ground"
      ? [`Pannelli esterni: ${exteriorPanelFinishTitle(config)}`]
      : []),
    `Accesso: ${accessLabel}`,
    ...(configuredStairMicroSpots(config).length ? [`Optional scale: ${POOL_FEATURE_LABEL.stairLighting}`] : []),
    ...(featureLabels.length ? [`Comfort: ${featureLabels.join(", ")}`] : []),
    ...(hasLed
      ? [
          `Illuminazione LED: sì — colore ${(config.ledColor ?? "#ffffff").toUpperCase()}, intensità ${Math.round(normalisedLedIntensity(config.ledIntensity) * 100)}%`,
          ...(config.ledType === "perimeter" ? [
            `LED perimetrali: ${configuredPerimeterLights(config).selected.map(side => `Lato ${side.id + 1}`).join(", ")} · ${formatNumber(configuredPerimeterLights(config).length, 1)} m`,
          ] : [`Punti luce: ${configuredLightingPlan(config).count} — automatici, dimensionamento indicativo (preset generico 1500 lm)`]),
        ]
      : []),
    ...(equipmentLabels.length ? [`Gestione piscina: ${equipmentLabels.join(", ")}`] : []),
    ...(deferred.length
      ? [``, `--- DA DEFINIRE CON IL CONSULENTE ---`, ...deferred.map((i) => `• ${i}`)]
      : []),
  ];
}

function renovationLines(submission: LeadSubmission): string[] {
  const model = buildProjectSummary(submission.project);
  return [
    "--- RISTRUTTURAZIONE PISCINA ---",
    ...model.sections.flatMap(section => [
      `--- ${section.title.toUpperCase()} ---`,
      ...section.rows.map(row => `${row.label}: ${row.value}`),
    ]),
    ...model.technical.map(row => `${row.label}: ${row.value}`),
    model.technicalNote,
  ];
}

export function formatLeadEmail(submission: LeadSubmission): {
  subject: string;
  text: string;
  html: string;
} {
  const { customer, commercial, project, privacy, attachments } = submission;
  const config = project.config;
  const isRenovation = config.projectType === "renovation";
  const timing =
    LEAD_TIMING_OPTIONS.find((option) => option.id === commercial.timing)?.label ??
    commercial.timing;

  const subject = `${isRenovation ? "Ristrutturazione piscina" : "Nuovo progetto piscina"} — ${customer.name} — Rif. ${submission.projectReference ?? submission.projectId.slice(0, 8).toUpperCase()}`;

  const localOnlyUploads = Array.isArray(config.uploads)
    ? config.uploads.filter((upload) => upload.uploadStatus !== "uploaded").length
    : 0;

  const lines = [
    `RICHIESTA VALUTAZIONE ${isRenovation ? "RISTRUTTURAZIONE" : "PROGETTO"} — Piscine Wellness`,
    ``,
    `Richiesta: ${submission.requestId}`,
    `Progetto: ${submission.projectId}`,
    ...(submission.projectReference
      ? [`Riferimento progetto: ${submission.projectReference}`]
      : []),
    `Ricevuta: ${submission.createdAt}`,
    ``,
    `--- CLIENTE ---`,
    `Nome: ${customer.name}`,
    `Email: ${customer.email}`,
    `Telefono: ${customer.phone}`,
    `Località progetto: ${customer.projectLocation}`,
    `Tempistica desiderata: ${timing}`,
    ...(commercial.notes ? [`Note del cliente: ${commercial.notes}`] : []),
    ``,
    ...(isRenovation ? renovationLines(submission) : newPoolLines(submission)),
    ...(attachments.length > 0
      ? [
          ``,
          `--- ALLEGATI (${attachments.length}) ---`,
          ...attachments.map(
            (a) => `• ${a.name} (${a.mimeType}, ${(a.size / 1024).toFixed(0)} KB)`,
          ),
        ]
      : []),
    ...(localOnlyUploads > 0
      ? [
          ``,
          `Nota: ${localOnlyUploads} file selezionato/i dal cliente non risulta/no caricato/i correttamente e non è/sono incluso/i sopra.`,
        ]
      : []),
    ``,
    `--- PRIVACY ---`,
    `Informativa privacy accettata: sì`,
    `Consenso marketing: ${privacy.marketingConsent ? "sì" : "no"}`,
  ];

  const text = lines.join("\n");
  const html = `<pre style="font:14px/1.5 -apple-system,sans-serif;white-space:pre-wrap">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</pre>`;

  return { subject, text, html };
}
