"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { categoryDisplayTitle, normalizeCategoryKey } from "@/lib/category-visuals";
import {
  getCategoryDemoProducts,
  getCategoryDemoSubtypes,
} from "@/data/category-demo-products";
import { ProductImage } from "@/components/ProductImage";

const BROWSE_ALIASES: Record<string, string[]> = {
  "smart home": ["table lamp", "diffuser", "organizer"],
  furniture: ["throw pillows", "rug", "blanket"],
  lighting: ["table lamp"],
  tools: ["organizer", "storage bins"],
};

function browseMatches(query: string, subtype: string) {
  const q = query.trim().toLowerCase();
  const s = subtype.trim().toLowerCase();
  if (!q) return true;
  const aliases = BROWSE_ALIASES[q];
  if (aliases) return aliases.some((alias) => s === alias || s.includes(alias));
  return s === q || s.includes(q) || q.includes(s);
}

/**
 * Image-rich discovery tiles for category browsing — distinct subtype photos.
 * Not live listings: no invented prices/offers.
 * Always scoped to the requested category only (never mixes departments).
 */
export function CategoryDemoGrid({
  categorySlug,
  prominence = "secondary",
  showSubtypeChips = true,
}: {
  categorySlug: string;
  /** primary = main browse grid when live results are empty; secondary = “More to explore” */
  prominence?: "primary" | "secondary";
  /** When false, omit subtype chips (e.g. already shown in CategoryBrowseHeader). */
  showSubtypeChips?: boolean;
}) {
  const searchParams = useSearchParams();
  const activeSubtype = (searchParams.get("q") ?? "").trim().toLowerCase();
  const key = normalizeCategoryKey(categorySlug);
  const products = getCategoryDemoProducts(categorySlug).filter(
    (p) => normalizeCategoryKey(p.categorySlug) === key,
  );
  const visible = activeSubtype
    ? products.filter((p) => browseMatches(activeSubtype, p.subtype))
    : products;
  if (products.length === 0) return null;

  const title = categoryDisplayTitle(categorySlug);
  const browseHref = `/search/results?category=${encodeURIComponent(categorySlug)}`;
  const subtypes = getCategoryDemoSubtypes(categorySlug);
  const headingId = prominence === "primary" ? "category-browse-heading" : "category-demo-heading";
  const imageBySubtype = new Map(products.map((p) => [p.subtype.toLowerCase(), p.image]));
  const isBeauty = key === "beauty";
  const filteredTitle =
    activeSubtype && visible.length > 0
      ? activeSubtype.replace(/\b\w/g, (c) => c.toUpperCase())
      : null;
  const sectionTitle =
    prominence === "primary"
      ? filteredTitle ?? (isBeauty ? "Explore Beauty Devices" : `Explore ${title}`)
      : `More to explore in ${title}`;
  const sectionSubtitle =
    visible.length > 0 && visible.length !== products.length
      ? `${visible.length} matching browse idea${visible.length === 1 ? "" : "s"} in ${title}. Live offers appear here when an approved source has this type.`
      : isBeauty
        ? "10 beauty and personal-care device types with distinct photos — browse ideas, then compare live offers when available."
        : `${products.length} ${title} product types with distinct photos — browse ideas, then compare live offers when available.`;

  return (
    <section className={prominence === "primary" ? "mt-2" : "mt-8"} aria-labelledby={headingId}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-lg font-bold tracking-tight text-navy-900 sm:text-xl">
            {sectionTitle}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {visible.length === 0
              ? "No browse ideas match this type. Choose All to see the full department."
              : sectionSubtitle}
          </p>
        </div>
        <Link href={browseHref} className="text-sm font-semibold text-link hover:underline">
          View all {title}
        </Link>
      </div>

      {showSubtypeChips ? (
        <ul className="category-subtype-strip mt-3" aria-label={`${title} product types`}>
          {subtypes.map((subtype) => {
            const thumb = imageBySubtype.get(subtype.toLowerCase());
            const selected = activeSubtype === subtype.toLowerCase();
            return (
              <li key={subtype}>
                <Link
                  href={`/search/results?q=${encodeURIComponent(subtype)}&category=${encodeURIComponent(categorySlug)}`}
                  className={`category-subtype-chip ${selected ? "category-subtype-chip-active" : ""}`}
                >
                  {thumb ? (
                    <span className="category-subtype-thumb">
                      <Image
                        src={thumb}
                        alt=""
                        width={28}
                        height={28}
                        unoptimized
                        className="h-7 w-7 object-contain"
                      />
                    </span>
                  ) : null}
                  <span className="capitalize">{subtype}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      <ul className="mt-4 grid w-full grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((product) => (
          <li key={product.id} className="min-w-0">
            <Link
              href={`/search/results?q=${encodeURIComponent(product.subtype)}&category=${encodeURIComponent(categorySlug)}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-dashed border-accent/40 bg-panel shadow-[var(--shadow-panel)] transition hover:-translate-y-0.5 hover:border-accent"
            >
              <div className="product-photo-well relative overflow-hidden border-b border-border bg-white">
                <ProductImage
                  src={product.image}
                  category={product.categorySlug}
                  subtype={product.subtype}
                  title={product.title}
                  subtitle={product.subtitle}
                  size="card"
                  className="transition duration-300 group-hover:scale-[1.03]"
                  sizes="(max-width:640px) 50vw, (max-width:1280px) 25vw, 20vw"
                />
                {product.badge ? (
                  <span className="badge-accent absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold">
                    {product.badge}
                  </span>
                ) : null}
              </div>
              <div className="flex min-h-[7.5rem] flex-1 flex-col gap-0.5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {product.brand}
                </p>
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-navy-900 group-hover:text-link">
                  {product.title}
                </p>
                <p className="mt-0.5 text-xs capitalize text-accent">{product.subtype}</p>
                <p className="mt-auto line-clamp-2 text-xs text-muted">{product.subtitle}</p>
                {/* Demo data: never let a browse idea pass for a live, priced offer. */}
                <p className="demo-card-note">Browse idea · no live price yet →</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
