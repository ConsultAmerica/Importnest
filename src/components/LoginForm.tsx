"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/safe-redirect";

function isAuthOffline(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /fetch|network|enotfound|failed to fetch|authretryable|timeout/i.test(message);
}

type Mode = "sign-in" | "sign-up";

export function LoginForm({ googleAvailable = true }: { googleAvailable?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const oauthError = searchParams.get("error") === "oauth";
  // Env vars alone aren't enough — the server probes that the Supabase host is alive.
  const supabaseReady = isSupabaseBrowserConfigured() && googleAvailable;

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    oauthError ? "Google sign-in was cancelled or failed. Try again, or use email." : null,
  );
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  async function onGoogleSignIn() {
    setError(null);
    setInfo(null);
    if (!supabaseReady) {
      setError("Google sign-in isn’t configured. Use email instead.");
      return;
    }
    setOauthLoading(true);
    const timeout = window.setTimeout(() => {
      setOauthLoading(false);
      setError("Google sign-in is unavailable right now. Use email instead.");
    }, 8000);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      window.clearTimeout(timeout);
      if (oauthErr) {
        setError(
          isAuthOffline(oauthErr)
            ? "Google sign-in is unavailable right now. Use email instead."
            : oauthErr.message,
        );
        setOauthLoading(false);
      }
    } catch (err) {
      window.clearTimeout(timeout);
      setError(
        isAuthOffline(err)
          ? "Google sign-in is unavailable right now. Use email instead."
          : err instanceof Error
            ? err.message
            : "Google sign-in failed",
      );
      setOauthLoading(false);
    }
  }

  /** Local email/password via Neon — works when Supabase is offline or misconfigured. */
  async function signInWithEmail() {
    const response = await fetch("/api/auth/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, mode }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      if (response.status === 409 && mode === "sign-up") {
        // Account already exists — keep the typed email and flip to sign-in.
        setMode("sign-in");
        setPassword("");
      }
      setError(
        body?.error ??
          (response.status >= 500
            ? "Sign-in is temporarily unavailable. Please try again in a moment."
            : mode === "sign-up"
              ? "Couldn’t create account."
              : "Sign-in failed"),
      );
      return false;
    }
    router.replace(nextPath);
    router.refresh();
    return true;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      // Email/password always uses the local API. Browser Supabase signUp was
      // throwing TypeError: Failed to fetch when NEXT_PUBLIC_SUPABASE_URL is dead.
      await signInWithEmail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-border bg-panel p-6 shadow-sm">
      {supabaseReady ? (
        <>
          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={oauthLoading || loading || !supabaseReady}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-accent hover:bg-surface disabled:opacity-60"
          >
            <GoogleGlyph />
            {oauthLoading ? "Redirecting to Google…" : "Continue with Google"}
          </button>

          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            <span>or use email</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex gap-1 rounded-full bg-surface p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => {
              setMode("sign-in");
              setError(null);
              setInfo(null);
            }}
            aria-pressed={mode === "sign-in"}
            className={`flex-1 rounded-full px-3 py-1.5 font-semibold transition ${
              mode === "sign-in" ? "bg-cta text-navy-900" : "text-muted hover:text-foreground"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("sign-up");
              setError(null);
              setInfo(null);
            }}
            aria-pressed={mode === "sign-up"}
            className={`flex-1 rounded-full px-3 py-1.5 font-semibold transition ${
              mode === "sign-up" ? "bg-cta text-navy-900" : "text-muted hover:text-foreground"
            }`}
          >
            Create account
          </button>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative mt-1">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              required
              minLength={6}
              aria-describedby={mode === "sign-up" ? "password-hint" : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-white py-2.5 pl-3 pr-16 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/40"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              aria-controls="password"
              className="absolute inset-y-1 right-1 rounded-lg px-2.5 text-xs font-semibold text-link hover:bg-surface"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {mode === "sign-up" ? (
            <p id="password-hint" className="mt-1 text-xs text-muted">
              At least 6 characters.
            </p>
          ) : null}
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-cta w-full px-4 py-2.5 text-sm disabled:opacity-60"
        >
          {loading
            ? mode === "sign-up"
              ? "Creating account…"
              : "Signing in…"
            : mode === "sign-up"
              ? "Create account"
              : "Sign in"}
        </button>

        <p className="text-center text-xs text-muted">
          <Link href="/" className="font-medium text-link hover:underline">
            Back to home
          </Link>
        </p>
      </form>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7 12.9 19.6C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l.0.0 6.2 5.2C39.2 36.3 44 31.4 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
