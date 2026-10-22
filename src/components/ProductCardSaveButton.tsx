import Link from "next/link";
import { saveProductAction, unsaveProductAction } from "@/lib/saved-actions";

const ICON_BUTTON_CLASS =
  "flex h-auto min-h-9 min-w-[3.75rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-border bg-panel/95 px-1.5 py-1 text-[10px] font-semibold leading-tight shadow-sm transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Save (heart) toggle — adds the product to Saved & alerts. Price alerts live on
 * the separate bell (TrackPriceButton); this one only saves.
 * - tile: legacy labelled tile
 * - overlay: round icon on the product image (mobile cards)
 * - inline: labelled utility button beside the primary CTA (desktop cards)
 */
export function ProductCardSaveButton({
  productId,
  isSaved,
  signedIn,
  redirectTo,
  variant = "tile",
}: {
  productId: string;
  isSaved: boolean;
  signedIn: boolean;
  redirectTo: string;
  variant?: "tile" | "overlay" | "inline";
}) {
  const className =
    variant === "overlay"
      ? `card-overlay-btn ${isSaved ? "is-active" : ""}`
      : variant === "inline"
        ? `card-inline-action ${isSaved ? "is-active" : ""}`
        : `${ICON_BUTTON_CLASS} ${isSaved ? "text-accent" : "text-navy-900"}`;
  const showLabel = variant !== "overlay";

  if (signedIn) {
    return (
      <form
        action={
          isSaved
            ? unsaveProductAction.bind(null, productId, redirectTo)
            : saveProductAction.bind(null, productId, redirectTo)
        }
      >
        <button
          type="submit"
          className={className}
          aria-label={isSaved ? "Remove from saved" : "Save product"}
          aria-pressed={isSaved}
          title={isSaved ? "Saved" : "Save"}
        >
          <HeartIcon filled={isSaved} />
          {showLabel ? <span>{isSaved ? "Saved" : "Save"}</span> : null}
        </button>
      </form>
    );
  }

  return (
    <Link
      href={`/login?next=${encodeURIComponent(redirectTo)}`}
      className={className}
      aria-label="Sign in to save this product"
      title="Save"
    >
      <HeartIcon filled={false} />
      {showLabel ? <span>Save</span> : null}
    </Link>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 8.6c0 5.4-8.8 11.2-8.8 11.2S3.2 14 3.2 8.6A4.4 4.4 0 0 1 12 6.2a4.4 4.4 0 0 1 8.8 2.4z" />
    </svg>
  );
}
