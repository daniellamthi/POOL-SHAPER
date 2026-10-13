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
import { checkAttachment, matchesAttachmentSignature } from "./attachmentPolicy";
import { assertPoolShaperTarget } from "../supabase-target.server";
import { backendRpc, backendRequest, privateToken, sha256 } from "../backend-db.server";

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
    context: { projectId: string; ownerHash: string },
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
interface UploadReservation {
  id: string; state: "reserved" | "complete" | "busy" | "full";
  storage_path: string; name: string; mime_type: string; size: number;
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

  async upload(
    file: { name: string; type: string; bytes: Uint8Array },
    context: { projectId: string; ownerHash: string },
  ): Promise<StoredAttachment> {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(context.projectId)) throw new AttachmentStorageError("UPLOAD_FAILED", "Progetto non valido.");
    if (!/^[0-9a-f]{64}$/.test(context.ownerHash)) throw new AttachmentStorageError("UPLOAD_FAILED", "Autorizzazione mancante.");
    if (!checkAttachment({ name: file.name, type: file.type, size: file.bytes.length }).ok || !matchesAttachmentSignature(file.bytes, file.type)) throw new AttachmentStorageError("UPLOAD_FAILED", "File non valido.");
    const contentHash = await sha256(file.bytes);
    const grantHash = await sha256(privateToken());
    const reservation = await backendRpc<UploadReservation>("reserve_attachment", {
      p_project: context.projectId, p_owner: context.ownerHash, p_content: contentHash,
      p_name: file.name.slice(-120), p_mime: file.type, p_size: file.bytes.length, p_grant: grantHash,
    });
    if (reservation.state === "full") throw new AttachmentStorageError("TOO_MANY_ATTACHMENTS", "Massimo 8 allegati per progetto.");
    if (reservation.state === "busy") throw new AttachmentStorageError("UPLOAD_FAILED", "Caricamento già in corso. Riprova tra poco.");
    const stored = { name: reservation.name, storagePath: reservation.storage_path, mimeType: reservation.mime_type, size: reservation.size };
    if (reservation.state === "complete") return stored;
    const consumed = await backendRpc<boolean>("consume_attachment_grant", { p_id: reservation.id, p_owner: context.ownerHash, p_grant: grantHash });
    if (!consumed) throw new AttachmentStorageError("UPLOAD_FAILED", "Autorizzazione scaduta o già utilizzata. Riprova.");
    const storagePath = reservation.storage_path;
    let definitiveRejection = false;
    try {
    const response = await fetch(
      `${this.url}/storage/v1/object/${ATTACHMENT_BUCKET}/${storagePath}`,
      {
        method: "POST",
        headers: this.headers({ "Content-Type": file.type, "x-upsert": "false" }),
        body: new Blob([file.bytes as unknown as BlobPart]),
        signal: AbortSignal.timeout(20_000),
      },
    );
    definitiveRejection = response.status >= 400 && response.status < 500 && ![408,409,429].includes(response.status);
    if (response.status === 409 || response.status === 400) {
      // An interrupted POST may already have succeeded. Verify its bytes before recovery.
      const recovered = await fetch(`${this.url}/storage/v1/object/authenticated/${ATTACHMENT_BUCKET}/${storagePath}`, { headers: this.headers(), signal: AbortSignal.timeout(20_000) });
      if (!recovered.ok || await sha256(new Uint8Array(await recovered.arrayBuffer())) !== contentHash) throw new Error("File archiviato non coerente.");
    } else if (!response.ok) {
      throw new AttachmentStorageError(
        "UPLOAD_FAILED",
        "Caricamento non riuscito. Riprova tra poco.",
      );
    }
    const completed = await backendRequest<Array<{ id: string }>>(`/rest/v1/attachment_uploads?id=eq.${reservation.id}&grant_hash=eq.${grantHash}&state=eq.uploading`, {
      method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ state: "complete", lease_until: null }),
    });
    if (!completed.length) throw new Error("Caricamento da verificare. Riprova.");
    return stored;
    } catch (error) {
      // Never delete a possibly successful object on a network timeout. Retry uses the same path.
      await backendRequest(`/rest/v1/attachment_uploads?id=eq.${reservation.id}&grant_hash=eq.${grantHash}&state=eq.uploading`, { method: "PATCH", body: JSON.stringify({ state: "failed", lease_until: null }) }).catch(() => undefined);
      if (definitiveRejection) {
        // Only a completed rejection plus authoritative NoSuchKey proves that release is safe.
        try {
          const info = await fetch(`${this.url}/storage/v1/object/info/${ATTACHMENT_BUCKET}/${storagePath}`, { headers: this.headers(), signal: AbortSignal.timeout(10_000) });
          const missing = await info.json() as { code?: string; statusCode?: string };
          if (!info.ok && missing.code === "NoSuchKey" && missing.statusCode === "404") await backendRpc("release_failed_attachment", { p_id: reservation.id, p_owner: context.ownerHash, p_grant: grantHash });
        } catch { /* uncertain failures retain the reservation for safe recovery */ }
      }
      throw error;
    }
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
  if (url) assertPoolShaperTarget(url);
  if (url && serviceRoleKey) return new SupabaseAttachmentStore(url, serviceRoleKey);
  return unavailableStore;
}
