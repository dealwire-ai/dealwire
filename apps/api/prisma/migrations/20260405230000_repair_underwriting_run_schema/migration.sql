-- Repair: ensure UnderwritingRun matches the current Prisma schema.
-- The redesign migration (20260405030000) was recorded as applied but its DDL
-- may not have executed (pgbouncer / pooler transaction issue). This migration
-- is fully idempotent — if the schema is already correct, every statement is a no-op.

-- Add columns introduced by the redesign (no-op if they already exist)
ALTER TABLE "UnderwritingRun" ADD COLUMN IF NOT EXISTS "filledProformaModelS3Key" TEXT;
ALTER TABLE "UnderwritingRun" ADD COLUMN IF NOT EXISTS "dealId" TEXT;
ALTER TABLE "UnderwritingRun" ADD COLUMN IF NOT EXISTS "proformaId" TEXT;

-- Drop columns removed by the redesign (no-op if they don't exist)
ALTER TABLE "UnderwritingRun" DROP COLUMN IF EXISTS "proformaS3Key";
ALTER TABLE "UnderwritingRun" DROP COLUMN IF EXISTS "pipelineType";

-- Add foreign keys if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UnderwritingRun_dealId_fkey') THEN
    ALTER TABLE "UnderwritingRun" ADD CONSTRAINT "UnderwritingRun_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UnderwritingRun_proformaId_fkey') THEN
    ALTER TABLE "UnderwritingRun" ADD CONSTRAINT "UnderwritingRun_proformaId_fkey"
    FOREIGN KEY ("proformaId") REFERENCES "Proforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add index on dealId if missing
CREATE INDEX IF NOT EXISTS "UnderwritingRun_dealId_idx" ON "UnderwritingRun"("dealId");

-- Drop PipelineType enum if no longer used
DROP TYPE IF EXISTS "PipelineType";
