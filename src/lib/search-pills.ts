import { parseQueryHeuristics, type SearchIntent } from "@/lib/search-intent";

export type SearchFilterPill = {
  id: string;
  label: string;
  /** Instant results URL — never invents filters beyond what the query implies. */
  href: string;
};

const PRODUCT_TYPE_PATTERNS: [RegExp, string, string?][] = [
  [/\bdishwashers?\b/i, "Dishwasher", "dishwasher"],
  [/\blaptops?\b/i, "Laptop", "laptop"],
  [/\bphones?\b|\bsmartphones?\b/i, "Phone", "smartphone"],
  [/\bheadphones?\b|\bearbuds?\b/i, "Headphones", "headphones"],
  [/\btvs?\b|\btelevisions?\b/i, "TV", "tv"],
  [/\bvacuums?\b/i, "Vacuum", "vacuum"],
  [/\brefrigerators?\b|\bfridges?\b/i, "Refrigerator", "refrigerator"],
  [/\bwashers?\b|\bwashing machines?\b/i, "Washer", "washing machine"],
  [/\bsneakers?\b|\brunning shoes?\b/i, "Footwear", "running shoes"],
  [/\bair purifiers?\b/i, "Air purifier", "air purifier"],
  [/\bhumidifiers?\b/i, "Humidifier", "humidifier"],
];

function resultsHref(params: Record<string, string>): string {
  const next = new URLSearchParams(params);
  return `/search/results?${next.toString()}`;
}

function conditionLabel(condition: SearchIntent["condition"]): string | null {
  switch (condition) {
    case "new":
      return "New";
    case "open_box":
      return "Open box";
    case "refurbished":
      return "Refurbished";
    case "used":
      return "Used";
    default:
      return null;
  }
}

export function productTypeFromQuery(query: string): { label: string; q: string } | null {
  for (const [pattern, label, q] of PRODUCT_TYPE_PATTERNS) {
    if (pattern.test(query)) return { label, q: q ?? label.toLowerCase() };
  }
  return null;
}

/**
 * Turn free-text query heuristics into clickable filter pills for the search UI.
 * Never invents attributes that were not present in the typed query.
 */
export function intentPillsFromQuery(query: string): SearchFilterPill[] {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const intent = parseQueryHeuristics(trimmed);
  const pills: SearchFilterPill[] = [];

  if (intent.budgetMax != null) {
    pills.push({
      id: "budgetMax",
      label: `Max: $${intent.budgetMax}`,
      href: resultsHref({ q: trimmed, priceMax: String(intent.budgetMax), sort: "lowest_cost" }),
    });
  }

  const type = productTypeFromQuery(trimmed);
  if (type) {
    pills.push({
      id: "type",
      label: `Type: ${type.label}`,
      href: resultsHref({ q: type.q }),
    });
  }

  const condition = conditionLabel(intent.condition);
  if (condition && intent.condition && intent.condition !== "any") {
    pills.push({
      id: "condition",
      label: `Condition: ${condition}`,
      href: resultsHref({ q: trimmed, condition: intent.condition }),
    });
  }

  if (intent.deliveryBy) {
    const delivery = intent.deliveryBy.replace(/\b\w/g, (c) => c.toUpperCase());
    pills.push({
      id: "delivery",
      label: `Delivery: ${delivery}`,
      href: resultsHref({ q: trimmed, sort: "fastest" }),
    });
  }

  if (/\bfree shipping\b/i.test(trimmed)) {
    pills.push({
      id: "freeShipping",
      label: "Free shipping",
      href: resultsHref({ q: trimmed, freeShipping: "1" }),
    });
  }

  return pills;
}
