/**
 * Shared category visual metadata for homepage cards, clarify flow,
 * search results headers, and empty states. Keep image paths and copy here —
 * do not duplicate mappings in UI components.
 */

export const categoryImages: Record<string, string> = {
  electronics: "/images/categories/electronics.png",
  appliances: "/images/categories/appliances.png",
  kitchen: "/images/categories/kitchen.png",
  footwear: "/images/categories/footwear.png",
  beauty: "/images/categories/beauty.png",
  accessories: "/images/categories/accessories.png",
  automotive: "/images/categories/automotive.png",
  outdoors: "/images/categories/outdoors.png",
  home: "/images/categories/home.png",
};

export const categoryDescriptions: Record<string, string> = {
  electronics:
    "Compare phones, laptops, tablets, headphones, cameras, and gaming accessories.",
  appliances:
    "Compare dishwashers, refrigerators, vacuums, microwaves, and laundry appliances.",
  kitchen:
    "Compare cookware, blenders, coffee makers, knives, and everyday kitchen essentials.",
  footwear:
    "Compare running shoes, sneakers, boots, sandals, and everyday footwear.",
  beauty:
    "Compare hair dryers, stylers, shavers, mirrors, and personal-care devices.",
  accessories:
    "Compare bags, chargers, cases, wallets, and everyday add-ons.",
  automotive:
    "Compare dash cams, mounts, chargers, mats, and car care essentials.",
  outdoors:
    "Compare backpacks, tents, coolers, bottles, and outdoor gear.",
  home:
    "Compare lighting, storage, textiles, and home essentials.",
};

/**
 * Curated department-style subcategory labels shown as chips on the homepage
 * category cards (Amazon-style browsing hint) — informational navigation
 * copy, not a claim about specific inventory, same editorial status as
 * `categoryDescriptions` above.
 */
export const categorySubcategories: Record<string, string[]> = {
  electronics: ["Phones", "Laptops", "Tablets", "Audio"],
  appliances: ["Dishwashers", "Refrigerators", "Vacuums", "Laundry"],
  kitchen: ["Cookware", "Blenders", "Coffee makers", "Knives"],
  footwear: ["Running", "Sneakers", "Boots", "Sandals"],
  beauty: ["Hair dryers", "Stylers", "Shavers", "Mirrors"],
  accessories: ["Bags", "Chargers", "Cases", "Wallets"],
  automotive: ["Dash cams", "Mounts", "Chargers", "Car care"],
  outdoors: ["Backpacks", "Tents", "Coolers", "Bottles"],
  home: ["Lighting", "Storage", "Textiles", "Essentials"],
};

const CATEGORY_TITLES: Record<string, string> = {
  electronics: "Electronics",
  appliances: "Appliances",
  kitchen: "Kitchen",
  footwear: "Footwear",
  beauty: "Beauty Devices",
  accessories: "Accessories",
  automotive: "Automotive",
  outdoors: "Outdoors",
  home: "Home & garden",
};

/** Slugs used in nav/DB that alias onto the visual key set above. */
const CATEGORY_ALIASES: Record<string, string> = {
  "beauty-devices": "beauty",
  headphones: "electronics",
  audio: "electronics",
  "leisure-outdoors": "outdoors",
  leisure: "outdoors",
};

/**
 * Categories known to have image files on disk. Keys without a file still
 * resolve a path for the mapping, but `categoryHasImage` reports false so the
 * UI can show a neutral placeholder instead of a broken <img>.
 */
const CATEGORIES_WITH_IMAGE_FILES = new Set([
  "electronics",
  "appliances",
  "kitchen",
  "footwear",
  "beauty",
  "accessories",
  "automotive",
  "outdoors",
  "home",
]);

export function normalizeCategoryKey(category: string): string {
  const raw = category.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return CATEGORY_ALIASES[raw] ?? raw;
}

/** Short internal key → canonical long-form slug used in URLs, nav, and the database. */
const CANONICAL_URL_SLUG: Record<string, string> = {
  beauty: "beauty-devices",
};

/**
 * Canonical DB/URL-facing category slug (e.g. "beauty-devices"), matching
 * Category.slug. Accepts any casing/separator/alias variant — "Beauty",
 * "Beauty Devices", "beauty_devices", and "beauty-devices" all resolve here.
 * Use this wherever a category slug is sent to the database or built into a link.
 *
 * "all" (any case), empty string, null, and undefined all mean "no category
 * filter" — they resolve to `undefined` rather than a literal (and
 * non-existent) "all" category slug that would silently return zero products.
 */
export function normalizeCategorySlug(
  category: string | null | undefined,
): string | undefined {
  const trimmed = category?.trim();
  if (!trimmed || trimmed.toLowerCase() === "all") return undefined;
  const key = normalizeCategoryKey(trimmed);
  return CANONICAL_URL_SLUG[key] ?? key;
}

export function categoryDisplayTitle(category: string, title?: string): string {
  if (title?.trim()) return title.trim();
  const key = normalizeCategoryKey(category);
  return CATEGORY_TITLES[key] ?? category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function categoryDescriptionFor(category: string, description?: string): string {
  if (description?.trim()) return description.trim();
  const key = normalizeCategoryKey(category);
  return categoryDescriptions[key] ?? "Browse approved offers in this category.";
}

/** Image path when mapped; null when the category is unknown. */
export function categoryImageSrc(category: string): string | null {
  const key = normalizeCategoryKey(category);
  return categoryImages[key] ?? null;
}

/** True when we expect a real file behind the mapped path. */
export function categoryHasImage(category: string): boolean {
  const key = normalizeCategoryKey(category);
  return CATEGORIES_WITH_IMAGE_FILES.has(key) && Boolean(categoryImages[key]);
}

export function categoryImageAlt(category: string, title?: string): string {
  return `${categoryDisplayTitle(category, title)} category image`;
}

/** Up to 4 department-style subcategory chip labels for a category card. */
export function categorySubcategoriesFor(category: string): string[] {
  const key = normalizeCategoryKey(category);
  return categorySubcategories[key] ?? [];
}

/** Stable list of shoppable category slugs (canonical keys). */
export const SHOP_CATEGORY_SLUGS = [
  "electronics",
  "appliances",
  "kitchen",
  "footwear",
  "beauty",
  "accessories",
  "automotive",
  "outdoors",
  "home",
] as const;

export type ShopCategorySlug = (typeof SHOP_CATEGORY_SLUGS)[number];

/** Related departments for category browse chips — excludes the current category. */
const RELATED_BY_CATEGORY: Record<string, ShopCategorySlug[]> = {
  electronics: ["appliances", "accessories", "home", "kitchen"],
  appliances: ["kitchen", "home", "electronics", "beauty"],
  kitchen: ["appliances", "home", "beauty", "accessories"],
  footwear: ["accessories", "outdoors", "beauty", "home"],
  beauty: ["accessories", "electronics", "kitchen", "home"],
  accessories: ["electronics", "footwear", "automotive", "beauty"],
  automotive: ["electronics", "outdoors", "accessories", "home"],
  outdoors: ["footwear", "automotive", "home", "accessories"],
  home: ["appliances", "kitchen", "outdoors", "electronics"],
};

export function relatedCategorySlugs(category: string, limit = 6): ShopCategorySlug[] {
  const key = normalizeCategoryKey(category);
  const preferred = RELATED_BY_CATEGORY[key] ?? [];
  const rest = SHOP_CATEGORY_SLUGS.filter((s) => s !== key && !preferred.includes(s));
  return [...preferred, ...rest].filter((s) => s !== key).slice(0, limit);
}
