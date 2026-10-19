/**
 * The Premium Summary model (Build 2): one pure derivation of everything the
 * customer is shown about a project, computed ONLY from the canonical
 * ProjectConfiguration. The in-app Summary and the Project Book PDF both
 * render this object, so the two can never disagree.
 */
import { exteriorPanelFinishTitle } from "@/lib/pool/above-ground";
import type { ProjectConfiguration } from "@/lib/pool/project";
import { projectGeometry } from "@/lib/pool/project-metrics";
import { normalisedLedIntensity } from "@/lib/pool/led-optics";
import { pavingLayout } from "@/lib/pool/presentation";
import { normalizeComfortFeatures } from "@/lib/pool/comfort-selection";
import { configuredLightingPlan } from "@/lib/pool/lighting-plan";
import { EQUIPMENT, LINER_COLORS, SKIMMER_FINISHES, FINISHES } from "@/lib/pool/config";
import { renovationIncludes, renovationMosaicLabel, renovationLinerLabel } from "@/lib/pool/renovation";
import { RENOVATION_AREA_LABEL, FILTRATION_WORK_LABEL, STRUCTURE_ISSUE_LABEL, EQUIPMENT_UPGRADE_LABEL } from "@/lib/lead/renovationLabels";
import { COPING_MATERIALS } from "@/lib/pool/coping-materials";
import { localizeSummaryModel, translateText, formatNumericText, formatNumber as localeNumber, type Locale } from "@/lib/i18n";
import { configuredSunShelfLoungers } from "@/lib/pool/sun-shelf-loungers";
import { comfortConfigurationIssues } from "@/lib/pool/comfort-compatibility";
import { getMosaicFinish } from "@/configurator/materials/interior-textures";
import { isSlopedFloorDisplay } from "@/lib/pool/floor-profile";
import { infinityZonesForOutline } from "@/lib/pool/infinity-edge";
import { configuredPoolLayout, configuredStairMicroSpots } from "@/lib/pool/resolved-layout";
import { buildTechnicalPlan, type TechnicalPlan } from "@/lib/pool/technical-plan";
import { resolveAutomaticCover, type CoverPlan } from "@/lib/pool/cover-plan";
import { finishDescription } from "@/lib/pool/structure-finish";
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

export interface SummarySwatch {
  hex: string;
  texture?: string | undefined;
}

export interface SummaryRow {
  label: string;
  value: string;
  hint?: string | undefined;
  swatch?: SummarySwatch | undefined;
}

export interface SummarySection {
  id: "pool" | "water" | "materials" | "comfort" | "lighting" | "exterior" | "scene" | "renovation";
  title: string;
  /** Wizard step that edits this section (Summary "Modifica" links). */
  stepId: string;
  rows: SummaryRow[];
}

export interface ProjectSummaryModel {
  /** Unresolved requests are visible in summary and prevent final PDF/quote. */
  compatibilityIssues?: string[];
  headline: string;
  subline: string;
  /** Configuration identity (UUID). The public project reference, when the
   * project is saved, lives on the server record, not in the snapshot. */
  projectId: string;
  sections: SummarySection[];
  deferred: string[];
  technical: SummaryRow[];
  technicalNote: string;
  plan: {
    outline: ReadonlyArray<readonly [number, number]>;
    length: number;
    width: number;
    depthLabel: string;
  };
}

const PROVENANCE = {
  CALCULATED: "Calcolato",
  RULE_BASED: "Da layout",
  ESTIMATED: "Stima",
  NOT_AVAILABLE: "Da verificare",
} as const;

export function coverStateLabel(cover: CoverPlan): string {
  if (!cover.enabled) return "Non selezionata";
  if (cover.status === "UNAVAILABLE") return "Richiesta · da verificare";
  if (cover.extension > 0.02 && cover.extension < 0.98)
    return `Automatica · chiusa al ${Math.round(cover.extension * 100)}%`;
  return cover.position === "closed" ? "Automatica · chiusa" : "Automatica · aperta";
}

/** The indicative technical sheet, shared by the viewport panel, the
 * Summary and the PDF. */
export function technicalRows(
  technical: TechnicalPlan,
  cover: CoverPlan,
  compact = false,
  locale: Locale = "it",
): SummaryRow[] {
  const systemName =
    technical.system === "infinity"
      ? "Infinity"
      : technical.system === "skimmer"
        ? "Skimmer"
        : technical.overflow?.kind === "VISIBLE_CHANNEL"
          ? "Sfioro visibile"
          : "Sfioro nascosto";
  const rows: SummaryRow[] = [
    { label: "Sistema", value: systemName },
    {
      label: "Struttura",
      value: technical.structure ? STRUCTURE_LABEL[technical.structure] : "Da definire",
    },
    {
      label: "Volume acqua",
      value: `${technical.waterVolume.value?.toFixed(1) ?? "—"} m³`,
      hint: PROVENANCE[technical.waterVolume.provenance],
    },
    {
      label: "Superficie acqua",
      value: `${technical.waterSurface.value?.toFixed(1) ?? "—"} m²`,
      hint: PROVENANCE[technical.waterSurface.provenance],
    },
  ];
  if (!compact) {
    rows.push(
      {
        label: "Superficie vasca base",
        value: `${technical.internalSurface.value?.toFixed(1) ?? "—"} m²`,
        hint: "Calcolata sul guscio base; comfort e dettagli esclusi.",
      },
      {
        label: "Finitura interna",
        value: `≈ ${technical.finishArea.value?.toFixed(1) ?? "—"} m² · stima`,
        hint: technical.finishArea.note,
      },
      {
        label: "LED",
        value: `${technical.leds.count.value ?? 0} · disposizione automatica`,
        hint: PROVENANCE[technical.leds.count.provenance],
      },
    );
  }
  rows.push(
    technical.system === "skimmer"
      ? {
          label: "Skimmer",
          value: `${technical.skimmers.count.value ?? 0} · posizionati`,
          hint: PROVENANCE[technical.skimmers.count.provenance],
        }
      : {
          label: "Raccolta",
          value: `${technical.overflow?.collectionLength.value?.toFixed(1) ?? "—"} m · ${technical.overflow?.kind === "INFINITY_EDGE" ? "bordo Infinity" : "perimetro"}`,
          hint: technical.overflow?.note,
        },
    {
      label: "Mandate / scarichi",
      value: "Posizionamento da progettare",
      hint: `${technical.returns.note} ${technical.drains.note}`,
    },
  );
  if (technical.compensation.required) {
    rows.push({
      label: "Compensazione",
      value: "Volume da verificare",
      hint: technical.compensation.note,
    });
  }
  rows.push({ label: "Copertura", value: coverStateLabel(cover), hint: cover.reason ?? undefined });
  return rows.map(row => ({...row, label:translateText(row.label,locale), value:formatNumericText(translateText(row.value,locale),locale), ...(row.hint?{hint:translateText(row.hint,locale)}:{})}));
}

export const TECHNICAL_NOTE =
  "Dati di configurazione, non progetto esecutivo. Portate, aspirazioni, compensazione e compatibilità di cantiere richiedono verifica tecnica.";

export function buildProjectSummary(project: ProjectConfiguration, locale: Locale = "it"): ProjectSummaryModel {
  const t = (text: string, params?: Record<string,string|number>) => translateText(text, locale, params);
  const formatNumber = (value: number, digits = 2) => localeNumber(value, locale, {minimumFractionDigits: digits, maximumFractionDigits: digits});
  const { config } = project;
  const { outline, metrics, skimmers } = projectGeometry(config);
  const technical = buildTechnicalPlan({
    config,
    outline,
    metrics,
    skimmers,
    layout: configuredPoolLayout(config),
  });
  const cover = resolveAutomaticCover(config);

  const poolType = poolTypeLabel(config.poolType);
  const isSlopedFloor = isSlopedFloorDisplay(config.shape, config.poolType, config.dimensions);
  const depthLabel = isSlopedFloor
    ? `${formatNumber(config.dimensions.shallowDepth!, 2)} → ${formatNumber(config.dimensions.depth, 2)} m`
    : `${formatNumber(config.dimensions.depth, 2)} m`;
  const lShapeRecessSentence =
    config.shape === "l-shape"
      ? `, rientro ${formatNumber(config.dimensions.lShapeRecessLength ?? 0, 2)} × ${formatNumber(config.dimensions.lShapeRecessWidth ?? 0, 2)} m`
      : "";
  const dimensionsSentence = t("Piscina {shape} {length} × {width} m{mirror}, profondità {depth}", {
    shape:t(shapeLabel(config.shape)), length:formatNumber(config.dimensions.length,2), width:formatNumber(config.dimensions.width,2), mirror:lShapeRecessSentence, depth:depthLabel,
  });
  const systemLine = systemHeadline(config.system, config.overflowType);
  const infinityZone =
    config.system === "infinity" &&
    config.infinityEdge?.enabled &&
    config.infinityEdge.side !== null
      ? infinityZonesForOutline(outline, config.shape).find(
          (zone) => zone.side === config.infinityEdge!.side,
        )
      : null;

  const copingMaterial = COPING_MATERIALS.find((option) => option.id === config.copingMaterial);
  const isMosaic = config.finish === "mosaic";
  const mosaicFinish = isMosaic ? getMosaicFinish(config.mosaicFinish) : null;
  const linerColor = LINER_COLORS.find((option) => option.id === config.linerColor);
  const noAdditionalFinish = config.finish === "none";
  const finishTitle = noAdditionalFinish
    ? finishDescription(config.structure, config.finish)
    : isMosaic
      ? (mosaicFinish?.name ?? "Mosaico")
      : (linerColor?.title ?? "Liner");
  const finishHint = noAdditionalFinish
    ? "Pareti, fondo e superfici integrate in acciaio inox satinato a vista"
    : isMosaic
      ? MOSAIC_WATER_CHARACTER
      : linerWaterCharacter(config.linerColor);
  const finishSwatch: SummarySwatch = noAdditionalFinish
    ? { hex: "#bfc6c8" }
    : isMosaic
      ? { hex: "#c9c2b4", texture: mosaicFinish?.preview }
      : { hex: linerColor?.hex ?? "#dfe9ec", texture: linerColor?.texture };

  const comfortItems = [
    ...(config.features.includes("sunShelfLoungers") ? [`${t("Lettini per spiaggetta")} · ${config.sunShelfLoungerCount ?? configuredSunShelfLoungers(config).capacity}`] : []),
    ...(config.poolAccess
      ? [
          config.poolAccess === "internalSteps"
            ? `${POOL_ACCESS_LABEL[config.poolAccess]} — ${INTERNAL_STAIR_LABEL[config.internalStairType ?? "linear"]}${config.poolType === "above-ground" && config.internalStairMirrored ? " · speculare" : ""}`
            : POOL_ACCESS_LABEL[config.poolAccess],
        ]
      : []),
    ...normalizeComfortFeatures(config.features)
      .filter(
        (id) =>
          id === "inoxLadder" ||
          id === "hydromassage" ||
          id === "sunShelf" ||
          id === "integratedBench" ||
          id === "externalStaircase",
      )
      .map((id) =>
        id === "hydromassage"
          ? config.hydromassageVariant === "open"
            ? "Idromassaggio B"
            : "Idromassaggio A"
          : id === "externalStaircase" && config.poolType === "above-ground"
            ? `${POOL_FEATURE_LABEL[id]} — ${config.externalStairSide === "long" ? "lato lungo" : "lato corto"} · piattaforma prolungata inclusa`
            : POOL_FEATURE_LABEL[id],
      ),
  ];
  const compatibilityIssues = comfortConfigurationIssues(config).map(issue => t(issue.reason));

  const hasLed = config.features.includes("ledLighting");
  const ledColor = config.ledColor ?? "#ffffff";
  const lightingPlan = hasLed ? configuredLightingPlan(config) : null;
  const selectedEquipment = EQUIPMENT.filter((option) => config.equipment.includes(option.id));
  const paving = pavingLayout(config.paving, config.pavingFormat);

  let sections: SummarySection[] = [
    {
      id: "pool",
      title: "La tua piscina",
      stepId: "shape-dimensions",
      rows: [
        { label: "Tipologia", value: poolType },
        ...(config.structure
          ? [{ label: "Struttura", value: STRUCTURE_LABEL[config.structure] }]
          : []),
        { label: "Dimensioni", value: dimensionsSentence },
        ...(isSlopedFloor
          ? [
              { label: "Fondo", value: "In pendenza" },
              { label: "Profondità", value: depthLabel },
              {
                label: "Dislivello",
                value: `${Math.round((config.dimensions.depth - config.dimensions.shallowDepth!) * 100)} cm`,
              },
            ]
          : []),
      ],
    },
    {
      id: "water",
      title: "Linea d'acqua",
      stepId: "system",
      rows: [
        { label: "Sistema idraulico", value: systemLine },
        ...(infinityZone
          ? [{ label: "Lato Infinity", value: `Lato ${infinityZone.side + 1}` },
             { label: "Parete Infinity", value: config.infinityEdge?.wallType === "glass" ? "Panoramica in vetro" : "Tradizionale" }]
          : []),
        ...(config.system === "skimmer"
          ? [
              {
                label: "Skimmer",
                value: `${SKIMMER_TYPE_LABEL[config.skimmerType]} · ${SKIMMER_FINISHES.find((option) => option.id === config.skimmerFinish)?.title ?? config.skimmerFinish}`,
              },
            ]
          : []),
      ],
    },
    {
      id: "materials",
      title: "Materiali",
      stepId: "style",
      rows: [
        { label: "Rivestimento", value: finishTitle, hint: finishHint, swatch: finishSwatch },
        {
          label: "Bordo",
          value: copingMaterial?.title ?? "Da selezionare",
          swatch: copingMaterial ? { hex: copingMaterial.color } : undefined,
        },
        ...(config.poolType === "above-ground"
          ? [{ label: "Pannelli esterni", value: exteriorPanelFinishTitle(config) }]
          : []),
        { label: "Pavimentazione", value: paving.label, swatch: { hex: paving.color } },
        { label: "Formato pavimentazione", value: paving.formatLabel, hint: "Dimensioni di riferimento della visualizzazione; fornitura da confermare." },
      ],
    },
  ];
  if (comfortItems.length > 0) {
    sections.push({
      id: "comfort",
      title: "Accesso e comfort",
      stepId: "access",
      rows: comfortItems.map((item) => ({ label: "Incluso", value: item })),
    });
  }
  const hasStairLed = configuredStairMicroSpots(config).length > 0;
  if (hasLed || hasStairLed || (config.features.includes("hydromassage") && config.features.includes("hydromassageBenchLighting"))) {
    sections.push({
      id: "lighting",
      title: "Illuminazione",
      stepId: "lighting",
      rows: [
        ...(hasStairLed ? [{ label: "Optional scale", value: POOL_FEATURE_LABEL.stairLighting }] : []),
        ...(config.features.includes("hydromassage") && config.features.includes("hydromassageBenchLighting")
          ? [{ label: "Optional panca", value: POOL_FEATURE_LABEL.hydromassageBenchLighting }]
          : []),
        ...(hasLed ? [
        { label: "Impianto", value: "Illuminazione subacquea a LED" },
        {
          label: "Punti luce",
          value: `${lightingPlan?.count ?? 0} · automatici, dimensionamento indicativo`,
        },
        { label: "Colore selezionato", value: ledColor.toUpperCase(), swatch: { hex: ledColor } },
        {
          label: "Intensità luce",
          value: `${Math.round(normalisedLedIntensity(config.ledIntensity) * 100)}%`,
        },
        ] : []),
      ],
    });
  }
  if (selectedEquipment.length > 0) {
    sections.push({
      id: "exterior",
      title: "Optional",
      stepId: "technology",
      rows: [
        ...selectedEquipment.map((option) => ({
          label: "Incluso",
          value: EQUIPMENT_LABEL[option.id],
        })),
        ...(cover.enabled ? [{ label: "Copertura", value: coverStateLabel(cover) }] : []),
      ],
    });
  }
  sections.push({
    id: "scene",
    title: "Presentazione",
    stepId: "review",
    rows: [{ label: "Momento", value: config.sceneTime === "night" ? "Notte" : "Giorno" }],
  });

  const deferred = [
    ...(config.structure === null ? ["Verifica della soluzione strutturale"] : []),
    ...(config.equipment.includes("heatPump")
      ? ["Dimensionamento della potenza di riscaldamento"]
      : []),
    ...(config.equipment.length > 0 ? ["Dimensionamento definitivo dell'impianto tecnico"] : []),
  ];

  if (config.projectType === "renovation") {
    const r = project.renovation;
    const e = r.existing;
    const currentName = r.currentFinish === "mosaic"
      ? renovationMosaicLabel(e?.mosaicFinish ?? config.mosaicFinish)
      : renovationLinerLabel(LINER_COLORS.find(l => l.id === (e?.linerColor ?? config.linerColor))?.title ?? "Liner PVC");
    const formatList = <T extends string>(ids: readonly T[], labels: Record<T, string>) =>
      ids.map(id => labels[id]).join(", ") || "Valutazione con il consulente";
    const works: SummaryRow[] = [
      { label: "Interventi richiesti", value: formatList(r.areas, RENOVATION_AREA_LABEL) },
      ...(renovationIncludes(r, "filtration") ? [{ label: "Impianto filtrazione", value: formatList(r.filtrationWorks, FILTRATION_WORK_LABEL) }] : []),
      ...(renovationIncludes(r, "structure") ? [{ label: "Problemi struttura", value: formatList(r.structureIssues, STRUCTURE_ISSUE_LABEL) }] : []),
      ...(renovationIncludes(r, "equipment") ? [{ label: "Optional impianto", value: formatList(r.equipmentUpgrades, EQUIPMENT_UPGRADE_LABEL) }] : []),
    ];
    sections = [
      { id: "pool", title: "Piscina esistente", stepId: "renovation-pool", rows: [
        { label: "Tipologia", value: poolTypeLabel(e?.poolType ?? config.poolType) },
        { label: "Struttura", value: (e?.structure ?? config.structure) ? STRUCTURE_LABEL[(e?.structure ?? config.structure)!] : "Da verificare" },
        { label: "Dimensioni", value: dimensionsSentence },
        { label: "Fondo", value: isSlopedFloor ? "In pendenza" : "Piano" },
        { label: "Accesso esistente", value: config.poolAccess === "internalSteps"
          ? INTERNAL_STAIR_LABEL[config.internalStairType ?? "linear"] : config.poolAccess ? POOL_ACCESS_LABEL[config.poolAccess] : "Senza scala interna" },
      ] },
      { id: "water", title: "Impianto esistente e proposta", stepId: "renovation-pool", rows: [
        { label: "Sistema esistente", value: systemHeadline(e?.system ?? config.system, e?.overflowType ?? config.overflowType) },
        { label: "Sistema proposto", value: systemLine },
        { label: "Fattibilità", value: "Verifica tecnica in cantiere" },
      ] },
      { id: "materials", title: "Rivestimenti e bordo", stepId: "renovation-details", rows: [
        { label: "Rivestimento esistente", value: `${FINISHES.find(f => f.id === r.currentFinish)?.title ?? "Da verificare"} · ${currentName}` },
        { label: "Rivestimento proposto", value: renovationIncludes(r, "interiorFinish")
          ? config.finish === "mosaic" ? renovationMosaicLabel(config.mosaicFinish) : renovationLinerLabel(finishTitle)
          : "Conservato", ...(renovationIncludes(r, "interiorFinish") ? { swatch: finishSwatch } : {}) },
        { label: "Bordo", value: !renovationIncludes(r, "coping") || r.replaceCoping === false ? "Conservato" :
          r.replaceCoping === null ? "Da definire" : COPING_MATERIALS.find(c => c.id === r.copingMaterial)?.title ?? (r.copingMaterial || "Materiale da definire") },
      ] },
      { id: "renovation", title: "Lavori proposti e optional", stepId: "renovation-details", rows: works },
      { id: "scene", title: "Presentazione", stepId: "renovation-review", rows: [
        { label: "Anteprima", value: "Proposta indicativa, non progetto esecutivo" },
        { label: "Momento", value: config.sceneTime === "night" ? "Notte" : "Giorno" },
      ] },
    ];
    deferred.push("Fattibilità degli interventi e sopralluogo", "Preventivo su valutazione del consulente, senza prezzi automatici");
  }

  return localizeSummaryModel({
    compatibilityIssues,
    headline: config.projectType === "renovation" ? `Ristrutturazione · ${dimensionsSentence}` : dimensionsSentence,
    subline: t("{poolType} · {system} · circa {volume} m³ d'acqua", {poolType:t(poolType),system:t(systemLine),volume:formatNumber(metrics.waterVolume,0)}),
    projectId: project.projectId,
    sections,
    deferred,
    technical: technicalRows(technical, cover),
    technicalNote: TECHNICAL_NOTE,
    plan: {
      outline,
      length: config.dimensions.length,
      width: config.dimensions.width,
      depthLabel,
    },
  }, locale);
}
