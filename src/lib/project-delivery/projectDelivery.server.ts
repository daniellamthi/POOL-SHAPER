/**
 * Server functions for project delivery (Build 2). Thin wrappers: all logic
 * lives in `service.ts` over `getProjectStore()`; the browser never holds a
 * database key. Expected failures come back as `{ ok: false, code }` so the
 * UI can react (e.g. a non-owner save becomes "save as a new project").
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  MAX_SNAPSHOT_BYTES,
  ProjectDeliveryError,
  loadSharedProject,
  saveProject,
  type ProjectDeliveryErrorCode,
  type SaveProjectResult,
  type SharedProjectResult,
} from "./service";
import { getProjectStore, ProjectStorageError } from "./store";

type Outcome<T> = ({ ok: true } & T) | { ok: false; code: ProjectDeliveryErrorCode; message: string };

async function run<T>(work: () => Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, ...(await work()) };
  } catch (error) {
    if (error instanceof ProjectDeliveryError) {
      return { ok: false, code: error.code, message: error.message };
    }
    console.error("[project] storage failure", error instanceof ProjectStorageError ? error.message : error);
    return {
      ok: false,
      code: "storage_unavailable",
      message: "Il salvataggio non è disponibile in questo momento.",
    };
  }
}

const saveInput = z.object({
  snapshot: z.string().min(2).max(MAX_SNAPSHOT_BYTES),
  publicRef: z.string().max(32).optional(),
  editToken: z.string().max(64).optional(),
});

export const saveProjectFn = createServerFn({ method: "POST" })
  .validator(saveInput)
  .handler(
    async ({ data }): Promise<Outcome<SaveProjectResult>> =>
      run(() => saveProject(getProjectStore(), data)),
  );

export const loadSharedProjectFn = createServerFn({ method: "POST" })
  .validator(z.object({ publicRef: z.string().max(32) }))
  .handler(
    async ({ data }): Promise<Outcome<SharedProjectResult>> =>
      run(() => loadSharedProject(getProjectStore(), data.publicRef)),
  );
