/**
 * Manual / host-scheduler entry for merchant feed ingestion.
 * Same worker the Vercel cron route calls — use this outside Vercel:
 *
 *   npm run sync:batch
 *   npm run sync:batch -- src-ebay
 *
 * Optional second arg is unused (query stays on `npm run sync -- <source> [q]`).
 */
import {
  merchantFeedIngestion,
  type IngestMetrics,
} from "../src/lib/connectors/batch-ingest";
import { prisma } from "../src/lib/prisma";

async function main() {
  const sourceId = process.argv[2];

  if (sourceId) {
    const metrics = await merchantFeedIngestion.processMerchantFeed(sourceId);
    printMetrics([metrics]);
    if (metrics.errorCount > 0 && metrics.upserted === 0) process.exitCode = 1;
    return;
  }

  const summary = await merchantFeedIngestion.processAllActive();
  printMetrics(summary.metrics);
  console.log(`staleListingsTotal=${summary.staleListingsTotal}`);

  const hardFails = summary.metrics.filter((m) => m.errorCount > 0 && m.upserted === 0);
  if (hardFails.length > 0) {
    console.error(`${hardFails.length}/${summary.metrics.length} source(s) failed hard`);
    process.exitCode = 1;
  }
}

function printMetrics(metrics: IngestMetrics[]) {
  console.table(
    metrics.map((m) => ({
      sourceId: m.sourceId,
      upserted: m.upserted,
      errors: m.errorCount,
      stale: m.staleListingCount,
      ms: m.durationMs,
    })),
  );
  for (const m of metrics) {
    if (m.errors.length > 0) {
      console.warn(m.sourceId, m.errors.slice(0, 5));
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
