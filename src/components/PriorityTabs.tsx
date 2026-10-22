"use client";

import Link from "next/link";
import {
  isStaleFreshness,
  NO_RECOMMENDATION_TEXT,
  type CompareRow,
  type RecommendationPanelModel,
} from "@/lib/compare-view";
import { Freshness } from "@/components/Freshness";
import { OfferCard } from "@/components/OfferCard";
import type { Priority } from "@/lib/types";
import { RefreshPricesButton } from "@/components/RefreshPricesButton";
import { StatusBanner, StatusPanel, PrimaryAction, SecondaryAction } from "@/components/StatusPanel";
import { formatFreshness, needsFreshnessWarning, freshnessWarningLabel } from "@/lib/freshness";

function RecommendationPanel({
  model,
  productId,
}: {
  model: RecommendationPanelModel;
  productId: string;
}) {
  return (
    <div className="rounded-2xl border border-accent/25 bg-section-soft p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-800">
            Why recommended
          </p>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-foreground">{model.label}</h3>
          <p className="mt-1 text-sm font-medium text-foreground">{model.retailerName}</p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/85">
            {model.rationale}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-muted">Total known cost</p>
          <p className="text-xl price-text">
            {model.shippingDisclosed
              ? `$${model.totalKnownCost.toFixed(2)}`
              : `from $${model.totalKnownCost.toFixed(2)}, shipping not disclosed`}
          </p>
          <div className="mt-1">
            <Freshness minutesAgo={model.lastCheckedMinutesAgo} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 border-t border-border/80 pt-4 md:grid-cols-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-navy-900">Positive factors</p>
          {model.positiveFactors.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm text-foreground/85">
              {model.positiveFactors.map((f) => (
                <li key={f.label}>
                  <span className="font-medium text-foreground">{f.label}</span>
                  <span className="block text-xs text-muted">{f.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No positive ranking factors for this priority.</p>
          )}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-navy-900">Trade-off</p>
          <p className="mt-2 text-sm text-foreground/85">
            {model.tradeOffLine ?? "No material trade-off versus the cheapest compared offer."}
          </p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-navy-900">
            Missing information
          </p>
          {model.missingInformation.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
              {model.missingInformation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No notable data gaps on this offer.</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-3">
        <p className="max-w-2xl text-xs text-muted">
          Affiliate disclosure: Importnest may earn a commission when you buy through retailer
          links. This does not change ranking or which offer is recommended.
        </p>
        <Link
          href={`/compare/${productId}/why/${model.listingId}`}
          className="text-sm font-semibold text-link hover:underline"
        >
          Full explanation
        </Link>
      </div>
    </div>
  );
}

export function PriorityTabs({
  productId,
  productName,
  brandName,
  productImageSrc,
  rows,
  priority,
  priorityOptions,
  panel,
  signedIn = false,
  isSaved = false,
  redirectTo,
}: {
  productId: string;
  productName: string;
  brandName: string;
  productImageSrc: string;
  /** Already ranked server-side for `priority` — this component never re-sorts. */
  rows: CompareRow[];
  priority: Priority;
  /** Tabs to render — server-filtered, with a navigable href per option. */
  priorityOptions: { key: Priority; label: string; href: string }[];
  /** Precomputed server-side from the same sorted `rows`; null means nothing to rank or a genuine tie. */
  panel: RecommendationPanelModel | null;
  signedIn?: boolean;
  isSaved?: boolean;
  redirectTo?: string;
}) {
  const topId = panel ? rows[0]?.listing.id : undefined;
  const recommendationLabel = panel?.label ?? "";
  const anyStale = rows.some((r) => isStaleFreshness(r.listing.freshnessMinutesAgo));
  const anyWarn = rows.some((r) => needsFreshnessWarning(r.listing.freshnessMinutesAgo));
  const knownAges = rows
    .map((r) => r.listing.freshnessMinutesAgo)
    .filter((v): v is number => v != null);
  const oldestMinutes = knownAges.length > 0 ? Math.max(...knownAges) : null;
  const sourceCount = new Set(rows.map((r) => r.listing.sourceId)).size;
  const saveRedirect = redirectTo ?? `/compare/${productId}`;

  if (rows.length === 0) {
    return (
      <StatusPanel
        tone="warn"
        title="Source temporarily unavailable"
        description="No approved buying options are available for this product right now. Retailer feeds may be refreshing — try again shortly."
        actions={
          <>
            <PrimaryAction href={`/compare/${productId}`}>Refresh comparison</PrimaryAction>
            <SecondaryAction href="/search">Search again</SecondaryAction>
          </>
        }
      />
    );
  }

  return (
    <div>
      {anyWarn ? (
        <StatusBanner
          tone="info"
          title={formatFreshness(oldestMinutes)}
          description={`${freshnessWarningLabel(oldestMinutes)}. Totals still reflect the last sync — refresh for the latest item, shipping, and fee figures before you buy.`}
          action={<RefreshPricesButton productId={productId} />}
        />
      ) : null}

      {panel ? (
        <div className={anyWarn || anyStale ? "mt-4" : ""}>
          <RecommendationPanel model={panel} productId={productId} />
        </div>
      ) : (
        <div className={anyWarn || anyStale ? "mt-4" : ""}>
          <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">
            {NO_RECOMMENDATION_TEXT}
          </p>
        </div>
      )}

      {/* Sticky sort — horizontal chips on mobile (thumb-friendly), pill tablist on desktop. */}
      <div className="priority-sort-sticky mt-4 border-y border-border bg-panel/95 py-2.5 backdrop-blur-sm sm:py-3">
        <span className="hidden text-sm font-semibold text-foreground sm:mr-3 sm:inline">
          Sort by
        </span>
        <div
          role="tablist"
          aria-label="Sort priority"
          className="priority-sort-chips flex gap-2 overflow-x-auto pb-1 sm:mt-2 sm:inline-flex sm:flex-wrap sm:overflow-visible sm:rounded-full sm:border sm:border-border sm:bg-surface sm:p-1 sm:pb-1"
        >
          {priorityOptions.map((option) => (
            <Link
              key={option.key}
              href={option.href}
              role="tab"
              aria-selected={priority === option.key}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition sm:py-1.5 ${
                priority === option.key
                  ? "bg-cta text-navy-900 shadow-sm"
                  : "border border-border bg-surface text-navy-900 hover:border-navy-800 sm:border-0 sm:bg-transparent sm:text-muted sm:hover:bg-panel sm:hover:text-foreground"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-muted">
        {rows.length} {rows.length === 1 ? "offer" : "offers"} from {sourceCount}{" "}
        {sourceCount === 1 ? "source" : "sources"}
      </p>

      <ul className="mt-3 space-y-3 pb-28 lg:pb-0">
        {rows.map((row) => (
          <OfferCard
            key={row.listing.id}
            productId={productId}
            productName={productName}
            brandName={brandName}
            productImageSrc={productImageSrc}
            row={row}
            isTop={row.listing.id === topId}
            recommendationLabel={recommendationLabel}
            signedIn={signedIn}
            isSaved={isSaved}
            redirectTo={saveRedirect}
          />
        ))}
      </ul>

      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
        Sponsored offers are shown separately and do not influence organic ranking. Checkout happens
        on the retailer&apos;s site.
      </p>
    </div>
  );
}
