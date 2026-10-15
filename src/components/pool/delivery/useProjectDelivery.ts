import { useCallback, useEffect, useRef, useState } from "react";
import { useConfigurator } from "@/lib/pool/context";
import {
  createProjectId,
  serializeProjectConfiguration,
  type ProjectConfiguration,
} from "@/lib/pool/project";
import { saveProjectFn } from "@/lib/project-delivery/projectDelivery.server";
import { getProjectLink, setProjectLink, projectSnapshotFingerprint, projectLinkIsDirty, savedProjectLocation, type ProjectLink } from "@/lib/project-delivery/client";
import { projectShareUrl } from "@/lib/project-delivery/reference";

export interface ProjectSaveResult extends ProjectLink {
  projectConfiguration: ProjectConfiguration;
}

export interface ProjectDeliveryState {
  link: ProjectLink | null;
  /** True when this browser can update the saved project. */
  owner: boolean;
  /** The snapshot changed since the last save. */
  dirty: boolean;
  durable: boolean | null;
  status: "idle" | "saving" | "saved" | "error";
  message: string | null;
  shareUrl: string | null;
  heroUrl: string | null;
  save: () => Promise<ProjectSaveResult | null>;
  setHeroUrl: (url: string | null) => void;
}

/** The snapshot exactly as the server stores and every restore yields it,
 * so "unsaved changes" compares like with like. */
function canonical(project: ProjectConfiguration): string {
  return projectSnapshotFingerprint(project);
}

/** Save / share state for the current configuration. The snapshot sent is
 * always `serializeProjectConfiguration(projectConfiguration)` -- the same
 * object the scene, Summary, PDF and quote read. */
export function useProjectDelivery(): ProjectDeliveryState {
  const { projectConfiguration, restoreProject } = useConfigurator();
  const projectId = projectConfiguration.projectId;
  const [link, setLink] = useState<ProjectLink | null>(null);
  const [durable, setDurable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ProjectDeliveryState["status"]>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const saving = useRef<Promise<ProjectSaveResult | null> | null>(null);

  useEffect(() => {
    setLink(getProjectLink(projectId));
  }, [projectId]);

  const saveSnapshot = useCallback(async (): Promise<ProjectSaveResult | null> => {
    setStatus("saving");
    setMessage(null);
    let project = projectConfiguration;
    let current = getProjectLink(project.projectId);
    if (current && !current.editToken) {
      // Opened from someone else's share link: never mutate their project.
      // Saving creates this visitor's own copy with its own identity.
      project = { ...project, projectId: createProjectId() };
      restoreProject(project);
      current = null;
    }
    const call = (owned: ProjectLink | null) =>
      saveProjectFn({
        data: {
          snapshot: serializeProjectConfiguration(project),
          ...(owned?.editToken ? { publicRef: owned.publicRef, editToken: owned.editToken } : {}),
        },
      });
    try {
      let result = await call(current);
      if (!result.ok && result.code === "forbidden") result = await call(null);
      if (!result.ok) {
        setStatus("error");
        setMessage(result.message);
        return null;
      }
      const next: ProjectLink = {
        publicRef: result.publicRef,
        editToken: result.editToken ?? current?.editToken,
        savedAt: result.savedAt,
        savedSnapshot: canonical(project),
      };
      setProjectLink(project.projectId, next);
      window.history.replaceState(window.history.state, "", savedProjectLocation(window.location.href, next.publicRef));
      setLink(next);
      setDurable(result.durable);
      setStatus("saved");
      return { ...next, projectConfiguration: project };
    } catch {
      setStatus("error");
      setMessage("Salvataggio non riuscito. Riprova tra poco.");
      return null;
    }
  }, [projectConfiguration, restoreProject]);

  // Save, Share, PDF and quote preparation share one pending write. A double
  // click on an unsaved project must not create two references racing to win.
  const save = useCallback((): Promise<ProjectSaveResult | null> => {
    if (saving.current) return saving.current;
    const pending = saveSnapshot();
    saving.current = pending;
    const release = () => { if (saving.current === pending) saving.current = null; };
    void pending.then(release, release);
    return pending;
  }, [saveSnapshot]);

  const shareUrl =
    link && typeof window !== "undefined"
      ? projectShareUrl(window.location.origin, link.publicRef)
      : null;
  return {
    link,
    owner: Boolean(link?.editToken),
    dirty: projectLinkIsDirty(link, projectConfiguration),
    durable,
    status,
    message,
    shareUrl,
    heroUrl,
    save,
    setHeroUrl,
  };
}
