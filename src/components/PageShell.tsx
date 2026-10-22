import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export function PageShell({
  children,
  width = "default",
  hideHeaderSearch = false,
}: {
  children: ReactNode;
  width?: "default" | "narrow" | "wide" | "results";
  hideHeaderSearch?: boolean;
}) {
  const mainClass =
    width === "narrow"
      ? "mx-auto w-full min-w-0 max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
      : width === "results"
        ? "page-container page-container-results mx-auto w-full min-w-0 flex-1 py-6 sm:py-8"
        : "page-container mx-auto w-full min-w-0 flex-1 py-8";

  return (
    <div className="page-shell flex min-h-screen flex-col text-foreground">
      <Header hideSearch={hideHeaderSearch} />
      <main className={mainClass}>{children}</main>
      <Footer />
    </div>
  );
}
