-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "ownerEmails" JSONB,
ADD COLUMN     "ownerPhones" JSONB,
ADD COLUMN     "skipTraceQueueId" TEXT,
ADD COLUMN     "skipTraceStatus" TEXT,
ADD COLUMN     "skipTracedAt" TIMESTAMP(3);
