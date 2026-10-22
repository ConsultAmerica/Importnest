import { z } from "zod";
import type { ConnectorListing } from "./types";

/**
 * Ingestion bridge: messy merchant payloads → Importnest ConnectorListing /
 * NormalizedOffer. Shipping honesty is non-negotiable — undisclosed shipping
 * stays `null` and never becomes $0 in Total Known Cost.
 */

export const FEED_TYPES = [
  "affiliate",
  "manufacturer_feed",
  "verified_merchant",
  "partner",
] as const;

export type MerchantFeedType = (typeof FEED_TYPES)[number];

/** Maps ingest feed_type → DB Source.sourceType vocabulary. */
export const FEED_TYPE_TO_SOURCE_TYPE: Record<MerchantFeedType, string> = {
  affiliate: "affiliate-feed",
  manufacturer_feed: "manufacturer-feed",
  verified_merchant: "licensed-provider",
  partner: "partner-feed",
};

const MoneyInput = z.union([z.string(), z.number(), z.null()]).optional();

export const RawOfferSchema = z.object({
  offer_id: z.string().min(1),
  merchant_id: z.string().min(1),
  merchant_name: z.string().min(1),
  feed_type: z.enum(FEED_TYPES),
  raw_price: z.union([z.string(), z.number()]),
  raw_shipping: MoneyInput,
  raw_fees: MoneyInput,
  raw_discount: MoneyInput,
  delivery_speed: z.string().optional(),
  warranty: z.string().nullable().optional(),
  return_days: z.number().nullable().optional(),
  condition: z.string().optional(),
  url: z.string().optional(),
  upc: z.string().optional(),
  mpn: z.string().optional(),
  model_name: z.string().optional(),
  last_updated: z.string().optional(),
});

export type RawOffer = z.infer<typeof RawOfferSchema>;

export type NormalizedOffer = {
  offerId: string;
  merchant: {
    id: string;
    name: string;
    feedType: MerchantFeedType;
    sourceType: string;
  };
  pricing: {
    currency: "USD";
    itemPrice: number;
    /** Null when the feed did not disclose a shipping amount — never coerced to 0. */
    shippingCost: number | null;
    mandatoryFees: number;
    verifiedDiscount: number;
    /**
     * Item + disclosed shipping + fees − discount.
     * When shipping is undisclosed this is a floor (shipping omitted), not a full total.
     */
    totalKnownCost: number;
    shippingDisclosed: boolean;
  };
  fulfillment: {
    /** Present only when the feed supplied a real delivery label. */
    deliverySpeedLabel: string | null;
  };
  policyMetadata: {
    warrantyInfo: string | null;
    returnPeriodDays: number | null;
    /** 0–100 — same scale as listingCompleteness / offer “% data available”. */
    dataCompletenessScore: number;
  };
  freshness: {
    lastSyncedAt: string;
    status: "active" | "stale";
  };
  identity: {
    condition: string;
    url?: string;
    upc?: string;
    mpn?: string;
    modelName?: string;
  };
};

export type NormalizeOfferError = { error: string; offerId?: string };

const STALE_HOURS = 24;

/**
 * Parses price strings like "$1,299.00 USD", "Free", or "249.99/mo" into floats.
 * "Free" / "no charge" → 0. Unparseable → null (never invents a number).
 */
export function parsePrice(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(free|n\/?a|none|not\s+available|—|-)$/i.test(trimmed)) {
    return /free/i.test(trimmed) ? 0 : null;
  }

  const cleaned = trimmed.replace(/[^0-9.-]+/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Completeness 0–100 from fields the shopper relies on before clicking through.
 * Shipping counts only when disclosed (including free = 0).
 */
export function calculateCompletenessScore(input: {
  itemPrice: number | null;
  shipping: number | null;
  warranty?: string | null;
  returnDays?: number | null;
  deliverySpeed?: string | null;
  url?: string | null;
}): number {
  const checks = [
    input.itemPrice != null,
    input.shipping != null,
    Boolean(input.warranty?.trim()),
    input.returnDays != null && Number.isFinite(input.returnDays),
    Boolean(input.deliverySpeed?.trim()),
    Boolean(input.url?.trim()),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function normalizeCondition(raw?: string): string {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("open") && value.includes("box")) return "open-box";
  if (value.includes("refurb")) return "refurbished";
  if (value.includes("used") || value.includes("pre-owned") || value.includes("preowned")) {
    return "used";
  }
  if (value.includes("new") || !value) return "new";
  return value.replace(/\s+/g, "-") || "new";
}

function safeUrl(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? raw : undefined;
  } catch {
    return undefined;
  }
}

function freshnessStatus(lastSynced: Date, now = new Date()): "active" | "stale" {
  const hours = (now.getTime() - lastSynced.getTime()) / (1000 * 60 * 60);
  return hours > STALE_HOURS ? "stale" : "active";
}

/**
 * Total Known Cost floor: item − discount + disclosed shipping + fees.
 * Undisclosed shipping is omitted (not treated as free).
 */
export function computeTotalKnownCost(input: {
  itemPrice: number;
  shippingCost: number | null;
  mandatoryFees: number;
  verifiedDiscount?: number;
}): { totalKnownCost: number; shippingDisclosed: boolean } {
  const discount =
    typeof input.verifiedDiscount === "number" && Number.isFinite(input.verifiedDiscount)
      ? Math.max(0, input.verifiedDiscount)
      : 0;
  const shippingDisclosed =
    input.shippingCost != null && Number.isFinite(input.shippingCost) && input.shippingCost >= 0;
  const shipping = shippingDisclosed ? input.shippingCost! : 0;
  const fees =
    typeof input.mandatoryFees === "number" && Number.isFinite(input.mandatoryFees)
      ? Math.max(0, input.mandatoryFees)
      : 0;
  return {
    totalKnownCost: Number((input.itemPrice - discount + shipping + fees).toFixed(2)),
    shippingDisclosed,
  };
}

/** Map a normalized offer into the connector upsert shape. */
export function toConnectorListing(offer: NormalizedOffer): ConnectorListing {
  return {
    externalId: offer.offerId,
    sellerName: offer.merchant.name,
    url: offer.identity.url,
    condition: offer.identity.condition,
    price: offer.pricing.itemPrice,
    ...(offer.pricing.shippingDisclosed ? { shipping: offer.pricing.shippingCost! } : {}),
    fees: offer.pricing.mandatoryFees,
    ...(offer.fulfillment.deliverySpeedLabel
      ? { deliveryLabel: offer.fulfillment.deliverySpeedLabel }
      : {}),
    upc: offer.identity.upc,
    mpn: offer.identity.mpn,
    modelName: offer.identity.modelName,
  };
}

/**
 * Validate + normalize one raw merchant offer.
 * Returns `{ error }` on schema/price failure — never invents a price.
 */
export function normalizeMerchantOffer(
  rawInput: unknown,
  now = new Date(),
): NormalizedOffer | NormalizeOfferError {
  const validationResult = RawOfferSchema.safeParse(rawInput);
  if (!validationResult.success) {
    const offerId =
      typeof rawInput === "object" &&
      rawInput &&
      "offer_id" in rawInput &&
      typeof (rawInput as { offer_id: unknown }).offer_id === "string"
        ? (rawInput as { offer_id: string }).offer_id
        : undefined;
    return {
      error: `Validation failed: ${validationResult.error.issues.map((i) => i.message).join("; ")}`,
      offerId,
    };
  }

  const raw = validationResult.data;
  const itemPrice = parsePrice(raw.raw_price);
  if (itemPrice === null || itemPrice < 0) {
    return { error: `Invalid or missing item price for offer ${raw.offer_id}`, offerId: raw.offer_id };
  }

  const shippingCost = parsePrice(raw.raw_shipping ?? null);
  const mandatoryFees = parsePrice(raw.raw_fees ?? null) ?? 0;
  const verifiedDiscount = parsePrice(raw.raw_discount ?? null) ?? 0;
  const { totalKnownCost, shippingDisclosed } = computeTotalKnownCost({
    itemPrice,
    shippingCost,
    mandatoryFees,
    verifiedDiscount,
  });

  const url = safeUrl(raw.url);
  const deliverySpeedLabel = raw.delivery_speed?.trim() || null;
  const warrantyInfo = raw.warranty?.trim() || null;

  let lastSynced: Date;
  if (raw.last_updated) {
    const parsed = new Date(raw.last_updated);
    lastSynced = Number.isNaN(parsed.getTime()) ? now : parsed;
  } else {
    lastSynced = now;
  }

  return {
    offerId: raw.offer_id,
    merchant: {
      id: raw.merchant_id,
      name: raw.merchant_name,
      feedType: raw.feed_type,
      sourceType: FEED_TYPE_TO_SOURCE_TYPE[raw.feed_type],
    },
    pricing: {
      currency: "USD",
      itemPrice,
      shippingCost: shippingDisclosed ? shippingCost : null,
      mandatoryFees,
      verifiedDiscount,
      totalKnownCost,
      shippingDisclosed,
    },
    fulfillment: {
      deliverySpeedLabel,
    },
    policyMetadata: {
      warrantyInfo,
      returnPeriodDays: raw.return_days ?? null,
      dataCompletenessScore: calculateCompletenessScore({
        itemPrice,
        shipping: shippingDisclosed ? shippingCost : null,
        warranty: warrantyInfo,
        returnDays: raw.return_days,
        deliverySpeed: deliverySpeedLabel,
        url,
      }),
    },
    freshness: {
      lastSyncedAt: lastSynced.toISOString(),
      status: freshnessStatus(lastSynced, now),
    },
    identity: {
      condition: normalizeCondition(raw.condition),
      url,
      upc: raw.upc,
      mpn: raw.mpn,
      modelName: raw.model_name,
    },
  };
}

export function isNormalizedOffer(
  value: NormalizedOffer | NormalizeOfferError,
): value is NormalizedOffer {
  return !("error" in value);
}

/** Batch normalize; drops invalid rows and returns them separately for logging. */
export function normalizeMerchantFeed(rawOffers: unknown[]): {
  offers: NormalizedOffer[];
  listings: ConnectorListing[];
  errors: NormalizeOfferError[];
} {
  const offers: NormalizedOffer[] = [];
  const errors: NormalizeOfferError[] = [];

  for (const raw of rawOffers) {
    const result = normalizeMerchantOffer(raw);
    if (isNormalizedOffer(result)) offers.push(result);
    else errors.push(result);
  }

  return {
    offers,
    listings: offers.map(toConnectorListing),
    errors,
  };
}
