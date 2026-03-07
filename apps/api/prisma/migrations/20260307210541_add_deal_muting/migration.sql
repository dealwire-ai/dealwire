-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "isMuted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mutedAt" TIMESTAMP(3),
ADD COLUMN     "mutedReason" TEXT;
