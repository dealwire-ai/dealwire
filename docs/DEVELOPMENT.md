# Development Tips

## Local Database

The local PostgreSQL database runs at `postgresql://isaac@localhost:5432/analyzer`. No password.

### Connecting
```bash
psql "postgresql://isaac@localhost:5432/analyzer"
```

### Common Queries
```sql
-- List organizations and their feature flags
SELECT id, name, "featureFlags" FROM "Organization";

-- Enable a feature flag for an org
UPDATE "Organization" SET "featureFlags" = '{"parcels": true}' WHERE id = 'org_xxx';

-- Disable a feature flag (set key to false, or remove the column value)
UPDATE "Organization" SET "featureFlags" = '{"parcels": false}' WHERE id = 'org_xxx';

-- Check users and their orgs
SELECT id, email, "organizationId" FROM "User";

-- Count parcels by borough
SELECT borough, COUNT(*) FROM "Parcel" GROUP BY borough;

-- Check deal counts
SELECT COUNT(*) FROM "Deal";
```

### Feature Flags

Org-level feature flags are stored as JSON on `Organization.featureFlags`. The app layer merges DB values with defaults defined in `apps/api/src/util/feature-flags.ts`.

- All flags default to `false` — a `null` or missing key means off
- To add a new flag: add it to the `FeatureFlags` interface in `feature-flags.ts` with a `false` default. No migration needed.
- Current flags: `parcels` (NYC parcel data UI + API)

### Migrations

- **Local**: `cd apps/api && npx prisma migrate dev`
- **Prod**: Must use the **direct** Supabase URL (port 5432, no pgbouncer). Run from `apps/api`:
  ```bash
  DATABASE_URL="postgresql://postgres.icujkrafywivakbfrerg:<PASSWORD>@aws-1-us-east-1.pooler.supabase.com:5432/postgres" \
  DIRECT_URL="postgresql://postgres.icujkrafywivakbfrerg:<PASSWORD>@aws-1-us-east-1.pooler.supabase.com:5432/postgres" \
  pnpm db:migrate:prod
  ```
  **Never** use the pooler URL (port 6543) for migrations — it will hang.

### Prisma Studio (GUI)

```bash
cd apps/api && npx prisma studio
```
Opens a browser UI at `http://localhost:5555` for browsing/editing data.

## Tax Lien / Parcel Data

### Triggering Ingestion

Ingestion is triggered via `POST /public-data/ingest`. The endpoint is async — it returns immediately and runs the pipeline in the background (~5 minutes for BK+QN).

**Local (dev mode, no auth required):**
```bash
curl -X POST http://localhost:3001/public-data/ingest \
  -H 'Content-Type: application/json' \
  -d '{"boroughs": ["3", "4"]}'
```

**Production (requires Clerk JWT):**
1. Sign in at `deals.frontstep.ai`
2. Open browser console, run: `await window.Clerk.session.getToken()`
3. Copy the token (expires in 60 seconds) and immediately run:
```bash
curl -X POST https://analyzer-api-production.up.railway.app/public-data/ingest \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{"boroughs": ["3", "4"]}'
```

The org must have the `parcels` feature flag enabled. Borough codes: 1=Manhattan, 2=Bronx, 3=Brooklyn, 4=Queens, 5=Staten Island.

### Pipeline Stages

1. **Tax liens** (~3K records, ~60s) — Fetches latest cycle from lien sale list, creates/updates `Parcel` rows
2. **PLUTO enrichment** (~2.5K records, ~50s) — Enriches existing parcels with property data (building class, units, sqft, owner, assessed value)
3. **HPD violations** (~100K violations, ~110s) — Aggregates violation counts per parcel (total, open, by class A/B/C)
4. **Distress scoring** (~3K records, ~60s) — Computes 0-100 score based on lien status, violations per unit, class C violations

### Parcel Queries
```sql
-- Count parcels by borough
SELECT borough, COUNT(*) FROM "Parcel" GROUP BY borough;

-- Average distress score by borough
SELECT borough, ROUND(AVG("distressScore")::numeric, 1) as avg_score FROM "Parcel" GROUP BY borough;

-- Top distressed parcels
SELECT bbl, address, borough, "distressScore", "violationsOpen", "unitsTotal"
FROM "Parcel" WHERE "distressScore" IS NOT NULL
ORDER BY "distressScore" DESC LIMIT 20;

-- Clear all parcel data (for re-ingestion)
DELETE FROM "Parcel";
```

## Troubleshooting

1. **Testing email flow (E2E)**: Send a test deal email to a monitored Outlook inbox to trigger the full pipeline:
   ```bash
   cd apps/api && pnpm send-test-email imlevine@outlook.com
   ```
   This sends a realistic deal email via Resend → arrives in Outlook → Graph webhook fires → deal detection → screening → reply. Watch Railway logs or local server output. The verified Resend sending domain is `mail.deals.frontstep.ai`.
2. **Preferences not loading?**: Check snake_case vs camelCase mapping
3. **Subscription not working?**: Verify `API_BASE_URL` is HTTPS
4. **Replies not threaded?**: Must use Graph API's `createReply` endpoint
5. **API won't start?**: SQS is disabled by default in dev. No AWS credentials needed locally.
6. **Testing auth locally**: Use curl without token (allowed in dev), or set `REQUIRE_AUTH=true` to test full flow
7. **CORS issues?**: Verify `FRONTEND_URL` in API .env matches your frontend origin
