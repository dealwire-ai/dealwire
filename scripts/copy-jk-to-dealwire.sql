-- ============================================================
-- Copy JK Equities org data → Dealwire org
--
-- Source org: org_38GzT8lJmP5Xawh9orhrbO1yJkA  (JK Equities)
-- Target org: org_3Ap6kgg5BJHR1YA8YLxKPr6l7Kk  (Dealwire)
--
-- READ-ONLY on source: no UPDATE or DELETE on source data.
-- New IDs are generated for all copied rows.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. SCREENING BUCKETS
--    Org-scoped. Build an ID map then insert with remapped org.
-- ============================================================

CREATE TEMP TABLE bucket_id_map AS
SELECT
  id                                    AS old_id,
  'copy_' || gen_random_uuid()::text    AS new_id
FROM "ScreeningBucket"
WHERE "organizationId" = 'org_38GzT8lJmP5Xawh9orhrbO1yJkA';

INSERT INTO "ScreeningBucket" (
  id, "organizationId",
  name, description, rank, "isPass", action,
  "folderName", "generateSummary", color,
  "createdAt", "updatedAt"
)
SELECT
  m.new_id,
  'org_3Ap6kgg5BJHR1YA8YLxKPr6l7Kk',
  sb.name, sb.description, sb.rank, sb."isPass", sb.action,
  sb."folderName", sb."generateSummary", sb.color,
  now(), now()
FROM "ScreeningBucket" sb
JOIN bucket_id_map m ON sb.id = m.old_id;

-- ============================================================
-- 2. SCREENING PREFERENCES
--    Unique per org. Upsert: insert JK's prefs, or overwrite
--    Dealwire's existing row if one already exists.
-- ============================================================

INSERT INTO "ScreeningPreferences" (
  id, "organizationId",
  "companyName", "brandColor", "passedFolderName",
  "dealCriteria", "alwaysSkip",
  "digestSchedule", "digestTimeZone",
  "designatedMonitoringInboxEmails",
  "createdAt", "updatedAt"
)
SELECT
  COALESCE(
    (SELECT id FROM "ScreeningPreferences" WHERE "organizationId" = 'org_3Ap6kgg5BJHR1YA8YLxKPr6l7Kk'),
    'copy_' || gen_random_uuid()::text
  ),
  'org_3Ap6kgg5BJHR1YA8YLxKPr6l7Kk',
  sp."companyName", sp."brandColor", sp."passedFolderName",
  sp."dealCriteria", sp."alwaysSkip",
  sp."digestSchedule", sp."digestTimeZone",
  sp."designatedMonitoringInboxEmails",
  sp."createdAt", now()
FROM "ScreeningPreferences" sp
WHERE sp."organizationId" = 'org_38GzT8lJmP5Xawh9orhrbO1yJkA'
ON CONFLICT ("organizationId") DO UPDATE SET
  "companyName"                    = EXCLUDED."companyName",
  "brandColor"                     = EXCLUDED."brandColor",
  "passedFolderName"               = EXCLUDED."passedFolderName",
  "dealCriteria"                   = EXCLUDED."dealCriteria",
  "alwaysSkip"                     = EXCLUDED."alwaysSkip",
  "digestSchedule"                 = EXCLUDED."digestSchedule",
  "digestTimeZone"                 = EXCLUDED."digestTimeZone",
  "designatedMonitoringInboxEmails" = EXCLUDED."designatedMonitoringInboxEmails",
  "updatedAt"                      = now();

-- ============================================================
-- 3. PROFORMAS
--    Org-scoped Excel templates. Copy with remapped org.
-- ============================================================

INSERT INTO "Proforma" (
  id, "organizationId",
  name, "s3Key", "fieldMap",
  "isDefault", "isReady",
  "createdAt", "updatedAt"
)
SELECT
  'copy_' || gen_random_uuid()::text,
  'org_3Ap6kgg5BJHR1YA8YLxKPr6l7Kk',
  p.name, p."s3Key", p."fieldMap",
  p."isDefault", p."isReady",
  now(), now()
FROM "Proforma" p
WHERE p."organizationId" = 'org_38GzT8lJmP5Xawh9orhrbO1yJkA';

-- ============================================================
-- 4. DEALS
--    Org-scoped. Build an ID map then insert with:
--      - remapped organizationId
--      - sourceMessageId set to NULL (has a @unique constraint —
--        copying the same value would violate it)
--      - receivedByUserId remapped to user_3Ap6kSzgne1OyF4RTouNqbUvMPA
--    assetId / contactId are kept as-is (Asset and Contact are
--    not org-scoped; they're shared across orgs).
-- ============================================================

CREATE TEMP TABLE deal_id_map AS
SELECT
  id                                    AS old_id,
  'copy_' || gen_random_uuid()::text    AS new_id
FROM "Deal"
WHERE "organizationId" = 'org_38GzT8lJmP5Xawh9orhrbO1yJkA';

INSERT INTO "Deal" (
  id, "organizationId",
  "receivedByUserId",
  "sourceMessageId", "sourceFrom", "sourceSubject", "sourceReceivedAt",
  "detectionConfidence", "detectionReason", "folderMovedTo",
  "dealType", "extractedData",
  "sourceWebLink", "sourceEntryId", "extractedLinks",
  "assetId", "contactId",
  "isMuted", "mutedAt", "mutedReason",
  "createdAt", "updatedAt"
)
SELECT
  m.new_id,
  'org_3Ap6kgg5BJHR1YA8YLxKPr6l7Kk',
  'user_3Ap6kSzgne1OyF4RTouNqbUvMPA', -- receivedByUserId: mapped to Dealwire user
  NULL,   -- sourceMessageId:  cleared (unique constraint)
  d."sourceFrom", d."sourceSubject", d."sourceReceivedAt",
  d."detectionConfidence", d."detectionReason", d."folderMovedTo",
  d."dealType", d."extractedData",
  d."sourceWebLink", d."sourceEntryId", d."extractedLinks",
  d."assetId", d."contactId",
  d."isMuted", d."mutedAt", d."mutedReason",
  d."createdAt", d."updatedAt"
FROM "Deal" d
JOIN deal_id_map m ON d.id = m.old_id;

-- ============================================================
-- 5. INITIAL SCREENINGS
--    Linked to Deal. Remap dealId and screeningBucketId.
--    digestSent/digestSentAt copied as-is from source.
-- ============================================================

INSERT INTO "InitialScreening" (
  id, "dealId",
  decision, reason,
  "screeningBucketId",
  "screenedAt",
  "digestSent", "digestSentAt",
  "createdAt", "updatedAt"
)
SELECT
  'copy_' || gen_random_uuid()::text,
  dm.new_id,                    -- remapped deal ID
  s.decision, s.reason,
  bm.new_id,                    -- remapped bucket ID (NULL if bucket had no mapping)
  s."screenedAt",
  s."digestSent", s."digestSentAt",
  now(), now()
FROM "InitialScreening" s
JOIN "Deal" d          ON s."dealId"            = d.id
JOIN deal_id_map   dm  ON d.id                  = dm.old_id
LEFT JOIN bucket_id_map bm ON s."screeningBucketId" = bm.old_id
WHERE d."organizationId" = 'org_38GzT8lJmP5Xawh9orhrbO1yJkA';

-- ============================================================
-- 6. DOCUMENTS
--    Linked to Deal. Remap dealId. s3Key is kept as-is
--    (both orgs will reference the same S3 object).
-- ============================================================

INSERT INTO "Document" (
  id, "dealId",
  filename, "contentType", "sizeBytes", "s3Key",
  "createdAt"
)
SELECT
  'copy_' || gen_random_uuid()::text,
  dm.new_id,
  doc.filename, doc."contentType", doc."sizeBytes", doc."s3Key",
  now()
FROM "Document" doc
JOIN deal_id_map dm ON doc."dealId" = dm.old_id;

-- ============================================================
-- Verify row counts before committing
-- ============================================================

SELECT 'ScreeningBuckets copied' AS entity, count(*) FROM bucket_id_map
UNION ALL
SELECT 'Deals copied',           count(*) FROM deal_id_map
UNION ALL
SELECT 'ScreeningPreferences in target org after copy', count(*)
  FROM "ScreeningPreferences" WHERE "organizationId" = 'org_3Ap6kgg5BJHR1YA8YLxKPr6l7Kk'
UNION ALL
SELECT 'Proformas in target org after copy', count(*)
  FROM "Proforma" WHERE "organizationId" = 'org_3Ap6kgg5BJHR1YA8YLxKPr6l7Kk'
UNION ALL
SELECT 'Deals in target org after copy', count(*)
  FROM "Deal" WHERE "organizationId" = 'org_3Ap6kgg5BJHR1YA8YLxKPr6l7Kk'
UNION ALL
SELECT 'InitialScreenings in target org after copy', count(*)
  FROM "InitialScreening" s
  JOIN "Deal" d ON s."dealId" = d.id
  WHERE d."organizationId" = 'org_3Ap6kgg5BJHR1YA8YLxKPr6l7Kk'
UNION ALL
SELECT 'Documents in target org after copy', count(*)
  FROM "Document" doc
  JOIN "Deal" d ON doc."dealId" = d.id
  WHERE d."organizationId" = 'org_3Ap6kgg5BJHR1YA8YLxKPr6l7Kk';

-- Inspect counts, then:
--   COMMIT;   -- to apply
--   ROLLBACK; -- to abort

-- COMMIT;
