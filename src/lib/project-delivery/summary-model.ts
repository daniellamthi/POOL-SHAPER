/**
 * The Premium Summary model (Build 2): one pure derivation of everything the
 * customer is shown about a project, computed ONLY from the canonical
 * ProjectConfiguration. The in-app Summary and the Project Book PDF both
 * render this object, so the two can never disagree.
 */
import type { ProjectConfiguration } from "@/lib/pool/project";
import { projectGeometry } from "@/lib/pool/project-metrics";
import { normalisedLedIntensity } from "@/lib/pool/led-optics";
import { PAVING, pavingId } from "@/lib/pool/presentation";
import { normalizeComfortFeatures } from "@/lib/pool/comfort-selection";
import { configuredLightingPlan } from "@/lib/pool/lighting-plan";
import { EQUIPMENT, LINER_COLORS, SKIMMER_FINISHES } from "@/lib/pool/config";
import { COPING_MATERIALS } from "@/lib/pool/coping-materials";
import { formatNumber } from "@/lib/pool/format";
import { getMosaicFinish } from "@/configurator/materials/interior-textures";
import { isSlopedFloorDisplay } from "@/lib/pool/floor-profile";
import { infinityZonesForOutline } from "@/lib/pool/infinity-edge";
import { configuredPoolLayout } from "@/lib/pool/resolved-layout";
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
  id: "pool" | "water" | "materials" | "comfort" | "lighting" | "exterior" | "scene";
  title: string;
  /** Wizard step that edits this section (Summary "Modifica" links). */
  stepId: string;
  rows: SummaryRow[];
}

export interface ProjectSummaryModel {
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
  return rows;
}

export const TECHNICAL_NOTE =
  "Dati di configurazione, non progetto esecutivo. Portate, aspirazioni, compensazione e compatibilità di cantiere richiedono verifica tecnica.";

export function buildProjectSummary(project: ProjectConfiguration): ProjectSummaryModel {
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
  const dimensionsSentence = `Piscina ${shapeLabel(config.shape)} ${formatNumber(config.dimensions.length, 2)} × ${formatNumber(config.dimensions.width, 2)} m${lShapeRecessSentence}, profondità ${depthLabel}`;
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
    ...(config.poolAccess
      ? [
          config.poolAccess === "internalSteps"
            ? `${POOL_ACCESS_LABEL[config.poolAccess]} — ${INTERNAL_STAIR_LABEL[config.internalStairType ?? "linear"]}`
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
          : POOL_FEATURE_LABEL[id],
      ),
  ];

  const hasLed = config.features.includes("ledLighting");
  const ledColor = config.ledColor ?? "#ffffff";
  const lightingPlan = hasLed ? configuredLightingPlan(config) : null;
  const selectedEquipment = EQUIPMENT.filter((option) => config.equipment.includes(option.id));
  const paving = PAVING.find((p) => p.id === pavingId(config.paving))!;

  const sections: SummarySection[] = [
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
          ? [{ label: "Lato Infinity", value: `Lato ${infinityZone.side + 1}` }]
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
        { label: "Pavimentazione", value: paving.label, swatch: { hex: paving.color } },
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
  if (hasLed) {
    sections.push({
      id: "lighting",
      title: "Illuminazione",
      stepId: "lighting",
      rows: [
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

  return {
    headline: dimensionsSentence,
    subline: `${poolType} · ${systemLine} · circa ${formatNumber(metrics.waterVolume, 0)} m³ d'acqua`,
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
  };
}
