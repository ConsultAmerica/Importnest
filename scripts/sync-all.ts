import { syncAllConnectorsDetailed } from "../src/lib/connectors/sync-all";
import { prisma } from "../src/lib/prisma";

async function main() {
  const summary = await syncAllConnectorsDetailed();
  console.table(
    summary.metrics.map((m) => ({
      sourceId: m.sourceId,
      upserted: m.upserted,
      errors: m.errorCount,
      stale: m.staleListingCount,
      ms: m.durationMs,
    })),
  );
  console.log(`staleListingsTotal=${summary.staleListingsTotal}`);

  const failed = summary.metrics.filter((m) => m.errorCount > 0 && m.upserted === 0);
  if (failed.length > 0) {
    console.error(`${failed.length}/${summary.metrics.length} connector(s) failed`);
    process.exitCode = 1;
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
