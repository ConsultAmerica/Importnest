import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OfferActions, type OfferActionsListing, type OfferActionsProduct } from "@/components/OfferActions";

function makeProduct(overrides: Partial<OfferActionsProduct> = {}): OfferActionsProduct {
  return {
    productId: "cp-x-tablet",
    productName: "Aria 11 Tablet",
    brandName: "Aria",
    imageUrl: "/images/products/tablet.png",
    ...overrides,
  };
}

function makeListing(overrides: Partial<OfferActionsListing> = {}): OfferActionsListing {
  return {
    id: "listing-1",
    sourceName: "Example Retailer",
    condition: "new",
    price: 100,
    shipping: 5,
    fees: 2,
    url: "https://example.com/offer",
    ...overrides,
  };
}

describe("OfferActions — View retailer offer", () => {
  it("renders it only when the listing has a valid url, opening safely in a new tab", () => {
    const html = renderToStaticMarkup(
      <OfferActions product={makeProduct()} listing={makeListing({ url: "https://example.com/offer" })} />,
    );
    expect(html).toContain("View offer on");
    expect(html).toContain('href="/go/listing-1"');
    expect(html).toContain('target="_blank"');
    // Hand-off expectation: checkout happens on the retailer's site.
    expect(html).toContain("finish checkout on");
    expect(html).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(html).toMatch(/rel="[^"]*noreferrer[^"]*"/);
  });

  it("hides it when the listing has no url — never a dead or fake link", () => {
    const html = renderToStaticMarkup(
      <OfferActions product={makeProduct()} listing={makeListing({ url: undefined })} />,
    );
    expect(html).not.toContain("View offer on");
  });

  it("hides it when the caller explicitly says canViewRetailerOffer is false even if a url is present", () => {
    const html = renderToStaticMarkup(
      <OfferActions
        product={makeProduct()}
        listing={makeListing({ url: "https://example.com/offer" })}
        canViewRetailerOffer={false}
      />,
    );
    expect(html).not.toContain("View offer on");
  });

  it("never emits a bare '#' href anywhere in the action row", () => {
    const html = renderToStaticMarkup(
      <OfferActions product={makeProduct()} listing={makeListing()} canRefreshPrice />,
    );
    expect(html).not.toMatch(/href="#"/);
  });
});

describe("OfferActions — Add this offer to cart", () => {
  it("renders the offer-level cart button by default, keyed to this exact listing", () => {
    const html = renderToStaticMarkup(<OfferActions product={makeProduct()} listing={makeListing()} />);
    expect(html).toContain("Save offer for later");
  });

  it("hides Add this offer to cart when canAddToCart is false (e.g. missing listing id or price upstream)", () => {
    const html = renderToStaticMarkup(
      <OfferActions product={makeProduct()} listing={makeListing()} canAddToCart={false} />,
    );
    expect(html).not.toContain("Save offer for later");
  });
});

describe("OfferActions — Refresh price", () => {
  it("is hidden by default (no fake/working-looking button when refresh isn't warranted)", () => {
    const html = renderToStaticMarkup(<OfferActions product={makeProduct()} listing={makeListing()} />);
    expect(html).not.toContain("Refresh");
  });

  it("renders a real refresh action only when canRefreshPrice is true", () => {
    const html = renderToStaticMarkup(
      <OfferActions product={makeProduct()} listing={makeListing()} canRefreshPrice />,
    );
    expect(html).toContain("Refresh");
  });
});

describe("OfferActions — Why this option", () => {
  it("opens an expandable explanation built from real ranking data when provided", () => {
    const html = renderToStaticMarkup(
      <OfferActions
        product={makeProduct()}
        listing={makeListing()}
        explanation={{
          label: "Lowest total cost",
          rationale: "Lowest total known cost because it has the lowest price.",
          factors: [{ label: "Lowest total known cost", detail: "$107.00 is lowest", positive: true }],
          missingInformation: ["Warranty details not provided by this source"],
        }}
      />,
    );
    expect(html).toContain("<details");
    expect(html).toContain("Why this option");
    expect(html).toContain("Lowest total known cost because it has the lowest price.");
    expect(html).toContain("Warranty details not provided by this source");
    expect(html).toContain(`href="/compare/cp-x-tablet/why/listing-1"`);
  });

  it("falls back to an honest generic explanation instead of inventing detail when data is limited", () => {
    const html = renderToStaticMarkup(
      <OfferActions product={makeProduct()} listing={makeListing()} explanation={null} />,
    );
    expect(html).toContain(
      "This option is shown because it is an approved-source offer with available price data.",
    );
    expect(html).not.toContain("warranty");
    expect(html).not.toContain("reviews");
  });

  it("hides Why this option entirely when canExplain is false", () => {
    const html = renderToStaticMarkup(
      <OfferActions product={makeProduct()} listing={makeListing()} canExplain={false} />,
    );
    expect(html).not.toContain("Why this option");
  });
});
