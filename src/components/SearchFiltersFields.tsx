"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ResultsPageParams } from "@/components/SearchResultsLayout";
import { colorSwatchStyle } from "@/lib/color-swatches";
import { navDepartments } from "@/lib/nav-menu";
import type { SearchResultsFacetOptions } from "@/lib/search-results";

function resultsHref(href: string) {
  return href.includes("/search/results") ? href : href.replace("/search?", "/search/results?");
}

function queryOf(href: string) {
  const match = href.match(/[?&]q=([^&]*)/);
  if (!match) return "";
  return decodeURIComponent(match[1].replace(/\+/g, " ")).trim().toLowerCase();
}

function departmentForCategory(category?: string) {
  if (!category) return null;
  const slug = category === "beauty" ? "beauty-devices" : category;
  return (
    navDepartments.find(
      (d) =>
        d.id === category ||
        d.id === slug.replace(/-devices$/, "") ||
        d.href.includes(`category=${slug}`) ||
        d.href.includes(`category=${category}`),
    ) ?? null
  );
}

export function DepartmentBrowse({ params }: { params: ResultsPageParams }) {
  const dept = useMemo(() => departmentForCategory(params.category), [params.category]);
  const currentQuery = (params.q ?? "").trim().toLowerCase();
  if (!dept) return null;

  return (
    <nav aria-label={`In ${dept.name}`} className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">In {dept.name}</p>
      <ul className="space-y-1">
        <li>
          <Link
            href={resultsHref(dept.href)}
            className={`block rounded-lg px-2.5 py-1.5 text-sm font-semibold ${
              // Same warm active state as the sub-items (navy fill lost its white text to a global link colour).
              !currentQuery ? "bg-accent/15 text-navy-900" : "text-navy-900 hover:bg-surface"
            }`}
          >
            All {dept.name}
          </Link>
        </li>
        {dept.items.map((item) => {
          const href = resultsHref(item.href);
          const active = queryOf(href) !== "" && queryOf(href) === currentQuery;
          return (
            <li key={item.href + item.label}>
              <Link
                href={href}
                className={`block rounded-lg px-2.5 py-1.5 text-sm ${
                  active
                    ? "bg-accent/15 font-semibold text-navy-900"
                    : "text-navy-800 hover:bg-surface"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Faceted search filters — only surfaces options backed by real listing/product data.
 */
export function SearchFiltersFields({
  params,
  facets,
  resultCount,
  stickyApply = false,
}: {
  params: ResultsPageParams;
  facets: SearchResultsFacetOptions;
  resultCount?: number;
  stickyApply?: boolean;
}) {
  const bounds = facets.priceBounds;
  const [minVal, setMinVal] = useState(params.priceMin ?? "");
  const [maxVal, setMaxVal] = useState(params.priceMax ?? params.budgetMax ?? "");
  const dept = useMemo(() => departmentForCategory(params.category), [params.category]);
  const categories =
    params.category && !facets.categories.some((c) => c.slug === params.category)
      ? [{ slug: params.category, name: dept?.name ?? params.category, count: 0 }, ...facets.categories]
      : facets.categories;

  return (
    <>
      {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
      {params.deliveryBy ? (
        <input type="hidden" name="deliveryBy" value={params.deliveryBy} />
      ) : null}
      {params.priority ? <input type="hidden" name="priority" value={params.priority} /> : null}
      {params.brands && !params.brand ? (
        <input type="hidden" name="brands" value={params.brands} />
      ) : null}
      {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
      {params.view ? <input type="hidden" name="view" value={params.view} /> : null}

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted">Category</legend>
        <select
          name="category"
          defaultValue={params.category ?? ""}
          className="w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm outline-none focus:border-navy-800 focus:ring-2 focus:ring-navy-900/20"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name} ({c.count})
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted">Brand</legend>
        <select
          name="brand"
          defaultValue={params.brand ?? params.brands ?? ""}
          className="w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm outline-none focus:border-navy-800 focus:ring-2 focus:ring-navy-900/20"
        >
          <option value="">All brands</option>
          {facets.brands.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name} ({b.count})
            </option>
          ))}
        </select>
      </fieldset>

      {params.category === "automotive" || params.category === "Automotive" ? (
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
            Your vehicle (optional)
          </legend>
          <p className="text-[11px] text-muted">
            Saved in the URL to help you compare fitment notes — we never invent a verified fit.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <input
              name="vehicleYear"
              placeholder="Year"
              defaultValue={params.vehicleYear ?? ""}
              className="rounded-lg border border-border px-2 py-1.5 text-xs"
            />
            <input
              name="vehicleMake"
              placeholder="Make"
              defaultValue={params.vehicleMake ?? ""}
              className="rounded-lg border border-border px-2 py-1.5 text-xs"
            />
            <input
              name="vehicleModel"
              placeholder="Model"
              defaultValue={params.vehicleModel ?? ""}
              className="rounded-lg border border-border px-2 py-1.5 text-xs"
            />
          </div>
        </fieldset>
      ) : null}

      {facets.dynamicAttributes.map((facet) => (
        <fieldset key={facet.param} className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
            {facet.label}
          </legend>
          {facet.swatch ? (
            <div className="flex flex-wrap gap-2">
              {facet.values.map((v) => {
                const selected =
                  (params as Record<string, string | undefined>)[facet.param]?.toLowerCase() ===
                  v.value.toLowerCase();
                const swatch = colorSwatchStyle(v.value);
                return (
                  <label
                    key={v.value}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold ${
                      selected
                        ? "border-navy-800 bg-navy-900 text-white"
                        : "border-border bg-white text-navy-900"
                    }`}
                  >
                    <input
                      type="radio"
                      name={facet.param}
                      value={v.value}
                      defaultChecked={selected}
                      className="sr-only"
                    />
                    <span className="inline-block h-3.5 w-3.5 rounded-full" style={swatch} />
                    {v.value}
                  </label>
                );
              })}
              <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-surface px-2 py-1 text-xs font-semibold text-muted">
                <input
                  type="radio"
                  name={facet.param}
                  value=""
                  defaultChecked={!(params as Record<string, string | undefined>)[facet.param]}
                  className="sr-only"
                />
                Any
              </label>
            </div>
          ) : (
            <select
              name={facet.param}
              defaultValue={(params as Record<string, string | undefined>)[facet.param] ?? ""}
              className="w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm outline-none focus:border-navy-800 focus:ring-2 focus:ring-navy-900/20"
            >
              <option value="">Any</option>
              {facet.values.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.value} ({v.count})
                </option>
              ))}
            </select>
          )}
        </fieldset>
      ))}

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
          Price range (Total Known Cost)
        </legend>
        <div className="flex gap-2">
          <input
            type="number"
            name="priceMin"
            min={0}
            step="1"
            placeholder={bounds ? `Min ${bounds.min}` : "Min"}
            aria-label="Minimum total known cost"
            value={minVal}
            onChange={(e) => setMinVal(e.target.value)}
            className="w-full rounded-lg border border-border px-2.5 py-2 text-sm outline-none focus:border-navy-800 focus:ring-2 focus:ring-navy-900/20"
          />
          <input
            type="number"
            name="priceMax"
            min={0}
            step="1"
            placeholder={bounds ? `Max ${bounds.max}` : "Max"}
            aria-label="Maximum total known cost"
            value={maxVal}
            onChange={(e) => setMaxVal(e.target.value)}
            className="w-full rounded-lg border border-border px-2.5 py-2 text-sm outline-none focus:border-navy-800 focus:ring-2 focus:ring-navy-900/20"
          />
        </div>
        {bounds && bounds.max > bounds.min ? (
          <input
            type="range"
            min={bounds.min}
            max={bounds.max}
            step={1}
            value={Number(maxVal) || bounds.max}
            onChange={(e) => setMaxVal(e.target.value)}
            aria-label="Maximum price slider"
            className="w-full accent-[var(--accent)]"
          />
        ) : null}
      </fieldset>

      {facets.colors.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
            Color &amp; finish
          </legend>
          <div className="flex flex-wrap gap-2">
            {facets.colors.map((c) => {
              const selected = (params.color ?? "").toLowerCase() === c.value.toLowerCase();
              const swatch = colorSwatchStyle(c.value);
              return (
                <label
                  key={c.value}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold ${
                    selected
                      ? "border-navy-800 bg-navy-900 text-white"
                      : "border-border bg-white text-navy-900"
                  }`}
                  title={`${c.value} (${c.count})`}
                >
                  <input
                    type="radio"
                    name="color"
                    value={c.value}
                    defaultChecked={selected}
                    className="sr-only"
                  />
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full"
                    style={swatch}
                    aria-hidden
                  />
                  {c.value}
                </label>
              );
            })}
            <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-surface px-2 py-1 text-xs font-semibold text-muted">
              <input type="radio" name="color" value="" defaultChecked={!params.color} className="sr-only" />
              Any
            </label>
          </div>
        </fieldset>
      ) : null}

      {(facets.ratingCounts.min4 > 0 || facets.ratingCounts.min3 > 0) ? (
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted">Rating</legend>
          <div className="space-y-1.5">
            {[
              { value: "", label: "Any rating" },
              ...(facets.ratingCounts.min4 > 0
                ? [{ value: "4", label: `4★ & up (${facets.ratingCounts.min4})` }]
                : []),
              ...(facets.ratingCounts.min3 > 0
                ? [{ value: "3", label: `3★ & up (${facets.ratingCounts.min3})` }]
                : []),
            ].map((opt) => (
              <label key={opt.value || "any"} className="flex items-center gap-2 text-sm text-navy-900">
                <input
                  type="radio"
                  name="ratingMin"
                  value={opt.value}
                  defaultChecked={(params.ratingMin ?? "") === opt.value}
                  className="accent-[var(--accent)]"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
          Shipping &amp; fulfillment
        </legend>
        <label className="flex items-center gap-2 text-sm text-navy-900">
          <input
            type="checkbox"
            name="freeShipping"
            value="1"
            defaultChecked={params.freeShipping === "1"}
            className="accent-[var(--accent)]"
          />
          Free shipping
          {facets.freeShippingCount > 0 ? (
            <span className="text-xs text-muted">({facets.freeShippingCount})</span>
          ) : null}
        </label>
        <label className="flex items-center gap-2 text-sm text-navy-900">
          <input
            type="checkbox"
            name="pickup"
            value="1"
            defaultChecked={params.pickup === "1"}
            className="accent-[var(--accent)]"
          />
          Pickup available
        </label>
        <input type="hidden" name="available" value={params.available === "0" ? "0" : "1"} />
        <p className="text-[11px] leading-snug text-muted">
          Free shipping uses real $0 shipping on listings — never estimated.
        </p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted">Condition</legend>
        <select
          name="condition"
          defaultValue={params.condition ?? ""}
          className="w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm outline-none focus:border-navy-800 focus:ring-2 focus:ring-navy-900/20"
        >
          <option value="">Any condition</option>
          {(facets.conditions.length > 0
            ? facets.conditions
            : [
                { value: "new", label: "New", count: 0 },
                { value: "open_box", label: "Open box", count: 0 },
                { value: "refurbished", label: "Refurbished", count: 0 },
                { value: "used", label: "Used", count: 0 },
              ]
          ).map((c) => (
            <option key={c.value} value={c.value === "open-box" ? "open_box" : c.value}>
              {c.label}
              {c.count > 0 ? ` (${c.count})` : ""}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
          Retailer / source
        </legend>
        <select
          name="source"
          defaultValue={params.source ?? ""}
          className="w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm outline-none focus:border-navy-800 focus:ring-2 focus:ring-navy-900/20"
        >
          <option value="">All sources</option>
          {facets.sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.count})
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
          Match strictness
        </legend>
        <select
          name="comparable"
          defaultValue={params.comparable === "0" || params.alt === "exact" ? "0" : "1"}
          className="w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm outline-none focus:border-navy-800 focus:ring-2 focus:ring-navy-900/20"
        >
          <option value="1">Include comparable matches</option>
          <option value="0">Stricter name matches</option>
        </select>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted">Saved</legend>
        <select
          name="saved"
          defaultValue={params.saved === "1" ? "1" : "0"}
          className="w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm outline-none focus:border-navy-800 focus:ring-2 focus:ring-navy-900/20"
        >
          <option value="0">All products</option>
          <option value="1">Saved products only</option>
        </select>
      </fieldset>

      <div className={stickyApply ? "sticky bottom-0 z-10 -mx-1 border-t border-border bg-white px-1 pt-3 pb-1" : ""}>
        <button type="submit" className="btn-cta min-h-11 w-full px-3 py-2.5 text-sm">
          {typeof resultCount === "number"
            ? `Apply filters (${resultCount} result${resultCount === 1 ? "" : "s"})`
            : "Apply filters"}
        </button>
        <Link
          href={params.q ? `/search/results?q=${encodeURIComponent(params.q)}` : "/search/results"}
          className="mt-2 block text-center text-xs font-semibold text-link hover:underline"
        >
          Clear filters
        </Link>
      </div>
    </>
  );
}
