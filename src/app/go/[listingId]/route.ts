import { randomUUID } from "crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSafeRetailerUrl, knownOfferTotal } from "@/lib/compare-view";
import { handoffHtml } from "@/lib/handoff-page";
import { probeOfferLinkHealth } from "@/lib/offer-link-health";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  const { listingId } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { source: { select: { name: true } } },
  });

  if (!listing?.url || !isSafeRetailerUrl(listing.url)) {
    const unavailable = new URL("/offer-unavailable", request.url);
    unavailable.searchParams.set("listingId", listingId);
    if (listing?.canonicalProductId) {
      unavailable.searchParams.set("productId", listing.canonicalProductId);
    }
    return NextResponse.redirect(unavailable, 303);
  }

  await prisma.outboundReferral.create({
    data: { listingId: listing.id, referralToken: randomUUID() },
  });

  // Click telemetry is the OutboundReferral row above. Health probe runs after
  // the redirect response is sent so handoff latency stays low.
  const handoffUrl = listing.url;
  const ingestedPrice = listing.price;
  const handoffListingId = listing.id;
  after(() =>
    probeOfferLinkHealth({
      listingId: handoffListingId,
      url: handoffUrl,
      ingestedPrice,
    }),
  );

  // A short hand-off screen instead of an instant jump to another site: says
  // where the shopper is going and what total we compared. It never claims the
  // price is guaranteed — the retailer sets it at checkout.
  const merchant = listing.sellerName?.trim() || listing.source.name;
  return new NextResponse(
    handoffHtml({
      merchant,
      url: listing.url,
      total: knownOfferTotal(listing.price, listing.shipping, listing.fees),
      item: listing.price,
      shipping: listing.shipping,
      fees: listing.fees,
    }),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
