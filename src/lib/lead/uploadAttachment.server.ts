/**
 * Server-only attachment upload endpoint (P6B). Client sends the actual
 * file as `multipart/form-data`; nothing here trusts the browser's
 * declared MIME type alone -- `checkAttachment` re-validates extension +
 * declared type + size against the same policy the client already
 * checked, and the server is the one writing to storage, so this is the
 * authoritative gate.
 */
import { createServerFn } from "@tanstack/react-start";
import { checkAttachment } from "./attachmentPolicy";
import { getAttachmentStore, type StoredAttachment } from "./attachmentStorage";

export interface UploadAttachmentResult extends StoredAttachment {
  success: true;
}

function validateUploadForm(data: unknown): { file: File; projectId: string } {
  if (!(data instanceof FormData)) {
    throw new Error("Richiesta di caricamento non valida.");
  }
  const file = data.get("file");
  const projectId = data.get("projectId");
  if (!(file instanceof File)) {
    throw new Error("Nessun file ricevuto.");
  }
  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    throw new Error("Progetto non identificato.");
  }
  return { file, projectId: projectId.trim() };
}

export const uploadAttachment = createServerFn({ method: "POST" })
  .validator(validateUploadForm)
  .handler(async ({ data }): Promise<UploadAttachmentResult> => {
    const { file, projectId } = data;

    const check = checkAttachment({ name: file.name, type: file.type, size: file.size });
    if (!check.ok) {
      throw new Error(check.reason ?? "File non valido.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    // The declared `size` can't be trusted either -- re-check the bytes
    // actually received.
    if (bytes.byteLength !== file.size || bytes.byteLength <= 0) {
      throw new Error("Il file ricevuto non corrisponde a quanto dichiarato.");
    }

    const store = getAttachmentStore();
    const stored = await store.upload({ name: file.name, type: file.type, bytes }, { projectId });
    return { success: true, ...stored };
  });
