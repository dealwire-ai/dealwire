-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "careSyncedAt" TIMESTAMP(3),
ADD COLUMN     "lienRedemptionDate" TEXT,
ADD COLUMN     "lienStatus" TEXT;
