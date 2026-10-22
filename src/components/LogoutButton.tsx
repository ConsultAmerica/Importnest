"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton({ variant = "default" }: { variant?: "default" | "compact" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Hosted auth can be offline; the local session still needs to clear.
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
    setLoading(false);
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onLogout}
        disabled={loading}
        className="rounded-xl px-2.5 py-1.5 text-left text-sm font-semibold text-navy-900 transition hover:bg-navy-100 disabled:opacity-60 sm:px-3"
      >
        {loading ? "Signing out…" : "Sign out"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className="rounded-full border border-border bg-panel px-4 py-2 text-sm font-medium text-gray-700 hover:border-navy-800 disabled:opacity-60"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
