# 3/7 Weekend Plan — Tax Lien Platform Phase 2

> **Status: COMPLETED 3/8.** All items shipped. The lien sale amounts approach changed — SAC rows in `scjx-j6np` turned out to be small special assessments, NOT lien sale amounts. Actual lien sale amounts were implemented via NYCTL quarterly XLSX reports with crosswalk matching (see PR #109). Skip tracing (originally "not in this plan") was also shipped on 3/7 via Tracerfy integration.

## Goal

Ship **tax lien dollar amounts** and **outstanding tax bills** on the parcel dashboard using the Property Charges Balance dataset (`scjx-j6np`). This is the core cold-calling enablement data that Brett is waiting on.

Also ship the two quick P0 fixes from the 3/4 meeting (scoring fix + building class filters).

---

## What We're Adding

### 1. Outstanding tax bills per property

Sum of `CHG` (property tax charge) rows where `sum_bal > 0` on the latest extract date. This is the exact amount the property currently owes NYC in property taxes.

**Validated:** BBL 3004050058 (213 Butler St) returns $8,530.35 — matches Daniel's stated ~$8,530.

### 2. ~~Lien-related charge amounts per property~~ (INCORRECT — dropped 3/7)

~~Sum of `SAC` (special assessment charge) rows.~~ **Correction:** SAC rows are small special assessments (water/sewer, ECB fines — typically $50-$250), NOT the lien sale amount (e.g. $58K sold to NYCTL). The `lienChargeAmount` field was dropped as misleading. SAC amounts are still included in `totalOutstandingBalance`.

### 3. Total outstanding balance per property

Sum of all `sum_bal` across CHG + SAC + SAF + SAT. The full picture of what the property owes DOF.

---

## Data Source: `scjx-j6np` (Property Charges Balance)

- **109M rows**, updated quarterly (latest extract: 2026-02-21)
- One row per property × charge type × billing period × extract date
- Free SODA API, no auth required (app token recommended)
- Batch queryable: `$where=parid IN ('BBL1','BBL2',...) AND extractdt='2026-02-21' AND sum_bal > 0`
- ~200-300 BBLs per request (URL length limit), so ~10-15 requests for our ~3,000 parcels

### Key Fields

| Field       | Type   | What It Means                                                                                         |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `parid`     | Text   | BBL in 10-digit BBLE format (matches our `bbl` field)                                                 |
| `code`      | Text   | Charge type: `CHG` (property tax), `SAC` (lien/assessment), `SAF` (admin fee), `SAT` (assessment tax) |
| `sum_liab`  | Number | Original charge amount                                                                                |
| `sum_coll`  | Number | Payments received                                                                                     |
| `sum_int`   | Number | Interest accrued                                                                                      |
| `sum_bal`   | Number | **Current balance due** (liability + interest - collections)                                          |
| `extractdt` | Date   | When DOF extracted this snapshot                                                                      |
| `taxyear`   | Text   | Tax year                                                                                              |
| `cycle`     | Text   | Billing cycle (1Q, 2Q, 3Q, 4Q, 1S, 3S)                                                                |
| `type_acct` | Text   | DOF account type (e.g., `026` = tax lien sale)                                                        |
| `accode`    | Text   | Agency code for the charge                                                                            |

### What This Does NOT Give Us

- Servicer identity (MTAG vs Tower) — would need PDF tax bill parsing for this
- Lien sold/redeemed status — not explicitly flagged (but SAC rows with balances = active liens)
- Lien sale year — partially inferrable from `dt_pd_begin` on SAC rows

---

## Implementation Plan

### Step 1: Add Prisma fields to Parcel model

Add new fields to the `Parcel` model in `apps/api/prisma/schema.prisma`:

```prisma
// Property Charges (from scjx-j6np)
outstandingTaxBill    Float?    // Sum of CHG sum_bal where sum_bal > 0
lienChargeAmount      Float?    // Sum of SAC sum_bal where sum_bal > 0
totalOutstandingBalance Float?  // Sum of ALL sum_bal where sum_bal > 0 (CHG+SAC+SAF+SAT)
chargesSyncedAt       DateTime? // When charges were last synced
```

Run `npx prisma migrate dev` to generate migration.

### Step 2: Add SODA source config for `scjx-j6np`

In `nyc-ingestion.service.ts`, add a new source config alongside the existing ones:

```typescript
const NYC_PROPERTY_CHARGES: SodaSourceConfig = {
  name: "NYC Property Charges Balance",
  baseUrl: "https://data.cityofnewyork.us",
  datasetId: "scjx-j6np",
};
```

### Step 3: Implement `ingestPropertyCharges()` method

Add to `NycIngestionService`. Pattern follows existing methods:

1. Get all existing parcel BBLs from DB (same as PLUTO enrichment)
2. Find the latest `extractdt` in the dataset:
   ```
   $select=extractdt&$order=extractdt DESC&$limit=1
   ```
3. Batch BBLs into groups of ~250
4. For each batch, query:
   ```
   $where=parid IN ('BBL1','BBL2',...) AND extractdt='LATEST' AND sum_bal > 0
   $select=parid,code,sum_bal
   ```
5. Aggregate results per BBL:
   - `outstandingTaxBill` = sum of `sum_bal` where `code = 'CHG'`
   - `lienChargeAmount` = sum of `sum_bal` where `code = 'SAC'`
   - `totalOutstandingBalance` = sum of all `sum_bal`
6. Batch update parcels with `prisma.parcel.update()`

### Step 4: Wire into ingestion pipeline

In `ingestAll()`, add the new step after HPD violations and before scoring:

```
ingestTaxLiens() → ingestPlutoData() → ingestHpdViolations() → ingestPropertyCharges() → scoreAll()
```

### Step 5: Update API query/response

In `ParcelQueryService` (or wherever parcel queries are built):

- Add new fields to the select/response: `outstandingTaxBill`, `lienChargeAmount`, `totalOutstandingBalance`
- Add optional filter params: `minOutstandingBalance`, `maxOutstandingBalance`
- Add sorting support for new fields

### Step 6: Update frontend parcel table

In `parcel-table.tsx`:

- Add columns: "Tax Bill", "Lien Amt", "Total Owed"
- Format as currency
- Make sortable

In expanded row detail view:

- Show breakdown: tax charges vs lien charges vs fees
- Show `chargesSyncedAt` timestamp

### Step 7: Update agent tools

In `analyzer-agent.service.ts`:

- Add new fields to `query_parcels` response
- Add filter params to `query_parcels` tool definition
- Update `get_parcel_stats` to include aggregate charge stats

### Step 8: Update CSV export

Ensure new fields appear in CSV export with proper column headers.

---

## P0 Quick Fixes (Do First)

### Scoring Fix — Class C Only

**File:** `apps/api/src/service/public-data/distress-scoring.service.ts`

Current scoring includes Class B violations (+2 each, capped at 10). Remove this. Only Class C matters per Daniel's 3/4 feedback.

Before:

```
Active lien: +30
Violations/unit: +10 per, cap 40
Class C: +5 each, cap 20
Class B: +2 each, cap 10  ← REMOVE
Max: 100
```

After — redistribute the 10 freed points:

```
Active lien: +30
Violations/unit: +10 per, cap 40
Class C: +5 each, cap 30  ← increased cap from 20 to 30
Max: 100
```

### Building Class Grouped Filters

**File:** `apps/web/src/components/parcels/parcel-filters.tsx`

Replace the current building class multi-select dropdown with 3 checkbox groups:

- **Residential (A, B, C)** — single checkbox that toggles all A*, B*, C\* classes
- **Commercial/Other (E–Z)** — single checkbox that toggles E* through Z*
- **Walk-up Apartments (C1–C7)** — single checkbox that toggles C1-C7

**Exclude D class entirely** — filter these out at the API level (D = elevator apartments, mostly coops).

Backend change: Add a `excludeBuildingClassPrefix` filter param (or handle the grouping logic on the frontend by expanding groups into individual class codes).

---

## Execution Order

1. **Scoring fix** — 15 min. One file change + re-run scoring.
2. **Building class grouped filters** — 1-2 hours. Frontend filter component + possibly backend filter param.
3. **Prisma migration** — 10 min. Add 4 new fields.
4. **Ingestion method** — 2-3 hours. Core new code. Follow existing patterns closely.
5. **API updates** — 30 min. Add fields to response + new filter params.
6. **Frontend columns** — 1 hour. Add columns, format currency, expanded row detail.
7. **Agent tools** — 30 min. Add fields to response schema.
8. **CSV export** — 15 min. Add columns.
9. **Test end-to-end** — Run full ingestion, verify data matches Daniel's example.
10. **Update docs** — Mark items complete in ROADMAP.md and TAX_LIEN_PLATFORM.md.

---

## Validation

After implementation, verify against Daniel's known example:

- **BBL 3004050058** (213 Butler St, Brooklyn) should show:
  - Outstanding tax bill: ~$8,530
  - Lien charges: should show SAC amounts (Lien 1 was $58K sold to Tower)
  - The `scjx-j6np` dataset confirmed $8,530.35 total outstanding — this is our ground truth

---

## What's NOT in This Plan (updated 3/8)

- **Servicer info (MTAG vs Tower)** — partially available via NYCTL quarterly reports (shipped 3/8). CARE portal scraping would improve coverage.
- ~~**Lien sold/redeemed status** — not available in Socrata.~~ → Available via NYCTL quarterly reports (shipped 3/8).
- ~~**Skip tracing / owner phone lookup**~~ → Shipped 3/7 via Tracerfy integration.
- **Manhattan expansion** — trivial once ingestion is stable (add borough 1).
- **Lis pendens alerts** — deprioritized behind cold calling data.
