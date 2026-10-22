import { prisma } from "@/lib/prisma";
import type { ConnectorResult } from "./types";

export async function upsertConnectorListings(result: ConnectorResult) {
  const source = await prisma.source.findUnique({ where: { id: result.sourceId } });
  if (!source || !source.isActive) {
    throw new Error(`Source not found or inactive: ${result.sourceId}`);
  }

  let upserted = 0;

  for (const item of result.listings) {
    // Match canonical product by UPC or MPN when possible
    const identifier = item.upc
      ? await prisma.productIdentifier.findUnique({ where: { value: item.upc } })
      : item.mpn
        ? await prisma.productIdentifier.findFirst({
            where: { type: "MPN", value: item.mpn },
          })
        : null;

    const canonicalProductId = identifier?.canonicalProductId ?? null;

    // Dedup on real offer identity, not a derived id, so re-syncs update the
    // same row instead of creating duplicates when a merchant name has
    // ambiguous slugified characters.
    const existing = await prisma.listing.findFirst({
      where: {
        sourceId: result.sourceId,
        externalId: item.externalId,
        sellerName: item.sellerName ?? null,
        condition: item.condition,
      },
    });

    const data = {
      sourceId: result.sourceId,
      externalId: item.externalId,
      sellerName: item.sellerName,
      url: item.url,
      canonicalProductId,
      condition: item.condition,
      price: item.price,
      shipping: item.shipping ?? null,
      fees: item.fees ?? 0,
      deliveryLabel: item.deliveryLabel,
      freshnessCapturedAt: result.fetchedAt,
    };

    const listing = existing
      ? await prisma.listing.update({ where: { id: existing.id }, data })
      : await prisma.listing.create({ data });

    await prisma.priceHistory.create({
      data: {
        listingId: listing.id,
        price: item.price,
        shipping: item.shipping ?? null,
        capturedAt: result.fetchedAt,
      },
    });

    if (canonicalProductId) {
      await prisma.productMatch.upsert({
        where: { id: `match-${listing.id}` },
        create: {
          id: `match-${listing.id}`,
          canonicalProductId,
          listingId: listing.id,
          type: "exact",
          confidence: 0.98,
          status: "approved",
        },
        update: {
          confidence: 0.98,
          status: "approved",
        },
      });
    }

    upserted += 1;
  }

  return { sourceId: result.sourceId, upserted };
}