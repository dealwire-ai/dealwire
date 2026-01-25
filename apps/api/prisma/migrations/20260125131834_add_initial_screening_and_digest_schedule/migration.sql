-- CreateTable
CREATE TABLE "InitialScreening" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "decision" "Decision" NOT NULL,
    "reason" TEXT NOT NULL,
    "screenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "digestSent" BOOLEAN NOT NULL DEFAULT false,
    "digestSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitialScreening_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InitialScreening_dealId_key" ON "InitialScreening"("dealId");

-- CreateIndex
CREATE INDEX "InitialScreening_dealId_digestSent_digestSentAt_idx" ON "InitialScreening"("dealId", "digestSent", "digestSentAt");

-- CreateIndex
CREATE INDEX "InitialScreening_dealId_digestSent_screenedAt_idx" ON "InitialScreening"("dealId", "digestSent", "screenedAt");

-- AddForeignKey
ALTER TABLE "InitialScreening" ADD CONSTRAINT "InitialScreening_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ScreeningPreferences" ADD COLUMN     "digestSchedule" TEXT,
ADD COLUMN     "digestTimeZone" TEXT DEFAULT 'America/New_York';
