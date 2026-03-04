# Tax Lien Data Platform — Product & Domain Deep Dive

## Overview

A new platform capability for Analyzer: an AI-powered tax lien analysis and distressed property intelligence tool, starting with Brooklyn & Queens (NYC) and designed to expand to additional jurisdictions (Broward County FL next, then nationwide).

**Client:** Daniel Gabay (investor), David Shorenstein (GP), Brett Shorenstein
**Engagement:** $5,000 initial build + $500/month ongoing + 0.5% gross equity on properties purchased through platform data
**Timeline:** 6-8 weeks for initial build (Brooklyn & Queens)
**Started:** Feb 2026

### What We're Building

A secure web application that aggregates public tax lien data, property records, violations, zoning, and valuations into a single queryable interface with AI-powered scoring, natural language chat, and CSV export. The platform surfaces distressed property investment opportunities by combining signals that are currently scattered across dozens of disconnected government portals.

**The core insight:** Daniel's value isn't "look at a table of 3,000 parcels." It's: *"The moment a property enters lis pendens, I get a text with owner name, phone, property type, photo, and lien amount — before my competitors even know it exists."* The dashboard is useful, but the **alert system** is the product.

### Implementation Status (as of Mar 2026)

| Component | Status | Notes |
|-----------|--------|-------|
| Tax lien list ingestion | ✅ Done | SODA adapter, latest cycle filtering |
| PLUTO enrichment | ✅ Done | Building class, units, sqft, year built, owner, zoning |
| HPD violations | ✅ Done | Aggregated counts by class, violations/unit |
| Distress scoring | ✅ Done | 0-100 weighted score (needs update — Class C only, see 3/4 feedback) |
| Parcel table UI | ✅ Done | Filterable, sortable, expandable rows |
| CSV export | ✅ Done | All filters apply |
| Agent tools | ✅ Done | `query_parcels`, `get_parcel_stats` |
| Feature flag | ✅ Done | `parcels` org-level flag |
| **Building class grouped filters** | ❌ Not started | 3 checkbox categories (see 3/4 feedback). Exclude D class entirely. |
| **Tax lien dollar amounts** | ❌ Not started | NYC DOF account history, MTAG/Tower servicer data |
| **Outstanding tax bills** | ❌ Not started | NYC DOF tax bill amounts per property |
| **Owner phone lookup** | ❌ Not started | Skip tracing — Brett ready to cold call |
| **Manhattan expansion** | ❌ Not started | Same criteria as BK/QN |
| **Accurate valuations** | ❌ Not started | Property Shark (login received) or ATTOM API |
| **Lis pendens ingestion** | ❌ Not started | ACRIS integration needed |
| **Push alerts (SMS/email)** | ❌ Not started | Time-sensitive advantage |
| **Property photos** | ❌ Not started | Street View API |
| **Property Charges Balance** | ❌ Not started | `scjx-j6np` dataset |

### Source Documents

| Document | Location |
|----------|----------|
| Meeting notes (2/4, 2/12, 3/4) | [Google Drive](https://drive.google.com/drive/folders/1CzNH0jYqpdi4GtP5XPu1z_1dVAq8G0ty) |
| Statement of Work | Google Drive (same folder) |
| Broward County notes | Google Drive (same folder) |
| Daniel's data feedback | `DG Comments.xlsx` in Google Drive + [email 3/4](https://mail.google.com/mail/u/0/#all/19cbb1ce331e71a2) |
| Public Data Platform arch | [`docs/product/PUBLIC_DATA_PLATFORM.md`](PUBLIC_DATA_PLATFORM.md) |
| Granola meeting transcripts | [2/4](https://notes.granola.ai/t/648f69bf-f9af-439c-9ff5-74ac5d8ff6fb), [2/12](https://notes.granola.ai/t/873b558a-84ce-4bd6-bd9f-5cb1fea9f91b), [3/4](https://notes.granola.ai/d/c7f8f518-3326-49ee-9ef0-ec825441e010) |

---

## Roadmap & Priorities

### Current Weakness

The system is **reactive** (Daniel has to check the dashboard) not **proactive** (system notifies Daniel). The real value is alerting on **new lis pendens filings** — the time-sensitive signal that creates competitive advantage. Daniel pays ~$500/month for PropertyShark primarily for this (24-48 hour delay). We can beat that.

Additionally, the dashboard is missing key data Daniel needs to act: **lien dollar amounts**, **outstanding tax bills**, and **owner contact info** for cold calling. Brett is ready to start calling but needs this data first.

### Priority Stack (Updated 3/4 — Post-Meeting)

_Reprioritized based on 3/4 meeting + Daniel's email feedback. Cold calling enablement is now the primary driver._

| Priority | Focus | Deliverable |
|----------|-------|-------------|
| **P0** | **Scoring fix** | Remove Class A/B violations from score — only Class C matters per Daniel |
| **P0** | **Building class grouped filters** | 3 checkbox categories: (A,B,C), (E-Z), (C1-C7). Exclude D class entirely. |
| **P1** | **Tax lien dollar amounts** | Scrape/integrate NYC DOF account history for lien $$ and servicer (MTAG/Tower). Also check MTAG (station31partners.com) and Tower (tcmfc.com) sites. |
| **P1** | **Outstanding tax bills** | Pull current tax bill amounts from NYC DOF. Example: BBL 3004050058 owes $8,530. DOF has PDF tax bills at `a836-edms.nyc.gov` but dynamic site — research API/scraping options. |
| **P2** | **Owner contact lookup (skip tracing)** | Phone numbers for cold calling. Brett is ready to start. Research providers (Spokeo, BeenVerified, batch skip trace APIs). |
| **P2** | **Manhattan expansion** | Add borough 1 with same criteria as BK/QN |
| **P3** | **Property Shark integration** | Daniel sent login (dgabay@gmail.com). Use for comps/valuations. Research if API exists or web-only. |
| **P3** | **Lis pendens alerts** | ACRIS integration + SMS/email push. Still high value but cold calling data comes first. |
| **P4** | **Property photos** | Street View API |
| **P4** | **Property Charges Balance** | Socrata `scjx-j6np` |

---

## Meeting Notes

### 2/4 — Data Demo

- Showed tax liens + HPD violations + PLUTO → ranked CSV output
- **Valuations:** Daniel offered Property Shark login (2 users). ATTOM API also available.
- **Focus:** Brooklyn + Queens (easier data, can visit properties)
- **Borough codes:** 1=MN, 2=BX, 3=BK, 4=QN, 5=SI
- **Timeline:** 3-8 weeks for BK/QN

### 2/12 — Scope & Lis Pendens

- **Lis pendens alerts:** Daily text/email when properties enter lis pendens. Include owner name + phone, property type + photo, lien amount. **5-minute competitive advantage.**
- Daniel currently uses Property Shark for manual searches
- Iterative development with weekly/bi-weekly feedback

### 3/4 — Platform Demo & Feedback

- Demoed live platform with 3 datasets (PLUTO, HPD, tax liens)
- **Building class filters:** Daniel wants 3 grouped checkbox categories, not a long dropdown:
  - Group 1: A, B, C
  - Group 2: E, F, G, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z
  - Group 3: C1, C2, C3, C4, C5, C6, C7
  - **Exclude D class entirely** (for now)
- **Only Class C violations matter** — Drop A and B from scoring/display. "Not meaningful."
- **Tax lien dollar amounts needed** — Platform shows lien existence but not $$. NYC DOF account history has lien amounts + servicer (MTAG/Tower). Old search features on servicer sites (station31partners.com, tcmfc.com) have changed.
- **Outstanding tax bills** — Show current tax bill on dashboard. NYC DOF search at `a836-pts-access.nyc.gov`. Example: 213 Butler St (BBL 3004050058) owes $8,530. Lien 1 for $58K sold to Tower (status: Sold = unpaid). Tax bill PDFs available at `a836-edms.nyc.gov`.
- **Contact info is top priority** — Brett ready to start cold calling once data is complete
- **Manhattan expansion** — Same criteria as BK/QN being discussed
- **Property Shark login sent** — dgabay@gmail.com at propertyshark.com
- **Follow-up with David Shorenstein** at 6pm same day

---

## The Problem

### Why Tax Lien Investing is Hard

Tax lien investing requires identifying distressed properties before other investors, evaluating whether the underlying property is worth the risk, and acting fast. Today this is almost entirely manual:

1. **Data is fragmented** — Tax lien lists, property characteristics (PLUTO), code violations (HPD), comparable sales, and ownership records live in separate databases with different formats, APIs, and update schedules.

2. **Analysis is labor-intensive** — An investor reviewing a lien sale list has to manually cross-reference each property against 4-6 data sources to determine if it's worth pursuing. For a list of 18,000+ properties (the size of NYC's 2025 lien sale), this is impossible without automation.

3. **Context is missing** — A lien amount alone tells you nothing. Is the property a frame house or brick? How many units? Is it a coop (worthless for this strategy)? Are there active code violations suggesting physical distress? What's it actually worth vs. the assessed value? Each of these questions requires a different lookup.

4. **Speed matters** — Tax lien sales are competitive. The 2025 NYC sale included ~18,000 properties and $163M in bonds (NYCTL 2025-A Trust). Investors who can identify the best opportunities first — and verify them — have a significant edge.

5. **Lis pendens alerts create time-sensitive opportunity** — When a lis pendens (pre-foreclosure notice) is filed, there's a narrow window to contact the owner before other investors. Daniel currently does this manually via PropertyShark. A 5-minute advantage on lis pendens alerts could mean winning or losing a deal.

### What Daniel Does Today

- Subscribes to PropertyShark (~$500/month) for lis pendens alerts and property lookups
- Manually searches NYC Open Data for tax lien sale lists
- Cross-references properties by hand against PLUTO data, HPD violations, and comps
- Exports to Excel and adds his own scoring columns
- Wants violations per unit, building class filtering (remove coops), and property valuations — all manual today

---

## Domain Knowledge

### How NYC Tax Lien Sales Work

NYC sells tax liens on properties with outstanding tax, water, or sewer debt. The city doesn't sell individual liens to investors directly (unlike Florida). Instead:

1. **The city publishes a lien sale list** — Properties with delinquent taxes/water charges appear on publicly available lists (Socrata dataset `9rz4-mjek`).

2. **The NYCTL Trust buys the liens in bulk** — The city creates a Delaware statutory trust (NYCTL) that purchases liens at ~73% of the lien pool's total value, adds a 5% surcharge + ~$200 admin fee per lien, then issues AAA-rated bonds to institutional investors via J.P. Morgan. The 2025 trust (NYCTL 2025-A) issued $163.8M in bonds to J.P. Morgan + $8.6M to the city ($172.45M total). A private servicer collects payments; bondholders get paid from collections, residual goes to the city.

3. **The trust collects** — Property owners must pay back the delinquent amount plus interest to redeem the lien. Interest rates: **18% annual (compounded daily)** for properties assessed over $250K, **5% annual (compounded daily)** for properties assessed at $250K or less. A 2016 analysis found interest and fees increased median debt by 65%, and after 18 months, total redemption cost was often double the original debt. If they don't pay, the trust can initiate judicial foreclosure.

4. **Individual investors participate indirectly** — The opportunity for investors like Daniel isn't buying the liens themselves (that's institutional). It's identifying distressed properties on the lien sale list that may be acquisition opportunities — properties where the owner can't pay taxes, might be willing to sell at a discount, or are heading toward foreclosure.

**Eligibility thresholds (2025):**
- Tax Class 1 (1-3 family): $3,000+ in water/sewer charges outstanding 1+ year
- Tax Class 2 (multi-family, condos): $1,000+ outstanding 1+ year
- Tax Class 4 (commercial): $1,000+ outstanding 1+ year
- HDFC rentals: $5,000+ outstanding 2+ years
- Exempt: single-family homes with SCHE/DHE/veteran exemptions, HDFC condos/coops

**Recent timeline:**

| Year | Event |
|------|-------|
| May 2020 | Lien sale postponed due to COVID |
| 2020-2024 | Extended moratorium — no lien sales held |
| July 2024 | Local Law 82 (Home Preservation & Debt Resolution Reform Act) signed |
| Feb 2025 | 90-day notice list published (~30,000 liens) |
| June 3, 2025 | 2025 lien sale held — first since COVID. 85% of the 30,000 liens removed before sale. |
| Nov 2025 | City Council advances land bank legislation (4 bills) to replace private trust model |
| Jan 2026 | Mayor Adams vetoes land bank bills |
| Feb 2026 | The Real Deal reports on pending reform — land bank would create a NYC Land Trust to acquire liens, transfer distressed properties to partners for income-restricted housing |

**2024 reform impacts (Local Law 82):**
- Easy Exit Program: owner-occupied 1-3 unit homes can delay inclusion up to 1 year if income-qualified
- Foreclosure protection: can't foreclose on owner-occupied 1-3 unit properties until lien value reaches 15% of property value OR $70K (whichever is less)
- Enhanced notification requirements
- $2M allocated for outreach via Center for NYC Neighborhoods
- **Commercial properties receive no special deferrals or protections** — this is where the investment opportunity remains strongest

### Investment Strategy (How Daniel Makes Money)

Daniel's strategy is NOT buying liens directly (that's institutional in NYC). His strategy uses the lien sale list and other distress signals to identify **acquisition opportunities**:

1. **Pre-foreclosure direct purchase** — Identify properties on the lien sale list or with lis pendens filings. Contact the owner, who may be motivated to sell at 20-40% below market to avoid foreclosure and preserve credit.

2. **Distressed property value-add** — Find properties with high violations per unit (indicating neglected maintenance), acquire at distress pricing, invest in rehabilitation, and either hold for cash flow or sell at improved value.

3. **Vacant lot development** — Identify vacant lots (V-class, Z-class) with tax liens that indicate an absentee or financially distressed owner. Potential for below-market acquisition and development.

4. **Data-driven screening** — Use the scoring system to filter the ~18,000 properties on the lien sale list down to the 50-100 best opportunities matching his specific criteria (borough, building type, unit count, distress level).

The platform's value is turning a haystack of 18,000+ properties into a ranked shortlist of actionable opportunities, enriched with data that would take weeks to assemble manually.

### How Florida Tax Liens Work (Broward County)

Florida is both a tax lien AND tax deed state, with a different process than NYC:

1. **Tax Certificate Sale** — If an owner doesn't pay property taxes, the county auctions a tax certificate (lien) in June. Unlike NYC's bulk trust model, individual investors buy individual certificates.

2. **Bid-down interest** — Bidding starts at 18% annual interest and bidders compete by accepting lower rates. The lowest bidder wins the certificate.

3. **Redemption period** — The property owner has 2 years to pay back taxes + interest. If they redeem, the certificate holder earns their interest rate. ~97% of certificates redeem.

4. **Tax Deed Sale** — If not redeemed after 2 years, the certificate holder can apply to force a public auction of the property (tax deed sale). The property sells to the highest bidder, and the certificate holder gets paid from the proceeds.

**Broward County data access:**
- SFTP server: `crpublic@BCFTP.Broward.org` — updated every weekday
- Contains official records index data: document recordings (liens, deeds, mortgages, foreclosures)
- Tells you: recording date/time, property, event type, ownership transfers, creditor claims, IRS involvement
- Does NOT include: property valuations, lien balances/payoffs, code violations (need other sources)
- Export file layout documentation: [ExportFilesLayout.pdf](https://www.broward.org/RecordsTaxesTreasury/Records/Documents/ExportFilesLayout.pdf)
- 10 days of free FTP access; bulk data via records@broward.org or 954-831-4000

### NYC Property Data Signals

#### HPD Violations (Distress Indicator)

NYC Housing Preservation & Development (HPD) issues violations in classes:

| Class | Severity | Examples | Correction Window |
|-------|----------|----------|-------------------|
| **A** | Non-hazardous | Missing peephole, improper toilet seat | 90 days |
| **B** | Hazardous | Broken smoke detector, damaged stairs | 30 days |
| **C** | Immediately hazardous | No heat, rodents, lead paint, mold, no hot water | 24 hours |

**Why violations per unit matters:** A building with 50 violations and 200 units is probably fine. A building with 50 violations and 3 units is in severe distress. Daniel's key insight (from his spreadsheet comments) is that **violations per unit** is the real distress signal, not raw violation count.

HPD uses open violations as a key input for identifying "distressed buildings" and enrolling them in the Alternative Enforcement Program (AEP). The platform should mirror this logic.

**Data sources:**
- **Open HPD Violations** (Socrata `csn4-vhvf`) — currently open violations, updated daily
- **Housing Maintenance Code Violations** (Socrata `wvxf-dwi5`) — full history including resolved
- **NYCDB** ([github.com/nycdb/nycdb](https://github.com/nycdb/nycdb)) — open-source aggregator of HPD violations, litigations, registrations, complaints, charges, repair/vacate orders, and AEP data

#### Building Classes (NYC DOF)

NYC Department of Finance classifies every property. Key codes for tax lien analysis:

| Code | Description | Relevance |
|------|-------------|-----------|
| **A0** | Cape Cod | Single family |
| **A1** | Two stories, detached | Single family |
| **A5** | Attached or semi-detached | Single family |
| **A8** | Bungalow colony / coop | **EXCLUDE — Coop** |
| **B1** | Two family, brick | Two family |
| **B2** | Two family, frame (wood) | Two family — Daniel notes frame = less desirable |
| **B3** | Two family, converted from one family | Two family |
| **C0** | Three families | Walk-up apartment |
| **C2** | Five-six family walk-up | Walk-up apartment |
| **C5** | Converted dwelling or rooming house | Walk-up apartment |
| **C6** | Walk-up cooperative | **EXCLUDE — Coop** |
| **D4** | Elevator cooperative | **EXCLUDE — Coop** |
| **H7** | Hotel (coop) | **EXCLUDE — Coop** |
| **K4** | Store building (1 story, commercial) | Commercial |
| **S1** | Primarily 1 family with store | Mixed use |
| **S2** | Primarily 2 family with store | Mixed use |
| **V1** | Vacant land (zoned residential) | Vacant lot |
| **Z7** | Vacant land (zoned commercial) | Vacant lot |

**Official reference:** [NYC DOF Building Classification Codes](https://www.nyc.gov/assets/finance/jump/hlpbldgcode.html)

**Complete coop building class codes (all should be excludable):**

| Code | Description |
|------|-------------|
| A8 | Bungalow colony, cooperatively owned land |
| C6 | Walk-up cooperative |
| C8 | Walk-up co-op, conversion from loft/warehouse |
| CC | Walk-up co-op apt, less than 11 units |
| D0 | Elevator co-op, conversion from loft/warehouse |
| D4 | Elevator cooperative |
| DC | Elevator co-op apt, less than 11 units |
| H7 | Apartment hotel, cooperatively owned |
| R9 | Co-op within a condominium |

Daniel's initial filter (A8, C6, D4, H7) covers the main ones, but the platform should exclude all 9 codes.

**Daniel's filtering rules:**
- Always exclude coops (all codes above)
- Flag frame houses (B2 with frame construction) — less desirable than brick
- Flag vacant lots (V-class, Z-class) — different investment thesis
- Show building class prominently to enable quick visual filtering

#### Property Valuations

NYC assessed values are NOT market values. The assessment ratios are:

| Tax Class | Description | Assessment Ratio | Cap |
|-----------|-------------|-----------------|-----|
| 1 | 1-3 family residential | 6% of market value | 6%/year, 20%/5yr |
| 2 | Multi-family, condos, coops | 45% of market value | 8%/year, 30%/5yr (10 units or fewer) |
| 3 | Utility properties | 45% | N/A |
| 4 | Commercial/industrial | 45% | Phase-in over 5 years |

**To estimate market value from assessed value:**
- Class 1: Assessed Value / 0.06 = rough market value
- Class 2/3/4: Assessed Value / 0.45 = rough market value

This is a rough approximation. For real comps, we need:

| Source | What It Provides | Cost | Notes |
|--------|-----------------|------|-------|
| **Property Shark** | Comps, lis pendens, owner data, foreclosures | ~$500/month | Daniel has a login (2 simultaneous users). Best for NYC. |
| **ATTOM API** | Nationwide AVM, tax, deed, foreclosure data | ~$500+/month | 158M+ properties, 9,000 attributes per property. AVM includes confidence score. |
| **NYC PLUTO** | Assessed values, building characteristics | Free (Socrata) | 90+ fields per lot but no market comps |
| **NYC Property Valuation dataset** | Assessed/market values, exemptions | Free (Socrata `8y4t-faws`) | Annual DOF valuations |
| **ACRIS** | Deed transfers with sale prices | Free (Socrata) | Historical transactions — build your own comps |

### Lis Pendens (Pre-Foreclosure Alerts)

A lis pendens is a legal filing that signals the beginning of foreclosure proceedings. It's recorded at the county level (ACRIS in NYC) when a lender files a foreclosure action.

**Why this matters for Daniel:**
- A lis pendens is the earliest public signal that a property owner is in financial distress
- There's a 5-minute competitive advantage in being the first to contact the owner
- Daniel currently subscribes to PropertyShark for lis pendens alerts — gets notifications within 24-48 hours of filing
- He wants **same-day alerts via text/email** with: owner name + phone, property type + photo, lien amount

**Data sources in NYC:**
- **ACRIS** (primary): Real Property Master (Socrata `bnx9-e6tj`) — document type codes for lis pendens include `LP` and related filings. Cross-reference with Real Property Legals (`8h5j-fqxa`) for BBL linkage and Real Property Parties (`636b-3b5g`) for owner names. Bulk download available via [github.com/fitnr/acris-download](https://github.com/fitnr/acris-download) (requires 10GB+ disk space).
- **PropertyShark**: Pre-foreclosure listings updated within 24-48 hours of filing, includes lien amount, owner name/address, title history
- **CourtAlert**: Real-time lis pendens filing alert service for investors/attorneys
- **NYLisPendens.com**: Dedicated lis pendens listing service for NY

**NYC foreclosure timeline:** New York is a judicial foreclosure state — all foreclosures must go through court.

| Scenario | Timeline |
|----------|----------|
| Uncontested (owner doesn't respond) | ~6 months minimum |
| Typical contested foreclosure | 12-18 months |
| Average from first missed payment to sale | ~445 days (15 months) |
| Complex cases with multiple defenses | 2-4+ years |

This extended window (often 12-18+ months) creates opportunity for direct outreach — owners may sell at 20-40% below market to avoid the credit impact of foreclosure.

---

## Competitive Landscape

| Platform | Focus | Strengths | Gaps We Fill |
|----------|-------|-----------|-------------|
| **PropertyShark** | NYC property intelligence | Best NYC data, lis pendens, comps, 100% NYC coverage | Manual lookups only, no AI scoring, no aggregated lien analysis, expensive (~$500/mo) |
| **Reonomy** (Altus Group) | CRE property intelligence | 50M+ commercial properties, LLC piercing, predictive scoring | Enterprise pricing, not focused on tax lien investing workflow |
| **Tax Sale Resources** | Tax lien/deed auction research | Nationwide sale data, portfolio management, nationwide coverage | No property intelligence overlay, no AI, no violations/distress data |
| **FastLien** | Tax lien sale list research | Clean UI for sale lists, county-by-county access | Limited data enrichment, no scoring, no alerts |
| **GoliathData** | Real estate prospecting | AI-powered, property data with prospecting tools | General-purpose, not specialized for tax lien/distress analysis |
| **ATTOM API** | Raw property data API | 158M properties, AVM, tax, deed data | Raw data only — no UI, no scoring, no workflow, requires engineering |

### Where We Win

1. **Aggregation** — Nobody combines tax lien lists + PLUTO + HPD violations + ACRIS + valuations into a single scored view. That's the product.
2. **AI scoring** — Weighted scoring based on violations per unit, building age, property type, lien status, and building class. Not just data — intelligence.
3. **Natural language interface** — "Show me brick multi-family buildings in Brooklyn with more than 5 violations per unit and a tax lien" → instant results.
4. **Lis pendens alerts** — Same-day push notifications with owner contact info and property details. Faster than PropertyShark's 24-48 hours.
5. **Custom for the workflow** — Built for Daniel's actual investment process, not a general-purpose tool adapted for it.

---

## Feature Requirements

### MVP (Phase 1 — Brooklyn & Queens)

Based on SoW deliverables, meeting notes, and Daniel's spreadsheet feedback:

#### Data Aggregation
- [x] Ingest NYC Tax Lien Sale Lists (Socrata `9rz4-mjek`) — latest cycle only
- [ ] Ingest Property Charges Balance — outstanding balances (Socrata `scjx-j6np`)
- [x] Ingest PLUTO property data (Socrata `64uk-42ks`) — building class, units, sqft, lot size, zoning, year built
- [x] Ingest HPD violations — all classes, count per building, breakout by class A/B/C
- [x] Filter to Brooklyn (borough 3) and Queens (borough 4) by default
- [x] Join datasets by BBL (borough-block-lot) key

#### Building Intelligence
- [x] Show building class with full description
- [x] Auto-exclude coops (all 9 codes: A8, C6, C8, CC, D0, D4, DC, H7, R9) — filterable toggle
- [ ] **Grouped building class filter** — 3 checkbox categories: (A,B,C), (E-Z), (C1-C7). Exclude all D class entirely. _3/4 feedback._
- [ ] Flag vacant lots (V-class, Z-class)
- [ ] Show construction type (frame vs. brick) from building class
- [x] Calculate violations per unit (open violations / unit count)
- [x] Breakout violation counts by class (A, B, C separately)
- [x] Show assessed value and estimated market value (using assessment ratios)
- [x] Add square footage from PLUTO
- [x] Show number of units from PLUTO

#### Scoring System
- [x] Composite distress score (0-100) weighing:
  - Active lien (+30 points)
  - Violations per unit (+10 per viol/unit, capped at 40)
  - Class C violations (+5 each, capped at 20)
  - ~~Class B violations (+2 each, capped at 10)~~ — **REMOVE per 3/4 feedback. Only Class C matters.**
- [ ] **Update scoring to Class C only** — Drop A and B violations from score. Redistribute weight (e.g. increase C violation cap or violations/unit weight).
- [ ] Score explanation for each property (why this score?)

#### Interface
- [x] Secure web app with login (Clerk auth + org-level `parcels` feature flag)
- [x] Sortable/filterable data table with all fields
- [x] Agent tools for natural language queries (`query_parcels`, `get_parcel_stats`)
- [x] CSV export for offline analysis
- [x] Expandable row detail view with all aggregated data

#### Data Maintenance
- [ ] Automated data refresh (at minimum weekly, ideally daily for violations)
- [x] Last-updated timestamps per data source (`plutoSyncedAt`, `liensSyncedAt`, `violationsSyncedAt`)

### Phase 2 — Cold Calling Enablement (PRIORITY — 3/4 meeting)

_Reprioritized from lis pendens. Brett is ready to cold call — he needs lien amounts, tax bills, and phone numbers first._

- [ ] **Tax lien dollar amounts** — Integrate NYC DOF account history for lien $$ per property. Shows servicer (MTAG or Tower), lien status (Sold vs Redeemed), and lien amount. DOF search: `a836-pts-access.nyc.gov`. Research scraping or API approach — site is dynamic. Also check servicer sites: [MTAG/Station 31](https://station31partners.com/mtag-services-2/), [Tower](https://www.tcmfc.com).
- [ ] **Outstanding tax bills** — Pull current tax bill amounts from NYC DOF. PDF tax bills available at `a836-edms.nyc.gov/dctm-rest/repositories/dofedmspts/StatementSearch?bbl={bbl}&stmtDate={date}&stmtType=SOA`. Research batch approach.
- [ ] **Owner contact lookup** — Skip tracing for phone numbers. Brett ready to start cold calling. Research batch providers (Spokeo, BeenVerified, BatchSkipTracing, REISkip).
- [ ] **Scoring update** — Remove Class A/B violations. Only Class C matters. Redistribute weight.
- [ ] **Building class grouped filters** — 3 checkbox categories replacing individual dropdown.
- [ ] **Manhattan expansion** — Add borough 1 with same criteria.

### Phase 3 — Lis Pendens Alerts

_Still high value but deprioritized behind cold calling data needs._

- [ ] **ACRIS lis pendens ingestion** — Daily poll of Real Property Master (`bnx9-e6tj`) filtered for lis pendens document types (`LP`, related codes). Cross-ref with Legals (`8h5j-fqxa`) for BBL linkage.
- [ ] **New filing detection** — Track `lastAcrisSyncedAt`, detect filings since last run, match to existing parcels or create new
- [ ] **Alert system** — When new lis pendens matches criteria (borough, score threshold), send:
  - **SMS via Twilio** + **email via Resend**
  - Content: property address, owner name, lien amount, property type, building class, distress score, link to detail
- [ ] **Alert preferences** — User-configurable: boroughs, score threshold, alert frequency
- [ ] **Alert history** — Store all sent alerts, show in UI ("alerts I've received")

### Phase 4 — Valuations & Enrichment

- [ ] **Property valuations via comps** — Integrate Property Shark (Daniel's login: dgabay@gmail.com) or ATTOM API for actual market values and comparable sales. Research if Property Shark has an API or is web-only.
- [ ] **Property photos** — Google Street View Static API (free tier: 28K/month) or Zillow API
- [ ] **Property Charges Balance** — Ingest `scjx-j6np` for outstanding balance data (additional distress signal)

### Phase 5 — Multi-Jurisdiction

- [ ] **Broward County FL** — Ingest SFTP data from `BCFTP.Broward.org` (official records index: liens, deeds, mortgages, foreclosures). Supplement with county property appraiser data for valuations.
- [ ] **Adapter pattern reuse** — Each jurisdiction = new source config, not new engineering (see `PUBLIC_DATA_PLATFORM.md` architecture)
- [ ] **Florida tax certificate sale lists** — Ingest county tax certificate auction data for pre-sale analysis

---

## Architecture Notes

### Relationship to Existing Analyzer Infrastructure

This platform should be built within the Analyzer monorepo, leveraging existing infrastructure:

| Existing | Reuse For Tax Lien Platform |
|----------|---------------------------|
| NestJS API (`apps/api`) | Add data ingestion endpoints, property query APIs, alert scheduling |
| Next.js frontend (`apps/web`) | Property table, chat interface, detail views |
| Prisma + PostgreSQL (Supabase) | Property data schema, raw ingestion tables |
| OpenAI integration | Scoring engine, chat interface, natural language queries |
| Clerk auth | User access control (Daniel's 3-person team) |
| SQS pipeline | Async data ingestion jobs |
| S3 | Cache downloaded datasets, store exported CSVs |

### Key Data Pipeline

```
NYC Open Data (SODA API)
├── Tax Lien Sale Lists (9rz4-mjek)
├── Property Charges Balance (scjx-j6np)
├── PLUTO (64uk-42ks)
├── HPD Violations
├── ACRIS Master/Legals/Parties (Phase 2)
└── Property Valuation (8y4t-faws)
         │
         ▼
    SodaAdapter (generic)
         │
         ▼
    Field Mapping + Normalization
    (borough, block, lot → canonical BBL key)
         │
         ▼
    ┌─────────────────┐
    │ Raw Storage      │  ← Append-only JSONB, never modify
    │ (raw_ingestion)  │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Canonical Tables │  ← Typed columns, queryable
    │ property         │
    │ property_tax_lien│
    │ property_violation│
    │ property_assessment│
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Scoring Engine   │  ← AI-weighted composite score
    │ (per property)   │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ API + Frontend   │  ← Table view, chat, export
    └─────────────────┘
```

### BBL (Borough-Block-Lot) as Primary Key

All NYC property data joins on BBL — a 10-digit identifier:
- Borough (1 digit): 1=Manhattan, 2=Bronx, 3=Brooklyn, 4=Queens, 5=Staten Island
- Block (5 digits, zero-padded)
- Lot (4 digits, zero-padded)

Example: Borough 3, Block 8026, Lot 42 → BBL `3080260042`

Every dataset uses BBL in some form but with different field names and formats. The normalization layer must handle this cleanly.

### Ingestion Behavior

Ingestion is **fire-and-forget** — `POST /public-data/ingest` returns immediately with `{ message: 'Ingestion started', boroughs: [...] }` and runs the full pipeline in the background. A full ingest (tax liens → PLUTO enrichment → HPD violations → distress scoring) typically takes 2-5 minutes. Completion and errors are logged server-side only; there's no webhook or polling endpoint currently.

### HPD Violation Query Optimization

HPD violations are not fetched borough-wide (that would pull 5M+ records). Instead, `NycIngestionService` batches queries by block+lot pairs — 50 pairs per SODA request — only fetching violations for parcels already in the Parcel table from the lien ingestion step. This keeps HPD ingestion fast and avoids rate limit issues.

### API Endpoints

Full list of `PublicDataController` endpoints at `/public-data/*`:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/public-data/ingest` | Trigger ingestion (optional `boroughs`, `sources` in body) |
| `GET` | `/public-data/parcels` | Query parcels with filters, sorting, pagination |
| `GET` | `/public-data/parcels/export` | CSV export (same filters as query) |
| `GET` | `/public-data/parcels/:bbl` | Single parcel detail by 10-digit BBL |
| `GET` | `/public-data/stats` | Aggregate statistics (totals, borough breakdown, avg score) |

All endpoints require Clerk auth + `parcels` feature flag (returns 403 if flag is off).

---

## Commercial Terms (from SoW)

| Milestone | Description | Hours | Payment |
|-----------|-------------|-------|---------|
| Kickoff | Project initiation, API access setup, data pipeline architecture | 10 | $1,500 |
| Data Validated | Tax lien, violations, property, valuation data aggregated/cleaned/validated | 20 | $1,500 |
| Platform Live | Secure web app with AI query interface, scoring, full onboarding | 30 | $2,000 |
| **Total** | | **60** | **$5,000** |

**Ongoing:** $500/month for hosting, data maintenance, AI query functionality
**Equity:** 0.5% gross ownership equity in any property purchased through platform data
**Pass-through costs:** Hosting ~$150/mo, AI/LLM ~$100/mo, Property data APIs ~$500/mo (ATTOM, if used)

---

## Open Questions

1. **Property Shark API access** — Daniel offered login credentials (2 simultaneous users). Is there an API, or is it web-only? If web-only, we'd need scraping or ATTOM as alternative for valuations/comps.

2. **ATTOM API budget** — Starts at ~$500/month. Is this within Daniel/David's budget for property data APIs? It would give us nationwide coverage + AVM valuations.

3. **Lis pendens alert delivery** — Text (SMS) vs email vs push notification? Daniel wants text/email. Need to choose a provider (Twilio for SMS, existing Resend for email?).

4. **Scoring model weights** — Initial scoring in the demo weighted violations per unit, building age, property type, and lien status. Need Daniel to validate/adjust weights based on his investment criteria.

5. **How does this relate to deal screening?** — When a property surfaces through this platform, should it feed into Analyzer's deal pipeline? Could the lis pendens alert trigger a "deal" in the main system?

6. **Multi-tenant or single-tenant?** — Is this initially just for Daniel's team (single-tenant), or should we architect for multiple clients from the start? The SoW suggests a dedicated 3-person team.

7. **Broward County timeline** — When does Daniel want to expand to Florida? After NYC is validated, or in parallel?

8. **Regulatory risk** — NYC is actively reforming/replacing the lien sale system (land bank proposals, Local Law 82 protections). How does this affect the platform's value if the lien sale process changes? Note: commercial properties are unaffected by current reforms, and the underlying distress signals (violations, delinquencies, lis pendens) remain valuable regardless of lien sale mechanics.

---

## NYC Open Data Quick Reference

All freely accessible datasets for the MVP:

| Dataset | Socrata ID | Update Frequency | Key Fields |
|---------|-----------|------------------|------------|
| Tax Lien Sale Lists | `9rz4-mjek` | Annual (when sale occurs) | borough, block, lot, tax_class_code, building_class, zip_code |
| Property Charges Balance | `scjx-j6np` | Varies | parid (BBL), sum_liab, sum_coll, sum_bal, due_date, taxyear |
| PLUTO | `64uk-42ks` | Annual | ZoneDist, BldgClass, NumFloors, UnitsTotal, LotArea, BldgArea, AssessTot, YearBuilt, OwnerName |
| Open HPD Violations | `csn4-vhvf` | Daily | BoroID, Block, Lot, Class, InspectionDate, ApprovedDate, CurrentStatus |
| HPD Violations (full history) | `wvxf-dwi5` | Daily | Full violation history including resolved |
| Property Valuation & Assessment | `8y4t-faws` | Annual | Assessed/market values, exemptions |
| ACRIS Real Property Master | `bnx9-e6tj` | Daily | Document recordings: deeds, liens, lis pendens |
| ACRIS Real Property Legals | `8h5j-fqxa` | Daily | BBL linkage for each ACRIS document |
| ACRIS Real Property Parties | `636b-3b5g` | Daily | Grantor/grantee names |
| ACRIS Document Control Codes | `7isb-wh4c` | Static | Decode document type codes (29 lien-related types) |
| DOF Building Classification Codes | `nzvw-cjc2` | Static | Building class code → description mapping |
