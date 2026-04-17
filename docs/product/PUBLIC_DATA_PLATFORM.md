# Public Data Platform

Architecture and planning doc for ingesting public property data from municipal, county, and federal sources. This system enables property data enrichment, tax lien opportunity identification, zoning/development analysis, and market intelligence — starting with NYC and expanding city by city.

## Problem

Public real estate data (tax liens, zoning, permits, assessments, deed transfers) is scattered across thousands of municipal/county sources, each with different formats, APIs, and access methods. We need an abstraction layer that makes adding each new jurisdiction faster than the last.

## How Public Data Presents Itself

### Five Adapter Types (in priority order)

Most US property data is accessible without scraping. The access pattern hierarchy, from cleanest to most brittle:

| Priority | Adapter Type           | Coverage                                           | API Pattern                                                        | Examples                                                                           |
| -------- | ---------------------- | -------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **1**    | **Socrata (SODA API)** | City/county open data portals                      | `GET /resource/{id}.json?$where=...&$limit=50000&$offset=0`        | NYC, Chicago, SF, LA County, Cook County, **CT (all 169 towns)**, NY State, MD, CO |
| **2**    | **ArcGIS REST**        | GIS/parcel/zoning maps (~80% of US municipalities) | `GET /FeatureServer/{layer}/query?where=1=1&outFields=*&f=geojson` | Most cities' zoning, parcels, flood zones; **MA MassGIS statewide parcels**        |
| **3**    | **Bulk file download** | State DOT/DOA bulk exports                         | Direct HTTP download (CSV, shapefile, GeoJSON)                     | FL statewide parcel export, many state DOT shapefiles                              |
| **4**    | **SFTP / FTP**         | County data feeds                                  | File transfer                                                      | Some county assessors publish quarterly CSV drops                                  |
| **5**    | **Playwright scraper** | Last resort — CAMA web portals                     | HTML parsing, browser automation                                   | Individual assessor lookups (Tyler iasWorld, VGSI portals)                         |

### CAMA Vendor Landscape

Most US counties run their assessment data on commercial **CAMA (Computer-Assisted Mass Appraisal)** software. Understanding the vendor landscape explains why so much data sits behind web portals — these vendors don't expose public APIs.

| Vendor                                 | Market Share | Portal Style                                               | Access Path                                |
| -------------------------------------- | ------------ | ---------------------------------------------------------- | ------------------------------------------ |
| **Tyler Technologies (iasWorld)**      | ~40%         | Web portal, no public API                                  | State aggregators, ArcGIS exports          |
| **Vision Government Solutions (VGSI)** | ~20%         | Per-town web portal (e.g. `gis.vgsi.com/web/WestHartford`) | State aggregator (if available) or scraper |
| **BS&A Software**                      | ~15%         | Web portal                                                 | ArcGIS layers often published separately   |
| **Patriot Properties**                 | ~10%         | Web portal                                                 | State aggregator preferred                 |
| **Harris Govern (PACS)**               | ~8%          | Web portal                                                 | State aggregator preferred                 |
| **Vanguard CAMAvision**                | ~5%          | Web portal                                                 | State aggregator preferred                 |

**Key insight**: For any given county running Tyler or VGSI, the better access path is almost always a **state-level aggregator** that normalizes the data across all counties. Only fall back to scraping the CAMA portal if no state portal exists.

### State-Level Aggregators (Free Government Sources)

Many states publish normalized statewide parcel data, bypassing CAMA vendors entirely. This is the best path for covering entire states in one adapter config:

| State              | Platform                          | Dataset / URL                          | Notes                                                                      |
| ------------------ | --------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| **Connecticut**    | Socrata (`data.ct.gov`)           | `pqrn-qghw`                            | All 169 towns including West Hartford. Same `SodaAdapter` — zero new code. |
| **New York State** | Socrata (`data.ny.gov`)           | `xkwy-kqbc`                            | Statewide assessment roll. Complements NYC PLUTO.                          |
| **Maryland**       | Socrata (`opendata.maryland.gov`) | SDAT dataset                           | Statewide assessments.                                                     |
| **Colorado**       | Socrata (`data.colorado.gov`)     | Per-county datasets                    | County-by-county, many on Socrata.                                         |
| **Massachusetts**  | ArcGIS REST                       | MassGIS Level 3 Parcels FeatureService | Statewide, quarterly updates. ~3.5M parcels.                               |
| **Florida**        | ArcGIS + bulk CSV                 | DOR parcel data + county ArcGIS        | Statewide CSV download + ArcGIS for boundaries.                            |
| **New Jersey**     | State MOD-IV                      | Annual CSV via NJ Division of Taxation | Free bulk download, all 566 municipalities.                                |
| **North Carolina** | ArcGIS REST                       | NC OneMap FeatureService               | Statewide parcel layer.                                                    |
| **Washington**     | ArcGIS REST                       | WA Dept. of Revenue parcels            | Statewide.                                                                 |
| **Oregon**         | ArcGIS REST                       | ORMAP statewide parcel layer           | Statewide.                                                                 |
| **Virginia**       | ArcGIS REST                       | VITA statewide parcel fabric           | Statewide.                                                                 |
| **Wisconsin**      | ArcGIS REST                       | Wisconsin Parcel Initiative            | Statewide.                                                                 |

**Rule of thumb**: Before writing a scraper for any county, check if the state publishes a statewide aggregator. For Socrata states (CT, NY, MD, CO) this means literally zero new code — just a new `SourceConfig` record pointing to the dataset ID.

### ArcGIS REST API — Technical Reference

ArcGIS is the dominant municipal GIS platform (~80% of US municipalities). The REST API pattern is standard across all deployments but has important pagination gotchas:

```
# Standard query pattern
GET {serviceUrl}/FeatureServer/{layerId}/query
  ?where=1=1
  &outFields=*
  &resultOffset=0
  &resultRecordCount=1000
  &orderByFields=OBJECTID         ← REQUIRED for stable pagination
  &f=geojson                      ← or f=json for raw Esri JSON

# Pagination: use exceededTransferLimit flag, NOT features.length === pageSize
# The response includes:
{
  "features": [...],
  "exceededTransferLimit": true   ← present and true when more pages remain
                                  ← absent or false on the last page
}
```

**Critical gotchas:**

- **Use `exceededTransferLimit`** to detect end of results — not comparing `features.length === pageSize`. Some services return fewer than `resultRecordCount` records on intermediate pages (not just the last one), causing premature termination if you use length comparison.
- **Always include `orderByFields: OBJECTID`** to guarantee stable pagination. Without a stable sort, records can shift between pages as data changes.
- **Max `resultRecordCount`** varies by server — some cap at 1000, others allow 10000. Discover via `GET /FeatureServer/{layerId}?f=json` → `maxRecordCount` field.
- **Spatial queries** use `geometryType=esriGeometryEnvelope&geometry={xmin,ymin,xmax,ymax}&spatialRel=esriSpatialRelIntersects` — useful for bounding box filtering.

### Data Types (most → least accessible)

1. **Tax lien/delinquency** — NYC publishes via SODA. Other cities vary.
2. **Property assessments** — County assessor portals or open data. Assessed value, property characteristics, ownership, tax amounts.
3. **Deed/transfer records** — County clerk/recorder offices. 13 states are "non-disclosure" (sale prices not public).
4. **Zoning** — ArcGIS polygon layers. GIS gives zone code; development parameters (FAR, height, setbacks) usually require separate ordinance lookup. NYC PLUTO is uniquely rich.
5. **Building permits** — Open data portals (Socrata) or Accela/EnerGov systems.
6. **Code violations / foreclosures** — 311 systems, court records. Hardest to access.

### Federal Sources (enrichment layers)

| Source            | What                                                 | Access                                     |
| ----------------- | ---------------------------------------------------- | ------------------------------------------ |
| Census ACS        | Demographics, income, housing                        | `api.census.gov` — free API key            |
| FEMA NFHL         | Flood zones                                          | ArcGIS REST services at `hazards.fema.gov` |
| EPA Envirofacts   | Environmental contamination, brownfields             | REST API                                   |
| HUD               | Fair market rents, subsidized housing, vacancy rates | API at huduser.gov                         |
| Opportunity Zones | QOZ Census tract designations                        | CSV/shapefile from CDFI Fund               |

### Commercial Aggregators (gap-filling, not primary)

Only consider these after exhausting free government sources. They're expensive and create vendor dependency.

| Provider      | Coverage                                                     | Cost                               | When to Use                                                                                             |
| ------------- | ------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Regrid**    | 159M parcels, 3,229 counties, standardized schema            | $2-50K/yr; **30-day free sandbox** | Best first choice for gap-filling — standardized schema, REST API, good for parcel spine across sources |
| **ATTOM**     | 158M properties, 9,000 attributes, deed chains, foreclosures | $10-100K/yr                        | Deep enrichment where free sources don't reach; AVM, pre-foreclosure signals                            |
| **Reonomy**   | CRE ownership, LLC piercing, debt data                       | $10-50K/yr                         | Owner identification behind entities; CRE-specific                                                      |
| **CoreLogic** | Deep mortgage/lien/MLS data                                  | $100K+/yr                          | Enterprise-grade, overkill for Phase 1-2                                                                |
| ~~ZTRAX~~     | ~~Zillow transaction data~~                                  | ~~Discontinued 2023~~              | ~~No longer available~~                                                                                 |

**Regrid recommendation**: Start here for any jurisdiction not covered by free state portals. Their `parcel` API returns standardized fields (`ll_uuid`, `parcelnumb`, `owner`, `address`, `zoning`, `parval`) across all 3,229 counties — the same field names regardless of the source county. The 30-day free sandbox is enough to validate a new market before committing.

---

## NYC Data Sources (First Target)

NYC has the best public data infrastructure of any US city. All accessible via SODA API — no auth, JSON, SoQL filtering.

### Tax Liens & Delinquency

| Dataset                      | Socrata ID  | What It Contains                                                                   | Key Fields                                                                     |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Tax Lien Sale Lists**      | `9rz4-mjek` | Properties eligible for upcoming lien sale                                         | borough, block, lot, tax_class_code, building_class, zip_code, water_debt_only |
| **Property Charges Balance** | `scjx-j6np` | Outstanding tax balances per property (28 fields) — best "distress signal" dataset | parid (BBL), sum_liab, sum_coll, sum_bal, due_date, taxyear                    |

### Property Records (ACRIS)

All recorded documents — deeds, federal liens, lis pendens, UCC filings, mechanic's liens.

| Dataset                | Socrata ID  | Purpose                                            |
| ---------------------- | ----------- | -------------------------------------------------- |
| Real Property Master   | `bnx9-e6tj` | Document index (type, date, amount, parties)       |
| Real Property Legals   | `8h5j-fqxa` | BBL linkage for each document                      |
| Real Property Parties  | `636b-3b5g` | Grantor/grantee names                              |
| Document Control Codes | `7isb-wh4c` | Decode document type codes (29 lien-related types) |
| Property Types Codes   | `94g4-w6xz` | Property type classification                       |

Lien-related document codes: `FL` (federal lien), `FTL` (federal tax lien), `NTXL` (estate tax lien), `UCC1`/`UCC3`, lis pendens, mechanic's liens, satisfactions.

### Property & Zoning (PLUTO/MapPLUTO)

The gold standard — 90+ fields per tax lot including zoning, FAR, building characteristics, assessed values.

- **NYC Open Data (Socrata)**: `64uk-42ks`
- **ArcGIS endpoint**: `https://a841-dotweb01.nyc.gov/arcgis/rest/services/GAZETTEER/MapPLUTO/MapServer/0`

Key PLUTO fields: `ZoneDist1`-`ZoneDist4`, `ResidFAR`, `CommFAR`, `FacilFAR`, `LandUse`, `BldgClass`, `NumFloors`, `UnitsTotal`, `LotArea`, `BldgArea`, `AssessTot`, `YearBuilt`, `OwnerName`, `Address`, `Borough`, `Block`, `Lot`.

### Other NYC Sources

- **DOF Property Tax Portal** (nyc.gov/finance property tax page) — individual property tax bill lookup. No API, requires scraping or PDF extraction.
- **ZoLa** (`zola.planning.nyc.gov`) — Zoning & Land Use app. PostGIS/Carto backend (not ArcGIS). GitHub: `NYCPlanning/labs-zola`.
- **NYC Zoning API**: `github.com/NYCPlanning/ae-zoning-api` — dedicated API with OpenAPI docs.
- **Property Valuation and Assessment Data**: Socrata `8y4t-faws` — assessed/market values, exemptions.

### SODA API Quick Reference

```
# Base pattern
GET https://data.cityofnewyork.us/resource/{dataset-id}.json

# With filtering (SoQL)
?$where=borough='3' AND water_debt_only='NO'
&$select=borough,block,lot,zip_code
&$order=zip_code ASC
&$limit=1000
&$offset=0

# Max 50,000 rows per request. Paginate with $offset.
# App token (free, optional) raises rate limit from 60 req/hr to ~10K+/hr.
# Register at: https://data.cityofnewyork.us/profile/edit/developer_settings
```

---

## Architecture

### Adapter Pattern

The core abstraction. Every data source, regardless of how it works, implements the same interface. The rest of the pipeline (normalization, storage, monitoring) doesn't know or care where the data came from.

```
Source Config (DB)              Adapter Layer              Pipeline
┌──────────────────┐    ┌─────────────────────┐    ┌────────────────────┐
│ source: nyc-liens│───>│ SodaAdapter         │───>│ Field Mapper       │
│ type: soda       │    │ (generic, reusable) │    │ (source→canonical) │
│ dataset: 9rz4... │    └─────────────────────┘    ├────────────────────┤
│ fieldMap: {...}  │    ┌─────────────────────┐    │ Address Standardize│
│ schedule: weekly │    │ ArcGisAdapter       │    ├────────────────────┤
└──────────────────┘    │ (generic, reusable) │    │ Quality Validator  │
                        └─────────────────────┘    ├────────────────────┤
                        ┌─────────────────────┐    │ Raw Storage (JSONB)│
                        │ ScraperAdapter      │    ├────────────────────┤
                        │ (Playwright, custom)│    │ Canonical Storage  │
                        └─────────────────────┘    └────────────────────┘
```

#### Adapter Interface

```typescript
interface DataAdapter {
  fetch(config: SourceConfig): AsyncGenerator<RawRecord[]>;
  testConnection(config: SourceConfig): Promise<boolean>;
}
```

Every adapter — SODA, ArcGIS, Playwright scraper, PDF extractor — implements these two methods. `fetch` yields pages of raw records; `testConnection` validates config before scheduling.

#### Generic vs Custom Adapters

**Generic adapters** (written once, configured per-source):

- `SodaAdapter` ✅ built — any Socrata dataset. Config: base URL, dataset ID, SoQL filter.
- `ArcGisAdapter` — any ArcGIS FeatureServer/MapServer layer. Config: service URL, layer ID, spatial/attribute filters. See ArcGIS technical reference above for pagination pattern.
- `BulkFileAdapter` — CSV/shapefile downloads. Config: download URL, file format, column mapping.
- `SftpAdapter` — SFTP/FTP file drops. Config: host, credentials, remote path, file format.

**Custom adapters** (bespoke code per source):

- Extend a base class, override fetch logic for sources that need browser automation, multi-step auth, or unusual pagination.
- Still implement the same interface, so the pipeline doesn't change.

**Resilience**: Each adapter should have a per-adapter retry + circuit breaker policy. Use [Cockatiel](https://github.com/connor4312/cockatiel) (TypeScript) for configurable retry/circuit-breaker/timeout — attach the policy to each `SourceConfig` record so aggressive sources get conservative policies without affecting others.

#### Source Configuration

Each source is a DB record (or config file) that specifies which generic adapter to use and how:

```typescript
interface SourceConfig {
  id: string; // 'nyc-tax-liens'
  name: string; // 'NYC Tax Lien Sale Lists'
  adapterType: "soda" | "arcgis" | "scraper" | "bulk_file" | "custom";
  jurisdiction: string; // FIPS code or 'nyc', 'cook-county', etc.

  // Adapter-specific config
  connection: {
    baseUrl: string; // API endpoint
    datasetId?: string; // Socrata dataset ID
    layerId?: number; // ArcGIS layer number
    filter?: string; // SoQL or SQL WHERE clause
    appToken?: string; // Socrata app token
  };

  // How source fields map to canonical schema
  fieldMap: Record<string, string | FieldTransform>;

  // Schedule
  schedule: string; // cron expression
  refreshType: "full" | "incremental";
  incrementalField?: string; // field to use for incremental (e.g., 'modified_date')

  // Monitoring
  expectedRecordCount?: number; // alert if actual deviates >50%
  stalenessThreshold?: string; // alert if no successful run in this window
}
```

Adding a new source on a known platform = creating a new config record. No deploy needed. **This is why adding each city gets faster** — the adapters already exist, you're just plugging in new URLs and field maps.

### Storage: Two-Layer PostgreSQL

#### Layer 1: Raw (append-only)

Every response stored exactly as received. Never modified. Enables re-processing if normalization logic changes.

```
raw_ingestion
├── id (UUID)
├── source_id → data_source
├── fetched_at (TIMESTAMPTZ)
├── raw_data (JSONB) — exact API/scrape response
├── record_hash (TEXT) — SHA256 for dedup
├── metadata (JSONB) — HTTP status, page number, duration
```

#### Layer 2: Canonical (normalized)

Typed columns for queryable fields + JSONB for everything else. Property keyed by `fips_code + parcel_id` for national uniqueness.

```
property (canonical golden record)
├── id (UUID)
├── fips_code (TEXT) — county identifier
├── parcel_id (TEXT) — normalized APN
├── address (JSONB) — standardized components
├── location (GEOGRAPHY POINT) — PostGIS
├── UNIQUE(fips_code, parcel_id)

property_assessment[]     — from assessor data
property_transaction[]    — from recorder/deed data
property_zoning[]         — from GIS/planning data
property_permit[]         — from building dept data
property_tax_lien[]       — from tax collector data
property_violation[]      — from code enforcement

Each sub-table:
├── property_id → property
├── source_id → data_source
├── normalized fields (typed columns)
├── raw_data (JSONB) — original source record preserved
├── valid_from / valid_to (SCD Type 2 for change tracking)
```

### Schema Normalization Challenge

**The hardest part of the entire system.** Every jurisdiction uses different:

- Property type codes ("MULTI-FAMILY RESIDENTIAL" vs "APT 5+" vs code "1040")
- Address formats ("123 N Main St Apt 4" vs "123 North Main Street #4")
- Parcel ID formats (dashes, dots, zero-padding, book/page)
- Field names (`bldg_sf` vs `gross_area` vs `living_area`)
- Value semantics ("assessed value" means different things in different states)

The `fieldMap` in the source config handles field renaming. Complex transforms (unit conversion, code translation, address parsing) run in the normalization pipeline using per-source transform functions.

Address standardization: libpostal (local, fast) for parsing → Smarty (API) for USPS standardization + geocoding.

Parcel ID normalization: strip formatting, apply jurisdiction-specific rules (stored in config).

#### Universal Parcel Key

**BBL is NYC-specific.** Outside NYC, the canonical property key is:

```
fips_code (5-digit county FIPS) + normalizedApn (strip all formatting)
```

- `fips_code`: Federal FIPS county code. Unambiguously identifies a county anywhere in the US. Example: `09003` = Hartford County CT, `36047` = Kings County (Brooklyn) NY.
- `normalizedApn`: The Assessor's Parcel Number stripped of all separators. `123-45-678` → `12345678`. Each county has its own APN format; normalization rules live in `SourceConfig`.

This composite key enables cross-source joins (e.g. matching a Regrid parcel to a state aggregator record) without a shared ID. Store it as `UNIQUE(fips_code, parcel_id)` on the canonical `property` table.

**[Placekey](https://www.placekey.io/)** (open standard) is an alternative for POI-heavy use cases but is less useful for raw land parcels.

### Orchestration

**Phase 1 (current)**: In-process pipeline (lien list → PLUTO → HPD → charges → scoring → optional NYCTL → optional CARE), typically 5-30 min depending on borough scope. Two trigger paths:

- **Manual:** `POST /public-data/ingest` with optional `boroughs` body. Default boroughs: `['1', '3', '4']` (Manhattan + Brooklyn + Queens). Returns immediately; ingestion runs as an unawaited Promise.
- **Scheduled:** `PublicDataSchedulerService` runs `@Cron(PUBLIC_DATA_REFRESH_CRON)` — default `0 3 * * 0` (**Sunday 3am UTC** = Saturday 11pm EDT / 10pm EST). Gated by `PUBLIC_DATA_AUTO_REFRESH_ENABLED=true`. Hardcoded boroughs `['1', '3', '4']`. Skips if `isRunning`. **Currently enabled in prod**, off locally by default.

#### What each source actually fetches

The pipeline is **not** a rolling window — each source has its own freshness model. Re-running weekly does not pull "the last week of data." It pulls:

| Source                                     | Date window                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tax lien sale list (`9rz4-mjek`)**       | **Latest cycle only.** `ingestTaxLiens()` runs `$order: 'month DESC', $limit: 1` first to find the newest `month` value, then fetches all parcels from that single cycle. The `month` field is the lien sale cycle date — NYC publishes ~annually (sometimes after multi-year gaps; 2017-2020 had no sale). Re-running between cycles produces no new parcels. Parcels from prior cycles persist in `Parcel` but `liensSyncedAt` won't update for them. |
| **PLUTO (`64uk-42ks`)**                    | Snapshot — current attributes for every BBL that came in from the lien cycle above. No date filter.                                                                                                                                                                                                                                                                                                                                                     |
| **HPD violations (`wvxf-dwi5`)**           | **Full history** per parcel (no date filter). Aggregated into open/closed totals + class A/B/C counts. Queried in batches of 50 block+lot pairs to avoid pulling 5M+ records per borough.                                                                                                                                                                                                                                                               |
| **Property Charges Balance (`scjx-j6np`)** | Current balance snapshot per parcel.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **NYCTL quarterly (XLSX)**                 | One-shot — only runs if `NYCTL_REPORT_DATE` env var is set, fetches that exact quarterly report.                                                                                                                                                                                                                                                                                                                                                        |
| **CARE portal scraper**                    | Scrapes per-BBL lien details for all active-lien BBLs in `Parcel`. No date window — current state.                                                                                                                                                                                                                                                                                                                                                      |

**Bottom line:** the platform tracks "the active cohort of distressed properties from NYC's most recent lien sale list." When NYC publishes a new cycle, the next scheduled run picks up the new cohort and creates new Parcel rows. Old parcels from prior cycles stay in the DB indefinitely.

#### Operational reality (and why Phase 2 matters)

- **In-memory concurrency lock.** `NycIngestionService` and `CareScraperService` each have a private `running = false` flag. A second trigger while one is in flight returns HTTP 409 ("already running"). The flag is per-process, so two API replicas could each start one simultaneously.
- **Server restart kills the run.** The ingestion is just an in-process Promise — there is no queue, no checkpointing, no resumption. A Railway redeploy mid-ingestion stops the work where it stands. Already-upserted rows persist; everything not yet processed is simply lost. **Avoid triggering ingestion right before any deploy.**
- **Stale `IngestionRun` rows block retries.** Each run inserts an `IngestionRun` row with `status: 'running'`, transitioned to `success`/`failed` only by the `finally` blocks in `ingestAll()`. If the process dies before that runs, the row stays at `status: 'running'` forever and the next manual trigger is rejected with "Ingestion is already running" by the in-memory lock as soon as the same server restarts. **Recovery:** update the stuck `IngestionRun` row to `status: 'failed'` via Prisma (DB write — no raw SQL) before re-triggering. The in-memory lock resets on its own when the process restarts; the DB row does not.
- **No retry/backoff.** A transient SODA timeout in the middle of the PLUTO loop fails the whole run. Re-trigger by hand.
- **Notifications.** On completion or failure, `notifyIngestionComplete`/`notifyIngestionFailed` emails admins. If the process dies, no notification fires.

Pre-deploy checklist: `GET /public-data/ingestion-runs` (or check `IngestionRun` table) — if anything is `status: 'running'`, hold the deploy or accept that it'll die.

**Env vars governing schedule:**

| Var                                | Default     | Purpose                                                               |
| ---------------------------------- | ----------- | --------------------------------------------------------------------- |
| `PUBLIC_DATA_AUTO_REFRESH_ENABLED` | `false`     | Master switch for the cron. Must be `"true"` (string) to enable.      |
| `PUBLIC_DATA_REFRESH_CRON`         | `0 3 * * 0` | Cron expression. Default = Sunday 3am UTC.                            |
| `NYCTL_REPORT_DATE`                | (unset)     | If set (e.g. `9-30-2025`), full ingest also runs NYCTL for that date. |

**Phase 2+**: BullMQ job queue (already in NestJS ecosystem via `@nestjs/bullmq`). Each source = a repeatable job with its own cron schedule. Benefits over NestJS `@Cron`:

- Jobs survive server restarts (persisted in Redis)
- Automatic retry with exponential backoff
- Concurrency control (don't run 50 sources simultaneously)
- Job history, duration tracking, failure logging
- Dynamic scheduling (add/change sources without redeploying)
- Dashboard via `bull-board`
- Manual trigger + scheduled trigger + event trigger all use same queue

### Monitoring & Quality

Per-source tracking:

- Last successful run, last run status, duration
- Record count vs expected (alert on >50% deviation)
- Staleness detection (no successful run in N days)
- Schema drift detection (new/removed fields in source response)
- Data quality score (% null in required fields, out-of-range values, duplicates)

---

## Implementation Phases

### Phase 1: NYC Deep (prove the adapter model)

**Goal**: Build the adapter framework, ingest NYC data, validate with a real user.

**Status: COMPLETE** — Shipped Feb 2026. Simplified approach vs original plan (see notes below).

- [x] Build `SodaAdapter` (generic Socrata client with pagination, app token support)
- [x] Create NYC source configs for 3 datasets:
  - Tax Lien Sale Lists (`9rz4-mjek`)
  - PLUTO via Socrata (`64uk-42ks`)
  - HPD Violations (`wvxf-dwi5`)
- [x] `Parcel` Prisma model — denormalized single table per BBL with PLUTO fields, lien status, violation aggregates, and distress score
- [x] Lien-first ingestion: start from lien list (~3K BBLs for BK+QN), enrich only those with PLUTO + HPD
- [x] Distress scoring engine (0-100, weighted: active lien +30, violations/unit up to +40, class C up to +20, class B up to +10)
- [x] API: `POST /public-data/ingest` (async, fire-and-forget), `GET /public-data/parcels` (filtered/paginated), `GET /public-data/parcels/export` (CSV), `GET /public-data/stats`, `GET /public-data/parcels/:bbl`
- [x] Frontend: filterable parcel table at `/public-data/parcels` with score badges, expandable rows, CSV export
- [x] Agent tools: `query_parcels`, `get_parcel_stats`
- [x] Feature flag: `parcels` (org-level, off by default)

**What was deferred to Phase 2:**

- `DataSource` / `RawIngestion` DB models (source registry) — used hardcoded TS constants instead
- `ArcGisAdapter` — not needed for Phase 1 datasets (all Socrata)
- Raw JSONB storage / record hashing — data goes directly to `Parcel` table
- Property Charges Balance dataset (`scjx-j6np`) — lien list + violations sufficient for scoring
- Address standardization — BBL is the join key, addresses come from PLUTO
- Individual violation records — only aggregates stored (total, open, by class)

**SODA API lessons learned:**

- Tax lien dataset has years of historical data. Must filter by `month` field (query `$order: 'month DESC', $limit: 1` first) to get only the latest cycle
- PLUTO stores BBL as a float (`3001850041.00000000`). String comparison fails. Use numeric comparison: `bbl=3001850041 OR bbl=...`
- HPD violations has 5M+ records per borough. Must batch-query by specific block+lot pairs (50 per request), not fetch entire borough
- Borough codes differ across datasets: Tax Liens uses numeric ("1"-"5"), PLUTO uses abbreviations ("MN","BX","BK","QN","SI"), HPD uses numeric `boroid`

### Phase 2: Normalize & Enrich

- [ ] `DataSource` / `RawIngestion` models — source registry with config-driven ingestion
- [ ] `ArcGisAdapter` (generic, handles any ArcGIS FeatureServer — use `exceededTransferLimit` for pagination, require `orderByFields=OBJECTID`)
- [ ] `BulkFileAdapter` (CSV/shapefile downloads via HTTP — for FL, NJ MOD-IV, etc.)
- [ ] Property Charges Balance (`scjx-j6np`) — outstanding balances + lien charge amounts. **Researched 3/7:** 109M rows, quarterly updates, `CHG` = tax bills, `SAC` = lien charges, `sum_bal` = current balance. Validated against Daniel's example ($8,530.35). See `3_7_WEEKEND_PLAN.md`.
- [ ] Address standardization (Smarty or libpostal integration)
- [ ] Add ACRIS data (transactions, recorded liens) — joins across 3 Socrata datasets
- [ ] Data quality validation pipeline
- [ ] BullMQ scheduling for automated refresh
- [ ] Monitoring dashboard (or at least logging/alerting)

### Phase 3: Multi-Jurisdiction

New jurisdictions are roughly ordered by effort: **Socrata states first** (zero new adapter code — just a new SourceConfig), then **ArcGIS states**, then bulk file, then scrapers last.

**Quick wins (Socrata — same SodaAdapter, new config only):**

- [ ] Connecticut (`data.ct.gov`, dataset `pqrn-qghw`) — all 169 towns including West Hartford, Hartford County
- [ ] New York State (`data.ny.gov`, dataset `xkwy-kqbc`) — statewide assessment roll
- [ ] Chicago (`data.cityofchicago.org`) — Cook County + city datasets
- [ ] Maryland (`opendata.maryland.gov`) — SDAT statewide assessments

**ArcGIS states (need ArcGisAdapter, then config-only per county):**

- [ ] Massachusetts (MassGIS Level 3 FeatureService — ~3.5M statewide parcels)
- [ ] Miami-Dade (county ArcGIS FeatureServer)
- [ ] North Carolina (NC OneMap statewide parcel layer)

**Other:**

- [ ] Source registry CRUD API + frontend config UI
- [ ] Per-jurisdiction field mapping management
- [ ] Federal enrichment layers (Census ACS, FEMA flood zones)
- [ ] `fips_code + normalizedApn` universal parcel key on canonical `property` table

### Phase 4: Scale & Hard Sources

- [ ] `SftpAdapter` for county data feeds published as file drops
- [ ] Playwright scraper adapter for CAMA portals without state aggregators (Tyler iasWorld, VGSI)
- [ ] PDF extraction adapter for published lien/assessment reports
- [ ] Evaluate Regrid API (30-day free sandbox) for gap-filling in unsupported counties
- [ ] Evaluate ATTOM for deep enrichment (deed chains, pre-foreclosure signals)
- [ ] Historical backfill capability
- [ ] SCD Type 2 change tracking
- [ ] Advanced entity resolution (match properties across sources without common IDs)

---

## Legal Position

**Scraping public government data is on strong legal ground:**

- Government works not copyrightable (17 U.S.C. 105)
- Facts not copyrightable (Feist v. Rural Telephone, 1991 SCOTUS)
- Scraping public websites doesn't violate CFAA (hiQ v. LinkedIn, 2022 9th Circuit)
- Open data portals (Socrata, ArcGIS Hub) explicitly invite API access

**Best practices**: prefer official APIs over scraping, rate-limit responsibly (1-2 req/sec), respect robots.txt, use descriptive User-Agent, don't bypass CAPTCHAs or login walls, document approach.

---

## Key Insight

The moat is NOT the scraping — it's the **normalization layer and source registry**. Anyone can hit NYC's SODA API. The value is in:

1. Mapping heterogeneous schemas into a unified property model
2. Maintaining those mappings as sources change
3. Making adding a new jurisdiction a config task instead of an engineering project
4. Layering AI intelligence on top (which is what Analyzer already does)

Start with NYC (existing user interest + best data), prove the canonical schema works, then expand.
