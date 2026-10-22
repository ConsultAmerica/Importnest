import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Freshness } from "@/components/Freshness";
import { PageShell } from "@/components/PageShell";
import { getListingExplanation, formatTotalKnownCost } from "@/lib/compare-data";
import { hasDisclosedShipping } from "@/lib/compare-view";
import { BRAND_FALLBACK_IMAGE, sourceImageFor } from "@/lib/images";

export default async function WhyPage({
  params,
}: {
  params: Promise<{ productId: string; listingId: string }>;
}) {
  const { productId, listingId } = await params;
  const data = await getListingExplanation(listingId);
  if (!data) notFound();

  const { listing, recommendation } = data;
  const totalLabel = formatTotalKnownCost(listing);

  return (
    <PageShell>
      <nav className="mb-3 text-xs text-muted">
        <Link href={`/compare/${productId}`} className="text-link hover:underline">
          Back to comparison
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-foreground">Why this offer</span>
      </nav>

      <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        Why this offer is recommended
      </h1>
      <p className="mt-1 text-sm text-muted">
        Transparent explanation of ranking factors and trade-offs.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="panel fade-up p-5 lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">
            {recommendation.label}
          </p>
          <div className="mt-2 flex items-center gap-2.5">
            <Image
              src={
                listing.hasDistinctSeller
                  ? BRAND_FALLBACK_IMAGE
                  : sourceImageFor(listing.sourceId)
              }
              alt=""
              width={40}
              height={40}
              className="rounded-xl border border-border bg-white object-contain p-1"
            />
            <div>
              <h2 className="text-lg font-bold text-foreground">{listing.sourceName}</h2>
              <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
                {listing.sourceTypeLabel ? <span>{listing.sourceTypeLabel} ·</span> : null}
                <Freshness minutesAgo={listing.freshnessMinutesAgo} />
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-foreground/85">{recommendation.rationale}</p>

          <p className="mt-5 text-sm font-semibold text-foreground">Positive factors</p>
          <ul className="mt-2 space-y-1.5 text-sm text-foreground/80">
            {recommendation.factors
              .filter((f) => f.positive)
              .map((f) => (
                <li key={f.label} className="flex gap-2">
                  <span className="font-bold text-navy-900">✓</span>
                  <span>
                    <span className="font-medium">{f.label}</span>
                    <span className="block text-xs text-muted">{f.detail}</span>
                  </span>
                </li>
              ))}
          </ul>

          {(recommendation.tradeOffs?.length ?? 0) > 0 || recommendation.tradeOff ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-900">Trade-offs</p>
              {recommendation.tradeOffs?.length ? (
                <ul className="mt-2 space-y-1.5 text-sm text-amber-900/90">
                  {recommendation.tradeOffs.map((f) => (
                    <li key={f.label}>
                      <span className="font-medium">{f.label}</span>
                      <span className="block text-xs">{f.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-amber-900/90">{recommendation.tradeOff}</p>
              )}
            </div>
          ) : null}

          {recommendation.missingInformation?.length ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-foreground">Missing information</p>
              <ul className="mt-1 list-inside list-disc text-xs text-muted">
                {recommendation.missingInformation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground">Assumptions</p>
            <ul className="mt-1 list-inside list-disc text-xs text-muted">
              {recommendation.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>

          <p className="mt-4 text-xs text-muted">
            Affiliate disclosure: Importnest may earn a commission when you buy through retailer
            links. This does not change ranking.
          </p>
        </div>

        <aside className="panel h-fit p-5">
          <p className="text-sm font-semibold text-foreground">Cost breakdown</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-price">{totalLabel}</p>
          <p className="text-xs text-muted">Total known cost</p>

          <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm text-muted">
            <div className="flex justify-between">
              <dt>Product price</dt>
              <dd>${listing.price.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Verified discount</dt>
              <dd>-${listing.verifiedDiscount.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd>
                {hasDisclosedShipping(listing.shipping) ? `$${listing.shipping.toFixed(2)}` : "Not provided"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Mandatory fees</dt>
              <dd>${listing.mandatoryFees.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
              <dt>Total</dt>
              <dd className="text-price">{totalLabel}</dd>
            </div>
          </dl>

          {listing.url ? (
            <a
              href={`/go/${listingId}`}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="btn-cta mt-5 block w-full px-4 py-2.5 text-center text-sm"
            >
              View offer
            </a>
          ) : null}
          <p className="mt-2 text-center text-xs text-muted">
            Checkout happens on the retailer&apos;s site. Importnest may earn a referral fee; this
            does not affect ranking.
          </p>
          <Link
            href={`/compare/${productId}`}
            className="mt-3 block text-center text-sm font-semibold text-link hover:underline"
          >
            Compare another offer
          </Link>
        </aside>
      </div>
    </PageShell>
  );
}
