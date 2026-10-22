import { categoryDisplayTitle, normalizeCategorySlug } from "@/lib/category-visuals";
import { getCategoryRoundCarouselItems } from "@/lib/category-round-carousel";
import { navDepartments } from "@/lib/nav-menu";

export type BreadcrumbPart = { label: string; href?: string };

/**
 * Site-root crumb uses "Shop" when the next segment would also read "Home",
 * so category=home never renders as Home › Home.
 */
export function siteRootBreadcrumb(nextLabel?: string | null): BreadcrumbPart {
  const next = nextLabel?.trim().toLowerCase();
  if (next === "home" || next === "home & garden" || next === "home goods") {
    return { label: "Shop", href: "/" };
  }
  return { label: "Home", href: "/" };
}

/** Category crumb label — aligns Home department with nav "Home & garden". */
export function breadcrumbCategoryLabel(categorySlug: string, dbName?: string | null): string {
  const slug = normalizeCategorySlug(categorySlug) ?? categorySlug;
  if (normalizeCategorySlug(slug) === "home" || slug === "home") {
    return "Home & garden";
  }
  return categoryDisplayTitle(slug, dbName ?? undefined);
}

function hintMatchesTaxonomy(text: string, label: string, query = ""): boolean {
  const needle = label.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (!needle && !q) return false;
  if (needle && (text.includes(needle) || text.includes(needle.replace(/s\b/g, "")))) return true;
  if (q) {
    const qCore = q.replace(/^home\s+/, "");
    if (text.includes(q) || text.includes(qCore)) return true;
  }
  const words = needle
    .split(/\s+/)
    .map((w) => w.replace(/s\b/g, ""))
    .filter((w) => w.length > 3);
  return words.length > 0 && words.every((w) => text.includes(w));
}

/**
 * Best-effort subtype crumb from product name / query against known carousel
 * and nav labels — never invents a department that isn't in our taxonomy.
 */
export function breadcrumbSubtypeLabel(
  categorySlug: string,
  hint?: string | null,
): { label: string; href: string } | null {
  const text = hint?.trim().toLowerCase();
  if (!text) return null;
  const slug = normalizeCategorySlug(categorySlug) ?? categorySlug;

  const carousel = getCategoryRoundCarouselItems(slug);
  for (const item of carousel) {
    if (!item.slug || item.slug === "deals") continue;
    if (hintMatchesTaxonomy(text, item.label, item.slug)) {
      return { label: item.label, href: item.href };
    }
  }

  const dept = navDepartments.find((d) => d.id === slug || d.href.includes(`category=${slug}`));
  if (dept) {
    for (const item of dept.items) {
      if (hintMatchesTaxonomy(text, item.label)) {
        return { label: item.label, href: item.href };
      }
    }
  }

  return null;
}

/** Drop consecutive duplicate labels (case-insensitive). */
export function dedupeBreadcrumbParts(parts: BreadcrumbPart[]): BreadcrumbPart[] {
  const out: BreadcrumbPart[] = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    if (prev && prev.label.trim().toLowerCase() === part.label.trim().toLowerCase()) continue;
    out.push(part);
  }
  return out;
}

/** Compare-page trail: Shop/Home › Category › [Subtype] › Product. */
export function compareBreadcrumbParts(input: {
  categorySlug: string;
  categoryName?: string | null;
  productName: string;
}): BreadcrumbPart[] {
  const catLabel = breadcrumbCategoryLabel(input.categorySlug, input.categoryName);
  const catHref = `/search/results?category=${encodeURIComponent(
    normalizeCategorySlug(input.categorySlug) ?? input.categorySlug,
  )}`;
  const subtype = breadcrumbSubtypeLabel(input.categorySlug, input.productName);
  const parts: BreadcrumbPart[] = [
    siteRootBreadcrumb(catLabel),
    { label: catLabel, href: catHref },
  ];
  if (subtype) {
    parts.push({ label: subtype.label, href: subtype.href });
  }
  parts.push({ label: input.productName });
  return dedupeBreadcrumbParts(parts);
}
