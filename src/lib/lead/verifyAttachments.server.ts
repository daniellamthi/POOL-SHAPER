import { assertPoolShaperTarget } from "../supabase-target.server";
import { ATTACHMENT_BUCKET } from "./attachmentStorage";
import { MAX_ATTACHMENTS_PER_PROJECT } from "./attachmentPolicy";
import type { LeadAttachment } from "./types";
import { backendRequest } from "../backend-db.server";

/** Unpredictable object paths are upload capabilities; never trust client metadata. */
export async function verifyStoredAttachments(projectId: string, attachments: ReadonlyArray<LeadAttachment>, ownerHash?: string): Promise<void> {
  if (!attachments.length) return;
  const url = process.env["SUPABASE_URL"]?.trim() ?? "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  assertPoolShaperTarget(url);
  if (!key || !/^[A-Za-z0-9_-]{1,100}$/.test(projectId) || attachments.length > MAX_ATTACHMENTS_PER_PROJECT) throw new Error("Allegati non validi.");
  if (!ownerHash || !/^[0-9a-f]{64}$/.test(ownerHash)) throw new Error("Autorizzazione allegati mancante.");
  const owners = await backendRequest<Array<{ project_id: string }>>(`/rest/v1/attachment_owners?project_id=eq.${encodeURIComponent(projectId)}&owner_hash=eq.${ownerHash}&select=project_id`);
  if (!owners.length) throw new Error("Non sei autorizzato agli allegati del progetto.");
  const paths = new Set<string>();
  for (const item of attachments) {
    const parts = item.storagePath.split("/");
    if (parts.length !== 2 || parts[0] !== projectId || !/^[0-9a-f-]{36}-[A-Za-z0-9._-]+$/.test(parts[1] ?? "") || paths.has(item.storagePath)) throw new Error("Allegato non appartenente al progetto.");
    paths.add(item.storagePath);
    const entries = await backendRequest<Array<{ size: number; mime_type: string }>>(`/rest/v1/attachment_uploads?project_id=eq.${encodeURIComponent(projectId)}&storage_path=eq.${encodeURIComponent(item.storagePath)}&state=eq.complete&select=size,mime_type`);
    if (entries.length !== 1 || entries[0]?.size !== item.size || entries[0]?.mime_type !== item.mimeType) throw new Error("Allegato non autorizzato o incompleto.");
    const response = await fetch(`${url}/storage/v1/object/info/${ATTACHMENT_BUCKET}/${item.storagePath}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!response.ok) throw new Error("Allegato non disponibile. Caricalo nuovamente.");
    const object = await response.json() as { size?: number; content_type?: string };
    if (object.size !== item.size || object.content_type !== item.mimeType) throw new Error("I dati dell’allegato non corrispondono al file archiviato.");
  }
}
