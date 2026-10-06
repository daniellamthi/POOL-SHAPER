import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfigurator } from "@/lib/pool/context";
import {
  createProjectId,
  parseProjectConfiguration,
  serializeProjectConfiguration,
  type ProjectConfiguration,
} from "@/lib/pool/project";
import { saveProjectFn } from "@/lib/project-delivery/projectDelivery.server";
import { getProjectLink, setProjectLink, type ProjectLink } from "@/lib/project-delivery/client";
import { projectShareUrl } from "@/lib/project-delivery/reference";

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
  save: () => Promise<ProjectLink | null>;
  setHeroUrl: (url: string | null) => void;
}

/** The snapshot exactly as the server stores and every restore yields it,
 * so "unsaved changes" compares like with like. */
function canonical(project: ProjectConfiguration): string {
  const json = serializeProjectConfiguration(project);
  try {
    return serializeProjectConfiguration(parseProjectConfiguration(json));
  } catch {
    return json;
  }
}

/** Save / share state for the current configuration. The snapshot sent is
 * always `serializeProjectConfiguration(projectConfiguration)` -- the same
 * object the scene, Summary, PDF and quote read. */
export function useProjectDelivery(): ProjectDeliveryState {
  const { projectConfiguration, restoreProject } = useConfigurator();
  const projectId = projectConfiguration.projectId;
  const snapshot = useMemo(() => canonical(projectConfiguration), [projectConfiguration]);
  const [link, setLink] = useState<ProjectLink | null>(null);
  const [durable, setDurable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ProjectDeliveryState["status"]>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);

  useEffect(() => {
    setLink(getProjectLink(projectId));
  }, [projectId]);

  const save = useCallback(async (): Promise<ProjectLink | null> => {
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
      setLink(next);
      setDurable(result.durable);
      setStatus("saved");
      return next;
    } catch {
      setStatus("error");
      setMessage("Salvataggio non riuscito. Riprova tra poco.");
      return null;
    }
  }, [projectConfiguration, restoreProject]);

  const shareUrl =
    link && typeof window !== "undefined"
      ? projectShareUrl(window.location.origin, link.publicRef)
      : null;
  return {
    link,
    owner: Boolean(link?.editToken),
    dirty: Boolean(link?.editToken) && link?.savedSnapshot !== snapshot,
    durable,
    status,
    message,
    shareUrl,
    heroUrl,
    save,
    setHeroUrl,
  };
}
