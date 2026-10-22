"use client";

import Image from "next/image";
import { CostBreakdown } from "@/components/CostBreakdown";
import { Freshness } from "@/components/Freshness";
import { OfferActions } from "@/components/OfferActions";
import { ProductCardSaveButton } from "@/components/ProductCardSaveButton";
import { ProtectionDetails } from "@/components/ProtectionDetails";
import { SourceAuthorityBadge } from "@/components/SourceAuthorityBadge";
import {
  FALLBACK_COPY,
  formatConditionLabel,
  formatFreshness,
  hasDisclosedShipping,
  totalKnownCost,
  type CompareRow,
} from "@/lib/compare-view";
import { freshnessWarningLabel, needsFreshnessWarning } from "@/lib/freshness";
import { BRAND_FALLBACK_IMAGE, sourceImageFor } from "@/lib/images";

/** Single pill style shared by every card badge — only the tone color varies. */
function Badge({
  tone,
  children,
}: {
  tone: "top" | "authorized" | "neutral" | "fresh" | "stale" | "delivery";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "top"
      ? "bg-cta/30 text-navy-900"
      : tone === "authorized"
        ? "bg-navy-100 text-navy-900"
        : tone === "fresh"
          ? "badge-savings"
          : tone === "stale"
            ? "bg-amber-100 text-amber-900"
            : tone === "delivery"
              ? "bg-violet-100 text-violet-900"
              : "bg-surface text-muted";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M6.5 3.5H3.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3M9.5 2.5h4v4M7 9l6.5-6.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function tkcMicroBreakdown(listing: CompareRow["listing"], total: number): string {
  const item = `$${listing.price.toFixed(2)} item`;
  if (!hasDisclosedShipping(listing.shipping)) {
    return `${item} · shipping not disclosed · known from $${total.toFixed(2)}`;
  }
  const ship =
    listing.shipping === 0 ? "free shipping" : `$${listing.shipping!.toFixed(2)} shipping`;
  const fees =
    listing.mandatoryFees > 0.009 ? ` + $${listing.mandatoryFees.toFixed(2)} fees` : "";
  const discount =
    listing.verifiedDiscount > 0.009
      ? ` − $${listing.verifiedDiscount.toFixed(2)} discount`
      : "";
  return `${item} + ${ship}${fees}${discount}`;
}

function returnChipLabel(listing: CompareRow["listing"]): string | null {
  const structured = listing.protectionDetails?.returnPeriod?.trim();
  if (structured) return structured;
  if (listing.returnPolicyLabel && listing.returnPolicyLabel !== FALLBACK_COPY.returns) {
    return listing.returnPolicyLabel;
  }
  return null;
}

/**
 * Mobile-first compare offer card: TKC hero, inline ship breakdown,
 * progressive disclosure for policy metadata, clear external handoff.
 */
export function OfferCard({
  productId,
  productName,
  brandName,
  productImageSrc,
  row,
  isTop,
  recommendationLabel,
  signedIn = false,
  isSaved = false,
  redirectTo,
}: {
  productId: string;
  productName: string;
  brandName: string;
  productImageSrc: string;
  row: CompareRow;
  isTop: boolean;
  recommendationLabel: string;
  signedIn?: boolean;
  isSaved?: boolean;
  redirectTo?: string;
}) {
  const { listing, recommendation } = row;
  const total = totalKnownCost(listing);
  const logoSrc = listing.hasDistinctSeller
    ? BRAND_FALLBACK_IMAGE
    : sourceImageFor(listing.sourceId);
  const fulfillment = listing.pickupAvailable
    ? listing.deliveryLabel !== "Delivery estimate unavailable"
      ? listing.deliveryLabel
      : "Pickup available"
    : listing.deliveryLabel;
  const deliveryBadge =
    fulfillment && fulfillment !== "Delivery estimate unavailable" ? fulfillment : null;
  const returnsLabel = returnChipLabel(listing);
  const saveRedirect = redirectTo ?? `/compare/${productId}`;
  const micro = tkcMicroBreakdown(listing, total);
  const hasRetailerLink = Boolean(listing.url);

  return (
    <li
      className={`offer-card offer-card-v2 rounded-2xl border bg-panel p-4 transition shadow-[var(--shadow-panel)] ${
        isTop ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent/40"
      }`}
    >
      <div className="offer-card-top">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {isTop ? (
            <Badge tone="top">
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true">⚡</span>
                {recommendationLabel || "Best overall"}
              </span>
            </Badge>
          ) : null}
          <SourceAuthorityBadge
            sourceType={listing.sourceType}
            sourceId={listing.sourceId}
            sourceName={listing.sourceName}
          />
        </div>
        <span
          className={`shrink-0 text-xs font-bold tabular-nums ${
            listing.dataCompletenessPct >= 75
              ? "text-emerald-800"
              : listing.dataCompletenessPct >= 50
                ? "text-navy-800"
                : "text-amber-800"
          }`}
        >
          Completeness: {listing.dataCompletenessPct}%
        </span>
      </div>

      <div className="offer-card-identity mt-3">
        <Image
          src={logoSrc}
          alt={`${listing.sourceName} logo`}
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-xl border border-border bg-white object-contain p-1"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-snug text-navy-900" title={productName}>
            {productName}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-muted" title={listing.sourceName}>
            {listing.sourceName}
          </p>
        </div>
      </div>

      <div className="offer-card-tkc-hero mt-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-800">Total Known Cost</p>
          <p className="offer-card-tkc-value price-text">
            {hasDisclosedShipping(listing.shipping)
              ? `$${total.toFixed(2)}`
              : `from $${total.toFixed(2)}`}
          </p>
        </div>
        <details className="offer-card-tkc-tip group mt-1.5">
          <summary className="flex cursor-pointer list-none items-start gap-1.5 text-xs font-semibold leading-snug text-muted [&::-webkit-details-marker]:hidden">
            <span
              className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-link/40 text-[10px] font-bold text-link"
              aria-hidden="true"
            >
              i
            </span>
            <span className="min-w-0">{micro}</span>
          </summary>
          <div className="mt-2 rounded-xl border border-border bg-surface/80 px-3 py-2">
            <CostBreakdown
              itemPrice={listing.price}
              shipping={listing.shipping}
              mandatoryFees={listing.mandatoryFees}
              verifiedDiscount={
                listing.verifiedDiscount != null && listing.verifiedDiscount > 0
                  ? listing.verifiedDiscount
                  : null
              }
              totalKnownCost={total}
            />
          </div>
        </details>
      </div>

      {(deliveryBadge || returnsLabel) && (
        <ul className="offer-card-facts mt-3" aria-label="Fulfillment and returns">
          {deliveryBadge ? (
            <li>
              <span aria-hidden="true">🚚</span> {deliveryBadge}
            </li>
          ) : null}
          {returnsLabel ? (
            <li>
              <span aria-hidden="true">🔄</span> {returnsLabel}
            </li>
          ) : null}
        </ul>
      )}

      <div className="offer-card-cta-row mt-3">
        <ProductCardSaveButton
          productId={productId}
          isSaved={isSaved}
          signedIn={signedIn}
          redirectTo={saveRedirect}
        />
        {hasRetailerLink ? (
          <a
            href={`/go/${listing.id}`}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="btn-cta offer-handoff-cta min-h-11 flex-1 gap-1.5 px-3 py-2.5 text-center text-sm"
          >
            View offer
            <ExternalLinkIcon />
          </a>
        ) : null}
      </div>

      <details className="offer-card-more mt-3">
        <summary className="cursor-pointer list-none py-1 text-xs font-bold text-link [&::-webkit-details-marker]:hidden">
          More details · condition, protection, freshness
        </summary>
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          <p className="text-sm text-foreground/85">
            <span className="text-xs font-medium text-muted">Condition · </span>
            {formatConditionLabel(listing.condition)}
          </p>
          <p className="text-sm text-foreground/85">
            <span className="text-xs font-medium text-muted">Delivery / pickup · </span>
            {fulfillment}
          </p>
          {listing.sourceTypeLabel ? (
            <p className="text-[11px] uppercase tracking-wide text-muted">
              Source details · {listing.sourceTypeLabel}
            </p>
          ) : null}
          <div>
            <p className="text-xs font-medium text-muted">Protection</p>
            <ProtectionDetails details={listing.protectionDetails} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Freshness</p>
            <Freshness minutesAgo={listing.freshnessMinutesAgo} />
            {needsFreshnessWarning(listing.freshnessMinutesAgo) ? (
              <p className="mt-1 text-xs text-amber-800">
                {freshnessWarningLabel(listing.freshnessMinutesAgo)}
              </p>
            ) : null}
          </div>
          <ul className="offer-trust-strip" aria-label="Source confidence">
            <li>
              <span className="offer-trust-pill">{formatFreshness(listing.freshnessMinutesAgo)}</span>
            </li>
            <li>
              <span className="offer-trust-pill">
                {/affiliate/i.test(listing.sourceType) || /affiliate/i.test(listing.sourceTypeLabel)
                  ? "Affiliate link"
                  : listing.sourceTypeLabel || "Partner listing"}
              </span>
            </li>
            <li>
              <span className="offer-trust-pill offer-trust-pill-ok">Sponsored? No</span>
            </li>
          </ul>
          <OfferActions
            product={{
              productId,
              productName,
              brandName,
              imageUrl: productImageSrc,
            }}
            listing={{
              id: listing.id,
              sourceName: listing.sourceName,
              condition: listing.condition,
              price: listing.price,
              shipping: listing.shipping,
              fees: listing.mandatoryFees,
              url: listing.url,
            }}
            explanation={recommendation}
            canAddToCart={
              Boolean(listing.id) && Boolean(listing.sourceName) && Number.isFinite(listing.price)
            }
            canRefreshPrice={needsFreshnessWarning(listing.freshnessMinutesAgo)}
            canViewRetailerOffer={false}
            canExplain={Boolean(recommendation)}
          />
        </div>
      </details>
    </li>
  );
}
