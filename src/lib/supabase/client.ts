import { createBrowserClient } from "@supabase/ssr";

function getSupabaseKey() {
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  // Never use a secret key in the browser (sb_secret_… / service_role).
  if (publishable && !publishable.startsWith("sb_secret_")) return publishable;
  if (anon && !anon.startsWith("sb_secret_") && !anon.includes("service_role")) return anon;
  return undefined;
}

/** True when URL + a public key are present (does not prove the project still exists). */
export function isSupabaseBrowserConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = getSupabaseKey();
  if (!url || !key) return false;
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".supabase.co") || host.endsWith(".supabase.in");
  } catch {
    return false;
  }
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = getSupabaseKey();
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return createBrowserClient(url, key);
}
