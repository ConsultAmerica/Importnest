import { prisma } from "@/lib/prisma";
import type {
  CompareListingView,
  CompareRecommendationView,
  CompareRow,
  CompareSourceSummary,
} from "@/lib/compare-view";
import {
  FALLBACK_COPY,
  buildRecommendationPanel,
  hasStructuredProtectionData,
  isSafeRetailerUrl,
  minutesSince,
  missingInformationForListing,
  rankingFactorsForListing,
  sortCompareRows,
  totalKnownCost,
} from "@/lib/compare-view";
import type { Priority } from "@/lib/types";
import {
  PRICE_HISTORY_WINDOW_DAYS,
  emptyPriceHistory,
  summarizePriceHistory,
  type ProductPriceHistoryPoint,
  type ProductPriceHistorySummary,
} from "@/lib/price-history";

export type { CompareListingView, CompareRecommendationView, CompareRow, CompareSourceSummary };
export type { ProductPriceHistoryPoint, ProductPriceHistorySummary };
export {
  describePriceHistoryForScreenReaders,
  summarizePriceHistory,
} from "@/lib/price-history";
export {
  FALLBACK_COPY,
  totalKnownCost,
  formatTotalKnownCost,
  sortCompareRows,
  minutesSince,
  isSafeRetailerUrl,
  formatFreshness,
  formatConditionLabel,
  PRIORITY_LABELS,
  buildRecommendationPanel,
} from "@/lib/compare-view";

const AUTHORIZED_SOURCE_TYPES = new Set(["manufacturer-feed", "official-api"]);

type ListingRecord = {
  id: string;
  sourceId: string;
  condition: string;
  price: number;
  shipping: number | null;
  fees: number;
  deliveryLabel: string | null;
  sellerName: string | null;
  url: string | null;
  freshnessCapturedAt: Date;
  source: { name: string; sourceType: string };
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  "manufacturer-feed": "Manufacturer feed",
  "affiliate-feed": "Affiliate feed",
  "official-api": "Official API",
  "partner-feed": "Partner feed",
  "licensed-provider": "Licensed provider",
  "web-extraction": "Web extraction",
  "retailer-api": "Retailer API",
};

function sourceTypeLabel(sourceType: string) {
  return SOURCE_TYPE_LABELS[sourceType] ?? sourceType.replace(/-/g, " ");
}

function enrichListing(l: ListingRecord): CompareListingView {
  const deliveryLabel = l.deliveryLabel?.trim() || FALLBACK_COPY.delivery;
  const sellerName = l.sellerName?.trim();
  const hasDistinctSeller = Boolean(sellerName) && sellerName !== l.source.name;
  const pickupAvailable = /pickup/i.test(deliveryLabel);
  const safeUrl = isSafeRetailerUrl(l.url) ? (l.url as string) : undefined;

  const view: CompareListingView = {
    id: l.id,
    sourceId: l.sourceId,
    sourceName: sellerName || l.source.name || FALLBACK_COPY.retailer,
    sourceType: l.source.sourceType,
    sourceTypeLabel: hasDistinctSeller ? "" : sourceTypeLabel(l.source.sourceType),
    hasDistinctSeller,
    freshnessMinutesAgo: minutesSince(l.freshnessCapturedAt),
    dataCompletenessPct: 0,
    url: safeUrl,
    isAuthorizedSource: !hasDistinctSeller && AUTHORIZED_SOURCE_TYPES.has(l.source.sourceType),
    condition: l.condition || FALLBACK_COPY.condition,
    price: l.price,
    verifiedDiscount: 0,
    shipping: l.shipping,
    mandatoryFees: l.fees,
    deliveryLabel,
    pickupAvailable,
    availabilityLabel: pickupAvailable
      ? "Pickup available"
      : deliveryLabel !== FALLBACK_COPY.delivery
        ? "Listed for shipping"
        : FALLBACK_COPY.availability,
    warrantyLabel: FALLBACK_COPY.warranty,
    returnPolicyLabel: FALLBACK_COPY.returns,
  };

  view.dataCompletenessPct = listingCompleteness(view);
  return view;
}

/** Wraps sortCompareRows so listing ordering has exactly one implementation, reused server-side everywhere. */
function sortListings(listings: CompareListingView[], priority: Priority): CompareListingView[] {
  const wrapped: CompareRow[] = listings.map((listing) => ({
    listing,
    recommendation: {
      listingId: listing.id,
      rank: 0,
      label: "Alternative option",
      rationale: "",
      factors: [],
      tradeOffs: [],
      missingInformation: [],
      assumptions: [],
    },
  }));
  return sortCompareRows(wrapped, priority).map((r) => r.listing);
}

function computeRecommendations(
  listings: CompareListingView[],
  priority: Priority = "best-overall",
): Map<string, CompareRecommendationView> {
  const ranked = sortListings(listings, priority);

  const map = new Map<string, CompareRecommendationView>();
  const draftRows: CompareRow[] = ranked.map((listing, index) => ({
    listing,
    recommendation: {
      listingId: listing.id,
      rank: index + 1,
      label: "Alternative option",
      rationale: "",
      factors: [],
      tradeOffs: [],
      missingInformation: [],
      assumptions: [],
    },
  }));

  const panel = buildRecommendationPanel(draftRows, priority);

  ranked.forEach((listing, index) => {
    const isBest = index === 0;
    const { positive, tradeOffs } = rankingFactorsForListing(listing, ranked, priority);
    const cost = totalKnownCost(listing);
    const bestCost = ranked[0] ? totalKnownCost(ranked[0]) : cost;
    const costDelta = cost - bestCost;
    const missingInformation = missingInformationForListing(listing);

    map.set(listing.id, {
      listingId: listing.id,
      rank: index + 1,
      label: isBest && panel ? panel.label : "Alternative option",
      rationale:
        isBest && panel
          ? panel.rationale
          : `$${costDelta.toFixed(2)} more than the top-ranked option for this priority.`,
      tradeOff: isBest
        ? tradeOffs[0]?.detail
        : `This option costs $${costDelta.toFixed(2)} more than the top-ranked listing for this priority.`,
      factors: [...positive, ...tradeOffs],
      tradeOffs,
      missingInformation,
      assumptions: [
        "Price excludes local sales tax.",
        ...(listing.pickupAvailable ? ["Pickup availability confirmed at last sync."] : []),
      ],
    });
  });

  return map;
}

export function listingCompleteness(listing: CompareListingView): number {
  const checks = [
    listing.sourceName !== FALLBACK_COPY.retailer,
    listing.condition !== FALLBACK_COPY.condition,
    listing.deliveryLabel !== FALLBACK_COPY.delivery,
    listing.availabilityLabel !== FALLBACK_COPY.availability,
    listing.warrantyLabel !== FALLBACK_COPY.warranty,
    listing.returnPolicyLabel !== FALLBACK_COPY.returns,
    Boolean(listing.url),
    listing.shipping != null,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export async function getCompareProduct(productId: string) {
  return prisma.canonicalProduct.findUnique({
    where: { id: productId },
    include: {
      brand: true,
      category: true,
      matches: {
        where: { status: "approved" },
        orderBy: { confidence: "desc" },
        take: 1,
      },
    },
  });
}

async function getMatchedListings(productId: string): Promise<ListingRecord[]> {
  return prisma.listing.findMany({
    where: {
      canonicalProductId: productId,
      matches: { some: { status: "approved" } },
    },
    include: { source: true },
  });
}

/**
 * Whether "Best protection" is a meaningful sort for this product — i.e. at
 * least one compared listing has a real structured warranty/return fact.
 * Callers should hide or disable the priority option entirely when this is
 * false rather than sort by a signal nothing actually has.
 */
export async function supportsBestProtection(productId: string): Promise<boolean> {
  const listings = (await getMatchedListings(productId)).map(enrichListing);
  return hasStructuredProtectionData(listings);
}

export type CompareFilters = {
  maxBudget?: number;
  condition?: "new" | "open_box" | "refurbished" | "used";
  requireFastDelivery?: boolean;
};

function conditionMatchesFilter(
  listingCondition: string,
  filter: CompareFilters["condition"],
): boolean {
  if (!filter) return true;
  if (filter === "open_box") return listingCondition === "open-box";
  if (filter === "refurbished") {
    return listingCondition === "refurbished" || listingCondition === "certified-refurbished";
  }
  return listingCondition === filter;
}

export async function getCompareRows(
  productId: string,
  filters?: CompareFilters,
  priority?: Priority,
): Promise<CompareRow[]> {
  const allListings = (await getMatchedListings(productId)).map(enrichListing);
  const listings = filters
    ? allListings.filter(
        (l) =>
          (filters.maxBudget == null || totalKnownCost(l) <= filters.maxBudget) &&
          conditionMatchesFilter(l.condition, filters.condition) &&
          (!filters.requireFastDelivery || l.pickupAvailable),
      )
    : allListings;

  const recommendations = computeRecommendations(listings, priority);

  return listings
    .map((listing) => ({
      listing,
      recommendation: recommendations.get(listing.id)!,
    }))
    .sort((a, b) => a.recommendation.rank - b.recommendation.rank);
}

export async function getProductSourceSummaries(
  productId: string,
): Promise<CompareSourceSummary[]> {
  const listings = await prisma.listing.findMany({
    where: {
      canonicalProductId: productId,
      matches: { some: { status: "approved" } },
    },
    include: { source: true },
    orderBy: { freshnessCapturedAt: "desc" },
  });

  const bySource = new Map<string, CompareSourceSummary>();

  for (const listing of listings) {
    const existing = bySource.get(listing.sourceId);
    const freshness = minutesSince(listing.freshnessCapturedAt);

    if (!existing) {
      bySource.set(listing.sourceId, {
        sourceId: listing.sourceId,
        sourceName: listing.source.name,
        sourceTypeLabel: sourceTypeLabel(listing.source.sourceType),
        listingCount: 1,
        freshnessMinutesAgo: freshness,
      });
      continue;
    }

    existing.listingCount += 1;
    if (existing.freshnessMinutesAgo == null || freshness < existing.freshnessMinutesAgo) {
      existing.freshnessMinutesAgo = freshness;
    }
  }

  return [...bySource.values()].sort((a, b) => a.sourceName.localeCompare(b.sourceName));
}

export async function getListingExplanation(listingId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { source: true },
  });
  if (!listing || !listing.canonicalProductId) return null;

  const siblings = await getMatchedListings(listing.canonicalProductId);
  const enriched = siblings.map(enrichListing);
  const recommendations = computeRecommendations(enriched);

  const view = enriched.find((l) => l.id === listingId);
  const recommendation = recommendations.get(listingId);
  if (!view || !recommendation) return null;

  return {
    listing: view,
    recommendation,
    freshnessMinutesAgo: minutesSince(listing.freshnessCapturedAt),
  };
}

/**
 * Builds a daily price-history summary from real PriceHistory rows only —
 * no fabricated or interpolated points, ever. A product with fewer than two
 * real, in-window daily prices simply has no chart yet (see
 * summarizePriceHistory for the full exclusion rules).
 */
export async function getProductPriceHistory(
  productId: string,
  currentLowest: number | null,
): Promise<ProductPriceHistorySummary> {
  const listings = await prisma.listing.findMany({
    where: {
      canonicalProductId: productId,
      matches: { some: { status: "approved" } },
    },
    select: { id: true },
  });
  const listingIds = listings.map((l) => l.id);
  if (listingIds.length === 0) {
    return emptyPriceHistory(currentLowest);
  }

  const windowStart = new Date(Date.now() - PRICE_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.priceHistory.findMany({
    where: { listingId: { in: listingIds }, capturedAt: { gte: windowStart } },
    select: { price: true, shipping: true, capturedAt: true },
    orderBy: { capturedAt: "asc" },
  });

  return summarizePriceHistory(rows, currentLowest);
}
