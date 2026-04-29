# Acquisition Underwriting Platform

## Implementation Status (as of Apr 2026)

The pipeline is now **interactive and multi-turn**. On a new deal email the agent analyzes the docs but does NOT run the pro forma — it replies asking for the investor's underwriting assumptions. Each subsequent investor reply is routed by `ReplyRouterService` into one of three intents:

- **apply** — the reply contains values to use ("rate 5.5%, LTV 70"). The agent runs the pro forma and emails back the filled Excel.
- **answer** — the reply asks a question or comments without supplying values ("what does cap rate mean?", "is that all?"). The agent answers in-thread and waits for further input — no fill is triggered.
- **clarify** — the reply contains values but at least one is unparseable. The agent asks for clarification and parks the run in `WAITING_FOR_CLARIFICATION`.

Follow-up replies to the filled model (e.g. "what if rate drops to 5.5%") re-run with updated assumptions, with the prior values carried forward.

This replaces the previous "run the pro forma immediately from documents alone" flow, which was producing unusable output (negative returns, zero reno assumed) because it was filling investor-assumption cells with defaults.

| Step                                           | Status | Notes                                                                               |
| ---------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| Email inbound + reply correlation              | ✅     | `UnderwritingInboundService` — In-Reply-To + subject-token fallback                 |
| Deal analysis (single-pass)                    | ✅     | `DealAnalyzerService`, Sonnet-4-6                                                   |
| Assumption ask (tailored per template)         | ✅     | `AssumptionAskerService`, Sonnet-4-6 prunes canonical list against blue input cells |
| Reply router (apply / answer / clarify)        | ✅     | `ReplyRouterService`, Sonnet-4-6, `<user_reply>` sandbox + flat Zod schema          |
| Conversational answer (no fill)                | ✅     | `AssumptionEmailService.sendAnswerEmail` — replies to questions in-thread           |
| Template fill (analysis + assumptions)         | ✅     | `TemplateFillerService`, Sonnet-4-6 + xlsx-populate                                 |
| QA validator + auto-corrections                | ✅     | `ProformaValidatorService`                                                          |
| Email delivery (with deterministic Message-ID) | ✅     | `AgenticDeliveryService`                                                            |
| Re-run on reply to COMPLETED                   | ✅     | `runRerunPhase` creates child `UnderwritingRun` via `parentRunId`                   |
| Web pro forma rendering                        | ❌     | Dashboard view of filled pro forma                                                  |

**Legacy pipeline removed:** the extractor-per-doc-type orchestrator (classifier → OM/rent-roll/T-12 extractors → reconciler) has been deleted. The agentic pipeline is the only path. `AGENTIC_UNDERWRITING_ENABLED` no longer exists.

---

## Overview

The underwriting feature moves Analyzer beyond deal screening into the full acquisition analysis workflow. The goal: JK (and similar users) should be able to email deal documents to Analyzer and get back a filled pro forma — no manual spreadsheet work required.

**Scope:** Acquisition underwriting only. Construction/development finance (G702/G703, bank draws) is explicitly out of scope for now.

## Competitive Landscape

Several products do pieces of this: **Cactus** (~$350/mo, upload → extract → fill pro forma), **QuickData.AI** (extract rent roll/T-12 into your Excel via API), **Clik.ai SmartExtract** (embeddable lender-focused extraction API), **Docsumo** (IDP platform with CRE-specific pre-trained models for rent rolls and T-12s).

None of them do email-native autonomous intake. Every product requires a human to open a dashboard and click upload. That's the moat.

---

## User Workflow

### Setup (once per org)

1. User uploads their Excel pro forma template via `POST /underwriting/proforma` (or the dashboard, when wired up).
2. `ProformaService` scans the workbook and detects blue-formatted input cells. The template is marked `isReady` and `isDefault` and stored in S3.
3. The same template is reused for every subsequent deal run — never re-derived per deal.

### Per deal (email-driven)

1. User forwards OM + rent roll + T-12 to the underwriting inbound address (`UNDERWRITING_INBOUND_EMAIL`).
2. `UnderwritingInboundService` writes attachments to S3 and enqueues an `underwriting-job` SQS message. No trigger phrase is required — any email to that address that isn't a reply on an existing thread starts a new run.
3. The agent analyzes the documents, then **replies asking for the investor's underwriting assumptions** (interest rate, LTV, exit cap, hold, growth, etc.) — not a filled pro forma.
4. The investor replies inline with values. The agent fills the template and emails back the filled `.xlsx` with a summary of key metrics, applied assumption changes, and any QA flags.
5. Any subsequent reply (e.g. "what if rate drops to 5.5%") re-runs the model with the new values, carrying forward everything else.

A dashboard upload path exists at the API level but the UI is not yet built.

---

## Architecture

The pipeline is code-orchestrated — no LangChain, no agent frameworks, no agent loops. NestJS services run a fixed sequence of LLM-augmented steps; the model is called at decision points but never decides what runs next. (The directory is named `agentic/` for legacy reasons; functionally it's a workflow.)

Documents land in S3 **before** the SQS message is enqueued (same pattern as the email pipeline). SQS has a 256 KB body limit, so the message carries metadata only.

```typescript
// New job
{
  type: 'underwriting-job',
  dealId: string,
  orgId: string,
  senderEmail: string,
  emailSubject?: string,
  documents: [{ s3Key, filename, contentType }, ...],
  inReplyToMessageId?: string,
}

// Reply on an existing thread
{
  type: 'underwriting-reply-job',
  parentRunId: string,
  senderEmail: string,
  rawBody: string,
  inboundMessageId?: string,
  inReplyToMessageId?: string,
}
```

### Phase 1 — Analysis (new email)

`AgenticUnderwritingService.runAnalysisPhase()`:

1. Load the org's default proforma template from S3.
2. `DealAnalyzerService.analyze(documents)` — single Sonnet call. PDFs go in as native Claude `file` parts (base64). Excel/CSV are converted to text via SheetJS first. Output is a `DealAnalysis` JSON validated against a Zod schema (property info, pricing, full income/expense breakdown, unit mix, NOI, occupancy, missingDocs, flags, confidence).
3. `AssumptionAskerService.generateQuestions(analysis, workbook)` — Sonnet prunes the canonical assumption list (`CANONICAL_ASSUMPTIONS` in `assumption-types.ts`) to the questions this template actually needs, using the workbook's blue input cells for context.
4. `AssumptionEmailService.sendQuestionsEmail` — sends the asks email with a deterministic Message-ID and persists it to `UnderwritingRunMessage`.
5. Run status moves to `WAITING_FOR_ASSUMPTIONS`.

### Phase 2 — Reply routing (any inbound reply)

`ReplyRouterService.route()` — single Sonnet call returns one of three intents:

- **apply** — reply contains assumption values. Run the fill phase.
- **answer** — reply is a question or comment. Compose a short answer and send it in-thread; do NOT trigger a fill.
- **clarify** — reply contains values but at least one is unparseable. Send a clarification email and park the run in `WAITING_FOR_CLARIFICATION`.

The router carries the prior conversation transcript and prior assumption values so unmentioned fields inherit. The user reply is wrapped in `<user_reply>...</user_reply>` and the system prompt explicitly treats anything inside as untrusted data.

### Phase 3 — Fill (apply intent on a WAITING run)

`AgenticUnderwritingService.runFillPhase()`:

1. Optimistic-lock the run from `WAITING_*` → `RUNNING`. If another worker already grabbed it, skip.
2. Load the proforma template into `xlsx-populate`.
3. `TemplateFillerService.mapToTemplate(analysis, assumptions, workbook)` — Sonnet produces `{ sheet, cell, value }` mappings for blue input cells only. Formula cells are never written.
4. `ProformaValidatorService.validate(filledBuffer, analysis)` — second-pass Sonnet QA: stale data from prior deal use, value accuracy, missing fills, internal consistency, hallucinations. Produces corrections that are written back to the workbook.
5. `AgenticDeliveryService.deliver()` — sends an HTML email (key metrics + flags + applied changes) with the filled `.xlsx` attached, threaded back into the conversation.
6. Run status moves to `COMPLETED`.

### Phase 4 — Re-run (apply intent on a COMPLETED run)

`AgenticUnderwritingService.runRerunPhase()`:

1. Create a child `UnderwritingRun` with `parentRunId` set, inheriting the parent's `extractionSnapshot`, `askedAssumptions`, and `proformaId`.
2. Merge the new assumption values over the parent's `receivedAssumptions` (unmentioned fields carry forward).
3. Run the fill phase on the child.

The thread anchor is the root of the parent chain so all replies stay in one conversation.

---

## State machine

```
NEW EMAIL
  │
  ▼
RUNNING ──► WAITING_FOR_ASSUMPTIONS ──reply (apply)──► RUNNING ──► COMPLETED
                       │                                              │
                       │                                              │
                  reply (clarify)                                reply (apply)
                       │                                              │
                       ▼                                              ▼
            WAITING_FOR_CLARIFICATION ─reply (apply)─► RUNNING    new child
                                                                  RUNNING → COMPLETED

  Any phase: reply (answer)  → in-thread answer email; status unchanged.
  Any phase: hard failure    → FAILED.
```

State lives in two Postgres tables:

- `UnderwritingRun` — run-level: `status`, `extractionSnapshot`, `askedAssumptions`, `receivedAssumptions`, `parentRunId`, costs, flags, timestamps.
- `UnderwritingRunMessage` — every inbound + outbound email, keyed by RFC 5322 Message-ID with a unique constraint.

## Email threading

Every outbound email is sent with a deterministic Message-ID:

```
<uw-{runId}-{ask|clarify|answer|deliver}-{uuid}@mail.dealwire.ai>
```

That Message-ID is persisted to `UnderwritingRunMessage`. Inbound replies are correlated:

1. **Primary:** `In-Reply-To` header → `UnderwritingRunMessage.messageId` lookup.
2. **Fallback:** `[UW-{runShortId}]` token in the subject (used when the client strips In-Reply-To).

Auto-replies are dropped via the `Auto-Submitted`, `Precedence`, and `X-Autoreply` headers. Duplicate inbounds are deduped on the inbound Message-ID's unique constraint.

---

## File structure

```
apps/api/src/service/underwriting/
  underwriting-inbound.service.ts      # Resend inbound: download attachments → S3 → SQS
  underwriting-listener.service.ts     # SQS consumer: dispatches new-job / reply-job
  underwriting-types.ts
  proforma.service.ts                  # Template CRUD + blue-cell scan
  excel-utils.ts                       # SheetJS helpers (excelToText, excelToTextWithCellRefs)
  model-config.ts                      # Per-stage model selection from env

  agentic/                             # workflow steps (the directory name is legacy — there is no agent loop)
    agentic-underwriting.service.ts    # Orchestrator: runAnalysisPhase / runFillPhase / runRerunPhase
    agentic-types.ts                   # DealAnalysisSchema, CellMappingSchema, ValidationResultSchema
    deal-analyzer.service.ts           # Single-pass deal analysis (Sonnet)
    assumption-asker.service.ts        # Prune canonical questions per template (Sonnet)
    assumption-email.service.ts        # Outbound ask / clarify / answer emails (deterministic Message-ID)
    assumption-types.ts                # CANONICAL_ASSUMPTIONS, UserAssumptions
    assumption-diff.ts                 # "Applied changes" block for delivery emails
    reply-router.service.ts            # Classify investor reply: apply | answer | clarify (Sonnet)
    template-filler.service.ts         # Map deal data + assumptions → cell writes (Sonnet)
    proforma-validator.service.ts      # Second-pass QA + corrections (Sonnet)
    agentic-delivery.service.ts        # Outbound delivery email + .xlsx attachment
    workbook-serializer.ts             # Blue-input-cell detection + serialization
    thread-subject.ts                  # Subject token + property label

apps/api/src/controller/underwriting/
  proforma.controller.ts               # /underwriting/proforma REST endpoints
  underwriting-dev.controller.ts       # Dev-only triggers

apps/api/src/module/
  underwriting.module.ts
```

---

## Rate limiting

Every model call uses the Vercel AI SDK's `generateObject` with `maxRetries: 2`. The SDK handles retry on transient failures (including 429s) with exponential backoff. There are no hand-coded retry loops in service code.

Sonnet's 10k TPM limit on lower-tier plans is the practical bottleneck. The pipeline is sequential within a run, so concurrent pressure comes from multiple runs in flight at once. If rate limiting becomes a recurring issue, the right next step is centralizing all model calls behind a single gateway with global rate-limit handling — not adding bespoke retry logic in individual services.

---

## Key technical decisions

### Single-pass analysis vs per-doc-type extractors

The original plan had a classifier + per-doc-type extractors (rent roll, T-12, OM) with a downstream reconciler. The implemented version replaces this with **one Sonnet call** that reads all documents at once. Rationale: cheaper (one call instead of N), more consistent (the model reconciles in-context instead of through an external rule set), and easier to reason about. The extractor split would only earn its complexity if extraction accuracy on real documents required per-doc tuning that's too verbose for one prompt.

### Document format handling

- **Digital PDF** — sent as a Vercel AI SDK `file` part (base64). Native Claude PDF support; works well up to 100 pages.
- **Excel (.xlsx, .csv)** — parsed by SheetJS to text and passed inline.
- **Scanned PDF** — would route through the existing `pdftoppm` + Vision API path used by email screening; not yet wired into the underwriting pipeline.

### Template write: xlsx-populate, not SheetJS

SheetJS deserializes the full workbook and re-serializes on write — it silently drops charts, advanced styles, and formula dependencies it doesn't understand. xlsx-populate manipulates raw OOXML directly and never touches markup it doesn't own. Input cells get written; everything else survives. SheetJS is used only for _reading_ the template at setup time.

### Orchestration: plain TypeScript + a dedicated SQS queue

The pipeline is plain `await` calls with optimistic-lock state transitions in Postgres. There is no BullMQ, LangChain, or workflow engine. A dedicated `underwriting` SQS queue keeps it isolated from email screening:

|                    | Email pipeline                   | Underwriting pipeline         |
| ------------------ | -------------------------------- | ----------------------------- |
| Queue name         | `normalized-email`               | `underwriting`                |
| Visibility timeout | 300s                             | 600s                          |
| Listener           | `NormalizedEmailListenerService` | `UnderwritingListenerService` |
| Queue URL env var  | `AWS_NORMALIZED_EMAIL_QUEUE_URL` | `AWS_UNDERWRITING_QUEUE_URL`  |

Two message types ride the underwriting queue: `underwriting-job` (new) and `underwriting-reply-job` (reply on an existing thread).

### Extraction accuracy fallback

If single-pass Claude extraction underperforms on real documents, a CRE-specific IDP (Docsumo, Reducto) can be slotted in as the source of structured rent-roll/T-12 data. The interface — documents in, typed JSON out — stays the same. We're not there yet.

### Template approach

- **Phase 1 (current):** fill the user's existing Excel template. JK gets his own model back, pre-filled.
- **Phase 2 (future):** build a web-native interactive pro forma we control. Export to Excel anytime.

---

## Library choices

| Purpose               | Library                                                       |
| --------------------- | ------------------------------------------------------------- |
| LLM calls             | Vercel AI SDK (`ai` + `@ai-sdk/anthropic` + `@ai-sdk/openai`) |
| Schema enforcement    | Zod (via `generateObject`)                                    |
| Read Excel templates  | SheetJS (`xlsx`)                                              |
| Write Excel templates | xlsx-populate                                                 |
| Async job transport   | AWS SQS (existing pattern)                                    |
| PDF (digital)         | Claude `file` block (native)                                  |
| PDF (scanned)         | Existing `pdftoppm` + Vision API (not yet wired in)           |

---

## What to Get from JK First

- **His Excel pro forma template** — everything else depends on seeing the structure. How many input cells, what assumptions, scenario tabs, etc.
- **Sample rent roll and T-12** — need real documents to test extraction against before building the pipeline

## Relationship to Existing Roadmap

This feature spans multiple existing roadmap items:

- **Phase 1 — Attachment intelligence** (rent rolls, T-12 extraction) is the prerequisite
- **Phase 4 — Underwriting automation** is the pro forma generation
- **Phase 4 — Document management** is the storage layer for uploaded deal docs

The email trigger path also aligns with Phase 3 multi-channel intake.
