-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "avmConfidence" INTEGER,
ADD COLUMN     "avmDate" TIMESTAMP(3),
ADD COLUMN     "avmHigh" DOUBLE PRECISION,
ADD COLUMN     "avmLow" DOUBLE PRECISION,
ADD COLUMN     "avmSyncedAt" TIMESTAMP(3),
ADD COLUMN     "avmValue" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "OrgAvmLookup" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "lookedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgAvmLookup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgAvmLookup_organizationId_lookedUpAt_idx" ON "OrgAvmLookup"("organizationId", "lookedUpAt");

-- CreateIndex
CREATE INDEX "OrgAvmLookup_parcelId_idx" ON "OrgAvmLookup"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgAvmLookup_parcelId_organizationId_key" ON "OrgAvmLookup"("parcelId", "organizationId");

-- CreateIndex
CREATE INDEX "Deal_organizationId_idx" ON "Deal"("organizationId");

-- CreateIndex
CREATE INDEX "Document_dealId_idx" ON "Document"("dealId");

-- AddForeignKey
ALTER TABLE "OrgAvmLookup" ADD CONSTRAINT "OrgAvmLookup_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
