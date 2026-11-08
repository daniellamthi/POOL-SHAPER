import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { CatalogueSetting } from "./catalogue-architecture";
import { resolveCatalogueSetting } from "./catalogue-availability";

type Presentation = { setting: CatalogueSetting; contextEnabled: boolean };
type ProjectPresentation = Presentation & { projectId: string };
const settings: readonly CatalogueSetting[] = ["garden", "residence", "spa-wall", "spa-glass", "patio", "infinity-villa"];
const key = (projectId: string) => `pool-shaper:presentation:v1:${projectId}`;

/** Tab-local view preference; never part of cloud snapshots or customer data. */
export function readCataloguePresentation(projectId: string): Presentation | null {
  try {
    if (!projectId || typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(key(projectId));
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || !settings.includes(value.setting) || typeof value.contextEnabled !== "boolean") return null;
    return { setting: value.setting, contextEnabled: value.contextEnabled };
  } catch { return null; }
}

export function writeCataloguePresentation(projectId: string, value: Presentation): void {
  try {
    if (!projectId || typeof window === "undefined") return;
    window.sessionStorage.setItem(key(projectId), JSON.stringify({ version: 1, setting: value.setting, contextEnabled: value.contextEnabled }));
  } catch { /* Restricted/full storage must not prevent configuration. */ }
}

export function useCataloguePresentation({ projectId, ready, presentation, infinity, indoorAvailable }: {
  projectId: string;
  ready: boolean;
  presentation: boolean;
  infinity: boolean;
  indoorAvailable: boolean;
}) {
  const [stored, setStored] = useState<ProjectPresentation | null>(null);
  // The provider's temporary SSR identity must never read or overwrite a view.
  useLayoutEffect(() => {
    if (!ready) return;
    const saved = readCataloguePresentation(projectId);
    setStored({ projectId, setting: saved?.setting ?? "garden", contextEnabled: saved?.contextEnabled ?? false });
  }, [projectId, ready]);
  const current = ready && stored?.projectId === projectId ? stored : null;
  const setting = resolveCatalogueSetting(current?.setting ?? "garden", infinity, indoorAvailable);
  const contextEnabled = ready && (presentation || !!current?.contextEnabled);
  useEffect(() => {
    if (!current) return;
    const next = { projectId, setting, contextEnabled };
    if (current.setting !== setting || current.contextEnabled !== contextEnabled) setStored(next);
    if (contextEnabled) writeCataloguePresentation(projectId, next);
  }, [current, projectId, setting, contextEnabled]);
  const select = useCallback((value: CatalogueSetting) => {
    if (!ready || !current) return;
    const next = { projectId, setting: resolveCatalogueSetting(value, infinity, indoorAvailable), contextEnabled: true };
    // Persist a click immediately, including a reload before passive effects run.
    writeCataloguePresentation(projectId, next);
    setStored(next);
  }, [ready, current, projectId, infinity, indoorAvailable]);
  return { setting, contextEnabled, select };
}
