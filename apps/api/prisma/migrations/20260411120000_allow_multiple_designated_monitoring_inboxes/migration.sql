-- Add the new array column with an empty default.
ALTER TABLE "ScreeningPreferences"
ADD COLUMN "designatedMonitoringInboxEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill from the legacy single-email column.
UPDATE "ScreeningPreferences"
SET "designatedMonitoringInboxEmails" = ARRAY["designatedMonitoringInboxEmail"]
WHERE "designatedMonitoringInboxEmail" IS NOT NULL;

-- Drop the legacy single-email column.
ALTER TABLE "ScreeningPreferences"
DROP COLUMN "designatedMonitoringInboxEmail";
