import Link from "next/link";
import { AddToCartButton } from "@/components/AddToCartButton";
import { AddToCompareButton } from "@/components/AddToCompareButton";
import { ProductCardSaveButton } from "@/components/ProductCardSaveButton";
import { TrackPriceButton } from "@/components/TrackPriceButton";
import { formatConditionLabel, hasDisclosedShipping, knownOfferTotal } from "@/lib/compare-view";
import type { ProductCardListing } from "@/components/ProductCard";

/**
 * Primary CTA opens Importnest comparison ("Compare 5 offers"). Secondary row:
 * Save + Track inline on desktop (on phones they float on the image instead),
 * plus Compare-list and Cart. Checkout always happens on the retailer’s site.
 */
export function ProductCardActions({
  productId,
  productName,
  brandName,
  imageSrc,
  href,
  bestListing,
  primaryCtaLabel = "Compare offers",
  isSaved,
  alertActive = false,
  fromPrice = null,
  offerCount = null,
  signedIn,
  redirectTo,
}: {
  productId: string;
  productName: string;
  brandName: string;
  imageSrc: string;
  href: string;
  bestListing?: ProductCardListing | null;
  primaryCtaLabel?: string;
  isSaved: boolean;
  alertActive?: boolean;
  fromPrice?: number | null;
  offerCount?: number | null;
  signedIn: boolean;
  redirectTo: string;
}) {
  // Say how many offers the comparison holds — only for the default label.
  const ctaLabel =
    primaryCtaLabel === "Compare offers" && offerCount != null && offerCount > 1
      ? `Compare ${offerCount} offers`
      : primaryCtaLabel;

  return (
    <div className="product-card-actions">
      <Link
        href={href}
        className="product-card-action-wide btn-cta flex min-h-10 items-center justify-center px-3 py-2.5 text-center text-sm font-semibold"
      >
        {ctaLabel}
      </Link>
      <div className="product-card-actions-row">
        <div className="card-desktop-actions">
          <ProductCardSaveButton
            productId={productId}
            isSaved={isSaved}
            signedIn={signedIn}
            redirectTo={redirectTo}
            variant="inline"
          />
          <TrackPriceButton
            productId={productId}
            productName={productName}
            currentTotal={fromPrice}
            signedIn={signedIn}
            redirectTo={redirectTo}
            initiallyTracking={alertActive}
          />
        </div>
        <AddToCompareButton productId={productId} productName={productName} />
        {bestListing ? (
          <AddToCartButton
            compact
            listingId={bestListing.listingId}
            productId={productId}
            title={productName}
            brand={brandName}
            imageUrl={imageSrc}
            retailerName={bestListing.sourceName}
            condition={formatConditionLabel(bestListing.condition)}
            itemPrice={bestListing.price}
            shipping={hasDisclosedShipping(bestListing.shipping) ? bestListing.shipping : undefined}
            fees={bestListing.fees}
            totalKnownCost={
              hasDisclosedShipping(bestListing.shipping)
                ? knownOfferTotal(bestListing.price, bestListing.shipping, bestListing.fees)
                : undefined
            }
          />
        ) : null}
      </div>
    </div>
  );
}
