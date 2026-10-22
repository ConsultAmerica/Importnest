"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isPublicApprovedSource, retailerTrustFor } from "@/lib/approved-sources";
import { sourceImageFor } from "@/lib/images";

export type ApprovedSourceItem = {
  id: string;
  name: string;
};

const SCROLL_STEP_PX = 320;

/**
 * Compact trust strip under the homepage hero.
 * One horizontal row: drag, swipe, or use the arrows to move through retailers.
 */
export function ApprovedSourcesStrip({ sources }: { sources: ApprovedSourceItem[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeHint, setActiveHint] = useState<string | null>(null);

  const visible = sources
    .filter((s) => isPublicApprovedSource(s.id))
    .map((s) => ({ ...s, trust: retailerTrustFor(s.id, s.name) }));

  const updateArrowState = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    updateArrowState();
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => updateArrowState();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [visible.length]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || visible.length < 2) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!paused && !dragging) {
        el.scrollLeft += dt * 0.04;
        const loop = el.scrollWidth / 2;
        if (loop > 0 && el.scrollLeft >= loop) el.scrollLeft -= loop;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragging, paused, visible.length]);

  function scrollBy(direction: -1 | 1) {
    trackRef.current?.scrollBy({ left: direction * SCROLL_STEP_PX, behavior: "smooth" });
  }

  function onPointerDown(event: React.PointerEvent<HTMLUListElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const el = event.currentTarget;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
    el.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLUListElement>) {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 3) drag.moved = true;
    event.currentTarget.scrollLeft = drag.scrollLeft - delta;
  }

  function endDrag(event: React.PointerEvent<HTMLUListElement>) {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.pointerId = -1;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onTrackKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollBy(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollBy(-1);
    }
  }

  if (visible.length === 0) return null;

  const count = visible.length;

  return (
    <section className="approved-sources-strip mt-6" aria-labelledby="approved-sources-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="approved-sources-heading"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-navy-900 sm:text-xl"
          >
            <span
              aria-hidden
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-savings/25 text-navy-900"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                <path
                  d="M3.2 8.2 6.3 11.2 12.8 4.6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Approved retailers
          </h2>
          <p className="mt-1 text-sm text-muted">
            {count} verified {count === 1 ? "source" : "sources"} behind every Total Known Cost
          </p>
        </div>
        <Link href="/how-to-use" className="text-sm font-semibold text-link hover:underline">
          How ranking works
        </Link>
      </div>

      <div
        className="retailer-carousel"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <button
          type="button"
          className="retailer-arrow left"
          onClick={() => scrollBy(-1)}
          disabled={!canScrollLeft && visible.length < 2}
          aria-label="Scroll approved retailers left"
        >
          ‹
        </button>
        <ul
          ref={trackRef}
          className={dragging ? "retailer-track is-dragging" : "retailer-track"}
          aria-label="Approved retailer sources. Drag or use arrow keys to browse."
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onTrackKeyDown}
        >
          {[...visible, ...visible].map((source, index) => (
            <li
              key={`${source.id}-${index}`}
              className="retailer-card"
              aria-hidden={index >= visible.length ? true : undefined}
            >
              <div
                className="flex h-full items-center gap-3 rounded-2xl border border-border bg-panel px-3 py-2.5 shadow-[0_1px_0_rgb(11_39_72/0.04)] transition hover:border-accent hover:shadow-[var(--shadow-panel-hover)]"
                title={source.trust.trustHint}
                onMouseEnter={() => setActiveHint(source.trust.trustHint)}
                onMouseLeave={() => setActiveHint(null)}
                onFocus={() => setActiveHint(source.trust.trustHint)}
                onBlur={() => setActiveHint(null)}
              >
                <span className="retailer-icon">
                  <Image
                    src={sourceImageFor(source.id)}
                    alt=""
                    width={48}
                    height={48}
                    className="h-9 w-9 object-contain"
                  />
                </span>
                <span className="min-w-0">
                  <span
                    tabIndex={0}
                    className="block truncate text-sm font-semibold text-foreground outline-none"
                  >
                    {source.trust.label}
                  </span>
                  <span className="mt-1 inline-flex max-w-full truncate rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy-800">
                    {source.trust.badge}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="retailer-arrow right"
          onClick={() => scrollBy(1)}
          disabled={!canScrollRight && visible.length < 2}
          aria-label="Scroll approved retailers right"
        >
          ›
        </button>
      </div>

      <p className="mt-2 min-h-8 text-xs leading-snug text-muted" aria-live="polite">
        {activeHint ?? "Hover a retailer to see why it is approved."}
      </p>

      <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <li>Sponsored results labeled separately</li>
        <li>Prices checked regularly</li>
        <li>No hidden ranking influence</li>
      </ul>
    </section>
  );
}
