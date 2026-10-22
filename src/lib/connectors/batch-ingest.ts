import { prisma } from "@/lib/prisma";
import { FRESHNESS_REFRESH_MINUTES } from "@/lib/freshness";
import {
  isNormalizedOffer,
  normalizeMerchantOffer,
  toConnectorListing,
  type NormalizeOfferError,
  type NormalizedOffer,
} from "./normalize-merchant-feed";
import { getConnector, listConnectors } from "./registry";
import { upsertConnectorListings } from "./upsert-listings";
import type { ConnectorListing, ConnectorResult } from "./types";

export type IngestMetrics = {
  sourceId: string;
  successCount: number;
  errorCount: number;
  upserted: number;
  /** Listings for this source whose last sync is older than the freshness window. */
  staleListingCount: number;
  durationMs: number;
  errors: string[];
};

export type BatchIngestSummary = {
  startedAt: string;
  finishedAt: string;
  metrics: IngestMetrics[];
  /** Global count of listings past the 24h refresh window (read-time stale). */
  staleListingsTotal: number;
};

const DEFAULT_STALE_MINUTES = FRESHNESS_REFRESH_MINUTES;

function logInfo(message: string, meta?: Record<string, unknown>) {
  if (meta) console.log(`[Ingest] ${message}`, meta);
  else console.log(`[Ingest] ${message}`);
}

function logWarn(message: string, meta?: Record<string, unknown>) {
  if (meta) console.warn(`[Ingest] ${message}`, meta);
  else console.warn(`[Ingest] ${message}`);
}

function logError(message: string, meta?: Record<string, unknown>) {
  if (meta) console.error(`[Ingest] ${message}`, meta);
  else console.error(`[Ingest] ${message}`);
}

/**
 * Count listings whose freshnessCapturedAt is older than the shopper-facing
 * refresh window. Freshness is derived at read time from this timestamp —
 * there is no separate freshness_status column to UPDATE.
 */
export async function countStaleListings(
  olderThanMinutes = DEFAULT_STALE_MINUTES,
  sourceId?: string,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  return prisma.listing.count({
    where: {
      freshnessCapturedAt: { lt: cutoff },
      ...(sourceId ? { sourceId } : {}),
    },
  });
}

/**
 * Idempotent merchant-feed ingestion: normalize (when given raw rows) →
 * upsert by sourceId+externalId → log per-source metrics. One bad offer or
 * one failing connector never aborts the rest of the batch.
 *
 * Scheduling lives outside this class (Vercel Cron → `/api/cron/sync`, or
 * `npm run sync:all` on any host scheduler). Avoid embedding node-cron in the
 * Next.js process so ingestion does not block request workers.
 */
export class MerchantFeedIngestionService {
  /**
   * Normalize a raw merchant payload batch, then upsert. Invalid rows are
   * isolated — they increment errorCount and are skipped.
   */
  async processRawFeedBatch(
    sourceId: string,
    rawBatch: unknown[],
    fetchedAt = new Date(),
  ): Promise<IngestMetrics> {
    const started = Date.now();
    logInfo(`Starting raw-feed batch for ${sourceId}`, { count: rawBatch.length });

    const listings: ConnectorListing[] = [];
    const errors: string[] = [];

    for (const rawItem of rawBatch) {
      const result = normalizeMerchantOffer(rawItem, fetchedAt);
      if (!isNormalizedOffer(result)) {
        const err = result as NormalizeOfferError;
        logWarn(`Normalize failed`, { sourceId, offerId: err.offerId, error: err.error });
        errors.push(err.error);
        continue;
      }
      listings.push(toConnectorListing(result));
    }

    return this.upsertAndMetric(sourceId, listings, errors, started, fetchedAt);
  }

  /**
   * Fetch via a registered connector and upsert — same isolation model as
   * sync-all, with structured metrics + stale counts.
   */
  async processMerchantFeed(sourceId: string): Promise<IngestMetrics> {
    const started = Date.now();
    logInfo(`Starting connector sync for ${sourceId}`);

    try {
      const connector = getConnector(sourceId);
      const result: ConnectorResult = await connector.fetchListings();
      return this.upsertAndMetric(sourceId, result.listings, [], started, result.fetchedAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`Connector pipeline failed for ${sourceId}`, { error: message });
      const staleListingCount = await countStaleListings(DEFAULT_STALE_MINUTES, sourceId);
      return {
        sourceId,
        successCount: 0,
        errorCount: 1,
        upserted: 0,
        staleListingCount,
        durationMs: Date.now() - started,
        errors: [message],
      };
    }
  }

  /** Run every registered connector, then report global stale inventory. */
  async processAllActive(): Promise<BatchIngestSummary> {
    const startedAt = new Date();
    logInfo("Triggering scheduled multi-source feed sync", {
      sources: listConnectors(),
    });

    const metrics: IngestMetrics[] = [];
    for (const sourceId of listConnectors()) {
      metrics.push(await this.processMerchantFeed(sourceId));
    }

    const staleListingsTotal = await countStaleListings();
    const finishedAt = new Date();

    logInfo("All source sync batches completed", {
      sources: metrics.length,
      upserted: metrics.reduce((n, m) => n + m.upserted, 0),
      errors: metrics.reduce((n, m) => n + m.errorCount, 0),
      staleListingsTotal,
    });

    return {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      metrics,
      staleListingsTotal,
    };
  }

  private async upsertAndMetric(
    sourceId: string,
    listings: ConnectorListing[],
    normalizeErrors: string[],
    started: number,
    fetchedAt: Date,
  ): Promise<IngestMetrics> {
    let upserted = 0;
    const errors = [...normalizeErrors];

    if (listings.length > 0) {
      try {
        const summary = await upsertConnectorListings({
          sourceId,
          listings,
          fetchedAt,
        });
        upserted = summary.upserted;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(`Upsert failed for ${sourceId}`, { error: message });
        errors.push(message);
      }
    }

    const staleListingCount = await countStaleListings(DEFAULT_STALE_MINUTES, sourceId);
    const metrics: IngestMetrics = {
      sourceId,
      successCount: upserted,
      errorCount: errors.length,
      upserted,
      staleListingCount,
      durationMs: Date.now() - started,
      errors: errors.slice(0, 20),
    };

    logInfo(`Completed ingestion for ${sourceId}`, {
      upserted: metrics.upserted,
      errorCount: metrics.errorCount,
      staleListingCount: metrics.staleListingCount,
      durationMs: metrics.durationMs,
    });

    return metrics;
  }
}

/** Singleton used by cron + CLI — Prisma-backed, no in-process scheduler. */
export const merchantFeedIngestion = new MerchantFeedIngestionService();

/** @deprecated Prefer MerchantFeedIngestionService — kept for typed NormalizedOffer re-exports. */
export type { NormalizedOffer };
