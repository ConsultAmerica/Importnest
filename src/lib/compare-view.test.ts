import { describe, expect, it } from "vitest";
import {
  buildRecommendationPanel,
  FALLBACK_COPY,
  formatMatchStatus,
  formatTotalKnownCost,
  hasFulfillmentSignal,
  hasStructuredProtectionData,
  hasTiedTop,
  missingInformationForListing,
  NEUTRAL_RECOMMENDATION_LABEL,
  NO_RECOMMENDATION_TEXT,
  PRIORITY_LABELS,
  SHIPPING_NOT_DISCLOSED,
  protectionDetailItems,
  protectionScore,
  sortCompareRows,
  type CompareListingView,
  type CompareRow,
} from "@/lib/compare-view";
import { FRESHNESS_STALE_MINUTES } from "@/lib/freshness";

describe("formatMatchStatus — product identity match label", () => {
  it("reads as an exact match with a confidence score", () => {
    expect(formatMatchStatus("exact", 96)).toBe("Exact match · 96%");
  });

  it("reads as a comparable product with a confidence score", () => {
    expect(formatMatchStatus("comparable", 82)).toBe("Comparable product · 82%");
  });

  it("reads as pending review when there is no confidence score at all", () => {
    expect(formatMatchStatus(undefined, null)).toBe("Match pending review");
    expect(formatMatchStatus("exact", null)).toBe("Match pending review");
  });
});

describe("protectionDetailItems — structured warranty/return facts", () => {
  it("returns nothing when no structured data was provided at all", () => {
    expect(protectionDetailItems(undefined)).toEqual([]);
  });

  it("returns nothing when the details object has no populated fields", () => {
    expect(protectionDetailItems({})).toEqual([]);
  });

  it("treats a whitespace-only value the same as not provided", () => {
    expect(protectionDetailItems({ manufacturerWarranty: "   " })).toEqual([]);
  });

  it("surfaces only the manufacturer warranty when that's the only field present", () => {
    expect(protectionDetailItems({ manufacturerWarranty: "1-year manufacturer warranty" })).toEqual([
      { label: "Manufacturer warranty", value: "1-year manufacturer warranty" },
    ]);
  });

  it("surfaces only the return period when that's the only field present", () => {
    expect(protectionDetailItems({ returnPeriod: "30-day returns" })).toEqual([
      { label: "Return period", value: "30-day returns" },
    ]);
  });

  it("surfaces both warranty and return facts together, in a fixed order", () => {
    expect(
      protectionDetailItems({
        returnPeriod: "30-day returns",
        manufacturerWarranty: "1-year manufacturer warranty",
      }),
    ).toEqual([
      { label: "Manufacturer warranty", value: "1-year manufacturer warranty" },
      { label: "Return period", value: "30-day returns" },
    ]);
  });

  it("surfaces a final-sale restriction alongside the other populated fields", () => {
    expect(
      protectionDetailItems({
        retailerWarranty: "90-day retailer warranty",
        restockingFee: "15% restocking fee",
        finalSaleRestriction: "Final sale — no returns",
      }),
    ).toEqual([
      { label: "Retailer warranty", value: "90-day retailer warranty" },
      { label: "Restocking fee", value: "15% restocking fee" },
      { label: "Final sale", value: "Final sale — no returns" },
    ]);
  });
});

function makeListing(overrides: Partial<CompareListingView> = {}): CompareListingView {
  return {
    id: "listing-1",
    sourceId: "src-1",
    sourceName: "Example Retailer",
    sourceType: "affiliate-feed",
    sourceTypeLabel: "Affiliate feed",
    hasDistinctSeller: false,
    freshnessMinutesAgo: 5,
    dataCompletenessPct: 100,
    url: "https://example.com/offer",
    isAuthorizedSource: false,
    condition: "new",
    price: 100,
    verifiedDiscount: 0,
    shipping: 0,
    mandatoryFees: 0,
    deliveryLabel: "Tomorrow",
    pickupAvailable: false,
    availabilityLabel: "Listed for shipping",
    warrantyLabel: FALLBACK_COPY.warranty,
    returnPolicyLabel: FALLBACK_COPY.returns,
    ...overrides,
  };
}

function makeRow(listingOverrides: Partial<CompareListingView> = {}): CompareRow {
  const listing = makeListing(listingOverrides);
  return {
    listing,
    recommendation: {
      listingId: listing.id,
      rank: 1,
      label: "Alternative option",
      rationale: "",
      factors: [],
      tradeOffs: [],
      missingInformation: [],
      assumptions: [],
    },
  };
}

describe("buildRecommendationPanel — stale offers excluded from definitive ranking labels", () => {
  it("assigns the definitive priority label to a fresh top offer", () => {
    const rows = [makeRow({ id: "a", price: 50, freshnessMinutesAgo: 2 }), makeRow({ id: "b", price: 80 })];
    const panel = buildRecommendationPanel(rows, "lowest-cost");
    expect(panel?.label).toBe(PRIORITY_LABELS["lowest-cost"]);
  });

  it("does not assign a definitive label when the top-ranked offer's data is stale", () => {
    const rows = [
      makeRow({ id: "a", price: 50, freshnessMinutesAgo: FRESHNESS_STALE_MINUTES }),
      makeRow({ id: "b", price: 80, freshnessMinutesAgo: 2 }),
    ];
    const panel = buildRecommendationPanel(rows, "lowest-cost");
    expect(panel?.label).toBe(NEUTRAL_RECOMMENDATION_LABEL);
    expect(panel?.label).not.toBe(PRIORITY_LABELS["lowest-cost"]);
    expect(panel?.label).not.toBe(PRIORITY_LABELS["best-overall"]);
    expect(panel?.label).not.toBe(PRIORITY_LABELS["fastest-delivery"]);
  });

  it("does not assign a definitive label when the top-ranked offer's freshness is unknown", () => {
    const rows = [makeRow({ id: "a", price: 50, freshnessMinutesAgo: null as unknown as number })];
    const panel = buildRecommendationPanel(rows, "best-overall");
    expect(panel?.label).toBe(NEUTRAL_RECOMMENDATION_LABEL);
  });
});

describe("buildRecommendationPanel — recommendation summary content", () => {
  it("lowest cost: explanation cites cost, no trade-off since it IS the cheapest", () => {
    const rows = sortCompareRows(
      [
        makeRow({ id: "cheap", price: 50, condition: "used" }),
        makeRow({ id: "pricier", price: 68, condition: "new", pickupAvailable: true }),
      ],
      "lowest-cost",
    );
    const panel = buildRecommendationPanel(rows, "lowest-cost");

    expect(panel?.label).toBe(PRIORITY_LABELS["lowest-cost"]);
    expect(panel?.listingId).toBe("cheap");
    expect(panel?.rationale).toContain(`${PRIORITY_LABELS["lowest-cost"]} because it has`);
    expect(panel?.rationale).toContain("lowest total known cost");
    expect(panel?.tradeOffLine).toBeNull();
  });

  it("fastest available: explanation cites pickup, trade-off notes the extra cost", () => {
    const rows = sortCompareRows(
      [
        makeRow({ id: "cheap-no-pickup", price: 50, condition: "used", pickupAvailable: false }),
        makeRow({ id: "pickup", price: 68, condition: "used", pickupAvailable: true }),
      ],
      "fastest-delivery",
    );
    const panel = buildRecommendationPanel(rows, "fastest-delivery");

    expect(panel?.listingId).toBe("pickup");
    expect(panel?.label).toBe(PRIORITY_LABELS["fastest-delivery"]);
    expect(panel?.rationale).toContain("faster pickup availability");
    expect(panel?.tradeOffLine).toBe(
      "It costs $18.00 more than the cheapest listing but has faster pickup availability.",
    );
  });

  it("best condition: explanation cites condition over a cheaper used listing", () => {
    const rows = sortCompareRows(
      [
        makeRow({ id: "used-cheap", price: 40, condition: "used" }),
        makeRow({ id: "new-pricier", price: 55, condition: "new" }),
      ],
      "best-condition",
    );
    const panel = buildRecommendationPanel(rows, "best-condition");

    expect(panel?.listingId).toBe("new-pricier");
    expect(panel?.label).toBe(PRIORITY_LABELS["best-condition"]);
    expect(panel?.rationale).toContain("new condition");
    expect(panel?.tradeOffLine).toContain("more than the cheapest listing");
  });

  it("tie: no reliable recommendation when the top two are indistinguishable on the active priority", () => {
    const rows = sortCompareRows(
      [makeRow({ id: "a", price: 60 }), makeRow({ id: "b", price: 60 })],
      "lowest-cost",
    );
    expect(hasTiedTop(rows, "lowest-cost")).toBe(true);
    expect(buildRecommendationPanel(rows, "lowest-cost")).toBeNull();
  });

  it("stale data: top offer still ranks first but gets a caveat, not a definitive claim", () => {
    const rows = sortCompareRows(
      [
        makeRow({ id: "stale-cheapest", price: 40, freshnessMinutesAgo: FRESHNESS_STALE_MINUTES }),
        makeRow({ id: "fresh-pricier", price: 60, freshnessMinutesAgo: 3 }),
      ],
      "lowest-cost",
    );
    const panel = buildRecommendationPanel(rows, "lowest-cost");

    expect(panel?.listingId).toBe("stale-cheapest");
    expect(panel?.label).toBe(NEUTRAL_RECOMMENDATION_LABEL);
    expect(panel?.rationale).toContain("confirm current prices");
    expect(panel?.rationale).not.toContain(`${PRIORITY_LABELS["lowest-cost"]} because`);
  });

  it("missing information: reports real data gaps without inventing values", () => {
    const rows = sortCompareRows(
      [
        makeRow({
          id: "thin-data",
          price: 50,
          url: undefined,
          deliveryLabel: FALLBACK_COPY.delivery,
          availabilityLabel: FALLBACK_COPY.availability,
        }),
        makeRow({ id: "pricier", price: 70 }),
      ],
      "lowest-cost",
    );
    const panel = buildRecommendationPanel(rows, "lowest-cost");

    expect(panel?.missingInformation).toEqual(
      expect.arrayContaining([
        "Warranty details not provided by this source",
        "Return period not provided by this source",
        "Delivery estimate not available",
        "Stock status not confirmed",
        "Direct retailer link not available",
      ]),
    );
  });
});

describe("hasTiedTop / NO_RECOMMENDATION_TEXT", () => {
  it("is not tied when the top two differ on the active priority's metric", () => {
    const rows = sortCompareRows(
      [makeRow({ id: "a", price: 50 }), makeRow({ id: "b", price: 60 })],
      "lowest-cost",
    );
    expect(hasTiedTop(rows, "lowest-cost")).toBe(false);
  });

  it("exposes the exact fallback copy to show when there's no reliable recommendation", () => {
    expect(NO_RECOMMENDATION_TEXT).toBe("No clear best option based on the available data.");
  });
});

describe("PRIORITY_LABELS — supported sort options", () => {
  it("matches the exact required set of labels", () => {
    expect(PRIORITY_LABELS).toEqual({
      "best-overall": "Best overall",
      "lowest-cost": "Lowest total cost",
      "fastest-delivery": "Fastest available",
      "best-condition": "Best condition",
      "best-protection": "Best protection",
    });
  });
});

describe("sortCompareRows — best-overall", () => {
  it("prefers a cheaper, authorized, new-condition, pickup-available offer over a plain one at the same cost", () => {
    const rows = [
      makeRow({ id: "plain", price: 100 }),
      makeRow({
        id: "loaded",
        price: 100,
        isAuthorizedSource: true,
        condition: "new",
        pickupAvailable: true,
      }),
    ];
    expect(sortCompareRows(rows, "best-overall").map((r) => r.listing.id)).toEqual([
      "loaded",
      "plain",
    ]);
  });

  it("ranks a cheaper offer above a pricier one with no other distinguishing factors", () => {
    const rows = [makeRow({ id: "pricier", price: 120 }), makeRow({ id: "cheaper", price: 80 })];
    expect(sortCompareRows(rows, "best-overall").map((r) => r.listing.id)).toEqual([
      "cheaper",
      "pricier",
    ]);
  });
});

describe("sortCompareRows — lowest-cost", () => {
  it("ranks strictly by ascending total known cost", () => {
    const rows = [
      makeRow({ id: "c", price: 90, shipping: 5, mandatoryFees: 2 }),
      makeRow({ id: "a", price: 50 }),
      makeRow({ id: "b", price: 70 }),
    ];
    expect(sortCompareRows(rows, "lowest-cost").map((r) => r.listing.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("ignores condition and authorization — cost is the only signal", () => {
    const rows = [
      makeRow({ id: "premium", price: 60, isAuthorizedSource: true, condition: "new" }),
      makeRow({ id: "budget", price: 55, isAuthorizedSource: false, condition: "used" }),
    ];
    expect(sortCompareRows(rows, "lowest-cost").map((r) => r.listing.id)).toEqual([
      "budget",
      "premium",
    ]);
  });
});

describe("sortCompareRows — fastest-delivery (pickup, then availability, then cost — never a fabricated delivery date)", () => {
  it("ranks confirmed pickup above everything else, regardless of cost", () => {
    const rows = [
      makeRow({ id: "cheap-no-pickup", price: 10, pickupAvailable: false }),
      makeRow({ id: "pricier-pickup", price: 50, pickupAvailable: true }),
    ];
    expect(sortCompareRows(rows, "fastest-delivery").map((r) => r.listing.id)).toEqual([
      "pricier-pickup",
      "cheap-no-pickup",
    ]);
  });

  it("falls back to a known availability signal when no listing has pickup", () => {
    const rows = [
      makeRow({
        id: "unknown-availability",
        price: 40,
        pickupAvailable: false,
        availabilityLabel: FALLBACK_COPY.availability,
      }),
      makeRow({
        id: "known-availability",
        price: 45,
        pickupAvailable: false,
        availabilityLabel: "Listed for shipping",
      }),
    ];
    // Known availability outranks unknown even though it costs more — the
    // only real fulfillment signal available without delivery-date data.
    expect(sortCompareRows(rows, "fastest-delivery").map((r) => r.listing.id)).toEqual([
      "known-availability",
      "unknown-availability",
    ]);
  });

  it("falls back to cost when neither pickup nor availability distinguishes the offers", () => {
    const rows = [
      makeRow({
        id: "pricier",
        price: 60,
        pickupAvailable: false,
        availabilityLabel: FALLBACK_COPY.availability,
      }),
      makeRow({
        id: "cheaper",
        price: 40,
        pickupAvailable: false,
        availabilityLabel: FALLBACK_COPY.availability,
      }),
    ];
    expect(sortCompareRows(rows, "fastest-delivery").map((r) => r.listing.id)).toEqual([
      "cheaper",
      "pricier",
    ]);
  });
});

describe("sortCompareRows — best-condition", () => {
  it("ranks new > open-box > certified-refurbished > refurbished > used", () => {
    const rows = [
      makeRow({ id: "used", condition: "used", price: 10 }),
      makeRow({ id: "new", condition: "new", price: 90 }),
      makeRow({ id: "open-box", condition: "open-box", price: 50 }),
      makeRow({ id: "refurb", condition: "refurbished", price: 40 }),
      makeRow({ id: "cert-refurb", condition: "certified-refurbished", price: 45 }),
    ];
    expect(sortCompareRows(rows, "best-condition").map((r) => r.listing.id)).toEqual([
      "new",
      "open-box",
      "cert-refurb",
      "refurb",
      "used",
    ]);
  });

  it("breaks a condition tie by lowest total known cost", () => {
    const rows = [
      makeRow({ id: "new-pricier", condition: "new", price: 100 }),
      makeRow({ id: "new-cheaper", condition: "new", price: 80 }),
    ];
    expect(sortCompareRows(rows, "best-condition").map((r) => r.listing.id)).toEqual([
      "new-cheaper",
      "new-pricier",
    ]);
  });
});

describe("sortCompareRows — best-protection (structured data only, never rewards silence)", () => {
  it("ranks a listing with a structured protection fact above one with none", () => {
    const rows = [
      makeRow({ id: "no-data", price: 50 }),
      makeRow({
        id: "has-data",
        price: 50,
        protectionDetails: { manufacturerWarranty: "1-year manufacturer warranty" },
      }),
    ];
    expect(sortCompareRows(rows, "best-protection").map((r) => r.listing.id)).toEqual([
      "has-data",
      "no-data",
    ]);
  });

  it("ranks more structured facts above fewer, all else equal", () => {
    const rows = [
      makeRow({
        id: "one-fact",
        price: 50,
        protectionDetails: { returnPeriod: "30-day returns" },
      }),
      makeRow({
        id: "three-facts",
        price: 50,
        protectionDetails: {
          manufacturerWarranty: "1-year manufacturer warranty",
          returnPeriod: "30-day returns",
          restockingFee: "No restocking fee",
        },
      }),
    ];
    expect(sortCompareRows(rows, "best-protection").map((r) => r.listing.id)).toEqual([
      "three-facts",
      "one-fact",
    ]);
  });

  it("still rewards an authorized source and new condition alongside structured data", () => {
    const rows = [
      makeRow({ id: "third-party-used", price: 50, condition: "used", isAuthorizedSource: false }),
      makeRow({ id: "authorized-new", price: 50, condition: "new", isAuthorizedSource: true }),
    ];
    expect(sortCompareRows(rows, "best-protection").map((r) => r.listing.id)).toEqual([
      "authorized-new",
      "third-party-used",
    ]);
  });
});

describe("sortCompareRows — deterministic tie-breaking", () => {
  const priorities = [
    "best-overall",
    "lowest-cost",
    "fastest-delivery",
    "best-condition",
    "best-protection",
  ] as const;

  it("breaks a total tie by listing id, the same way regardless of the input array's original order", () => {
    const a = makeRow({ id: "b-listing", price: 50 });
    const b = makeRow({ id: "a-listing", price: 50 });

    for (const priority of priorities) {
      expect(sortCompareRows([a, b], priority).map((r) => r.listing.id)).toEqual([
        "a-listing",
        "b-listing",
      ]);
      expect(sortCompareRows([b, a], priority).map((r) => r.listing.id)).toEqual([
        "a-listing",
        "b-listing",
      ]);
    }
  });

  it("produces the same order regardless of how the input rows were shuffled", () => {
    const rows = [
      makeRow({ id: "z", price: 60 }),
      makeRow({ id: "y", price: 60 }),
      makeRow({ id: "x", price: 60 }),
    ];
    const shuffled = [rows[2]!, rows[0]!, rows[1]!];

    expect(sortCompareRows(shuffled, "lowest-cost").map((r) => r.listing.id)).toEqual(
      sortCompareRows(rows, "lowest-cost").map((r) => r.listing.id),
    );
    expect(sortCompareRows(rows, "lowest-cost").map((r) => r.listing.id)).toEqual(["x", "y", "z"]);
  });
});

describe("protectionScore — driven only by structured data, never by silence", () => {
  it("scores zero for an unauthorized, used listing with no structured protection data", () => {
    expect(protectionScore(makeListing({ condition: "used", isAuthorizedSource: false }))).toBe(0);
  });

  it("adds 10 points per structured protection fact supplied", () => {
    const oneFact = protectionScore(
      makeListing({ condition: "used", protectionDetails: { returnPeriod: "30-day returns" } }),
    );
    const twoFacts = protectionScore(
      makeListing({
        condition: "used",
        protectionDetails: { returnPeriod: "30-day returns", restockingFee: "0%" },
      }),
    );
    expect(twoFacts - oneFact).toBe(10);
  });
});

describe("hasStructuredProtectionData — gates whether Best protection is offered at all", () => {
  it("is false when no compared listing has any structured protection fact", () => {
    expect(hasStructuredProtectionData([makeListing({ id: "a" }), makeListing({ id: "b" })])).toBe(
      false,
    );
  });

  it("is true when at least one compared listing has a structured protection fact", () => {
    expect(
      hasStructuredProtectionData([
        makeListing({ id: "a" }),
        makeListing({ id: "b", protectionDetails: { returnPeriod: "30-day returns" } }),
      ]),
    ).toBe(true);
  });
});

describe("hasFulfillmentSignal — fallback signals for Fastest available, no delivery-date claims", () => {
  it("is true for confirmed pickup", () => {
    expect(
      hasFulfillmentSignal(
        makeListing({ pickupAvailable: true, availabilityLabel: FALLBACK_COPY.availability }),
      ),
    ).toBe(true);
  });

  it("is true for a known, non-fallback availability status even without pickup", () => {
    expect(
      hasFulfillmentSignal(
        makeListing({ pickupAvailable: false, availabilityLabel: "Listed for shipping" }),
      ),
    ).toBe(true);
  });

  it("is false when neither pickup nor a known availability status exists", () => {
    expect(
      hasFulfillmentSignal(
        makeListing({ pickupAvailable: false, availabilityLabel: FALLBACK_COPY.availability }),
      ),
    ).toBe(false);
  });
});

describe("undisclosed shipping", () => {
  it("formats a floor and records the gap", () => {
    const listing = makeListing({ price: 40, verifiedDiscount: 0, shipping: null, mandatoryFees: 2 });
    expect(formatTotalKnownCost(listing)).toBe("from $42.00, shipping not disclosed");
    expect(missingInformationForListing(listing)).toContain(SHIPPING_NOT_DISCLOSED);
  });

  it("keeps a disclosed free-shipping total as a complete price", () => {
    const listing = makeListing({ price: 40, verifiedDiscount: 0, shipping: 0, mandatoryFees: 2 });
    expect(formatTotalKnownCost(listing)).toBe("$42.00");
    expect(missingInformationForListing(listing)).not.toContain(SHIPPING_NOT_DISCLOSED);
  });
});
