import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertMock = vi.fn();
const countMock = vi.fn();
const fetchListingsMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: {
      count: (...args: unknown[]) => countMock(...args),
    },
  },
}));

vi.mock("./upsert-listings", () => ({
  upsertConnectorListings: (...args: unknown[]) => upsertMock(...args),
}));

vi.mock("./registry", () => ({
  listConnectors: () => ["src-test"],
  getConnector: () => ({
    sourceId: "src-test",
    fetchListings: () => fetchListingsMock(),
  }),
}));

import { MerchantFeedIngestionService } from "./batch-ingest";

describe("MerchantFeedIngestionService", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    countMock.mockReset();
    fetchListingsMock.mockReset();
    countMock.mockResolvedValue(2);
    upsertMock.mockResolvedValue({ sourceId: "src-test", upserted: 1 });
  });

  it("isolates normalize errors and upserts only valid raw offers", async () => {
    const service = new MerchantFeedIngestionService();
    const metrics = await service.processRawFeedBatch("src-test", [
      {
        offer_id: "ok-1",
        merchant_id: "m1",
        merchant_name: "Merchant",
        feed_type: "partner",
        raw_price: "$20.00",
        raw_shipping: "5",
      },
      { offer_id: "bad" },
      {
        offer_id: "ok-2",
        merchant_id: "m1",
        merchant_name: "Merchant",
        feed_type: "partner",
        raw_price: "not-a-price",
      },
    ]);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const arg = upsertMock.mock.calls[0]![0] as {
      sourceId: string;
      listings: { externalId: string; shipping?: number }[];
    };
    expect(arg.sourceId).toBe("src-test");
    expect(arg.listings).toHaveLength(1);
    expect(arg.listings[0]!.externalId).toBe("ok-1");
    expect(arg.listings[0]!.shipping).toBe(5);
    expect(metrics.upserted).toBe(1);
    expect(metrics.errorCount).toBe(2);
    expect(metrics.staleListingCount).toBe(2);
  });

  it("does not invent free shipping when raw shipping is missing", async () => {
    const service = new MerchantFeedIngestionService();
    await service.processRawFeedBatch("src-test", [
      {
        offer_id: "no-ship",
        merchant_id: "m1",
        merchant_name: "Merchant",
        feed_type: "affiliate",
        raw_price: 100,
        raw_shipping: null,
      },
    ]);

    const arg = upsertMock.mock.calls[0]![0] as {
      listings: { shipping?: number }[];
    };
    expect(arg.listings[0]!.shipping).toBeUndefined();
  });

  it("records connector failures without throwing", async () => {
    fetchListingsMock.mockRejectedValue(new Error("rate limited"));
    const service = new MerchantFeedIngestionService();
    const metrics = await service.processMerchantFeed("src-test");
    expect(metrics.upserted).toBe(0);
    expect(metrics.errorCount).toBe(1);
    expect(metrics.errors[0]).toContain("rate limited");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("processAllActive runs each registered source", async () => {
    fetchListingsMock.mockResolvedValue({
      sourceId: "src-test",
      listings: [{ externalId: "a", condition: "new", price: 10 }],
      fetchedAt: new Date(),
    });
    const service = new MerchantFeedIngestionService();
    const summary = await service.processAllActive();
    expect(summary.metrics).toHaveLength(1);
    expect(summary.metrics[0]!.upserted).toBe(1);
    expect(summary.staleListingsTotal).toBe(2);
  });
});
