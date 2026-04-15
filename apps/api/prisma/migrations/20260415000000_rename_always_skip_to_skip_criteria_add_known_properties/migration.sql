-- AlterTable: rename alwaysSkip -> skipCriteria, add knownProperties
ALTER TABLE "ScreeningPreferences" ADD COLUMN "skipCriteria" TEXT;
ALTER TABLE "ScreeningPreferences" ADD COLUMN "knownProperties" TEXT;

-- Copy existing alwaysSkip values into skipCriteria
UPDATE "ScreeningPreferences" SET "skipCriteria" = "alwaysSkip" WHERE "alwaysSkip" IS NOT NULL;

-- Drop the old column
ALTER TABLE "ScreeningPreferences" DROP COLUMN "alwaysSkip";
