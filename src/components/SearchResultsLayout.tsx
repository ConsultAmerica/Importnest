import { ProductCard, type ProductCardBadge } from "@/components/ProductCard";
import { DepartmentBrowse, SearchFiltersFields } from "@/components/SearchFiltersFields";
import { normalizeCategorySlug } from "@/lib/category-visuals";
import {
  conditionBadgeLabels,
  type ResultHighlight,
  type SearchResultProduct,
  type SearchResultsFacetOptions,
} from "@/lib/search-results";

export type ResultsPageParams = {
  q?: string;
  category?: string;
  brand?: string;
  priceMin?: string;
  priceMax?: string;
  condition?: string;
  available?: string;
  pickup?: string;
  freeShipping?: string;
  ratingMin?: string;
  color?: string;
  source?: string;
  comparable?: string;
  saved?: string;
  sort?: string;
  view?: string;
  budgetMax?: string;
  deliveryBy?: string;
  priority?: string;
  alt?: string;
  brands?: string;
  /** Automotive vehicle preference (URL-persisted; not invented fit claims). */
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  attr_fitment?: string;
  attr_install?: string;
  attr_ship_weight?: string;
  attr_material?: string;
  attr_finish?: string;
  attr_power?: string;
  attr_hair?: string;
  attr_skin?: string;
  attr_cert?: string;
  attr_water?: string;
  attr_weight?: string;
  attr_activity?: string;
  attr_color?: string;
  attr_screen?: string;
  attr_capacity?: string;
  attr_energy?: string;
};

const HIGHLIGHT_LABELS: Record<ResultHighlight, string> = {
  best_value: "Best value",
  lowest_cost: "Lowest cost",
  fastest: "Fastest available",
};

function searchResultBadge(product: SearchResultProduct): ProductCardBadge | string | null {
  if (product.priceDropPercent != null && product.priceDropPercent > 0) {
    return `${product.priceDropPercent}% price drop`;
  }
  if (product.isHistoricalLow) return "Lowest tracked";
  if (product.highlights.includes("lowest_cost")) return "Best deal";
  if (product.highlights.includes("best_value")) return "Top product";
  if (product.offerCount >= 3) return "Popular";
  if (product.matchKind === "exact") return "Top product";
  return null;
}

function searchResultSubtitle(product: SearchResultProduct): string | null {
  if (product.attributes.length > 0) {
    return product.attributes
      .map((a) => `${a.key} ${a.value}${a.unit ? ` ${a.unit}` : ""}`)
      .join(" · ");
  }
  if (product.modelNumber) return `Model ${product.modelNumber}`;
  return product.categoryName || null;
}

export function countActiveResultFilters(params: ResultsPageParams): number {
  let n = 0;
  if (normalizeCategorySlug(params.category)) n += 1;
  if (params.brand || (params.brands && params.brands !== "any")) n += 1;
  if (params.priceMin) n += 1;
  if (params.priceMax || params.budgetMax) n += 1;
  if (params.condition) n += 1;
  if (params.available === "0") n += 1;
  if (params.pickup === "1") n += 1;
  if (params.freeShipping === "1") n += 1;
  if (params.ratingMin) n += 1;
  if (params.color) n += 1;
  if (params.source) n += 1;
  if (params.comparable === "0" || params.alt === "exact") n += 1;
  if (params.saved === "1") n += 1;
  for (const [k, v] of Object.entries(params)) {
    if (k.startsWith("attr_") && v) n += 1;
  }
  if (params.vehicleYear || params.vehicleMake || params.vehicleModel) n += 1;
  return n;
}

export function SearchFiltersForm({
  params,
  facets,
  className,
  resultCount,
  stickyApply,
}: {
  params: ResultsPageParams;
  facets: SearchResultsFacetOptions;
  className?: string;
  resultCount?: number;
  stickyApply?: boolean;
}) {
  return (
    <form action="/search/results" method="get" className={className}>
      <SearchFiltersFields
        params={params}
        facets={facets}
        resultCount={resultCount}
        stickyApply={stickyApply}
      />
    </form>
  );
}

export function SearchFiltersSidebar({
  params,
  facets,
  resultCount,
}: {
  params: ResultsPageParams;
  facets: SearchResultsFacetOptions;
  resultCount?: number;
}) {
  return (
    <aside className="hidden min-w-0 w-full lg:flex lg:flex-col">
      <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pr-1">
          <DepartmentBrowse params={params} />
          <SearchFiltersForm
            params={params}
            facets={facets}
            resultCount={resultCount}
            className="space-y-5"
          />
        </div>
      </div>
    </aside>
  );
}

function prioritizeSpecs(
  attributes: { key: string; value: string; unit: string | null }[],
): { key: string; value: string; unit: string | null }[] {
  const preferred = [
    "capacity",
    "dimensions",
    "dimension",
    "screen size",
    "display",
    "voltage",
    "wattage",
    "energy",
    "energy rating",
    "noise",
    "noise level",
    "warranty",
    "color",
    "finish",
    "filter",
    "coverage",
    "size",
  ];
  const scored = [...attributes].sort((a, b) => {
    const ai = preferred.findIndex((p) => a.key.toLowerCase().includes(p));
    const bi = preferred.findIndex((p) => b.key.toLowerCase().includes(p));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return scored.slice(0, 5);
}

export function SearchResultProductCard({
  product,
  signedIn,
  redirectTo,
  layout = "grid",
  vehicle,
  alertActive = false,
}: {
  product: SearchResultProduct;
  signedIn: boolean;
  redirectTo: string;
  layout?: "grid" | "list";
  vehicle?: { year?: string; make?: string; model?: string };
  alertActive?: boolean;
}) {
  const conditions = conditionBadgeLabels(product.conditions);
  const extraBadges: string[] = [];
  if (product.matchKind === "exact") extraBadges.push("Exact match");
  if (product.matchKind === "comparable") extraBadges.push("Comparable alternative");
  for (const h of product.highlights.slice(0, 2)) {
    const label = HIGHLIGHT_LABELS[h];
    if (label && !extraBadges.includes(label)) extraBadges.push(label);
  }
  for (const c of conditions.slice(0, 2)) {
    if (!extraBadges.includes(c)) extraBadges.push(c);
  }

  const availability = {
    hasOffers: product.offerCount > 0,
    hasPickup: product.hasPickup,
    hasFreeShipping: product.hasFreeShipping,
    deliveryLabel: null as string | null,
  };

  const shared = {
    productId: product.id,
    href: `/compare/${product.id}`,
    imageSrc: product.imageSrc,
    brandName: product.brandName,
    productName: product.productName,
    subtitle: layout === "list" ? null : searchResultSubtitle(product),
    badge: searchResultBadge(product),
    rating: product.rating,
    ratingCount: product.ratingCount,
    fromPrice: product.lowestTotalCost,
    previousPrice: product.previousTotalCost,
    offerCount: product.offerCount,
    sourceCount: product.sourceIds.length,
    sourceNames: product.sourceNames,
    offerBreakdown: product.offerBreakdown,
    freshnessMinutesAgo: product.freshnessMinutesAgo,
    categorySlug: product.categorySlug,
    bestListing: product.bestListing,
    isSaved: product.isSaved,
    alertActive,
    signedIn,
    redirectTo,
    extraBadges,
    availability,
    specAttributes: layout === "list" ? prioritizeSpecs(product.allAttributes) : [],
    compactList: layout === "list",
    colorSwatches: product.colors,
    intentBadges: categoryIntentBadges(product, vehicle),
    dealReason: product.priceDropPercent
      ? `${product.priceDropPercent}% below the last tracked item + shipping`
      : product.isHistoricalLow
        ? "Lowest tracked item + shipping in saved history"
        : null,
  };

  return <ProductCard {...shared} />;
}

/** Category-intent badges from real attributes only — never invents verified fitment. */
function categoryIntentBadges(
  product: SearchResultProduct,
  vehicle?: { year?: string; make?: string; model?: string },
): string[] {
  const badges: string[] = [];
  const attrs = product.allAttributes;
  const slug = product.categorySlug;

  if (slug === "automotive") {
    const fit = attrs.find((a) => /fitment|compatibility/i.test(a.key));
    const vehicleLabel = [vehicle?.year, vehicle?.make, vehicle?.model]
      .filter(Boolean)
      .join(" ");
    if (vehicleLabel) {
      badges.push(`? Verify fit for your ${vehicleLabel}`);
    } else {
      badges.push("? Select vehicle to verify fit");
    }
    if (fit) badges.push(`Listed: ${fit.value}`);
    const install = attrs.find((a) => /installation/i.test(a.key));
    if (install) badges.push(`Install: ${install.value}`);
  }

  if (slug === "beauty-devices" || slug === "beauty") {
    const cert = attrs.find((a) => /certification/i.test(a.key));
    if (cert) badges.push(cert.value);
    const hair = attrs.find((a) => /hair type/i.test(a.key));
    const skin = attrs.find((a) => /skin type/i.test(a.key));
    if (hair) badges.push(hair.value);
    if (skin) badges.push(skin.value);
  }

  if (slug === "outdoors") {
    const water = attrs.find((a) => /water|ipx|weather/i.test(a.key));
    if (water) badges.push(water.unit ? `${water.value} ${water.unit}` : water.value);
    const weight = attrs.find((a) => /^weight$/i.test(a.key));
    if (weight) badges.push(weight.unit ? `${weight.value} ${weight.unit}` : weight.value);
    const activity = attrs.find((a) => /activity/i.test(a.key));
    if (activity) badges.push(activity.value);
  }

  return badges.slice(0, 3);
}
