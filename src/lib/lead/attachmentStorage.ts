/**
 * Durable attachment storage for the dedicated (not-yet-provisioned)
 * POOL-SHAPER Supabase project -- see supabase/migrations/0002_*.sql for
 * the private `pool-shaper-attachments` bucket this expects. Talks to
 * Supabase Storage's REST API via plain `fetch`, same pattern as
 * storage.ts's lead store: no SDK dependency, no service-role key ever
 * reaches the client.
 *
 * When SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY aren't configured (this
 * environment's current state -- see the P6A/P6B reports), uploads
 * return a controlled STORAGE_NOT_CONFIGURED error. Never a fake
 * success.
 */
import { MAX_ATTACHMENTS_PER_PROJECT } from "./attachmentPolicy";

export const ATTACHMENT_BUCKET = "pool-shaper-attachments";

export interface StoredAttachment {
  name: string;
  storagePath: string;
  mimeType: string;
  size: number;
}

export type AttachmentStorageErrorCode =
  "STORAGE_NOT_CONFIGURED" | "TOO_MANY_ATTACHMENTS" | "UPLOAD_FAILED";

export class AttachmentStorageError extends Error {
  code: AttachmentStorageErrorCode;
  constructor(code: AttachmentStorageErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AttachmentStorageError";
  }
}

export interface AttachmentStore {
  readonly kind: "supabase" | "unavailable";
  upload(
    file: { name: string; type: string; bytes: Uint8Array },
    context: { projectId: string },
  ): Promise<StoredAttachment>;
}

function getServerEnv(name: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env[name] : undefined;
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/** Object names must never be guessable from the original filename alone
 * (no directory traversal, no collisions, no leaking a customer's file
 * naming) -- a random UUID prefix, project-scoped path, sanitised
 * original name kept only for readability in the dashboard. */
function buildStoragePath(projectId: string, originalName: string): string {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return `${projectId}/${crypto.randomUUID()}-${safeName}`;
}

class SupabaseAttachmentStore implements AttachmentStore {
  readonly kind = "supabase" as const;
  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string,
  ) {}

  private headers(extra?: Record<string, string>) {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      ...extra,
    };
  }

  private async countExisting(projectId: string): Promise<number> {
    const response = await fetch(`${this.url}/storage/v1/object/list/${ATTACHMENT_BUCKET}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefix: `${projectId}/`, limit: MAX_ATTACHMENTS_PER_PROJECT + 1 }),
    });
    if (!response.ok) return 0; // best-effort count; the upload itself still gets validated
    const entries = (await response.json()) as unknown[];
    return Array.isArray(entries) ? entries.length : 0;
  }

  async upload(
    file: { name: string; type: string; bytes: Uint8Array },
    context: { projectId: string },
  ): Promise<StoredAttachment> {
    const existingCount = await this.countExisting(context.projectId);
    if (existingCount >= MAX_ATTACHMENTS_PER_PROJECT) {
      throw new AttachmentStorageError(
        "TOO_MANY_ATTACHMENTS",
        `Hai raggiunto il numero massimo di ${MAX_ATTACHMENTS_PER_PROJECT} allegati per questo progetto.`,
      );
    }

    const storagePath = buildStoragePath(context.projectId, file.name);
    const response = await fetch(
      `${this.url}/storage/v1/object/${ATTACHMENT_BUCKET}/${storagePath}`,
      {
        method: "POST",
        headers: this.headers({ "Content-Type": file.type || "application/octet-stream" }),
        body: new Blob([file.bytes as unknown as BlobPart]),
      },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AttachmentStorageError(
        "UPLOAD_FAILED",
        `Supabase Storage upload failed (${response.status}): ${body}`,
      );
    }
    return { name: file.name, storagePath, mimeType: file.type, size: file.bytes.length };
  }
}

class UnavailableAttachmentStore implements AttachmentStore {
  readonly kind = "unavailable" as const;
  upload(): Promise<StoredAttachment> {
    return Promise.reject(
      new AttachmentStorageError(
        "STORAGE_NOT_CONFIGURED",
        "Il caricamento file non è ancora disponibile in questo ambiente (nessun progetto Supabase dedicato configurato).",
      ),
    );
  }
}

const unavailableStore = new UnavailableAttachmentStore();

export function getAttachmentStore(): AttachmentStore {
  const url = getServerEnv("SUPABASE_URL");
  const serviceRoleKey = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (url && serviceRoleKey) return new SupabaseAttachmentStore(url, serviceRoleKey);
  return unavailableStore;
}
