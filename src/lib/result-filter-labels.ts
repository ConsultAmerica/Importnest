import type { ResultsPageParams } from "@/components/SearchResultsLayout";
import { categoryDisplayTitle, normalizeCategorySlug } from "@/lib/category-visuals";

export function prefsChips(params: ResultsPageParams): { label: string; clearKey: string }[] {
  const chips: { label: string; clearKey: string }[] = [];
  if (params.q?.trim())
    chips.push({ label: `Query: “${params.q.trim()}”`, clearKey: "q" });
  const chipCategorySlug = normalizeCategorySlug(params.category);
  if (chipCategorySlug)
    chips.push({
      label: `Category: ${categoryDisplayTitle(chipCategorySlug)}`,
      clearKey: "category",
    });
  if (params.brand) chips.push({ label: `Brand: ${params.brand}`, clearKey: "brand" });
  else if (params.brands && params.brands !== "any")
    chips.push({ label: `Brands: ${params.brands}`, clearKey: "brands" });
  const max = params.priceMax || params.budgetMax;
  if (max) chips.push({ label: `Under $${max}`, clearKey: params.priceMax ? "priceMax" : "budgetMax" });
  if (params.priceMin) chips.push({ label: `From $${params.priceMin}`, clearKey: "priceMin" });
  if (params.condition)
    chips.push({
      label: `Condition: ${params.condition.replace(/_/g, " ")}`,
      clearKey: "condition",
    });
  if (params.color) chips.push({ label: params.color, clearKey: "color" });
  if (params.ratingMin) chips.push({ label: `${params.ratingMin}★ & up`, clearKey: "ratingMin" });
  if (params.freeShipping === "1") chips.push({ label: "Free shipping", clearKey: "freeShipping" });
  if (params.pickup === "1") chips.push({ label: "Pickup available", clearKey: "pickup" });
  if (params.available === "0") chips.push({ label: "Including unavailable", clearKey: "available" });
  if (params.source) chips.push({ label: "Selected retailer", clearKey: "source" });
  if (params.comparable === "0" || params.alt === "exact")
    chips.push({ label: "Exact-leaning matches", clearKey: "comparable" });
  if (params.saved === "1") chips.push({ label: "Saved only", clearKey: "saved" });
  if (params.deliveryBy)
    chips.push({ label: `Delivery: ${params.deliveryBy}`, clearKey: "deliveryBy" });
  if (params.priority) chips.push({ label: `Priority: ${params.priority}`, clearKey: "priority" });

  const attrChips: [keyof ResultsPageParams, string][] = [
    ["attr_fitment", "Fitment"],
    ["attr_install", "Install"],
    ["attr_ship_weight", "Ship weight"],
    ["attr_material", "Material"],
    ["attr_finish", "Finish"],
    ["attr_power", "Power"],
    ["attr_hair", "Hair"],
    ["attr_skin", "Skin"],
    ["attr_cert", "Cert"],
    ["attr_water", "Water / IPX"],
    ["attr_weight", "Weight"],
    ["attr_activity", "Activity"],
    ["attr_color", "Color"],
    ["attr_screen", "Screen"],
    ["attr_capacity", "Capacity"],
    ["attr_energy", "Energy"],
  ];
  for (const [key, label] of attrChips) {
    const v = params[key];
    if (v) chips.push({ label: `${label}: ${v}`, clearKey: key });
  }
  if (params.vehicleYear || params.vehicleMake || params.vehicleModel) {
    chips.push({
      label: `Vehicle: ${[params.vehicleYear, params.vehicleMake, params.vehicleModel].filter(Boolean).join(" ")}`,
      clearKey: "vehicleYear",
    });
  }
  return chips;
}

/** Human labels for every active URL filter, including category and query. */
export function activeFilterLabels(params: ResultsPageParams): string[] {
  return prefsChips(params).map((chip) => chip.label);
}

/**
 * Labels for filters that actually narrow results beyond the current browse
 * context (category / typed query). Used on the mobile Filters bar so
 * "Filters 1" means something like Free shipping — not just "Category: Home".
 */
export function narrowingFilterLabels(params: ResultsPageParams): string[] {
  return prefsChips(params)
    .filter((chip) => chip.clearKey !== "q" && chip.clearKey !== "category")
    .map((chip) => chip.label);
}
