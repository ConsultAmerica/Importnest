import { prisma } from "@/lib/prisma";
import { minutesSince, knownOfferTotal } from "@/lib/compare-view";
import { productImageFor } from "@/lib/product-images";

export type BestDealItem = {
  productId: string;
  brandName: string;
  productName: string;
  categorySlug: string;
  imageSrc: string;
  currentTotal: number;
  /** Previous daily Total Known Cost when real PriceHistory supports it. */
  previousTotal: number | null;
  /** Percent drop vs previousTotal when previous > current; otherwise null. */
  discountPercent: number | null;
  dealBadge: string;
  offerCount: number;
  sourceCount: number;
  /** Approved retailer names behind the offers, in listing order. */
  sourceNames: string[];
  isSaved: boolean;
  freshnessMinutesAgo: number;
  /** Real seeded average rating — never fabricated. */
  rating: number | null;
  /** The specific listing backing currentTotal — used to add this exact offer to cart without inventing data. */
  bestListing: {
    listingId: string;
    sourceName: string;
    condition: string;
    price: number;
    shipping: number | null;
    fees: number;
  };
};

/**
 * Best deals from live approved listings.
 * Old price / % off appear only when PriceHistory has a higher prior day total.
 */
export async function getBestDeals(
  limit = 6,
  savedProductIds: Set<string> = new Set(),
  categorySlug?: string,
): Promise<BestDealItem[]> {
  try {
    return await getBestDealsUnsafe(limit, savedProductIds, categorySlug);
  } catch (err) {
    console.error("[best-deals] unavailable", err);
    return [];
  }
}

async function getBestDealsUnsafe(
  limit = 6,
  savedProductIds: Set<string> = new Set(),
  categorySlug?: string,
): Promise<BestDealItem[]> {
  // Listing.canonicalProductId is a bare scalar FK (no `canonicalProduct`
  // relation back on Listing), so category scoping must resolve product ids
  // first rather than filtering through a nested relation that doesn't exist.
  let categoryProductIds: string[] | null = null;
  if (categorySlug) {
    const productsInCategory = await prisma.canonicalProduct.findMany({
      where: { category: { slug: categorySlug } },
      select: { id: true },
    });
    categoryProductIds = productsInCategory.map((p) => p.id);
    if (categoryProductIds.length === 0) return [];
  }

  const listings = await prisma.listing.findMany({
    where: {
      canonicalProductId: categoryProductIds ? { in: categoryProductIds } : { not: null },
      matches: { some: { status: "approved" } },
    },
    select: {
      id: true,
      canonicalProductId: true,
      price: true,
      shipping: true,
      fees: true,
      condition: true,
      freshnessCapturedAt: true,
      source: { select: { name: true } },
    },
  });

  type Agg = {
    listingIds: string[];
    offerCount: number;
    sourceNames: Set<string>;
    currentTotal: number;
    freshestAt: Date;
    bestListing: BestDealItem["bestListing"];
  };

  const byProduct = new Map<string, Agg>();
  for (const listing of listings) {
    const id = listing.canonicalProductId;
    if (!id) continue;
    const total = knownOfferTotal(listing.price, listing.shipping, listing.fees);
    const bestListing: BestDealItem["bestListing"] = {
      listingId: listing.id,
      sourceName: listing.source.name,
      condition: listing.condition,
      price: listing.price,
      shipping: listing.shipping,
      fees: listing.fees,
    };
    const existing = byProduct.get(id);
    if (!existing) {
      byProduct.set(id, {
        listingIds: [listing.id],
        offerCount: 1,
        sourceNames: new Set([listing.source.name]),
        currentTotal: total,
        freshestAt: listing.freshnessCapturedAt,
        bestListing,
      });
      continue;
    }
    existing.listingIds.push(listing.id);
    existing.offerCount += 1;
    existing.sourceNames.add(listing.source.name);
    if (total < existing.currentTotal) {
      existing.currentTotal = total;
      existing.bestListing = bestListing;
    }
    if (listing.freshnessCapturedAt > existing.freshestAt) {
      existing.freshestAt = listing.freshnessCapturedAt;
    }
  }

  const productIds = [...byProduct.keys()];
  if (productIds.length === 0) return [];

  const history = await prisma.priceHistory.findMany({
    where: {
      listingId: { in: listings.map((l) => l.id) },
    },
    select: { listingId: true, price: true, shipping: true, capturedAt: true },
    orderBy: { capturedAt: "asc" },
  });

  const listingToProduct = new Map(
    listings
      .filter((l) => l.canonicalProductId)
      .map((l) => [l.id, l.canonicalProductId!]),
  );

  const previousByProduct = new Map<string, number>();
  const byDay = new Map<string, Map<string, number>>();
  for (const row of history) {
    const productId = listingToProduct.get(row.listingId);
    if (!productId || row.shipping == null || !Number.isFinite(row.shipping)) continue;
    const day = row.capturedAt.toISOString().slice(0, 10);
    const total = row.price + row.shipping;
    let days = byDay.get(productId);
    if (!days) {
      days = new Map();
      byDay.set(productId, days);
    }
    const existing = days.get(day);
    if (existing == null || total < existing) days.set(day, total);
  }
  for (const [productId, days] of byDay) {
    const points = [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (points.length < 2) continue;
    const previous = points[points.length - 2]![1];
    previousByProduct.set(productId, previous);
  }

  const products = await prisma.canonicalProduct.findMany({
    where: { id: { in: productIds } },
    include: { brand: true, category: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const scored = productIds.flatMap((id) => {
    const product = productById.get(id);
    const agg = byProduct.get(id);
    if (!product || !agg) return [];

    const previousTotal = previousByProduct.get(id) ?? null;
    const discountPercent =
      previousTotal != null && previousTotal > agg.currentTotal + 0.009
        ? Math.round(((previousTotal - agg.currentTotal) / previousTotal) * 100)
        : null;

    let dealBadge = "Multi-offer";
    if (discountPercent != null && discountPercent > 0) {
      dealBadge = `${discountPercent}% lower`;
    } else if (agg.offerCount >= 4) {
      dealBadge = "Most offers";
    } else if (agg.offerCount >= 2) {
      dealBadge = "Compare totals";
    }

    return [
      {
        productId: id,
        brandName: product.brand.name,
        productName: product.modelName,
        categorySlug: product.category.slug,
        imageSrc: productImageFor(id, product.category.slug, product.modelName),
        currentTotal: agg.currentTotal,
        previousTotal: discountPercent != null ? previousTotal : null,
        discountPercent,
        dealBadge,
        offerCount: agg.offerCount,
        sourceCount: agg.sourceNames.size,
        sourceNames: [...agg.sourceNames],
        isSaved: savedProductIds.has(id),
        freshnessMinutesAgo: minutesSince(agg.freshestAt),
        rating: product.averageRating,
        bestListing: agg.bestListing,
      },
    ];
  });

  // Real discount% takes full priority — a product with a genuine price drop
  // always outranks one without, regardless of offer count. Offer count is
  // only a tiebreaker among products with the same (or no) discount.
  return scored
    .sort((a, b) => {
      const discountDiff = (b.discountPercent ?? -1) - (a.discountPercent ?? -1);
      if (discountDiff !== 0) return discountDiff;
      if (b.offerCount !== a.offerCount) return b.offerCount - a.offerCount;
      return a.currentTotal - b.currentTotal;
    })
    .slice(0, limit);
}

/**
 * Real-data rationale for a Best Deal card.
 * Returns null when there is no price-history drop and fewer than 2 offers —
 * never invents a reason.
 */
export function whyThisDeal(item: {
  discountPercent: number | null;
  offerCount: number;
  previousTotal: number | null;
}): string | null {
  if (item.discountPercent != null && item.discountPercent > 0 && item.previousTotal != null) {
    return `${item.discountPercent}% below recent tracked price`;
  }
  if (item.offerCount >= 2) {
    return `Lowest Total Known Cost among ${item.offerCount} approved sources.`;
  }
  return null;
}
