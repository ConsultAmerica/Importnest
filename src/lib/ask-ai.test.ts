import { afterEach, describe, expect, it, vi } from "vitest";
import {
  askAi,
  askAiGuided,
  askAiRequestSchema,
  getAskAiMode,
} from "@/lib/ask-ai";

vi.mock("@/lib/search-results", () => ({
  getSearchResults: vi.fn(async () => ({
    products: [
      {
        id: "prod-1",
        brandName: "Kindred",
        productName: "ClearAir 200",
        lowestTotalCost: 189.99,
        offerCount: 3,
      },
    ],
    total: 1,
    facets: {},
  })),
}));

vi.mock("@/lib/best-deals", () => ({
  getBestDeals: vi.fn(async () => [
    {
      productId: "deal-1",
      brandName: "Apex Home",
      productName: "Apex Home Quiet Dishwasher",
      currentTotal: 799,
      discountPercent: 6,
      offerCount: 7,
    },
  ]),
}));

describe("askAiRequestSchema", () => {
  it("accepts a short shopping conversation", () => {
    const parsed = askAiRequestSchema.safeParse({
      messages: [{ role: "user", content: "Best air purifiers under $250" }],
      context: { categorySlug: "home" },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty messages", () => {
    expect(askAiRequestSchema.safeParse({ messages: [] }).success).toBe(false);
  });
});

describe("askAi guided mode (no Anthropic key)", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("uses guided mode when Anthropic is not configured", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(getAskAiMode()).toBe("guided");
  });

  it("answers Total Known Cost FAQ without inventing prices", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const outcome = await askAi({
      messages: [{ role: "user", content: "What is Total Known Cost?" }],
    });
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.reply.mode).toBe("guided");
      expect(outcome.reply.answer).toMatch(/Total Known Cost/i);
      expect(outcome.reply.answer).toMatch(/never treat missing shipping as \$0/i);
      expect(outcome.reply.products).toEqual([]);
    }
  });

  it("returns catalog matches for product queries", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const reply = await askAiGuided({
      messages: [{ role: "user", content: "Best air purifiers under $250" }],
    });
    expect(reply.mode).toBe("guided");
    expect(reply.products.length).toBeGreaterThan(0);
    expect(reply.products[0]?.lowestTotalCost).toBe(189.99);
    expect(reply.answer).toMatch(/approved-catalog|ClearAir|Kindred/i);
  });

  it("treats shipping wording inside a product search as a search, not an FAQ", async () => {
    const reply = await askAiGuided({
      messages: [{ role: "user", content: "Running shoes with free shipping" }],
    });
    expect(reply.products.length).toBeGreaterThan(0);
  });

  it("links a shipping follow-up back to the earlier search", async () => {
    const reply = await askAiGuided({
      messages: [
        { role: "user", content: "Best air purifiers under $250" },
        { role: "assistant", content: "Here are matches" },
        { role: "user", content: "Any with free shipping?" },
      ],
    });
    expect(reply.answer).toMatch(/Shipping only counts/i);
    expect(reply.suggestedSearches[0]?.href).toContain("freeShipping=1");
    expect(reply.suggestedSearches[0]?.href).toContain("air%20purifiers");
  });

  it("answers today's deals from stored price history", async () => {
    const reply = await askAiGuided({
      messages: [{ role: "user", content: "What are today’s best deals?" }],
    });
    expect(reply.products[0]?.id).toBe("deal-1");
    expect(reply.answer).toMatch(/6% below its previous tracked total/);
    expect(reply.answer).not.toMatch(/Apex Home Apex Home/);
  });

  it("answers checkout and good-price questions without a catalog search", async () => {
    const buy = await askAiGuided({
      messages: [{ role: "user", content: "Can I buy directly on Importnest?" }],
    });
    expect(buy.answer).toMatch(/retailer’s own site/);
    const price = await askAiGuided({
      messages: [{ role: "user", content: "Is this a good price right now?" }],
    });
    expect(price.answer).toMatch(/price history/i);
  });
});
