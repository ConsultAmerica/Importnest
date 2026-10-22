/**
 * Lightweight outbound handoff health probe.
 * Called after a shopper clicks View offer (/go/[listingId]). Does not block
 * the redirect. Flags non-OK responses so ops can investigate broken affiliate
 * links — price drift (>20%) needs a live merchant scrape and is intentionally
 * out of scope here (feeds remain the price source of truth).
 */
export async function probeOfferLinkHealth(input: {
  listingId: string;
  url: string;
  ingestedPrice: number;
}): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(input.url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "ImportnestLinkHealth/1.0" },
    }).finally(() => clearTimeout(timer));

    if (!res.ok && res.status !== 405) {
      console.warn("[offer-link-health] non-OK merchant URL", {
        listingId: input.listingId,
        status: res.status,
        ingestedPrice: input.ingestedPrice,
      });
    }
  } catch (err) {
    console.warn("[offer-link-health] probe failed", {
      listingId: input.listingId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
