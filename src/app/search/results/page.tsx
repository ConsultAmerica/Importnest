import { PageShell } from "@/components/PageShell";
import { CategoryBrowseHeader } from "@/components/CategoryBrowseHeader";
import { getCategoryDemoProducts } from "@/data/category-demo-products";
import { CategoryDemoGrid } from "@/components/CategoryDemoGrid";
import { CategoryImageGrid } from "@/components/CategoryImageCard";
import { CategoryRoundCarousel } from "@/components/CategoryRoundCarousel";
import { DealProductCard } from "@/components/DealProductCard";
import { MobileResultsChrome } from "@/components/MobileResultsChrome";
import { NoSearchResultsPanel } from "@/components/NoSearchResultsPanel";
import { PopularComparisonsSection } from "@/components/PopularComparisonCard";
import { RelatedCategoryChips } from "@/components/RelatedCategoryChips";
import { SearchBreadcrumbs } from "@/components/SearchBreadcrumbs";
import {
  SearchFiltersForm,
  SearchFiltersSidebar,
  SearchResultProductCard,
  type ResultsPageParams,
} from "@/components/SearchResultsLayout";
import { DepartmentBrowse } from "@/components/SearchFiltersFields";
import { SearchResultsToolbar } from "@/components/SearchResultsToolbar";
import { SparseBrowsePrompts } from "@/components/SparseBrowsePrompts";
import { TopProductsSection } from "@/components/TopProductsSection";
import { getAuthUser } from "@/lib/auth";
import { getBestDeals } from "@/lib/best-deals";
import { attributeFiltersFromParams, categoryFacetProfile } from "@/lib/category-facets";
import {
  categoryDescriptionFor,
  categoryDisplayTitle,
  normalizeCategorySlug,
  relatedCategorySlugs,
  SHOP_CATEGORY_SLUGS,
} from "@/lib/category-visuals";
import { activeRoundCarouselSlug, getCategoryRoundCarouselItems } from "@/lib/category-round-carousel";
import { categoryImageFor } from "@/lib/images";
import { prisma } from "@/lib/prisma";
import { narrowingFilterLabels } from "@/lib/result-filter-labels";
import { getPopularComparisons } from "@/lib/popular-comparisons";
import {
  getSearchResults,
  partitionByMatchKind,
  type ResultsSort,
  type SearchResultsFilters,
} from "@/lib/search-results";

/** Idealo-inspired shop-by-category chips for the "All products" browse view. */
const ALL_BROWSE_CATEGORIES = SHOP_CATEGORY_SLUGS.map((key) => {
  const slug = normalizeCategorySlug(key) ?? key;
  return {
    name: categoryDisplayTitle(key),
    desc: categoryDescriptionFor(key),
    href: `/search/results?category=${encodeURIComponent(slug)}`,
    image: categoryImageFor(key),
  };
});

function parseSort(raw: string | undefined): ResultsSort {
  const allowed: ResultsSort[] = [
    "best_overall",
    "lowest_cost",
    "fastest",
    "best_value",
    "recently_updated",
    "best_rated",
  ];
  if (raw && allowed.includes(raw as ResultsSort)) return raw as ResultsSort;
  return "best_overall";
}

function parseNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function mapCondition(
  raw: string | undefined,
): SearchResultsFilters["condition"] | undefined {
  if (!raw || raw === "any") return undefined;
  const normalized = raw === "open-box" ? "open_box" : raw;
  if (
    normalized === "new" ||
    normalized === "open_box" ||
    normalized === "refurbished" ||
    normalized === "used"
  ) {
    return normalized;
  }
  return undefined;
}

export const dynamic = "force-dynamic";

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<ResultsPageParams>;
}) {
  const params = await searchParams;
  const authUser = await getAuthUser();

  const savedIds = new Set<string>();
  /** Products with an active price-drop alert — their bell renders as "on". */
  const alertIds = new Set<string>();
  if (authUser) {
    try {
      const [saved, alerts] = await Promise.all([
        prisma.savedProduct.findMany({
          where: { userId: authUser.id },
          select: { canonicalProductId: true },
        }),
        prisma.alert.findMany({
          where: { userId: authUser.id, type: "price-drop", isActive: true },
          select: { canonicalProductId: true },
        }),
      ]);
      for (const row of saved) savedIds.add(row.canonicalProductId);
      for (const row of alerts) alertIds.add(row.canonicalProductId);
    } catch (err) {
      console.error("[search/results] saved products unavailable", err);
    }
  }

  const sort = parseSort(params.sort);
  // "all", empty, and missing all mean "no category filter" — never a
  // literal "all" slug sent to the database (which would just return zero rows).
  const categorySlug = normalizeCategorySlug(params.category) ?? null;
  const preferList = categoryFacetProfile(categorySlug)?.preferListView === true;
  const view =
    params.view === "list"
      ? "list"
      : params.view === "grid"
        ? "grid"
        : preferList
          ? "list"
          : "grid";
  const vehicleContext = {
    year: params.vehicleYear?.trim() || undefined,
    make: params.vehicleMake?.trim() || undefined,
    model: params.vehicleModel?.trim() || undefined,
  };
  const filters: SearchResultsFilters = {
    query: params.q?.trim() || undefined,
    categorySlug: categorySlug || undefined,
    brandNames: params.brand
      ? [params.brand]
      : params.brands && params.brands !== "any"
        ? params.brands.split(",").map((b) => b.trim()).filter(Boolean)
        : undefined,
    priceMin: parseNumber(params.priceMin),
    priceMax: parseNumber(params.priceMax) ?? parseNumber(params.budgetMax),
    condition: mapCondition(params.condition),
    availableOnly: params.available !== "0",
    pickupOnly: params.pickup === "1",
    freeShippingOnly: params.freeShipping === "1",
    ratingMin: parseNumber(params.ratingMin),
    color: params.color?.trim() || undefined,
    attributeFilters: attributeFiltersFromParams(params, categorySlug),
    sourceId: params.source || undefined,
    allowComparable: params.comparable !== "0" && params.alt !== "exact",
    savedOnly: params.saved === "1",
    savedProductIds: savedIds,
    sort,
  };

  // "All products": no category, no query. Featured products then spans every
  // approved category, and the browse rails (Top products / Best deals /
  // Popular comparisons) show the same cross-category mix the homepage does
  // instead of just staying empty because no single category was chosen.
  const isAllBrowse = !categorySlug && !filters.query;

  const [results, categoryDeals, categoryPopularRaw] = await Promise.all([
    getSearchResults(filters),
    categorySlug
      ? getBestDeals(8, savedIds, categorySlug)
      : isAllBrowse
        ? getBestDeals(8, savedIds)
        : Promise.resolve([]),
    categorySlug
      ? getPopularComparisons(8, savedIds, categorySlug)
      : isAllBrowse
        ? getPopularComparisons(24, savedIds)
        : Promise.resolve([]),
  ]);

  // For All products, the first slice of the cross-category pool becomes its
  // own "Top products" rail; the rest still backs Popular comparisons below.
  const topProducts = isAllBrowse ? categoryPopularRaw.slice(0, 8) : [];
  const categoryPopular = isAllBrowse ? categoryPopularRaw.slice(8, 16) : categoryPopularRaw;

  const lowResults = results.products.length > 0 && results.products.length < 3;
  const needsFallback = !results.products.length || lowResults;
  // A free-text query ("best air purifiers…") has no category param, so borrow the
  // matched product's category — otherwise "You might also like" shows dishwashers
  // and shoes. Only widen to all categories when that category has nothing else.
  const fallbackCategory = categorySlug || results.products[0]?.categorySlug || undefined;
  const matchedIds = new Set(results.products.map((p) => p.id));
  let trendingFallback = needsFallback
    ? await getPopularComparisons(4, savedIds, fallbackCategory)
    : [];
  if (
    needsFallback &&
    !categorySlug &&
    fallbackCategory &&
    trendingFallback.every((p) => matchedIds.has(p.productId))
  ) {
    trendingFallback = await getPopularComparisons(4, savedIds);
  }
  const fallbackIsSameCategory =
    Boolean(fallbackCategory) &&
    trendingFallback.some((p) => !matchedIds.has(p.productId) && p.categorySlug === fallbackCategory);

  const redirectTo = `/search/results?${new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v) as [string, string][],
    ),
  ).toString()}`;
  const { exact, comparable } = partitionByMatchKind(results.products);
  const showSeparateMatchSections = Boolean(params.q) && exact.length > 0 && comparable.length > 0;
  const hasLiveProducts = results.products.length > 0;
  const categoryTitle = categorySlug ? categoryDisplayTitle(categorySlug) : null;
  const signedIn = Boolean(authUser);
  const roundCarouselItems = categorySlug ? getCategoryRoundCarouselItems(categorySlug) : [];
  const roundCarouselActiveSlug = activeRoundCarouselSlug(params.q, params.sort);
  const hasBrowseIdeas = categorySlug ? getCategoryDemoProducts(categorySlug).length > 0 : false;
  const browseInsteadOfEmpty = Boolean(categorySlug) && !hasLiveProducts && hasBrowseIdeas;

  // Best deals / Popular comparisons only show products not already on screen in
  // Featured (or Top products, for All). A section that dedupes to nothing is
  // hidden rather than repeating the same card — the card's own badges (price
  // drop, Best value, Popular) already carry those labels.
  const featuredIds = new Set(results.products.map((p) => p.id));
  const topProductIds = new Set(topProducts.map((p) => p.productId));
  const excludeFromDeals = new Set([...featuredIds, ...topProductIds]);
  const dedupedCategoryDeals = categoryDeals.filter((d) => !excludeFromDeals.has(d.productId));
  const dealIds = new Set(dedupedCategoryDeals.map((d) => d.productId));
  const dedupedCategoryPopular = categoryPopular.filter(
    (p) => !excludeFromDeals.has(p.productId) && !dealIds.has(p.productId),
  );

  // A category with only one or two live products feels empty. Fill the space
  // with real, live products from related departments (stored listings only —
  // never demo data), labelled with their own category on each card.
  const isSparseCategory = Boolean(categorySlug) && hasLiveProducts && results.products.length < 3;
  const relatedSlugs = isSparseCategory && categorySlug ? relatedCategorySlugs(categorySlug, 3) : [];
  const shownIds = new Set([...excludeFromDeals, ...dealIds, ...dedupedCategoryPopular.map((p) => p.productId)]);
  const adjacentProducts = relatedSlugs.length
    ? (await Promise.all(relatedSlugs.map((slug) => getPopularComparisons(4, savedIds, slug))))
        .flat()
        .filter((p, i, all) => !shownIds.has(p.productId) && all.findIndex((q) => q.productId === p.productId) === i)
        .slice(0, 8)
    : [];
  const spanContent = view === "list" || results.products.length === 1;
  const cardLayout = spanContent ? "list" : "grid";
  const gridClass = spanContent ? "grid w-full grid-cols-1 gap-3" : "section-grid";

  function renderProductGrid() {
    if (!hasLiveProducts) {
      if (browseInsteadOfEmpty) return null;
      return (
        <NoSearchResultsPanel
          params={params}
          hideCategoryVisual={Boolean(categorySlug)}
          recommendations={trendingFallback}
          signedIn={signedIn}
          priceBounds={results.facets.priceBounds}
        />
      );
    }

    if (showSeparateMatchSections) {
      return (
        <>
          <ul className={gridClass}>
            {exact.map((p) => (
              <li key={p.id} className="min-w-0">
                <SearchResultProductCard
                  product={p}
                  signedIn={signedIn}
                  redirectTo={redirectTo}
                  layout={cardLayout}
                  vehicle={vehicleContext}
                  alertActive={alertIds.has(p.id)}
                />
              </li>
            ))}
          </ul>
          <h2 className="pt-2 text-sm font-bold uppercase tracking-wide text-muted">
            Comparable alternatives
          </h2>
          <ul className={gridClass}>
            {comparable.map((p) => (
              <li key={p.id} className="min-w-0">
                <SearchResultProductCard
                  product={p}
                  signedIn={signedIn}
                  redirectTo={redirectTo}
                  layout={cardLayout}
                  vehicle={vehicleContext}
                  alertActive={alertIds.has(p.id)}
                />
              </li>
            ))}
          </ul>
        </>
      );
    }

    return (
      <>
        <ul className={gridClass}>
          {results.products.map((p) => (
            <li key={p.id} className="min-w-0">
              <SearchResultProductCard
                product={p}
                signedIn={signedIn}
                redirectTo={redirectTo}
                layout={cardLayout}
                vehicle={vehicleContext}
                alertActive={alertIds.has(p.id)}
              />
            </li>
          ))}
        </ul>
        {lowResults && trendingFallback.some((p) => !featuredIds.has(p.productId)) ? (
          <section className="space-y-3 pt-4" aria-labelledby="few-results-heading">
            <div>
              <h2
                id="few-results-heading"
                className="text-lg font-bold tracking-tight text-navy-900"
              >
                {fallbackIsSameCategory && fallbackCategory
                  ? `More in ${categoryDisplayTitle(fallbackCategory)}`
                  : "You might also like"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Popular comparisons from approved sources — broaden your search anytime.
              </p>
            </div>
            <PopularComparisonsSection
              items={trendingFallback.filter((p) => !featuredIds.has(p.productId))}
              signedIn={signedIn}
              title=""
              subtitle=""
              layout={view === "list" ? "list" : "grid"}
            />
          </section>
        ) : null}
      </>
    );
  }

  return (
    <PageShell width="results">
      <div className="results-layout pb-20 lg:pb-0">
        <SearchFiltersSidebar
          params={params}
          facets={results.facets}
          resultCount={results.total}
        />

        <div className="results-layout-main space-y-6">
          <MobileResultsChrome
            activeCount={narrowingFilterLabels(params).length}
            activeLabels={narrowingFilterLabels(params)}
            resultCount={results.total}
            params={params}
            sort={sort}
          >
            <DepartmentBrowse params={params} />
            <SearchFiltersForm
              params={params}
              facets={results.facets}
              resultCount={results.total}
              stickyApply
              className="space-y-5"
            />
          </MobileResultsChrome>

          {/* Where am I → what is this → browse types: breadcrumbs and the page
              title come before the type carousel, not under it. */}
          <SearchBreadcrumbs category={categorySlug} query={params.q} />

          {categorySlug ? (
            <CategoryBrowseHeader
              categorySlug={categorySlug}
              showSubtypeChips={roundCarouselItems.length === 0}
            />
          ) : null}

          {isAllBrowse ? (
            <header className="category-browse-header">
              <h1 className="category-browse-title">All products</h1>
              <p className="category-browse-description">
                Browse products across approved categories and compare available offers.
              </p>
            </header>
          ) : null}

          {categorySlug ? (
            <CategoryRoundCarousel
              categorySlug={categorySlug}
              items={roundCarouselItems}
              activeSubtype={roundCarouselActiveSlug}
            />
          ) : null}

          {categorySlug && hasLiveProducts && results.products.length < 3 ? (
            <SparseBrowsePrompts
              categorySlug={categorySlug}
              resultCount={results.products.length}
              showTypes={roundCarouselItems.length === 0}
            />
          ) : null}

          <SearchResultsToolbar
            params={params}
            total={results.total}
            sort={sort}
            hideCategoryVisual={Boolean(categorySlug) || isAllBrowse}
            browsingIdeas={browseInsteadOfEmpty}
          />
          <p className="text-xs leading-relaxed text-muted">
            Sponsored offers are shown separately and do not influence organic ranking. Checkout
            happens on the retailer&apos;s site.
          </p>

          {isAllBrowse ? (
            <section aria-labelledby="all-categories-heading" className="space-y-3">
              <h2
                id="all-categories-heading"
                className="text-lg font-bold tracking-tight text-navy-900 sm:text-xl"
              >
                Shop by category
              </h2>
              <CategoryImageGrid items={ALL_BROWSE_CATEGORIES} />
            </section>
          ) : null}

          {browseInsteadOfEmpty ? null : (
          <section
            aria-labelledby={categorySlug || isAllBrowse ? "featured-products-heading" : undefined}
            className="w-full min-w-0 space-y-3"
          >
            {categorySlug || isAllBrowse ? (
              <div>
                <h2
                  id="featured-products-heading"
                  className="text-lg font-bold tracking-tight text-navy-900 sm:text-xl"
                >
                  Featured products
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {categorySlug
                    ? `Live offers in ${categoryTitle} from approved sources.`
                    : "Live offers across approved categories."}
                </p>
              </div>
            ) : null}
            {renderProductGrid()}
          </section>
          )}

          {adjacentProducts.length > 0 && categoryTitle ? (
            <PopularComparisonsSection
              items={adjacentProducts}
              signedIn={signedIn}
              // A scrollable tray keeps cross-department picks visibly secondary to the
              // category's own results (and avoids two cards stretching to half-page photos).
              layout="tray"
              title={`Few matches in ${categoryTitle} — shoppers also compare these`}
              subtitle={`Live offers from related departments: ${relatedSlugs
                .map((s) => categoryDisplayTitle(s))
                .join(", ")}.`}
            />
          ) : null}

          {isSparseCategory && categorySlug ? (
            <CategoryDemoGrid categorySlug={categorySlug} prominence="secondary" showSubtypeChips={false} />
          ) : null}

          {isAllBrowse && topProducts.length > 0 ? (
            <TopProductsSection items={topProducts} signedIn={signedIn} />
          ) : null}

          {(categorySlug || isAllBrowse) && !browseInsteadOfEmpty && dedupedCategoryDeals.length > 0 ? (
            <section aria-labelledby="category-deals-heading" className="space-y-3">
              <div>
                <h2
                  id="category-deals-heading"
                  className="text-lg font-bold tracking-tight text-navy-900 sm:text-xl"
                >
                  {categorySlug ? `Best deals in ${categoryTitle}` : "Best deals"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Price drops and multi-offer totals from real listing history.
                </p>
              </div>
              <ul className={view === "list" || dedupedCategoryDeals.length === 1 ? "grid w-full grid-cols-1 gap-3" : "section-grid"}>
                {dedupedCategoryDeals.map((item) => (
                  <li key={item.productId} className="min-w-0">
                    <DealProductCard
                      item={item}
                      imageSrc={item.imageSrc}
                      signedIn={signedIn}
                      redirectTo={redirectTo}
                      compactList={view === "list" || dedupedCategoryDeals.length === 1}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {(categorySlug || isAllBrowse) && !browseInsteadOfEmpty && dedupedCategoryPopular.length > 0 ? (
            <PopularComparisonsSection
              items={dedupedCategoryPopular}
              signedIn={signedIn}
              layout={view === "list" || dedupedCategoryPopular.length === 1 ? "list" : "grid"}
              title="Popular comparisons"
              subtitle={
                categorySlug
                  ? `Most-compared ${categoryTitle} products with live approved offers.`
                  : "Most-compared products across categories with live approved offers."
              }
            />
          ) : null}

          {/* On sparse pages the browse ideas move up under the live results instead. */}
          {categorySlug && !isSparseCategory ? (
            <CategoryDemoGrid
              categorySlug={categorySlug}
              prominence={browseInsteadOfEmpty ? "primary" : "secondary"}
              showSubtypeChips={false}
            />
          ) : null}

          {categorySlug ? (
            <RelatedCategoryChips categorySlug={categorySlug} query={params.q} />
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
