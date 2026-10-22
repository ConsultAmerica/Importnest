import { formatPriceChange } from "@/lib/price-change";

/** Only records from within this many days of "now" count toward the chart or stats. */
export const PRICE_HISTORY_WINDOW_DAYS = 30;

export type PriceHistoryRawPoint = {
  price: number;
  shipping: number | null;
  capturedAt: Date;
};

export type ProductPriceHistoryPoint = {
  day: string;
  total: number;
};

export type ProductPriceHistorySummary = {
  /** Present only when at least two valid, in-window daily points exist. */
  points: ProductPriceHistoryPoint[];
  currentLowest: number | null;
  /** Lowest total recorded on the day before the most recent one. */
  previousLowest: number | null;
  /** Lowest total recorded within the last 30 days. */
  thirtyDayLow: number | null;
  lastChange: number | null;
  lastChangeAt: string | null;
};

export function emptyPriceHistory(currentLowest: number | null): ProductPriceHistorySummary {
  return {
    points: [],
    currentLowest,
    previousLowest: null,
    thirtyDayLow: null,
    lastChange: null,
    lastChangeAt: null,
  };
}

/**
 * Pure summarizer — no DB access — so every case (no history, a single
 * record, several records, a stale record outside the window, a price
 * increase, a price decrease) is unit-testable without a database.
 *
 * Only real records count: anything with a non-finite or negative
 * price/shipping, or captured outside the last `PRICE_HISTORY_WINDOW_DAYS`
 * days, is excluded rather than repaired. Days are bucketed to their real
 * lowest total; no gap is ever filled in or interpolated. Fewer than two
 * valid in-window daily points means there isn't a trend to show yet.
 */
export function summarizePriceHistory(
  rows: PriceHistoryRawPoint[],
  currentLowest: number | null,
  now: Date = new Date(),
): ProductPriceHistorySummary {
  const windowStart = new Date(now.getTime() - PRICE_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const valid = rows.filter(
    (r) =>
      Number.isFinite(r.price) &&
      r.price >= 0 &&
      r.shipping != null &&
      Number.isFinite(r.shipping) &&
      r.shipping >= 0 &&
      r.capturedAt >= windowStart &&
      r.capturedAt <= now,
  );

  const byDay = new Map<string, number>();
  for (const row of valid) {
    if (row.shipping == null) continue;
    const day = row.capturedAt.toISOString().slice(0, 10);
    const total = row.price + row.shipping;
    const existing = byDay.get(day);
    if (existing == null || total < existing) byDay.set(day, total);
  }

  const points = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, total]) => ({ day, total }));

  if (points.length < 2) {
    return emptyPriceHistory(currentLowest);
  }

  const latest = points[points.length - 1]!;
  const previous = points[points.length - 2]!;
  const thirtyDayLow = Math.min(...points.map((p) => p.total));
  const effectiveCurrent = currentLowest ?? latest.total;

  return {
    points,
    currentLowest: effectiveCurrent,
    previousLowest: previous.total,
    thirtyDayLow,
    lastChange: effectiveCurrent - previous.total,
    lastChangeAt: latest.day,
  };
}

/**
 * Plain-language narrative of the summary for screen readers — the chart
 * itself only carries an aria-label with the endpoints, so this fills in the
 * current/previous/30-day-low/change figures the visual stat tiles show.
 */
export function describePriceHistoryForScreenReaders(summary: ProductPriceHistorySummary): string {
  const parts: string[] = [];
  if (summary.currentLowest != null) {
    parts.push(`current lowest price $${summary.currentLowest.toFixed(2)}`);
  }
  if (summary.previousLowest != null) {
    parts.push(`previous lowest price $${summary.previousLowest.toFixed(2)}`);
  }
  if (summary.thirtyDayLow != null) {
    parts.push(`30-day low $${summary.thirtyDayLow.toFixed(2)}`);
  }
  const change = formatPriceChange(summary.lastChange);
  if (change) {
    parts.push(`last price change: ${change.text.toLowerCase()}${summary.lastChangeAt ? ` on ${summary.lastChangeAt}` : ""}`);
  }
  if (parts.length === 0) return "Price history summary unavailable.";
  return `Price history summary: ${parts.join(", ")}.`;
}
