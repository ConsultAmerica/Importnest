import Image from "next/image";
import Link from "next/link";
import {
  categoryDisplayTitle,
  categoryHasImage,
  categoryImageAlt,
  categoryImageSrc,
  relatedCategorySlugs,
} from "@/lib/category-visuals";

/**
 * Image chips for related departments on category results pages.
 * Links to /search/results?category=… so shoppers can jump without mixing demos.
 */
export function RelatedCategoryChips({
  categorySlug,
  query,
}: {
  categorySlug: string;
  /** Preserve the current query when jumping departments (optional). */
  query?: string | null;
}) {
  const related = relatedCategorySlugs(categorySlug, 6);
  if (related.length === 0) return null;

  return (
    <section className="mt-8" aria-labelledby="related-categories-heading">
      <h2
        id="related-categories-heading"
        className="text-sm font-bold uppercase tracking-wide text-muted"
      >
        Related categories
      </h2>
      <ul className="mt-3 grid w-full grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
        {related.map((slug) => {
          const params = new URLSearchParams({ category: slug });
          if (query?.trim()) params.set("q", query.trim());
          const href = `/search/results?${params.toString()}`;
          const title = categoryDisplayTitle(slug);
          const src = categoryImageSrc(slug);

          return (
            <li key={slug} className="min-w-0">
              <Link
                href={href}
                className="flex h-full w-full flex-col items-center gap-1.5 rounded-xl border border-border bg-panel p-2.5 text-center shadow-[var(--shadow-panel)] transition hover:border-accent/45 hover:shadow-md"
              >
                <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-border bg-transparent">
                  {src && categoryHasImage(slug) ? (
                    <Image
                      src={src}
                      alt={categoryImageAlt(slug, title)}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : null}
                </div>
                <span className="line-clamp-2 text-[11px] font-semibold leading-snug text-navy-900">
                  {title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
