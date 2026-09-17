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

  return [
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
  ];
}

function renovationLines(submission: LeadSubmission): string[] {
  const config = submission.project.config;
  const renovation = submission.project.renovation;
  const areaLabels = renovation.areas.map((id) => RENOVATION_AREA_LABEL[id]);
  const lines = [
    `--- RISTRUTTURAZIONE PISCINA ---`,
    `Interventi richiesti: ${areaLabels.length ? areaLabels.join(", ") : "Da definire"}`,
  ];

  if (config.shape || config.dimensions) {
    lines.push(
      `Piscina attuale: forma ${config.shape}, dimensioni indicative ${formatNumber(config.dimensions.length, 2)} × ${formatNumber(config.dimensions.width, 2)} m, profondità ${formatNumber(config.dimensions.depth, 2)} m`,
    );
  }

  const wantsInterior =
    renovation.areas.includes("interiorFinish") || renovation.areas.includes("complete");
  if (wantsInterior) {
    const newFinishTitle =
      config.finish === "mosaic"
        ? (getMosaicFinish(config.mosaicFinish).name ?? "Mosaico")
        : (LINER_COLORS.find((c) => c.id === config.linerColor)?.title ?? config.linerColor);
    lines.push(
      `Rivestimento: attuale ${renovation.currentFinish} → richiesto ${config.finish} (${newFinishTitle})`,
    );
  }

  const wantsFiltration =
    renovation.areas.includes("filtration") || renovation.areas.includes("complete");
  if (wantsFiltration) {
    const filtrationLabels = renovation.filtrationWorks.map((id) => FILTRATION_WORK_LABEL[id]);
    lines.push(
      `Impianto filtrazione: ${filtrationLabels.length ? filtrationLabels.join(", ") : "Valutazione richiesta"}`,
    );
  }

  const wantsCoping = renovation.areas.includes("coping") || renovation.areas.includes("complete");
  if (wantsCoping) {
    lines.push(
      `Bordo/coping: ${
        renovation.replaceCoping
          ? `sostituzione richiesta${renovation.copingMaterial ? ` (${renovation.copingMaterial})` : ""}`
          : "nessuna sostituzione richiesta"
      }`,
    );
  }

  const wantsStructure =
    renovation.areas.includes("structure") || renovation.areas.includes("complete");
  if (wantsStructure) {
    const structureLabels = renovation.structureIssues.map((id) => STRUCTURE_ISSUE_LABEL[id]);
    lines.push(
      `Problemi struttura: ${structureLabels.length ? structureLabels.join(", ") : "Valutazione generale richiesta"}`,
    );
  }

  const wantsEquipment =
    renovation.areas.includes("equipment") || renovation.areas.includes("complete");
  if (wantsEquipment) {
    const equipmentLabels = renovation.equipmentUpgrades.map((id) => EQUIPMENT_UPGRADE_LABEL[id]);
    lines.push(
      `Aggiornamento dotazioni: ${equipmentLabels.length ? equipmentLabels.join(", ") : "Valutazione richiesta"}`,
    );
  }

  return lines;
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

  const subject = `${isRenovation ? "Ristrutturazione piscina" : "Nuovo progetto piscina"} — ${customer.name} — Rif. ${submission.projectId.slice(0, 8).toUpperCase()}`;

  const localOnlyUploads = Array.isArray(config.uploads)
    ? config.uploads.filter((upload) => upload.uploadStatus !== "uploaded").length
    : 0;

  const lines = [
    `RICHIESTA VALUTAZIONE ${isRenovation ? "RISTRUTTURAZIONE" : "PROGETTO"} — Piscine Wellness`,
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
