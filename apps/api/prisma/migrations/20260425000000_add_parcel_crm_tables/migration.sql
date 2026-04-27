-- Parcel CRM: org-configurable pipeline (ParcelDealStage / ParcelDeal) + activity log (ParcelActivity).
-- This is the additive half of a two-step rollout. ParcelListAssignment and PhoneNote
-- remain in place; they are dropped in a follow-up migration after the new flow ships.

-- CreateEnum
CREATE TYPE "ParcelActivityType" AS ENUM ('CALL', 'NOTE', 'STAGE_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'FOLLOWUP_SCHEDULED', 'FOLLOWUP_COMPLETED', 'PHONE_STATUS_CHANGED');

-- CreateTable
CREATE TABLE "ParcelDealStage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParcelDealStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelDeal" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "assignedByUserId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "lastContactedAt" TIMESTAMP(3),
    "lastContactedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParcelDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelActivity" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "userInitials" TEXT NOT NULL,
    "type" "ParcelActivityType" NOT NULL,
    "body" TEXT,
    "phoneNumber" TEXT,
    "phoneStatus" "PhoneStatus",
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParcelDealStage_organizationId_idx" ON "ParcelDealStage"("organizationId");
CREATE UNIQUE INDEX "ParcelDealStage_organizationId_order_key" ON "ParcelDealStage"("organizationId", "order");
CREATE UNIQUE INDEX "ParcelDealStage_organizationId_name_key" ON "ParcelDealStage"("organizationId", "name");

CREATE INDEX "ParcelDeal_organizationId_stageId_idx" ON "ParcelDeal"("organizationId", "stageId");
CREATE INDEX "ParcelDeal_organizationId_assignedToUserId_idx" ON "ParcelDeal"("organizationId", "assignedToUserId");
CREATE INDEX "ParcelDeal_organizationId_nextFollowUpAt_idx" ON "ParcelDeal"("organizationId", "nextFollowUpAt");
CREATE UNIQUE INDEX "ParcelDeal_parcelId_organizationId_key" ON "ParcelDeal"("parcelId", "organizationId");

CREATE INDEX "ParcelActivity_parcelId_organizationId_occurredAt_idx" ON "ParcelActivity"("parcelId", "organizationId", "occurredAt" DESC);
CREATE INDEX "ParcelActivity_parcelId_phoneNumber_occurredAt_idx" ON "ParcelActivity"("parcelId", "phoneNumber", "occurredAt" DESC);
CREATE INDEX "ParcelActivity_organizationId_type_occurredAt_idx" ON "ParcelActivity"("organizationId", "type", "occurredAt" DESC);

-- AddForeignKey
ALTER TABLE "ParcelDealStage" ADD CONSTRAINT "ParcelDealStage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParcelDeal" ADD CONSTRAINT "ParcelDeal_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParcelDeal" ADD CONSTRAINT "ParcelDeal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParcelDeal" ADD CONSTRAINT "ParcelDeal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ParcelDealStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParcelDeal" ADD CONSTRAINT "ParcelDeal_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ParcelDeal" ADD CONSTRAINT "ParcelDeal_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ParcelDeal" ADD CONSTRAINT "ParcelDeal_lastContactedByUserId_fkey" FOREIGN KEY ("lastContactedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ParcelActivity" ADD CONSTRAINT "ParcelActivity_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParcelActivity" ADD CONSTRAINT "ParcelActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParcelActivity" ADD CONSTRAINT "ParcelActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- BACKFILL
-- ============================================

-- 1) Seed default stages for every existing org.
--    (CUIDs are generated client-side in app code; DB-side we use gen_random_uuid()-based ids
--    prefixed so they're distinguishable. Application code uses cuid() going forward — these
--    seed rows just need stable, unique IDs for FK references.)
WITH default_stages(name, ord, is_default, is_terminal, color) AS (
    VALUES
        ('Watchlist',      0, false, false, '#94a3b8'),
        ('To Call',        1, true,  false, '#3b82f6'),
        ('Attempted',      2, false, false, '#a855f7'),
        ('Contacted',      3, false, false, '#06b6d4'),
        ('Interested',     4, false, false, '#22c55e'),
        ('Negotiating',    5, false, false, '#f59e0b'),
        ('Won',            6, false, true,  '#16a34a'),
        ('Not Interested', 7, false, true,  '#6b7280')
)
INSERT INTO "ParcelDealStage" ("id", "organizationId", "name", "color", "order", "isDefault", "isTerminal", "createdAt", "updatedAt")
SELECT
    'seed_' || o.id || '_' || s.ord,
    o.id,
    s.name,
    s.color,
    s.ord,
    s.is_default,
    s.is_terminal,
    NOW(),
    NOW()
FROM "Organization" o
CROSS JOIN default_stages s;

-- 2) Backfill ParcelDeal from ParcelListAssignment.
--    IMMEDIATE -> 'To Call', LONG_TERM -> 'Watchlist', NOT_INTERESTED -> 'Not Interested'.
INSERT INTO "ParcelDeal" ("id", "parcelId", "organizationId", "stageId", "createdAt", "updatedAt")
SELECT
    'seed_' || pla.id,
    pla."parcelId",
    pla."organizationId",
    s.id,
    pla."createdAt",
    pla."updatedAt"
FROM "ParcelListAssignment" pla
JOIN "ParcelDealStage" s
  ON s."organizationId" = pla."organizationId"
 AND s."name" = CASE pla."listType"
        WHEN 'IMMEDIATE'      THEN 'To Call'
        WHEN 'LONG_TERM'      THEN 'Watchlist'
        WHEN 'NOT_INTERESTED' THEN 'Not Interested'
     END
ON CONFLICT ("parcelId", "organizationId") DO NOTHING;

-- 3) Backfill ParcelActivity from PhoneNote.
--    Each PhoneNote becomes a single PHONE_STATUS_CHANGED event carrying both the status
--    and the freeform note (if any). Latest such row per (parcel, phone) is the current sticker.
--
--    PhoneNote.userId / PhoneNote.organizationId never had FK constraints, so prod has
--    rows pointing to users that have since been deleted from Clerk (a previous deploy
--    attempt failed on this — userId FK violation). LEFT JOIN User to NULL out missing
--    userIds (preserves audit row + denormalized initials); JOIN Organization to skip
--    rows for orgs that no longer exist (defensive — none today, but cheap insurance).
INSERT INTO "ParcelActivity" (
    "id", "parcelId", "organizationId", "userId", "userInitials",
    "type", "body", "phoneNumber", "phoneStatus", "occurredAt", "createdAt"
)
SELECT
    'seed_' || pn.id,
    pn."parcelId",
    pn."organizationId",
    u.id,
    pn."userInitials",
    'PHONE_STATUS_CHANGED'::"ParcelActivityType",
    pn."note",
    pn."phoneNumber",
    pn."status",
    pn."updatedAt",
    pn."createdAt"
FROM "PhoneNote" pn
JOIN "Organization" o ON o.id = pn."organizationId"
LEFT JOIN "User" u ON u.id = pn."userId";
