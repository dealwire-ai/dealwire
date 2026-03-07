-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "outstandingTaxBill" DOUBLE PRECISION,
ADD COLUMN     "lienChargeAmount" DOUBLE PRECISION,
ADD COLUMN     "totalOutstandingBalance" DOUBLE PRECISION,
ADD COLUMN     "chargesSyncedAt" TIMESTAMP(3);
