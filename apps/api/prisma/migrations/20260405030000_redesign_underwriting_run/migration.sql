-- DropTable (safe — only ~2 rows in prod, approved for deletion)
DROP TABLE IF EXISTS "UnderwritingRun";

-- DropEnum (recreated below with same values)
DROP TYPE IF EXISTS "UnderwritingStatus";
DROP TYPE IF EXISTS "PipelineType";

-- CreateEnum
CREATE TYPE "UnderwritingStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "UnderwritingRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dealId" TEXT,
    "proformaId" TEXT,
    "jobId" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "emailSubject" TEXT,
    "status" "UnderwritingStatus" NOT NULL DEFAULT 'RUNNING',
    "analysisData" JSONB,
    "filledProformaModelS3Key" TEXT,
    "humanReviewFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION,
    "durationMs" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnderwritingRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnderwritingRun_jobId_key" ON "UnderwritingRun"("jobId");

-- CreateIndex
CREATE INDEX "UnderwritingRun_organizationId_status_idx" ON "UnderwritingRun"("organizationId", "status");

-- CreateIndex
CREATE INDEX "UnderwritingRun_organizationId_completedAt_idx" ON "UnderwritingRun"("organizationId", "completedAt" DESC);

-- CreateIndex
CREATE INDEX "UnderwritingRun_dealId_idx" ON "UnderwritingRun"("dealId");

-- AddForeignKey
ALTER TABLE "UnderwritingRun" ADD CONSTRAINT "UnderwritingRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnderwritingRun" ADD CONSTRAINT "UnderwritingRun_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnderwritingRun" ADD CONSTRAINT "UnderwritingRun_proformaId_fkey" FOREIGN KEY ("proformaId") REFERENCES "Proforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;
