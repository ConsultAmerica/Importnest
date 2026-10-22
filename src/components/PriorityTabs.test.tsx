import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PriorityTabs } from "@/components/PriorityTabs";
import {
  buildRecommendationPanel,
  FALLBACK_COPY,
  NEUTRAL_RECOMMENDATION_LABEL,
  NO_RECOMMENDATION_TEXT,
  PRIORITY_LABELS,
  sortCompareRows,
  type CompareListingView,
  type CompareRow,
} from "@/lib/compare-view";
import { FRESHNESS_OUTDATED_MINUTES, FRESHNESS_STALE_MINUTES } from "@/lib/freshness";
import { BRAND_FALLBACK_IMAGE } from "@/lib/images";
import type { Priority } from "@/lib/types";

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

const ALL_PRIORITIES: Priority[] = [
  "best-overall",
  "lowest-cost",
  "fastest-delivery",
  "best-condition",
  "best-protection",
];

/**
 * Mirrors what the compare page does server-side: sort once for `priority`,
 * derive the recommendation panel from that same order, and build tab hrefs.
 * PriorityTabs itself never re-sorts — this is the only place ranking happens.
 */
function renderPriorityTabs(
  rawRows: CompareRow[],
  options: { priority?: Priority; productId?: string; priorityKeys?: Priority[] } = {},
): string {
  const priority = options.priority ?? "best-overall";
  const productId = options.productId ?? "cp-1";
  const priorityKeys = options.priorityKeys ?? ALL_PRIORITIES;
  const rows = sortCompareRows(rawRows, priority);
  const panel = buildRecommendationPanel(rows, priority);
  const priorityOptions = priorityKeys.map((key) => ({
    key,
    label: PRIORITY_LABELS[key],
    href: `/compare/${productId}?priority=${key}`,
  }));

  return renderToStaticMarkup(
    <PriorityTabs
      productId={productId}
      productName="Test Product"
      brandName="Test Brand"
      productImageSrc="/brand/logo-app-icon-light.png"
      rows={rows}
      priority={priority}
      priorityOptions={priorityOptions}
      panel={panel}
    />,
  );
}

describe("PriorityTabs — no offers", () => {
  it("renders an honest empty state instead of an offer list", () => {
    const html = renderPriorityTabs([]);
    expect(html).toContain("Source temporarily unavailable");
    expect(html).not.toContain("Sort by");
  });
});

describe("PriorityTabs — stale offers", () => {
  it("shows the stale-data banner and never assigns a definitive label to a stale top offer", () => {
    const rows = [
      makeRow({ id: "a", price: 50, freshnessMinutesAgo: FRESHNESS_STALE_MINUTES }),
      makeRow({ id: "b", price: 80, freshnessMinutesAgo: 2 }),
    ];
    const html = renderPriorityTabs(rows);

    expect(html).toContain("Pricing was last synced a while ago");
    expect(html).toContain("confirm current prices if you are about to buy");
    expect(html).toContain(NEUTRAL_RECOMMENDATION_LABEL);
  });

  it("assigns the definitive label (not the neutral fallback) when every offer is fresh", () => {
    const rows = [makeRow({ id: "a", price: 50, freshnessMinutesAgo: 2 })];
    const html = renderPriorityTabs(rows);

    expect(html).not.toContain("Pricing was last synced a while ago");
    expect(html).not.toContain(NEUTRAL_RECOMMENDATION_LABEL);
  });
});

describe("PriorityTabs — recommendation summary content", () => {
  it("shows the explanation, one trade-off line, missing information, and last-checked time", () => {
    const rows = [
      makeRow({
        id: "cheap-used",
        price: 40,
        condition: "used",
        pickupAvailable: false,
        freshnessMinutesAgo: 5,
      }),
      makeRow({
        id: "pricier-pickup",
        price: 55,
        condition: "used",
        pickupAvailable: true,
        freshnessMinutesAgo: 5,
      }),
    ];
    const html = renderPriorityTabs(rows, { priority: "fastest-delivery" });

    expect(html).toContain("because it has faster pickup availability");
    expect(html).toContain("It costs $15.00 more than the cheapest listing but has faster pickup availability.");
    expect(html).toContain("Missing information");
    expect(html).toContain("Updated");
  });

  it("shows 'No clear best option' instead of a badge/highlight when the top spot is tied", () => {
    const rows = [
      makeRow({ id: "a", price: 60, freshnessMinutesAgo: 5 }),
      makeRow({ id: "b", price: 60, freshnessMinutesAgo: 5 }),
    ];
    const html = renderPriorityTabs(rows, { priority: "lowest-cost" });

    expect(html).toContain(NO_RECOMMENDATION_TEXT);
    expect(html).not.toContain("Recommended");
  });
});

describe("PriorityTabs — priority tabs", () => {
  it("renders a link (not a client-side button) for every supported priority, marking the active one", () => {
    const rows = [makeRow({ id: "a" })];
    const html = renderPriorityTabs(rows, { priority: "best-condition" });

    for (const key of ALL_PRIORITIES) {
      expect(html).toContain(`href="/compare/cp-1?priority=${key}"`);
    }
    expect(html).toContain(PRIORITY_LABELS["lowest-cost"]);
    expect(html).toContain('aria-selected="true"');
  });

  it("omits Best protection from the tab list when the caller excludes it (no structured protection data)", () => {
    const rows = [makeRow({ id: "a" })];
    const html = renderPriorityTabs(rows, {
      priorityKeys: ["best-overall", "lowest-cost", "fastest-delivery", "best-condition"],
    });

    expect(html).not.toContain(`priority=best-protection`);
    expect(html).not.toContain(PRIORITY_LABELS["best-protection"]);
  });
});

describe("PriorityTabs — offer card, View offer visibility", () => {
  it("shows View offer linking to /go/<id> when the listing has a valid URL", () => {
    const rows = [makeRow({ id: "a", url: "https://example.com/offer" })];
    const html = renderPriorityTabs(rows);

    expect(html).toContain("View offer");
    expect(html).toContain('href="/go/a"');
    expect(html).toContain("Total Known Cost");
    expect(html).toContain("Completeness:");
    expect(html).toContain("More details");
  });

  it("hides View offer when the listing has no valid URL", () => {
    const rows = [makeRow({ id: "a", url: undefined })];
    const html = renderPriorityTabs(rows);

    expect(html).not.toContain('href="/go/a"');
    expect(html).toContain("Total Known Cost");
    expect(html).toContain("More details");
  });
});

describe("PriorityTabs — offer card, stale listing", () => {
  it("shows a neutral freshness badge (no warning) at the ranking-stale threshold — too recent for a shopper-facing warning", () => {
    const rows = [makeRow({ id: "a", freshnessMinutesAgo: FRESHNESS_STALE_MINUTES })];
    const html = renderPriorityTabs(rows);

    expect(html).not.toContain("May need refresh");
    expect(html).not.toContain("Data may be outdated");
  });

  it("shows the outdated-data badge once an offer is genuinely old", () => {
    const rows = [makeRow({ id: "a", freshnessMinutesAgo: FRESHNESS_OUTDATED_MINUTES })];
    const html = renderPriorityTabs(rows);

    expect(html).toContain("Data may be outdated");
  });
});

describe("PriorityTabs — offer card, comparable-source listing (different merchant than the sync feed)", () => {
  it("uses the brand fallback logo and hides the source-type line when the merchant differs from the connector", () => {
    const rows = [
      makeRow({
        id: "a",
        sourceName: "Best Buy",
        hasDistinctSeller: true,
        sourceTypeLabel: "",
      }),
    ];
    const html = renderPriorityTabs(rows);
    const fallbackFilename = BRAND_FALLBACK_IMAGE.split("/").pop()!;

    expect(html).toContain(fallbackFilename);
    expect(html).toContain("Best Buy");
    expect(html).not.toContain("Affiliate feed");
  });
});

describe("PriorityTabs — offer card, different conditions", () => {
  it("renders each listing's own condition label distinctly", () => {
    const rows = [
      makeRow({ id: "new", condition: "new" }),
      makeRow({ id: "open-box", condition: "open-box" }),
      makeRow({ id: "used", condition: "used" }),
      makeRow({ id: "refurb", condition: "certified-refurbished" }),
    ];
    const html = renderPriorityTabs(rows);

    expect(html).toContain("New");
    expect(html).toContain("Open-box");
    expect(html).toContain("Used");
    expect(html).toContain("Refurbished");
  });
});

describe("PriorityTabs — offer card, no delivery data", () => {
  it("shows the honest delivery fallback instead of a fabricated estimate", () => {
    const rows = [
      makeRow({ id: "a", deliveryLabel: FALLBACK_COPY.delivery, pickupAvailable: false }),
    ];
    const html = renderPriorityTabs(rows);

    expect(html).toContain(FALLBACK_COPY.delivery);
  });
});

describe("PriorityTabs — sticky horizontal sort chips", () => {
  it("renders a scrollable chip tablist with the active priority selected", () => {
    const rows = [makeRow({ id: "a" })];
    const html = renderPriorityTabs(rows, { priority: "lowest-cost" });

    expect(html).toContain(PRIORITY_LABELS["lowest-cost"]);
    expect(html).toContain('role="tablist"');
    expect(html).toContain("priority-sort-chips");
    expect(html).toContain('aria-selected="true"');
  });

  it("does not mount a sort dialog by default", () => {
    const rows = [makeRow({ id: "a" })];
    const html = renderPriorityTabs(rows);
    expect(html).not.toContain('role="dialog"');
  });
});

describe("PriorityTabs — offer card, touch targets and overflow", () => {
  it("gives View offer and Why this option a 44px minimum touch target", () => {
    const rows = [makeRow({ id: "a", url: "https://example.com/offer" })];
    const html = renderPriorityTabs(rows);
    // Both the CTA link and the text link carry the min-height utility.
    expect(html.match(/min-h-11/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("never emits a fixed pixel width that could force horizontal overflow on a 320px viewport", () => {
    const rows = [makeRow({ id: "a" })];
    const html = renderPriorityTabs(rows);
    // No inline style or class asserting a fixed width wider than the
    // narrowest supported viewport (320px minus card padding).
    expect(html).not.toMatch(/width:\s*(3\d{2}|[4-9]\d{2}|\d{4,})px/);
  });
});

describe("PriorityTabs — offer card, progressive disclosure", () => {
  it("keeps source-type text available under More details", () => {
    const rows = [makeRow({ id: "a", sourceTypeLabel: "Affiliate feed" })];
    const html = renderPriorityTabs(rows);

    expect(html).toContain("Source details");
    expect(html).toContain("Affiliate feed");
    expect(html).toContain("More details");
    expect(html).toContain("<details");
  });
});
