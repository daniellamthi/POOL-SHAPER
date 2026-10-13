import { assertPoolShaperTarget } from "./supabase-target.server";

export function backendCredentials() {
  const url = process.env["SUPABASE_URL"]?.trim() ?? "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  assertPoolShaperTarget(url);
  if (!key) throw new Error("Archivio non disponibile.");
  return { url, key };
}

/** Server-only REST; errors never include provider bodies or credentials. */
export async function backendRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { url, key } = backendCredentials();
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...options.headers },
    signal: options.signal ?? AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Archivio non disponibile (${response.status}).`);
  const body = await response.text();
  return body ? JSON.parse(body) as T : null as T;
}

export const backendRpc = <T>(name: string, body: object): Promise<T> =>
  backendRequest<T>(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(body) });

export async function sha256(value: string | Uint8Array): Promise<string> {
  const data = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function privateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
}
