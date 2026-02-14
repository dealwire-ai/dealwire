-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "HistoricalIngestion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "triggeredByUserId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "folderName" TEXT NOT NULL DEFAULT 'Inbox',
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "totalMessages" INTEGER,
    "scannedCount" INTEGER NOT NULL DEFAULT 0,
    "detectedCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "nextLink" TEXT,
    "lastProcessedMessageId" TEXT,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricalIngestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricalIngestion_organizationId_status_idx" ON "HistoricalIngestion"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "HistoricalIngestion" ADD CONSTRAINT "HistoricalIngestion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalIngestion" ADD CONSTRAINT "HistoricalIngestion_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
