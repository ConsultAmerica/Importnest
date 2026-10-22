import { describe, expect, it } from "vitest";
import {
  buildEndUserCtx,
  extractEbayIdentifiers,
  extractEbayShipping,
  mapEbayCondition,
  mapEbayItem,
  isEbaySummaryKeeper,
  readEbayConfig,
  resolveEbaySearch,
  type EbayItemDetail,
  type EbayItemSummary,
} from "./ebay";

const fixedShipping = {
  shippingCost: { value: "8.50", currency: "USD" },
  shippingCostType: "FIXED",
  minEstimatedDeliveryDate: "2026-10-25T00:00:00.000Z",
  maxEstimatedDeliveryDate: "2026-10-28T00:00:00.000Z",
};

function summary(overrides: Partial<EbayItemSummary> = {}): EbayItemSummary {
  return {
    itemId: "v1|100|0",
    title: "Apex Dishwasher DW-100",
    condition: "NEW",
    conditionId: "1000",
    price: { value: "420.00", currency: "USD" },
    seller: { username: "apex-outlet" },
    itemWebUrl: "https://www.ebay.com/itm/100",
    itemAffiliateWebUrl: "https://www.ebay.com/itm/100?mkcid=1&campid=123",
    shippingOptions: [fixedShipping],
    buyingOptions: ["FIXED_PRICE"],
    ...overrides,
  };
}

describe("mapEbayCondition", () => {
  it("maps the conditions Listing already stores", () => {
    expect(mapEbayCondition("NEW", "1000")).toBe("new");
    expect(mapEbayCondition("OPEN_BOX", "1500")).toBe("open-box");
    expect(mapEbayCondition("Certified - Refurbished", "2000")).toBe("certified-refurbished");
    expect(mapEbayCondition("USED_GOOD", "5000")).toBe("used");
    expect(mapEbayCondition("SELLER_REFURBISHED", "2500")).toBe("refurbished");
  });

  it("drops parts-only and unknown conditions", () => {
    expect(mapEbayCondition("FOR_PARTS_OR_NOT_WORKING", "7000")).toBeNull();
    expect(mapEbayCondition("Mystery grade", undefined)).toBeNull();
  });

  it("keeps priced Buy It Now offers and skips the hits getItem should not see", () => {
    expect(isEbaySummaryKeeper(summary())).toBe(true);
    expect(isEbaySummaryKeeper(summary({ buyingOptions: ["AUCTION"] }))).toBe(false);
    expect(isEbaySummaryKeeper(summary({ condition: "FOR_PARTS_OR_NOT_WORKING", conditionId: "7000" }))).toBe(false);
    expect(isEbaySummaryKeeper(summary({ price: undefined }))).toBe(false);
  });
});

describe("extractEbayShipping", () => {
  it("uses the cheapest disclosed fixed cost and keeps import charges as fees", () => {
    const extracted = extractEbayShipping([
      { shippingCost: { value: "12.00", currency: "USD" }, shippingCostType: "FIXED" },
      {
        shippingCost: { value: "4.00", currency: "USD" },
        shippingCostType: "FIXED",
        importCharges: { value: "15.00", currency: "USD" },
      },
      { shippingCost: { value: "1.00", currency: "USD" }, shippingCostType: "CALCULATED" },
    ]);

    expect(extracted).toMatchObject({ shipping: 4, fees: 15 });
  });

  it("treats a cost with no shippingCostType as undisclosed", () => {
    expect(extractEbayShipping([{ shippingCost: { value: "0.00", currency: "USD" } }])).toEqual({});
  });

  it("stores a disclosed free-shipping cost of 0", () => {
    expect(
      extractEbayShipping([
        { shippingCost: { value: "0.00", currency: "USD" }, shippingCostType: "FIXED" },
      ]),
    ).toMatchObject({ shipping: 0, deliveryLabel: "Free shipping" });
  });

  it("leaves calculated shipping unset", () => {
    expect(
      extractEbayShipping([
        { shippingCost: { value: "9.00", currency: "USD" }, shippingCostType: "CALCULATED" },
      ]),
    ).toEqual({ deliveryLabel: "Shipping calculated at checkout" });
  });

  it("ignores non-USD amounts", () => {
    expect(
      extractEbayShipping([{ shippingCost: { value: "9.00", currency: "GBP" }, shippingCostType: "FIXED" }]),
    ).toEqual({});
  });
});

describe("extractEbayIdentifiers", () => {
  it("reads UPC and MPN from product identities and item specifics", () => {
    const detail: EbayItemDetail = {
      product: {
        gtins: ["012345678905"],
        mpns: ["DW-100"],
        additionalProductIdentities: [
          { productIdentity: [{ identifierType: "EAN", identifierValue: "4006381333931" }] },
        ],
      },
      localizedAspects: [
        { name: "UPC", value: "012345678905" },
        { name: "Manufacturer Part Number", value: "DW-100 / alt" },
      ],
    };

    expect(extractEbayIdentifiers(detail)).toEqual({
      upc: "012345678905",
      mpn: "DW-100",
    });
  });

  it("prefers a 12-digit UPC over an EAN when both are present", () => {
    expect(
      extractEbayIdentifiers({
        product: { gtins: ["4006381333931", "012345678905"] },
      }).upc,
    ).toBe("012345678905");
  });
});

describe("mapEbayItem", () => {
  it("maps a multi-seller Buy It Now offer onto a connector listing", () => {
    const listing = mapEbayItem(summary(), null, { stampUpc: "012345678905" });

    expect(listing).toMatchObject({
      externalId: "v1|100|0",
      sellerName: "apex-outlet",
      url: "https://www.ebay.com/itm/100?mkcid=1&campid=123",
      condition: "new",
      price: 420,
      shipping: 8.5,
      upc: "012345678905",
      modelName: "Apex Dishwasher DW-100",
    });
  });

  it("keeps a second seller as its own listing", () => {
    const other = mapEbayItem(
      summary({
        itemId: "v1|200|0",
        seller: { username: "other-seller" },
        price: { value: "399.00", currency: "USD" },
      }),
    );
    expect(other?.externalId).toBe("v1|200|0");
    expect(other?.sellerName).toBe("other-seller");
    expect(other?.price).toBe(399);
  });

  it("uses item-specific identifiers instead of the search UPC when both exist", () => {
    const listing = mapEbayItem(summary(), {
      localizedAspects: [{ name: "MPN", value: "DW-100" }, { name: "UPC", value: "999999999999" }],
    }, { stampUpc: "012345678905" });

    expect(listing).toMatchObject({ upc: "999999999999", mpn: "DW-100" });
  });

  it("falls back to the plain item URL when no affiliate URL was returned", () => {
    const listing = mapEbayItem(summary({ itemAffiliateWebUrl: undefined }));
    expect(listing?.url).toBe("https://www.ebay.com/itm/100");
  });

  it("keeps a calculated offer and does not store the summary cost as shipping", () => {
    const listing = mapEbayItem(summary(), {
      shippingOptions: [
        { shippingCost: { value: "20.00", currency: "USD" }, shippingCostType: "CALCULATED" },
      ],
    });
    expect(listing).not.toBeNull();
    expect(listing?.shipping).toBeUndefined();
    expect(listing?.deliveryLabel).toBe("Shipping calculated at checkout");
  });

  it("drops auction-only and parts-only offers", () => {
    expect(mapEbayItem(summary({ buyingOptions: ["AUCTION"] }))).toBeNull();
    expect(mapEbayItem(summary({ condition: "FOR_PARTS_OR_NOT_WORKING", conditionId: "7000" }))).toBeNull();
  });
});

describe("resolveEbaySearch", () => {
  it("uses the gtin parameter for a 12-digit UPC and stamps it", () => {
    expect(resolveEbaySearch({ upc: "012345678905", modelNumber: "012345678905" })).toEqual({
      gtin: "012345678905",
      stampUpc: "012345678905",
    });
  });

  it("sends other model numbers as a keyword and does not stamp a UPC", () => {
    expect(resolveEbaySearch({ upc: "DW-100", modelNumber: "DW-100" })).toEqual({ q: "DW-100" });
  });

  it("returns null when there is nothing to search", () => {
    expect(resolveEbaySearch({})).toBeNull();
  });
});

describe("eBay request context", () => {
  it("reads partner-network settings without inventing a delivery ZIP", () => {
    const config = readEbayConfig({
      EBAY_CLIENT_ID: "client",
      EBAY_CLIENT_SECRET: "secret",
      EBAY_CAMPAIGN_ID: "5338",
      EBAY_ENVIRONMENT: "sandbox",
    });

    expect(config.environment).toBe("sandbox");
    expect(config.deliveryZip).toBeUndefined();
    expect(buildEndUserCtx(config)).toBe(
      "contextualLocation=country%3DUS,affiliateCampaignId=5338",
    );
  });

  it("includes the delivery ZIP only when one is configured", () => {
    const config = readEbayConfig({
      EBAY_CAMPAIGN_ID: "5338",
      EBAY_DELIVERY_ZIP: "21740",
    });
    expect(buildEndUserCtx(config)).toBe(
      "contextualLocation=country%3DUS%2Czip%3D21740,affiliateCampaignId=5338",
    );
  });
});
