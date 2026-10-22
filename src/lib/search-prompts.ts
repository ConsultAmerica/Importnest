export type ExampleSearch = { label: string; query: string };

/** Homepage "example searches" shortcuts — each goes through the same search flow as typed input. */
export const EXAMPLE_SEARCHES: ExampleSearch[] = [
  {
    label: "Quiet dishwasher under $900 with delivery this week",
    query: "Quiet dishwasher under $900 with delivery this week",
  },
  { label: "College backpack under $100", query: "College backpack under $100" },
  { label: "Compare iPhone offers", query: "iPhone" },
  { label: "Best laptop for university", query: "Best laptop for university" },
];

/** Empty-header suggestions. Each submits through the same natural-language search. */
export const HEADER_PROMPT_PILLS: ExampleSearch[] = [
  { label: "Best air purifiers under $250", query: "Best air purifiers under $250" },
  { label: "Quiet bedroom humidifiers", query: "Quiet bedroom humidifiers" },
  { label: "Running shoes with free shipping", query: "Running shoes with free shipping" },
];

export type QuickFilter = { id: string; label: string; href: string };

/**
 * Homepage quick-filters below the search bar. Each maps to a REAL browse
 * filter on /search/results (Total Known Cost price cap, free shipping,
 * rating, or sort) — no invented data. Kept here so the mapping stays in one
 * place and matches the search-results param contract.
 */
export const HERO_QUICK_FILTERS: QuickFilter[] = [
  { id: "under-100", label: "Under $100", href: "/search/results?priceMax=100&sort=lowest_cost" },
  { id: "under-500", label: "Under $500", href: "/search/results?priceMax=500&sort=lowest_cost" },
  { id: "free-shipping", label: "Free shipping", href: "/search/results?freeShipping=1" },
  { id: "top-rated", label: "Highest rated", href: "/search/results?ratingMin=4&sort=best_rated" },
  { id: "fastest", label: "Fast delivery", href: "/search/results?sort=fastest" },
  { id: "lowest-cost", label: "Lowest total cost", href: "/search/results?sort=lowest_cost" },
];
