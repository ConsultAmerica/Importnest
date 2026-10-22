import { ProductCard } from "@/components/ProductCard";
import { categoryDisplayTitle } from "@/lib/category-visuals";
import type { PopularComparison } from "@/lib/popular-comparisons";

export function PopularComparisonCard({
  item,
  signedIn,
  redirectTo = "/",
  compactList = false,
}: {
  item: PopularComparison;
  signedIn: boolean;
  redirectTo?: string;
  compactList?: boolean;
}) {
  return (
    <ProductCard
      productId={item.productId}
      href={`/compare/${item.productId}`}
      imageSrc={item.imageSrc}
      brandName={item.brandName}
      productName={item.productName}
      subtitle={categoryDisplayTitle(item.categorySlug)}
      badge="Popular"
      rating={item.rating}
      fromPrice={item.lowestTotalCost}
      offerCount={item.offerCount}
      sourceCount={item.sourceCount}
      sourceNames={item.sourceNames}
      freshnessMinutesAgo={item.freshnessMinutesAgo}
      bestListing={item.bestListing}
      isSaved={item.isSaved}
      signedIn={signedIn}
      redirectTo={redirectTo}
      compactList={compactList}
    />
  );
}

export function PopularComparisonsSection({
  items,
  signedIn,
  title = "Popular comparisons",
  subtitle = "Live totals from approved retailers",
  layout = "grid",
}: {
  items: PopularComparison[];
  signedIn: boolean;
  title?: string;
  subtitle?: string;
  /** "tray" = one horizontally scrollable row — for secondary, cross-department picks. */
  layout?: "grid" | "list" | "tray";
}) {
  if (items.length === 0) return null;
  // Title-derived id: two of these sections can share a page (e.g. "More to explore").
  const headingId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "popular"}-heading`;

  return (
    <section aria-labelledby={title ? headingId : undefined}>
      {title ? (
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2
              id={headingId}
              className="text-xl font-bold tracking-tight text-navy-900"
            >
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </div>
        </div>
      ) : null}
      <ul
        className={
          layout === "list"
            ? `grid grid-cols-1 gap-3 ${title ? "mt-4" : ""}`
            : layout === "tray"
              ? `comparison-tray ${title ? "mt-4" : ""}`
              : `section-grid ${title ? "mt-4" : ""}`
        }
      >
        {items.map((item) => (
          <li key={item.productId} className="min-w-0">
            <PopularComparisonCard
              item={item}
              signedIn={signedIn}
              compactList={layout === "list"}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
