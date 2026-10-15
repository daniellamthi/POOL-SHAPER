/**
 * Browser side of project delivery (Build 2). Remembers, per configuration
 * (`projectId`), the public reference it was saved under and -- only for
 * projects this browser created -- the owner edit token. Shared links never
 * carry a token, so a viewer can restore and read a project but any save
 * from their side becomes their own copy.
 */
import { isEditToken, isPublicRef } from "./reference";
import { parseProjectConfiguration, serializeProjectConfiguration, type ProjectConfiguration } from "../pool/project";

/** Compare normalized data independently of Postgres jsonb property ordering. */
export function projectSnapshotFingerprint(project: ProjectConfiguration): string {
  const normalized = parseProjectConfiguration(serializeProjectConfiguration(project));
  const ordered = (value: unknown): unknown => Array.isArray(value) ? value.map(ordered)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)])) : value;
  return JSON.stringify(ordered(normalized));
}

const STORAGE_KEY = "pool-shaper:cloud-projects:v1";

export interface ProjectLink {
  publicRef: string;
  /** Present only when this browser owns the project. */
  editToken?: string | undefined;
  savedAt?: string | undefined;
  /** The snapshot as last saved from this browser, so "unsaved changes"
   * survives a reload. Owner-only; never sent anywhere. */
  savedSnapshot?: string | undefined;
}

export function projectLinkIsDirty(link: ProjectLink | null, project: ProjectConfiguration): boolean {
  if (!link) return false;
  if (!link.savedSnapshot) return Boolean(link.editToken);
  try {
    return projectSnapshotFingerprint(parseProjectConfiguration(link.savedSnapshot)) !== projectSnapshotFingerprint(project);
  } catch { return true; }
}

function readAll(): Record<string, ProjectLink> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, ProjectLink>) : {};
  } catch {
    return {};
  }
}

export function getProjectLink(projectId: string): ProjectLink | null {
  const link = readAll()[projectId];
  if (!link || !isPublicRef(link.publicRef)) return null;
  return {
    publicRef: link.publicRef,
    editToken: isEditToken(link.editToken) ? link.editToken : undefined,
    savedAt: link.savedAt,
    savedSnapshot: typeof link.savedSnapshot === "string" ? link.savedSnapshot : undefined,
  };
}

export function setProjectLink(projectId: string, link: ProjectLink): void {
  try {
    const all = readAll();
    all[projectId] = link;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable: the project is still saved server-side; only the
    // owner token for future updates is lost in this browser.
  }
}

/** `?p=PW-XXXX-XXXXXX` when the page was opened from a share link. */
export function sharedRefFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("p");
  return isPublicRef(value) ? value : null;
}

/** Reload must restore the saved copy, not the share link it originated from. */
export function savedProjectLocation(href: string, publicRef: string): string {
  if (!isPublicRef(publicRef)) throw new Error("Invalid project reference");
  const location = new URL(href);
  location.searchParams.set("p", publicRef);
  return location.href;
}
