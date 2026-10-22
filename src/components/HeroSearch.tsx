"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ASK_AI_OPEN_EVENT } from "@/components/AskAiAgent";
import { EXAMPLE_SEARCHES, HERO_QUICK_FILTERS } from "@/lib/search-prompts";
import { intentPillsFromQuery } from "@/lib/search-pills";

function SparkleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2.5l1.4 5.2L18.5 9 13.4 10.3 12 15.5l-1.4-5.2L5.5 9l5.1-1.3L12 2.5z" />
      <path d="M18.5 14.5l.7 2.5 2.5.7-2.5.7-.7 2.5-.7-2.5-2.5-.7 2.5-.7.7-2.5z" opacity=".85" />
    </svg>
  );
}

export function HeroSearch({
  className = "",
  maxExamples,
  showQuickFilters = false,
  variant = "default",
}: {
  className?: string;
  /** Caps the "Try this" example chips — omit to show all. */
  maxExamples?: number;
  /** Show the real-filter quick chips (Under $100, Free shipping, etc.). */
  showQuickFilters?: boolean;
  /** "hero" = homepage top band: larger field, inline chip rows, Ask AI entry point. */
  variant?: "default" | "hero";
}) {
  const hero = variant === "hero";
  const [query, setQuery] = useState("");
  const pills = useMemo(() => intentPillsFromQuery(query), [query]);
  const examples = EXAMPLE_SEARCHES.slice(0, maxExamples ?? EXAMPLE_SEARCHES.length).map((e) => ({
    label: e.label,
    href: `/search?q=${encodeURIComponent(e.query)}`,
  }));

  return (
    <div className={`relative ${className || "mt-5"}`}>
      {hero ? null : (
        <div className="ai-search-banner ai-search-banner-hero">
          <SparkleIcon className="ai-search-banner-icon" />
          <span>
            AI-friendly search — describe what you need in plain English, not just model numbers.
          </span>
        </div>
      )}

      <form
        action="/search"
        className={`flex items-center overflow-hidden rounded-full border border-border bg-white shadow-[0_6px_18px_rgb(16_35_63/0.08)] focus-within:ring-2 focus-within:ring-ring ${
          hero ? "hero-search-form" : ""
        }`}
      >
        <label htmlFor="home-q" className="sr-only">
          What are you shopping for?
        </label>
        <span className="pl-4 text-accent" aria-hidden="true">
          <SparkleIcon />
        </span>
        <input
          id="home-q"
          name="q"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            hero
              ? "What do you need?"
              : "Search by product, model, UPC — or describe what you need"
          }
          className={`min-w-0 flex-1 px-3 text-foreground outline-none placeholder:text-muted sm:px-4 ${
            hero ? "py-4 text-base" : "py-3.5 text-sm"
          }`}
          autoComplete="off"
        />
        <button
          type="submit"
          className={`btn-cta m-1.5 shrink-0 px-5 text-sm leading-none sm:px-6 ${
            hero ? "h-12 min-w-[6.5rem] sm:text-base" : "h-11 min-w-[5.25rem] sm:min-w-[5.75rem]"
          }`}
        >
          {hero ? "Compare" : "Compare offers"}
        </button>
      </form>

      {hero ? (
        <p className="hero-search-hint">
          <span className="hidden sm:inline">
            Describe it in plain English, e.g. “quiet air purifier for a bedroom under $250”.
          </span>
          <button
            type="button"
            className="hero-ask-ai"
            onClick={() => window.dispatchEvent(new Event(ASK_AI_OPEN_EVENT))}
          >
            <SparkleIcon className="h-4 w-4" />
            Not sure what to buy? Ask AI
          </button>
        </p>
      ) : null}

      {pills.length > 0 ? (
        <ul className="search-intent-pills mt-2" aria-label="Detected filters">
          {pills.map((pill) => (
            <li key={pill.id}>
              <span className="search-intent-pill">{pill.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {showQuickFilters ? (
        <div className={hero ? "hero-chip-row" : "mt-3"}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Quick filters</p>
          <div className={hero ? "hero-chip-list" : "mt-2 flex flex-wrap gap-2"}>
            {HERO_QUICK_FILTERS.map((qf) => (
              <Link
                key={qf.id}
                href={qf.href}
                className="rounded-full border border-accent/30 bg-accent/5 px-3 py-1.5 text-sm font-semibold text-navy-900 transition hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {qf.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className={hero ? "hero-chip-row" : "mt-3"}>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {hero ? "Popular" : "Try this"}
        </p>
        <div className={hero ? "hero-chip-list" : "mt-2 flex flex-wrap gap-2"}>
          {examples.map((pill) => (
            <Link
              key={pill.href + pill.label}
              href={pill.href}
              className="rounded-full border border-border bg-panel px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition hover:border-accent hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {pill.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
