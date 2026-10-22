"use client";

import Link from "next/link";
import { AddToCartButton } from "@/components/AddToCartButton";
import { RefreshPricesButton } from "@/components/RefreshPricesButton";
import { formatConditionLabel, hasDisclosedShipping, totalKnownCost } from "@/lib/compare-view";
import type { RankingFactor } from "@/lib/compare-view";

export type OfferActionsProduct = {
  productId: string;
  productName: string;
  brandName: string;
  imageUrl: string;
};

/** Minimal listing shape this component needs — real, already-fetched fields only, never fabricated. */
export type OfferActionsListing = {
  id: string;
  sourceName: string;
  condition: string;
  price: number;
  shipping: number | null;
  fees: number;
  /** Present only when the retailer URL passed `isSafeRetailerUrl`. */
  url?: string;
};

export type OfferActionsExplanation = {
  label: string;
  rationale: string;
  factors: RankingFactor[];
  missingInformation: string[];
};

/**
 * One reusable action row for a compare-page offer card: Why this option ·
 * View retailer offer · Add this offer to cart · Refresh price. Every action
 * is capability-gated by its caller (canX props) instead of always rendering
 * and hoping the underlying data supports it — an action with no real target
 * (no retailer URL, no listing id, nothing to refresh) is omitted, never
 * shown disabled-but-clickable or wired to a no-op.
 */
export function OfferActions({
  product,
  listing,
  explanation,
  canAddToCart = true,
  canRefreshPrice = false,
  canViewRetailerOffer,
  canExplain = true,
  onAddToCart,
  onRefreshPrice,
  onViewRetailerOffer,
  onExplain,
}: {
  product: OfferActionsProduct;
  listing: OfferActionsListing;
  /** Real per-listing ranking explanation — omitted only when genuinely unavailable. */
  explanation?: OfferActionsExplanation | null;
  /** False hides "Add this offer to cart" entirely — never render it wired to fake data. */
  canAddToCart?: boolean;
  /** True only when a real refresh action exists for this product's listings. */
  canRefreshPrice?: boolean;
  /** Defaults to whether `listing.url` is set; pass explicitly to force-hide. */
  canViewRetailerOffer?: boolean;
  canExplain?: boolean;
  onAddToCart?: () => void;
  onRefreshPrice?: () => void;
  onViewRetailerOffer?: () => void;
  onExplain?: () => void;
}) {
  const hasRetailerLink = Boolean(listing.url) && (canViewRetailerOffer ?? true);
  const shippingDisclosed = hasDisclosedShipping(listing.shipping);
  const total = totalKnownCost({
    price: listing.price,
    verifiedDiscount: 0,
    shipping: listing.shipping,
    mandatoryFees: listing.fees,
  });
  const positiveFactors = explanation?.factors.filter((f) => f.positive).slice(0, 3) ?? [];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {canExplain ? (
        <details className="group/why relative">
          <summary
            onClick={onExplain}
            className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-link hover:underline [&::-webkit-details-marker]:hidden"
          >
            Why this option
          </summary>
          <div className="relative z-20 mt-2 w-72 max-w-[80vw] rounded-xl border border-border bg-panel p-3 text-xs leading-relaxed text-foreground/85 shadow-[var(--shadow-panel)]">
            {explanation?.rationale?.trim() ? (
              <>
                <p className="font-semibold text-foreground">{explanation.label}</p>
                <p className="mt-1">{explanation.rationale}</p>
                {positiveFactors.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {positiveFactors.map((f) => (
                      <li key={f.label}>✓ {f.label}</li>
                    ))}
                  </ul>
                ) : null}
                {explanation.missingInformation.length > 0 ? (
                  <p className="mt-2 text-muted">
                    Not available: {explanation.missingInformation.join(", ")}
                  </p>
                ) : null}
              </>
            ) : (
              <p>
                This option is shown because it is an approved-source offer with available price
                data.
              </p>
            )}
            <Link
              href={`/compare/${product.productId}/why/${listing.id}`}
              className="mt-2 inline-block font-semibold text-link hover:underline"
            >
              Full explanation →
            </Link>
          </div>
        </details>
      ) : null}

      {hasRetailerLink ? (
        <a
          href={`/go/${listing.id}`}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={onViewRetailerOffer}
          className="btn-cta inline-flex min-h-11 items-center gap-1.5 px-4 py-2 text-center text-sm"
        >
          View offer on {listing.sourceName}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
          </svg>
          <span className="sr-only">(opens the retailer’s site in a new tab)</span>
        </a>
      ) : null}

      {hasRetailerLink ? (
        // Set expectations before the hand-off: this leaves Importnest.
        <p className="basis-full text-xs text-muted">
          You’ll finish checkout on {listing.sourceName}’s site — Importnest never takes payment.
        </p>
      ) : null}

      {canAddToCart ? (
        <AddToCartButton
          label="Save offer for later"
          addAriaLabel={`Save ${listing.sourceName} offer for ${product.productName} to compare cart`}
          removeAriaLabel={`Remove ${listing.sourceName} offer for ${product.productName} from compare cart`}
          listingId={listing.id}
          productId={product.productId}
          title={product.productName}
          brand={product.brandName}
          imageUrl={product.imageUrl}
          retailerName={listing.sourceName}
          condition={formatConditionLabel(listing.condition)}
          itemPrice={listing.price}
          shipping={hasDisclosedShipping(listing.shipping) ? listing.shipping : undefined}
          fees={listing.fees}
          totalKnownCost={shippingDisclosed ? total : undefined}
          onAdded={onAddToCart}
        />
      ) : null}

      {canRefreshPrice ? (
        <RefreshPricesButton productId={product.productId} compact onRefreshed={onRefreshPrice} />
      ) : null}
    </div>
  );
}
