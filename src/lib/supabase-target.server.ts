/** Server-only destination lock. Never read credentials from VITE_* variables. */
export const POOL_SHAPER_SUPABASE_URL = "https://waetxxqdlsuanqescuye.supabase.co";

export function assertPoolShaperTarget(url: string): void {
  if (url !== POOL_SHAPER_SUPABASE_URL) {
    throw new Error("Supabase destination rejected: POOL-SHAPER project required.");
  }
}
