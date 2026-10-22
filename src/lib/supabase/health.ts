const CACHE_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 2500;

let cached: { ok: boolean; at: number } | null = null;

/**
 * Env vars being present doesn't mean the Supabase project still exists — a
 * deleted project's host stops resolving, and "Continue with Google" would
 * then navigate shoppers to a dead domain. Probe the auth health endpoint
 * (cached) so the login page can offer email-only sign-in instead.
 */
export async function isSupabaseAuthReachable(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return false;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.ok;

  let ok = false;
  try {
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      "";
    const res = await fetch(new URL("/auth/v1/health", url), {
      headers: key ? { apikey: key } : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    // Any HTTP answer means the host is alive; only network failures count as down.
    ok = res.status < 500;
  } catch {
    ok = false;
  }
  cached = { ok, at: Date.now() };
  return ok;
}
