# API Reference

**Base URL (local):** `http://localhost:3001`
**Base URL (prod):** Railway `dealwire-api` service domain
**Auth:** All endpoints require Clerk session token via `Authorization: Bearer <token>` header unless marked 🔓.
**CORS:** Restricted to `FRONTEND_URL` env var (`http://localhost:3000` locally).

---

## Core

| Method | Path                  | Auth | Description                                                    |
| ------ | --------------------- | ---- | -------------------------------------------------------------- |
| GET    | `/`                   | 🔓   | Returns `"Hello World!"` — basic liveness                      |
| GET    | `/health`             | 🔓   | Health check — used by Docker HEALTHCHECK and Railway          |
| POST   | `/dev/trigger-digest` | 🔓   | Manually trigger deal digest email (dev only). Query: `orgId?` |

---

## Deals

| Method | Path             | Auth | Description                                                                                           |
| ------ | ---------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/deals`         | ✅   | List deals for the org. Query: `page`, `limit`, `search?`, `decision?` (filter by screening decision) |
| GET    | `/deals/stats`   | ✅   | Aggregate stats for the org's deals (counts by decision, totals, etc.)                                |
| GET    | `/deals/:dealId` | ✅   | Get a single deal with full details — documents, screening, contacts, asset                           |

---

## Assets

| Method | Path               | Auth | Description                                                      |
| ------ | ------------------ | ---- | ---------------------------------------------------------------- |
| GET    | `/assets`          | ✅   | List assets for the org. Query params: `page`, `limit`, `search` |
| GET    | `/assets/:assetId` | ✅   | Get a single asset with associated deals                         |

---

## Contacts (Brokers)

| Method | Path                          | Auth | Description                                                  |
| ------ | ----------------------------- | ---- | ------------------------------------------------------------ |
| GET    | `/contacts`                   | ✅   | List contacts for the org. Query: `page`, `limit`, `search?` |
| GET    | `/contacts/stats/leaderboard` | ✅   | Broker leaderboard. Query: `limit?`, `sinceDays?`, `sortBy?` |
| GET    | `/contacts/:contactId`        | ✅   | Get a single contact with deal history                       |
| GET    | `/contacts/:contactId/stats`  | ✅   | Deal stats for a specific broker                             |

---

## Agent Chat

| Method | Path    | Auth | Description                                                                                                                                                                            |
| ------ | ------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/chat` | ✅   | Send messages to the AI agent. Body: `{ messages: CoreMessage[] }`. Returns streaming SSE response. Agent has tools: `query_parcels`, `get_parcel_stats`, `update_contact_notes`, etc. |

---

## Screening Preferences

| Method | Path                     | Auth | Description                                                                   |
| ------ | ------------------------ | ---- | ----------------------------------------------------------------------------- |
| GET    | `/screening-preferences` | ✅   | Get the org's deal screening criteria (asset types, markets, deal size, etc.) |
| PATCH  | `/screening-preferences` | ✅   | Update screening criteria. Body: partial `ScreeningPreferences` object        |

---

## Screening Buckets

| Method | Path                         | Auth | Description                                                                                                |
| ------ | ---------------------------- | ---- | ---------------------------------------------------------------------------------------------------------- |
| GET    | `/screening-buckets`         | ✅   | List all screening buckets (pipeline stages) for the org, ordered                                          |
| POST   | `/screening-buckets`         | ✅   | Create a new bucket. Body: `{ name, description, isPass, action?, folderName?, generateSummary?, color? }` |
| PATCH  | `/screening-buckets/:id`     | ✅   | Update a bucket. Body: `{ name?, description?, isPass?, action?, folderName?, generateSummary?, color? }`  |
| DELETE | `/screening-buckets/:id`     | ✅   | Delete a bucket (moves its deals to default)                                                               |
| PUT    | `/screening-buckets/reorder` | ✅   | Reorder buckets. Body: `{ bucketIds: string[] }` (ordered array of bucket IDs)                             |

---

## Feature Flags

| Method | Path             | Auth | Description                                                                                   |
| ------ | ---------------- | ---- | --------------------------------------------------------------------------------------------- |
| GET    | `/feature-flags` | ✅   | Get resolved feature flags for the current org: `{ parcels: boolean, underwriting: boolean }` |

---

## Public Data (Tax Liens / Parcels)

Gated behind the `parcels` feature flag.

| Method | Path                          | Auth | Description                                                                                                                                                                                                                                                    |
| ------ | ----------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/public-data/ingest`         | ✅   | Trigger NYC parcel data ingestion. Body: `{ boroughs?: number[], sources? }`. Default boroughs: Brooklyn (3), Queens (4)                                                                                                                                       |
| GET    | `/public-data/parcels`        | ✅   | Query parcels. Query: `page`, `limit`, `borough?`, `hasActiveLien?`, `minDistressScore?`, `maxDistressScore?`, `minUnits?`, `maxUnits?`, `zipCode?`, `search?`, `buildingClass?`, `buildingClassGroups?`, `excludeCoops?`, `excludeDClass?`, `sort?`, `order?` |
| GET    | `/public-data/parcels/export` | ✅   | Export parcels as CSV. Same query params as list endpoint. Streams CSV.                                                                                                                                                                                        |
| GET    | `/public-data/parcels/:bbl`   | ✅   | Get a single parcel by BBL (Borough-Block-Lot)                                                                                                                                                                                                                 |
| GET    | `/public-data/stats`          | ✅   | Aggregate stats: total parcels, lien counts, distress score distribution. Query: `borough?`, `excludeCoops?`                                                                                                                                                   |

---

## Underwriting

| Method | Path                         | Auth | Description                                                                           |
| ------ | ---------------------------- | ---- | ------------------------------------------------------------------------------------- |
| GET    | `/underwriting/proforma`     | ✅   | List proforma templates for the org                                                   |
| POST   | `/underwriting/proforma`     | ✅   | Upload and create proforma template. Body: `multipart/form-data` with `file` + `name` |
| PATCH  | `/underwriting/proforma/:id` | ✅   | Update a proforma. Body: partial proforma fields                                      |
| DELETE | `/underwriting/proforma/:id` | ✅   | Delete a proforma template                                                            |

---

## Historical Ingestion

| Method | Path                               | Auth | Description                                                                           |
| ------ | ---------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| POST   | `/historical-ingestion`            | ✅   | Start a historical email ingestion job. Body: `{ startDate?, endDate?, folderName? }` |
| GET    | `/historical-ingestion`            | ✅   | List all ingestion jobs for the org                                                   |
| GET    | `/historical-ingestion/:id`        | ✅   | Get a single ingestion job with progress                                              |
| POST   | `/historical-ingestion/:id/pause`  | ✅   | Pause a running ingestion job                                                         |
| POST   | `/historical-ingestion/:id/resume` | ✅   | Resume a paused ingestion job                                                         |

---

## Webhooks (Internal — not called by frontend)

| Method | Path                  | Auth | Description                                                                                             |
| ------ | --------------------- | ---- | ------------------------------------------------------------------------------------------------------- |
| POST   | `/webhooks/microsoft` | 🔓   | Microsoft Graph change notification receiver. Validates `clientState`, enqueues email processing to SQS |
| POST   | `/webhooks/clerk`     | 🔓   | Clerk user lifecycle events (user.created, organization.created, etc.). Validates Svix signature        |
| POST   | `/webhooks/resend`    | 🔓   | Resend email delivery events (delivered, bounced, complained). Validates Svix signature                 |

---

## Metrics

| Method | Path       | Auth          | Description                                                                                |
| ------ | ---------- | ------------- | ------------------------------------------------------------------------------------------ |
| GET    | `/metrics` | 🔒 Basic Auth | Prometheus metrics endpoint. Credentials: `METRICS_USERNAME` / `METRICS_PASSWORD` env vars |

---

## Notes

- All authenticated endpoints extract `organizationId` and `userId` from the Clerk session token via `ClerkAuthGuard`
- No global URL prefix — paths are as shown above
- Pagination defaults: `page=1`, `limit=20` (varies per endpoint)
- All timestamps are ISO 8601 UTC strings
- `correlationId` is included in all log entries for request tracing — echo'd back via `X-Request-ID` response header
