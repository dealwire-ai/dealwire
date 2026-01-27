/*
  Warnings:

  - A unique constraint covering the columns `[normalizedAddress]` on the table `Asset` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "normalizedAddress" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Asset_normalizedAddress_key" ON "Asset"("normalizedAddress");

-- CreateIndex
CREATE INDEX "Asset_normalizedAddress_idx" ON "Asset"("normalizedAddress");
