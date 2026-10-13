/**
 * Project references and owner tokens (Build 2 · project delivery).
 *
 * `PW-XXXX-XXXXXX` is the customer/sales-facing project ID: Crockford base32
 * (no I, L, O, U -- unambiguous when read aloud or retyped from a PDF), 10
 * random symbols = 50 bits. It is unguessable and never sequential, so it can
 * be printed and shared; it grants read access only.
 *
 * The edit token is a separate 256-bit secret, handed once to the browser
 * that created the project. The database keeps only its SHA-256.
 */

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const PUBLIC_REF_PATTERN = /^PW-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{6}$/;
export const EDIT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function createPublicRef(): string {
  // 10 symbols x 5 bits; one byte per symbol keeps the mapping uniform (256 % 32 === 0).
  const symbols = Array.from(randomBytes(10), (byte) => CROCKFORD[byte % 32]).join("");
  return `PW-${symbols.slice(0, 4)}-${symbols.slice(4)}`;
}

export function isPublicRef(value: unknown): value is string {
  return typeof value === "string" && PUBLIC_REF_PATTERN.test(value);
}

export function createEditToken(): string {
  let binary = "";
  for (const byte of randomBytes(32)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isEditToken(value: unknown): value is string {
  return typeof value === "string" && EDIT_TOKEN_PATTERN.test(value);
}

export async function hashEditToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Share link for a saved project: only the public reference, never a token. */
export function projectShareUrl(origin: string, publicRef: string): string {
  return `${origin.replace(/\/+$/, "")}/?p=${encodeURIComponent(publicRef)}`;
}
