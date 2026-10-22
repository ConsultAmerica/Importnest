import Link from "next/link";
import { ApprovedSourcesStrip } from "@/components/ApprovedSourcesStrip";
import { CategoryImageGrid } from "@/components/CategoryImageCard";
import { DealProductCard } from "@/components/DealProductCard";
import { HeroSearch } from "@/components/HeroSearch";
import { HomePersonalizationRail, HomeTrustCard } from "@/components/HomePersonalizationRail";
import { HowItWorks } from "@/components/HowItWorks";
import { MiniAlertCard } from "@/components/MiniAlertCard";
import { PageShell } from "@/components/PageShell";
import { PopularComparisonsSection } from "@/components/PopularComparisonCard";
import { TopProductsSection } from "@/components/TopProductsSection";
import { BestDealsSection } from "@/components/BestDealsSection";
import { TrustStrip } from "@/components/TrustStrip";
import { getAuthUser } from "@/lib/auth";
import { getBestDeals } from "@/lib/best-deals";
import { categoryDescriptionFor, categorySubcategoriesFor } from "@/lib/category-visuals";
import { categoryImageFor, homeDealImageFor } from "@/lib/images";
import { getPopularComparisons } from "@/lib/popular-comparisons";
import { prisma } from "@/lib/prisma";
import { getRecentSearches } from "@/lib/recent-searches";
import { getUserWatchlist } from "@/lib/saved-data";

/** Always render at request time — catalog queries depend on live Postgres. */
export const dynamic = "force-dynamic";

/** Idealo-inspired shop-by-category grid — distinct visuals per department. */
const categories = [
  {
    name: "Electronics",
    key: "electronics",
    slug: "electronics",
    href: "/search?category=electronics",
  },
  {
    name: "Appliances",
    key: "appliances",
    slug: "appliances",
    href: "/search?category=appliances",
  },
  { name: "Kitchen", key: "kitchen", slug: "kitchen", href: "/search?category=kitchen" },
  {
    name: "Footwear",
    key: "footwear",
    slug: "footwear",
    href: "/search?category=footwear",
  },
  {
    name: "Beauty Devices",
    key: "beauty",
    slug: "beauty-devices",
    href: "/search?category=beauty-devices",
  },
  {
    name: "Accessories",
    key: "accessories",
    slug: "accessories",
    href: "/search?category=accessories",
  },
  {
    name: "Automotive",
    key: "automotive",
    slug: "automotive",
    href: "/search?category=automotive",
  },
  {
    name: "Outdoors",
    key: "outdoors",
    slug: "outdoors",
    href: "/search?category=outdoors",
  },
  { name: "Home", key: "home", slug: "home", href: "/search?category=home" },
] as const;

async function loadHomeCatalog(userId: string | null) {
  let savedIds = new Set<string>();
  if (userId) {
    try {
      const saved = await prisma.savedProduct.findMany({
        where: { userId },
        select: { canonicalProductId: true },
        take: 50,
      });
      savedIds = new Set(saved.map((s) => s.canonicalProductId));
    } catch (err) {
      console.error("[home] saved products unavailable", err);
    }
  }

  try {
    const [popularPool, bestPool, sources, recentSearches, watchlist, categoryCounts] =
      await Promise.all([
        getPopularComparisons(40, savedIds),
        getBestDeals(40, savedIds),
        prisma.source.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        userId ? getRecentSearches(userId, 3) : Promise.resolve([]),
        userId ? getUserWatchlist(userId) : Promise.resolve([]),
        prisma.category.findMany({
          where: { slug: { in: categories.map((c) => c.slug) } },
          select: { slug: true, _count: { select: { products: true } } },
        }),
      ]);
    return { popularPool, bestPool, sources, recentSearches, watchlist, categoryCounts };
  } catch (err) {
    // DB outage must not blank the homepage — rails fall back to labeled demos.
    console.error("[home] catalog unavailable", err);
    return {
      popularPool: [],
      bestPool: [],
      sources: [],
      recentSearches: [],
      watchlist: [],
      categoryCounts: [] as { slug: string; _count: { products: number } }[],
    };
  }
}

export default async function HomePage() {
  const user = await getAuthUser();
  const { popularPool, bestPool, sources, recentSearches, watchlist, categoryCounts } =
    await loadHomeCatalog(user?.id ?? null);
  const productCountBySlug = new Map(categoryCounts.map((c) => [c.slug, c._count.products]));
  const categoryCards = categories.map((c) => ({
    name: c.name,
    href: c.href,
    desc: categoryDescriptionFor(c.key),
    image: categoryImageFor(c.key),
    subcategories: categorySubcategoriesFor(c.key),
    productCount: productCountBySlug.get(c.slug) ?? null,
  }));

  // Dedupe products across the three rails so the same item (and its image) never
  // appears twice on the homepage.
  const topProducts = popularPool.slice(0, 8);
  const topIds = new Set(topProducts.map((p) => p.productId));
  const bestDeals = bestPool.filter((d) => !topIds.has(d.productId)).slice(0, 8);
  const bestIds = new Set(bestDeals.map((d) => d.productId));
  const popular = popularPool
    .filter((p) => !topIds.has(p.productId) && !bestIds.has(p.productId))
    .slice(0, 4);
  const popularIds = new Set(popular.map((p) => p.productId));
  const todaysDeals = bestPool
    .filter((d) => !topIds.has(d.productId) && !bestIds.has(d.productId) && !popularIds.has(d.productId))
    .slice(0, 8);

  return (
    <PageShell width="wide">
      <div className="home-main">
        {/* Main search hero */}
        <section className="home-band home-hero" aria-labelledby="home-search-heading">
          <div className="home-hero-grid">
            <div className="home-hero-copy">
              <p className="home-hero-eyebrow">
                <span aria-hidden="true">✦</span> AI shopping search · approved retailers only
              </p>
              <h1 id="home-search-heading" className="home-hero-title">
                Search once. Compare every <span className="home-hero-title-accent">approved offer</span>.
              </h1>
              <p className="home-hero-lede">
                See the real Total Known Cost — item + shipping + fees — across approved retailers
                before you buy.
              </p>
              <HeroSearch className="mt-5" showQuickFilters variant="hero" />
            </div>
            <div className="home-hero-aside">
              <HomeTrustCard />
            </div>
          </div>

          {/* Approved retailers — surfaced right under the hero for instant
              credibility around how Total Known Cost is sourced. */}
          <div id="approved-sources" className="scroll-mt-24">
            <ApprovedSourcesStrip sources={sources} />
          </div>
        </section>

        {/* Shop by Category */}
        <section className="home-section" aria-labelledby="shop-category-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="shop-category-heading"
                className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl"
              >
                Shop by Category
              </h2>
              <p className="mt-1 text-sm text-muted">
                Browse image-rich departments — then compare offers
              </p>
            </div>
            <Link
              href="/search?category=electronics"
              className="text-sm font-semibold text-link hover:underline"
            >
              View all
            </Link>
          </div>
          <CategoryImageGrid items={categoryCards} />
        </section>

        {/* Top Products */}
        <div className="home-section">
          <TopProductsSection items={topProducts} signedIn={Boolean(user)} />
        </div>

        {/* Best Deals */}
        <div className="home-section">
          <div className="home-band !mb-0">
            <BestDealsSection items={bestDeals} signedIn={Boolean(user)} />
          </div>
        </div>

        <TrustStrip />

        {/* Popular Comparisons */}
        <div className="home-section">
          <PopularComparisonsSection items={popular} signedIn={Boolean(user)} />
        </div>

        {/* Today’s deals */}
        <section className="home-section" aria-labelledby="todays-deals-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="todays-deals-heading"
                className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl"
              >
                Today&apos;s deals
              </h2>
              <p className="mt-1 text-sm text-muted">
                Fresh deals from approved sources — real Total Known Cost, never invented discounts.
              </p>
            </div>
            <Link
              href="/search?q=deals"
              className="text-sm font-semibold text-link hover:underline"
            >
              View all deals
            </Link>
          </div>

          {todaysDeals.length > 0 ? (
            <ul className="section-grid mt-4">
              {todaysDeals.map((item) => (
                <li key={item.productId} className="min-w-0">
                  <DealProductCard
                    item={item}
                    imageSrc={homeDealImageFor(item.productId, item.categorySlug, item.productName)}
                    signedIn={Boolean(user)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-2xl border border-border bg-section-soft px-5 py-6 sm:px-7 sm:py-7">
              <p className="text-sm font-semibold text-navy-900">
                Looking for savings backed by approved sources?
              </p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
                Jump into deals search to compare item + shipping + fees across retailers. Sponsored
                placements never change organic ranking.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/search?q=deals" className="btn-cta px-4 py-2.5 text-sm">
                  Shop today&apos;s deals
                </Link>
                <Link
                  href="/search/results?category=electronics"
                  className="rounded-full border border-border bg-panel px-4 py-2.5 text-sm font-semibold text-navy-900 hover:border-navy-800"
                >
                  Electronics deals
                </Link>
                <Link
                  href="/search/results?category=appliances"
                  className="rounded-full border border-border bg-panel px-4 py-2.5 text-sm font-semibold text-navy-900 hover:border-navy-800"
                >
                  Appliance deals
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Compare smarter. Shop confidently. — mid-page CTA card */}
        <section
          className="home-section rounded-3xl border-2 border-accent/30 bg-panel px-5 py-7 shadow-[var(--shadow-panel)] sm:px-8 sm:py-8"
          aria-labelledby="compare-smarter-heading"
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:items-center">
            <div>
              <h2
                id="compare-smarter-heading"
                className="text-xl font-extrabold tracking-tight text-navy-900 sm:text-2xl"
              >
                Still comparing?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Search again, adjust budget, or compare another product.
              </p>
            </div>
            <div className="min-w-0">
              <HeroSearch className="mt-0" maxExamples={3} />
            </div>
          </div>
        </section>

          {/* Price alerts / Track Total Known Cost */}
          <section className="home-section" aria-labelledby="track-cost-heading">
            <div className="mb-4">
              <h2
                id="track-cost-heading"
                className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl"
              >
                Price alerts &amp; Total Known Cost
              </h2>
              <p className="mt-1 text-sm text-muted">
                Save favourites, set alerts, and see item + shipping + fees before you click buy.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <div className="rounded-2xl border border-border bg-panel px-5 py-6 shadow-[var(--shadow-panel)] sm:px-6">
                <h3 className="text-lg font-bold tracking-tight text-navy-900">
                  Track Total Known Cost
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Sticker price is only part of the story. Importnest shows{" "}
                  <span className="font-semibold text-accent">Total Known Cost</span> from approved
                  sources — estimates are labeled, and sponsored placements never change ranking.
                </p>
                <Link href="/search" className="btn-cta mt-4 inline-flex px-4 py-2.5 text-sm">
                  Start comparing
                </Link>
              </div>
              <MiniAlertCard watchlist={watchlist} />
            </div>

            <div className="mt-6">
              <HomePersonalizationRail
                recentSearches={recentSearches}
                watchlist={watchlist}
                showWatchlist={Boolean(user)}
                placement="inline"
              />
            </div>
          </section>

          <HomePersonalizationRail
            recentSearches={[]}
            watchlist={[]}
            showWatchlist={false}
            placement="mobile"
          />

          {/* How it works */}
          <div className="home-section">
            <HowItWorks />
          </div>
      </div>
    </PageShell>
  );
}
