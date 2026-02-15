-- Backfill: Create InitialScreening records for deals that have the deprecated
-- initialScreeningDecision set but no InitialScreening relation record.
INSERT INTO "InitialScreening" ("id", "dealId", "decision", "reason", "screenedAt", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  d."id",
  d."initialScreeningDecision",
  COALESCE(d."initialScreeningSummary", 'Migrated from legacy field'),
  COALESCE(d."initialScreeningAt", d."createdAt"),
  COALESCE(d."initialScreeningAt", d."createdAt"),
  NOW()
FROM "Deal" d
WHERE d."initialScreeningDecision" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "InitialScreening" i WHERE i."dealId" = d."id"
  );

-- Drop deprecated columns
ALTER TABLE "Deal" DROP COLUMN "initialScreeningDecision";
ALTER TABLE "Deal" DROP COLUMN "initialScreeningSummary";
ALTER TABLE "Deal" DROP COLUMN "initialScreeningAt";
