import Link from "next/link";
import {
  breadcrumbCategoryLabel,
  breadcrumbSubtypeLabel,
  dedupeBreadcrumbParts,
  siteRootBreadcrumb,
  type BreadcrumbPart,
} from "@/lib/breadcrumbs";
import { normalizeCategorySlug } from "@/lib/category-visuals";

/** Home/Shop › Category › [Subtype] › Query trail for search results. */
export function SearchBreadcrumbs({
  category,
  query,
}: {
  category?: string | null;
  query?: string | null;
}) {
  const slug = normalizeCategorySlug(category);
  const parts: BreadcrumbPart[] = [];

  if (slug) {
    const catLabel = breadcrumbCategoryLabel(slug);
    parts.push(siteRootBreadcrumb(catLabel));
    parts.push({
      label: catLabel,
      href: `/search/results?category=${encodeURIComponent(slug)}`,
    });
    const subtype = breadcrumbSubtypeLabel(slug, query);
    if (subtype && (!query || subtype.label.toLowerCase() !== query.trim().toLowerCase())) {
      parts.push(subtype);
    }
    if (query?.trim() && (!subtype || subtype.label.toLowerCase() !== query.trim().toLowerCase())) {
      parts.push({ label: query.trim() });
    }
  } else {
    parts.push({ label: "Home", href: "/" });
    parts.push({ label: "Search results", href: "/search/results" });
    if (query?.trim()) {
      parts.push({ label: query.trim() });
    }
  }

  const trail = dedupeBreadcrumbParts(parts);

  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {trail.map((part, i) => (
          <li key={`${part.label}-${i}`} className="inline-flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden="true">›</span> : null}
            {part.href && i < trail.length - 1 ? (
              <Link href={part.href} className="font-semibold text-link hover:underline">
                {part.label}
              </Link>
            ) : (
              <span className="font-semibold text-navy-900">{part.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
