import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { countActiveResultFilters, SearchResultProductCard } from "@/components/SearchResultsLayout";
import type { SearchResultProduct } from "@/lib/search-results";

function makeProduct(overrides: Partial<SearchResultProduct> = {}): SearchResultProduct {
  return {
    id: "cp-1",
    brandName: "Apex Home",
    productName: "Apex Quiet Dishwasher",
    modelNumber: "AH-4200",
    categoryName: "Appliances",
    categorySlug: "appliances",
    imageSrc: "/brand/logo-app-icon-light.png",
    lowestTotalCost: 899,
    offerCount: 3,
    freshnessMinutesAgo: 10,
    hasPickup: false,
    hasFreeShipping: false,
    conditions: ["new"],
    rating: null,
    ratingCount: null,
    attributes: [],
    allAttributes: [],
    colors: [],
    sourceIds: ["src-1"],
    sourceNames: ["Local Electronics"],
    offerBreakdown: [],
    previousTotalCost: null,
    priceDropPercent: null,
    isHistoricalLow: false,
    isSaved: false,
    matchKind: "exact",
    highlights: [],
    bestListing: null,
    ...overrides,
  };
}

const openBoxListing = {
  listingId: "listing-open-box-pickup",
  sourceName: "Local Electronics",
  condition: "open-box",
  price: 842,
  shipping: 0,
  fees: 0,
};

describe("SearchResultProductCard — no source data (zero listings for this product)", () => {
  it("shows an honest 'No offers' instead of a fabricated price or offer count", () => {
    const html = renderToStaticMarkup(
      <SearchResultProductCard
        product={makeProduct({ offerCount: 0, lowestTotalCost: null, sourceIds: [] })}
        signedIn={false}
        redirectTo="/search/results"
      />,
    );
    expect(html).toContain("No offers");
    expect(html).not.toContain("$0.00");
    expect(html).not.toContain("From");
  });

  it("still links to the comparison page even with no current offers", () => {
    const html = renderToStaticMarkup(
      <SearchResultProductCard
        product={makeProduct({ offerCount: 0, lowestTotalCost: null })}
        signedIn={false}
        redirectTo="/search/results"
      />,
    );
    expect(html).toContain('href="/compare/cp-1"');
  });
});

describe("SearchResultProductCard — comparable alternative labeling", () => {
  it("labels a comparable-match product 'Comparable alternative'", () => {
    const html = renderToStaticMarkup(
      <SearchResultProductCard
        product={makeProduct({ matchKind: "comparable" })}
        signedIn={false}
        redirectTo="/search/results"
      />,
    );
    expect(html).toContain("Comparable alternative");
    expect(html).not.toContain("Exact match");
  });

  it("labels an exact-match product 'Exact match', never mixing in the comparable badge", () => {
    const html = renderToStaticMarkup(
      <SearchResultProductCard
        product={makeProduct({ matchKind: "exact" })}
        signedIn={false}
        redirectTo="/search/results"
      />,
    );
    expect(html).toContain("Exact match");
    expect(html).not.toContain("Comparable alternative");
  });
});

describe("SearchResultProductCard — Add to Cart visibility", () => {
  it("shows Add to cart when a real bestListing backs a normal search result", () => {
    const html = renderToStaticMarkup(
      <SearchResultProductCard
        product={makeProduct({ bestListing: openBoxListing })}
        signedIn={false}
        redirectTo="/search/results?category=electronics"
      />,
    );
    // Labels sit with the icons so the actions stay clear on a phone.
    expect(html).toContain('aria-label="Add Apex Quiet Dishwasher to cart"');
    expect(html).toContain("Track");
    expect(html).toContain('aria-label="Add Apex Quiet Dishwasher to compare"');
  });

  it("shows Add to cart on filtered open-box / pickup result cards with a matching listing", () => {
    const html = renderToStaticMarkup(
      <SearchResultProductCard
        product={makeProduct({
          categorySlug: "electronics",
          categoryName: "Electronics",
          productName: "Nimbus Wireless Earbuds",
          conditions: ["open-box", "new"],
          hasPickup: true,
          bestListing: openBoxListing,
          lowestTotalCost: 842,
        })}
        signedIn={false}
        redirectTo="/search/results?category=electronics&condition=open_box&pickup=1"
      />,
    );
    expect(html).toContain('aria-label="Add Nimbus Wireless Earbuds to cart"');
  });

  it("hides Add to cart when there is no valid listing/backing offer", () => {
    const html = renderToStaticMarkup(
      <SearchResultProductCard
        product={makeProduct({ bestListing: null, offerCount: 2, lowestTotalCost: 100 })}
        signedIn={false}
        redirectTo="/search/results"
      />,
    );
    expect(html).not.toContain("to cart");
    expect(html).toContain("Track");
    expect(html).toContain('aria-label="Add Apex Quiet Dishwasher to compare"');
  });
});

describe("countActiveResultFilters — category=all is not an active filter", () => {
  it("does not count category=all, category=, or a missing category as an active filter", () => {
    expect(countActiveResultFilters({ category: "all" })).toBe(0);
    expect(countActiveResultFilters({ category: "All" })).toBe(0);
    expect(countActiveResultFilters({ category: "" })).toBe(0);
    expect(countActiveResultFilters({})).toBe(0);
  });

  it("counts a real category as an active filter", () => {
    expect(countActiveResultFilters({ category: "electronics" })).toBe(1);
  });

  it("still counts other active filters alongside an All browse", () => {
    expect(countActiveResultFilters({ category: "all", priceMax: "100" })).toBe(1);
  });
});
