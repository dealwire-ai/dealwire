-- AlterEnum
ALTER TYPE "UnderwritingMessagePhase" ADD VALUE 'ANSWER';

-- AlterTable
ALTER TABLE "UnderwritingRunMessage" ADD COLUMN     "bodyText" TEXT;

-- CreateIndex
CREATE INDEX "UnderwritingRunMessage_runId_sentAt_idx" ON "UnderwritingRunMessage"("runId", "sentAt");
