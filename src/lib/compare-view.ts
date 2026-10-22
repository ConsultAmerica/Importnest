import { isFreshnessStale } from "@/lib/freshness";
import type { Priority } from "@/lib/types";

export { formatFreshness, isFreshnessStale, FRESHNESS_STALE_MINUTES } from "@/lib/freshness";
export { isFreshnessStale as isStaleFreshness } from "@/lib/freshness";

export const FALLBACK_COPY = {
  warranty: "Warranty information not provided",
  returns: "Return policy not provided",
  delivery: "Delivery estimate unavailable",
  condition: "Condition not specified",
  retailer: "Unknown retailer",
  availability: "Stock status not provided",
} as const;

/**
 * Structured warranty/return facts for one listing. Every field is optional
 * because sources rarely provide all of them — only render what's present,
 * never fabricate a value for a field the source didn't supply.
 */
export type ProtectionDetails = {
  manufacturerWarranty?: string;
  retailerWarranty?: string;
  returnPeriod?: string;
  restockingFee?: string;
  finalSaleRestriction?: string;
};

export type CompareListingView = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  sourceTypeLabel: string;
  /** True when this listing's real merchant (sellerName) differs from the
   *  connector/feed it was synced through — e.g. a UPC-lookup connector
   *  surfacing a Newegg or Best Buy offer. The connector's own sourceType
   *  ("manufacturer-feed", icon, etc.) describes the feed, not that merchant,
   *  so callers should avoid presenting feed-level metadata as if it were
   *  retailer-level metadata when this is true. */
  hasDistinctSeller: boolean;
  freshnessMinutesAgo: number;
  dataCompletenessPct: number;
  /** Present only when the retailer URL is a valid http(s) link. */
  url?: string;
  isAuthorizedSource: boolean;
  condition: string;
  price: number;
  verifiedDiscount: number;
  shipping: number | null;
  mandatoryFees: number;
  deliveryLabel: string;
  pickupAvailable: boolean;
  /** Honest stock signal — no fabricated “in stock” without inventory data. */
  availabilityLabel: string;
  warrantyLabel: string;
  returnPolicyLabel: string;
  /** Present only when the source supplied at least one structured protection fact. */
  protectionDetails?: ProtectionDetails;
};

/** Compact stand-in for the old "Warranty information not provided · Return policy not provided" copy. */
export const PROTECTION_UNAVAILABLE_LABEL = "Protection details unavailable";
export const PROTECTION_UNAVAILABLE_DETAIL =
  "This source did not provide structured warranty or return information.";
export const PROTECTION_AVAILABLE_LABEL = "Protection details";

const PROTECTION_DETAIL_FIELDS: { key: keyof ProtectionDetails; label: string }[] = [
  { key: "manufacturerWarranty", label: "Manufacturer warranty" },
  { key: "retailerWarranty", label: "Retailer warranty" },
  { key: "returnPeriod", label: "Return period" },
  { key: "restockingFee", label: "Restocking fee" },
  { key: "finalSaleRestriction", label: "Final sale" },
];

/**
 * Only the protection facts this source actually supplied, in a fixed
 * display order. Empty/whitespace-only values are treated as not provided —
 * never invents a value for a field the source left out.
 */
export function protectionDetailItems(
  details: ProtectionDetails | undefined,
): { label: string; value: string }[] {
  if (!details) return [];
  return PROTECTION_DETAIL_FIELDS.flatMap(({ key, label }) => {
    const value = details[key]?.trim();
    return value ? [{ label, value }] : [];
  });
}

export type CompareSourceSummary = {
  sourceId: string;
  sourceName: string;
  sourceTypeLabel: string;
  listingCount: number;
  freshnessMinutesAgo: number | null;
};

export type RankingFactor = {
  label: string;
  detail: string;
  positive: boolean;
};

export type CompareRecommendationView = {
  listingId: string;
  rank: number;
  label: string;
  rationale: string;
  tradeOff?: string;
  factors: RankingFactor[];
  /** Explicit trade-off rows for the recommendation panel */
  tradeOffs: RankingFactor[];
  /** Fields where we only have fallbacks / no retailer link */
  missingInformation: string[];
  assumptions: string[];
};

export type CompareRow = {
  listing: CompareListingView;
  recommendation: CompareRecommendationView;
};

export type RecommendationPanelModel = {
  label: string;
  rationale: string;
  /** One short trade-off sentence versus the cheapest compared offer; null when this offer is the cheapest. */
  tradeOffLine: string | null;
  retailerName: string;
  listingId: string;
  totalKnownCost: number;
  /** False when the total is a floor because shipping was not disclosed. */
  shippingDisclosed: boolean;
  positiveFactors: RankingFactor[];
  tradeOffs: RankingFactor[];
  missingInformation: string[];
  lastCheckedMinutesAgo: number;
  assumptions: string[];
};

export const SHIPPING_NOT_DISCLOSED = "Shipping cost not disclosed by this source";

/** True only for a real disclosed amount, including 0 for free shipping. */
export function hasDisclosedShipping(shipping: number | null | undefined): shipping is number {
  return typeof shipping === "number" && Number.isFinite(shipping) && shipping >= 0;
}

export function totalKnownCost(listing: {
  price: number;
  verifiedDiscount: number;
  shipping: number | null;
  mandatoryFees: number;
}) {
  const shipping = hasDisclosedShipping(listing.shipping) ? listing.shipping : 0;
  return listing.price - listing.verifiedDiscount + shipping + listing.mandatoryFees;
}

/**
 * Complete totals render as "$X". Undisclosed shipping renders as a floor so
 * the missing cost is visible instead of looking free.
 */
export function formatTotalKnownCost(listing: {
  price: number;
  verifiedDiscount: number;
  shipping: number | null;
  mandatoryFees: number;
}) {
  const amount = `$${totalKnownCost(listing).toFixed(2)}`;
  return hasDisclosedShipping(listing.shipping) ? amount : `from ${amount}, shipping not disclosed`;
}

/** Item + disclosed shipping + fees. Undisclosed shipping is left out of the sum. */
export function knownOfferTotal(
  price: number,
  shipping: number | null | undefined,
  fees: number | null | undefined,
) {
  const fee = typeof fees === "number" && Number.isFinite(fees) && fees >= 0 ? fees : 0;
  return price + (hasDisclosedShipping(shipping) ? shipping : 0) + fee;
}

/** Prefer new → open-box → refurbished → used. Lower is better. */
export function conditionRank(condition: string): number {
  switch (condition) {
    case "new":
      return 0;
    case "open-box":
      return 1;
    case "certified-refurbished":
      return 2;
    case "refurbished":
      return 3;
    case "used":
      return 4;
    default:
      return 5;
  }
}

/**
 * Buyer-protection proxy from real fields only: authorized channel,
 * condition, and how many structured protection facts (manufacturer/retailer
 * warranty, return period, restocking fee, final-sale restriction) the
 * source actually supplied. Never rewards a source for silence.
 */
export function protectionScore(listing: CompareListingView): number {
  let score = 0;
  if (listing.isAuthorizedSource) score += 40;
  if (listing.condition === "new") score += 20;
  else if (listing.condition === "open-box") score += 8;
  score += protectionDetailItems(listing.protectionDetails).length * 10;
  return score;
}

/** True when at least one compared listing has any structured protection fact. */
export function hasStructuredProtectionData(listings: CompareListingView[]): boolean {
  return listings.some((l) => protectionDetailItems(l.protectionDetails).length > 0);
}

export function isSafeRetailerUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function formatConditionLabel(condition: string): string {
  switch (condition) {
    case "new":
      return "New";
    case "open-box":
      return "Open-box";
    case "refurbished":
    case "certified-refurbished":
      return "Refurbished";
    case "used":
      return "Used";
    default:
      return condition.replace(/-/g, " ");
  }
}

/**
 * Product-identity match-status badge text. No confidence score at all means
 * the match hasn't been reviewed yet; otherwise only an explicit "comparable"
 * type reads as a comparable product — anything else with a real confidence
 * score (including the historical default before `type` was tracked) reads
 * as an exact match.
 */
export function formatMatchStatus(
  matchType: "exact" | "comparable" | string | null | undefined,
  confidencePct: number | null | undefined,
): string {
  if (confidencePct == null) return "Match pending review";
  const label = matchType === "comparable" ? "Comparable product" : "Exact match";
  return `${label} · ${confidencePct}%`;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  "best-overall": "Best overall",
  "lowest-cost": "Lowest total cost",
  "fastest-delivery": "Fastest available",
  "best-condition": "Best condition",
  "best-protection": "Best protection",
};

export function overallScore(listing: CompareListingView): number {
  let s = -totalKnownCost(listing);
  if (listing.isAuthorizedSource) s += 15;
  if (listing.condition === "new") s += 8;
  if (listing.pickupAvailable) s += 5;
  return s;
}

/**
 * True when a listing carries any real fulfillment signal at all — pickup or
 * a known (non-fallback) availability status. There is no delivery-date
 * field in this data model, so "fastest available" ranks and labels itself
 * from these proxies only; it never claims a specific delivery speed.
 */
export function hasFulfillmentSignal(listing: CompareListingView): boolean {
  return listing.pickupAvailable || listing.availabilityLabel !== FALLBACK_COPY.availability;
}

/** Final tiebreaker shared by every priority so equal-ranked rows still sort deterministically. */
function idTiebreak(a: CompareListingView, b: CompareListingView): number {
  return a.id.localeCompare(b.id);
}

export function sortCompareRows(rows: CompareRow[], priority: Priority): CompareRow[] {
  const copy = [...rows];
  switch (priority) {
    case "lowest-cost":
      return copy.sort(
        (a, b) =>
          totalKnownCost(a.listing) - totalKnownCost(b.listing) || idTiebreak(a.listing, b.listing),
      );
    case "fastest-delivery":
      return copy.sort((a, b) => {
        const pickup = Number(b.listing.pickupAvailable) - Number(a.listing.pickupAvailable);
        if (pickup !== 0) return pickup;
        // No listing has confirmed pickup here — fall back to any known availability signal.
        const availability =
          Number(hasFulfillmentSignal(b.listing)) - Number(hasFulfillmentSignal(a.listing));
        if (availability !== 0) return availability;
        return (
          totalKnownCost(a.listing) - totalKnownCost(b.listing) || idTiebreak(a.listing, b.listing)
        );
      });
    case "best-condition":
      return copy.sort((a, b) => {
        const c = conditionRank(a.listing.condition) - conditionRank(b.listing.condition);
        if (c !== 0) return c;
        return (
          totalKnownCost(a.listing) - totalKnownCost(b.listing) || idTiebreak(a.listing, b.listing)
        );
      });
    case "best-protection":
      return copy.sort((a, b) => {
        const pa = protectionScore(a.listing);
        const pb = protectionScore(b.listing);
        if (pb !== pa) return pb - pa;
        return (
          totalKnownCost(a.listing) - totalKnownCost(b.listing) || idTiebreak(a.listing, b.listing)
        );
      });
    case "best-overall":
    default:
      return copy.sort(
        (a, b) => overallScore(b.listing) - overallScore(a.listing) || idTiebreak(a.listing, b.listing),
      );
  }
}

/**
 * Fields where display would rely on shared fallbacks or missing retailer data.
 * Never invents values — only reports gaps.
 */
export function missingInformationForListing(listing: CompareListingView): string[] {
  const missing: string[] = [];
  if (listing.warrantyLabel === FALLBACK_COPY.warranty) {
    missing.push("Warranty details not provided by this source");
  }
  if (listing.returnPolicyLabel === FALLBACK_COPY.returns) {
    missing.push("Return period not provided by this source");
  }
  if (listing.deliveryLabel === FALLBACK_COPY.delivery) {
    missing.push("Delivery estimate not available");
  }
  if (listing.availabilityLabel === FALLBACK_COPY.availability) {
    missing.push("Stock status not confirmed");
  }
  if (!listing.url) {
    missing.push("Direct retailer link not available");
  }
  if (!hasDisclosedShipping(listing.shipping)) {
    missing.push(SHIPPING_NOT_DISCLOSED);
  }
  return missing;
}

/**
 * Ranking factors derived only from listing fields present in the compare set.
 * Used by both the server recommendation objects and the client priority panel.
 */
export function rankingFactorsForListing(
  listing: CompareListingView,
  peers: CompareListingView[],
  priority: Priority,
): { positive: RankingFactor[]; tradeOffs: RankingFactor[] } {
  const cost = totalKnownCost(listing);
  const peerCosts = peers.map((p) => ({ id: p.id, cost: totalKnownCost(p), listing: p }));
  const lowest = [...peerCosts].sort((a, b) => a.cost - b.cost)[0];
  const isLowestCost = lowest?.id === listing.id;
  const anyPickup = peers.some((p) => p.pickupAvailable);
  const bestCond = Math.min(...peers.map((p) => conditionRank(p.condition)));
  const positive: RankingFactor[] = [];
  const tradeOffs: RankingFactor[] = [];

  if (!hasDisclosedShipping(listing.shipping)) {
    tradeOffs.push({
      label: "Shipping not disclosed",
      detail: `Known costs start at $${cost.toFixed(2)} before shipping.`,
      positive: false,
    });
  } else if (isLowestCost) {
    positive.push({
      label: "Lowest total known cost",
      detail: `$${cost.toFixed(2)} is the lowest among compared offers.`,
      positive: true,
    });
  } else if (lowest) {
    const delta = cost - lowest.cost;
    tradeOffs.push({
      label: "Not the lowest total cost",
      detail: `$${delta.toFixed(2)} more than ${lowest.listing.sourceName} ($${lowest.cost.toFixed(2)}).`,
      positive: false,
    });
  }

  if (listing.condition === "new") {
    positive.push({
      label: "New condition",
      detail: "Listed as new among compared offers.",
      positive: true,
    });
  } else {
    tradeOffs.push({
      label: `${formatConditionLabel(listing.condition)} condition`,
      detail: "Not new — price may reflect condition rather than a discount.",
      positive: false,
    });
  }

  if (listing.pickupAvailable) {
    positive.push({
      label: "Faster pickup availability",
      detail:
        listing.deliveryLabel !== FALLBACK_COPY.delivery
          ? listing.deliveryLabel
          : "Local pickup can avoid shipping wait.",
      positive: true,
    });
  } else if (anyPickup) {
    tradeOffs.push({
      label: "No pickup option",
      detail: "Other compared offers offer pickup; this one is ship-only or unknown.",
      positive: false,
    });
  }

  if (listing.isAuthorizedSource) {
    positive.push({
      label: "Authorized or official source",
      detail: "Sold through an authorized or manufacturer channel.",
      positive: true,
    });
  }

  if (listing.warrantyLabel !== FALLBACK_COPY.warranty) {
    positive.push({
      label: "Warranty details provided",
      detail: listing.warrantyLabel,
      positive: true,
    });
  }

  if (listing.returnPolicyLabel !== FALLBACK_COPY.returns) {
    positive.push({
      label: "Return period provided",
      detail: listing.returnPolicyLabel,
      positive: true,
    });
  }

  if (priority === "best-condition" && conditionRank(listing.condition) === bestCond) {
    if (!positive.some((f) => f.label === "New condition" || f.label.includes("condition"))) {
      positive.unshift({
        label: "Best available condition",
        detail: `${formatConditionLabel(listing.condition)} ranks best among compared offers.`,
        positive: true,
      });
    }
  }

  if (priority === "best-protection" && listing.isAuthorizedSource) {
    positive.sort((a, b) => {
      if (a.label.startsWith("Authorized")) return -1;
      if (b.label.startsWith("Authorized")) return 1;
      return 0;
    });
  }

  return { positive, tradeOffs };
}

function joinClause(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/**
 * Neutral stand-in for a definitive ranking label ("Best overall", "Lowest
 * cost", "Fastest available", ...) when the top-ranked listing's own data is
 * stale or of unknown age. A ranking claim is only as trustworthy as the data
 * it was computed from.
 */
export const NEUTRAL_RECOMMENDATION_LABEL = "Available option";

export const NO_RECOMMENDATION_TEXT = "No clear best option based on the available data.";

/** The value a priority actually sorts on — used to detect a genuine tie for the top spot. */
function priorityComparisonKey(listing: CompareListingView, priority: Priority): string {
  switch (priority) {
    case "lowest-cost":
      return String(totalKnownCost(listing));
    case "fastest-delivery":
      return `${listing.pickupAvailable ? 1 : 0}:${hasFulfillmentSignal(listing) ? 1 : 0}:${totalKnownCost(listing)}`;
    case "best-condition":
      return String(conditionRank(listing.condition));
    case "best-protection":
      return String(protectionScore(listing));
    case "best-overall":
    default:
      return String(overallScore(listing));
  }
}

/**
 * True when the top two sorted rows are indistinguishable on the metric this
 * priority actually ranks by — i.e. there's no honest way to call one of them
 * "the" best, so the caller should show "No clear best option" rather than
 * an arbitrary pick.
 */
export function hasTiedTop(sortedRows: CompareRow[], priority: Priority): boolean {
  if (sortedRows.length < 2) return false;
  const [first, second] = sortedRows;
  return (
    priorityComparisonKey(first.listing, priority) === priorityComparisonKey(second.listing, priority)
  );
}

/**
 * Builds the recommendation panel model for the top listing after a priority sort.
 * Explanation text is assembled only from ranking factors backed by listing data.
 * Returns null when there's nothing to rank, or the top spot is a genuine tie
 * (callers should show NO_RECOMMENDATION_TEXT in that case).
 */
export function buildRecommendationPanel(
  sortedRows: CompareRow[],
  priority: Priority,
): RecommendationPanelModel | null {
  const top = sortedRows[0];
  if (!top) return null;
  if (hasTiedTop(sortedRows, priority)) return null;

  const peers = sortedRows.map((r) => r.listing);
  const { positive, tradeOffs } = rankingFactorsForListing(top.listing, peers, priority);
  const cappedPositive = positive.slice(0, 3);
  const missingInformation = missingInformationForListing(top.listing);
  // Don't claim "Fastest available" when no listing has real pickup/availability signal.
  const anyFulfillmentSignal = peers.some((p) => hasFulfillmentSignal(p));
  const definitiveLabel =
    priority === "fastest-delivery" && !anyFulfillmentSignal
      ? PRIORITY_LABELS["best-overall"]
      : PRIORITY_LABELS[priority];
  // Stale/unknown-age data doesn't get to claim a definitive ranking label.
  const dataIsStale = isFreshnessStale(top.listing.freshnessMinutesAgo);
  const label = dataIsStale ? NEUTRAL_RECOMMENDATION_LABEL : definitiveLabel;
  const anyPeerStale = peers.some((p) => isFreshnessStale(p.freshnessMinutesAgo));
  const freshQualifier = !dataIsStale && anyPeerStale ? " among the fresh offers compared" : "";
  const reasons = cappedPositive.map((f) => f.label.toLowerCase());
  const rationale = dataIsStale
    ? "This offer ranks first for this priority. Pricing was last synced a while ago — confirm current prices if you are about to buy."
    : reasons.length > 0
      ? `${label} because it has ${joinClause(reasons)}${freshQualifier}.`
      : `${label} — ranks first among the compared options.`;

  const cheapestCost = Math.min(...peers.map((p) => totalKnownCost(p)));
  const costDelta = totalKnownCost(top.listing) - cheapestCost;
  const counterReason = cappedPositive[0]?.label.toLowerCase();
  const tradeOffLine =
    costDelta > 0.004
      ? counterReason
        ? `It costs $${costDelta.toFixed(2)} more than the cheapest listing but has ${counterReason}.`
        : `It costs $${costDelta.toFixed(2)} more than the cheapest listing.`
      : null;

  return {
    label,
    rationale,
    tradeOffLine,
    retailerName: top.listing.sourceName,
    listingId: top.listing.id,
    totalKnownCost: totalKnownCost(top.listing),
    shippingDisclosed: hasDisclosedShipping(top.listing.shipping),
    positiveFactors: cappedPositive,
    tradeOffs,
    missingInformation,
    lastCheckedMinutesAgo: top.listing.freshnessMinutesAgo,
    assumptions: [
      "Price excludes local sales tax.",
      ...(top.listing.pickupAvailable ? ["Pickup availability confirmed at last sync."] : []),
    ],
  };
}

export function minutesSince(date: Date) {
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
}
