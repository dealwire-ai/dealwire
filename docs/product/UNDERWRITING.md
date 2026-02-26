# Acquisition Underwriting Platform

## Overview

The underwriting feature moves Analyzer beyond deal screening into the full acquisition analysis workflow. The goal: JK (and similar users) should be able to email deal documents to Analyzer and get back a filled pro forma — no manual spreadsheet work required.

**Scope:** Acquisition underwriting only. Construction/development finance (G702/G703, bank draws) is explicitly out of scope for now.

## User Workflow (Target State)

### Setup (once per user)
1. User uploads their Excel pro forma template to the dashboard
2. System reads the template structure and maps extracted deal fields to input cells (AI-inferred or manual mapping)
3. Template is stored and reused for all future underwriting runs

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

## Build Order

### Step 1 — Email trigger + document intake (builds on existing infra)
- Detect "underwrite this" trigger phrase in incoming emails
- Extract and queue all attachments for processing
- Route to underwriting pipeline vs. standard deal screening pipeline
- Most of the email intake infrastructure already exists

### Step 2 — Rent roll structured extraction (the hardest, highest-value piece)
- Parse per-unit data from documents: unit number, type, sqft, current rent, market rent, lease expiration, vacancy status
- Handle variable formats: clean spreadsheets, scanned PDFs, image tables in OMs
- Structured output with confidence scores per field
- This is the core moat — extraction quality determines whether the output is actually useful

### Step 3 — T-12 / trailing financial extraction
- Parse income/expense statements: gross revenue, vacancy loss, each opex category, NOI
- Map to standardized expense schema regardless of source format
- Cross-reference extracted NOI against deal-level NOI from screening (sanity check)

### Step 4 — Template filling + Excel export
- Use SheetJS to read user's Excel template, identify input cells vs. formula cells
- Map extracted fields to template inputs
- Write back a filled Excel file with formulas preserved
- Return filled file via email + store in S3 for dashboard access

### Step 5 — Web pro forma rendering
- Render filled pro forma in the dashboard (Handsontable or Luckysheet)
- Allow cell editing with recalculation
- Export to Excel at any time
- Eventually: build a web-native pro forma we control (better long-term than filling user templates)

## Key Technical Decisions

### Template approach: fill user's template first, build web-native second
- **Phase 1:** Parse and fill JK's existing Excel template. He gets his own model back, pre-filled. No workflow change.
- **Phase 2:** Build a web-native interactive pro forma we control. More defensible as a product. Export to Excel anytime.

### Library choices
- **SheetJS (`xlsx`)** — read/write Excel, preserve formulas
- **Handsontable or Luckysheet** — browser spreadsheet rendering
- **Existing PDF/OCR pipeline** — already handles image-only PDFs via pdftoppm + Vision API

## What to Get from JK First

- **His Excel pro forma template** — everything else depends on seeing the structure. How many input cells, what assumptions, scenario tabs, etc.
- **Sample rent roll and T-12** — need real documents to test extraction against before building the pipeline

## Relationship to Existing Roadmap

This feature spans multiple existing roadmap items:
- **Phase 1 — Attachment intelligence** (rent rolls, T-12 extraction) is the prerequisite
- **Phase 4 — Underwriting automation** is the pro forma generation
- **Phase 4 — Document management** is the storage layer for uploaded deal docs

The email trigger path also aligns with Phase 3 multi-channel intake.
