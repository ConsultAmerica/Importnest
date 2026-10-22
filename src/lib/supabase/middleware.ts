import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAppUserAdmin } from "@/lib/auth";
import { LOCAL_SESSION_COOKIE, readSession } from "@/lib/local-auth";
import { safeNextPath } from "@/lib/safe-redirect";

function getSupabaseKey() {
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (publishable && !publishable.startsWith("sb_secret_")) return publishable;
  if (anon && !anon.startsWith("sb_secret_") && !anon.includes("service_role")) return anon;
  return undefined;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSupabaseKey();
  let user: { id: string; email?: string | null } | null = null;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    try {
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser();
      user = supabaseUser;
    } catch (err) {
      console.error("[auth] session lookup failed", err);
    }
  }

  if (!user) {
    const local = readSession(request.cookies.get(LOCAL_SESSION_COOKIE)?.value);
    if (local) user = { id: local.id, email: local.email };
  }

  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith("/admin");
  const isSavedRoute = pathname.startsWith("/saved");
  const isLoginRoute = pathname === "/login";

  if ((isAdminRoute || isSavedRoute) && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAdminRoute && user && !(await isAppUserAdmin(user.id))) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (isLoginRoute && user) {
    const nextPath = request.nextUrl.searchParams.get("next");
    const redirectUrl = request.nextUrl.clone();
    const target = new URL(safeNextPath(nextPath), request.nextUrl.origin);
    redirectUrl.pathname = target.pathname;
    redirectUrl.search = target.search;
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
