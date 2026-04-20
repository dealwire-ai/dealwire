-- AlterEnum
ALTER TYPE "UnderwritingStatus" ADD VALUE 'WAITING_FOR_ASSUMPTIONS';
ALTER TYPE "UnderwritingStatus" ADD VALUE 'WAITING_FOR_CLARIFICATION';

-- CreateEnum
CREATE TYPE "UnderwritingMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "UnderwritingMessagePhase" AS ENUM ('ASK', 'CLARIFY', 'DELIVER', 'REPLY');

-- AlterTable
ALTER TABLE "UnderwritingRun" ADD COLUMN     "parentRunId" TEXT,
ADD COLUMN     "extractionSnapshot" JSONB,
ADD COLUMN     "askedAssumptions" JSONB,
ADD COLUMN     "receivedAssumptions" JSONB;

-- CreateIndex
CREATE INDEX "UnderwritingRun_parentRunId_idx" ON "UnderwritingRun"("parentRunId");

-- AddForeignKey
ALTER TABLE "UnderwritingRun" ADD CONSTRAINT "UnderwritingRun_parentRunId_fkey" FOREIGN KEY ("parentRunId") REFERENCES "UnderwritingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "UnderwritingRunMessage" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "direction" "UnderwritingMessageDirection" NOT NULL,
    "phase" "UnderwritingMessagePhase" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnderwritingRunMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnderwritingRunMessage_messageId_key" ON "UnderwritingRunMessage"("messageId");

-- CreateIndex
CREATE INDEX "UnderwritingRunMessage_runId_phase_idx" ON "UnderwritingRunMessage"("runId", "phase");

-- AddForeignKey
ALTER TABLE "UnderwritingRunMessage" ADD CONSTRAINT "UnderwritingRunMessage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "UnderwritingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
