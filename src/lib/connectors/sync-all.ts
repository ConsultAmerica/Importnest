import {
  merchantFeedIngestion,
  type BatchIngestSummary,
  type IngestMetrics,
} from "./batch-ingest";

export type SyncAllResult = {
  sourceId: string;
  upserted?: number;
  error?: string;
  staleListingCount?: number;
  durationMs?: number;
};

/**
 * Runs every registered connector's default (no-query) listing fetch and
 * upserts the results. Each connector is isolated so one failing source
 * never stops the others — used by both `sync:all` and the cron route.
 *
 * Delegates to MerchantFeedIngestionService for metrics + stale reporting.
 */
export async function syncAllConnectors(): Promise<SyncAllResult[]> {
  const summary = await merchantFeedIngestion.processAllActive();
  return summary.metrics.map(metricsToSyncResult);
}

/** Full batch summary (metrics + global stale count) for cron responses. */
export async function syncAllConnectorsDetailed(): Promise<BatchIngestSummary> {
  return merchantFeedIngestion.processAllActive();
}

function metricsToSyncResult(m: IngestMetrics): SyncAllResult {
  return {
    sourceId: m.sourceId,
    upserted: m.upserted,
    staleListingCount: m.staleListingCount,
    durationMs: m.durationMs,
    ...(m.errorCount > 0 && m.upserted === 0 && m.errors[0]
      ? { error: m.errors[0] }
      : m.errorCount > 0
        ? { error: `${m.errorCount} item/upsert error(s)` }
        : {}),
  };
}
