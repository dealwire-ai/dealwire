# Acquisition Underwriting Platform

## Overview

The underwriting feature moves Analyzer beyond deal screening into the full acquisition analysis workflow. The goal: JK (and similar users) should be able to email deal documents to Analyzer and get back a filled pro forma — no manual spreadsheet work required.

**Scope:** Acquisition underwriting only. Construction/development finance (G702/G703, bank draws) is explicitly out of scope for now.

## Competitive Landscape

Several products do pieces of this: **Cactus** (~$350/mo, upload → extract → fill pro forma), **QuickData.AI** (extract rent roll/T-12 into your Excel via API), **Clik.ai SmartExtract** (embeddable lender-focused extraction API), **Docsumo** (IDP platform with CRE-specific pre-trained models for rent rolls and T-12s).

None of them do email-native autonomous intake. Every product requires a human to open a dashboard and click upload. That's the moat.

---

## User Workflow (Target State)

### Setup (once per user)
1. User uploads their Excel pro forma template to the dashboard
2. System reads the template structure — Claude Opus infers which cells are inputs vs. formulas and maps field names to cell references (e.g. `"grossPotentialRent" → "Assumptions!B12"`)
3. FieldMap stored in DB per org, reused for every subsequent deal run

### Per Deal (two intake paths)

**Path A — Email trigger (primary, agentic-first)**
- User forwards OM + rent roll + T-12 to `underwrite@analyzer.ai` with "underwrite this" in subject/body
- System detects trigger, extracts all attachments, runs extraction pipeline
- System fills the stored template with extracted data
- System emails back: summary + "View Pro Forma" link + filled Excel attached

**Path B — Dashboard upload (fallback)**
- User navigates to deal page → uploads documents → clicks "Run Underwriting"
- Same pipeline, UI-initiated instead of email-triggered

### Output
- Interactive pro forma rendered in the web dashboard (editable cells, auto-recalculates)
- Excel export button always available
- Summary section in email (key metrics: CoC, DSCR, equity required, IRR estimate)

---

## Extraction Pipeline

The pipeline is code-orchestrated — no LangChain, no agent frameworks. The orchestration is plain TypeScript (`Promise.all` for fan-out, a `while` loop for the reconciler). BullMQ parent/child jobs handle durability (already in the stack).

Documents are uploaded to S3 **before** the SQS message is enqueued — same pattern as the existing email pipeline (see `email-processor.service.ts` line 114: "Attachments already in S3 from webhook"). SQS has a 256KB limit so the message carries metadata only, never file bytes.

```typescript
// SQS message shape
{
  type: 'underwriting-job',
  dealId: string,
  orgId: string,
  documents: [
    { s3Key: 'deals/{dealId}/docs/rent_roll.pdf', filename, contentType },
    { s3Key: 'deals/{dealId}/docs/t12.xlsx',      filename, contentType },
    { s3Key: 'deals/{dealId}/docs/om.pdf',         filename, contentType },
  ]
}
```

The pipeline worker calls `s3Service.downloadDealAttachment(s3Key)` on each document before passing to the classifier and extractors — identical to how `extractAllText` works today.

```
SQS job (enqueued same way as email processing)
  │
  ├─ STEP 1: CLASSIFIER
  │   Model: claude-haiku-4-5
  │   SDK: Vercel AI SDK generateObject + Zod enum
  │   Input: file list (names + extensions)
  │   Output: [{ file, type: "RENT_ROLL" | "T12" | "OM" | "UNKNOWN" }]
  │
  ├─ STEP 2: PARALLEL EXTRACTORS  (BullMQ child jobs, one per doc)
  │   SDK: Vercel AI SDK generateObject + Zod schema
  │   Model: claude-sonnet-4-6
  │
  │   PDF docs → send as Claude document block (base64)
  │   Excel docs → SheetJS parses to JSON rows first, passed as text
  │   Scanned PDFs → existing pdftoppm + vision path
  │
  │   Each extractor returns typed, validated output (no JSON.parse needed).
  │   Every field carries: { value, confidence, sourceText }
  │
  │   Rent Roll extractor schema:
  │     units[]: { unitNumber, type, sqft, currentRent, marketRent,
  │                leaseExpiry, isVacant, confidence, sourceText, flags[] }
  │
  │   T-12 extractor schema:
  │     { grossPotentialRent, vacancyLoss, effectiveGrossIncome,
  │       opex: { [category]: amount }, noi, confidence, sourceText }
  │
  │   OM extractor schema:
  │     { askPrice, capRate, noi, debtAssumptions, confidence, sourceText }
  │
  │   IF extraction accuracy is a problem in production:
  │   → Docsumo or Reducto API can replace the Claude call at this step.
  │     The interface (input doc → typed JSON output) stays the same.
  │
  ├─ STEP 3: NORMALIZER  (pure code, no LLM)
  │   Sum rent roll rows → GPI, vacancy count, unit mix
  │   Map T-12 line items to canonical expense schema
  │   Compute derived fields: EGI, NOI, vacancy rate
  │   Output: DealSnapshot
  │
  ├─ STEP 4: RECONCILER  (the only agentic loop)
  │   Model: claude-opus-4-6 + extended thinking
  │   SDK: Vercel AI SDK generateObject
  │
  │   Checks OM-stated NOI vs. T-12 computed NOI, occupancy vs. rent roll, etc.
  │   On conflict: targeted re-query on the source doc (max 2 retries)
  │   On unresolvable: adds to humanReviewFlags[], continues with lower-confidence value
  │   Extended thinking block stored verbatim as audit trail per conflict
  │
  ├─ STEP 5: CONFIDENCE GATE  (pure code)
  │   >= 0.85 → pass
  │   0.60–0.85 → flag for review, include in output
  │   < 0.60 → null in pro forma cell + marker, add to humanReviewFlags[]
  │
  └─ STEP 6: PRO FORMA FILL  (pure code)
      Load FieldMap from DB (set up once at template onboarding)
      xlsx-populate: write extracted values to input cells only
      Formula cells are never touched — xlsx-populate passes through OOXML
        directly so charts, styles, and formula dependencies survive intact
      Output: filled .xlsx buffer → S3 + email attachment
```

---

## Build Order

### Step 1 — Email trigger + document intake
- Detect "underwrite this" trigger phrase in incoming emails
- Extract and queue all attachments for processing
- Route to underwriting pipeline vs. standard deal screening pipeline
- Most of the email intake infrastructure already exists

### Step 2 — Rent roll structured extraction (hardest, highest-value)
- Handle variable formats: clean spreadsheets (Excel → SheetJS → JSON), digital PDFs (document block), scanned PDFs (existing vision path), image tables embedded in OMs
- Vercel AI SDK `generateObject` + Zod schema → typed output, auto-retry on validation failure
- Per-field confidence + sourceText on every value
- This is the core moat — extraction quality determines whether the output is actually useful

### Step 3 — T-12 / trailing financial extraction
- Same approach: Vercel AI SDK + Zod schema + claude-sonnet-4-6
- Map line items to canonical expense schema regardless of source format
- Cross-reference extracted NOI against deal-level NOI from screening (sanity check)

### Step 4 — Template onboarding + cell mapping
- SheetJS reads the user's uploaded template, serializes non-formula cells with coordinates and surrounding label context
- Claude Opus analyzes the serialized structure once → produces FieldMap
- Human reviews and confirms; stored in DB as `OrgTemplate { orgId, templateS3Key, fieldMap }`
- Never re-derived per deal — only updated when user uploads a new template

### Step 5 — Template filling + Excel export
- xlsx-populate reads template from S3, writes extracted values to mapped input cells
- Formula cells untouched; user opens in Excel and formulas recalculate natively
- Filled file → S3 (`deals/{dealId}/proforma_filled.xlsx`) + Resend email attachment

### Step 6 — Web pro forma rendering
- Render filled pro forma in the dashboard (Handsontable or Luckysheet)
- Allow cell editing with recalculation
- Export to Excel at any time
- Eventually: build a web-native pro forma we control (more defensible long-term)

---

## Key Technical Decisions

### Extraction SDK: Vercel AI SDK + claude-sonnet-4-6
- `generateObject` with Zod schemas handles schema enforcement and auto-retry
- Claude is the underlying model for all extractors — the SDK is just plumbing
- Model routing: haiku-4-5 for classifier, sonnet-4-6 for extractors, opus-4-6 for reconciler

### Document format handling
- **PDF (digital):** Send as Claude `document` block (base64). 100-page limit — most rent rolls and T-12s are well under. Large OMs: use Files API and split if needed.
- **Excel (.xlsx):** SheetJS parses to JSON rows → passed as text to Claude. Column layouts are inconsistent; Claude maps them to the schema.
- **Scanned PDF:** Existing pdftoppm + Vision API path, unchanged.

### Template write: xlsx-populate, not SheetJS
SheetJS deserializes the full workbook and re-serializes on write — it silently drops charts, advanced styles, and formula dependencies it doesn't understand. xlsx-populate manipulates raw OOXML XML directly and never touches markup it doesn't own. Input cells get written; everything else survives intact. Use SheetJS only for *reading* the template at setup time.

### Orchestration: plain TypeScript + dedicated SQS queue
No LangChain, no agent frameworks. The pipeline is `Promise.all` for parallel extraction and a `while` loop for the reconciler.

A **dedicated underwriting queue** keeps it fully separate from deal screening — independent visibility timeout, independent error handling, no risk of a slow underwriting job affecting email pipeline throughput.

| | Email pipeline | Underwriting pipeline |
|---|---|---|
| Queue name | `normalized-email` | `underwriting` |
| Visibility timeout | 300s (5 min) | 600s (10 min) |
| Listener | `NormalizedEmailListenerService` | `UnderwritingListenerService` |
| Processor | `EmailProcessorService` | `UnderwritingPipelineService` |
| Module | `EmailProcessorModule` | `UnderwritingModule` |
| Queue URL env var | `AWS_NORMALIZED_EMAIL_QUEUE_URL` | `AWS_UNDERWRITING_QUEUE_URL` |

`UnderwritingListenerService` is the orchestrator — it receives the SQS message and calls `UnderwritingPipelineService.run()`, which executes all pipeline steps sequentially/in parallel and awaits the result before the message is acknowledged. Same pattern as `NormalizedEmailListenerService` calling `EmailProcessorService.process()` today.

### Extraction accuracy fallback
Start with Claude native. If rent roll extraction accuracy is a problem on real documents, Docsumo (CRE-specific pre-trained models, 98-99% claimed) or Reducto (highest accuracy on scanned tables, per-field citations) can replace the Claude call at the extraction step. The interface — document in, typed JSON out — stays the same.

### Template approach: fill user's template first, build web-native second
- **Phase 1:** Parse and fill JK's existing Excel template. He gets his own model back, pre-filled. No workflow change for him.
- **Phase 2:** Build a web-native interactive pro forma we control. More defensible as a product. Export to Excel anytime.

---

## Library Choices

| Purpose | Library |
|---------|---------|
| Extraction API | Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) |
| Schema enforcement | Zod (via `generateObject`) |
| Read Excel templates | SheetJS (`xlsx`) |
| Write Excel templates | xlsx-populate (`@xlsx/xlsx-populate` fork) |
| Browser spreadsheet rendering | Handsontable or Luckysheet |
| Async job queue | SQS (existing pattern in codebase) |
| PDF (digital) | Claude document block (native) |
| PDF (scanned) | Existing pdftoppm + Vision API |

---

## What to Get from JK First

- **His Excel pro forma template** — everything else depends on seeing the structure. How many input cells, what assumptions, scenario tabs, etc.
- **Sample rent roll and T-12** — need real documents to test extraction against before building the pipeline

---

## Relationship to Existing Roadmap

This feature spans multiple existing roadmap items:
- **Phase 1 — Attachment intelligence** (rent rolls, T-12 extraction) is the prerequisite
- **Phase 4 — Underwriting automation** is the pro forma generation
- **Phase 4 — Document management** is the storage layer for uploaded deal docs

The email trigger path also aligns with Phase 3 multi-channel intake.
