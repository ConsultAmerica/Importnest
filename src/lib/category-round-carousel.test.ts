import { describe, expect, it } from "vitest";
import {
  activeRoundCarouselSlug,
  getCategoryRoundCarouselItems,
} from "@/lib/category-round-carousel";

const WIRED_CATEGORIES = [
  "appliances",
  "electronics",
  "kitchen",
  "footwear",
  "beauty",
  "accessories",
  "automotive",
  "outdoors",
  "home",
];

describe("category-round-carousel", () => {
  it.each(WIRED_CATEGORIES)(
    "returns 12 distinct tiles with non-empty labels, slugs, hrefs, and images for %s",
    (categorySlug) => {
      const items = getCategoryRoundCarouselItems(categorySlug);
      expect(items).toHaveLength(12);

      const labels = new Set(items.map((i) => i.label));
      const hrefs = new Set(items.map((i) => i.href));
      const images = new Set(items.map((i) => i.imageUrl));
      expect(labels.size).toBe(items.length);
      expect(hrefs.size).toBe(items.length);
      expect(images.size).toBe(items.length);

      for (const item of items) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.href).toContain(`category=${categorySlug}`);
        expect(item.imageUrl).toMatch(/^\//);
      }
    },
  );

  it("includes a reset tile with no query param and a 'Best Deals' tile sorted by lowest cost", () => {
    const items = getCategoryRoundCarouselItems("appliances");
    const resetTile = items.find((i) => i.slug === "");
    const dealsTile = items.find((i) => i.slug === "deals");

    expect(resetTile?.label).toBe("Appliances");
    expect(resetTile?.href).toBe("/search/results?category=appliances");

    expect(dealsTile?.label).toBe("Best Deals");
    expect(dealsTile?.href).toBe("/search/results?category=appliances&sort=lowest_cost");
    expect(dealsTile?.badge).toBe("Deals");
  });

  it.each(WIRED_CATEGORIES)(
    "assigns lifestyle-cover to the reset tile, photo-cover to subtypes, and transparent-contain to deals for %s",
    (categorySlug) => {
      const items = getCategoryRoundCarouselItems(categorySlug);
      const resetTile = items.find((i) => i.slug === "");
      const dealsTile = items.find((i) => i.slug === "deals");
      const subtypeTiles = items.filter((i) => i.slug !== "" && i.slug !== "deals");

      expect(resetTile?.imageMode).toBe("lifestyle-cover");
      expect(dealsTile?.imageMode).toBe("transparent-contain");
      for (const tile of subtypeTiles) {
        expect(tile.imageMode).toBe("photo-cover");
        expect(tile.imageUrl).toMatch(/^\/images\/subtypes\//);
      }
    },
  );

  it("labels the beauty-devices reset tile using the canonical category title", () => {
    const items = getCategoryRoundCarouselItems("beauty-devices");
    const resetTile = items.find((i) => i.slug === "");
    expect(resetTile?.label).toBe("Beauty Devices");
  });

  it("resolves cooking to a skin-fill subtype PNG rather than inventing a path", () => {
    const items = getCategoryRoundCarouselItems("appliances");
    const cooking = items.find((i) => i.slug === "cooking");
    // Optional ?v=N is a cache-buster bumped whenever the subtype PNGs are regenerated.
    expect(cooking?.imageUrl).toMatch(/^\/images\/subtypes\/appliances\/air-fryer\.png(\?v=\d+)?$/);
    expect(cooking?.imageMode).toBe("photo-cover");
  });

  it("returns an empty list for categories not wired up", () => {
    expect(getCategoryRoundCarouselItems("not-a-real-category")).toEqual([]);
  });

  it("resolves the active tile slug from q, then sort=lowest_cost, then the reset tile", () => {
    expect(activeRoundCarouselSlug("Refrigerator", undefined)).toBe("refrigerator");
    expect(activeRoundCarouselSlug(undefined, "lowest_cost")).toBe("deals");
    expect(activeRoundCarouselSlug(undefined, undefined)).toBe("");
    expect(activeRoundCarouselSlug("  ", "best_overall")).toBe("");
  });
});
