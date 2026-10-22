"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { quickPriceAlertAction } from "@/lib/saved-actions";

const QUICK_DROPS = [5, 10, 15] as const;

/** Keeps every bell for the same product in sync (card overlay + inline + other rails). */
const ALERT_SET_EVENT = "importnest:price-alert-set";

/** "Slightly below" the current best total, rounded down to whole dollars. */
function defaultTarget(current: number | null): string {
  if (current == null || current <= 1) return "";
  return String(Math.floor(current * 0.95));
}

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

/**
 * Bell on product cards → price-alert sheet (bottom sheet on phones, centred
 * dialog on desktop). Saves without leaving the page, so scroll position and
 * filters survive; the bell switches to its active state on success.
 */
export function TrackPriceButton({
  productId,
  productName,
  currentTotal,
  signedIn,
  redirectTo,
  initiallyTracking = false,
  variant = "inline",
}: {
  productId: string;
  productName: string;
  currentTotal: number | null;
  signedIn: boolean;
  redirectTo: string;
  initiallyTracking?: boolean;
  /** overlay = round icon on the product image (mobile); inline = labelled action row button. */
  variant?: "overlay" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState(initiallyTracking);
  const [target, setTarget] = useState(() => defaultTarget(currentTotal));
  const [error, setError] = useState<string | null>(null);
  const [savedTarget, setSavedTarget] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const inputId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setSavedTarget(null);
    setError(null);
  }, []);
  useFocusTrap(open, panelRef, close);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    function onAlertSet(e: Event) {
      if ((e as CustomEvent<string>).detail === productId) setTracking(true);
    }
    window.addEventListener(ALERT_SET_EVENT, onAlertSet);
    return () => window.removeEventListener(ALERT_SET_EVENT, onAlertSet);
  }, [productId]);

  // Success state shows briefly, then the sheet gets out of the way.
  useEffect(() => {
    if (savedTarget == null) return;
    const t = window.setTimeout(close, 2200);
    return () => window.clearTimeout(t);
  }, [savedTarget, close]);

  function submit() {
    const value = Number(target);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a target price above $0.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await quickPriceAlertAction(productId, value);
      if (result.ok) {
        setTracking(true);
        setSavedTarget(result.target);
        window.dispatchEvent(new CustomEvent(ALERT_SET_EVENT, { detail: productId }));
      } else {
        setError(
          result.reason === "auth"
            ? "Please sign in to set price alerts."
            : "That target price couldn’t be saved. Try a different amount.",
        );
      }
    });
  }

  const label = tracking ? "Tracking" : "Track";
  const ariaLabel = tracking
    ? `Price alert active for ${productName} — change target`
    : `Track price for ${productName}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        title={tracking ? "Price alert active" : "Track price"}
        className={`${variant === "overlay" ? "card-overlay-btn" : "card-inline-action"} ${tracking ? "is-active" : ""}`}
      >
        <BellIcon active={tracking} />
        {variant === "inline" ? <span>{label}</span> : null}
      </button>

      {open ? (
        <div className="track-sheet-root">
          <button
            type="button"
            className="results-sheet-backdrop"
            aria-label="Close price alert"
            tabIndex={-1}
            onClick={close}
          />
          <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="track-sheet">
            <span className="results-sheet-handle" aria-hidden="true" />
            {savedTarget != null ? (
              <div className="track-sheet-success" role="status">
                <span className="track-sheet-check" aria-hidden="true">
                  ✓
                </span>
                <p className="text-base font-bold text-navy-900">Alert set!</p>
                <p className="text-sm text-muted">
                  We’ll flag it in Saved &amp; alerts when the Total Known Cost drops to $
                  {savedTarget.toFixed(2)} or below.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Track price</p>
                    <h2 id={titleId} className="line-clamp-2 text-base font-bold text-navy-900">
                      {productName}
                    </h2>
                  </div>
                  <button type="button" onClick={close} className="results-sheet-close" aria-label="Close price alert">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>

                {currentTotal != null ? (
                  <p className="mt-3 text-sm text-muted">
                    Current best Total Known Cost{" "}
                    <span className="font-bold text-navy-900">${currentTotal.toFixed(2)}</span>
                  </p>
                ) : null}

                {signedIn ? (
                  <form
                    className="mt-4 space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submit();
                    }}
                  >
                    <label htmlFor={inputId} className="block text-sm font-semibold text-navy-900">
                      Alert me when it drops to
                    </label>
                    <div className="track-sheet-input">
                      <span aria-hidden="true">$</span>
                      <input
                        id={inputId}
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {currentTotal != null ? (
                      <div className="flex flex-wrap gap-2" aria-label="Quick targets">
                        {QUICK_DROPS.map((pct) => {
                          const value = String(Math.floor(currentTotal * (1 - pct / 100)));
                          return (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setTarget(value)}
                              aria-pressed={target === value}
                              className="track-sheet-chip"
                            >
                              −{pct}% · ${value}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    {error ? (
                      <p role="alert" className="text-sm text-red-700">
                        {error}
                      </p>
                    ) : null}
                    <button type="submit" className="btn-cta min-h-11 w-full px-4 py-2.5 text-sm" disabled={pending}>
                      {pending ? "Setting alert…" : "Set price alert"}
                    </button>
                    <p className="text-center text-xs text-muted">
                      Alerts watch real stored prices from approved retailers.
                    </p>
                  </form>
                ) : (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-muted">Sign in to get alerted when this price drops.</p>
                    <Link
                      href={`/login?next=${encodeURIComponent(redirectTo)}`}
                      className="btn-cta flex min-h-11 w-full items-center justify-center px-4 py-2.5 text-sm"
                    >
                      Sign in to track price
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
