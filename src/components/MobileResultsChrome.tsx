"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { ResultsPageParams } from "@/components/SearchResultsLayout";
import { RESULTS_SORT_OPTIONS, type ResultsSort } from "@/lib/search-results";

/** Pixels a sheet must be dragged down before releasing closes it. */
const SWIPE_CLOSE_PX = 90;

/**
 * Drag-down-to-dismiss for a bottom sheet. Attach the handlers to the grab
 * handle / header only, so scrolling the sheet body still scrolls content.
 */
function useSwipeToClose(onClose: () => void) {
  const [offset, setOffset] = useState(0);
  const startY = useRef<number | null>(null);
  const handlers = {
    onTouchStart(e: TouchEvent) {
      startY.current = e.touches[0]?.clientY ?? null;
    },
    onTouchMove(e: TouchEvent) {
      if (startY.current == null) return;
      setOffset(Math.max(0, (e.touches[0]?.clientY ?? 0) - startY.current));
    },
    onTouchEnd() {
      if (offset > SWIPE_CLOSE_PX) onClose();
      setOffset(0);
      startY.current = null;
    },
  };
  return { offset, handlers };
}

/** Clears narrowing filters but keeps where the shopper is (search text + department). */
function resetFiltersHref(params: ResultsPageParams): string {
  const keep = new URLSearchParams();
  if (params.q) keep.set("q", params.q);
  if (params.category) keep.set("category", params.category);
  const qs = keep.toString();
  return qs ? `/search/results?${qs}` : "/search/results";
}

/**
 * Mobile sticky Filter + Sort bar. Filters and Sort open as bottom sheets with a
 * frosted backdrop, a grab handle (swipe down to dismiss), and sticky actions.
 */
export function MobileResultsChrome({
  children,
  activeCount = 0,
  activeLabels = [],
  resultCount,
  params,
  sort,
}: {
  children: ReactNode;
  activeCount?: number;
  activeLabels?: string[];
  resultCount: number;
  params: ResultsPageParams;
  sort: ResultsSort;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const sortPanelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const closeSort = useCallback(() => setSortOpen(false), []);
  const filterSwipe = useSwipeToClose(closeFilters);
  const sortSwipe = useSwipeToClose(closeSort);
  const [barHidden, setBarHidden] = useState(false);

  // Slide the bar away while scrolling down through products; bring it back on
  // any upward scroll, near the top, or at the bottom of the page.
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 80;
        if (y < 120 || nearBottom || y < lastY - 6) setBarHidden(false);
        else if (y > lastY + 6) setBarHidden(true);
        lastY = y;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useFocusTrap(filtersOpen, panelRef, closeFilters);
  useFocusTrap(sortOpen, sortPanelRef, closeSort);

  useEffect(() => {
    if (!filtersOpen && !sortOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filtersOpen, sortOpen]);

  function onSort(value: string) {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== "sort") next.set(k, v);
    }
    next.set("sort", value);
    setSortOpen(false);
    router.push(`/search/results?${next.toString()}`);
  }

  return (
    <div className="lg:hidden">
      <div
        className={barHidden ? "mobile-results-bar is-hidden" : "mobile-results-bar"}
        onFocusCapture={() => setBarHidden(false)}
      >
        {activeLabels.length > 0 ? (
          <p className="mobile-results-bar-labels" title={activeLabels.join(" · ")}>
            {activeLabels.join(" · ")}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="mobile-results-bar-btn"
          aria-label={
            activeLabels.length > 0
              ? `Filters (${activeCount}): ${activeLabels.join(", ")}`
              : "Filters"
          }
          title={activeLabels.length > 0 ? activeLabels.join(" · ") : undefined}
        >
          Filters
          {activeCount > 0 ? (
            <span className="ml-1 rounded-full bg-navy-900 px-1.5 py-0.5 text-[10px] text-white">
              {activeCount}
            </span>
          ) : null}
        </button>
        <button type="button" onClick={() => setSortOpen(true)} className="mobile-results-bar-btn">
          Sort
        </button>
      </div>

      {filtersOpen ? (
        <div className="results-sheet-root">
          <button
            type="button"
            className="results-sheet-backdrop"
            aria-label="Close filters"
            tabIndex={-1}
            onClick={closeFilters}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="results-sheet results-sheet-tall"
            style={filterSwipe.offset ? { transform: `translateY(${filterSwipe.offset}px)`, transition: "none" } : undefined}
          >
            <div className="results-sheet-header" {...filterSwipe.handlers}>
              <span className="results-sheet-handle" aria-hidden="true" />
              <div className="flex items-center justify-between gap-3">
                <h2 id={titleId} className="text-base font-bold text-navy-900">
                  Filters
                  {activeCount > 0 ? (
                    <span className="ml-2 text-xs font-semibold text-muted">{activeCount} active</span>
                  ) : null}
                </h2>
                <div className="flex items-center gap-1">
                  {activeCount > 0 ? (
                    <a href={resetFiltersHref(params)} className="results-sheet-reset">
                      Reset
                    </a>
                  ) : null}
                  <button type="button" onClick={closeFilters} className="results-sheet-close" aria-label="Close filters">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="results-sheet-body">{children}</div>
          </div>
        </div>
      ) : null}

      {sortOpen ? (
        <div className="results-sheet-root">
          <button
            type="button"
            className="results-sheet-backdrop"
            aria-label="Close sort"
            tabIndex={-1}
            onClick={closeSort}
          />
          <div
            ref={sortPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Sort by"
            className="results-sheet"
            style={sortSwipe.offset ? { transform: `translateY(${sortSwipe.offset}px)`, transition: "none" } : undefined}
          >
            <div className="results-sheet-header" {...sortSwipe.handlers}>
              <span className="results-sheet-handle" aria-hidden="true" />
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-bold text-navy-900">Sort by</p>
                <button type="button" onClick={closeSort} className="results-sheet-close" aria-label="Close sort">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </div>
            <ul className="results-sheet-body space-y-1">
              {RESULTS_SORT_OPTIONS.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => onSort(o.value)}
                    aria-pressed={sort === o.value}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold ${
                      sort === o.value ? "bg-accent/15 text-navy-900" : "text-navy-900 hover:bg-surface"
                    }`}
                  >
                    {o.label}
                    {sort === o.value ? <span aria-hidden="true">✓</span> : null}
                  </button>
                </li>
              ))}
            </ul>
            <p className="px-4 pb-4 text-center text-xs text-muted">
              {resultCount} result{resultCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
