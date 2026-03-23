-- CreateEnum
CREATE TYPE "PhoneStatus" AS ENUM ('GOOD', 'BAD', 'UNKNOWN');

-- CreateTable
CREATE TABLE "PhoneNote" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "PhoneStatus" NOT NULL DEFAULT 'UNKNOWN',
    "note" TEXT,
    "userId" TEXT NOT NULL,
    "userInitials" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhoneNote_parcelId_organizationId_idx" ON "PhoneNote"("parcelId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneNote_parcelId_phoneNumber_organizationId_key" ON "PhoneNote"("parcelId", "phoneNumber", "organizationId");

-- AddForeignKey
ALTER TABLE "PhoneNote" ADD CONSTRAINT "PhoneNote_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
