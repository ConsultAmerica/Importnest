"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { categoryDisplayTitle, normalizeCategoryKey } from "@/lib/category-visuals";

export type CategoryImageMode = "lifestyle-cover" | "transparent-contain" | "photo-cover";

export type CategoryRoundCarouselItem = {
  label: string;
  /** Lowercase identifier compared against `activeSubtype`; "" means the reset/all tile. */
  slug: string;
  imageUrl: string;
  href: string;
  badge?: string;
  /**
   * How the image fills its circle:
   * - "lifestyle-cover": wide department/collage photo — crop to fill.
   * - "photo-cover": single-product tile with baked-in skin/gray fill —
   *   crop to fill so the circle reads as one continuous disc (the default).
   * - "transparent-contain": image has real alpha transparency (no backdrop
   *   to hide) — shrink to fit so nothing is cropped.
   */
  imageMode?: CategoryImageMode;
};

export type CategoryRoundCarouselProps = {
  categorySlug: string;
  items: CategoryRoundCarouselItem[];
  /** Current subtype/query driving the highlighted tile; "" or omitted highlights the reset tile. */
  activeSubtype?: string | null;
  heading?: string;
  subtitle?: string;
  className?: string;
};

/** How far one arrow click scrolls — roughly 4 tiles (128px + gap) at a time. */
const SCROLL_STEP_PX = 600;

/**
 * Round image tiles for browsing a category's subtypes (e.g. Refrigerators,
 * Dishwashers). Scrolls horizontally with arrow buttons and native
 * touch/mouse drag, staying a single compact row on every viewport.
 */
export function CategoryRoundCarousel({
  categorySlug,
  items,
  activeSubtype,
  heading,
  subtitle,
  className,
}: CategoryRoundCarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

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
    // Re-measure whenever the tile set changes (e.g. category navigation).
  }, [items.length]);

  function scrollBy(direction: -1 | 1) {
    trackRef.current?.scrollBy({ left: direction * SCROLL_STEP_PX, behavior: "smooth" });
  }

  if (items.length === 0) return null;

  const title = categoryDisplayTitle(categorySlug);
  const headingText = heading ?? `Explore ${title}`;
  const subtitleText =
    subtitle ?? `Browse ${title.toLowerCase()} types, then compare real offers by Total Known Cost.`;
  const headingId = `round-carousel-${normalizeCategoryKey(categorySlug)}-heading`;
  const active = (activeSubtype ?? "").trim().toLowerCase();

  return (
    <section
      id="browse-types"
      aria-labelledby={headingId}
      className={className ? `round-carousel-section space-y-1 ${className}` : "round-carousel-section space-y-1"}
    >
      <div>
        <h2 id={headingId} className="text-lg font-bold tracking-tight text-navy-900 sm:text-xl">
          {headingText}
        </h2>
        <p className="mt-1 text-sm text-muted">{subtitleText}</p>
      </div>
      <div className="round-carousel-wrap">
        <button
          type="button"
          className="carousel-arrow left"
          onClick={() => scrollBy(-1)}
          disabled={!canScrollLeft}
          aria-label={`Scroll ${title} categories left`}
        >
          ‹
        </button>
        <ul
          ref={trackRef}
          className="round-category-carousel"
          aria-label={`${title} subcategories`}
        >
          {items.map((item) => {
            const isActive = item.slug.toLowerCase() === active;
            return (
              <li
                key={item.slug || "all"}
                className={isActive ? "round-category-tile active" : "round-category-tile"}
              >
                <Link href={item.href} aria-current={isActive ? "true" : undefined}>
                  <span className="round-category-image" data-mode={item.imageMode ?? "photo-cover"}>
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={116}
                      height={116}
                      unoptimized
                    />
                    {item.badge ? <span className="round-category-badge">{item.badge}</span> : null}
                  </span>
                  <span className="round-category-label">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="carousel-arrow right"
          onClick={() => scrollBy(1)}
          disabled={!canScrollRight}
          aria-label={`Scroll ${title} categories right`}
        >
          ›
        </button>
      </div>
    </section>
  );
}
