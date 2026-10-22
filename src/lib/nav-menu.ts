/** Marketplace-style department menu (Idealo / Amazon / Google Shopping pattern). */

export type NavLink = {
  label: string;
  href: string;
  /** Highlight like Amazon "Today's Deals" */
  featured?: boolean;
};

export type NavDepartment = {
  id: string;
  name: string;
  href: string;
  items: NavLink[];
};

/**
 * Top strip — Home first.
 * Phones / Computers / Audio are NOT separate top-level items; they live under Electronics
 * (Idealo-style: https://www.idealo.co.uk/pcat/30311/electronics.html).
 */
export const topNavLinks: NavLink[] = [
  { label: "Home", href: "/search/results?category=home" },
  { label: "Electronics", href: "/search/results?category=electronics" },
  { label: "Appliances", href: "/search/results?category=appliances" },
  { label: "Kitchen", href: "/search/results?category=kitchen" },
  { label: "Footwear", href: "/search/results?category=footwear" },
  { label: "Beauty", href: "/search/results?category=beauty-devices" },
  { label: "Accessories", href: "/search/results?category=accessories" },
  { label: "Automotive", href: "/search/results?category=automotive" },
  { label: "Outdoors", href: "/search/results?category=outdoors" },
  { label: "Today's deals", href: "/search/results?sort=lowest_cost", featured: true },
];

/** Full "All" department flyout — Home first; Electronics nests phones/computers/audio. */
export const navDepartments: NavDepartment[] = [
  {
    id: "home",
    name: "Home & garden",
    href: "/search/results?category=home",
    items: [
      { label: "Air purifiers", href: "/search/results?category=home&q=home+air+purifier" },
      { label: "Smart home", href: "/search/results?category=home&q=smart+home" },
      { label: "Furniture", href: "/search/results?category=home&q=furniture" },
      { label: "Lighting", href: "/search/results?category=home&q=lighting" },
      { label: "Tools & DIY", href: "/search/results?category=home&q=tools" },
    ],
  },
  {
    id: "electronics",
    name: "Electronics",
    href: "/search/results?category=electronics",
    items: [
      // Telecommunications (Idealo)
      { label: "Mobile phones", href: "/search/results?category=electronics&q=smartphone" },
      { label: "Tablets", href: "/search/results?category=electronics&q=tablet" },
      { label: "Smart watches", href: "/search/results?category=electronics&q=smart+watch" },
      // Computing (Idealo)
      { label: "Laptops", href: "/search/results?category=electronics&q=laptop" },
      { label: "Desktop PCs", href: "/search/results?category=electronics&q=desktop" },
      { label: "Computer hardware", href: "/search/results?category=electronics&q=computer+hardware" },
      { label: "Monitors", href: "/search/results?category=electronics&q=monitor" },
      // Audio & TV (Idealo)
      { label: "Headphones", href: "/search/results?category=electronics&q=headphones" },
      { label: "Home audio & HiFi", href: "/search/results?category=electronics&q=speaker" },
      { label: "TVs", href: "/search/results?category=electronics&q=tv" },
      { label: "Cameras", href: "/search/results?category=electronics&q=camera" },
      { label: "Gaming", href: "/search/results?category=electronics&q=gaming+accessory" },
    ],
  },
  {
    id: "appliances",
    name: "Appliances",
    href: "/search/results?category=appliances",
    items: [
      { label: "Dishwashers", href: "/search/results?category=appliances&q=dishwasher" },
      { label: "Vacuums", href: "/search/results?category=appliances&q=vacuum" },
      { label: "Washers & dryers", href: "/search/results?category=appliances&q=washing+machine" },
      { label: "Refrigerators", href: "/search/results?category=appliances&q=refrigerator" },
      { label: "Kitchen appliances", href: "/search/results?category=appliances&q=coffee+maker" },
      { label: "Air conditioners", href: "/search/results?category=appliances&q=air+fryer" },
    ],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    href: "/search/results?category=kitchen",
    items: [
      { label: "Cookware", href: "/search/results?category=kitchen&q=cookware" },
      { label: "Blenders", href: "/search/results?category=kitchen&q=blender" },
      { label: "Coffee makers", href: "/search/results?category=kitchen&q=coffee+machine" },
      { label: "Dinnerware", href: "/search/results?category=kitchen&q=dinnerware" },
      { label: "Bakeware", href: "/search/results?category=kitchen&q=bakeware" },
    ],
  },
  {
    id: "footwear",
    name: "Fashion & footwear",
    href: "/search/results?category=footwear",
    items: [
      { label: "Running shoes", href: "/search/results?category=footwear&q=running+shoe" },
      { label: "Sneakers", href: "/search/results?category=footwear&q=sneaker" },
      { label: "Outdoor boots", href: "/search/results?category=footwear&q=hiking+boot" },
      { label: "Kids shoes", href: "/search/results?category=footwear&q=casual+shoe" },
    ],
  },
  {
    id: "beauty",
    name: "Beauty & personal care",
    href: "/search/results?category=beauty-devices",
    items: [
      { label: "Hair dryers", href: "/search/results?category=beauty-devices&q=hair+dryer" },
      { label: "Electric shavers", href: "/search/results?category=beauty-devices&q=electric+shaver" },
      { label: "Skincare devices", href: "/search/results?category=beauty-devices&q=skincare+fridge" },
    ],
  },
  {
    id: "accessories",
    name: "Accessories",
    href: "/search/results?category=accessories",
    items: [
      { label: "Phone cases", href: "/search/results?category=accessories&q=phone+case" },
      { label: "Chargers & cables", href: "/search/results?category=accessories&q=wireless+charger" },
      { label: "Bags & backpacks", href: "/search/results?category=accessories&q=backpack" },
    ],
  },
  {
    id: "automotive",
    name: "Automotive",
    href: "/search/results?category=automotive",
    items: [
      { label: "Dash cams", href: "/search/results?category=automotive&q=dash+cam" },
      { label: "Phone mounts", href: "/search/results?category=automotive&q=phone+mount" },
      { label: "Jump starters", href: "/search/results?category=automotive&q=jump+starter" },
      { label: "Floor mats", href: "/search/results?category=automotive&q=floor+mats" },
    ],
  },
  {
    id: "outdoors",
    name: "Outdoors",
    href: "/search/results?category=outdoors",
    items: [
      { label: "Tents", href: "/search/results?category=outdoors&q=tent" },
      { label: "Backpacks", href: "/search/results?category=outdoors&q=hiking+backpack" },
      { label: "Coolers", href: "/search/results?category=outdoors&q=cooler" },
      { label: "Camping lanterns", href: "/search/results?category=outdoors&q=camping+lantern" },
    ],
  },
];

/** Account / utility rail — Amazon-style secondary actions. */
export const utilityLinks: NavLink[] = [
  { label: "Saved lists", href: "/saved" },
  { label: "Price alerts", href: "/saved" },
];
