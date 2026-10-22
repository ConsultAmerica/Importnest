import type { ConnectorListing, ConnectorQuery, ConnectorResult, SourceConnector } from "./types";

export const SOURCE_ID = "src-ebay";

const BROWSE_SCOPE = "https://api.ebay.com/oauth/api_scope";
const SEARCH_LIMIT = "20";
/** Bound the no-query cron pass so a full catalog cannot exhaust the daily call quota. */
const CATALOG_UPC_LIMIT = 8;
/** Item-detail calls fill MPN / UPC from item specifics. Kept small on purpose. */
const DETAIL_ENRICH_LIMIT = 10;

const CONDITION_BY_ID: Record<string, string> = {
  "1000": "new",
  "1500": "open-box",
  "1750": "open-box",
  "2000": "certified-refurbished",
  "2010": "refurbished",
  "2020": "refurbished",
  "2030": "refurbished",
  "2500": "refurbished",
  "2750": "open-box",
  "3000": "used",
  "4000": "used",
  "5000": "used",
  "6000": "used",
};

const CONDITION_BY_NAME: Record<string, string> = {
  NEW: "new",
  NEW_OTHER: "open-box",
  NEW_WITH_DEFECTS: "open-box",
  OPEN_BOX: "open-box",
  LIKE_NEW: "open-box",
  CERTIFIED_REFURBISHED: "certified-refurbished",
  MANUFACTURER_REFURBISHED: "refurbished",
  SELLER_REFURBISHED: "refurbished",
  EXCELLENT_REFURBISHED: "refurbished",
  VERY_GOOD_REFURBISHED: "refurbished",
  GOOD_REFURBISHED: "refurbished",
  USED: "used",
  USED_EXCELLENT: "used",
  USED_VERY_GOOD: "used",
  USED_GOOD: "used",
  USED_ACCEPTABLE: "used",
  PRE_OWNED_EXCELLENT: "used",
  PRE_OWNED_FAIR: "used",
  VERY_GOOD: "used",
  GOOD: "used",
  ACCEPTABLE: "used",
};

const GTIN_ASPECTS = new Set(["UPC", "EAN", "GTIN", "ISBN", "GTIN-12", "GTIN-13", "GTIN-14"]);
const MPN_ASPECTS = new Set(["MPN", "MANUFACTURER PART NUMBER"]);

export type EbayMoney = {
  value?: string;
  currency?: string;
};

export type EbayShippingOption = {
  shippingCost?: EbayMoney;
  shippingCostType?: string;
  importCharges?: EbayMoney;
  minEstimatedDeliveryDate?: string;
  maxEstimatedDeliveryDate?: string;
};

export type EbayAspect = {
  name?: string;
  value?: string;
};

export type EbayProductIdentity = {
  identifierType?: string;
  identifierValue?: string;
};

export type EbayItemSummary = {
  itemId?: string;
  title?: string;
  condition?: string;
  conditionId?: string;
  price?: EbayMoney;
  seller?: { username?: string };
  itemWebUrl?: string;
  itemAffiliateWebUrl?: string;
  shippingOptions?: EbayShippingOption[];
  buyingOptions?: string[];
};

export type EbayItemDetail = EbayItemSummary & {
  localizedAspects?: EbayAspect[];
  product?: {
    gtins?: string[];
    mpns?: string[];
    additionalProductIdentities?: { productIdentity?: EbayProductIdentity[] }[];
  };
};

export type EbayConnectorConfig = {
  clientId?: string;
  clientSecret?: string;
  campaignId?: string;
  referenceId?: string;
  marketplaceId: string;
  deliveryCountry: string;
  deliveryZip?: string;
  environment: "production" | "sandbox";
};

export type EbayMapContext = {
  /**
   * UPC the search was constrained to. Stamped onto listings only when the
   * item itself did not disclose an identifier.
   */
  stampUpc?: string;
};

type TokenCache = { key: string; token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

function apiOrigin(config: EbayConnectorConfig) {
  return config.environment === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

export function readEbayConfig(
  env: Record<string, string | undefined> = process.env,
): EbayConnectorConfig {
  return {
    clientId: env.EBAY_CLIENT_ID?.trim() || undefined,
    clientSecret: env.EBAY_CLIENT_SECRET?.trim() || undefined,
    campaignId: env.EBAY_CAMPAIGN_ID?.trim() || undefined,
    referenceId: env.EBAY_AFFILIATE_REFERENCE_ID?.trim() || undefined,
    marketplaceId: env.EBAY_MARKETPLACE_ID?.trim() || "EBAY_US",
    deliveryCountry: env.EBAY_DELIVERY_COUNTRY?.trim() || "US",
    deliveryZip: env.EBAY_DELIVERY_ZIP?.trim() || undefined,
    environment: env.EBAY_ENVIRONMENT === "sandbox" ? "sandbox" : "production",
  };
}

export function ebayCredentialsConfigured(config: EbayConnectorConfig) {
  return Boolean(config.clientId && config.clientSecret);
}

/**
 * Browse returns shippingOptions, and itemAffiliateWebUrl, only when this
 * header is present. The affiliate URL is what /go/[listingId] must store
 * if the eBay Partner Network campaign is to attribute the click.
 */
export function buildEndUserCtx(config: EbayConnectorConfig): string {
  const country = config.deliveryCountry || "US";
  const location = config.deliveryZip
    ? `country=${country},zip=${config.deliveryZip}`
    : `country=${country}`;
  const parts = [`contextualLocation=${encodeURIComponent(location)}`];
  if (config.campaignId) parts.push(`affiliateCampaignId=${encodeURIComponent(config.campaignId)}`);
  if (config.referenceId) parts.push(`affiliateReferenceId=${encodeURIComponent(config.referenceId)}`);
  return parts.join(",");
}

function normalizeConditionName(raw: string) {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Maps Browse condition text / conditionId onto Listing.condition.
 * Parts-only listings are dropped (null) so they never rank as a used offer.
 * Unknown conditions are dropped rather than defaulted to "new".
 */
export function mapEbayCondition(condition?: string, conditionId?: string): string | null {
  const id = conditionId?.trim();
  const name = condition ? normalizeConditionName(condition) : "";
  if (id === "7000" || name === "FOR_PARTS_OR_NOT_WORKING" || name.startsWith("FOR_PARTS")) {
    return null;
  }
  if (id && CONDITION_BY_ID[id]) return CONDITION_BY_ID[id];
  if (name && CONDITION_BY_NAME[name]) return CONDITION_BY_NAME[name];
  return null;
}

function safeUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? raw : undefined;
  } catch {
    return undefined;
  }
}

function usdAmount(money?: EbayMoney): number | null {
  if (!money?.value) return null;
  if (money.currency && money.currency.toUpperCase() !== "USD") return null;
  const amount = Number(money.value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

function dateOnly(iso?: string) {
  return iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : undefined;
}

function deliveryLabelFor(option: EbayShippingOption, shipping: number): string {
  const min = dateOnly(option.minEstimatedDeliveryDate);
  const max = dateOnly(option.maxEstimatedDeliveryDate);
  const window =
    min && max ? `Estimated delivery ${min} to ${max}` : min ? `Estimated delivery ${min}` : undefined;
  if (shipping === 0) return window ? `Free shipping · ${window}` : "Free shipping";
  return window ?? "Shipping cost disclosed by eBay";
}

/**
 * FIXED costs are buyer-independent and stored, including a real 0 for free
 * shipping. CALCULATED costs depend on the buyer and stay undisclosed.
 * A cost with no shippingCostType (search summaries) is not treated as fixed.
 */
export function extractEbayShipping(options: EbayShippingOption[] | undefined): {
  shipping?: number;
  fees?: number;
  deliveryLabel?: string;
} {
  const fixed = (options ?? []).filter(
    (option) =>
      option.shippingCostType?.trim().toUpperCase() === "FIXED" && usdAmount(option.shippingCost) != null,
  );
  if (fixed.length) {
    const cheapest = fixed.reduce((best, option) =>
      (usdAmount(option.shippingCost) as number) < (usdAmount(best.shippingCost) as number) ? option : best,
    );
    const shipping = usdAmount(cheapest.shippingCost) as number;
    const fees = usdAmount(cheapest.importCharges);
    return {
      shipping,
      ...(fees != null && fees > 0 ? { fees } : {}),
      deliveryLabel: deliveryLabelFor(cheapest, shipping),
    };
  }

  if ((options ?? []).some((option) => option.shippingCostType?.trim().toUpperCase() === "CALCULATED")) {
    return { deliveryLabel: "Shipping calculated at checkout" };
  }

  return {};
}

function aspectKey(name: string) {
  return name.trim().toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function firstIdentifierToken(value: string) {
  return value.split(/[,;/]/)[0]?.trim() || undefined;
}

function preferGtin(current: string | undefined, candidate: string | undefined) {
  if (!candidate) return current;
  if (!current) return candidate;
  const currentIsUpc = /^\d{12}$/.test(current);
  const candidateIsUpc = /^\d{12}$/.test(candidate);
  if (candidateIsUpc && !currentIsUpc) return candidate;
  return current;
}

/** Pulls UPC/EAN and MPN from getItem product identities and localized aspects. */
export function extractEbayIdentifiers(detail?: EbayItemDetail | null): { upc?: string; mpn?: string } {
  let upc: string | undefined;
  let mpn: string | undefined;

  for (const gtin of detail?.product?.gtins ?? []) {
    upc = preferGtin(upc, gtin.trim() || undefined);
  }
  for (const value of detail?.product?.mpns ?? []) {
    if (!mpn && value.trim()) mpn = value.trim();
  }
  for (const group of detail?.product?.additionalProductIdentities ?? []) {
    for (const identity of group.productIdentity ?? []) {
      const type = identity.identifierType ? aspectKey(identity.identifierType) : "";
      const value = identity.identifierValue?.trim();
      if (!value) continue;
      if (GTIN_ASPECTS.has(type)) upc = preferGtin(upc, value);
      else if (MPN_ASPECTS.has(type) && !mpn) mpn = value;
    }
  }
  for (const aspect of detail?.localizedAspects ?? []) {
    if (!aspect.name || !aspect.value) continue;
    const key = aspectKey(aspect.name);
    const value = firstIdentifierToken(aspect.value);
    if (!value) continue;
    if (GTIN_ASPECTS.has(key)) upc = preferGtin(upc, value);
    else if (MPN_ASPECTS.has(key) && !mpn) mpn = value;
  }

  return { upc, mpn };
}

function isFixedPrice(buyingOptions?: string[]) {
  if (!buyingOptions?.length) return true;
  return buyingOptions.some((option) => option.toUpperCase() === "FIXED_PRICE");
}

/**
 * True for a search hit worth storing. Discarded hits are never sent to getItem.
 */
export function isEbaySummaryKeeper(summary: EbayItemSummary): boolean {
  if (!summary.itemId || !isFixedPrice(summary.buyingOptions)) return false;
  if (usdAmount(summary.price) == null) return false;
  return mapEbayCondition(summary.condition, summary.conditionId) != null;
}

/**
 * One Browse item summary (plus optional getItem detail) becomes one listing.
 * Returns null when price or condition is unusable, or the offer is auction-only
 * or parts-only. Shipping is set only for a FIXED cost; CALCULATED stays omitted
 * so upsert can store null.
 */
export function mapEbayItem(
  summary: EbayItemSummary,
  detail?: EbayItemDetail | null,
  context: EbayMapContext = {},
): ConnectorListing | null {
  const item = { ...summary, ...(detail ?? {}) };
  if (!item.itemId || !isFixedPrice(item.buyingOptions ?? summary.buyingOptions)) return null;

  const condition = mapEbayCondition(item.condition ?? summary.condition, item.conditionId ?? summary.conditionId);
  const price = usdAmount(item.price) ?? usdAmount(summary.price);
  if (!condition || price == null) return null;

  // Item detail is the authority for shippingCostType. Untyped summary costs
  // are not stored as fixed, and a CALCULATED detail does not fall back to them.
  const shippingOptions = detail ? detail.shippingOptions : summary.shippingOptions;
  const shipping = extractEbayShipping(shippingOptions);

  const identifiers = extractEbayIdentifiers(detail);
  const upc = identifiers.upc ?? context.stampUpc;

  return {
    externalId: item.itemId,
    sellerName: item.seller?.username?.trim() || summary.seller?.username?.trim() || undefined,
    url: safeUrl(item.itemAffiliateWebUrl) ?? safeUrl(item.itemWebUrl) ?? safeUrl(summary.itemWebUrl),
    condition,
    price,
    ...(shipping.shipping != null ? { shipping: shipping.shipping } : {}),
    ...(shipping.fees != null ? { fees: shipping.fees } : {}),
    ...(shipping.deliveryLabel ? { deliveryLabel: shipping.deliveryLabel } : {}),
    ...(upc ? { upc } : {}),
    ...(identifiers.mpn ? { mpn: identifiers.mpn } : {}),
    modelName: item.title?.trim() || summary.title?.trim() || undefined,
  };
}

/** 12-digit UPC uses the gtin parameter. eBay rejects EAN and other GTIN shapes there. */
export function resolveEbaySearch(
  query: ConnectorQuery,
): { gtin?: string; q?: string; stampUpc?: string } | null {
  const upc = query.upc?.trim();
  const model = query.modelNumber?.trim();
  const gtin = [upc, model].find((value) => value && /^\d{12}$/.test(value));
  if (gtin) return { gtin, stampUpc: gtin };
  const keyword = model || upc;
  if (!keyword) return null;
  return { q: keyword };
}

function cacheKey(config: EbayConnectorConfig) {
  return `${config.environment}:${config.clientId ?? ""}`;
}

async function fetchAppToken(config: EbayConnectorConfig): Promise<string> {
  const now = Date.now();
  const key = cacheKey(config);
  if (tokenCache && tokenCache.key === key && tokenCache.expiresAt > now) return tokenCache.token;
  if (!ebayCredentialsConfigured(config)) {
    throw new Error(
      "eBay Browse API credentials are not configured (EBAY_CLIENT_ID, EBAY_CLIENT_SECRET).",
    );
  }

  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(`${apiOrigin(config)}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(BROWSE_SCOPE)}`,
  });
  if (!response.ok) {
    throw new Error(`eBay OAuth token request failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("eBay OAuth token response did not include access_token.");
  }
  const ttlMs = Math.max(30, (data.expires_in ?? 7200) - 60) * 1000;
  tokenCache = { key, token: data.access_token, expiresAt: now + ttlMs };
  return data.access_token;
}

function browseHeaders(config: EbayConnectorConfig, token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Accept-Language": "en-US",
    "X-EBAY-C-MARKETPLACE-ID": config.marketplaceId,
    "X-EBAY-C-ENDUSERCTX": buildEndUserCtx(config),
  };
}

async function searchItems(
  config: EbayConnectorConfig,
  token: string,
  search: { gtin?: string; q?: string },
): Promise<EbayItemSummary[]> {
  const params = new URLSearchParams({
    limit: SEARCH_LIMIT,
    filter: "buyingOptions:{FIXED_PRICE}",
  });
  if (search.gtin) params.set("gtin", search.gtin);
  if (search.q) params.set("q", search.q);

  const response = await fetch(
    `${apiOrigin(config)}/buy/browse/v1/item_summary/search?${params.toString()}`,
    { headers: browseHeaders(config, token) },
  );
  if (!response.ok) {
    throw new Error(`eBay Browse search failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { itemSummaries?: EbayItemSummary[] };
  return data.itemSummaries ?? [];
}

async function fetchItemDetail(
  config: EbayConnectorConfig,
  token: string,
  itemId: string,
): Promise<EbayItemDetail | null> {
  const response = await fetch(
    `${apiOrigin(config)}/buy/browse/v1/item/${encodeURIComponent(itemId)}?fieldgroups=PRODUCT`,
    { headers: browseHeaders(config, token) },
  );
  if (!response.ok) return null;
  return (await response.json()) as EbayItemDetail;
}

async function ensureEbaySource() {
  const { prisma } = await import("@/lib/prisma");
  await prisma.source.upsert({
    where: { id: SOURCE_ID },
    update: {},
    create: {
      id: SOURCE_ID,
      name: "eBay",
      sourceType: "affiliate-feed",
      isActive: true,
      licensingNotes:
        "eBay Browse API via the eBay Partner Network. Outbound links must use itemAffiliateWebUrl when a campaign id is configured.",
    },
  });
}

async function catalogUpcSearches(
  config: EbayConnectorConfig,
  token: string,
): Promise<{ summary: EbayItemSummary; stampUpc: string }[]> {
  const { prisma } = await import("@/lib/prisma");
  const identifiers = await prisma.productIdentifier.findMany({
    where: { type: { in: ["UPC", "GTIN"] }, value: { not: "" } },
    take: CATALOG_UPC_LIMIT * 3,
    select: { value: true },
  });
  const upcs = [
    ...new Set(identifiers.map((row) => row.value.trim()).filter((value) => /^\d{12}$/.test(value))),
  ].slice(0, CATALOG_UPC_LIMIT);

  const found: { summary: EbayItemSummary; stampUpc: string }[] = [];
  for (const upc of upcs) {
    const summaries = await searchItems(config, token, { gtin: upc });
    for (const summary of summaries) found.push({ summary, stampUpc: upc });
  }
  return found;
}

/**
 * eBay Browse API (Buy API) via an application token, with eBay Partner Network
 * attribution when EBAY_CAMPAIGN_ID is set. A query searches that UPC or
 * keyword. With no query — the daily cron path — it searches a bounded set of
 * catalog UPCs. Missing credentials on that path return no listings, so an
 * unconfigured deploy does not fail the rest of sync-all.
 */
export const ebayConnector: SourceConnector = {
  sourceId: SOURCE_ID,
  async fetchListings(query: ConnectorQuery = {}): Promise<ConnectorResult> {
    const fetchedAt = new Date();
    const config = readEbayConfig();
    const search = resolveEbaySearch(query);

    if (!search && !ebayCredentialsConfigured(config)) {
      return { sourceId: SOURCE_ID, listings: [], fetchedAt };
    }

    const token = await fetchAppToken(config);
    await ensureEbaySource();
    const hits = search
      ? (await searchItems(config, token, search)).map((summary) => ({
          summary,
          stampUpc: search.stampUpc,
        }))
      : await catalogUpcSearches(config, token);

    const seen = new Set<string>();
    const keepers: { summary: EbayItemSummary; stampUpc?: string }[] = [];
    for (const hit of hits) {
      if (!hit.summary.itemId || seen.has(hit.summary.itemId) || !isEbaySummaryKeeper(hit.summary)) continue;
      seen.add(hit.summary.itemId);
      keepers.push(hit);
    }

    const listings: ConnectorListing[] = [];
    for (let index = 0; index < keepers.length; index += 1) {
      const hit = keepers[index]!;
      // getItem is one call per kept item and is capped. Hits we already
      // discarded never reach this loop.
      const detail =
        index < DETAIL_ENRICH_LIMIT
          ? await fetchItemDetail(config, token, hit.summary.itemId as string)
          : null;
      const listing = mapEbayItem(hit.summary, detail, { stampUpc: hit.stampUpc });
      if (listing) listings.push(listing);
    }

    return { sourceId: SOURCE_ID, listings, fetchedAt };
  },
};
