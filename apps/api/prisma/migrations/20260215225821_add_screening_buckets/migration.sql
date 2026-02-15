-- CreateEnum
CREATE TYPE "BucketAction" AS ENUM ('REPLY_TO_SELF', 'DRAFT_REPLY_TO_BROKER', 'MOVE_TO_FOLDER', 'NONE');

-- AlterTable
ALTER TABLE "InitialScreening" ADD COLUMN     "screeningBucketId" TEXT;

-- CreateTable
CREATE TABLE "ScreeningBucket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "isPass" BOOLEAN NOT NULL,
    "action" "BucketAction" NOT NULL DEFAULT 'NONE',
    "folderName" TEXT,
    "generateSummary" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreeningBucket_organizationId_idx" ON "ScreeningBucket"("organizationId");

-- AddForeignKey
ALTER TABLE "InitialScreening" ADD CONSTRAINT "InitialScreening_screeningBucketId_fkey" FOREIGN KEY ("screeningBucketId") REFERENCES "ScreeningBucket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningBucket" ADD CONSTRAINT "ScreeningBucket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: Create default "Yes" and "No" buckets for each org with ScreeningPreferences
-- "Yes" bucket: rank 1, isPass=true, action=REPLY_TO_SELF, generateSummary=true
INSERT INTO "ScreeningBucket" ("id", "organizationId", "name", "description", "rank", "isPass", "action", "folderName", "generateSummary", "color", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  sp."organizationId",
  'Yes',
  COALESCE(sp."dealCriteria", 'Meets investment criteria'),
  1,
  true,
  'REPLY_TO_SELF'::"BucketAction",
  NULL,
  true,
  NULL,
  NOW(),
  NOW()
FROM "ScreeningPreferences" sp;

-- "No" bucket: rank 2, isPass=false, action=MOVE_TO_FOLDER
INSERT INTO "ScreeningBucket" ("id", "organizationId", "name", "description", "rank", "isPass", "action", "folderName", "generateSummary", "color", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  sp."organizationId",
  'No',
  'Does not meet investment criteria',
  2,
  false,
  'MOVE_TO_FOLDER'::"BucketAction",
  COALESCE(sp."passedFolderName", 'Passed Deals'),
  false,
  NULL,
  NOW(),
  NOW()
FROM "ScreeningPreferences" sp;

-- Backfill: Set screeningBucketId on existing InitialScreening records
-- Match YES decisions to the "Yes" bucket (rank 1) and NO to "No" bucket (rank 2)
UPDATE "InitialScreening" is_
SET "screeningBucketId" = sb.id
FROM "Deal" d
JOIN "ScreeningBucket" sb ON sb."organizationId" = d."organizationId"
WHERE is_."dealId" = d.id
  AND (
    (is_.decision = 'YES' AND sb.rank = 1)
    OR (is_.decision = 'NO' AND sb.rank = 2)
  );
