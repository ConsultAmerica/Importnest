"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { hasDisclosedShipping } from "@/lib/compare-view";
import { sourceImageFor } from "@/lib/images";

export type TkcOfferLine = {
  sourceName: string;
  sourceId?: string;
  /** When present, the row can hand off to this exact offer via /go/{listingId}. */
  listingId?: string;
  pickup?: boolean;
  total: number;
  price: number;
  shipping: number | null;
  fees: number;
};

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

/**
 * Opens a short retailer-by-retailer Total Known Cost breakdown.
 * Every line is a stored approved listing — missing shipping stays labeled.
 */
export function TkcRetailerDialog({
  lines,
  offerCount,
}: {
  lines: TkcOfferLine[];
  /** Live offer count when this dialog only has the lowest line. */
  offerCount?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const sorted = [...lines].sort((a, b) => a.total - b.total);
  const low = sorted[0];
  const high = sorted[sorted.length - 1];

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (sorted.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="product-card-tkc-info"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="sr-only">Which retailers make up this Total Known Cost</span>
        <span aria-hidden="true">ⓘ</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-navy-900/40"
            aria-label="Close price breakdown"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-md rounded-2xl border border-border bg-panel p-4 shadow-[var(--shadow-panel)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={titleId} className="text-base font-bold text-navy-900">
                  Total Known Cost by retailer
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {sorted.length > 1
                    ? `${money(low.total)}–${money(high.total)} across ${sorted.length} approved retailers. The card shows the lowest.`
                    : offerCount != null && offerCount > 1
                      ? `${low.sourceName} has the lowest Total Known Cost on this card. View offers lists every retailer.`
                      : `${low.sourceName} is the approved offer in this total.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-border px-3 py-1 text-sm font-semibold"
              >
                Close
              </button>
            </div>
            <ul className="mt-4 space-y-3">
              {sorted.map((line) => {
                const disclosed = hasDisclosedShipping(line.shipping);
                return (
                  <li key={line.sourceName} className="rounded-xl border border-border px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {line.sourceId ? (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border">
                            <Image
                              src={sourceImageFor(line.sourceId)}
                              alt=""
                              width={28}
                              height={28}
                              className="h-7 w-7 object-contain"
                            />
                          </span>
                        ) : null}
                        <p className="truncate font-semibold text-navy-900">{line.sourceName}</p>
                      </div>
                      <p className="shrink-0 font-extrabold tabular-nums text-navy-900">
                        {money(line.total)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {money(line.price)} item
                      {disclosed && line.shipping != null
                        ? ` + ${money(line.shipping)} shipping`
                        : " + shipping not disclosed"}
                      {line.fees > 0.009 ? ` + ${money(line.fees)} fees` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Checkout still happens on the retailer&apos;s site. Tax is not added here unless a
              listing already includes it in fees.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
