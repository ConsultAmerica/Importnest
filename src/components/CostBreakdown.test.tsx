import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CostBreakdown } from "@/components/CostBreakdown";

const fullData = {
  itemPrice: 899,
  shipping: 0,
  mandatoryFees: 12.5,
  verifiedDiscount: 20,
  totalKnownCost: 891.5,
};

describe("CostBreakdown — full data", () => {
  it("renders every line item with real values", () => {
    const html = renderToStaticMarkup(<CostBreakdown {...fullData} />);
    expect(html).toContain("$899.00");
    expect(html).toContain("$0.00");
    expect(html).toContain("$12.50");
    expect(html).toContain("-$20.00");
    expect(html).toContain("$891.50");
    expect(html).toContain("Taxes may be calculated at checkout");
    expect(html).not.toContain("Not provided");
  });
});

describe("CostBreakdown — missing shipping", () => {
  it("shows 'Not provided' instead of a fabricated $0.00", () => {
    const html = renderToStaticMarkup(<CostBreakdown {...fullData} shipping={null} />);
    expect(html).toContain("Not provided");
    expect(html).toContain("Shipping");
    expect(html).toContain("from $891.50, shipping not disclosed");
  });
});

describe("CostBreakdown — missing mandatory fees", () => {
  it("shows 'Not provided' for fees while other lines stay real", () => {
    const html = renderToStaticMarkup(<CostBreakdown {...fullData} mandatoryFees={undefined} />);
    expect(html).toContain("Not provided");
    expect(html).toContain("$899.00");
  });
});

describe("CostBreakdown — discount", () => {
  it("shows the verified discount as a signed reduction", () => {
    const html = renderToStaticMarkup(<CostBreakdown {...fullData} verifiedDiscount={15} />);
    expect(html).toContain("-$15.00");
  });
});

describe("CostBreakdown — estimated values", () => {
  it("labels an estimated line item without hiding its amount", () => {
    const html = renderToStaticMarkup(
      <CostBreakdown {...fullData} shipping={{ amount: 8, estimated: true }} />,
    );
    expect(html).toContain("$8.00");
    expect(html).toContain("Estimated");
  });
});

describe("CostBreakdown — invalid negative values", () => {
  it("treats a negative item price as not provided rather than showing a negative price", () => {
    const html = renderToStaticMarkup(<CostBreakdown {...fullData} itemPrice={-50} />);
    expect(html).toContain("Not provided");
    expect(html).not.toContain("-$50.00");
  });
});

describe("CostBreakdown — total emphasis", () => {
  it("renders total known cost with stronger emphasis styling than the other lines", () => {
    const html = renderToStaticMarkup(<CostBreakdown {...fullData} />);
    const totalIndex = html.indexOf("Total known cost");
    const itemPriceIndex = html.indexOf("Item price");
    expect(totalIndex).toBeGreaterThan(-1);
    // The total row uses the bold/emphasized price styling; the item-price row does not.
    const totalRow = html.slice(totalIndex, totalIndex + 400);
    const itemRow = html.slice(itemPriceIndex, itemPriceIndex + 400);
    expect(totalRow).toContain("price-text");
    expect(itemRow).not.toContain("price-text");
  });
});
