import { describe, expect, it } from "vitest";
import {
  calculateCompletenessScore,
  computeTotalKnownCost,
  isNormalizedOffer,
  normalizeMerchantFeed,
  normalizeMerchantOffer,
  parsePrice,
  toConnectorListing,
} from "./normalize-merchant-feed";

describe("parsePrice", () => {
  it("parses currency strings and plain numbers", () => {
    expect(parsePrice("$1,299.00 USD")).toBe(1299);
    expect(parsePrice(199.99)).toBe(199.99);
    expect(parsePrice("Free")).toBe(0);
  });

  it("returns null for missing or unusable values", () => {
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
    expect(parsePrice("N/A")).toBeNull();
    expect(parsePrice("ask")).toBeNull();
  });
});

describe("computeTotalKnownCost — shipping honesty", () => {
  it("includes disclosed shipping and fees", () => {
    expect(
      computeTotalKnownCost({
        itemPrice: 100,
        shippingCost: 12.5,
        mandatoryFees: 2,
        verifiedDiscount: 5,
      }),
    ).toEqual({ totalKnownCost: 109.5, shippingDisclosed: true });
  });

  it("never treats undisclosed shipping as $0", () => {
    const result = computeTotalKnownCost({
      itemPrice: 100,
      shippingCost: null,
      mandatoryFees: 3,
    });
    expect(result.shippingDisclosed).toBe(false);
    expect(result.totalKnownCost).toBe(103);
  });
});

describe("normalizeMerchantOffer", () => {
  const base = {
    offer_id: "off-1",
    merchant_id: "m-1",
    merchant_name: "Example Retailer",
    feed_type: "verified_merchant" as const,
    raw_price: "$249.99",
  };

  it("normalizes a complete offer with TKC and completeness", () => {
    const result = normalizeMerchantOffer(
      {
        ...base,
        raw_shipping: "12.00",
        raw_fees: 3.5,
        delivery_speed: "2-day",
        warranty: "1 year",
        return_days: 30,
        url: "https://example.com/offer",
        last_updated: "2026-10-21T12:00:00.000Z",
      },
      new Date("2026-10-21T14:00:00.000Z"),
    );

    expect(isNormalizedOffer(result)).toBe(true);
    if (!isNormalizedOffer(result)) return;

    expect(result.pricing.itemPrice).toBe(249.99);
    expect(result.pricing.shippingCost).toBe(12);
    expect(result.pricing.mandatoryFees).toBe(3.5);
    expect(result.pricing.totalKnownCost).toBe(265.49);
    expect(result.pricing.shippingDisclosed).toBe(true);
    expect(result.policyMetadata.dataCompletenessScore).toBe(100);
    expect(result.freshness.status).toBe("active");
    expect(result.merchant.sourceType).toBe("licensed-provider");
  });

  it("keeps shipping null when the feed omits it (no fake free shipping)", () => {
    const result = normalizeMerchantOffer({
      ...base,
      raw_shipping: null,
      raw_fees: "1.00",
    });
    expect(isNormalizedOffer(result)).toBe(true);
    if (!isNormalizedOffer(result)) return;

    expect(result.pricing.shippingCost).toBeNull();
    expect(result.pricing.shippingDisclosed).toBe(false);
    expect(result.pricing.totalKnownCost).toBe(250.99);
    expect(result.fulfillment.deliverySpeedLabel).toBeNull();
  });

  it("flags stale offers older than 24 hours", () => {
    const result = normalizeMerchantOffer(
      {
        ...base,
        last_updated: "2026-10-19T12:00:00.000Z",
      },
      new Date("2026-10-21T14:00:00.000Z"),
    );
    expect(isNormalizedOffer(result)).toBe(true);
    if (!isNormalizedOffer(result)) return;
    expect(result.freshness.status).toBe("stale");
  });

  it("rejects invalid payloads without inventing prices", () => {
    expect(normalizeMerchantOffer({ offer_id: "x" })).toMatchObject({
      error: expect.stringContaining("Validation failed"),
    });
    expect(
      normalizeMerchantOffer({
        ...base,
        raw_price: "not-a-price",
      }),
    ).toMatchObject({ error: expect.stringContaining("Invalid or missing item price") });
  });

  it("maps to ConnectorListing without inventing shipping", () => {
    const result = normalizeMerchantOffer({
      ...base,
      raw_shipping: null,
      condition: "Open Box",
      upc: "123",
    });
    expect(isNormalizedOffer(result)).toBe(true);
    if (!isNormalizedOffer(result)) return;

    const listing = toConnectorListing(result);
    expect(listing.shipping).toBeUndefined();
    expect(listing.price).toBe(249.99);
    expect(listing.condition).toBe("open-box");
    expect(listing.upc).toBe("123");
  });
});

describe("normalizeMerchantFeed batch", () => {
  it("separates valid listings from errors", () => {
    const { offers, listings, errors } = normalizeMerchantFeed([
      {
        offer_id: "ok",
        merchant_id: "m",
        merchant_name: "M",
        feed_type: "affiliate",
        raw_price: 10,
        raw_shipping: 0,
      },
      { offer_id: "bad" },
    ]);
    expect(offers).toHaveLength(1);
    expect(listings).toHaveLength(1);
    expect(listings[0]!.shipping).toBe(0);
    expect(errors).toHaveLength(1);
  });
});

describe("calculateCompletenessScore", () => {
  it("scores partial merchant data honestly", () => {
    expect(
      calculateCompletenessScore({
        itemPrice: 10,
        shipping: null,
        warranty: null,
        returnDays: null,
        deliverySpeed: null,
        url: null,
      }),
    ).toBe(17);
  });
});
