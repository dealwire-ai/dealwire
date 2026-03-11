# Underwriting v1 — Drag & Drop + Chat Interface

## Context

JK wants to move beyond deal screening into actual underwriting. The v1 is deliberately minimal: a dedicated page where you drop deal documents (OM, rent roll, T-12) and chat with an AI that has read them. No email trigger, no pro forma template filling yet — that's v2. Ship something useful fast.

## What We're Building

**Page: `/underwriting`**

Two-panel layout:

- **Left:** Drag-and-drop upload zone + uploaded file list with extraction status
- **Right:** Streaming chat panel (same pattern as existing chatbot) — AI has full context of all uploaded docs

User flow:

1. Drop OM, rent roll, T-12 onto the page
2. System extracts text from each doc (PDF → pdftotext/OCR, same pipeline already built)
3. Chat with the AI — ask deal math questions, get NOI analysis, spot red flags, etc.
4. Session persists so JK can come back to it

---

## Backend Plan

### 1. Prisma Schema — 2 new models

```prisma
model UnderwritingSession {
  id             String                  @id @default(cuid())
  organizationId String
  createdByUserId String
  name           String?                 // e.g. "123 Main St Deal"
  documents      UnderwritingDocument[]
  createdAt      DateTime                @default(now())
  updatedAt      DateTime                @updatedAt
}

model UnderwritingDocument {
  id            String              @id @default(cuid())
  sessionId     String
  session       UnderwritingSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  filename      String
  contentType   String
  sizeBytes     Int
  s3Key         String
  extractedText String?             @db.Text
  status        String              @default("pending") // pending | extracting | ready | failed
  createdAt     DateTime            @default(now())
}
```

Generate migration: `cd apps/api && npx prisma migrate dev --name add_underwriting_models`

### 2. New NestJS Module: `UnderwritingModule`

**Controller:** `apps/api/src/controller/underwriting.controller.ts`
Base route: `/underwriting`

| Method   | Route                                         | Purpose                           |
| -------- | --------------------------------------------- | --------------------------------- |
| `POST`   | `/underwriting/sessions`                      | Create new session                |
| `GET`    | `/underwriting/sessions`                      | List sessions for org (paginated) |
| `GET`    | `/underwriting/sessions/:id`                  | Get session + documents           |
| `POST`   | `/underwriting/sessions/:id/documents`        | Upload doc (multipart/form-data)  |
| `DELETE` | `/underwriting/sessions/:id/documents/:docId` | Remove a doc                      |
| `POST`   | `/underwriting/sessions/:id/chat`             | Streaming chat with doc context   |

**Service:** `apps/api/src/service/underwriting/underwriting.service.ts`

Key methods:

- `createSession(orgId, userId, name?)` → `UnderwritingSession`
- `uploadDocument(sessionId, file: Express.Multer.File)` → upload to S3 (`underwriting/{sessionId}/{filename}`), create `UnderwritingDocument` with `status: 'extracting'`, kick off async text extraction
- `extractText(docId)` → reuse `pdf-parser.ts` for PDFs, `ImageProcessorService` for images. Update `extractedText` + `status: 'ready'`
- `buildContext(sessionId)` → fetch all ready docs, concatenate `extractedText` blocks (same pattern as `extractAllText` in `email-processor.service.ts`)
- `chat(sessionId, messages[])` → inject doc context as system prompt, stream via Vercel AI SDK (same pattern as `DealwireAgentService.stream()`)

**Reuse these existing pieces:**

- `apps/api/src/util/pdf-parser.ts` — PDF text extraction (already handles pdftotext + Vision OCR fallback)
- `apps/api/src/service/email/image-processor.service.ts` — image OCR
- `apps/api/src/service/s3/s3.service.ts` — `uploadDealAttachment()` or a new `uploadUnderwritingDocument()`
- Vercel AI SDK streaming — copy the pattern from `DealwireAgentService.stream()`

**File upload:** use `@nestjs/platform-express` `FileInterceptor` with `multer` (already a NestJS dep). Accept PDF, XLSX, DOCX, images.

**Module:** `apps/api/src/module/underwriting.module.ts`
Imports: `PrismaModule`, `S3Module`, `EmailServicesModule` (for ImageProcessorService)
Provides: `UnderwritingService`, `ClerkAuthGuard`

---

## Frontend Plan

### New Page: `apps/web/src/app/underwriting/page.tsx`

`"use client"` — follows the same auth + useApi pattern as other pages.

**Layout:** Two-column, full-height below nav

```
┌─────────────────────┬──────────────────────────────────┐
│  Documents          │  Chat                            │
│                     │                                  │
│  ┌───────────────┐  │  ┌────────────────────────────┐  │
│  │  Drop files   │  │  │ AI: I've read 3 documents. │  │
│  │  here         │  │  │ Ask me anything about the  │  │
│  │  (or click)   │  │  │ deal.                      │  │
│  └───────────────┘  │  │                            │  │
│                     │  │ You: What's the DSCR if    │  │
│  ✓ OM.pdf    2.1MB  │  │ I put 35% down at 7%?     │  │
│  ✓ rent-roll.xlsx   │  │                            │  │
│  ⟳ t12.pdf          │  │ AI: Based on the T-12 NOI  │  │
│                     │  │ of $847K...                │  │
│                     │  └────────────────────────────┘  │
│                     │  ┌────────────────────────────┐  │
│                     │  │ Type a message...      [→] │  │
│                     │  └────────────────────────────┘  │
└─────────────────────┴──────────────────────────────────┘
```

**Key components:**

- `components/underwriting/document-drop-zone.tsx` — HTML5 drag-and-drop (`onDragOver`, `onDrop`) + click-to-browse fallback. Calls `POST /underwriting/sessions/:id/documents` with `FormData`. Shows per-file status: uploading → extracting → ready / failed. Polls doc status every 2s while any doc is `extracting`.
- `components/underwriting/underwriting-chat.tsx` — Streaming chat using `useChat()` from `ai/react` (same hook as existing chatbot). Points to `/api/underwriting-chat` Next.js route handler which proxies to `POST /underwriting/sessions/:id/chat`. Disabled with tooltip while docs are still extracting.
- `apps/web/src/app/api/underwriting-chat/route.ts` — Next.js route handler that forwards streaming response from backend (same pattern as existing `/api/chat` route)

**State management:**

- On page load: `POST /underwriting/sessions` to create (or load latest session)
- Session ID stored in component state, passed to all API calls
- File list stored in component state + re-fetched from `GET /underwriting/sessions/:id`

**Navigation:** Add "Underwriting" link to dashboard nav alongside Deals / Contacts / Properties.

**shadcn components to use:** `Card`, `Button`, `Input`, `Badge` (for doc status), `ScrollArea` (chat history). No new component installs needed.

---

## Files to Create

**Backend:**

- `apps/api/src/controller/underwriting.controller.ts`
- `apps/api/src/service/underwriting/underwriting.service.ts`
- `apps/api/src/module/underwriting.module.ts`
- `apps/api/prisma/migrations/..._add_underwriting_models/` (auto-generated)

**Frontend:**

- `apps/web/src/app/underwriting/page.tsx`
- `apps/web/src/app/api/underwriting-chat/route.ts`
- `apps/web/src/components/underwriting/document-drop-zone.tsx`
- `apps/web/src/components/underwriting/underwriting-chat.tsx`

**Modified:**

- `apps/api/prisma/schema.prisma` — add 2 new models
- `apps/api/src/app.module.ts` — import `UnderwritingModule`
- `apps/web/src/app/dashboard/page.tsx` — add nav link (or wherever nav lives)

---

## Build Order (separate commits)

1. **Prisma schema + migration** — `UnderwritingSession` + `UnderwritingDocument` models
2. **Backend service + controller** — upload, extract, chat endpoints
3. **Backend module wiring** — register in app.module.ts
4. **Frontend drop zone** — upload UI, file list, status polling
5. **Frontend chat** — streaming chat panel, route handler
6. **Nav link + polish** — wire into dashboard nav, empty states, error handling

---

## Verification

- Upload a PDF (OM) → status goes `extracting` → `ready`
- Upload an XLSX rent roll → same flow (text extraction from spreadsheet)
- Chat: "What's the cap rate on this deal?" → AI responds with data from docs
- Chat: "If I put 35% down at 7% over 25 years, what's the DSCR?" → AI computes from extracted NOI
- Delete a doc → removed from chat context on next message
- Create new session → clean slate
