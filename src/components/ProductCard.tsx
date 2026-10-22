import Image from "next/image";
import Link from "next/link";
import { ProductCardActions } from "@/components/ProductCardActions";
import { ProductCardSaveButton } from "@/components/ProductCardSaveButton";
import { TrackPriceButton } from "@/components/TrackPriceButton";
import { ProductImage } from "@/components/ProductImage";
import { RefreshPricesButton } from "@/components/RefreshPricesButton";
import { APPROVED_RETAILER_TRUST } from "@/lib/approved-sources";
import { colorSwatchStyle } from "@/lib/color-swatches";
import {
  formatFreshness,
  getFreshnessWarningLevel,
  needsFreshnessWarning,
  freshnessWarningLabel,
} from "@/lib/freshness";
import { sourceImageFor } from "@/lib/images";
import { productImageAlt } from "@/lib/product-images";
import { hasDisclosedShipping } from "@/lib/compare-view";
import { TkcRetailerDialog, type TkcOfferLine } from "@/components/TkcRetailerDialog";

function merchantHandoff(offerCount: number | null | undefined, sourceNames: string[]) {
  if (offerCount == null || offerCount < 1 || sourceNames.length === 0) return null;
  const shown = sourceNames.slice(0, 3);
  const extra = sourceNames.length - shown.length;
  const who = extra > 0 ? `${shown.join(", ")}, +${extra} more` : shown.join(" and ");
  const offers = offerCount === 1 ? "1 offer" : `${offerCount} offers`;
  return `${offers} from ${who}`;
}

function swatchCss(label: string): string {
  return colorSwatchStyle(label).background;
}

export type ProductCardBadge = "Popular" | "Best deal" | "Top product" | "Featured";

export type ProductCardListing = {
  listingId: string;
  sourceName: string;
  condition: string;
  price: number;
  shipping: number | null;
  fees: number;
};

export type ProductCardProps = {
  productId: string;
  href: string;
  imageSrc: string;
  brandName: string;
  productName: string;
  /** Short supporting line — omitted when empty. */
  subtitle?: string | null;
  badge?: ProductCardBadge | string | null;
  rating?: number | null;
  /** Real review count — only when provided by catalog. */
  ratingCount?: number | null;
  /** Spec rows for list view — real ProductAttribute values only. */
  specAttributes?: { key: string; value: string; unit: string | null }[];
  /** Color variants from catalog attributes — accessories/electronics. */
  colorSwatches?: string[];
  /** Category-intent badges (fitment, IPX, FDA, etc.) — real attributes only. */
  intentBadges?: string[];
  /** Honest availability signals from listings — never invent stock counts or ETAs. */
  availability?: {
    hasOffers: boolean;
    hasPickup?: boolean;
    hasFreeShipping?: boolean;
    deliveryLabel?: string | null;
  } | null;
  /** Lowest Total Known Cost — hidden when null. */
  fromPrice?: number | null;
  /** Prior price for strikethrough — only when real history / seeded demo exists. */
  previousPrice?: number | null;
  /** Approved retailers behind the offers, lowest total first. */
  sourceNames?: string[];
  /** Per-retailer Total Known Cost lines for the info dialog. */
  offerBreakdown?: TkcOfferLine[];
  offerCount?: number | null;
  sourceCount?: number | null;
  freshnessMinutesAgo?: number | null;
  /** Category slug for subtype image fallbacks when imageSrc errors. */
  categorySlug?: string | null;
  bestListing?: ProductCardListing | null;
  isSaved?: boolean;
  /** An active price-drop alert exists for this shopper — the bell shows as on. */
  alertActive?: boolean;
  signedIn?: boolean;
  redirectTo?: string;
  /** Extra match/status chips — never fabricated. */
  extraBadges?: string[];
  /**
   * When false, hide Save / Compare / Add to cart (demo browse cards).
   * Prices/ratings still render only if the caller passes real seeded values.
   */
  showCommerceActions?: boolean;
  /** Override primary CTA label (default “Compare offers”). */
  primaryCtaLabel?: string;
  /** Optional note under rating (e.g. “demo score”). */
  ratingNote?: string | null;
  /** Optional note after meta line (e.g. “browsing example”). */
  metaNote?: string | null;
  /** Idealo-style deal rationale — only when backed by real history / multi-offer data. */
  dealReason?: string | null;
  /** Horizontal list layout for search results density toggle. */
  compactList?: boolean;
};

function badgeToneClass(badge: string) {
  const key = badge.toLowerCase();
  if (key.includes("price drop") || key.includes("lowest tracked")) {
    return "badge-savings";
  }
  if (key.includes("deal") || key.includes("save") || key.includes("%") || key === "demo") {
    return key === "demo" || key.includes("demo")
      ? "border border-border bg-panel/95 text-foreground"
      : "badge-savings";
  }
  if (key.includes("top")) return "badge-top";
  if (key.includes("popular")) return "badge-popular";
  return "badge-accent";
}

/** "Item $220.00 + $14.50 ship/fees" for the lowest offer — honest about undisclosed shipping. */
function lowestOfferMakeup(listing: ProductCardListing): string {
  const item = `Item $${listing.price.toFixed(2)}`;
  if (!hasDisclosedShipping(listing.shipping)) return `${item} · shipping not disclosed`;
  const shipFees = listing.shipping + listing.fees;
  return shipFees <= 0.009 ? `${item} · free shipping` : `${item} + $${shipFees.toFixed(2)} ship/fees`;
}

/** Curated trust badges only (approved-sources) — never inferred from a retailer's name. */
function isAuthorizedSource(sourceId: string | undefined): boolean {
  if (!sourceId) return false;
  const badge = APPROVED_RETAILER_TRUST[sourceId]?.badge;
  return badge === "Authorized dealer" || badge === "Manufacturer";
}

/** Why a total is what it is: shipping and fees called out separately, never assumed. */
function totalDrivers(line: TkcOfferLine): string[] {
  const out: string[] = [];
  if (line.shipping == null) out.push("ship not disclosed");
  else if (line.shipping <= 0.009) out.push("free ship");
  else out.push(`+$${line.shipping.toFixed(2)} ship`);
  if (line.fees > 0.009) out.push(`+$${line.fees.toFixed(2)} fees`);
  if (line.pickup) out.push("pickup");
  return out;
}

function TopRetailerLines({ lines }: { lines: TkcOfferLine[] }) {
  return (
    <ol>
      {[...lines]
        .sort((a, b) => a.total - b.total)
        .slice(0, 3)
        .map((line, i) => {
          const body = (
            <>
              <span className="tkc-row-main">
                <span className="tkc-row-name">
                  <span className="truncate">{line.sourceName}</span>
                  {isAuthorizedSource(line.sourceId) ? (
                    <span className="tkc-row-auth" title="Authorized seller — manufacturer warranty applies">
                      ✓ Authorized
                    </span>
                  ) : null}
                </span>
                <span className="tkc-row-drivers">
                  {i === 0 ? <strong>Lowest total · </strong> : null}
                  {totalDrivers(line).join(" · ")}
                </span>
              </span>
              <span className="tkc-row-total">
                ${line.total.toFixed(2)}
                {line.listingId ? <span aria-hidden="true"> ↗</span> : null}
              </span>
            </>
          );
          return (
            <li key={line.listingId ?? line.sourceId ?? line.sourceName}>
              {line.listingId ? (
                // Straight to this retailer's offer; /go shows a short hand-off screen first.
                <a
                  href={`/go/${line.listingId}`}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="tkc-row-link"
                  aria-label={`${line.sourceName}: $${line.total.toFixed(2)} Total Known Cost — opens the retailer’s site in a new tab`}
                >
                  {body}
                </a>
              ) : (
                <span className="tkc-row-link">{body}</span>
              )}
            </li>
          );
        })}
    </ol>
  );
}

/**
 * Visual-first comparison-site product card.
 * Never invents price, offer, source, or rating values — omit when unavailable.
 */
export function ProductCard({
  productId,
  href,
  imageSrc,
  brandName,
  productName,
  subtitle,
  badge,
  rating,
  ratingCount,
  specAttributes = [],
  colorSwatches = [],
  intentBadges = [],
  availability = null,
  fromPrice,
  previousPrice,
  offerCount,
  sourceCount,
  sourceNames = [],
  offerBreakdown = [],
  freshnessMinutesAgo,
  categorySlug,
  bestListing,
  isSaved = false,
  alertActive = false,
  signedIn = false,
  redirectTo,
  extraBadges = [],
  showCommerceActions = true,
  primaryCtaLabel = "Compare offers",
  ratingNote,
  metaNote,
  dealReason,
  compactList = false,
}: ProductCardProps) {
  const saveRedirect = redirectTo ?? href;
  const showOffers = offerCount != null && offerCount > 0;
  const showSources = sourceCount != null && sourceCount > 0;
  const showPrice = fromPrice != null;
  const showRating = rating != null;
  const hasFreshnessField = freshnessMinutesAgo !== undefined;
  const showFreshnessWarning = hasFreshnessField && needsFreshnessWarning(freshnessMinutesAgo);
  const subtitleText = subtitle?.trim() || null;
  const imageAlt = productImageAlt({
    title: `${brandName} ${productName}`,
    productName,
  });
  const commerce = showCommerceActions;
  const offerLabel = showOffers
    ? offerCount === 1
      ? "1 offer"
      : `${offerCount} offers`
    : null;
  const sourceLabel = showSources
    ? sourceCount === 1
      ? "1 source"
      : `${sourceCount} sources`
    : null;
  const merchantLine = merchantHandoff(offerCount, sourceNames);

  return (
    <article className={`product-card group ${compactList ? "product-card-list" : ""}`}>
      <div className="product-card-media-wrap">
        <Link
          href={href}
          className="product-card-media focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <ProductImage
            src={imageSrc}
            alt={imageAlt}
            category={categorySlug}
            title={productName}
            subtitle={subtitleText}
            size="card"
            className="transition duration-300 group-hover:scale-[1.04]"
            sizes="(max-width:640px) 50vw, (max-width:1280px) 25vw, 20vw"
          />
          {badge ? (
            <span
              className={`product-card-badge absolute bottom-3 left-3 z-10 rounded-full px-2.5 py-1 text-[11px] font-bold leading-tight shadow-sm ${badgeToneClass(badge)}`}
            >
              {badge}
            </span>
          ) : null}
        </Link>
        {/* Phones: Save + Track float on the image corners so the body stays about price. */}
        {commerce ? (
          <div className="card-overlay-actions">
            <ProductCardSaveButton
              productId={productId}
              isSaved={isSaved}
              signedIn={signedIn}
              redirectTo={saveRedirect}
              variant="overlay"
            />
            <TrackPriceButton
              productId={productId}
              productName={productName}
              currentTotal={fromPrice ?? null}
              signedIn={signedIn}
              redirectTo={saveRedirect}
              initiallyTracking={alertActive}
              variant="overlay"
            />
          </div>
        ) : null}
      </div>

      <div className="product-card-body">
        {/* info / buy wrappers are display:contents in grid cards; list rows lay them out as columns. */}
        <div className="product-card-info">
        <div className="min-w-0 space-y-1">
          <p className="product-card-brand">{brandName}</p>
          <Link href={href} className="product-card-title line-clamp-2 hover:text-link">
            {productName}
          </Link>
          {subtitleText ? (
            <p className="line-clamp-1 text-xs leading-relaxed text-muted">{subtitleText}</p>
          ) : null}
        </div>

        {extraBadges.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {extraBadges.slice(0, 2).map((label) => (
              <span key={label} className="product-card-chip">
                {label}
              </span>
            ))}
          </div>
        ) : null}

        {showRating ? (
          <p className="product-card-rating">
            <span className="product-card-rating-stars" aria-hidden="true">
              ★
            </span>
            <span>{rating.toFixed(1)}</span>
            {ratingCount != null && ratingCount > 0 ? (
              <span className="font-medium text-muted"> ({ratingCount})</span>
            ) : null}
            {ratingNote ? (
              <span className="font-medium text-muted"> {ratingNote}</span>
            ) : null}
          </p>
        ) : null}

        {intentBadges.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {intentBadges.map((label) => (
              <span key={label} className="product-card-intent-badge">
                {label}
              </span>
            ))}
          </div>
        ) : null}

        {colorSwatches.length > 0 ? (
          <ul className="product-card-swatches" aria-label="Available colors">
            {colorSwatches.slice(0, 5).map((c) => (
              <li key={c} title={c}>
                <span
                  className="product-card-swatch"
                  style={
                    // lazy import avoided — inline known swatches via CSS var fallback
                    { background: swatchCss(c) }
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}

        {availability ? (
          <ul className="product-card-status" aria-label="Availability">
            {availability.hasOffers ? (
              <li className="product-card-status-ok">Offers available</li>
            ) : (
              <li className="product-card-status-warn">No live offers</li>
            )}
            {availability.hasFreeShipping ? (
              <li className="product-card-status-ok">Free shipping</li>
            ) : null}
            {availability.hasPickup ? (
              <li className="product-card-status-ok">Pickup available</li>
            ) : null}
            {availability.deliveryLabel?.trim() ? (
              <li className="product-card-status-info">{availability.deliveryLabel.trim()}</li>
            ) : null}
          </ul>
        ) : null}

        {compactList && specAttributes.length > 0 ? (
          <ul className="product-card-specs">
            {specAttributes.slice(0, 5).map((a) => (
              <li key={`${a.key}-${a.value}`}>
                <span className="product-card-spec-key">{a.key}</span>
                <span>
                  {a.value}
                  {a.unit ? ` ${a.unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        </div>

        <div className="product-card-buy">
        {showPrice ? (
          <div className="product-card-price-block">
            <div className="product-card-price-row">
              <div className="product-card-price">
                <span className="product-card-price-eyebrow">From</span>
                <span className="product-card-price-value">${fromPrice.toFixed(2)}</span>
              </div>
              {previousPrice != null ? (
                <p className="product-card-price-was">${previousPrice.toFixed(2)}</p>
              ) : null}
            </div>
            <p className="product-card-price-caption">Total Known Cost</p>
            {/* Who has that price and what it's made of, without opening Compare —
                bestListing is the listing behind fromPrice. */}
            {bestListing ? (
              <>
                <p className="product-card-lowest-at">
                  {offerCount != null && offerCount > 1 ? "Lowest at" : "Offer from"}{" "}
                  <span className="product-card-lowest-at-source">{bestListing.sourceName}</span>
                </p>
                <p className="product-card-lowest-makeup">
                  <span aria-hidden="true">└ </span>
                  {lowestOfferMakeup(bestListing)}
                </p>
              </>
            ) : null}
            {offerBreakdown.length > 1 ? (
              <>
                {/* Phones / grid cards: collapsed peek. Desktop list rows: always-open strip. */}
                <details className="product-card-tkc-peek">
                  <summary>Top {Math.min(3, offerBreakdown.length)} retailer totals</summary>
                  <TopRetailerLines lines={offerBreakdown} />
                </details>
                <div className="product-card-tkc-strip" aria-label="Top retailer totals">
                  <TopRetailerLines lines={offerBreakdown} />
                </div>
              </>
            ) : null}
            <div className="product-card-tkc-badge" title="Item + shipping + mandatory fees − discounts from approved sources">
              {bestListing && !hasDisclosedShipping(bestListing.shipping)
                ? "Shipping not disclosed"
                : "Item + ship + fees"}
              <TkcRetailerDialog
                offerCount={offerCount}
                lines={
                  offerBreakdown.length > 0
                    ? offerBreakdown
                    : bestListing
                      ? [
                          {
                            sourceName: bestListing.sourceName,
                            total: fromPrice,
                            price: bestListing.price,
                            shipping: bestListing.shipping,
                            fees: bestListing.fees,
                          } satisfies TkcOfferLine,
                        ]
                      : []
                }
              />
            </div>
          </div>
        ) : null}

        {(offerLabel ||
          sourceLabel ||
          hasFreshnessField ||
          metaNote?.trim() ||
          dealReason?.trim() ||
          offerCount === 0) ? (
          <div className="product-card-meta">
            {merchantLine ? (
              <div className="flex flex-wrap items-center gap-2">
                {offerBreakdown.slice(0, 4).map((line) =>
                  line.sourceId ? (
                    <span
                      key={line.sourceId}
                      className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border"
                      title={line.sourceName}
                    >
                      <Image
                        src={sourceImageFor(line.sourceId)}
                        alt=""
                        width={20}
                        height={20}
                        className="h-5 w-5 object-contain"
                      />
                    </span>
                  ) : null,
                )}
                <p className="product-card-meta-line min-w-0">{merchantLine}</p>
              </div>
            ) : offerLabel ? (
              <p className="product-card-meta-line whitespace-nowrap">{offerLabel}</p>
            ) : null}
            {!merchantLine && sourceLabel ? (
              <p className="product-card-meta-line whitespace-nowrap">{sourceLabel}</p>
            ) : null}
            {hasFreshnessField && !showFreshnessWarning ? (
              <p className="product-card-meta-line">
                <span className="product-card-meta-label">Last checked</span>
                {formatFreshness(freshnessMinutesAgo)}
              </p>
            ) : null}
            {metaNote?.trim() ? (
              <p className="product-card-meta-line">{metaNote.trim()}</p>
            ) : null}
            {dealReason?.trim() ? (
              <p className="product-card-deal-reason text-xs font-semibold leading-snug text-navy-800">
                {dealReason.trim()}
              </p>
            ) : null}
            {offerCount === 0 ? (
              <p className="text-xs font-medium text-navy-800">No offers</p>
            ) : null}
            {showFreshnessWarning ? (
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium text-amber-800">
                {freshnessWarningLabel(freshnessMinutesAgo)}
                {commerce ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <RefreshPricesButton
                      productId={productId}
                      compact
                      emphasize={getFreshnessWarningLevel(freshnessMinutesAgo) === "outdated"}
                    />
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        {commerce ? (
          <ProductCardActions
            productId={productId}
            productName={productName}
            brandName={brandName}
            imageSrc={imageSrc}
            href={href}
            bestListing={bestListing}
            primaryCtaLabel={primaryCtaLabel}
            isSaved={isSaved}
            alertActive={alertActive}
            fromPrice={fromPrice ?? null}
            offerCount={offerCount ?? null}
            signedIn={signedIn}
            redirectTo={saveRedirect}
          />
        ) : (
          <div className="product-card-actions">
            <Link
              href={href}
              className="product-card-action-wide btn-cta flex min-h-11 items-center justify-center px-3 py-2.5 text-center text-sm font-semibold"
            >
              {primaryCtaLabel}
            </Link>
          </div>
        )}
        </div>
      </div>
    </article>
  );
}
