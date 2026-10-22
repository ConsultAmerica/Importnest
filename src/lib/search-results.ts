import { prisma } from "@/lib/prisma";
import { minutesSince, knownOfferTotal, hasDisclosedShipping, isSafeRetailerUrl } from "@/lib/compare-view";
import { categoryFacetProfile } from "@/lib/category-facets";
import { getProductDisplayImage } from "@/lib/product-images";
import type { SearchIntent } from "@/lib/search-intent";

export type ResultsSort =
  | "best_overall"
  | "lowest_cost"
  | "fastest"
  | "best_value"
  | "recently_updated"
  | "best_rated";

export type SearchResultsFilters = {
  query?: string;
  categorySlug?: string;
  brandNames?: string[];
  priceMin?: number;
  priceMax?: number;
  condition?: "new" | "open_box" | "refurbished" | "used";
  /** Only products with ≥1 approved offer */
  availableOnly?: boolean;
  /** Only products with a pickup-tagged listing */
  pickupOnly?: boolean;
  /** Only products with at least one $0 shipping listing (real shipping field). */
  freeShippingOnly?: boolean;
  /** Minimum averageRating when present — products without ratings are excluded. */
  ratingMin?: number;
  /** Exact ProductAttribute Color/Finish value when present in catalog. */
  color?: string;
  /** Category-specific attribute filters: ProductAttribute.key → value */
  attributeFilters?: Record<string, string>;
  sourceId?: string;
  /** Soft preference: when false, require modelName word overlap with query */
  allowComparable?: boolean;
  savedOnly?: boolean;
  savedProductIds?: Set<string>;
  sort?: ResultsSort;
};

export type MatchKind = "exact" | "comparable";

export type ResultHighlight = "best_value" | "lowest_cost" | "fastest";

export type SearchResultProduct = {
  id: string;
  brandName: string;
  productName: string;
  modelNumber: string | null;
  categoryName: string;
  categorySlug: string;
  imageSrc: string;
  lowestTotalCost: number | null;
  offerCount: number;
  freshnessMinutesAgo: number | null;
  hasPickup: boolean;
  conditions: string[];
  /** Real seeded average rating — never fabricated at render time. */
  rating: number | null;
  /** Real review/rating count from catalog — omit when null. */
  ratingCount: number | null;
  /** True when any approved listing has shipping === 0. */
  hasFreeShipping: boolean;
  /** Compact key attributes for the card (≤3) */
  attributes: { key: string; value: string; unit: string | null }[];
  /** Full attribute list for filtering and list-view specs. */
  allAttributes: { key: string; value: string; unit: string | null }[];
  /** Color / finish attribute values when present on the product. */
  colors: string[];
  sourceIds: string[];
  /** Approved retailer names behind the offers, lowest total first. */
  sourceNames: string[];
  /** One lowest Total Known Cost line per retailer. Real listings only. */
  offerBreakdown: {
    sourceName: string;
    sourceId: string;
    /** Listing behind this retailer's lowest total — set only when it has a safe retailer URL, so the card can link straight to it via /go. */
    listingId?: string;
    total: number;
    price: number;
    shipping: number | null;
    fees: number;
    /** Listing's delivery label mentions pickup. */
    pickup: boolean;
  }[];
  /** Prior tracked Total Known Cost when PriceHistory has an earlier day. */
  previousTotalCost: number | null;
  /** Whole-percent drop vs previousTotalCost. Null when history does not show a drop. */
  priceDropPercent: number | null;
  /** True when the current total is the lowest saved daily total and history has 2+ days. */
  isHistoricalLow: boolean;
  isSaved: boolean;
  /** Set when a text query is present */
  matchKind: MatchKind | null;
  highlights: ResultHighlight[];
  /** The specific listing backing lowestTotalCost — used to add this exact offer to cart without inventing data. Null when there are no approved offers. */
  bestListing: {
    listingId: string;
    sourceName: string;
    condition: string;
    price: number;
    shipping: number | null;
    fees: number;
  } | null;
};

export type SearchResultsFacetOptions = {
  categories: { slug: string; name: string; count: number }[];
  brands: { name: string; count: number }[];
  sources: { id: string; name: string; count: number }[];
  conditions: { value: string; label: string; count: number }[];
  /** Aggregated Color/Finish attributes only — empty when catalog has none. */
  colors: { value: string; count: number }[];
  /** Category-profile attribute facets with live counts. */
  dynamicAttributes: {
    key: string;
    param: string;
    label: string;
    swatch?: boolean;
    values: { value: string; count: number }[];
  }[];
  /** Min/max Total Known Cost among facet-scoped products with offers. */
  priceBounds: { min: number; max: number } | null;
  freeShippingCount: number;
  ratingCounts: { min4: number; min3: number };
};

export type SearchResultsPayload = {
  products: SearchResultProduct[];
  total: number;
  facets: SearchResultsFacetOptions;
  applied: SearchResultsFilters;
};

const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  "open-box": "Open-box",
  refurbished: "Refurbished",
  "certified-refurbished": "Refurbished",
  used: "Used",
};

/** Card-facing condition labels — prefer New / Open-box / Refurbished. */
export function conditionBadgeLabels(conditions: string[]): string[] {
  const order = ["new", "open-box", "refurbished", "certified-refurbished", "used"];
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const key of order) {
    if (!conditions.includes(key)) continue;
    const label = CONDITION_LABELS[key] ?? key;
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
    if (labels.length >= 2) break;
  }
  return labels;
}

function classifyMatchKind(input: {
  query?: string;
  words: string[];
  productName: string;
  brandName: string;
  modelNumber: string | null;
}): MatchKind | null {
  const q = input.query?.trim().toLowerCase();
  if (!q) return null;

  const name = input.productName.toLowerCase();
  const brand = input.brandName.toLowerCase();
  const model = input.modelNumber?.toLowerCase() ?? null;

  if (name === q || (model && model === q)) return "exact";
  if (model && (q.includes(model) || model.includes(q))) return "exact";
  if (q.includes(brand) && (q.includes(name) || (model != null && q.includes(model)))) {
    return "exact";
  }

  const { words } = input;
  if (words.length === 0) return "comparable";

  const inScope = (w: string) =>
    name.includes(w) || brand.includes(w) || (model != null && model.includes(w));
  if (words.every(inScope)) return "exact";

  const nameHits = words.filter((w) => name.includes(w)).length;
  if (nameHits >= Math.max(1, Math.ceil(words.length * 0.75))) return "exact";

  return "comparable";
}

function filterConditionMatches(listingCondition: string, filter: SearchResultsFilters["condition"]) {
  if (!filter) return true;
  if (filter === "open_box") return listingCondition === "open-box";
  if (filter === "refurbished") {
    return listingCondition === "refurbished" || listingCondition === "certified-refurbished";
  }
  return listingCondition === filter;
}

function listingHasPickup(deliveryLabel: string | null | undefined): boolean {
  return /pickup/i.test(deliveryLabel ?? "");
}

/**
 * When condition/pickup filters are active, only listings that satisfy those
 * filters may back the card's price and Add to Cart (bestListing).
 */
export function listingMatchesOfferFilters(
  listing: { condition: string; deliveryLabel: string | null },
  filters: Pick<SearchResultsFilters, "condition" | "pickupOnly">,
): boolean {
  if (filters.condition && !filterConditionMatches(listing.condition, filters.condition)) {
    return false;
  }
  if (filters.pickupOnly && !listingHasPickup(listing.deliveryLabel)) {
    return false;
  }
  return true;
}

function significantWords(query: string): string[] {
  const stop = new Set([
    "a", "an", "the", "for", "of", "in", "on", "with", "under", "over", "to",
    "i", "need", "want", "looking", "some", "any", "this", "that", "please",
    "best", "good", "quiet",
  ]);
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
}

type ListingRow = {
  id: string;
  canonicalProductId: string | null;
  sourceId: string;
  condition: string;
  price: number;
  shipping: number | null;
  fees: number;
  deliveryLabel: string | null;
  url: string | null;
  freshnessCapturedAt: Date;
  source: { name: string };
};

type ProductAgg = {
  offerCount: number;
  lowestTotalCost: number;
  freshestAt: Date;
  hasPickup: boolean;
  hasFreeShipping: boolean;
  conditions: Set<string>;
  sourceIds: Set<string>;
  bestListing: NonNullable<SearchResultProduct["bestListing"]>;
  /** Lowest Total Known Cost listing per retailer name. */
  bySource: Map<string, SearchResultProduct["offerBreakdown"][number]>;
};

function buildAggs(listings: ListingRow[]): Map<string, ProductAgg> {
  const byProduct = new Map<string, ProductAgg>();
  for (const l of listings) {
    const id = l.canonicalProductId;
    if (!id) continue;
    const total = knownOfferTotal(l.price, l.shipping, l.fees);
    const pickup = listingHasPickup(l.deliveryLabel);
    const freeShip = hasDisclosedShipping(l.shipping) && l.shipping <= 0.009;
    const bestListing: ProductAgg["bestListing"] = {
      listingId: l.id,
      sourceName: l.source.name,
      condition: l.condition,
      price: l.price,
      shipping: l.shipping,
      fees: l.fees,
    };
    const existing = byProduct.get(id);
    if (!existing) {
      byProduct.set(id, {
        offerCount: 1,
        lowestTotalCost: total,
        freshestAt: l.freshnessCapturedAt,
        hasPickup: pickup,
        hasFreeShipping: freeShip,
        conditions: new Set([l.condition]),
        sourceIds: new Set([l.sourceId]),
        bestListing,
        bySource: new Map([
          [
            l.source.name,
            {
              sourceName: l.source.name,
              sourceId: l.sourceId,
              listingId: isSafeRetailerUrl(l.url) ? l.id : undefined,
              total,
              price: l.price,
              shipping: l.shipping,
              fees: l.fees,
              pickup,
            },
          ],
        ]),
      });
      continue;
    }
    existing.offerCount += 1;
    if (total < existing.lowestTotalCost) {
      existing.lowestTotalCost = total;
      existing.bestListing = bestListing;
    }
    if (l.freshnessCapturedAt > existing.freshestAt) existing.freshestAt = l.freshnessCapturedAt;
    existing.hasPickup = existing.hasPickup || pickup;
    existing.hasFreeShipping = existing.hasFreeShipping || freeShip;
    existing.conditions.add(l.condition);
    existing.sourceIds.add(l.sourceId);
    const prior = existing.bySource.get(l.source.name);
    if (!prior || total < prior.total) {
      existing.bySource.set(l.source.name, {
        sourceName: l.source.name,
        sourceId: l.sourceId,
        listingId: isSafeRetailerUrl(l.url) ? l.id : undefined,
        total,
        price: l.price,
        shipping: l.shipping,
        fees: l.fees,
        pickup,
      });
    }
  }
  return byProduct;
}

function scoreBestOverall(p: SearchResultProduct): number {
  // Prefer more offers, lower price, fresher data — no fabricated ratings.
  const priceScore = p.lowestTotalCost == null ? 0 : 1 / (1 + p.lowestTotalCost / 100);
  const offerScore = Math.min(p.offerCount, 8) / 8;
  const freshScore =
    p.freshnessMinutesAgo == null ? 0 : Math.max(0, 1 - p.freshnessMinutesAgo / (60 * 24 * 7));
  return offerScore * 0.45 + priceScore * 0.35 + freshScore * 0.2;
}

function scoreBestValue(p: SearchResultProduct): number {
  if (p.lowestTotalCost == null || p.offerCount === 0) return -1;
  // More competing offers at a given price → stronger "value" signal from real data only.
  return p.offerCount / (1 + p.lowestTotalCost / 200);
}

async function attachPriceSignals(rows: SearchResultProduct[], listings: ListingRow[]) {
  const wanted = new Set(rows.map((row) => row.id));
  const relevant = listings.filter(
    (listing) => listing.canonicalProductId && wanted.has(listing.canonicalProductId),
  );
  if (relevant.length === 0) return;

  const history = await prisma.priceHistory.findMany({
    where: { listingId: { in: relevant.map((listing) => listing.id) } },
    select: { listingId: true, price: true, shipping: true, capturedAt: true },
    orderBy: { capturedAt: "asc" },
  });
  const listingToProduct = new Map(
    relevant
      .filter((listing) => listing.canonicalProductId)
      .map((listing) => [listing.id, listing.canonicalProductId!]),
  );
  const byDay = new Map<string, Map<string, number>>();
  for (const point of history) {
    if (!hasDisclosedShipping(point.shipping)) continue;
    const productId = listingToProduct.get(point.listingId);
    if (!productId) continue;
    const day = point.capturedAt.toISOString().slice(0, 10);
    const total = point.price + point.shipping;
    let days = byDay.get(productId);
    if (!days) {
      days = new Map();
      byDay.set(productId, days);
    }
    const existing = days.get(day);
    if (existing == null || total < existing) days.set(day, total);
  }

  for (const row of rows) {
    const listing = row.bestListing;
    if (!listing || !hasDisclosedShipping(listing.shipping)) continue;
    const days = byDay.get(row.id);
    if (!days || days.size < 2) continue;
    const ordered = [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
    const trackedNow = listing.price + listing.shipping;
    const lowest = Math.min(...ordered.map(([, total]) => total));
    const previous = ordered[ordered.length - 2]?.[1];
    if (previous != null && previous > trackedNow + 0.009) {
      row.previousTotalCost = previous;
      row.priceDropPercent = Math.round(((previous - trackedNow) / previous) * 100);
    }
    row.isHistoricalLow = trackedNow <= lowest + 0.009;
  }
}

/**
 * Multi-product search/browse for the Idealo-style results page.
 * Only uses DB-backed fields — never invents ratings or delivery dates.
 */
export async function getSearchResults(
  filters: SearchResultsFilters,
): Promise<SearchResultsPayload> {
  try {
    return await getSearchResultsUnsafe(filters);
  } catch (err) {
    console.error("[search-results] catalog unavailable", err);
    return {
      products: [],
      total: 0,
      facets: {
        categories: [],
        brands: [],
        sources: [],
        conditions: [],
        colors: [],
        dynamicAttributes: [],
        priceBounds: null,
        freeShippingCount: 0,
        ratingCounts: { min4: 0, min3: 0 },
      },
      applied: filters,
    };
  }
}

async function getSearchResultsUnsafe(
  filters: SearchResultsFilters,
): Promise<SearchResultsPayload> {
  const words = filters.query ? significantWords(filters.query) : [];

  const products = await prisma.canonicalProduct.findMany({
    where: {
      AND: [
        filters.categorySlug
          ? { category: { slug: filters.categorySlug } }
          : {},
        filters.brandNames?.length
          ? { brand: { name: { in: filters.brandNames, mode: "insensitive" } } }
          : {},
        words.length
          ? {
              OR: words.flatMap((w) => [
                { modelName: { contains: w, mode: "insensitive" as const } },
                { modelNumber: { contains: w, mode: "insensitive" as const } },
                { brand: { name: { contains: w, mode: "insensitive" as const } } },
                // Category is already applied above. Matching its name again
                // would return every product in the department.
                ...(filters.categorySlug
                  ? []
                  : [{ category: { name: { contains: w, mode: "insensitive" as const } } }]),
              ]),
            }
          : {},
      ],
    },
    include: {
      brand: true,
      category: true,
      attributes: { orderBy: { key: "asc" } },
    },
  });

  const listings = await prisma.listing.findMany({
    where: {
      canonicalProductId: { in: products.map((p) => p.id) },
      matches: { some: { status: "approved" } },
      ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
    },
    select: {
      id: true,
      canonicalProductId: true,
      sourceId: true,
      condition: true,
      price: true,
      shipping: true,
      fees: true,
      deliveryLabel: true,
      url: true,
      freshnessCapturedAt: true,
      source: { select: { name: true } },
    },
  });

  // Facet universe: all approved listings in scope.
  // Card price + bestListing: only listings matching active condition/pickup filters,
  // so Add to Cart always uses the real offer backing the displayed card.
  const allAggs = buildAggs(listings);
  const offerFilterActive = Boolean(
    filters.condition || filters.pickupOnly || filters.freeShippingOnly,
  );
  const displayListings = offerFilterActive
    ? listings.filter((l) => {
        if (!listingMatchesOfferFilters(l, filters)) return false;
        if (filters.freeShippingOnly && (!hasDisclosedShipping(l.shipping) || l.shipping > 0.009)) return false;
        return true;
      })
    : listings;
  const aggs = buildAggs(displayListings);
  const saved = filters.savedProductIds ?? new Set<string>();

  let rows: SearchResultProduct[] = products.map((p) => {
    const agg = aggs.get(p.id);
    const facetAgg = allAggs.get(p.id);
    const allAttributes = p.attributes.map((a) => ({
      key: a.key,
      value: a.value,
      unit: a.unit,
    }));
    const colors = p.attributes
      .filter((a) => /^(color|finish|colour)$/i.test(a.key))
      .map((a) => a.value.trim())
      .filter(Boolean);
    return {
      id: p.id,
      brandName: p.brand.name,
      productName: p.modelName,
      modelNumber: p.modelNumber,
      categoryName: p.category.name,
      categorySlug: p.category.slug,
      imageSrc: getProductDisplayImage({
        id: p.id,
        categorySlug: p.category.slug,
        title: p.modelName,
      }),
      lowestTotalCost: agg?.lowestTotalCost ?? null,
      offerCount: agg?.offerCount ?? 0,
      freshnessMinutesAgo: agg ? minutesSince(agg.freshestAt) : null,
      hasPickup: facetAgg?.hasPickup ?? false,
      hasFreeShipping: facetAgg?.hasFreeShipping ?? false,
      conditions: facetAgg ? [...facetAgg.conditions] : [],
      rating: p.averageRating,
      ratingCount: p.ratingCount,
      attributes: allAttributes.slice(0, 3),
      allAttributes,
      colors,
      sourceIds: facetAgg ? [...facetAgg.sourceIds] : [],
      sourceNames: agg
        ? [...agg.bySource.values()].sort((a, b) => a.total - b.total).map((o) => o.sourceName)
        : [],
      offerBreakdown: agg
        ? [...agg.bySource.values()].sort((a, b) => a.total - b.total)
        : [],
      previousTotalCost: null,
      priceDropPercent: null,
      isHistoricalLow: false,
      bestListing: agg?.bestListing ?? null,
      isSaved: saved.has(p.id),
      matchKind: classifyMatchKind({
        query: filters.query,
        words,
        productName: p.modelName,
        brandName: p.brand.name,
        modelNumber: p.modelNumber,
      }),
      highlights: [],
    };
  });

  // Facets from pre-filter universe (current query/category scope), then apply product filters
  const facetBase = products.map((p) => {
    const facetAgg = allAggs.get(p.id);
    const allAttributes = p.attributes.map((a) => ({
      key: a.key,
      value: a.value,
      unit: a.unit,
    }));
    const colors = p.attributes
      .filter((a) => /^(color|finish|colour)$/i.test(a.key))
      .map((a) => a.value.trim())
      .filter(Boolean);
    return {
      id: p.id,
      brandName: p.brand.name,
      productName: p.modelName,
      modelNumber: p.modelNumber,
      categoryName: p.category.name,
      categorySlug: p.category.slug,
      imageSrc: "",
      lowestTotalCost: facetAgg?.lowestTotalCost ?? null,
      offerCount: facetAgg?.offerCount ?? 0,
      freshnessMinutesAgo: null,
      hasPickup: facetAgg?.hasPickup ?? false,
      hasFreeShipping: facetAgg?.hasFreeShipping ?? false,
      conditions: facetAgg ? [...facetAgg.conditions] : [],
      rating: p.averageRating,
      ratingCount: p.ratingCount,
      attributes: allAttributes.slice(0, 3),
      allAttributes,
      colors,
      sourceIds: facetAgg ? [...facetAgg.sourceIds] : [],
      sourceNames: [],
      offerBreakdown: [],
      previousTotalCost: null,
      priceDropPercent: null,
      isHistoricalLow: false,
      bestListing: null,
      isSaved: saved.has(p.id),
      matchKind: null as SearchResultProduct["matchKind"],
      highlights: [] as SearchResultProduct["highlights"],
    } satisfies SearchResultProduct;
  });

  if (filters.availableOnly) {
    rows = rows.filter((p) => p.offerCount > 0);
  }
  if (filters.pickupOnly) {
    // With offer-filter aggregation, products without a pickup listing have offerCount 0.
    rows = rows.filter((p) => p.offerCount > 0 && p.hasPickup);
  }
  if (filters.priceMin != null) {
    rows = rows.filter((p) => p.lowestTotalCost != null && p.lowestTotalCost >= filters.priceMin!);
  }
  if (filters.priceMax != null) {
    rows = rows.filter((p) => p.lowestTotalCost != null && p.lowestTotalCost <= filters.priceMax!);
  }
  if (filters.freeShippingOnly) {
    rows = rows.filter((p) => p.offerCount > 0 && p.hasFreeShipping);
  }
  if (filters.ratingMin != null) {
    rows = rows.filter((p) => p.rating != null && p.rating >= filters.ratingMin!);
  }
  if (filters.color) {
    const wanted = filters.color.toLowerCase();
    rows = rows.filter((p) => p.colors.some((c) => c.toLowerCase() === wanted));
  }
  if (filters.attributeFilters && Object.keys(filters.attributeFilters).length > 0) {
    rows = rows.filter((p) =>
      Object.entries(filters.attributeFilters!).every(([key, wanted]) =>
        p.allAttributes.some(
          (a) =>
            a.key.toLowerCase() === key.toLowerCase() &&
            a.value.toLowerCase() === wanted.toLowerCase(),
        ),
      ),
    );
  }
  if (filters.condition) {
    // Require at least one listing matching the condition (already reflected in offerCount).
    rows = rows.filter((p) => p.offerCount > 0);
  }
  if (filters.savedOnly) {
    rows = rows.filter((p) => p.isSaved);
  }
  if (filters.allowComparable === false && words.length) {
    // Stricter: model name must contain at least half of query words
    const need = Math.max(1, Math.ceil(words.length / 2));
    rows = rows.filter((p) => {
      const name = p.productName.toLowerCase();
      return words.filter((w) => name.includes(w)).length >= need;
    });
  }

  // Rank badges from real offers only — at most one product per highlight.
  const priced = rows.filter((p) => p.lowestTotalCost != null && p.offerCount > 0);
  let lowestCostId: string | null = null;
  let bestValueId: string | null = null;
  let fastestId: string | null = null;
  if (priced.length) {
    lowestCostId = [...priced].sort(
      (a, b) => (a.lowestTotalCost ?? 0) - (b.lowestTotalCost ?? 0),
    )[0]?.id ?? null;
    bestValueId = [...priced].sort((a, b) => scoreBestValue(b) - scoreBestValue(a))[0]?.id ?? null;
    fastestId =
      [...priced].sort(
        (a, b) =>
          Number(b.hasPickup) - Number(a.hasPickup) ||
          (a.lowestTotalCost ?? 1e12) - (b.lowestTotalCost ?? 1e12),
      )[0]?.id ?? null;
  }
  rows = rows.map((p) => {
    const highlights: ResultHighlight[] = [];
    if (p.id === bestValueId) highlights.push("best_value");
    if (p.id === lowestCostId) highlights.push("lowest_cost");
    if (p.id === fastestId && p.hasPickup) highlights.push("fastest");
    return { ...p, highlights };
  });

  const sort = filters.sort ?? "best_overall";
  rows = [...rows].sort((a, b) => {
    // Exact matches first when searching, then the chosen sort.
    if (filters.query) {
      const am = a.matchKind === "exact" ? 0 : 1;
      const bm = b.matchKind === "exact" ? 0 : 1;
      if (am !== bm) return am - bm;
    }
    switch (sort) {
      case "lowest_cost": {
        if (a.lowestTotalCost == null && b.lowestTotalCost == null) return 0;
        if (a.lowestTotalCost == null) return 1;
        if (b.lowestTotalCost == null) return -1;
        return a.lowestTotalCost - b.lowestTotalCost;
      }
      case "fastest":
        return Number(b.hasPickup) - Number(a.hasPickup) || (a.lowestTotalCost ?? 1e12) - (b.lowestTotalCost ?? 1e12);
      case "best_value":
        return scoreBestValue(b) - scoreBestValue(a);
      case "recently_updated": {
        const af = a.freshnessMinutesAgo ?? 1e9;
        const bf = b.freshnessMinutesAgo ?? 1e9;
        return af - bf;
      }
      case "best_rated": {
        if (a.rating == null && b.rating == null) return 0;
        if (a.rating == null) return 1;
        if (b.rating == null) return -1;
        return b.rating - a.rating;
      }
      case "best_overall":
      default:
        return scoreBestOverall(b) - scoreBestOverall(a);
    }
  });

  await attachPriceSignals(rows, listings);

  // Facet counts from products matching query/category before facet click-narrowing
  // (simpler & honest: count within currently returned filtered set after availability gate)
  const facetRows = facetBase.filter((p) => !filters.availableOnly || p.offerCount > 0);

  const categoryCount = new Map<string, { name: string; count: number }>();
  const brandCount = new Map<string, number>();
  const conditionCount = new Map<string, number>();
  const sourceProductCount = new Map<string, number>();
  const colorCount = new Map<string, number>();
  let freeShippingCount = 0;
  let ratingMin4 = 0;
  let ratingMin3 = 0;
  let priceMinBound = Number.POSITIVE_INFINITY;
  let priceMaxBound = 0;

  for (const p of facetRows) {
    const cat = categoryCount.get(p.categorySlug) ?? { name: p.categoryName, count: 0 };
    cat.count += 1;
    categoryCount.set(p.categorySlug, cat);
    brandCount.set(p.brandName, (brandCount.get(p.brandName) ?? 0) + 1);
    for (const c of p.conditions) {
      conditionCount.set(c, (conditionCount.get(c) ?? 0) + 1);
    }
    for (const s of p.sourceIds) {
      sourceProductCount.set(s, (sourceProductCount.get(s) ?? 0) + 1);
    }
    for (const color of p.colors) {
      colorCount.set(color, (colorCount.get(color) ?? 0) + 1);
    }
    if (p.hasFreeShipping) freeShippingCount += 1;
    if (p.rating != null && p.rating >= 4) ratingMin4 += 1;
    if (p.rating != null && p.rating >= 3) ratingMin3 += 1;
    if (p.lowestTotalCost != null) {
      priceMinBound = Math.min(priceMinBound, p.lowestTotalCost);
      priceMaxBound = Math.max(priceMaxBound, p.lowestTotalCost);
    }
  }

  const sources = await prisma.source.findMany({
    where: { id: { in: [...sourceProductCount.keys()] } },
    select: { id: true, name: true },
  });
  const sourceName = new Map(sources.map((s) => [s.id, s.name]));

  const facets: SearchResultsFacetOptions = {
    categories: [...categoryCount.entries()]
      .map(([slug, v]) => ({ slug, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count),
    brands: [...brandCount.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    sources: [...sourceProductCount.entries()]
      .map(([id, count]) => ({ id, name: sourceName.get(id) ?? id, count }))
      .sort((a, b) => b.count - a.count),
    conditions: [...conditionCount.entries()]
      .map(([value, count]) => ({
        value,
        label: CONDITION_LABELS[value] ?? value.replace(/-/g, " "),
        count,
      }))
      .sort((a, b) => b.count - a.count),
    colors: [...colorCount.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count),
    dynamicAttributes: buildDynamicAttributeFacets(facetRows, filters.categorySlug),
    priceBounds:
      Number.isFinite(priceMinBound) && priceMaxBound >= priceMinBound
        ? { min: Math.floor(priceMinBound), max: Math.ceil(priceMaxBound) }
        : null,
    freeShippingCount,
    ratingCounts: { min4: ratingMin4, min3: ratingMin3 },
  };

  return {
    products: rows,
    total: rows.length,
    facets,
    applied: filters,
  };
}

function buildDynamicAttributeFacets(
  facetRows: SearchResultProduct[],
  categorySlug?: string,
): SearchResultsFacetOptions["dynamicAttributes"] {
  const profile = categoryFacetProfile(categorySlug);
  if (!profile) return [];

  return profile.facets
    .map((facet) => {
      const counts = new Map<string, number>();
      for (const p of facetRows) {
        for (const a of p.allAttributes) {
          if (a.key.toLowerCase() !== facet.key.toLowerCase()) continue;
          counts.set(a.value, (counts.get(a.value) ?? 0) + 1);
        }
      }
      const values = [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
      return {
        key: facet.key,
        param: facet.param,
        label: facet.label,
        swatch: facet.swatch,
        values,
      };
    })
    .filter((f) => f.values.length > 0);
}

/**
 * Splits a results list into exact matches and comparable alternatives —
 * `getSearchResults` already sorts exact matches first, but callers that
 * want to render them as two clearly separate groups (never interleaved
 * under one undifferentiated heading) need the split itself.
 */
export function partitionByMatchKind(products: SearchResultProduct[]): {
  exact: SearchResultProduct[];
  comparable: SearchResultProduct[];
} {
  const exact: SearchResultProduct[] = [];
  const comparable: SearchResultProduct[] = [];
  for (const p of products) {
    if (p.matchKind === "comparable") comparable.push(p);
    else exact.push(p);
  }
  return { exact, comparable };
}

export function intentToResultsFilters(
  intent: Partial<SearchIntent>,
  extras: Partial<SearchResultsFilters> = {},
): SearchResultsFilters {
  return {
    query: intent.query,
    categorySlug: extras.categorySlug ?? intent.category,
    brandNames: extras.brandNames ?? intent.preferredBrands,
    priceMax: extras.priceMax ?? intent.budgetMax,
    priceMin: extras.priceMin,
    condition:
      intent.condition && intent.condition !== "any"
        ? intent.condition
        : extras.condition,
    availableOnly: extras.availableOnly ?? true,
    pickupOnly: extras.pickupOnly,
    sourceId: extras.sourceId,
    allowComparable: extras.allowComparable ?? intent.allowComparableAlternatives !== false,
    savedOnly: extras.savedOnly,
    savedProductIds: extras.savedProductIds,
    sort: extras.sort ?? mapIntentSort(intent.sortPriority),
  };
}

function mapIntentSort(priority: SearchIntent["sortPriority"]): ResultsSort {
  switch (priority) {
    case "lowest_cost":
      return "lowest_cost";
    case "fastest_delivery":
      return "fastest";
    case "best_warranty":
      return "best_value";
    case "best_overall":
    default:
      return "best_overall";
  }
}

export const RESULTS_SORT_OPTIONS: { value: ResultsSort; label: string }[] = [
  { value: "best_overall", label: "Best overall match" },
  { value: "lowest_cost", label: "Total cost: Low to high" },
  { value: "best_rated", label: "Customer rating" },
  { value: "best_value", label: "Best value" },
  { value: "fastest", label: "Fastest delivery" },
  { value: "recently_updated", label: "Recently updated" },
];
