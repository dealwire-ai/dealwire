-- CreateTable
CREATE TABLE "ScreeningPreferences" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyName" TEXT,
    "brandColor" TEXT,
    "passedFolderName" TEXT,
    "dealCriteria" TEXT,
    "logoUrl" TEXT,
    "alwaysSkip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningPreferences_organizationId_key" ON "ScreeningPreferences"("organizationId");

-- AddForeignKey
ALTER TABLE "ScreeningPreferences" ADD CONSTRAINT "ScreeningPreferences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
