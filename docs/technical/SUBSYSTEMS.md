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

- Infinite loop prevention: skip self-sent emails via `X-Dealwire-Sent` header
- Dedup: in-memory cache of processed message IDs
- Attachments stored in S3 before SQS enqueue (message carries metadata only)

---

## 2. Underwriting Pipeline (Interactive)

**What it does:** Email-triggered interactive underwriting. The investor forwards deal docs (OM, rent roll, T-12). The agent analyzes the documents, replies with the specific underwriting assumptions it needs (interest rate, LTV, hold, exit cap, reno budget, …), and waits. When the investor replies with values, the agent fills the org's pro forma and emails back the Excel. Follow-up replies to the filled model ("what if rate drops to 5.5%") trigger a re-run with the new assumptions.

The agent **never** runs a pro forma on the first email — insufficient inputs produce garbage. Assumptions are always elicited before fill.

**Key files:**

```
src/service/underwriting/
  underwriting-inbound.service.ts      # Resend inbound handler: new job vs. reply correlation
  underwriting-listener.service.ts     # SQS consumer: dispatches new-job / reply-job
  underwriting-types.ts                # UnderwritingJobContext / UnderwritingResult

  workflow/
    underwriting-workflow.service.ts   # Orchestrator: runAnalysisPhase / runFillPhase / runRerunPhase
    workflow-types.ts                  # DealAnalysisSchema, CellMappingSchema, ValidationResultSchema
    deal-analyzer.service.ts           # Single-pass OM + rent roll + T-12 analysis (Sonnet-4-6)
    assumption-asker.service.ts        # Prune canonical questions to what this template needs
    assumption-email.service.ts        # Outbound ASK / CLARIFY / ANSWER emails (deterministic Message-ID)
    assumption-types.ts                # UserAssumptions, AssumptionQuestion, CANONICAL_ASSUMPTIONS
    assumption-diff.ts                 # "Applied changes" block for delivery emails
    reply-router.service.ts            # Classify investor reply: apply | answer | clarify (Sonnet)
    template-filler.service.ts         # Cell mapper: analysis + assumptions → CellMappings
    proforma-validator.service.ts      # Second-pass QA on filled model
    delivery.service.ts                # Outbound DELIVER email with deterministic Message-ID
    workbook-serializer.ts             # Shared blue-input-cell detection + serialization
    thread-subject.ts                  # Thread subject + property label helpers

src/service/underwriting/proforma.service.ts  # Template CRUD (blue-cell scan)
src/controller/underwriting/proforma.controller.ts  # /underwriting/proforma REST endpoints
src/module/underwriting.module.ts
```

**State machine:**

```
Inbound email
  → In-Reply-To matches an OUTBOUND UnderwritingRunMessage?
     ├─ NO  → new UnderwritingRun (RUNNING)
     │        → runAnalysisPhase(ctx): analyze docs, ask assumptions
     │        → status=WAITING_FOR_ASSUMPTIONS
     │
     └─ YES → parent status?
              ├─ WAITING_FOR_ASSUMPTIONS → parse reply
              │     ├─ unparseable → sendClarificationEmail, status=WAITING_FOR_CLARIFICATION
              │     └─ clean      → optimistic-lock RUNNING, runFillPhase → COMPLETED
              ├─ WAITING_FOR_CLARIFICATION → same as above
              └─ COMPLETED → runRerunPhase: new child UnderwritingRun with parentRunId,
                             inherits extractionSnapshot + askedAssumptions,
                             merges new over prior receivedAssumptions
```

**Threading:** every outbound email has a deterministic Message-ID (`<uw-{runId}-{ask|clarify|answer|deliver}-{uuid}@mail.dealwire.ai>`) persisted to `UnderwritingRunMessage`. Inbound replies are correlated by `In-Reply-To`, with a subject-token fallback (`[UW-{runId-short}]`). Auto-replies are dropped via `Auto-Submitted` / `Precedence` / `X-Autoreply` headers. Duplicate inbounds are deduped on the inbound Message-ID.

**Env vars:** `AWS_UNDERWRITING_QUEUE_URL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `UNDERWRITING_INBOUND_EMAIL`, optional `UW_ANALYZER_MODEL` / `UW_TEMPLATE_FILLER_MODEL` / `UW_VALIDATOR_MODEL` / `UW_ASSUMPTION_ASKER_MODEL` / `UW_ASSUMPTION_PARSER_MODEL`.

**Notes:**

- No BullMQ — uses SQS directly. Two message types on the `underwriting` queue: `underwriting-job` (new) and `underwriting-reply-job` (reply).
- Legacy (extractor-per-doc-type) pipeline is removed; the workflow pipeline is the only path.
- Web pro forma rendering (dashboard view) is NOT yet implemented — delivery is via email attachment.

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

**Agent tools:** `query_parcels`, `get_parcel_stats` (in `DealwireAgentService`)

**Default ingestion boroughs:** Manhattan (1) + Brooklyn (3) + Queens (4) — same default for both manual `POST /public-data/ingest` and the scheduled cron.

**Auto-schedule:** `PublicDataSchedulerService` runs `@Cron(PUBLIC_DATA_REFRESH_CRON)`, default `0 3 * * 0` = Sunday 3am UTC. Gated by `PUBLIC_DATA_AUTO_REFRESH_ENABLED=true` (currently on in prod, off locally). Each source has its own freshness model — tax liens pull only the latest cycle, HPD pulls full history per parcel — see `docs/product/PUBLIC_DATA_PLATFORM.md` → Orchestration for the per-source breakdown.

**Ingestion is in-process and not durable.** `NycIngestionService.ingestAll()` and `CareScraperService.scrapeAll()` run as unawaited Promises on the API server with an in-memory `running` flag. A server restart (e.g. Railway redeploy) kills the run mid-flight — the `IngestionRun` row stays at `status: 'running'` and blocks the next trigger until manually flipped to `failed`. No queue, retry, or resumption — this is the Phase 1 limitation that BullMQ in Phase 2 is meant to fix. See `docs/product/PUBLIC_DATA_PLATFORM.md` → Orchestration for full operational details.

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

**Pattern:** Every protected controller uses `@UseGuards(ClerkAuthGuard, RequireOrgGuard)` and scopes all DB queries to `{ organizationId }`. `RequireOrgGuard` rejects requests without an org (403), so controllers receive `organizationId: string` (non-null). Never accept `organizationId` from request params — always from `@AuthUser()`.

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
