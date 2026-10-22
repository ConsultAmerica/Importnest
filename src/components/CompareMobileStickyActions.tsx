"use client";

import Link from "next/link";
import { AddToCompareButton } from "@/components/AddToCompareButton";
import {
  saveProductAction,
  setPriceAlertAction,
  unsaveProductAction,
} from "@/lib/saved-actions";

/**
 * Sticky mobile action bar on the comparison page for Save / Alert / View offer.
 */
export function CompareMobileStickyActions({
  productId,
  productName,
  signedIn,
  isSaved,
  hasAlert,
  redirectTo,
  viewOfferHref,
  suggestedAlert,
}: {
  productId: string;
  productName: string;
  signedIn: boolean;
  isSaved: boolean;
  hasAlert: boolean;
  redirectTo: string;
  viewOfferHref: string | null;
  suggestedAlert: string;
}) {
  const loginHref = `/login?next=${encodeURIComponent(redirectTo)}`;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgb(15_42_74/0.08)] backdrop-blur-sm lg:hidden"
      role="region"
      aria-label="Product actions"
    >
      <div className="mx-auto flex max-w-[1200px] items-center gap-2">
        <AddToCompareButton productId={productId} productName={productName} />
        {signedIn ? (
          <form
            action={
              isSaved
                ? unsaveProductAction.bind(null, productId, redirectTo)
                : saveProductAction.bind(null, productId, redirectTo)
            }
            className="flex-1"
          >
            <button
              type="submit"
              className={`min-h-11 w-full rounded-full border px-3 py-2.5 text-sm font-semibold ${
                isSaved
                  ? "border-border bg-panel text-gray-700"
                  : "border-border text-navy-900"
              }`}
            >
              {isSaved ? "Saved" : "Save"}
            </button>
          </form>
        ) : (
          <Link
            href={loginHref}
            className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-border px-3 py-2.5 text-center text-sm font-semibold text-navy-900"
          >
            Save
          </Link>
        )}

        {signedIn ? (
          hasAlert ? (
            <Link
              href={`/saved#alerts`}
              className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-border px-3 py-2.5 text-center text-sm font-semibold text-navy-900"
            >
              Alert on
            </Link>
          ) : (
            <form
              action={setPriceAlertAction.bind(null, productId, redirectTo)}
              className="flex-1"
            >
              <input type="hidden" name="threshold" value={suggestedAlert || "1"} />
              <button
                type="submit"
                className="min-h-11 w-full rounded-full border border-border px-3 py-2.5 text-sm font-semibold text-navy-900"
              >
                Alert
              </button>
            </form>
          )
        ) : (
          <Link
            href={loginHref}
            className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-border px-3 py-2.5 text-center text-sm font-semibold text-navy-900"
          >
            Alert
          </Link>
        )}

        {viewOfferHref ? (
          <a
            href={viewOfferHref}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="btn-cta offer-handoff-cta min-h-11 flex-1 gap-1.5 px-3 py-2.5 text-center text-sm"
          >
            View offer
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6.5 3.5H3.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3M9.5 2.5h4v4M7 9l6.5-6.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        ) : null}
      </div>
    </div>
  );
}
