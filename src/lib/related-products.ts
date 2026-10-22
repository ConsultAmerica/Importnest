import { prisma } from "@/lib/prisma";
import { minutesSince, knownOfferTotal } from "@/lib/compare-view";
import { productImageFor } from "@/lib/product-images";
import type { PopularComparison } from "@/lib/popular-comparisons";

/**
 * Other products in the same category, ranked by offer count then freshness —
 * same aggregation approach as getPopularComparisons. Returns the
 * PopularComparison shape so PopularComparisonCard can render it directly.
 * With a small catalog this often returns few or zero items — that's the
 * honest result, not a bug, and callers should hide the section when empty.
 */
export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  limit = 4,
  savedProductIds: Set<string> = new Set(),
): Promise<PopularComparison[]> {
  try {
    return await getRelatedProductsUnsafe(productId, categoryId, limit, savedProductIds);
  } catch (err) {
    console.error("[related-products] unavailable", err);
    return [];
  }
}

async function getRelatedProductsUnsafe(
  productId: string,
  categoryId: string,
  limit = 4,
  savedProductIds: Set<string> = new Set(),
): Promise<PopularComparison[]> {
  const candidates = await prisma.canonicalProduct.findMany({
    where: { categoryId, id: { not: productId } },
    select: { id: true },
  });
  if (candidates.length === 0) return [];
  const candidateIds = candidates.map((c) => c.id);

  const listings = await prisma.listing.findMany({
    where: {
      canonicalProductId: { in: candidateIds },
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
    offerCount: number;
    sourceNames: Set<string>;
    lowestTotalCost: number;
    freshestAt: Date;
    bestListing: PopularComparison["bestListing"];
  };
  const byProduct = new Map<string, Agg>();
  for (const listing of listings) {
    const id = listing.canonicalProductId;
    if (!id) continue;
    const total = knownOfferTotal(listing.price, listing.shipping, listing.fees);
    const bestListing: PopularComparison["bestListing"] = {
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
        offerCount: 1,
        sourceNames: new Set([listing.source.name]),
        lowestTotalCost: total,
        freshestAt: listing.freshnessCapturedAt,
        bestListing,
      });
      continue;
    }
    existing.offerCount += 1;
    existing.sourceNames.add(listing.source.name);
    if (total < existing.lowestTotalCost) {
      existing.lowestTotalCost = total;
      existing.bestListing = bestListing;
    }
    if (listing.freshnessCapturedAt > existing.freshestAt) {
      existing.freshestAt = listing.freshnessCapturedAt;
    }
  }

  const rankedIds = [...byProduct.entries()]
    .sort((a, b) => {
      if (b[1].offerCount !== a[1].offerCount) return b[1].offerCount - a[1].offerCount;
      return b[1].freshestAt.getTime() - a[1].freshestAt.getTime();
    })
    .slice(0, limit)
    .map(([id]) => id);

  if (rankedIds.length === 0) return [];

  const products = await prisma.canonicalProduct.findMany({
    where: { id: { in: rankedIds } },
    include: { brand: true, category: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  return rankedIds.flatMap((id) => {
    const product = productById.get(id);
    const agg = byProduct.get(id);
    if (!product || !agg) return [];
    return [
      {
        productId: id,
        brandName: product.brand.name,
        productName: product.modelName,
        categorySlug: product.category.slug,
        imageSrc: productImageFor(id, product.category.slug, product.modelName),
        lowestTotalCost: agg.lowestTotalCost,
        offerCount: agg.offerCount,
        sourceCount: agg.sourceNames.size,
        sourceNames: [...agg.sourceNames],
        freshnessMinutesAgo: minutesSince(agg.freshestAt),
        rating: product.averageRating,
        isSaved: savedProductIds.has(id),
        bestListing: agg.bestListing,
      },
    ];
  });
}
