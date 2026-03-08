-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "lienSaleAmount" DOUBLE PRECISION,
ADD COLUMN     "lienRedemptiveValue" DOUBLE PRECISION,
ADD COLUMN     "lienServicer" TEXT,
ADD COLUMN     "lienRedeemed" BOOLEAN,
ADD COLUMN     "lienForeclosureStatus" TEXT,
ADD COLUMN     "lienSaleDate" TEXT,
ADD COLUMN     "lienTrustVintage" TEXT,
ADD COLUMN     "lienMatchConfidence" TEXT,
ADD COLUMN     "lienMatchGroupSize" INTEGER,
ADD COLUMN     "nyctlSyncedAt" TIMESTAMP(3);
