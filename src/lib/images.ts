/** Stable image paths for categories, homepage rails, and retailer sources.
 * Product photo resolution lives in `@/lib/product-images` — import that for
 * getProductDisplayImage / productImageFor / subtype fallbacks.
 */

import {
  categoryImageSrc,
  categoryImages as sharedCategoryImages,
  normalizeCategoryKey,
} from "@/lib/category-visuals";
import { BRAND_FALLBACK_IMAGE, productImageFor } from "@/lib/product-images";

export {
  BRAND_FALLBACK_IMAGE,
  PRODUCT_IMAGE_SIZE,
  categoryFallbackImage,
  getProductDisplayImage,
  imageForSubtype,
  isBrandFallbackImage,
  productImageAlt,
  productImageFallbacks,
  productImageFor,
  productImages,
  productThumbClass,
  subtypeFallbackImage,
  type ProductImageSource,
} from "@/lib/product-images";

/** Homepage Top Products imagery. */
export const homeTopProductImages: Record<string, string> = Object.fromEntries(
  Object.entries({
    "cp-apex-ah4200": "dishwasher.png",
    "cp-air-purifier": "air-purifier.png",
    "cp-running-shoe": "running-shoe.png",
    "cp-cordless-vacuum": "cordless-vacuum.png",
  }).map(([id, file]) => [id, `/images/home/top-products/${file}`]),
);

/** Homepage Best Deals imagery. */
export const homeDealImages: Record<string, string> = Object.fromEntries(
  Object.entries({
    "cp-apex-ah4200": "dishwasher.png",
    "cp-air-purifier": "air-purifier.png",
    "cp-running-shoe": "running-shoe.png",
    "cp-cordless-vacuum": "cordless-vacuum.png",
  }).map(([id, file]) => [id, `/images/home/deals/${file}`]),
);

/** Shared category paths — single source in category-visuals.ts. */
export const categoryImages: Record<string, string> = {
  ...sharedCategoryImages,
  /** Extra homepage/nav key kept for audio browsing cards. */
  headphones: "/images/categories/headphones.png",
};

/**
 * Homepage Shop by Category imagery.
 * Prefer home-specific assets when present; otherwise shared category visuals.
 */
export const homeCategoryImages: Record<string, string> = {
  headphones: "/images/home/categories/headphones.png",
  outdoors: "/images/home/categories/outdoors.png",
  automotive: "/images/home/categories/automotive.png",
  appliances: "/images/home/categories/appliances.png",
  electronics: "/images/home/categories/electronics.png",
};

/** Representative subtype thumbs for category visual collages. */
export const categoryCollageImages: Record<string, string[]> = {
  electronics: [
    "/images/products/electronics/phone.jpg",
    "/images/products/electronics/laptop.jpg",
    "/images/products/electronics/headphones.jpg",
    "/images/products/electronics/tablet.jpg",
  ],
  appliances: [
    "/images/products/appliances/microwave.jpg",
    "/images/products/appliances/dishwasher.jpg",
    "/images/products/appliances/coffee-maker.jpg",
    "/images/products/appliances/air-fryer.jpg",
  ],
  kitchen: [
    "/images/products/kitchen/cookware.jpg",
    "/images/products/kitchen/blender.jpg",
    "/images/products/kitchen/coffee-machine.jpg",
    "/images/products/kitchen/kettle.jpg",
  ],
  beauty: [
    "/images/products/beauty/hair-dryer.jpg",
    "/images/products/beauty/electric-shaver.jpg",
    "/images/products/beauty/facial-cleansing-brush.jpg",
    "/images/products/beauty/led-mirror.jpg",
  ],
  footwear: [
    "/images/products/footwear/running-shoe.jpg",
    "/images/products/footwear/hiking-boot.jpg",
    "/images/products/footwear/sandal.jpg",
    "/images/products/footwear/loafer.jpg",
  ],
  accessories: [
    "/images/products/accessories/wallet.jpg",
    "/images/products/accessories/backpack.jpg",
    "/images/products/accessories/sunglasses.jpg",
    "/images/products/accessories/phone-case.jpg",
  ],
  automotive: [
    "/images/products/automotive/dash-cam.jpg",
    "/images/products/automotive/phone-mount.jpg",
    "/images/products/automotive/jump-starter.jpg",
    "/images/products/automotive/floor-mats.jpg",
  ],
  outdoors: [
    "/images/products/outdoors/tent.jpg",
    "/images/products/outdoors/daypack.jpg",
    "/images/products/outdoors/lantern.jpg",
    "/images/products/outdoors/cooler.jpg",
  ],
  home: [
    "/images/products/home/blanket.jpg",
    "/images/products/home/table-lamp.jpg",
    "/images/products/home/storage-bins.jpg",
    "/images/products/home/air-purifier.jpg",
  ],
};

/**
 * Collage thumbs for category visual cards.
 * When query suggests kitchen + appliances category, prefer kitchen-appliance set.
 */
export function getCategoryCollageImages(
  categorySlug: string,
  query?: string | null,
): string[] {
  const key = normalizeCategoryKey(categorySlug);
  const q = (query ?? "").toLowerCase();

  if (key === "appliances" && q.includes("kitchen")) {
    return [
      "/images/products/appliances/microwave.jpg",
      "/images/products/appliances/dishwasher.jpg",
      "/images/products/appliances/coffee-maker.jpg",
      "/images/products/appliances/air-fryer.jpg",
    ];
  }

  return categoryCollageImages[key] ?? [categoryImageFor(key)];
}

/** Resolve a category image for cards/headers — never returns a broken path. */
export function categoryImageFor(category: string, fallback = BRAND_FALLBACK_IMAGE) {
  const key = normalizeCategoryKey(category);
  return (
    homeCategoryImages[key] ??
    categoryImageSrc(key) ??
    categoryImages[key] ??
    categoryImages[category] ??
    fallback
  );
}

export const emptyStateImage = "/images/empty-states/saved-watchlist.svg";

export function homeTopProductImageFor(
  productId: string,
  categorySlug?: string,
  title?: string | null,
) {
  return (
    homeTopProductImages[productId] ?? productImageFor(productId, categorySlug, title)
  );
}

export function homeDealImageFor(
  productId: string,
  categorySlug?: string,
  title?: string | null,
) {
  return homeDealImages[productId] ?? productImageFor(productId, categorySlug, title);
}

/** Retailer / connector logos for listings loaded from the backend. */
export const sourceImages: Record<string, string> = {
  "src-official": "/sources/brands/apex-home.svg",
  "src-retailer-direct": "/sources/retailer-direct.svg",
  "src-local-electronics": "/sources/brands/local-apex-dealer.svg",
  "src-authorized-outlet": "/sources/authorized-outlet.svg",
  "src-discount-home": "/sources/brands/wayfair.svg",
  "src-amazon": "/sources/brands/amazon.svg",
  "src-idealo": "/sources/brands/idealo.svg",
  "src-google-shopping": "/sources/brands/google-shopping.svg",
  "src-ebay": "/sources/brands/ebay.svg",
};

export function sourceImageFor(sourceId: string) {
  return sourceImages[sourceId] ?? BRAND_FALLBACK_IMAGE;
}
