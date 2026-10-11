/**
 * Centralized attachment rules (P6B) -- imported by both the client
 * (FileDrop.tsx, for instant feedback before even attempting an upload)
 * and the server (uploadAttachment.server.ts, the authoritative check;
 * the client-side check is a UX nicety, never trusted alone). Pure
 * constants/functions only, safe in the client bundle.
 */

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const ALLOWED_ATTACHMENT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"] as const;

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_ATTACHMENTS_PER_PROJECT = 8;

export const ATTACHMENT_ACCEPT_ATTR = [
  ...ALLOWED_ATTACHMENT_EXTENSIONS,
  ...ALLOWED_ATTACHMENT_MIME_TYPES,
].join(",");

export function getExtension(filename: string): string {
  const match = /\.[^./\\]+$/.exec(filename);
  return match ? match[0].toLowerCase() : "";
}

export interface AttachmentCheckResult {
  ok: boolean;
  reason?: string;
}

/** Never trust the browser's declared MIME type alone -- checked here
 * only as one signal alongside the extension and size; the server also
 * runs this same check on the actual uploaded bytes' declared type. */
export function checkAttachment(file: {
  name: string;
  type: string;
  size: number;
}): AttachmentCheckResult {
  const extension = getExtension(file.name);
  const expectedType: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf" };
  if (file.type && expectedType[extension] !== file.type) {
    return { ok: false, reason: "Estensione e tipo del file non corrispondono." };
  }
  if (
    !ALLOWED_ATTACHMENT_EXTENSIONS.includes(
      extension as (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number],
    )
  ) {
    return { ok: false, reason: "Formato file non consentito. Sono ammessi: JPG, PNG, WEBP, PDF." };
  }
  if (
    file.type &&
    !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
    )
  ) {
    return { ok: false, reason: "Tipo di file non consentito." };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      reason: `Il file supera la dimensione massima di ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.`,
    };
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    return { ok: false, reason: "Il file è vuoto o non valido." };
  }
  return { ok: true };
}

/** Content signatures are checked server-side, not inferred from the filename. */
export function matchesAttachmentSignature(bytes: Uint8Array, type: string): boolean {
  const starts = (values: number[]) => values.every((v, i) => bytes[i] === v);
  if (type === "image/jpeg") return starts([255, 216, 255]);
  if (type === "image/png") return starts([137, 80, 78, 71, 13, 10, 26, 10]);
  if (type === "application/pdf") return starts([37, 80, 68, 70, 45]);
  if (type === "image/webp") return starts([82, 73, 70, 70]) && [87, 69, 66, 80].every((v, i) => bytes[i + 8] === v);
  return false;
}
