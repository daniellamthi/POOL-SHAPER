/**
 * Builds the human-readable commercial email body Piscine Wellness actually
 * reads -- plain text (primary) + a light HTML version. Reuses the same
 * catalogues and Italian translations as the P2 premium summary
 * (`summary-labels.ts`, `config.ts`, `coping-materials.ts`) so the email
 * and the on-screen summary can never quietly disagree about what a value
 * means. This file does NOT re-derive pricing/engineering data -- it only
 * formats fields already present on the canonical `ProjectConfiguration`.
 */
import { EQUIPMENT, LINER_COLORS, SKIMMER_FINISHES } from "@/lib/pool/config";
import { COPING_MATERIALS } from "@/lib/pool/coping-materials";
import { getMosaicFinish } from "@/configurator/materials/interior-textures";
import { formatNumber } from "@/lib/pool/format";
import {
  EQUIPMENT_LABEL,
  poolTypeLabel,
  POOL_ACCESS_LABEL,
  POOL_FEATURE_LABEL,
  SKIMMER_TYPE_LABEL,
  systemHeadline,
} from "@/configurator/steps/final-review/summary-labels";
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

export function formatLeadEmail(submission: LeadSubmission): {
  subject: string;
  text: string;
  html: string;
} {
  const { customer, commercial, project, privacy } = submission;
  const config = project.config;
  const timing =
    LEAD_TIMING_OPTIONS.find((option) => option.id === commercial.timing)?.label ??
    commercial.timing;

  const isMosaic = config.finish === "mosaic";
  const finishTitle = isMosaic
    ? (getMosaicFinish(config.mosaicFinish).name ?? "Mosaico")
    : (LINER_COLORS.find((c) => c.id === config.linerColor)?.title ?? config.linerColor);
  const copingTitle =
    COPING_MATERIALS.find((c) => c.id === config.copingMaterial)?.title ?? "Non selezionato";
  const skimmerDetail =
    config.system === "skimmer"
      ? `${SKIMMER_TYPE_LABEL[config.skimmerType as keyof typeof SKIMMER_TYPE_LABEL] ?? config.skimmerType} · ${SKIMMER_FINISHES.find((s) => s.id === config.skimmerFinish)?.title ?? config.skimmerFinish}`
      : null;
  const accessLabel = config.poolAccess
    ? (POOL_ACCESS_LABEL[config.poolAccess as keyof typeof POOL_ACCESS_LABEL] ?? config.poolAccess)
    : "Non selezionato";
  const featureLabels = config.features
    .filter((id) => id === "hydromassage" || id === "externalStaircase")
    .map((id) => POOL_FEATURE_LABEL[id as keyof typeof POOL_FEATURE_LABEL] ?? id);
  const hasLed = config.features.includes("ledLighting");
  const equipmentLabels = EQUIPMENT.filter((option) => config.equipment.includes(option.id)).map(
    (option) => EQUIPMENT_LABEL[option.id],
  );
  const deferred = deferredItems(config);
  const uploadsCount = Array.isArray(config.uploads) ? config.uploads.length : 0;

  const subject = `Nuovo progetto piscina — ${customer.name} — Rif. ${submission.projectId.slice(0, 8).toUpperCase()}`;

  const lines = [
    `RICHIESTA VALUTAZIONE PROGETTO — Piscine Wellness`,
    ``,
    `Richiesta: ${submission.requestId}`,
    `Progetto: ${submission.projectId}`,
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
    `--- PISCINA ---`,
    `Tipologia: ${poolTypeLabel(config.poolType)}`,
    `Dimensioni: ${formatNumber(config.dimensions.length, 2)} × ${formatNumber(config.dimensions.width, 2)} m, profondità ${formatNumber(config.dimensions.depth, 2)} m`,
    `Sistema idraulico: ${systemHeadline(config.system, config.overflowType)}${skimmerDetail ? ` (${skimmerDetail})` : ""}`,
    `Rivestimento: ${finishTitle}`,
    `Bordo/coping: ${copingTitle}`,
    `Accesso: ${accessLabel}`,
    ...(featureLabels.length ? [`Comfort: ${featureLabels.join(", ")}`] : []),
    ...(hasLed
      ? [`Illuminazione LED: sì — colore ${(config.ledColor ?? "#ffffff").toUpperCase()}`]
      : []),
    ...(equipmentLabels.length ? [`Gestione piscina: ${equipmentLabels.join(", ")}`] : []),
    ...(deferred.length
      ? [``, `--- DA DEFINIRE CON IL CONSULENTE ---`, ...deferred.map((i) => `• ${i}`)]
      : []),
    ...(uploadsCount > 0
      ? [
          ``,
          `Nota: il cliente ha indicato ${uploadsCount} allegato/i in configurazione. Non sono stati caricati su alcun sistema di storage -- nessuna integrazione attiva in questa versione.`,
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
