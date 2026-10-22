import { describe, expect, it } from "vitest";
import { handoffHtml } from "@/lib/handoff-page";

const base = {
  merchant: "Amazon",
  url: "https://www.amazon.com/dp/B000TEST",
  total: 234.5,
  item: 220,
  shipping: 14.5,
  fees: 0,
};

describe("handoffHtml", () => {
  it("names the retailer, the compared total and its makeup", () => {
    const html = handoffHtml(base);
    expect(html).toContain("Taking you to Amazon…");
    expect(html).toContain("$234.50");
    expect(html).toContain("item $220.00 + $14.50 shipping");
  });

  it("never claims a guaranteed price and says checkout is on the retailer's site", () => {
    const html = handoffHtml(base);
    expect(html).not.toMatch(/locked in|guarantee/i);
    expect(html).toContain("Checkout happens on Amazon’s site");
    expect(html).toContain("can change");
  });

  it("says when shipping was not disclosed instead of implying it is free", () => {
    const html = handoffHtml({ ...base, shipping: null, total: 220 });
    expect(html).toContain("shipping not disclosed");
    expect(html).not.toContain("free shipping");
  });

  it("redirects with a JS timer and a no-JS meta refresh", () => {
    const html = handoffHtml(base);
    expect(html).toContain('http-equiv="refresh" content="1.5;url=https://www.amazon.com/dp/B000TEST"');
    expect(html).toContain("location.replace(");
  });

  it("escapes retailer names and URLs so they cannot inject markup or break out of the script", () => {
    const html = handoffHtml({
      ...base,
      merchant: '<img src=x onerror="alert(1)">',
      url: "https://evil.example/</script><script>alert(1)</script>",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
    expect(html).not.toContain("</script><script>alert(1)");
  });
});
