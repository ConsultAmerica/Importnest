import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { LOCAL_SESSION_COOKIE, readSession } from "@/lib/local-auth";

export type SessionUser = { id: string; email?: string | null };

/** Cheap session lookup — no DB write. Safe to call on every page render (e.g. Header). */
export async function getAuthUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return user;
  } catch (err) {
    // Next.js uses this throw to opt the route into dynamic rendering — must not swallow it.
    if (
      err instanceof Error &&
      (err.message.includes("Dynamic server usage") ||
        ("digest" in err && err.digest === "DYNAMIC_SERVER_USAGE"))
    ) {
      throw err;
    }
    // Auth outage / missing env must not take down layout shells (Header, home, etc.).
    console.error("[auth] getAuthUser failed", err);
  }

  try {
    const jar = await cookies();
    const local = readSession(jar.get(LOCAL_SESSION_COOKIE)?.value);
    return local ? { id: local.id, email: local.email } : null;
  } catch (err) {
    console.error("[auth] local session unreadable", err);
    return null;
  }
}

/** Cheap read-only admin check — no upsert/write, safe to call on every admin-route request. */
export async function isAppUserAdmin(userId: string): Promise<boolean> {
  const appUser = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  return appUser?.isAdmin ?? false;
}

/**
 * Supabase's own user id is used directly as AppUser.id (no separate link
 * table) — it's already a stable, globally unique identifier, so a shopper's
 * saved products/alerts survive across sessions/devices under one row.
 * Upserts on every call, so only use where a DB write per request is
 * acceptable (saving/reading the watchlist), not on every page load.
 */
export async function getOrCreateAppUser() {
  const user = await getAuthUser();
  if (!user) return null;

  try {
    return await prisma.appUser.upsert({
      where: { id: user.id },
      update: { email: user.email ?? undefined },
      create: {
        id: user.id,
        email: user.email ?? undefined,
        authProvider: "supabase",
      },
    });
  } catch (err) {
    console.error("[auth] getOrCreateAppUser failed", err);
    return null;
  }
}
