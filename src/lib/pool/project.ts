/**
 * The canonical, serializable configuration for a single pool project.
 *
 * Everything a customer selects across the wizard -- new-pool or renovation
 * -- lives in exactly one place here (`config` + `renovation`). Nothing else
 * in the app (ProjectSummary, autosave, share links, the render pipeline,
 * PDF export, the commercial lead/CRM handoff) should keep its own copy of
 * these values; each of those is expected to *derive* from a
 * `ProjectConfiguration`, never re-collect or re-store the same choices.
 *
 * This is project data, not view/UI state: it must stay free of Three.js
 * objects, DOM nodes, React refs or anything else that can't survive
 * `JSON.stringify`. Camera position, which dialog is open, hover state, etc.
 * belong in component/store state, not here.
 */
import { exteriorPanelFinish } from "./above-ground";
import { normalizeComfortFeatures } from "./comfort-selection";
import type { PoolConfig, RenovationConfig } from "./types";
import { normalisedLedIntensity } from "./led-optics";
import { clampShallowDepth } from "./floor-profile";
import { clampLShapeDimensions } from "./l-shape";
import { clampInfinityEdgeParams, compatibleInfinityZones, compatiblePoolSystem } from "./infinity-edge";
import { buildOutline } from "./geometry";
import { pavingId, premiumEnvironment } from "./presentation";
import {
  normaliseFinishForStructure,
  normalisePoolStructure,
  structureSupportsPoolType,
} from "./structure-finish";

/** Bump when a shape change to `PoolConfig`/`RenovationConfig` requires a
 * migration for previously saved projects. Keep the migration itself minimal
 * -- a `switch` over old schema versions in `parseProjectConfiguration` --
 * rather than building a general migration framework ahead of need. */
export const PROJECT_SCHEMA_VERSION = 1;

/** One customer's complete configuration: everything needed to reproduce
 * their pool in the 3D scene, the summary, an export, or a CRM lead. */
export interface ProjectConfiguration {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  /** Stable identity for this project. Survives autosave, reload,
   * submission, PDF export and CRM handoff. Never the customer's email --
   * an email can change or be shared across multiple projects. */
  projectId: string;
  config: PoolConfig;
  renovation: RenovationConfig;
}

/** RFC 4122 v4 UUID when available (all modern browsers and Node 19+);
 * falls back to a timestamp + random suffix so project identity never
 * depends on a specific runtime. */
export function createProjectId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `project-${Date.now().toString(36)}-${random}`;
}

export function toProjectConfiguration(
  projectId: string,
  config: PoolConfig,
  renovation: RenovationConfig,
): ProjectConfiguration {
  if (config.shape === "organic") throw new Error("La forma organica non è più disponibile.");
  const candidate = normalisePoolStructure(config.structure);
  const structure = structureSupportsPoolType(candidate, config.poolType) ? candidate : null;
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId,
    config: {
      ...config,
      structure,
      finish: normaliseFinishForStructure(structure, config.finish),
    },
    renovation,
  };
}

export function serializeProjectConfiguration(project: ProjectConfiguration): string {
  if (project.config.shape === "organic") throw new Error("La forma organica non è più disponibile.");
  return JSON.stringify(project);
}

/** Parses and structurally validates a serialized `ProjectConfiguration`.
 * Throws on malformed JSON, a missing/mismatched `schemaVersion` or a
 * missing top-level field -- callers (autosave restore, share links) decide
 * how to react to that, this function never silently returns partial data. */
export function parseProjectConfiguration(json: string): ProjectConfiguration {
  const data: unknown = JSON.parse(json);
  if (typeof data !== "object" || data === null) {
    throw new Error("ProjectConfiguration: expected a JSON object");
  }
  const record = data as Record<string, unknown>;
  const schemaVersion = record["schemaVersion"];
  if (schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new Error(
      `ProjectConfiguration: expected schemaVersion ${PROJECT_SCHEMA_VERSION}, got ${JSON.stringify(schemaVersion)}`,
    );
  }
  const projectId = record["projectId"];
  if (typeof projectId !== "string" || projectId.length === 0) {
    throw new Error("ProjectConfiguration: missing projectId");
  }
  const config = record["config"];
  if (typeof config !== "object" || config === null) {
    throw new Error("ProjectConfiguration: missing config");
  }
  const renovation = record["renovation"];
  if (typeof renovation !== "object" || renovation === null) {
    throw new Error("ProjectConfiguration: missing renovation");
  }
  // A project saved before the LED dimmer existed has no `ledIntensity`.
  // Filling it here, once, means every reader downstream -- scene, summary,
  // commercial email, quotation -- sees a real number instead of each having
  // to guess a fallback of its own.
  const restored = config as PoolConfig;
  // Do not silently redesign a retired product on restore.
  if (restored.shape === "organic") throw new Error("Progetto con forma organica non più supportato. Il file originale resta invariato.");
  const slopeNormalisedDimensions =
    restored.dimensions?.floorProfile === "slope" &&
    Number.isFinite(restored.dimensions.shallowDepth) &&
    Number.isFinite(restored.dimensions.depth)
      ? {
          ...restored.dimensions,
          floorProfile: "slope" as const,
          shallowDepth: clampShallowDepth(
            restored.dimensions.shallowDepth!,
            restored.dimensions.depth,
            0.01,
          ),
          slopeReversed: restored.dimensions.slopeReversed === true,
        }
      : { ...restored.dimensions, floorProfile: "flat" as const };
  // Geometry pass B (L-shape): a project saved before it existed, or one
  // carrying malformed/legacy/missing recess data (NaN, negative, an
  // oversized recess, a zero-width leg, an unrecognised orientation string),
  // always restores as the same safe, real dimensions `clampLShapeDimensions`
  // already guarantees the 3D geometry -- so every OTHER reader (the recess
  // sliders, the orientation diagram, ProjectSummary) sees the same clean
  // numbers too, instead of relying on `buildOutline`'s defensive clamp to
  // save just the render while the UI displays raw garbage underneath it.
  const dimensions = (() => {
    if (restored.shape === "l-shape") {
      const clamped = clampLShapeDimensions({
        totalLength: slopeNormalisedDimensions.length,
        totalWidth: slopeNormalisedDimensions.width,
        recessLength: slopeNormalisedDimensions.lShapeRecessLength,
        recessWidth: slopeNormalisedDimensions.lShapeRecessWidth,
        orientation: slopeNormalisedDimensions.lShapeOrientation,
      });
      return {
        ...slopeNormalisedDimensions,
        length: clamped.totalLength,
        width: clamped.totalWidth,
        lShapeRecessLength: clamped.recessLength,
        lShapeRecessWidth: clamped.recessWidth,
        lShapeOrientation: clamped.orientation,
      };
    }
    return slopeNormalisedDimensions;
  })();
  // Geometry pass D (Infinity, Rectangle + L-shape + Organic): a project
  // saved before Infinity existed, or one carrying malformed/legacy Infinity
  // data, always restores through `clampInfinityEdgeParams` -- same contract
  // as the L-shape/Organic branches above. Infinity candidate zones now
  // exist for all 3 buildable shapes (see `infinity-edge.ts`); only a
  // "custom" free-draw outline has none, so a project that somehow saved
  // `system: "infinity"` against "custom" falls back to skimmer rather than
  // rendering a system that was never built for that shape.
  const outline = buildOutline(restored.shape, dimensions, restored.controlPoints);
  const system = compatiblePoolSystem(restored.system, outline, restored.shape, restored.poolType);
  const restoredStructure = normalisePoolStructure((config as Record<string, unknown>)["structure"]);
  const structure = structureSupportsPoolType(restoredStructure, restored.poolType)
    ? restoredStructure
    : null;
  const finish = normaliseFinishForStructure(structure, restored.finish);
  const infinityZones = compatibleInfinityZones(outline, restored.shape, restored.poolType);
  // Only ever attach an `infinityEdge` field when the project actually has
  // one to normalise (already carried the field, or is genuinely on
  // "infinity") -- a project that never touched Infinity must round-trip
  // byte-for-byte identical, never gain a new field it didn't have before.
  let infinityEdge =
    system === "infinity"
      ? clampInfinityEdgeParams(restored.infinityEdge)
      : undefined;
  if (
    infinityEdge?.enabled &&
    !infinityZones.some((z) => z.side === infinityEdge?.side)
  )
    infinityEdge = clampInfinityEdgeParams(undefined);
  const {
    infinityEdge: _savedInfinityEdge,
    coverExtension: savedCoverExtension,
    exteriorPanelFinish: _savedPanelFinish,
    ...restoredWithoutEdge
  } = restored;
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId,
    config: {
      ...restoredWithoutEdge,
      ...(restored.paving !== undefined ? { paving: pavingId(restored.paving) } : {}),
      ...(restored.premiumEnvironment !== undefined ? { premiumEnvironment: premiumEnvironment(restored.premiumEnvironment) } : {}),
      // External access is only built above ground. Restore the same valid
      // selection in the scene, summary and render export.
      features: normalizeComfortFeatures(restored.poolType === "above-ground"
        ? restored.features.filter((id) => id !== "sunShelf" && id !== "integratedBench")
        : restored.features.filter(
            (id) =>
              id !== "externalStaircase" &&
              (restored.shape === "rectangle" ||
                (id !== "sunShelf" && id !== "integratedBench")),
          )),
      // Above-ground-only selections never survive on an in-ground project.
      equipment: restored.poolType === "above-ground"
        ? restored.equipment
        : restored.equipment.filter((id) => id !== "pellicano"),
      ...(restored.exteriorPanelFinish !== undefined && restored.poolType === "above-ground"
        ? { exteriorPanelFinish: exteriorPanelFinish(restored.exteriorPanelFinish) }
        : {}),
      ledIntensity: normalisedLedIntensity(restored.ledIntensity),
      ...(restored.sceneTime !== undefined
        ? { sceneTime: restored.sceneTime === "night" ? "night" as const : "day" as const }
        : {}),
      // Same reasoning for the staircase variant: a project saved before the
      // corner flight existed comes back as the straight one it was drawn with.
      internalStairType: restored.internalStairType === "corner" ? "corner" : "linear",
      // Unknown values restore as the default closed tub; absent stays absent.
      ...(restored.hydromassageVariant !== undefined
        ? { hydromassageVariant: restored.hydromassageVariant === "open" ? "open" : "closed" }
        : {}),
      // Keep absent legacy cover state absent through restore and save.
      ...(restored.coverPosition !== undefined
        ? { coverPosition: restored.coverPosition === "closed" ? "closed" as const : "open" as const }
        : {}),
      // Same contract for the progressive slider position: clamp a saved
      // number, drop anything else, never invent it for a legacy project.
      ...(typeof savedCoverExtension === "number" && Number.isFinite(savedCoverExtension)
        ? { coverExtension: Math.min(1, Math.max(0, savedCoverExtension)) }
        : {}),
      dimensions,
      structure,
      finish,
      system,
      ...(infinityEdge !== undefined ? { infinityEdge } : {}),
    },
    renovation: renovation as RenovationConfig,
  };
}
