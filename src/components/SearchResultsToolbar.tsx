"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CategoryVisualCard } from "@/components/CategoryVisualCard";
import type { ResultsPageParams } from "@/components/SearchResultsLayout";
import { categoryDisplayTitle, normalizeCategorySlug } from "@/lib/category-visuals";
import { prefsChips } from "@/lib/result-filter-labels";
import { RESULTS_SORT_OPTIONS, type ResultsSort } from "@/lib/search-results";

/** Keep only browse context (q / category / view / sort) — drop applied facets. */
function clearFiltersHref(params: ResultsPageParams) {
  const next = new URLSearchParams();
  if (params.q) next.set("q", params.q);
  if (params.category) next.set("category", params.category);
  if (params.view) next.set("view", params.view);
  if (params.sort) next.set("sort", params.sort);
  const qs = next.toString();
  return qs ? `/search/results?${qs}` : "/search/results";
}

function filterChipCount(params: ResultsPageParams) {
  return prefsChips(params).filter((c) => c.clearKey !== "q" && c.clearKey !== "category").length;
}

function paramsToSearch(params: ResultsPageParams, omit?: string) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== omit) next.set(k, v);
  }
  return next;
}

export function SearchResultsToolbar({
  params,
  total,
  sort,
  hideCategoryVisual = false,
  browsingIdeas = false,
}: {
  params: ResultsPageParams;
  total: number;
  sort: ResultsSort;
  hideCategoryVisual?: boolean;
  /** Category browse has demo tiles even though no live listing matched. */
  browsingIdeas?: boolean;
}) {
  const router = useRouter();
  const chips = prefsChips(params);
  const categorySlug = normalizeCategorySlug(params.category);
  const categoryTitle = categorySlug ? categoryDisplayTitle(categorySlug) : null;
  const view = params.view === "list" ? "list" : "grid";
  const queryLabel = params.q?.trim() || null;

  function hrefWithout(key: string) {
    const next = paramsToSearch(params, key);
    if (key === "vehicleYear") {
      next.delete("vehicleMake");
      next.delete("vehicleModel");
    }
    return `/search/results?${next.toString()}`;
  }

  function hrefWith(updates: Partial<ResultsPageParams>) {
    const next = paramsToSearch(params);
    for (const [k, v] of Object.entries(updates)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    return `/search/results?${next.toString()}`;
  }

  function onSortChange(value: string) {
    const next = paramsToSearch(params, "sort");
    next.set("sort", value);
    router.push(`/search/results?${next.toString()}`);
  }

  const sparseCategoryBrowse =
    !queryLabel && Boolean(categoryTitle) && total > 0 && total < 3 && !browsingIdeas;
  const showingLabel = browsingIdeas && total === 0
    ? queryLabel
      ? `Browse ideas for “${queryLabel}”`
      : categoryTitle
        ? `Browse ideas in ${categoryTitle}`
        : "Browse ideas"
    : sparseCategoryBrowse
      ? total === 1
        ? `Only 1 live offer in ${categoryTitle} — `
        : `Only ${total} live offers in ${categoryTitle} — `
    : queryLabel
      ? `Showing ${total} result${total === 1 ? "" : "s"} for “${queryLabel}”`
      : categoryTitle
        ? `Showing ${total} result${total === 1 ? "" : "s"} for ${categoryTitle}`
        : `Showing ${total} result${total === 1 ? "" : "s"}`;
  const facetChipCount = filterChipCount(params);
  const trail = [categoryTitle, queryLabel].filter(Boolean).join(" › ");

  return (
    <div className="space-y-3">
      {categorySlug && !hideCategoryVisual ? (
        <CategoryVisualCard category={categorySlug} query={params.q} compact />
      ) : null}

      {trail ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{trail}</p>
      ) : null}

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <ul className="flex flex-wrap gap-2" aria-label="Active filters">
            {chips.map((c) => (
              <li key={c.clearKey + c.label}>
                <Link
                  href={hrefWithout(c.clearKey)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-navy-800 hover:border-navy-800"
                  aria-label={`Remove ${c.label}`}
                >
                  {c.label}
                  <span aria-hidden="true" className="text-muted">
                    ✕
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {facetChipCount > 0 ? (
            <Link
              href={clearFiltersHref(params)}
              className="text-xs font-bold text-link hover:underline"
            >
              Clear all
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="results-toolbar-bar results-toolbar-sticky">
        <p className="min-w-0 text-sm font-semibold text-navy-900" aria-live="polite">
          {showingLabel}
          {sparseCategoryBrowse ? (
            // One tap back up to the type carousel instead of hunting for it.
            <a href="#browse-types" className="text-link underline-offset-2 hover:underline">
              browse popular types ↑
            </a>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="results-view-switch" role="group" aria-label="Result layout">
            <Link
              href={hrefWith({ view: "grid" })}
              aria-current={view === "grid" ? "page" : undefined}
              className={`results-view-btn ${view === "grid" ? "is-active" : ""}`}
              title="Grid view"
            >
              <span className="sr-only">Grid view</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </Link>
            <Link
              href={hrefWith({ view: "list" })}
              aria-current={view === "list" ? "page" : undefined}
              className={`results-view-btn ${view === "list" ? "is-active" : ""}`}
              title="List view"
            >
              <span className="sr-only">List view</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="3" y="4" width="18" height="3" rx="1" />
                <rect x="3" y="10.5" width="18" height="3" rx="1" />
                <rect x="3" y="17" width="18" height="3" rx="1" />
              </svg>
            </Link>
          </div>
          <label htmlFor="results-sort" className="sr-only">
            Sort results
          </label>
          <select
            id="results-sort"
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            className="rounded-full border border-border bg-white px-3 py-2 text-sm font-semibold text-navy-900 outline-none focus:border-navy-800 focus:ring-2 focus:ring-navy-900/20"
          >
            {RESULTS_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
