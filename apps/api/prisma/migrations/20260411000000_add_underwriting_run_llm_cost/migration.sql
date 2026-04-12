-- AlterTable
ALTER TABLE "UnderwritingRun" ADD COLUMN     "llmCostByStage" JSONB,
ADD COLUMN     "totalCompletionTokens" INTEGER,
ADD COLUMN     "totalLlmCostUsd" DECIMAL(10,6),
ADD COLUMN     "totalPromptTokens" INTEGER;
