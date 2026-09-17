/**
 * Pure derivation of the real, durably-uploaded attachments (P6B) out of
 * a canonical `ProjectConfiguration`'s `config.uploads`. Split out of
 * submitLead.server.ts so it can be unit-tested directly (that file
 * imports `@tanstack/react-start/server` and can't be bundled standalone
 * outside Vite's plugin pipeline -- see scripts/lead-pipeline-audit.ts's
 * module comment).
 */
import { checkAttachment } from "./attachmentPolicy";
import type { LeadAttachment } from "./types";
import type { ProjectConfiguration } from "@/lib/pool/project";

/** Only ever includes entries that a real, server-validated upload
 * actually completed for (`uploadStatus === "uploaded"` + a real
 * `storagePath`) -- re-checked here against the same attachment policy
 * as a defense-in-depth measure against a tampered client payload
 * claiming a storagePath it never actually uploaded to. */
export function deriveAttachments(project: ProjectConfiguration): ReadonlyArray<LeadAttachment> {
  const uploads = project.config.uploads;
  if (!Array.isArray(uploads)) return [];
  const attachments: LeadAttachment[] = [];
  for (const upload of uploads) {
    if (upload.uploadStatus !== "uploaded" || !upload.storagePath) continue;
    const check = checkAttachment({ name: upload.name, type: upload.type, size: upload.size });
    if (!check.ok) continue;
    attachments.push({
      name: upload.name,
      storagePath: upload.storagePath,
      mimeType: upload.type,
      size: upload.size,
    });
  }
  return attachments;
}
