"use client";

import type { MouseEvent } from "react";
import { useCart } from "@/components/CartProvider";
import type { NewCartItem } from "@/lib/cart-storage";

export function CartIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <path d="M2.5 3h2.4l1.9 11.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.96-1.6L21 7.5H6.2" />
    </svg>
  );
}

export type AddToCartButtonProps = NewCartItem & {
  /** Icon-only circular style to sit alongside AddToCompareButton in card corners/footers. */
  compact?: boolean;
  /** Override the visible label on the non-compact button. Defaults to "Save offer for later". */
  label?: string;
  /** Override the visible "in cart" label, e.g. "Saved for later" (default). */
  addedLabel?: string;
  /**
   * Override the accessible name for the "add" state. Required when multiple
   * buttons for the same product/title appear on one page (e.g. one per
   * retailer offer on the compare page) — otherwise every button announces
   * the identical "Add {title} to cart" name and a screen-reader user can't
   * tell them apart. Defaults to `Add {title} to cart`.
   */
  addAriaLabel?: string;
  /** Same disambiguation, for the "remove" state. Defaults to `Remove {title} from cart`. */
  removeAriaLabel?: string;
  /** Fired after a successful add (not on remove) — lets a parent (e.g. OfferActions) observe the action without re-implementing cart logic. */
  onAdded?: () => void;
};

/**
 * Add/remove-from-cart toggle. Every field required to build a cart line
 * (price, shipping, fees, source, condition, ...) must come from the caller's
 * already-rendered real listing/product data — this component never fetches
 * or fabricates any of it.
 */
export function AddToCartButton({
  compact = false,
  label = "Save offer for later",
  addedLabel = "Saved for later",
  addAriaLabel,
  removeAriaLabel,
  onAdded,
  ...item
}: AddToCartButtonProps) {
  const { isInCart, add, remove, isFull } = useCart();
  const inCart = isInCart(item.listingId, item.productId);
  // The cart is full only from the perspective of adding a *new* line — an
  // already-in-cart item's button must stay clickable so it can still be removed.
  const limitReached = isFull && !inCart;

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // Cards may nest links; keep the cart action from navigating away.
    event.preventDefault();
    event.stopPropagation();
    if (inCart) {
      remove(item.listingId, item.productId);
      return;
    }
    if (limitReached) return;
    add(item);
    onAdded?.();
  }

  const ariaLabel = inCart
    ? (removeAriaLabel ?? `Remove ${item.title} from cart`)
    : limitReached
      ? "Cart is full — remove an item to add this one"
      : (addAriaLabel ?? `Add ${item.title} to cart`);

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel}
        aria-pressed={inCart}
        disabled={limitReached}
        className={`flex h-auto min-h-9 min-w-9 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-border bg-panel/95 px-1.5 py-1 text-[10px] font-semibold leading-none shadow-sm transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:hover:border-border ${
          inCart ? "text-accent" : limitReached ? "text-muted" : "text-navy-900"
        }`}
      >
        <CartIcon />
        {/* "Save" now belongs to the heart (Saved & alerts); this is the compare cart. */}
        <span>{inCart ? "In cart" : "Cart"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-pressed={inCart}
      disabled={limitReached}
      className={
        inCart
          ? "flex min-h-11 items-center gap-1.5 rounded-full border border-accent/60 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/15"
          : limitReached
            ? "flex min-h-11 cursor-not-allowed items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted"
            : "btn-cta flex min-h-11 items-center gap-1.5 px-4 py-2 text-sm"
      }
    >
      <CartIcon />
      {inCart ? addedLabel : limitReached ? "Limit reached" : label}
    </button>
  );
}
