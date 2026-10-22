"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AskAiNavButton } from "@/components/AskAiAgent";
import { intentPillsFromQuery } from "@/lib/search-pills";
import { HEADER_PROMPT_PILLS } from "@/lib/search-prompts";

function SparkleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
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

/**
 * Header search — preserves active `q` from the URL so shoppers can edit in place.
 * Ask AI sits beside Search as a companion CTA (not buried in the icon strip).
 */
export function HeaderSearch() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQ);
  const pills = useMemo(() => intentPillsFromQuery(query), [query]);

  useEffect(() => {
    setQuery(urlQ);
  }, [urlQ, pathname]);

  return (
    <div className="header-search">
      <div className="header-search-row">
        <form action="/search" className="search-shell search-shell-ai">
          <label htmlFor="header-q" className="sr-only">
            Search Importnest with natural language
          </label>
          <span className="search-ai-icon" aria-hidden="true">
            <SparkleIcon />
          </span>
          <input
            id="header-q"
            name="q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or describe what you need…"
            className="search-input"
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn-cta m-1.5 h-9 min-w-[5.25rem] shrink-0 px-5 text-sm leading-none sm:h-10 sm:min-w-[5.75rem] sm:px-6"
          >
            Search
          </button>
        </form>
        <AskAiNavButton />
      </div>
      {pills.length > 0 ? (
        <ul className="search-intent-pills" aria-label="Detected filters">
          {pills.map((pill) => (
            <li key={pill.id}>
              <Link className="search-intent-pill" href={pill.href}>
                {pill.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="search-intent-pills" aria-label="Example searches">
          {HEADER_PROMPT_PILLS.map((pill) => (
            <li key={pill.query}>
              <Link
                className="search-intent-pill"
                href={`/search/results?q=${encodeURIComponent(pill.query)}`}
              >
                {pill.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
