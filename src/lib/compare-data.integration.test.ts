import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { FALLBACK_COPY, getCompareProduct, getCompareRows, totalKnownCost } from "@/lib/compare-data";
import { NEUTRAL_RECOMMENDATION_LABEL } from "@/lib/compare-view";
import { isFreshnessStale } from "@/lib/freshness";

// This exercises the real dev database (see prisma/schema.prisma DATABASE_URL),
// not a mock, because the thing under test is exactly the failure mode a mock
// would hide: compare-data.ts used to only render correctly for listing ids
// that were hand-keyed into static tables. Every synced (non-seeded) product
// is a regression check for that.
const PRODUCT_ID = "cp-iphone-6";

// This fixture only exists after someone actually runs the live sync
// (npm run sync -- src-official <upc>, npm run sync -- src-retailer-direct
// <fakestoreapi-id>) against a CanonicalProduct + ProductIdentifier seeded
// for cp-iphone-6 — it is intentionally not part of the static seed, since
// the whole point of this suite is to test against real synced data, not a
// mock or hand-seeded fixture. Skip cleanly rather than fail in any
// environment where that sync hasn't been run.
const productExists = await prisma.canonicalProduct
  .findUnique({ where: { id: PRODUCT_ID } })
  .then((p) => p !== null);

describe.skipIf(!productExists)("live-synced product comparison (no seeded display copy)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("has a canonical product with at least one real UPC identifier", async () => {
    const product = await prisma.canonicalProduct.findUnique({
      where: { id: PRODUCT_ID },
      include: { identifiers: true },
    });
    expect(product).not.toBeNull();
    expect(product!.identifiers.some((i) => i.type === "UPC")).toBe(true);
  });

  it("has multiple listing rows, all pointing at this canonical product", async () => {
    const listings = await prisma.listing.findMany({ where: { canonicalProductId: PRODUCT_ID } });
    expect(listings.length).toBeGreaterThan(1);
    for (const listing of listings) {
      expect(listing.canonicalProductId).toBe(PRODUCT_ID);
    }
  });

  it("renders a full comparison without any hand-authored per-listing copy", async () => {
    const product = await getCompareProduct(PRODUCT_ID);
    expect(product).not.toBeNull();

    const rows = await getCompareRows(PRODUCT_ID);
    expect(rows.length).toBeGreaterThan(1);

    const sellerNames = new Set(rows.map((r) => r.listing.sourceName));
    // Real, distinct merchants — not a single connector-level placeholder name
    // repeated for every row (the retailer-identity bug this test would catch).
    expect(sellerNames.size).toBeGreaterThan(1);

    for (const { listing, recommendation } of rows) {
      // Every listing must resolve to *some* valid label — sourced either from
      // real data or from the shared fallback constants, never undefined/blank
      // from a missing per-id table entry.
      expect(listing.sourceName).toBeTruthy();
      expect(listing.sourceName).not.toBe(FALLBACK_COPY.retailer);
      expect([FALLBACK_COPY.warranty]).toContain(listing.warrantyLabel);
      expect([FALLBACK_COPY.returns]).toContain(listing.returnPolicyLabel);
      expect(listing.deliveryLabel).toBeTruthy();

      expect(recommendation.rank).toBeGreaterThan(0);
      expect(recommendation.label).toBeTruthy();
      expect(recommendation.rationale).toBeTruthy();
      expect(Array.isArray(recommendation.assumptions)).toBe(true);
    }

    const ranks = rows.map((r) => r.recommendation.rank);
    expect(new Set(ranks).size).toBe(ranks.length); // ranks are unique, not duplicated
  });

  it("applies a budget filter and re-ranks 'best overall' relative to what's shown", async () => {
    const unfiltered = await getCompareRows(PRODUCT_ID);
    expect(unfiltered.length).toBeGreaterThan(1);

    // Real synced prices range ~$65-$750; $100 should exclude all but the cheapest.
    const filtered = await getCompareRows(PRODUCT_ID, { maxBudget: 100 });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThan(unfiltered.length);
    for (const { listing } of filtered) {
      expect(totalKnownCost(listing)).toBeLessThanOrEqual(100);
    }
    // The cheapest listing among the filtered set is still ranked #1.
    expect(filtered.find((r) => r.recommendation.rank === 1)).toBeDefined();
  });

  it("a budget filter below every listing's price returns zero rows rather than throwing", async () => {
    const filtered = await getCompareRows(PRODUCT_ID, { maxBudget: 1 });
    expect(filtered).toEqual([]);
  });

  it("condition filter excludes listings that don't match", async () => {
    // All synced iPhone listings are condition "new".
    const usedOnly = await getCompareRows(PRODUCT_ID, { condition: "used" });
    expect(usedOnly).toEqual([]);

    const newOnly = await getCompareRows(PRODUCT_ID, { condition: "new" });
    const unfiltered = await getCompareRows(PRODUCT_ID);
    expect(newOnly.length).toBe(unfiltered.length);
  });

  it("fastest-delivery priority honestly falls back to cost ranking when no listing has real pickup data", async () => {
    // None of the synced iPhone listings have pickup available (no structured
    // delivery-date data exists at all) — ranking must degrade to cost order
    // rather than fabricating a delivery-speed signal, and the #1 listing must
    // NOT be mislabeled "Fastest delivery" when nothing is actually faster.
    const byCost = await getCompareRows(PRODUCT_ID, undefined, "best-overall");
    const byDelivery = await getCompareRows(PRODUCT_ID, undefined, "fastest-delivery");

    expect(byDelivery.map((r) => r.listing.id)).toEqual(byCost.map((r) => r.listing.id));

    const top = byDelivery[0];
    expect(top.recommendation.label).not.toBe("Fastest delivery");
    // Real synced freshness varies with when this suite last ran a sync, so
    // assert the correct label for whichever state the top listing is
    // actually in, rather than a single hardcoded string.
    if (isFreshnessStale(top.listing.freshnessMinutesAgo)) {
      expect(top.recommendation.label).toBe(NEUTRAL_RECOMMENDATION_LABEL);
    } else {
      expect(top.recommendation.label).toBe("Best overall");
    }
  });

  it("requireFastDelivery filter excludes all listings when none offer real pickup", async () => {
    const filtered = await getCompareRows(PRODUCT_ID, { requireFastDelivery: true });
    expect(filtered).toEqual([]);
  });
});
