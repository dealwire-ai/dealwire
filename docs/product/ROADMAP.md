# Analyzer Roadmap

## Vision

Analyzer is the agentic operating layer for private market acquisitions — starting with commercial real estate and expanding to PE, business acquisitions, and alternative assets.

The deal screener is the wedge. The endgame is an autonomous acquisitions analyst that monitors deal flow across channels, enriches it with deep property and market data, manages broker relationships, and executes on opportunities — replacing the work of $250K/yr analysts with software that runs 24/7.

**The most important thing is data quality and fidelity.** Every deal that flows through Analyzer should produce richer, more accurate, more structured intelligence than a human analyst could assemble manually. If the data isn't trustworthy, nothing else matters.

## What's Built (as of Mar 2026)

### Deal Screening (Core)

- Outlook inbox monitoring via Microsoft Graph webhooks
- AI deal detection (is this email a deal?) with confidence scoring
- Customizable screening buckets with rank-ordered criteria and per-bucket actions
- Structured data extraction (price, cap rate, NOI, occupancy, units, sqft, etc.)
- Auto-reply to self with deal summary + decision
- Auto-move rejected deals to configurable folders
- Draft reply to broker for out-of-buy-box deals
- Historical inbox backfill (batch process past emails)

### Post-Screening Workflow

- Deal Action Card — screening emails include actionable links (Open in Outlook, S3 document downloads, deal room links, CA/NDA signing links, broker intel)
- Deal Narrative — 3-5 sentence conversational "story" of each deal in screening emails
- Broker Outreach Draft — relationship-aware reply drafts with broker history, contact notes, and smart follow-up questions about missing data
- Broker Notes — persistent notes and tags on contacts, accessible via agent tools (email + web chat)
- Smart Digest — daily digest with per-deal inline action links (Outlook, documents, deal room, CA signing)

### Intelligence

- Broker stats: deal volume, pass rate, top markets, frequency
- Broker leaderboard
- Deal analytics (total, yes/no breakdown, by confidence)

### Agent

- Unified AI agent (web chat + email reply)
- Query tools: deals, brokers, assets, stats, leaderboard, contact notes
- Write tools: update criteria, always-skip, buy box, digest schedule, screening buckets, contact notes/tags
- Preference updates via email (e.g., email the system to adjust buy box)

### Underwriting (Phase 1 — Email trigger → Excel delivery)

- Email-triggered pipeline: forward deal docs → get filled pro forma back by email
- 7-step pipeline: classify → extract (OM + rent roll + T-12 in parallel) → normalize + reconcile → confidence gate → pro forma fill → deliver
- Excel fill via xlsx-populate (preserves formulas, charts, styles)
- AI field mapper (Sonnet) maps extracted data to org's template field names
- Delivery via Resend from `UNDERWRITING_INBOUND_EMAIL` with filled .xlsx attachment
- Template management: upload org's Excel template → Claude maps fields → stored as FieldMap
- Web pro forma rendering (dashboard view) is NOT yet built — see ROADMAP Phase 4

### Platform

- Multi-tenant with Clerk orgs
- Scheduled deal digest emails with per-org timezone support
- Dashboard: deals, contacts, assets with search/filter/pagination
- S3 document storage for attachments with pre-signed URL downloads
- SQS async processing pipeline (two queues: email screening + underwriting)

## Roadmap

### Phase 1: Data Quality & Fidelity

_The data Analyzer produces must be best-in-class. This is the foundation everything else depends on._

- [x] **HTML image extraction** — Parse HTML emails with cheerio, extract embedded/external images, filter tracking pixels, OCR content images via Vision API. Most deal flow arrives as image-heavy HTML (Mailchimp-style broker blasts) that was previously invisible to the system.
- [x] **Scanned PDF OCR** — Fallback to pdftoppm + Vision API when pdftotext returns empty (image-only PDFs). Handles scanned OMs that previously produced zero text.
- [x] **Screening model upgrade** — Screening uses gpt-4o (via `OPENAI_SCREENING_MODEL` env var) while cheaper tasks stay on gpt-4o-mini. The most important decision in the product now uses a more capable model.
- [x] **Two-stage screening** — Data extraction runs before screening. Structured fields (price, cap rate, units, location, property type) are passed into the screening prompt so the model evaluates clean data against buy box criteria, not garbled OCR text.
- [ ] **Attachment intelligence** — Handle rent rolls, financial statements, and multi-page OMs. Extract tables, charts, and structured financial data — not just text blobs.
- [ ] **Data extraction accuracy** — Validate and cross-reference extracted fields. Flag low-confidence extractions. Structured output for every deal metric (price, NOI, cap rate, occupancy, units, sqft, year built, tenant mix, etc.).
- [ ] **Screening feedback loop** — User corrects wrong decisions → system learns. Track accuracy over time. Confidence-based routing for borderline deals. _JK feedback Mar 3: still receiving irrelevant deals (e.g. 500–600k sq ft warehouses); improve property type/size filtering._
- [ ] **Deal deduplication** — Detect when multiple brokers send the same deal (same property, different packaging). Merge data from multiple sources into one canonical deal record.
- [ ] **Richer deal detail view** — Full deal page showing all extracted data, source documents, screening rationale, and confidence levels for each field.

### Phase 2: Data Enrichment

_Deep data is the moat. An analyst is only as good as their data access._

- [x] **Tax lien platform (Phase 1)** — NYC public data ingestion from 3 sources (tax lien sale list, PLUTO property records, HPD violations). SODA adapter for Socrata API, lien-first ingestion (start from lien list, enrich with PLUTO + HPD), distress scoring (0-100), filterable parcel table UI at `/public-data/parcels` with CSV export, and agent tools (`query_parcels`, `get_parcel_stats`). See [`docs/product/TAX_LIEN_PLATFORM.md`](TAX_LIEN_PLATFORM.md).
- [~] **Tax lien platform (Phase 2 — cold calling enablement)** — _3/4 meeting reprioritized this ahead of lis pendens — Brett is ready to cold call._ See [`docs/product/TAX_LIEN_PLATFORM.md`](TAX_LIEN_PLATFORM.md).
  - [x] Scoring update: Class C violations only (removed Class A/B from score, increased Class C cap to 30)
  - [x] Grouped building class filters: 3 checkbox groups (Residential, Commercial, Walk-up). D class excluded by default.
  - [x] Outstanding tax bills: Ingested from DOF Property Charges Balance (`scjx-j6np`). CHG = property tax, total = all DOF charges.
  - [x] Actual lien sale amounts — NYCTL quarterly XLSX reports from DOF, crosswalk matched on (zip, buildingClass, taxClass). ~24% exact match shown in UI, rest stored with group/estimated confidence. Includes sale amount, redemptive value, servicer, trust vintage, foreclosure status.
  - [x] Owner contact lookup (skip tracing) — Tracerfy integration, phone column, single + batch lookup, async polling.
  - [ ] Manhattan expansion — add borough 1 with same criteria
  - [~] Servicer info (MTAG vs Tower) — partially available via NYCTL quarterly reports. CARE portal scraping would improve coverage.
- [ ] **Public data ingestion platform** — Adapter-based system for pulling tax liens, zoning, permits, assessments, and deed data from municipal/county sources. Starts with NYC (Socrata SODA API + ArcGIS), designed to expand city-by-city via configuration. See [`docs/product/PUBLIC_DATA_PLATFORM.md`](PUBLIC_DATA_PLATFORM.md) for full architecture.
- [ ] **Property data enrichment** — Pull from public records, assessor databases, census/demographic data to auto-fill details the email didn't include (year built, lot size, zoning, ownership history, tax assessments).
- [ ] **Market context** — Auto-attach market comps, submarket stats, rent trends to deal summaries. "This is priced 15% above recent comps in the submarket."
- [ ] **Deal scoring** — Quantitative scoring beyond yes/no. Rank deals by fit, upside potential, risk factors based on extracted + enriched data.
- [ ] **Broker intelligence v2** — Track broker reliability over time. Which brokers send deals that match? Which waste time? Quality scores per broker.
- [ ] **Portfolio analytics** — Cross-deal analysis. "You've looked at 50 multifamily deals in Dallas this quarter. Here's the trend."

### Phase 3: Expand the Platform

_More channels, more users, more deal flow._

- [ ] **Criteria update button in deal emails** — One-click from deal summary/digest to update buy box or screening criteria. Eliminates need to find original screening address. _JK feedback Mar 3: high priority._
- [ ] **Gmail support** — Expand beyond Outlook. Many acquisitions teams use Google Workspace.
- [ ] **Improved email templates** — More polished analysis emails. Configurable formatting.
- [ ] **Follow-up sequences** — Auto-draft follow-up emails to brokers for promising deals. Request additional info, schedule calls.
- [ ] **Team collaboration** — Deal assignment, shared notes, activity feeds within an org.
- [ ] **Multi-channel intake** — WhatsApp, SMS, Slack, API endpoint for programmatic deal submission.

### Phase 4: Deal Lifecycle

_Move beyond screening into the full deal pipeline._

- [ ] **Pipeline stages** — Track deals through: Screening → Due Diligence → Underwriting → LOI → Closing. Each stage can have autonomous agent actions.
- [~] **Underwriting automation** — Email deal documents ("underwrite this") → system extracts rent roll + T-12 → fills user's Excel pro forma template → delivers filled Excel by email. See [`docs/product/UNDERWRITING.md`](UNDERWRITING.md) for implementation status + full plan.
  - [x] Email trigger + document intake (Resend inbound → S3 → SQS)
  - [x] Document classification (Haiku, by filename)
  - [x] Rent roll + T-12 + OM structured extraction (Sonnet-4-6, parallel)
  - [x] Normalize + reconcile cross-document conflicts (pure code)
  - [x] Confidence gate with human review flags
  - [x] Template filling + Excel export (AI mapper + xlsx-populate)
  - [x] Email delivery with filled .xlsx attachment
  - [ ] Rent roll unit type classification — Handle variations ("renovated" vs "premium renovation", etc.). _JK feedback Mar 3._
  - [ ] Template variations by deal type — Value-add vs ground-up development require different templates. _JK feedback Mar 3._
  - [ ] Traceability — Email/platform showing document source for each extracted value. Blue cells = AI inputs. _JK feedback Mar 3._
  - [ ] Web-native interactive pro forma (dashboard rendering)
- [ ] **Document management** — Organize OMs, rent rolls, financials, environmental reports per deal. OCR and structured extraction for each.

### Phase 5: Multi-Asset & Marketplace

_Expand to new asset classes and become the platform._

- [ ] **Business acquisitions** — Support PE deal flow: business brokers, SBA deals, platform acquisitions. Different data extraction for revenue, EBITDA, customer count, etc.
- [ ] **Debt & lending** — Loan offerings, term sheets, refinance opportunities.
- [ ] **Deal marketplace** — One user's reject is another's target. Opt-in network where passed deals matching another user's buy box surface automatically.
- [ ] **Integration layer** — Salesforce, Juniper Square, Yardi, AppFolio connectors.
- [ ] **White-label / API** — Let other platforms license the screening and enrichment engine.

## Positioning

**Not a CRM. Not a dashboard. An autonomous acquisitions layer.**

Core differentiators:

1. **Data quality** — Extracts more accurate, more complete deal data than a human analyst. Every field validated, cross-referenced, enriched.
2. **Agentic-first** — Works through email and integrations, not a dashboard you have to check.
3. **Deep data** — Property intelligence from dozens of sources, not just what's in the email.
4. **Learns your buy box** — Gets smarter about what you want over time.
5. **Replaces analysts, not software** — Competes with headcount, not other tools.
