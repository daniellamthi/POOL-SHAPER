/**
 * Project delivery core (Build 2): save, update and shared read of the
 * canonical ProjectConfiguration. Pure over a `ProjectStore`, so the same
 * logic is exercised by the server functions and by the audit against a
 * real PostgREST/Postgres.
 */
import {
  PROJECT_SCHEMA_VERSION,
  parseProjectConfiguration,
  serializeProjectConfiguration,
  type ProjectConfiguration,
} from "@/lib/pool/project";
import {
  createEditToken,
  createPublicRef,
  hashEditToken,
  isEditToken,
  isPublicRef,
} from "./reference";
import type { ProjectStore } from "./store";
import { DEFAULT_CUSTOMER } from "@/lib/pool/config";

/** A full configuration serializes to ~1-2 KB; 64 KB leaves ample room and
 * still refuses abuse (uploads are metadata only, never file content). */
export const MAX_SNAPSHOT_BYTES = 64 * 1024;

export type ProjectDeliveryErrorCode =
  | "invalid_snapshot"
  | "too_large"
  | "invalid_reference"
  | "forbidden"
  | "not_found"
  | "storage_unavailable";

export class ProjectDeliveryError extends Error {
  constructor(
    readonly code: ProjectDeliveryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProjectDeliveryError";
  }
}

export interface SaveProjectInput {
  /** `serializeProjectConfiguration` output -- the one canonical snapshot. */
  snapshot: string;
  /** Present when the browser owns an already saved project. */
  publicRef?: string | undefined;
  editToken?: string | undefined;
}

export interface SaveProjectResult {
  publicRef: string;
  /** Returned only when a new project is created; the browser keeps it. */
  editToken: string | null;
  created: boolean;
  durable: boolean;
  savedAt: string;
}

export interface SharedProjectResult {
  publicRef: string;
  snapshot: string;
  updatedAt: string;
  durable: boolean;
}

/** Validates through the same parser autosave and share restore use, and
 * re-serializes, so what is stored is exactly what every reader restores. */
export function canonicalSnapshot(snapshot: string): ProjectConfiguration {
  if (typeof snapshot !== "string" || snapshot.length === 0) {
    throw new ProjectDeliveryError("invalid_snapshot", "Configurazione mancante.");
  }
  if (new TextEncoder().encode(snapshot).length > MAX_SNAPSHOT_BYTES) {
    throw new ProjectDeliveryError("too_large", "Configurazione troppo grande.");
  }
  try {
    const project = parseProjectConfiguration(snapshot);
    return parseProjectConfiguration(serializeProjectConfiguration(project));
  } catch {
    throw new ProjectDeliveryError("invalid_snapshot", "Configurazione non valida.");
  }
}

/** What a share link may reveal: the pool, never the person. Contact
 * details and upload metadata stay in the owner's browser and in the quote
 * request; they are stripped before storage and again on every shared read. */
export function shareableProject(project: ProjectConfiguration): ProjectConfiguration {
  return { ...project, config: { ...project.config, customer: DEFAULT_CUSTOMER, uploads: [] } };
}

export async function saveProject(
  store: ProjectStore,
  input: SaveProjectInput,
): Promise<SaveProjectResult> {
  const project = shareableProject(canonicalSnapshot(input.snapshot));
  if (input.publicRef !== undefined || input.editToken !== undefined) {
    if (!isPublicRef(input.publicRef) || !isEditToken(input.editToken)) {
      throw new ProjectDeliveryError("invalid_reference", "Riferimento progetto non valido.");
    }
    const updated = await store.update(
      input.publicRef,
      await hashEditToken(input.editToken),
      PROJECT_SCHEMA_VERSION,
      project,
    );
    if (!updated) {
      // Unknown reference or not the owner: never mutate, never reveal which.
      throw new ProjectDeliveryError("forbidden", "Non puoi modificare questo progetto.");
    }
    return {
      publicRef: updated.publicRef,
      editToken: null,
      created: false,
      durable: store.durable,
      savedAt: updated.updatedAt,
    };
  }
  const editToken = createEditToken();
  const editTokenHash = await hashEditToken(editToken);
  for (let attempt = 0; attempt < 4; attempt++) {
    const publicRef = createPublicRef();
    const inserted = await store.insert({
      publicRef,
      projectId: project.projectId,
      editTokenHash,
      snapshotVersion: PROJECT_SCHEMA_VERSION,
      snapshot: project,
    });
    if (inserted) {
      return {
        publicRef,
        editToken,
        created: true,
        durable: store.durable,
        savedAt: new Date().toISOString(),
      };
    }
  }
  throw new ProjectDeliveryError("storage_unavailable", "Salvataggio non riuscito, riprova.");
}

export async function loadSharedProject(
  store: ProjectStore,
  publicRef: unknown,
): Promise<SharedProjectResult> {
  if (!isPublicRef(publicRef)) {
    throw new ProjectDeliveryError("invalid_reference", "Riferimento progetto non valido.");
  }
  const row = await store.getShared(publicRef);
  if (!row) throw new ProjectDeliveryError("not_found", "Progetto non trovato.");
  // Legacy/older rows go through the same parser (and its migrations) as
  // every other restore; an unsupported snapshot is refused, not guessed.
  const project = shareableProject(canonicalSnapshot(JSON.stringify(row.snapshot)));
  return {
    publicRef: row.publicRef,
    snapshot: serializeProjectConfiguration(project),
    updatedAt: row.updatedAt,
    durable: store.durable,
  };
}
