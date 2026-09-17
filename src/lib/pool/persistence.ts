/**
 * Local autosave/resume for the canonical `ProjectConfiguration` (P1).
 *
 * A full configuration serializes to roughly 1-2 KB (measured against the
 * project-config audit fixture) -- comfortably inside `localStorage`'s
 * typical multi-MB quota, so there is no need for IndexedDB here. Nothing
 * beyond `config` + `renovation` + `projectId` + `schemaVersion` is ever
 * written: no Three.js objects, no camera/UI state, no File/Blob data.
 */
import {
  parseProjectConfiguration,
  serializeProjectConfiguration,
  type ProjectConfiguration,
} from "./project";

const STORAGE_KEY = "pool-shaper:project-draft:v1";

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    // Some environments (privacy modes, sandboxed iframes) throw on access.
    return false;
  }
}

/** `UploadedFile.url` is a `blob:` object URL -- it never survives a reload
 * (the underlying blob is gone), so persisting it would only produce a
 * broken reference. Metadata (name/size/type/category) is still useful and
 * safe to keep. */
function sanitizeForStorage(project: ProjectConfiguration): ProjectConfiguration {
  if (project.config.uploads.length === 0) return project;
  return {
    ...project,
    config: {
      ...project.config,
      uploads: project.config.uploads.map((upload) => ({ ...upload, url: null })),
    },
  };
}

/** Debounced by the caller -- this itself is a single synchronous write.
 * Never throws: storage being full, disabled, or unavailable degrades to
 * "no autosave this session", not a broken configurator. */
export function saveProjectDraft(project: ProjectConfiguration): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      serializeProjectConfiguration(sanitizeForStorage(project)),
    );
  } catch (error) {
    // Quota exceeded, storage disabled by the user, private-mode Safari, etc.
    console.warn("[pool-shaper] could not save project draft", error);
  }
}

/** Returns the saved draft only if it parses as a structurally valid,
 * current-schema `ProjectConfiguration`. Any corruption, truncation, or an
 * old/unsupported `schemaVersion` is treated as "no draft" -- restoring
 * never crashes the configurator and never overwrites a valid in-memory
 * project with garbage. */
export function loadProjectDraft(): ProjectConfiguration | null {
  if (!hasLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseProjectConfiguration(raw);
  } catch (error) {
    console.warn("[pool-shaper] discarding unreadable project draft", error);
    return null;
  }
}

export function clearProjectDraft(): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing meaningful to do if even removal fails.
  }
}
