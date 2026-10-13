import { getCookie, setCookie, getRequest } from "@tanstack/react-start/server";
import { backendRpc, privateToken, sha256 } from "../backend-db.server";

function cookieName(projectId: string): string {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(projectId)) throw new Error("Progetto non valido.");
  return `pw-upload-${projectId}`;
}

/** An opaque HttpOnly owner capability; short upload grants never leave the server. */
export async function attachmentOwner(projectId: string, recovery?: { publicRef: string; editToken: string }): Promise<string> {
  const name = cookieName(projectId);
  const existing = getCookie(name);
  const token = existing && /^[0-9a-f]{64}$/.test(existing) ? existing : privateToken();
  const ownerHash = await sha256(token);
  const allowed = await backendRpc<boolean>("claim_attachment_owner", {
    p_project: projectId, p_hash: ownerHash,
    p_ref: recovery?.publicRef ?? null,
    p_edit_hash: recovery ? await sha256(recovery.editToken) : null,
  });
  if (!allowed) throw new Error("Non sei autorizzato a caricare allegati per questo progetto.");
  if (token !== existing) setCookie(name, token, {
    httpOnly: true, sameSite: "strict", secure: new URL(getRequest().url).protocol === "https:",
    path: "/", maxAge: 30 * 24 * 60 * 60,
  });
  return ownerHash;
}

export async function currentAttachmentOwner(projectId: string): Promise<string> {
  const token = getCookie(cookieName(projectId));
  if (!token || !/^[0-9a-f]{64}$/.test(token)) throw new Error("Autorizzazione allegati mancante.");
  return sha256(token);
}
