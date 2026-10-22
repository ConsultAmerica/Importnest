"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { AddToCompareButton } from "@/components/AddToCompareButton";
import { Freshness } from "@/components/Freshness";
import { PriceSparkline } from "@/components/PriceSparkline";
import { productImageFor, productThumbClass } from "@/lib/images";
import { formatPriceChange, type PriceChangeTone } from "@/lib/price-change";
import {
  formatAlertThresholdLabel,
  removeAlertConfirmMessage,
  removeProductConfirmMessage,
  type WatchlistItem,
} from "@/lib/saved-data";
import {
  deleteWatchlistItemAction,
  removeAlertAction,
  setPriceAlertAction,
  toggleAlertActiveAction,
} from "@/lib/saved-actions";

const CHANGE_TONE_CLASS: Record<PriceChangeTone, string> = {
  down: "text-emerald-800",
  up: "text-amber-900",
  none: "text-muted",
};

/** Native confirm before a destructive form submission; cancels the submit when the shopper backs out. */
function confirmBeforeSubmit(message: string) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(message)) event.preventDefault();
  };
}

const statusStyle: Record<string, string> = {
  watching: "bg-accent/15 text-accent",
  triggered: "bg-cta/15 text-cta",
  paused: "bg-surface text-muted ring-1 ring-border",
  none: "bg-surface text-muted ring-1 ring-border",
};

const statusLabel: Record<string, string> = {
  watching: "Watching",
  triggered: "Price drop",
  paused: "Paused",
  none: "No alert",
};

const NON_PRICE_ALERT_LABEL: Record<string, string> = {
  "back-in-stock": "Back in stock alert",
  "any-change": "Any price change alert",
};

export function WatchlistProductCard({ item }: { item: WatchlistItem }) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"dollar" | "percent">(
    item.percentDrop != null ? "percent" : "dollar",
  );
  const redirectTo = "/saved";
  const change = formatPriceChange(item.priceChange);
  const alertType = item.alertType ?? "price-drop";
  const isPriceDropAlert = alertType === "price-drop";
  const imageSrc = productImageFor(item.canonicalProductId);
  const defaultThreshold =
    item.targetPrice != null && item.percentDrop == null
      ? item.targetPrice.toFixed(2)
      : item.currentPrice != null
        ? Math.max(1, Math.floor(item.currentPrice * 0.95)).toFixed(2)
        : "";
  const defaultPercent = item.percentDrop != null ? String(item.percentDrop) : "10";
  const targetLabel = formatAlertThresholdLabel(item.threshold);

  return (
    <article className="panel offer-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">
        <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
          <Link
            href={`/compare/${item.canonicalProductId}`}
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-white sm:h-24 sm:w-24"
          >
            <Image
              src={imageSrc}
              alt={item.productName}
              fill
              className={productThumbClass(imageSrc)}
              sizes="96px"
            />
          </Link>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {item.brandName}
                </p>
                <Link
                  href={`/compare/${item.canonicalProductId}`}
                  className="mt-0.5 block text-base font-bold leading-snug text-navy-900 hover:text-link"
                >
                  {item.productName}
                </Link>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[item.status]}`}
              >
                {statusLabel[item.status]}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Current
                </p>
                <p className="mt-0.5 text-lg font-extrabold tabular-nums text-navy-900">
                  {item.currentPrice != null
                    ? `$${item.currentPrice.toFixed(2)}`
                    : "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Target
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-navy-900">
                  {targetLabel ?? "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Alert status
                </p>
                <p className="mt-0.5 text-sm font-semibold text-navy-900">
                  {item.status === "watching" || item.status === "triggered"
                    ? item.status === "triggered"
                      ? "Triggered"
                      : "Active"
                    : statusLabel[item.status]}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Offers
                </p>
                <p className="mt-0.5 text-sm font-semibold text-navy-900">
                  {item.offerCount > 0
                    ? `${item.offerCount} ${item.offerCount === 1 ? "offer" : "offers"}`
                    : "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Sources
                </p>
                <p className="mt-0.5 text-sm font-semibold text-navy-900">
                  {item.sourceCoverage > 0
                    ? `${item.sourceCoverage} ${item.sourceCoverage === 1 ? "source" : "sources"}`
                    : "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Price change
                </p>
                <p
                  className={`mt-0.5 text-sm font-semibold tabular-nums ${
                    change ? CHANGE_TONE_CLASS[change.tone] : "text-muted"
                  }`}
                >
                  {change?.text ?? "Not provided"}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Last checked
                </p>
                <p className="mt-0.5 text-sm font-medium text-navy-900">
                  <Freshness minutesAgo={item.lastCheckedMinutesAgo} />
                </p>
              </div>
              {item.priceHistory.length >= 2 ? (
                <div className="col-span-2 flex items-end sm:col-span-2 lg:justify-end">
                  <PriceSparkline points={item.priceHistory} />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col justify-between gap-3 border-t border-border pt-3 lg:w-44 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Link
                href={`/compare/${item.canonicalProductId}`}
                className="btn-cta flex-1 px-3 py-2 text-center text-sm"
              >
                View comparison
              </Link>
              <AddToCompareButton productId={item.canonicalProductId} productName={item.productName} />
            </div>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              aria-expanded={editing}
              aria-controls={`alert-edit-${item.canonicalProductId}`}
              className="rounded-full border border-border bg-panel px-3 py-2 text-sm font-semibold text-navy-900 hover:border-navy-800"
            >
              {editing ? "Close" : "Edit alert"}
            </button>
            {item.alertId && item.alertType ? (
              <form
                action={toggleAlertActiveAction.bind(
                  null,
                  item.canonicalProductId,
                  item.alertType,
                  redirectTo,
                )}
              >
                <button
                  type="submit"
                  className="w-full rounded-full border border-border bg-panel px-3 py-2 text-sm font-semibold text-navy-900 hover:border-navy-800"
                >
                  {item.status === "paused" ? "Resume" : "Pause"}
                </button>
              </form>
            ) : null}
            <form action={deleteWatchlistItemAction.bind(null, item.canonicalProductId, redirectTo)}>
              <button
                type="submit"
                onClick={confirmBeforeSubmit(removeProductConfirmMessage(item.productName))}
                className="w-full rounded-full border border-border px-3 py-2 text-sm font-semibold text-muted hover:border-red-300 hover:text-red-700"
              >
                Remove
              </button>
            </form>
          </div>
        </div>
      </div>

      {editing ? (
        <div
          id={`alert-edit-${item.canonicalProductId}`}
          className="mt-4 rounded-2xl border border-border bg-surface px-4 py-3"
        >
          {isPriceDropAlert ? (
            <>
              <p className="text-sm font-semibold text-navy-900">Edit price alert</p>
              <p className="mt-0.5 text-xs text-muted">
                Notify when the best known total cost hits your dollar target — or drops by a
                percentage from today&apos;s price.
              </p>
              <div
                className="mt-3 inline-flex rounded-full border border-border bg-panel p-0.5"
                role="group"
                aria-label="Alert threshold type"
              >
                <button
                  type="button"
                  onClick={() => setMode("dollar")}
                  aria-pressed={mode === "dollar"}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    mode === "dollar"
                      ? "bg-cta text-navy-900"
                      : "text-navy-900 hover:bg-surface"
                  }`}
                >
                  Dollar amount
                </button>
                <button
                  type="button"
                  onClick={() => setMode("percent")}
                  aria-pressed={mode === "percent"}
                  disabled={item.currentPrice == null}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                    mode === "percent"
                      ? "bg-cta text-navy-900"
                      : "text-navy-900 hover:bg-surface"
                  }`}
                >
                  % drop
                </button>
              </div>
              <form
                action={setPriceAlertAction.bind(null, item.canonicalProductId, redirectTo)}
                className="mt-3 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="mode" value={mode} />
                {mode === "percent" ? (
                  <>
                    <input
                      type="hidden"
                      name="baseline"
                      value={item.currentPrice != null ? item.currentPrice.toFixed(2) : ""}
                    />
                    <div>
                      <label htmlFor={`percent-${item.canonicalProductId}`} className="sr-only">
                        Percent drop
                      </label>
                      <div className="flex items-center rounded-md border border-border bg-white">
                        <input
                          id={`percent-${item.canonicalProductId}`}
                          name="percent"
                          type="number"
                          min="1"
                          max="99"
                          step="1"
                          required
                          defaultValue={defaultPercent}
                          className="w-20 bg-transparent px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                        />
                        <span className="pr-3 text-sm text-muted">%</span>
                      </div>
                      {item.currentPrice != null ? (
                        <p className="mt-1 text-[11px] text-muted">
                          From today&apos;s ${item.currentPrice.toFixed(2)}
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div>
                    <label htmlFor={`threshold-${item.canonicalProductId}`} className="sr-only">
                      Target price
                    </label>
                    <div className="flex items-center rounded-md border border-border bg-white">
                      <span className="pl-3 text-sm text-muted">$</span>
                      <input
                        id={`threshold-${item.canonicalProductId}`}
                        name="threshold"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        defaultValue={defaultThreshold}
                        className="w-28 bg-transparent px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>
                )}
                <button type="submit" className="btn-cta px-4 py-2 text-sm">
                  Save alert
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-navy-900">
                {NON_PRICE_ALERT_LABEL[alertType] ?? "Alert"}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                This alert has no numeric target — pause or remove it below.
              </p>
            </>
          )}
          {item.alertId && item.alertType ? (
            <form
              action={removeAlertAction.bind(null, item.canonicalProductId, alertType, redirectTo)}
              className="mt-2"
            >
              <button
                type="submit"
                onClick={confirmBeforeSubmit(removeAlertConfirmMessage(item.productName))}
                className="rounded-full border border-border bg-panel px-3 py-2 text-sm font-semibold text-muted hover:border-navy-800"
              >
                Remove alert
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
