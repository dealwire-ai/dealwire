# Codebase Subsystem Map

Read this before touching any subsystem. Each section answers: what it does, where the code lives, how data flows, and what env vars / external deps it uses.

---

## 1. Email Screening Pipeline

**What it does:** Monitors the user's Outlook inbox via Microsoft Graph webhooks. When a new email arrives, it determines if it's a real estate deal, extracts structured data, makes a yes/no decision against the user's buy box, sends an analysis reply, optionally moves rejected deals to a folder, and drafts a broker reply.

**Key files:**

```
src/service/microsoft/
  microsoft-graph.service.ts          # Graph API calls (fetch messages, attachments, send mail, folders)
  microsoft-subscription.service.ts  # Create/renew/delete webhook subscriptions
  microsoft-webhook.service.ts        # Webhook handler — orchestrates the full pipeline
  microsoft-renewal-scheduler.service.ts  # Cron: renew subscriptions every 12h

src/service/email/
  email-processor.service.ts         # Main processor: extract text → summary → decision → reply
  email-processing.service.ts        # Text extraction from email body + PDF attachments
  email-template.service.ts          # HTML email formatting
  email-sender.service.ts            # Resend wrapper; accepts optional from override
  normalized-email-listener.service.ts  # SQS consumer for 'normalized-email' queue
  image-processor.service.ts         # HTML email image extraction + OCR

src/service/ai/
  deal-detection.service.ts          # Quick deal vs. non-deal classification (gpt-4o-mini)
  deal-summary.service.ts            # Structured summary, deal narrative, broker reply draft
  deal-decision.service.ts           # Yes/no decision against buy box criteria
```

**Data flow:**

```
Graph webhook → MicrosoftWebhookService
  → SQS enqueue (normalized-email queue)
  → NormalizedEmailListenerService.handleMessage()
  → EmailProcessorService.process()
      → EmailProcessingService (text extraction + OCR)
      → DealDetectionService (is this a deal?)
      → DealSummaryService (summary + narrative)
      → DealDecisionService (yes/no)
      → EmailTemplateService (format reply)
      → MicrosoftGraphService (send reply, move folder, create broker draft)
```

**Env vars:** `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_WEBHOOK_SECRET`, `AWS_NORMALIZED_EMAIL_QUEUE_URL`, `OPENAI_API_KEY`, `OPENAI_SCREENING_MODEL`

**Key behaviors:**

- Infinite loop prevention: skip self-sent emails via `X-Analyzer-Sent` header
- Dedup: in-memory cache of processed message IDs
- Attachments stored in S3 before SQS enqueue (message carries metadata only)

---

## 2. Underwriting Pipeline

**What it does:** Email-triggered autonomous underwriting. User forwards deal docs (OM, rent roll, T-12) to the underwriting inbound address with "underwrite this" in subject. System classifies, extracts, normalizes, fills the org's Excel pro forma template, and emails back the filled spreadsheet with a key-metrics summary.

**Key files:**

```
src/service/underwriting/
  underwriting-inbound.service.ts      # Resend inbound handler: download attachments → S3 → SQS
  underwriting-listener.service.ts     # SQS consumer for 'underwriting' queue
  underwriting-orchestrator.service.ts # Pipeline runner (Steps 1-7)

  extractors/
    document-classifier.service.ts     # Step 1: classify by filename — Haiku
    om-extractor.service.ts            # Step 2: OM extraction — Sonnet-4-6
    rent-roll-extractor.service.ts     # Step 2: rent roll extraction — Sonnet-4-6
    t12-extractor.service.ts           # Step 2: T-12 extraction — Sonnet-4-6
    generic-extractor.service.ts       # Step 2: unclassified docs — Sonnet-4-6
    extraction-types.ts                # Shared types (ExtractionResults, etc.)

  steps/
    normalizer.service.ts              # Steps 3+4: derive fields + reconcile cross-doc conflicts (pure code)
    proforma-fill.service.ts           # Step 6: AI field mapper (Sonnet) + xlsx-populate write
    delivery.service.ts                # Step 7: format HTML + send via Resend with attachment

src/service/underwriting/proforma.service.ts  # Template CRUD + field map management
src/controller/underwriting/proforma.controller.ts  # /underwriting/proforma REST endpoints
src/module/underwriting.module.ts
```

**Pipeline steps:**

```
Email → UnderwritingInboundService (Resend webhook)
  → S3 upload of attachments
  → SQS enqueue (underwriting queue)
  → UnderwritingListenerService.handleMessage()
  → UnderwritingOrchestratorService.run()
      Step 1: DocumentClassifierService.classify()    [Haiku — classify by filename]
      Step 2: Promise.all([om, rentRoll, t12, generic].extract())  [Sonnet-4-6]
      Steps 3+4: NormalizerService.normalize()        [pure code — derive + reconcile]
      Step 5: Confidence gate                         [pure code — flag low-confidence]
      Step 6: ProformaFillService.fill()              [Sonnet-4-6 AI mapper + xlsx-populate]
      Step 7: DeliveryService.deliver()               [Resend, from: underwritingInboundEmail]
```

**Env vars:** `AWS_UNDERWRITING_QUEUE_URL`, `ANTHROPIC_API_KEY`, `UNDERWRITING_INBOUND_EMAIL`

**Notes:**

- No BullMQ — uses SQS directly (same pattern as email pipeline)
- Rate limit retry in ProformaFillService: 65s → 90s backoff (Sonnet 10k TPM limit)
- `EmailSenderService.sendEmail()` accepts optional `from` override — used here to send from `underwritingInboundEmail` with display name "AI Underwriting Analyst"
- Delivery skipped if no filled pro forma (e.g., no org template configured)
- Web pro forma rendering (dashboard view) is NOT yet implemented

---

## 3. Public Data / Tax Lien Platform

**What it does:** Ingests NYC public property data (tax liens, PLUTO property records, HPD violations), computes distress scores per parcel (BBL), and exposes results via REST API and agent tools. Gated behind `parcels` feature flag.

**Key files:**

```
src/service/public-data/
  soda.adapter.ts              # Generic Socrata SODA API adapter (paginated fetch, field mapping)
  nyc-ingestion.service.ts     # Orchestrates: tax liens → PLUTO → HPD → charges → NYCTL → CARE → score → upsert
  nyctl-quarterly.service.ts   # NYCTL quarterly XLSX download, parsing, crosswalk matching
  care-scraper.service.ts      # CARE portal scraper: exact per-BBL lien sale amounts, servicer, status
  distress-scoring.service.ts  # Distress score (0-100): lien, violations, class C
  parcel-query.service.ts      # Query/filter Parcel table; used by controller + agent
  skip-trace.service.ts        # Tracerfy skip tracing: submitBatch, pollAndStore, cap check
  nyc-utils.ts                 # Borough constants, BBL utilities

src/controller/public-data.controller.ts  # /public-data/* — ingest, parcels, export, stats, skip-trace, care
src/module/public-data.module.ts
```

**Data flow:**

```
POST /public-data/ingest
  → NycIngestionService.ingestAll() [guarded by in-memory lock, 409 if running]
      → SodaAdapter.fetch(taxLienDataset)       [9rz4-mjek]
      → batch PLUTO enrichment                  [64uk-42ks]
      → HPD violation aggregation               [wvxf-dwi5]
      → Property Charges Balance                [scjx-j6np]
      → DistressScoringService.score()
      → (optional) NyctlQuarterlyService        [if NYCTL_REPORT_DATE set]
      → Prisma upsert → Parcel table
      → Email notification on completion/failure

POST /public-data/ingest/nyctl  { reportDate: "9-30-2025" }
  → NyctlQuarterlyService.ingestNyctlQuarterly()
      → download XLSX from nyc.gov DOF quarterly reports
      → crosswalk match on (zip, buildingClass, taxClass) → 4-tier confidence
      → multi-trust merging (sum across trust vintages)
      → Prisma update → Parcel NYCTL fields

POST /public-data/ingest/care
  → CareScraperService.scrapeAll() [guarded by in-memory lock, 409 if running]
      → load all active-lien BBLs from Parcel table
      → split across 3 parallel workers (each with independent session/cookie jar)
      → per worker: initSession() (3-step ASP.NET handshake) → searchProperty() → scrapeAccountHistory()
      → cheerio HTML parsing for lien sale amounts, servicer, status, dates
      → Prisma update → Parcel lien fields (lienMatchConfidence = 'care_exact')
      → overwrites NYCTL crosswalk data (more accurate)
      → email notification on completion/failure
      → ~20-25 min for ~3,000 parcels

POST /public-data/parcels/skip-trace (or /:bbl/skip-trace)
  → SkipTraceService.submitBatch(bbls)
      → monthly cap check + idempotency filter
      → mark pending → POST tracerfy.com/v1/api/trace/
      → fire-and-forget: pollAndStore(queueId, bbls)
          → poll GET /queue/:id every 15s (up to 5 min)
          → write ownerPhones/ownerEmails → Parcel table
```

**Env vars:** `NYC_OPEN_DATA_APP_TOKEN` (optional, avoids rate limits), `TRACERFY_API_KEY`, `TRACERFY_MONTHLY_CREDIT_CAP` (default 500), `NYCTL_REPORT_DATE` (optional, e.g. `9-30-2025` — triggers NYCTL ingestion as part of full ingest)

**Agent tools:** `query_parcels`, `get_parcel_stats` (in `AnalyzerAgentService`)

**Default ingestion boroughs:** Brooklyn (3) + Queens (4)

---

## 4. Agent

**What it does:** Unified AI agent that powers both web chat and email replies. Queries and writes deal/broker/preference data. Uses tool-calling via Vercel AI SDK.

**Key files:**

```
src/service/agent/analyzer-agent.service.ts  # All agent logic: system prompt, tool definitions, tool execution
src/module/agent.module.ts
src/controller/agent.controller.ts           # POST /agent/chat (web), POST /agent/email-reply
```

**Available tools (read):** `get_deals`, `get_deal_stats`, `get_deals_by_contact`, `get_deals_by_location`, `get_contacts`, `get_assets`, `get_broker_stats`, `get_broker_leaderboard`, `get_contact_notes`, `query_parcels`, `get_parcel_stats`

**Available tools (write):** `update_deal_criteria`, `update_always_skip`, `update_buy_box`, `update_digest_schedule`, `update_screening_buckets`, `update_contact_notes`, `update_contact_tags`

**Model:** gpt-4o (via `OPENAI_API_KEY`), streaming for web chat, non-streaming for email replies

---

## 5. Auth & Multi-Tenancy

**What it does:** Clerk handles user auth and org management. All API routes are scoped to `organizationId`. Microsoft OAuth tokens are stored per user via Clerk.

**Key files:**

```
src/guard/clerk-auth.guard.ts           # JWT verification + organizationId lookup
src/decorator/auth-user.decorator.ts    # @AuthUser('organizationId') param decorator
src/config/clerk.config.ts              # requireAuth flag (production vs dev)
src/service/webhook/clerk-webhook.service.ts  # User created → create Graph subscription; user deleted → cleanup
src/controller/webhook/clerk-webhook.controller.ts
```

**Pattern:** Every protected controller uses `@UseGuards(ClerkAuthGuard)` and scopes all DB queries to `{ organizationId }`. Never accept `organizationId` from request params — always from `@AuthUser()`.

**Env vars:** `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `REQUIRE_AUTH` (optional)

---

## 6. Infrastructure (S3, SQS, Resend)

**What it does:** Shared plumbing used by multiple subsystems.

**Key files:**

```
src/service/s3/s3.service.ts              # Upload/download deal attachments + filled proformas
src/service/sqs/sqs.service.ts            # Enqueue messages to normalized-email and underwriting queues
src/service/email/email-sender.service.ts # Resend wrapper (supports from override, attachments, reply threading)
src/module/s3.module.ts
src/module/sqs.module.ts
src/module/email.module.ts
src/module/sqs-registration.module.ts    # Registers SQS queues with @ssut/nestjs-sqs
```

**SQS queues:**

| Queue              | Env var                          | Visibility timeout | Consumer                         |
| ------------------ | -------------------------------- | ------------------ | -------------------------------- |
| `normalized-email` | `AWS_NORMALIZED_EMAIL_QUEUE_URL` | 300s               | `NormalizedEmailListenerService` |
| `underwriting`     | `AWS_UNDERWRITING_QUEUE_URL`     | 600s               | `UnderwritingListenerService`    |

**S3 key conventions:**

- Deal attachments: `deals/{dealId}/{timestamp}-{filename}`
- Filled pro formas: `deals/{dealId}/proforma_filled.xlsx`
- Pro forma templates: stored per org, key on `Proforma.s3Key`

**Resend:**

- Default `from`: `emailConfig().fromEmail` (env: `FROM_EMAIL`)
- Underwriting delivery `from`: `AI Underwriting Analyst <{UNDERWRITING_INBOUND_EMAIL}>`
- Inbound webhook at `/webhooks/resend` — routes to `UnderwritingInboundService` for underwriting emails

**Env vars:** `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_NORMALIZED_EMAIL_QUEUE_URL`, `AWS_UNDERWRITING_QUEUE_URL`, `RESEND_API_KEY`, `FROM_EMAIL`, `UNDERWRITING_INBOUND_EMAIL`
