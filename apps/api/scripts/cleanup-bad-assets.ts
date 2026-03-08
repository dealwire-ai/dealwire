/**
 * One-time cleanup: remove Asset records that have no street address (address IS NULL).
 * These were created from AI-extracted city/state-only "addresses" like "HAMPTON ROADS, VA, USA".
 *
 * Run: cd apps/api && npx ts-node scripts/cleanup-bad-assets.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all bad assets (no street address)
  const badAssets = await prisma.asset.findMany({
    where: { address: null },
    select: {
      id: true,
      normalizedAddress: true,
      _count: { select: { deals: true } },
    },
  });

  if (badAssets.length === 0) {
    console.log('No bad assets found. Nothing to clean up.');
    return;
  }

  console.log(`Found ${badAssets.length} assets with no street address:`);
  for (const a of badAssets) {
    console.log(
      `  ${a.id}  "${a.normalizedAddress}"  (${a._count.deals} deals)`,
    );
  }

  const badAssetIds = badAssets.map((a) => a.id);

  // Disassociate deals from bad assets
  const { count: dealsUpdated } = await prisma.deal.updateMany({
    where: { assetId: { in: badAssetIds } },
    data: { assetId: null },
  });

  console.log(`\nNulled assetId on ${dealsUpdated} deals.`);

  // Delete bad assets
  const { count: assetsDeleted } = await prisma.asset.deleteMany({
    where: { id: { in: badAssetIds } },
  });

  console.log(`Deleted ${assetsDeleted} bad assets.`);
  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
