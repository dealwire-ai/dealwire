# Public Data Platform

Architecture and planning doc for ingesting public property data from municipal, county, and federal sources. This system enables property data enrichment, tax lien opportunity identification, zoning/development analysis, and market intelligence — starting with NYC and expanding city by city.

## Problem

Public real estate data (tax liens, zoning, permits, assessments, deed transfers) is scattered across thousands of municipal/county sources, each with different formats, APIs, and access methods. We need an abstraction layer that makes adding each new jurisdiction faster than the last.

## How Public Data Presents Itself

### Three Dominant Platforms (~80% of accessible data)

| Platform | What It Covers | API Pattern | Examples |
|----------|---------------|-------------|----------|
| **Socrata (SODA API)** | City/county open data portals | `GET /resource/{id}.json?$where=...&$limit=1000&$offset=0` | NYC, Chicago, SF, LA County, Cook County |
| **ArcGIS REST** | GIS/parcel/zoning maps (~80% of US municipalities) | `GET /FeatureServer/{layer}/query?where=1=1&outFields=*&f=json` | Most cities' zoning, parcels, flood zones |
| **County web portals** | Assessor lookups, tax collector, recorder | HTML scraping (Playwright) | Long tail of smaller counties |

### Data Types (most → least accessible)

1. **Tax lien/delinquency** — NYC publishes via SODA. Other cities vary.
2. **Property assessments** — County assessor portals or open data. Assessed value, property characteristics, ownership, tax amounts.
3. **Deed/transfer records** — County clerk/recorder offices. 13 states are "non-disclosure" (sale prices not public).
4. **Zoning** — ArcGIS polygon layers. GIS gives zone code; development parameters (FAR, height, setbacks) usually require separate ordinance lookup. NYC PLUTO is uniquely rich.
5. **Building permits** — Open data portals (Socrata) or Accela/EnerGov systems.
6. **Code violations / foreclosures** — 311 systems, court records. Hardest to access.

### Federal Sources (enrichment layers)

| Source | What | Access |
|--------|------|--------|
| Census ACS | Demographics, income, housing | `api.census.gov` — free API key |
| FEMA NFHL | Flood zones | ArcGIS REST services at `hazards.fema.gov` |
| EPA Envirofacts | Environmental contamination, brownfields | REST API |
| HUD | Fair market rents, subsidized housing, vacancy rates | API at huduser.gov |
| Opportunity Zones | QOZ Census tract designations | CSV/shapefile from CDFI Fund |

### Commercial Aggregators (gap-filling, not primary)

| Provider | Focus | Cost | When to Use |
|----------|-------|------|-------------|
| ATTOM | Nationwide property/tax/deed/foreclosure | $10-100K/yr | Fill gaps in jurisdictions without open data |
| Regrid | Parcel boundaries nationally | $2-50K/yr | Parcel matching spine across sources |
| Reonomy | CRE ownership/LLC piercing | $10-50K/yr | Owner identification behind entities |
| CoreLogic | Deep mortgage/lien data | $100K+/yr | Enterprise-grade, probably overkill initially |

---

## NYC Data Sources (First Target)

NYC has the best public data infrastructure of any US city. All accessible via SODA API — no auth, JSON, SoQL filtering.

### Tax Liens & Delinquency

| Dataset | Socrata ID | What It Contains | Key Fields |
|---------|-----------|------------------|------------|
| **Tax Lien Sale Lists** | `9rz4-mjek` | Properties eligible for upcoming lien sale | borough, block, lot, tax_class_code, building_class, zip_code, water_debt_only |
| **Property Charges Balance** | `scjx-j6np` | Outstanding tax balances per property (28 fields) — best "distress signal" dataset | parid (BBL), sum_liab, sum_coll, sum_bal, due_date, taxyear |

### Property Records (ACRIS)

All recorded documents — deeds, federal liens, lis pendens, UCC filings, mechanic's liens.

| Dataset | Socrata ID | Purpose |
|---------|-----------|---------|
| Real Property Master | `bnx9-e6tj` | Document index (type, date, amount, parties) |
| Real Property Legals | `8h5j-fqxa` | BBL linkage for each document |
| Real Property Parties | `636b-3b5g` | Grantor/grantee names |
| Document Control Codes | `7isb-wh4c` | Decode document type codes (29 lien-related types) |
| Property Types Codes | `94g4-w6xz` | Property type classification |

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
  fetch(params: FetchParams): AsyncGenerator<RawRecord[]>;
}
```

Every adapter — SODA, ArcGIS, Playwright scraper, PDF extractor — implements this one method. It yields pages of raw records.

#### Generic vs Custom Adapters

**Generic adapters** (written once, configured per-source):
- `SodaAdapter` — any Socrata dataset. Config: base URL, dataset ID, SoQL filter.
- `ArcGisAdapter` — any ArcGIS FeatureServer/MapServer layer. Config: service URL, layer ID, spatial/attribute filters.
- `BulkFileAdapter` — CSV/shapefile downloads. Config: download URL, file format, column mapping.

**Custom adapters** (bespoke code per source):
- Extend a base class, override fetch logic for sources that need browser automation, multi-step auth, or unusual pagination.
- Still implement the same interface, so the pipeline doesn't change.

#### Source Configuration

Each source is a DB record (or config file) that specifies which generic adapter to use and how:

```typescript
interface SourceConfig {
  id: string;                    // 'nyc-tax-liens'
  name: string;                  // 'NYC Tax Lien Sale Lists'
  adapterType: 'soda' | 'arcgis' | 'scraper' | 'bulk_file' | 'custom';
  jurisdiction: string;          // FIPS code or 'nyc', 'cook-county', etc.

  // Adapter-specific config
  connection: {
    baseUrl: string;             // API endpoint
    datasetId?: string;          // Socrata dataset ID
    layerId?: number;            // ArcGIS layer number
    filter?: string;             // SoQL or SQL WHERE clause
    appToken?: string;           // Socrata app token
  };

  // How source fields map to canonical schema
  fieldMap: Record<string, string | FieldTransform>;

  // Schedule
  schedule: string;              // cron expression
  refreshType: 'full' | 'incremental';
  incrementalField?: string;     // field to use for incremental (e.g., 'modified_date')

  // Monitoring
  expectedRecordCount?: number;  // alert if actual deviates >50%
  stalenessThreshold?: string;   // alert if no successful run in this window
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

### Orchestration

**Phase 1**: Manual trigger via API endpoint. Simple NestJS controller that runs the adapter → normalize → store pipeline synchronously.

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

**Goal**: Build the adapter framework, ingest NYC data, validate the canonical schema.

- [ ] Define Prisma schema for `DataSource`, `RawIngestion`, `Property`, `PropertyTaxLien`, `PropertyAssessment`
- [ ] Build `SodaAdapter` (generic, handles any Socrata dataset)
- [ ] Build `ArcGisAdapter` (generic, handles any ArcGIS FeatureServer)
- [ ] Create source configs for:
  - NYC Tax Lien Sale Lists (`9rz4-mjek`)
  - NYC Property Charges Balance (`scjx-j6np`)
  - PLUTO via Socrata (`64uk-42ks`) or ArcGIS endpoint
- [ ] Build normalization pipeline (field mapping, basic address parsing)
- [ ] API endpoint to trigger ingestion manually (`POST /data-sources/:id/ingest`)
- [ ] API endpoint to query ingested property data (`GET /properties?fips=...&parcelId=...`)
- [ ] Raw storage with dedup (record hashing)

### Phase 2: Normalize & Enrich

- [ ] Address standardization (Smarty or libpostal integration)
- [ ] Parcel matching across NYC datasets (link lien data to PLUTO records)
- [ ] Add ACRIS data (transactions, recorded liens) — joins across 3 Socrata datasets
- [ ] Data quality validation pipeline
- [ ] BullMQ scheduling for automated refresh
- [ ] Monitoring dashboard (or at least logging/alerting)

### Phase 3: Multi-Jurisdiction

- [ ] Add Chicago (Socrata-based — mostly config, same SodaAdapter)
- [ ] Add Miami-Dade (ArcGIS-based — mostly config, same ArcGisAdapter)
- [ ] Source registry CRUD API + frontend config UI
- [ ] Per-jurisdiction field mapping management
- [ ] Federal enrichment layers (Census ACS, FEMA flood zones)

### Phase 4: Scale & Hard Sources

- [ ] Playwright scraper adapter for counties without APIs
- [ ] PDF extraction adapter for published reports
- [ ] Evaluate ATTOM API for gap-filling
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
