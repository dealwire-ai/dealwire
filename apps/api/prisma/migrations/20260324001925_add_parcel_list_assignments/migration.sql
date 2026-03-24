-- CreateEnum
CREATE TYPE "ParcelListType" AS ENUM ('IMMEDIATE', 'LONG_TERM', 'NOT_INTERESTED');

-- CreateTable
CREATE TABLE "ParcelListAssignment" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "listType" "ParcelListType" NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParcelListAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParcelListAssignment_organizationId_listType_idx" ON "ParcelListAssignment"("organizationId", "listType");

-- CreateIndex
CREATE INDEX "ParcelListAssignment_parcelId_idx" ON "ParcelListAssignment"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelListAssignment_parcelId_organizationId_key" ON "ParcelListAssignment"("parcelId", "organizationId");

-- AddForeignKey
ALTER TABLE "ParcelListAssignment" ADD CONSTRAINT "ParcelListAssignment_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
