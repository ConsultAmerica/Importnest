import Image from "next/image";
import Link from "next/link";
import { getCategoryRoundCarouselItems } from "@/lib/category-round-carousel";
import { categoryDisplayTitle } from "@/lib/category-visuals";

/**
 * When a category has only one or two live products, surface popular subtype
 * browse links and a natural-language search — no invented results.
 */
export function SparseBrowsePrompts({
  categorySlug,
  resultCount,
  showTypes = true,
}: {
  categorySlug: string;
  resultCount: number;
  /** False when the round carousel is already on screen — avoids a duplicate row of the same types. */
  showTypes?: boolean;
}) {
  const title = categoryDisplayTitle(categorySlug);
  const types = getCategoryRoundCarouselItems(categorySlug).filter(
    (item) => item.slug && item.slug !== "deals",
  );
  if (types.length === 0) return null;
  const suggestions = types.slice(0, 6);
  const describe = `Best ${title.toLowerCase()} under $250`;
  const heading =
    resultCount === 1 ? `Only 1 live offer in ${title}` : `Only ${resultCount} live offers in ${title}`;

  if (!showTypes) {
    return (
      <section className="sparse-browse-note" aria-label="Broaden this search">
        <p className="min-w-0 text-sm text-muted">
          <span className="font-bold text-navy-900">{heading}.</span> Pick a type above, or
          describe what you need and we’ll match it to approved offers.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href={`/search?q=${encodeURIComponent(describe)}`} className="btn-cta px-4 py-2 text-sm">
            Describe what you need
          </Link>
          <Link
            href="/search/results?sort=lowest_cost"
            className="rounded-full border border-border bg-panel px-4 py-2 text-sm font-semibold text-navy-900 hover:border-accent"
          >
            See all deals
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-border bg-panel px-4 py-4 shadow-[var(--shadow-panel)]"
      aria-label="Broaden this search"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-bold tracking-tight text-navy-900">{heading}</h2>
          <p className="mt-1 text-sm text-muted">
            Popular types below — pick one to browse, or describe what you need.
          </p>
        </div>
        <Link
          href={`/search?q=${encodeURIComponent(describe)}`}
          className="text-sm font-semibold text-link hover:underline"
        >
          Try “{describe}”
        </Link>
      </div>
      <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
        {suggestions.map((item) => (
          <li key={item.slug} className="shrink-0">
            <Link
              href={item.href}
              className="group flex w-[5.5rem] flex-col items-center text-center"
            >
              <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-full border border-accent/30 bg-[radial-gradient(circle_at_50%_36%,var(--tile-skin-center),var(--tile-skin)_58%,var(--tile-skin-edge))] shadow-sm transition group-hover:border-accent">
                <Image
                  src={item.imageUrl}
                  alt=""
                  width={72}
                  height={72}
                  unoptimized
                  className="h-full w-full object-contain p-1.5 drop-shadow-[0_3px_4px_rgb(70_45_10/0.22)]"
                />
              </span>
              <span className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug text-navy-900 group-hover:text-link">
                {item.label}
              </span>
            </Link>
          </li>
        ))}
        <li className="shrink-0">
          <Link
            href={`/search?q=${encodeURIComponent(describe)}`}
            className="flex h-[4.5rem] w-[5.5rem] flex-col items-center justify-center rounded-2xl border border-dashed border-accent/50 bg-accent/5 px-2 text-center text-xs font-semibold leading-snug text-navy-900 hover:border-accent"
          >
            Describe what you need
          </Link>
        </li>
      </ul>
    </section>
  );
}
