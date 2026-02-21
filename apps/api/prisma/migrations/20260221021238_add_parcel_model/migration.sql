-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL,
    "borough" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "lot" TEXT NOT NULL,
    "bbl" TEXT NOT NULL,
    "address" TEXT,
    "zipCode" TEXT,
    "buildingClass" TEXT,
    "unitsTotal" INTEGER,
    "unitsRes" INTEGER,
    "buildingArea" INTEGER,
    "lotArea" INTEGER,
    "numFloors" DOUBLE PRECISION,
    "yearBuilt" INTEGER,
    "ownerName" TEXT,
    "zoneDist1" TEXT,
    "landUse" TEXT,
    "assessTotal" DOUBLE PRECISION,
    "taxClass" TEXT,
    "estimatedMarketValue" DOUBLE PRECISION,
    "isCoopExcluded" BOOLEAN NOT NULL DEFAULT false,
    "hasActiveLien" BOOLEAN NOT NULL DEFAULT false,
    "lienCycle" TEXT,
    "waterDebtOnly" BOOLEAN NOT NULL DEFAULT false,
    "violationsTotal" INTEGER NOT NULL DEFAULT 0,
    "violationsOpen" INTEGER NOT NULL DEFAULT 0,
    "violationsClassA" INTEGER NOT NULL DEFAULT 0,
    "violationsClassB" INTEGER NOT NULL DEFAULT 0,
    "violationsClassC" INTEGER NOT NULL DEFAULT 0,
    "violationsPerUnit" DOUBLE PRECISION,
    "distressScore" DOUBLE PRECISION,
    "plutoSyncedAt" TIMESTAMP(3),
    "liensSyncedAt" TIMESTAMP(3),
    "violationsSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_bbl_key" ON "Parcel"("bbl");

-- CreateIndex
CREATE INDEX "Parcel_borough_idx" ON "Parcel"("borough");

-- CreateIndex
CREATE INDEX "Parcel_buildingClass_idx" ON "Parcel"("buildingClass");

-- CreateIndex
CREATE INDEX "Parcel_distressScore_idx" ON "Parcel"("distressScore" DESC);

-- CreateIndex
CREATE INDEX "Parcel_hasActiveLien_idx" ON "Parcel"("hasActiveLien");

-- CreateIndex
CREATE INDEX "Parcel_borough_hasActiveLien_idx" ON "Parcel"("borough", "hasActiveLien");
