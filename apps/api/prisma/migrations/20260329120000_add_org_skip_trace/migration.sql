-- CreateTable
CREATE TABLE "OrgSkipTrace" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tracedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgSkipTrace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgSkipTrace_parcelId_organizationId_key" ON "OrgSkipTrace"("parcelId", "organizationId");

-- CreateIndex
CREATE INDEX "OrgSkipTrace_organizationId_tracedAt_idx" ON "OrgSkipTrace"("organizationId", "tracedAt");

-- CreateIndex
CREATE INDEX "OrgSkipTrace_parcelId_idx" ON "OrgSkipTrace"("parcelId");

-- AddForeignKey
ALTER TABLE "OrgSkipTrace" ADD CONSTRAINT "OrgSkipTrace_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
