import { Suspense } from "react";
import { PageShell } from "@/components/PageShell";
import { LoginForm } from "@/components/LoginForm";
import { isSupabaseAuthReachable } from "@/lib/supabase/health";

export default async function LoginPage() {
  const googleAvailable = await isSupabaseAuthReachable();

  return (
    <PageShell width="narrow">
      <div className="mx-auto w-full max-w-md py-4 sm:py-8">
        <h1 className="text-2xl font-bold text-foreground">Sign in to Importnest</h1>
        <p className="mt-1 text-sm text-muted">
          Save products, set price alerts on Total Known Cost, and pick up where you left off.
        </p>
        <Suspense fallback={<p className="mt-8 text-sm text-muted">Loading…</p>}>
          <LoginForm googleAvailable={googleAvailable} />
        </Suspense>
      </div>
    </PageShell>
  );
}
