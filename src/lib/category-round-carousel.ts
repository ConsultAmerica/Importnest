/**
 * Round-image carousel tiles for category browse pages, covering every shop
 * category (Appliances, Electronics, Kitchen, Footwear, Beauty, Accessories,
 * Automotive, Outdoors, Home). Categories not in BUILDERS resolve to an empty
 * list, so CategoryRoundCarousel simply renders nothing for them.
 *
 * Subtype tiles use product PNGs under /images/subtypes/{category}/ with
 * transparent plates so the circle CSS white background shows through.
 * Reset tiles use lifestyle category collages.
 */

import type { CategoryImageMode, CategoryRoundCarouselItem } from "@/components/CategoryRoundCarousel";
import { categoryDisplayTitle, normalizeCategoryKey } from "@/lib/category-visuals";
import { categoryImageFor } from "@/lib/images";

const DEALS_BADGE_IMAGE = "/images/categories/deals-badge.svg";

type SubtypeDef = {
  /** Search keyword used both as the tile's slug and the `q` filter value. */
  query: string;
  label: string;
  /** Skin-filled subtype PNG (or lifestyle photo) for the circle tile. */
  imageUrl: string;
  imageMode: CategoryImageMode;
};

function subtypeHref(categorySlug: string, query: string): string {
  return `/search/results?category=${encodeURIComponent(categorySlug)}&q=${encodeURIComponent(query)}`;
}

function buildCategoryItems(categorySlug: string, subtypes: SubtypeDef[]): CategoryRoundCarouselItem[] {
  const fallback = categoryImageFor(categorySlug);

  const resetTile: CategoryRoundCarouselItem = {
    slug: "",
    label: categoryDisplayTitle(categorySlug),
    imageUrl: fallback,
    href: `/search/results?category=${encodeURIComponent(categorySlug)}`,
    // Department image is a wide lifestyle/collage photo — cropping to fill
    // the circle reads better than letterboxing it with object-fit: contain.
    imageMode: "lifestyle-cover",
  };

  const subtypeTiles: CategoryRoundCarouselItem[] = subtypes.map((s) => ({
    slug: s.query,
    label: s.label,
    imageUrl: s.imageUrl,
    href: subtypeHref(categorySlug, s.query),
    imageMode: s.imageMode,
  }));

  const dealsTile: CategoryRoundCarouselItem = {
    slug: "deals",
    label: "Best Deals",
    imageUrl: DEALS_BADGE_IMAGE,
    href: `/search/results?category=${encodeURIComponent(categorySlug)}&sort=lowest_cost`,
    badge: "Deals",
    imageMode: "transparent-contain",
  };

  return [resetTile, ...subtypeTiles, dealsTile];
}

/** Opaque skin-fill subtype PNG helper — keeps paths consistent and auditable. */
function subtypePng(category: string, file: string): string {
  // Query keeps browsers from reusing the old beige and dark studio plates.
  return `/images/subtypes/${category}/${file}.png?v=8`;
}

/** Opaque skin-fill tiles — cover edge-to-edge (no contain padding ring). */
const PHOTO: CategoryImageMode = "photo-cover";

const SUBTYPES: Record<string, SubtypeDef[]> = {
  appliances: [
    { query: "refrigerator", label: "Refrigerators", imageUrl: subtypePng("appliances", "refrigerator"), imageMode: PHOTO },
    { query: "washing machine", label: "Laundry", imageUrl: subtypePng("appliances", "washing-machine"), imageMode: PHOTO },
    { query: "cooking", label: "Cooking", imageUrl: subtypePng("appliances", "air-fryer"), imageMode: PHOTO },
    { query: "dishwasher", label: "Dishwashers", imageUrl: subtypePng("appliances", "dishwasher"), imageMode: PHOTO },
    { query: "freezer", label: "Freezers", imageUrl: subtypePng("appliances", "freezer"), imageMode: PHOTO },
    { query: "small appliance", label: "Small Appliances", imageUrl: subtypePng("appliances", "slow-cooker"), imageMode: PHOTO },
    { query: "vacuum", label: "Vacuum Cleaners", imageUrl: subtypePng("appliances", "vacuum"), imageMode: PHOTO },
    { query: "air purifier", label: "Air Purifiers", imageUrl: subtypePng("appliances", "air-purifier"), imageMode: PHOTO },
    { query: "coffee maker", label: "Coffee Machines", imageUrl: subtypePng("appliances", "coffee-maker"), imageMode: PHOTO },
    { query: "microwave", label: "Microwaves", imageUrl: subtypePng("appliances", "microwave"), imageMode: PHOTO },
  ],
  electronics: [
    { query: "smartphone", label: "Phones", imageUrl: subtypePng("electronics", "phone"), imageMode: PHOTO },
    { query: "laptop", label: "Laptops", imageUrl: subtypePng("electronics", "laptop"), imageMode: PHOTO },
    { query: "tablet", label: "Tablets", imageUrl: subtypePng("electronics", "tablet"), imageMode: PHOTO },
    { query: "headphones", label: "Headphones", imageUrl: subtypePng("electronics", "headphones"), imageMode: PHOTO },
    { query: "earbuds", label: "Earbuds", imageUrl: subtypePng("electronics", "earbuds"), imageMode: PHOTO },
    { query: "monitor", label: "Monitors", imageUrl: subtypePng("electronics", "monitor"), imageMode: PHOTO },
    { query: "smart watch", label: "Smartwatches", imageUrl: subtypePng("electronics", "smartwatch"), imageMode: PHOTO },
    { query: "speaker", label: "Speakers", imageUrl: subtypePng("electronics", "speaker"), imageMode: PHOTO },
    { query: "camera", label: "Cameras", imageUrl: subtypePng("electronics", "camera"), imageMode: PHOTO },
    { query: "gaming accessory", label: "Gaming", imageUrl: subtypePng("electronics", "gaming"), imageMode: PHOTO },
  ],
  kitchen: [
    { query: "cookware", label: "Cookware", imageUrl: subtypePng("kitchen", "cookware"), imageMode: PHOTO },
    { query: "blender", label: "Blenders", imageUrl: subtypePng("kitchen", "blender"), imageMode: PHOTO },
    { query: "coffee machine", label: "Coffee Machines", imageUrl: subtypePng("kitchen", "coffee-machine"), imageMode: PHOTO },
    { query: "knife set", label: "Knife Sets", imageUrl: subtypePng("kitchen", "knife-set"), imageMode: PHOTO },
    { query: "stand mixer", label: "Stand Mixers", imageUrl: subtypePng("kitchen", "stand-mixer"), imageMode: PHOTO },
    { query: "cutting board", label: "Cutting Boards", imageUrl: subtypePng("kitchen", "cutting-board"), imageMode: PHOTO },
    { query: "kettle", label: "Kettles", imageUrl: subtypePng("kitchen", "kettle"), imageMode: PHOTO },
    { query: "bakeware", label: "Bakeware", imageUrl: subtypePng("kitchen", "bakeware"), imageMode: PHOTO },
    { query: "food storage", label: "Food Storage", imageUrl: subtypePng("kitchen", "food-storage"), imageMode: PHOTO },
    { query: "kitchen organizer", label: "Organizers", imageUrl: subtypePng("kitchen", "organizer"), imageMode: PHOTO },
  ],
  footwear: [
    { query: "running shoe", label: "Running", imageUrl: subtypePng("footwear", "running-shoe"), imageMode: PHOTO },
    { query: "sneaker", label: "Sneakers", imageUrl: subtypePng("footwear", "sneaker"), imageMode: PHOTO },
    { query: "trail runner", label: "Trail Runners", imageUrl: subtypePng("footwear", "trail-runner"), imageMode: PHOTO },
    { query: "hiking boot", label: "Hiking Boots", imageUrl: subtypePng("footwear", "hiking-boot"), imageMode: PHOTO },
    { query: "sandal", label: "Sandals", imageUrl: subtypePng("footwear", "sandal"), imageMode: PHOTO },
    { query: "loafer", label: "Loafers", imageUrl: subtypePng("footwear", "loafer"), imageMode: PHOTO },
    { query: "winter boot", label: "Winter Boots", imageUrl: subtypePng("footwear", "winter-boot"), imageMode: PHOTO },
    { query: "training shoe", label: "Training", imageUrl: subtypePng("footwear", "training-shoe"), imageMode: PHOTO },
    { query: "casual shoe", label: "Casual", imageUrl: subtypePng("footwear", "casual-shoe"), imageMode: PHOTO },
    { query: "dress shoe", label: "Dress Shoes", imageUrl: subtypePng("footwear", "dress-shoe"), imageMode: PHOTO },
  ],
  beauty: [
    { query: "hair dryer", label: "Hair Dryers", imageUrl: subtypePng("beauty", "hair-dryer"), imageMode: PHOTO },
    { query: "facial cleansing brush", label: "Facial Brushes", imageUrl: subtypePng("beauty", "facial-cleansing-brush"), imageMode: PHOTO },
    { query: "electric shaver", label: "Shavers", imageUrl: subtypePng("beauty", "electric-shaver"), imageMode: PHOTO },
    { query: "skincare fridge", label: "Skincare Fridges", imageUrl: subtypePng("beauty", "skincare-fridge"), imageMode: PHOTO },
    { query: "curling iron", label: "Curling Irons", imageUrl: subtypePng("beauty", "curling-iron"), imageMode: PHOTO },
    { query: "hair straightener", label: "Straighteners", imageUrl: subtypePng("beauty", "hair-straightener"), imageMode: PHOTO },
    { query: "led mirror", label: "LED Mirrors", imageUrl: subtypePng("beauty", "led-mirror"), imageMode: PHOTO },
    { query: "massage tool", label: "Massage Tools", imageUrl: subtypePng("beauty", "massage-tool"), imageMode: PHOTO },
    { query: "manicure kit", label: "Manicure Kits", imageUrl: subtypePng("beauty", "manicure-kit"), imageMode: PHOTO },
    { query: "grooming kit", label: "Grooming Kits", imageUrl: subtypePng("beauty", "grooming-kit"), imageMode: PHOTO },
  ],
  accessories: [
    { query: "wallet", label: "Wallets", imageUrl: subtypePng("accessories", "wallet"), imageMode: PHOTO },
    { query: "backpack", label: "Backpacks", imageUrl: subtypePng("accessories", "backpack"), imageMode: PHOTO },
    { query: "phone case", label: "Phone Cases", imageUrl: subtypePng("accessories", "phone-case"), imageMode: PHOTO },
    { query: "sunglasses", label: "Sunglasses", imageUrl: subtypePng("accessories", "sunglasses"), imageMode: PHOTO },
    { query: "crossbody bag", label: "Crossbody Bags", imageUrl: subtypePng("accessories", "crossbody-bag"), imageMode: PHOTO },
    { query: "watch band", label: "Watch Bands", imageUrl: subtypePng("accessories", "watch-band"), imageMode: PHOTO },
    { query: "charging cable", label: "Charging Cables", imageUrl: subtypePng("accessories", "charging-cable"), imageMode: PHOTO },
    { query: "laptop sleeve", label: "Laptop Sleeves", imageUrl: subtypePng("accessories", "laptop-sleeve"), imageMode: PHOTO },
    { query: "wireless charger", label: "Wireless Chargers", imageUrl: subtypePng("accessories", "wireless-charger"), imageMode: PHOTO },
    { query: "travel organizer", label: "Travel Organizers", imageUrl: subtypePng("accessories", "travel-organizer"), imageMode: PHOTO },
  ],
  automotive: [
    { query: "dash cam", label: "Dash Cams", imageUrl: subtypePng("automotive", "dash-cam"), imageMode: PHOTO },
    { query: "phone mount", label: "Phone Mounts", imageUrl: subtypePng("automotive", "phone-mount"), imageMode: PHOTO },
    { query: "floor mats", label: "Floor Mats", imageUrl: subtypePng("automotive", "floor-mats"), imageMode: PHOTO },
    { query: "tire inflator", label: "Tire Inflators", imageUrl: subtypePng("automotive", "tire-inflator"), imageMode: PHOTO },
    { query: "car vacuum", label: "Car Vacuums", imageUrl: subtypePng("automotive", "car-vacuum"), imageMode: PHOTO },
    { query: "battery charger", label: "Battery Chargers", imageUrl: subtypePng("automotive", "battery-charger"), imageMode: PHOTO },
    { query: "seat cover", label: "Seat Covers", imageUrl: subtypePng("automotive", "seat-cover"), imageMode: PHOTO },
    { query: "windshield wipers", label: "Wipers", imageUrl: subtypePng("automotive", "wipers"), imageMode: PHOTO },
    { query: "tool kit", label: "Tool Kits", imageUrl: subtypePng("automotive", "tool-kit"), imageMode: PHOTO },
    { query: "jump starter", label: "Jump Starters", imageUrl: subtypePng("automotive", "jump-starter"), imageMode: PHOTO },
  ],
  outdoors: [
    { query: "hiking backpack", label: "Backpacks", imageUrl: subtypePng("outdoors", "hiking-backpack"), imageMode: PHOTO },
    { query: "tent", label: "Tents", imageUrl: subtypePng("outdoors", "tent"), imageMode: PHOTO },
    { query: "sleeping bag", label: "Sleeping Bags", imageUrl: subtypePng("outdoors", "sleeping-bag"), imageMode: PHOTO },
    { query: "camp stove", label: "Camp Stoves", imageUrl: subtypePng("outdoors", "camp-stove"), imageMode: PHOTO },
    { query: "water bottle", label: "Water Bottles", imageUrl: subtypePng("outdoors", "water-bottle"), imageMode: PHOTO },
    { query: "camping lantern", label: "Lanterns", imageUrl: subtypePng("outdoors", "lantern"), imageMode: PHOTO },
    { query: "outdoor chair", label: "Outdoor Chairs", imageUrl: subtypePng("outdoors", "outdoor-chair"), imageMode: PHOTO },
    { query: "cooler", label: "Coolers", imageUrl: subtypePng("outdoors", "cooler"), imageMode: PHOTO },
    { query: "picnic blanket", label: "Picnic Blankets", imageUrl: subtypePng("outdoors", "picnic-blanket"), imageMode: PHOTO },
    { query: "travel bag", label: "Travel Bags", imageUrl: subtypePng("outdoors", "travel-bag"), imageMode: PHOTO },
  ],
  home: [
    { query: "blanket", label: "Blankets", imageUrl: subtypePng("home", "blanket"), imageMode: PHOTO },
    { query: "table lamp", label: "Table Lamps", imageUrl: subtypePng("home", "table-lamp"), imageMode: PHOTO },
    { query: "storage bins", label: "Storage Bins", imageUrl: subtypePng("home", "storage-bins"), imageMode: PHOTO },
    { query: "throw pillows", label: "Throw Pillows", imageUrl: subtypePng("home", "throw-pillow"), imageMode: PHOTO },
    { query: "home air purifier", label: "Air Purifiers", imageUrl: subtypePng("home", "air-purifier"), imageMode: PHOTO },
    { query: "wall clock", label: "Wall Clocks", imageUrl: subtypePng("home", "wall-clock"), imageMode: PHOTO },
    { query: "diffuser", label: "Diffusers", imageUrl: subtypePng("home", "diffuser"), imageMode: PHOTO },
    { query: "curtains", label: "Curtains", imageUrl: subtypePng("home", "curtains"), imageMode: PHOTO },
    { query: "rug", label: "Rugs", imageUrl: subtypePng("home", "rug"), imageMode: PHOTO },
    { query: "home organizer", label: "Organizers", imageUrl: subtypePng("home", "organizer"), imageMode: PHOTO },
  ],
};

/** Round-carousel tiles for a category, or [] when that category isn't wired up yet. */
export function getCategoryRoundCarouselItems(categorySlug: string): CategoryRoundCarouselItem[] {
  const key = normalizeCategoryKey(categorySlug);
  const subtypes = SUBTYPES[key];
  return subtypes ? buildCategoryItems(categorySlug, subtypes) : [];
}

/**
 * Resolve which tile should be highlighted from the page's current `q` /
 * `sort` params — mirrors the same subtype-matching convention already used
 * by CategoryBrowseHeader's chip strip.
 */
export function activeRoundCarouselSlug(query: string | undefined, sort: string | undefined): string {
  const trimmedQuery = query?.trim().toLowerCase();
  if (trimmedQuery) return trimmedQuery;
  if (sort === "lowest_cost") return "deals";
  return "";
}
