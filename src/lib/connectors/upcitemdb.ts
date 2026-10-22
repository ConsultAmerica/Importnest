import {
  isNormalizedOffer,
  normalizeMerchantOffer,
  toConnectorListing,
} from "./normalize-merchant-feed";
import type { ConnectorQuery, ConnectorResult, SourceConnector } from "./types";

export const SOURCE_ID = "src-official";

const TRIAL_ENDPOINT = "https://api.upcitemdb.com/prod/trial/lookup";

type UpcItemDbOffer = {
  merchant?: string;
  domain?: string;
  price?: number;
  shipping?: string;
  condition?: string;
  availability?: string;
  link?: string;
};

type UpcItemDbItem = {
  upc?: string;
  model?: string;
  title?: string;
  offers?: UpcItemDbOffer[];
};

type UpcItemDbResponse = {
  code: string;
  items?: UpcItemDbItem[];
};

/** Map one UPCItemDB offer through the shared normalization pipeline. */
export function mapUpcItemDbOffer(
  offer: UpcItemDbOffer,
  item: UpcItemDbItem,
  upc: string,
): ReturnType<typeof toConnectorListing> | null {
  const merchant = offer.merchant || offer.domain || "Unknown retailer";
  const normalized = normalizeMerchantOffer({
    offer_id: `${upc}-${merchant}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    merchant_id: SOURCE_ID,
    merchant_name: merchant,
    feed_type: "manufacturer_feed",
    raw_price: offer.price ?? "invalid",
    raw_shipping: offer.shipping ?? null,
    raw_fees: 0,
    delivery_speed: offer.availability,
    condition: offer.condition,
    url: offer.link,
    upc,
    mpn: item.model,
    model_name: item.title,
  });
  if (!isNormalizedOffer(normalized)) return null;
  return toConnectorListing(normalized);
}

export const upcItemDbConnector: SourceConnector = {
  sourceId: SOURCE_ID,
  async fetchListings(query: ConnectorQuery = {}): Promise<ConnectorResult> {
    const fetchedAt = new Date();

    // The free trial endpoint only supports lookup by UPC/EAN, not model-number search.
    if (!query.upc) {
      return { sourceId: SOURCE_ID, listings: [], fetchedAt };
    }

    const response = await fetch(
      `${TRIAL_ENDPOINT}?upc=${encodeURIComponent(query.upc)}`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      throw new Error(
        `UPCItemDB request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data: UpcItemDbResponse = await response.json();

    if (data.code !== "OK" || !data.items?.length) {
      return { sourceId: SOURCE_ID, listings: [], fetchedAt };
    }

    const item = data.items[0]!;
    const upc = item.upc ?? query.upc;

    const listings = (item.offers ?? [])
      .map((offer) => mapUpcItemDbOffer(offer, item, upc))
      .filter((listing): listing is NonNullable<typeof listing> => listing != null);

    return { sourceId: SOURCE_ID, listings, fetchedAt };
  },
};
