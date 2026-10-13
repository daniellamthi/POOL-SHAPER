import { computeInfinityEdgeGeometry, infinityExclusion } from "./infinity-edge";
import { oppositeInfinityCoordinate } from "./infinity-access";
import type { SkimmerPlan } from "./engineering";
import type { ResolvedPoolLayout } from "./resolved-layout";
import type { Outline, PoolConfig, PoolMetrics } from "./types";
import { outlineCentroid } from "./geometry";
import type { InfinityExclusion } from "./walls";

export type TechnicalProvenance = "CALCULATED" | "RULE_BASED" | "ESTIMATED" | "NOT_AVAILABLE";

export interface TechnicalField<T> {
  value: T | null;
  provenance: TechnicalProvenance;
  note?: string;
}

export interface TechnicalPlanInput {
  config: PoolConfig;
  /** The same outline supplied to the scene and the existing placement plans. */
  outline: Outline;
  /** Store metrics already account for slope and comfort displacement. */
  metrics: PoolMetrics;
  /** Actual placed skimmers, not a theoretical target count. */
  skimmers: SkimmerPlan;
  /** The resolved comfort/access/lighting plan used by the scene. */
  layout: ResolvedPoolLayout;
}

export interface ResolvedAccessAnchor {
  kind: "steps" | "inox" | "sunShelf" | "hydromassage";
  position: { x: number; z: number };
  /** Actual nearest boundary segment in the resolved pool outline. */
  side: number;
  onInfinityEdge: boolean;
}

/** Exact resolved geometry, not the theoretical wall opposite an Infinity edge. */
export function resolvedAccessAnchors(
  outline: Outline,
  layout: ResolvedPoolLayout,
  excluded: InfinityExclusion | null,
): ResolvedAccessAnchor[] {
  const anchors: Array<{ kind: ResolvedAccessAnchor["kind"]; position: { x: number; z: number }; footprint?: Outline }> = [];
  if (layout.access.placement) anchors.push({
    kind: layout.effectiveAccess === "stainlessSteelLadder" ? "inox" : "steps",
    position: layout.access.placement,
  });
  if (layout.ladder?.plan.placement) anchors.push({ kind: "inox", position: layout.ladder.plan.placement });
  for (const element of layout.comfort.elements) {
    if (element.kind !== "sunShelf" && element.kind !== "hydromassage") continue;
    const [x, z] = outlineCentroid(element.footprint);
    anchors.push({ kind: element.kind, position: { x, z }, footprint: element.footprint });
  }
  return anchors.map(({ kind, position, footprint }) => {
    let side = -1;
    let distance = Infinity;
    for (let index = 0; index < outline.length; index++) {
      const a = outline[index]!, b = outline[(index + 1) % outline.length]!;
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const lengthSquared = dx * dx + dz * dz;
      const pointDistance = (x: number, z: number) => {
        const projection = lengthSquared > 0 ? Math.max(0, Math.min(1,
          ((x - a[0]) * dx + (z - a[1]) * dz) / lengthSquared)) : 0;
        return Math.hypot(x - a[0] - projection * dx, z - a[1] - projection * dz);
      };
      // Comfort centroids can be closer to another wall in a short pool;
      // classify the actual footprint-to-wall contact instead.
      const candidate = footprint
        ? Math.min(...footprint.map(([x, z]) => pointDistance(x, z)))
        : pointDistance(position.x, position.z);
      if (candidate < distance) { distance = candidate; side = index; }
    }
    const edge = outline[side];
    const next = outline[(side + 1) % outline.length];
    const axis = excluded?.axis === "x" ? 0 : 1;
    const onInfinityEdge = !!excluded && (excluded.edgeIndices?.includes(side) ?? (
      !!edge && !!next && Math.abs(edge[axis] - excluded.coordinate) < 1e-5 &&
      Math.abs(next[axis] - excluded.coordinate) < 1e-5
    ));
    return { kind, position, side, onInfinityEdge };
  });
}

export interface TechnicalPlan {
  structure: PoolConfig["structure"];
  system: PoolConfig["system"];
  waterVolume: TechnicalField<number>;
  waterSurface: TechnicalField<number>;
  internalSurface: TechnicalField<number>;
  /** Internal surface is a useful finish-area proxy, not a product take-off. */
  finishArea: TechnicalField<number>;
  leds: {
    count: TechnicalField<number>;
    positions: ResolvedPoolLayout["lighting"]["plan"]["positions"];
  };
  skimmers: {
    count: TechnicalField<number>;
    positions: SkimmerPlan["positions"];
  };
  access: { status: ResolvedPoolLayout["status"]; anchors: ResolvedAccessAnchor[] };
  overflow: null | {
    kind: "VISIBLE_CHANNEL" | "HIDDEN_SLOT" | "INFINITY_EDGE";
    collectionLength: TechnicalField<number>;
    selectedSide: number | null;
    start: readonly [number, number] | null;
    end: readonly [number, number] | null;
    dropDirection: readonly [number, number] | null;
    preferredOppositeSide: null | { axis: "x" | "z"; coordinate: number };
    note: string;
  };
  /** No hydraulic placement rule exists yet; empty positions are deliberate. */
  returns: { positions: readonly []; provenance: "NOT_AVAILABLE"; note: string };
  drains: { positions: readonly []; provenance: "NOT_AVAILABLE"; note: string };
  compensation: {
    required: boolean;
    volume: TechnicalField<number>;
    note: string;
  };
}

/** A technical reading of the *resolved* pool, without a second geometry or hydraulic model. */
export function buildTechnicalPlan({
  config,
  outline,
  metrics,
  skimmers,
  layout,
}: TechnicalPlanInput): TechnicalPlan {
  const measured = (value: number): TechnicalField<number> => ({ value, provenance: "CALCULATED" });
  const requiresDesign = (note: string) => ({
    positions: [] as const,
    provenance: "NOT_AVAILABLE" as const,
    note,
  });
  const infinity = config.system === "infinity" && config.infinityEdge
    ? computeInfinityEdgeGeometry(outline, config.infinityEdge, config.shape)
    : null;
  const excluded = infinity && config.infinityEdge
    ? infinityExclusion(outline, config.infinityEdge, config.shape)
    : null;
  const preferredOppositeSide = excluded
    ? {
        axis: excluded.axis,
        coordinate: oppositeInfinityCoordinate(outline, excluded),
      }
    : null;
  const ledsEnabled = config.features.includes("ledLighting");
  const overflow: TechnicalPlan["overflow"] = config.system === "skimmer"
    ? null
    : config.system === "infinity"
      ? {
          kind: "INFINITY_EDGE",
          collectionLength: infinity
            ? measured(infinity.length)
            : { value: null, provenance: "NOT_AVAILABLE", note: "Lato Infinity non valido per il perimetro corrente." },
          selectedSide: infinity?.side ?? null,
          start: infinity?.start ?? null,
          end: infinity?.end ?? null,
          dropDirection: infinity?.normal ?? null,
          preferredOppositeSide,
          note: "Lunghezza del bordo costruito; dimensionamento della raccolta da verificare.",
        }
      : {
          kind: config.overflowType === "visible" ? "VISIBLE_CHANNEL" : "HIDDEN_SLOT",
          collectionLength: measured(metrics.perimeter),
          selectedSide: null,
          start: null,
          end: null,
          dropDirection: null,
          preferredOppositeSide: null,
          note: config.overflowType === "visible"
            ? "Canale/griglia perimetrale visibile; la sezione idraulica richiede progetto."
            : "Fessura e raccolta perimetrale nascosta; la sezione idraulica richiede progetto.",
        };

  return {
    system: config.system,
    structure: config.structure,
    waterVolume: measured(metrics.waterVolume),
    waterSurface: measured(metrics.waterSurface),
    internalSurface: measured(metrics.internalSurface),
    finishArea: {
      value: metrics.internalSurface,
      provenance: "ESTIMATED",
      note: "Superficie interna come stima iniziale; sfridi e dettagli di posa esclusi.",
    },
    leds: {
      count: { value: ledsEnabled ? layout.lighting.plan.positions.length : 0, provenance: "RULE_BASED" },
      positions: ledsEnabled ? layout.lighting.plan.positions : [],
    },
    skimmers: {
      count: config.system === "skimmer"
        ? { value: skimmers.positions.length, provenance: "RULE_BASED" }
        : { value: null, provenance: "NOT_AVAILABLE", note: "Sistema senza Skimmer." },
      positions: config.system === "skimmer" ? skimmers.positions : [],
    },
    access: { status: layout.status, anchors: resolvedAccessAnchors(outline, layout, excluded) },
    overflow,
    returns: requiresDesign("Posizione e numero delle mandate richiedono il progetto idraulico."),
    drains: requiresDesign("Scarichi di fondo e requisiti di aspirazione richiedono il progetto idraulico."),
    compensation: {
      required: config.system !== "skimmer",
      volume: {
        value: null,
        provenance: "NOT_AVAILABLE",
        note: config.system === "skimmer"
          ? "Vasca di compenso non prevista da questo sistema."
          : "Volume della vasca di compenso da determinare nel progetto idraulico.",
      },
      note: config.system === "skimmer"
        ? "Non applicabile."
        : "Richiede verifica tecnica; il volume non è calcolato dal configuratore.",
    },
  };
}
