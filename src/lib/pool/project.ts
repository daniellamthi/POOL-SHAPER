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
import type { PoolConfig, RenovationConfig } from "./types";
import { normalisedLedIntensity } from "./led-optics";

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
  return { schemaVersion: PROJECT_SCHEMA_VERSION, projectId, config, renovation };
}

export function serializeProjectConfiguration(project: ProjectConfiguration): string {
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
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId,
    config: {
      ...restored,
      ledIntensity: normalisedLedIntensity(restored.ledIntensity),
      // Same reasoning for the staircase variant: a project saved before the
      // corner flight existed comes back as the straight one it was drawn with.
      internalStairType: restored.internalStairType === "corner" ? "corner" : "linear",
    },
    renovation: renovation as RenovationConfig,
  };
}
