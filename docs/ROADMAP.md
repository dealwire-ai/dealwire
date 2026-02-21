# Analyzer Roadmap

## Vision

Analyzer is the agentic operating layer for private market acquisitions — starting with commercial real estate and expanding to PE, business acquisitions, and alternative assets.

The deal screener is the wedge. The endgame is an autonomous acquisitions analyst that monitors deal flow across channels, enriches it with deep property and market data, manages broker relationships, and executes on opportunities — replacing the work of $250K/yr analysts with software that runs 24/7.

**The most important thing is data quality and fidelity.** Every deal that flows through Analyzer should produce richer, more accurate, more structured intelligence than a human analyst could assemble manually. If the data isn't trustworthy, nothing else matters.

## What's Built (as of Feb 2026)

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

### Platform
- Multi-tenant with Clerk orgs
- Scheduled deal digest emails with per-org timezone support
- Dashboard: deals, contacts, assets with search/filter/pagination
- S3 document storage for attachments with pre-signed URL downloads
- SQS async processing pipeline

## Roadmap

### Phase 1: Data Quality & Fidelity
_The data Analyzer produces must be best-in-class. This is the foundation everything else depends on._

- [x] **HTML image extraction** — Parse HTML emails with cheerio, extract embedded/external images, filter tracking pixels, OCR content images via Vision API. Most deal flow arrives as image-heavy HTML (Mailchimp-style broker blasts) that was previously invisible to the system.
- [x] **Scanned PDF OCR** — Fallback to pdftoppm + Vision API when pdftotext returns empty (image-only PDFs). Handles scanned OMs that previously produced zero text.
- [x] **Screening model upgrade** — Screening uses gpt-4o (via `OPENAI_SCREENING_MODEL` env var) while cheaper tasks stay on gpt-4o-mini. The most important decision in the product now uses a more capable model.
- [x] **Two-stage screening** — Data extraction runs before screening. Structured fields (price, cap rate, units, location, property type) are passed into the screening prompt so the model evaluates clean data against buy box criteria, not garbled OCR text.
- [ ] **Attachment intelligence** — Handle rent rolls, financial statements, and multi-page OMs. Extract tables, charts, and structured financial data — not just text blobs.
- [ ] **Data extraction accuracy** — Validate and cross-reference extracted fields. Flag low-confidence extractions. Structured output for every deal metric (price, NOI, cap rate, occupancy, units, sqft, year built, tenant mix, etc.).
- [ ] **Screening feedback loop** — User corrects wrong decisions → system learns. Track accuracy over time. Confidence-based routing for borderline deals.
- [ ] **Deal deduplication** — Detect when multiple brokers send the same deal (same property, different packaging). Merge data from multiple sources into one canonical deal record.
- [ ] **Richer deal detail view** — Full deal page showing all extracted data, source documents, screening rationale, and confidence levels for each field.

### Phase 2: Data Enrichment
_Deep data is the moat. An analyst is only as good as their data access._

- [x] **Tax lien platform (Phase 1)** — NYC public data ingestion from 3 sources (tax lien sale list, PLUTO property records, HPD violations). SODA adapter for Socrata API, lien-first ingestion (start from lien list, enrich with PLUTO + HPD), distress scoring (0-100), filterable parcel table UI at `/public-data/parcels` with CSV export, and agent tools (`query_parcels`, `get_parcel_stats`). See [`docs/TAX_LIEN_PLATFORM.md`](docs/TAX_LIEN_PLATFORM.md).
- [ ] **Public data ingestion platform (Phase 2)** — Adapter-based system for pulling tax liens, zoning, permits, assessments, and deed data from municipal/county sources. Starts with NYC (Socrata SODA API + ArcGIS), designed to expand city-by-city via configuration. See [`docs/PUBLIC_DATA_PLATFORM.md`](docs/PUBLIC_DATA_PLATFORM.md) for full architecture.
- [ ] **Property data enrichment** — Pull from public records, assessor databases, census/demographic data to auto-fill details the email didn't include (year built, lot size, zoning, ownership history, tax assessments).
- [ ] **Market context** — Auto-attach market comps, submarket stats, rent trends to deal summaries. "This is priced 15% above recent comps in the submarket."
- [ ] **Deal scoring** — Quantitative scoring beyond yes/no. Rank deals by fit, upside potential, risk factors based on extracted + enriched data.
- [ ] **Broker intelligence v2** — Track broker reliability over time. Which brokers send deals that match? Which waste time? Quality scores per broker.
- [ ] **Portfolio analytics** — Cross-deal analysis. "You've looked at 50 multifamily deals in Dallas this quarter. Here's the trend."

### Phase 3: Expand the Platform
_More channels, more users, more deal flow._

- [ ] **Gmail support** — Expand beyond Outlook. Many acquisitions teams use Google Workspace.
- [ ] **Improved email templates** — More polished analysis emails. Configurable formatting.
- [ ] **Follow-up sequences** — Auto-draft follow-up emails to brokers for promising deals. Request additional info, schedule calls.
- [ ] **Team collaboration** — Deal assignment, shared notes, activity feeds within an org.
- [ ] **Multi-channel intake** — WhatsApp, SMS, Slack, API endpoint for programmatic deal submission.

### Phase 4: Deal Lifecycle
_Move beyond screening into the full deal pipeline._

- [ ] **Pipeline stages** — Track deals through: Screening → Due Diligence → Underwriting → LOI → Closing. Each stage can have autonomous agent actions.
- [ ] **Underwriting automation** — Auto-generate pro forma models from extracted deal data. Cash flow projections, return calculations.
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
