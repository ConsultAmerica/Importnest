import type { NextRequest } from "next/server";
import { syncAllConnectorsDetailed } from "@/lib/connectors/sync-all";

/**
 * Triggered on a schedule by Vercel Cron (see vercel.json) — Vercel sends
 * `Authorization: Bearer $CRON_SECRET` automatically for configured cron
 * requests, so a mismatch means the caller is not the cron scheduler. Fails
 * closed (401) when CRON_SECRET isn't set, rather than leaving this endpoint
 * open to trigger writes with no auth at all.
 *
 * Runs the idempotent MerchantFeedIngestionService batch: per-source upserts,
 * isolated errors, and a stale-listing inventory report (freshness is derived
 * from Listing.freshnessCapturedAt at read time).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await syncAllConnectorsDetailed();
  return Response.json({
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    staleListingsTotal: summary.staleListingsTotal,
    results: summary.metrics.map((m) => ({
      sourceId: m.sourceId,
      upserted: m.upserted,
      successCount: m.successCount,
      errorCount: m.errorCount,
      staleListingCount: m.staleListingCount,
      durationMs: m.durationMs,
      errors: m.errors,
    })),
  });
}
