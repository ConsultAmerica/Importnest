import { prisma } from "@/lib/prisma";
import { minutesSince, knownOfferTotal } from "@/lib/compare-view";
import { getCompareRows, totalKnownCost } from "@/lib/compare-data";

export type AlertType = "price-drop" | "back-in-stock" | "any-change";
export type AlertStatus = "watching" | "triggered" | "paused" | "none";

/**
 * Structured form of Alert.threshold. Dollar alerts store a plain number
 * ("199.99" or legacy "≤ $250"). Percentage-drop alerts store
 * "pct:<percent>@<baseline>" where baseline is the Total Known Cost at the
 * moment the shopper set the alert — the absolute trigger target is then
 * baseline × (1 − percent/100). Encoding both in the free-text column
 * avoids a schema migration and stays compatible with existing alerts.
 */
export type ParsedAlertThreshold =
  | { kind: "dollar"; amount: number }
  | { kind: "percent"; percent: number; baseline: number; target: number };

const PCT_THRESHOLD_RE = /^pct:(\d+(?:\.\d+)?)@(\d+(?:\.\d+)?)$/i;

export function encodeDollarThreshold(amount: number): string {
  return String(amount);
}

export function encodePercentThreshold(percent: number, baseline: number): string {
  return `pct:${percent}@${baseline}`;
}

export function parseAlertThreshold(threshold: string | null): ParsedAlertThreshold | null {
  if (!threshold) return null;
  const trimmed = threshold.trim();
  const pctMatch = trimmed.match(PCT_THRESHOLD_RE);
  if (pctMatch) {
    const percent = Number(pctMatch[1]);
    const baseline = Number(pctMatch[2]);
    if (
      !Number.isFinite(percent) ||
      percent <= 0 ||
      percent >= 100 ||
      !Number.isFinite(baseline) ||
      baseline <= 0
    ) {
      return null;
    }
    const target = Math.round(baseline * (1 - percent / 100) * 100) / 100;
    return { kind: "percent", percent, baseline, target };
  }

  // Dollar (or legacy "≤ $250") — extract the first number.
  const match = trimmed.match(/[\d.]+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) && value > 0 ? { kind: "dollar", amount: value } : null;
}

/**
 * Absolute trigger price for any threshold encoding. Used by the watchlist
 * UI ("Target $X") and by the trigger rule. For percent alerts this is the
 * computed baseline × (1 − pct/100); for dollar alerts it is the amount.
 */
export function parseThresholdPrice(threshold: string | null): number | null {
  const parsed = parseAlertThreshold(threshold);
  if (!parsed) return null;
  return parsed.kind === "dollar" ? parsed.amount : parsed.target;
}

/** Pure so the trigger rule itself is unit-testable without a DB round trip. */
export function isPriceDropTriggered(threshold: string | null, currentPrice: number | null): boolean {
  const target = parseThresholdPrice(threshold);
  if (target == null || currentPrice == null) return false;
  return currentPrice <= target;
}

/** Short human label for an alert threshold, e.g. "$199.99" or "15% off ($169.99)". */
export function formatAlertThresholdLabel(threshold: string | null): string | null {
  const parsed = parseAlertThreshold(threshold);
  if (!parsed) return null;
  if (parsed.kind === "dollar") return `$${parsed.amount.toFixed(2)}`;
  return `${parsed.percent}% off (≤ $${parsed.target.toFixed(2)})`;
}

/** Confirmation copy shown before removing a saved product (and its alert) — a destructive, hard-to-undo action. */
export function removeProductConfirmMessage(productName: string): string {
  return `Remove ${productName} from your saved products? This also removes any price alert on it.`;
}

/** Confirmation copy shown before removing a price alert — destructive on its own even when the product stays saved. */
export function removeAlertConfirmMessage(productName: string): string {
  return `Remove your price alert for ${productName}?`;
}

/** Lowest total known cost currently listed for a product, or null if nothing is listed. */
export async function getBestCurrentPrice(canonicalProductId: string): Promise<number | null> {
  const rows = await getCompareRows(canonicalProductId);
  if (rows.length === 0) return null;
  return Math.min(...rows.map((r) => totalKnownCost(r.listing)));
}

export type SaveAndAlertState = {
  isSaved: boolean;
  alert: { threshold: string | null; isActive: boolean } | null;
};

/** Used by the compare page to render Save/alert controls for the current viewer, if any. */
export async function getSaveAndAlertState(
  userId: string,
  canonicalProductId: string,
): Promise<SaveAndAlertState> {
  const [saved, alert] = await Promise.all([
    prisma.savedProduct.findUnique({
      where: { userId_canonicalProductId: { userId, canonicalProductId } },
    }),
    prisma.alert.findUnique({
      where: { userId_canonicalProductId_type: { userId, canonicalProductId, type: "price-drop" } },
    }),
  ]);

  return {
    isSaved: saved != null,
    alert: alert ? { threshold: alert.threshold, isActive: alert.isActive } : null,
  };
}

export type PriceHistoryPoint = {
  /** ISO date (YYYY-MM-DD) for the bucket */
  day: string;
  total: number;
};

export type WatchlistItem = {
  savedProductId: string | null;
  alertId: string | null;
  canonicalProductId: string;
  brandName: string;
  productName: string;
  categorySlug: string;
  currentPrice: number | null;
  /** Absolute trigger target (dollar amount or computed percent target) */
  targetPrice: number | null;
  /** When the alert is a %-drop, the percent the shopper chose; null for dollar alerts. */
  percentDrop: number | null;
  threshold: string | null;
  alertType: AlertType | null;
  status: AlertStatus;
  /** Distinct approved sources currently listing this product */
  sourceCoverage: number;
  /** Number of approved listings (offers) currently available for this product */
  offerCount: number;
  /** Current best − previous history best; null when no real prior point */
  priceChange: number | null;
  lastCheckedMinutesAgo: number | null;
  /**
   * Daily min total-known-cost points from PriceHistory.
   * Empty unless at least two real history points exist.
   */
  priceHistory: PriceHistoryPoint[];
};

function bucketDailyMin(
  rows: { price: number; shipping: number | null; capturedAt: Date }[],
): PriceHistoryPoint[] {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    if (row.shipping == null || !Number.isFinite(row.shipping) || row.shipping < 0) continue;
    const day = row.capturedAt.toISOString().slice(0, 10);
    const total = row.price + row.shipping;
    const existing = byDay.get(day);
    if (existing == null || total < existing) byDay.set(day, total);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, total]) => ({ day, total }));
}

/**
 * Merges SavedProduct and Alert rows into one per-product view — a shopper
 * can save a product without an alert, or (today) have at most one alert per
 * type per product (see the Alert @@unique constraint). Status is computed
 * live against current listing prices rather than persisted, so it can never
 * go stale between syncs.
 */
export async function getUserWatchlist(userId: string): Promise<WatchlistItem[]> {
  const [savedProducts, alerts] = await Promise.all([
    prisma.savedProduct.findMany({
      where: { userId },
      include: { canonicalProduct: { include: { brand: true, category: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.alert.findMany({
      where: { userId },
      include: { canonicalProduct: { include: { brand: true, category: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const productIds = [
    ...new Set([
      ...savedProducts.map((s) => s.canonicalProductId),
      ...alerts.map((a) => a.canonicalProductId),
    ]),
  ];
  if (productIds.length === 0) return [];

  const listings = await prisma.listing.findMany({
    where: {
      canonicalProductId: { in: productIds },
      matches: { some: { status: "approved" } },
    },
    select: {
      id: true,
      canonicalProductId: true,
      sourceId: true,
      price: true,
      shipping: true,
      fees: true,
      freshnessCapturedAt: true,
    },
  });

  const listingIds = listings.map((l) => l.id);
  const historyRows =
    listingIds.length === 0
      ? []
      : await prisma.priceHistory.findMany({
          where: { listingId: { in: listingIds } },
          select: {
            listingId: true,
            price: true,
            shipping: true,
            capturedAt: true,
          },
          orderBy: { capturedAt: "asc" },
        });

  const listingProduct = new Map(listings.map((l) => [l.id, l.canonicalProductId!]));

  const items: WatchlistItem[] = [];
  for (const productId of productIds) {
    const saved = savedProducts.find((s) => s.canonicalProductId === productId);
    const alert = alerts.find((a) => a.canonicalProductId === productId);
    const canonicalProduct = saved?.canonicalProduct ?? alert?.canonicalProduct;
    if (!canonicalProduct) continue;

    const productListings = listings.filter((l) => l.canonicalProductId === productId);
    const currentPrice =
      productListings.length === 0
        ? null
        : Math.min(...productListings.map((l) => knownOfferTotal(l.price, l.shipping, l.fees)));

    const sourceCoverage = new Set(productListings.map((l) => l.sourceId)).size;
    const offerCount = productListings.length;

    const freshest = productListings.reduce<Date | null>((best, l) => {
      if (!best || l.freshnessCapturedAt > best) return l.freshnessCapturedAt;
      return best;
    }, null);

    const productHistoryRaw = historyRows.filter(
      (h) => listingProduct.get(h.listingId) === productId,
    );
    const daily = bucketDailyMin(productHistoryRaw);
    const priceHistory = daily.length >= 2 ? daily : [];

    let priceChange: number | null = null;
    if (currentPrice != null && daily.length >= 2) {
      priceChange = currentPrice - daily[daily.length - 2]!.total;
    } else if (daily.length >= 2) {
      priceChange = daily[daily.length - 1]!.total - daily[daily.length - 2]!.total;
    }

    let status: AlertStatus = "none";
    if (alert) {
      if (!alert.isActive) {
        status = "paused";
      } else if (alert.type === "price-drop" && isPriceDropTriggered(alert.threshold, currentPrice)) {
        status = "triggered";
      } else {
        status = "watching";
      }
    }

    const parsedThreshold = parseAlertThreshold(alert?.threshold ?? null);

    items.push({
      savedProductId: saved?.id ?? null,
      alertId: alert?.id ?? null,
      canonicalProductId: productId,
      brandName: canonicalProduct.brand.name,
      productName: canonicalProduct.modelName,
      categorySlug: canonicalProduct.category.slug,
      currentPrice,
      targetPrice:
        parsedThreshold == null
          ? null
          : parsedThreshold.kind === "dollar"
            ? parsedThreshold.amount
            : parsedThreshold.target,
      percentDrop: parsedThreshold?.kind === "percent" ? parsedThreshold.percent : null,
      threshold: alert?.threshold ?? null,
      alertType: (alert?.type as AlertType | undefined) ?? null,
      status,
      sourceCoverage,
      offerCount,
      priceChange,
      lastCheckedMinutesAgo: freshest ? minutesSince(freshest) : null,
      priceHistory,
    });
  }

  // Preserve save-order preference: saved first by createdAt, then alert-only
  const savedOrder = new Map(savedProducts.map((s, i) => [s.canonicalProductId, i]));
  items.sort((a, b) => (savedOrder.get(a.canonicalProductId) ?? 999) - (savedOrder.get(b.canonicalProductId) ?? 999));

  return items;
}
