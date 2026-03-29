-- Backfill OrgSkipTrace records for all existing skip-traced parcels.
-- Grants access to every org that has the "parcels" feature flag enabled.
-- This is a one-time data migration to support the new per-org phone visibility scoping.

INSERT INTO "OrgSkipTrace" ("id", "parcelId", "organizationId", "tracedAt")
SELECT
  p."id" || '_' || o."id",
  p."id",
  o."id",
  COALESCE(p."skipTracedAt", NOW())
FROM "Parcel" p
CROSS JOIN "Organization" o
WHERE p."skipTraceStatus" = 'found'
  AND o."featureFlags"::jsonb @> '{"parcels": true}'
ON CONFLICT ("parcelId", "organizationId") DO NOTHING;
