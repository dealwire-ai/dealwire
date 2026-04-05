-- CreateEnum
CREATE TYPE "UnderwritingStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PipelineType" AS ENUM ('LEGACY', 'AGENTIC');

-- CreateTable
CREATE TABLE "UnderwritingRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "emailSubject" TEXT,
    "status" "UnderwritingStatus" NOT NULL DEFAULT 'RUNNING',
    "pipelineType" "PipelineType" NOT NULL,
    "analysisData" JSONB,
    "proformaS3Key" TEXT,
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

-- AddForeignKey
ALTER TABLE "UnderwritingRun" ADD CONSTRAINT "UnderwritingRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
