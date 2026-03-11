# Backend Architecture (`apps/api`)

## Core Email Processing Flow

1. **Microsoft Graph Webhook** (`/webhooks/microsoft`)
   - Receives `email.received` notifications from Microsoft Graph
   - Validates subscription and clientState for security

2. **Deal Detection** (`DealDetectionService`)
   - Quick AI classification using `gpt-4o-mini`
   - Determines if email is about a real estate deal (teaser, OM, acquisition opportunity)
   - Skips non-deal emails to save processing resources

3. **Email Processing** (`EmailProcessingService`)
   - Extracts text from email body
   - Downloads and OCRs PDF attachments using `pdf-parse`
   - Combines all text for analysis

4. **Deal Summary + Narrative** (`DealSummaryService`)
   - Uses AI to generate structured summary of the deal
   - Extracts key metrics: price, cap rate, NOI, location, property type, etc.
   - Applies client-specific criteria for emphasis
   - Generates 3-5 sentence "Deal Narrative" (conversational story) in parallel with summary

5. **Deal Decision** (`DealDecisionService`)
   - AI evaluates deal against client's HARD REQUIREMENTS
   - Returns yes/no decision with reasoning
   - Criteria are non-negotiable (e.g., "New York only" means NJ = automatic no)

6. **Action Card + Reply** (`EmailProcessorService` → `EmailTemplateService`)
   - Builds action card with: Outlook webLink, pre-signed S3 doc URLs, deal room links, CA links, broker stats
   - Formats HTML email with decision, narrative ("The Story"), action card, and summary
   - Sends reply in same conversation thread via Graph API
   - Prevents infinite loops by skipping self-sent emails

7. **Broker Reply Draft** (`DealSummaryService.generateBrokerReplyDraft`)
   - Generates relationship-aware draft reply to broker (not the internal analysis)
   - Enriched with broker history (deal count, pass rate, recent deals, notes)
   - Detects missing data fields and asks smart follow-up questions
   - Created as unsent draft in user's Outlook Drafts folder

8. **Folder Organization**
   - "No" decisions: email is moved to configurable folder (default: "Passed Deals")
   - "Yes" decisions: email stays in inbox with analysis reply

---

## Key Services

### Microsoft Module (`src/module/microsoft.module.ts`)

| Service                            | Purpose                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `MicrosoftGraphService`            | Microsoft Graph API calls: get messages, attachments, create/send replies, manage folders |
| `MicrosoftSubscriptionService`     | Create/renew/delete Graph subscriptions, stored in DB                                     |
| `MicrosoftWebhookService`          | Handle incoming Graph notifications, orchestrate processing pipeline                      |
| `MicrosoftRenewalSchedulerService` | Cron job (every 12 hours) to renew expiring subscriptions                                 |

### Deal Analysis Module (`src/module/ai.module.ts` — `DealAnalysisModule`)

| Service                | Purpose                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| `DealDetectionService` | Quick deal vs. non-deal classification                                    |
| `DealSummaryService`   | Generate structured deal summary, deal narrative, and broker reply drafts |
| `DealDecisionService`  | Yes/no decision based on client criteria                                  |

### Email Services Module (`src/module/email.module.ts` — `EmailServicesModule`)

| Service                  | Purpose                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `EmailProcessingService` | Extract text from emails and PDFs                                                                                             |
| `EmailSenderService`     | Send emails via Resend. Accepts optional `from` override — used by underwriting delivery to send as "AI Underwriting Analyst" |
| `EmailTemplateService`   | Format HTML email with branding                                                                                               |

### Preferences Module (`src/module/preferences.module.ts`)

| Service                       | Purpose                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `ScreeningPreferencesService` | Load screening preferences from database                                      |
| `ScreeningBucketService`      | CRUD for screening buckets                                                    |
| `BrokerIntelligenceService`   | Broker stats (deal count, pass rate, top cities), leaderboard, digest context |

### Webhook Module (`src/module/webhook.module.ts`)

| Controller                   | Purpose                              |
| ---------------------------- | ------------------------------------ |
| `ClerkWebhookController`     | Handle Clerk user lifecycle events   |
| `MicrosoftWebhookController` | Handle Microsoft Graph notifications |
| `ResendWebhookController`    | Handle Resend email events (legacy)  |

### Underwriting Module (`src/module/underwriting.module.ts`)

End-to-end pipeline: email inbound → classify → extract → normalize → fill pro forma → deliver.

| Service                           | Purpose                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `UnderwritingInboundService`      | Resend inbound handler — downloads attachments, uploads to S3, enqueues SQS job |
| `UnderwritingListenerService`     | SQS consumer for `underwriting` queue (600s visibility timeout)                 |
| `UnderwritingOrchestratorService` | Pipeline runner — coordinates Steps 1-7                                         |
| `DocumentClassifierService`       | Step 1: classify documents by filename (Haiku)                                  |
| `OMExtractorService`              | Step 2: extract OM fields (Sonnet-4-6)                                          |
| `RentRollExtractorService`        | Step 2: extract rent roll unit data (Sonnet-4-6)                                |
| `T12ExtractorService`             | Step 2: extract T-12 financials (Sonnet-4-6)                                    |
| `GenericExtractorService`         | Step 2: extract fields from unclassified docs (Sonnet-4-6)                      |
| `NormalizerService`               | Steps 3+4: derive computed fields + reconcile cross-doc conflicts (pure code)   |
| `ProformaFillService`             | Step 6: AI field mapper (Sonnet-4-6) + xlsx-populate write                      |
| `DeliveryService`                 | Step 7: build HTML summary + send filled .xlsx via Resend                       |
| `ProformaService`                 | Template CRUD + field map management                                            |

**SQS queue:** `underwriting` — env var `AWS_UNDERWRITING_QUEUE_URL`, visibility timeout 600s

**Pipeline summary:**

```
Resend inbound → UnderwritingInboundService
  → S3 upload → SQS enqueue
  → UnderwritingListenerService → UnderwritingOrchestratorService.run()
      Step 1: classify (Haiku)
      Step 2: extract in parallel — OM + rent roll + T-12 + generic (Sonnet-4-6)
      Steps 3+4: normalize + reconcile (pure code)
      Step 5: confidence gate (pure code)
      Step 6: AI mapper + proforma fill (Sonnet-4-6 + xlsx-populate)
      Step 7: deliver email with .xlsx attachment (Resend)
```

**Rate limiting:** Sonnet 10k TPM — `ProformaFillService` retries with 65s → 90s backoff on 429.

**Env vars:** `AWS_UNDERWRITING_QUEUE_URL`, `ANTHROPIC_API_KEY`, `UNDERWRITING_INBOUND_EMAIL`

### Other Services

| Service               | Purpose                                                                           |
| --------------------- | --------------------------------------------------------------------------------- |
| `ClerkWebhookService` | User creation → create Graph subscription; User deletion → cleanup                |
| `DealDigestService`   | Scheduled digest emails with action links, broker context, org stats, leaderboard |
| `PrismaService`       | Database access (PostgreSQL via Supabase)                                         |

---

## Client Preferences (Database)

Preferences are stored in the `ScreeningPreferences` table, with a required one-to-one relation to `Organization`. Each organization has exactly one ScreeningPreferences record.

Fields:

- `companyName` - Company name for email branding
- `brandColor` - Hex color code for email branding
- `passedFolderName` - Folder name for passed/rejected deals (default: "Passed Deals")
- `dealCriteria` - Criteria for AI to evaluate deals against
- `alwaysSkip` - Criteria for deals to always skip
- Logo comes from Organization `imageUrl` (not stored on ScreeningPreferences) (checked via AI in deal detection)

Preferences are automatically created when an Organization is created via Clerk webhooks. The `ScreeningPreferencesService` loads preferences by `organizationId`.

---

## Environment Variables (API)

| Variable                         | Purpose                                                                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | PostgreSQL connection (Supabase pooler)                                                                                                                     |
| `DIRECT_URL`                     | Direct PostgreSQL connection (for migrations)                                                                                                               |
| `CLERK_SECRET_KEY`               | Clerk backend SDK                                                                                                                                           |
| `CLERK_WEBHOOK_SECRET`           | Verify Clerk webhooks                                                                                                                                       |
| `OPENAI_API_KEY`                 | AI services (deal screening, agent)                                                                                                                         |
| `ANTHROPIC_API_KEY`              | Claude models (underwriting pipeline)                                                                                                                       |
| `RESEND_API_KEY`                 | Email sending via Resend                                                                                                                                    |
| `API_BASE_URL`                   | Production URL (https://api.dealwire.ai)                                                                                                                    |
| `MICROSOFT_WEBHOOK_SECRET`       | Graph webhook clientState validation                                                                                                                        |
| `FRONTEND_URL`                   | Frontend origin for CORS (http://localhost:3000 or production URL)                                                                                          |
| `REQUIRE_AUTH`                   | Optional. Set to `true` to require Clerk JWT on protected routes even when not in production (default: auth required only when `NODE_ENV === 'production'`) |
| `ENABLE_SQS`                     | Optional. Set to `true` to enable SQS consumer in development (default: only enabled in production)                                                         |
| `AWS_REGION`                     | AWS region for S3 + SQS                                                                                                                                     |
| `AWS_ACCESS_KEY_ID`              | AWS credentials                                                                                                                                             |
| `AWS_SECRET_ACCESS_KEY`          | AWS credentials                                                                                                                                             |
| `AWS_S3_BUCKET`                  | S3 bucket for deal attachments + pro formas                                                                                                                 |
| `AWS_NORMALIZED_EMAIL_QUEUE_URL` | SQS queue URL for email screening pipeline                                                                                                                  |
| `AWS_UNDERWRITING_QUEUE_URL`     | SQS queue URL for underwriting pipeline                                                                                                                     |
| `FROM_EMAIL`                     | Default Resend sender address                                                                                                                               |
| `UNDERWRITING_INBOUND_EMAIL`     | Resend inbound address for underwriting trigger emails                                                                                                      |
| `NYC_OPEN_DATA_APP_TOKEN`        | Optional. Socrata app token for NYC Open Data (avoids rate limits)                                                                                          |
| `TRACERFY_API_KEY`               | Bearer token for Tracerfy skip tracing API                                                                                                                  |
| `TRACERFY_MONTHLY_CREDIT_CAP`    | Max Tracerfy credits per month (default: 500 = $10/mo)                                                                                                      |

---

## External Integrations

### Microsoft Graph API

- Permissions needed: `Mail.ReadWrite` (delegated)
- Webhook subscription resource: `me/mailFolders('Inbox')/messages`
- Subscriptions expire after ~3 days, renewed automatically

### Clerk

- OAuth provider for Microsoft login
- Backend SDK used to fetch user's Microsoft access token
- Webhooks for user lifecycle events

---

## API Authentication (Clerk JWT)

Protected API routes (e.g. `/deals`, and future `/contacts`, `/assets`, `/screening-preferences`) use **Clerk JWT verification** so the Next.js frontend can call the API with the logged-in user's session.

### How it works

1. **Guard**: `ClerkAuthGuard` ([apps/api/src/guard/clerk-auth.guard.ts](apps/api/src/guard/clerk-auth.guard.ts)) runs on controllers that use `@UseGuards(ClerkAuthGuard)`.
2. **Token**: The frontend sends `Authorization: Bearer <sessionToken>`. The session token comes from Clerk (e.g. `getToken()` from `@clerk/nextjs` in Server Components or API routes).
3. **Verification**: The guard extracts the token, calls Clerk's `verifyToken()` from `@clerk/backend`, and looks up the user in our DB to get `organizationId`. It attaches `req.auth = { userId, organizationId }`.
4. **Controllers**: Use the `@AuthUser()` decorator ([apps/api/src/decorator/auth-user.decorator.ts](apps/api/src/decorator/auth-user.decorator.ts)) to read `userId` or `organizationId` (e.g. `@AuthUser('organizationId') organizationId: string | null`). Scope list/single endpoints by this org when present so users only see their org's data.

### When auth is required vs optional

- **Local / development**: Auth is **not** required. When `NODE_ENV !== 'production'`, the guard allows requests without a token (no 401). If a token is sent, it is still verified and `req.auth` is set. This lets you hit the API from curl or the frontend without logging in when running locally.
- **Production**: Auth **is** required. When `NODE_ENV === 'production'`, missing or invalid token returns 401.
- **Override**: Set `REQUIRE_AUTH=true` to require auth even in development (e.g. to test the full flow locally).

Config lives in [apps/api/src/config/clerk.config.ts](apps/api/src/config/clerk.config.ts) (`requireAuth`).

### Applying the guard

- Add `@UseGuards(ClerkAuthGuard)` to any controller that should be protected (e.g. DealController, and future Contact, Asset, ScreeningPreferences controllers).
- Register `ClerkAuthGuard` in the same module's `providers` (it depends on `PrismaService`); AppModule already does this.
- Do **not** put the guard on webhook controllers, health, or metrics (they use their own auth or none).

### Building Protected API Endpoints

When creating new protected endpoints that should be organization-scoped:

**Backend Pattern:**

```typescript
import { Controller, Get, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../guard/clerk-auth.guard";
import { AuthUser } from "../decorator/auth-user.decorator";

@Controller("your-resource")
@UseGuards(ClerkAuthGuard)
export class YourController {
  @Get()
  async list(@AuthUser("organizationId") organizationId: string | null) {
    // IMPORTANT: Always check organizationId and throw 403 if null
    if (!organizationId) {
      throw new HttpException("User not in organization", HttpStatus.FORBIDDEN);
    }

    // Query scoped to user's organization
    return this.service.findMany({ organizationId });
  }

  @Get(":id")
  async getOne(
    @AuthUser("organizationId") organizationId: string | null,
    @Param("id") id: string,
  ) {
    if (!organizationId) {
      throw new HttpException("User not in organization", HttpStatus.FORBIDDEN);
    }

    const resource = await this.service.findOne(id);

    // CRITICAL: Verify resource belongs to user's org
    if (resource.organizationId !== organizationId) {
      throw new HttpException("Resource not found", HttpStatus.NOT_FOUND);
    }

    return resource;
  }
}
```

**Key Security Rules:**

1. **NEVER** accept `organizationId` as a query parameter or body param - always get it from `@AuthUser('organizationId')`
2. **ALWAYS** check if `organizationId` is null and return 403 if user not in an org
3. **ALWAYS** scope queries to `{ organizationId }` to prevent cross-org data leaks
4. **ALWAYS** verify individual resource access by checking `resource.organizationId === organizationId`
5. For relations (contacts, assets), filter by `deals: { some: { organizationId } }` to only show resources tied to org's deals

### SQS Optional Loading

SQS consumer is disabled by default in development to prevent crashes without AWS credentials. It only runs when:

- `ENABLE_SQS=true` env var is set, OR
- `NODE_ENV=production`

This allows the API to start successfully locally without configuring AWS.

### OpenAI

- Model: `gpt-4o-mini` (configurable)
- Temperature: 0 (deterministic)
- Used for deal detection, summarization, and decision-making

---

## Important Patterns

### NestJS Module Hygiene

- **Never duplicate providers**: Each service should be provided in exactly one module and imported via that module everywhere else. If you need `ScreeningPreferencesService`, import `PreferencesModule` — don't add it to `providers` directly.
- **Controllers belong in feature modules**: New controllers go in their respective module (e.g., `DealModule`, `ContactModule`), not in `AppModule`. Each feature module provides its own `ClerkAuthGuard`.
- **`ScheduleModule.forRoot()` is called once** in `AppModule`. Child modules that use `@Cron()` just import `ScheduleModule` (without `.forRoot()`).
- **No circular dependencies**: If module A needs a service from module B and vice versa, extract the shared service into its own module. Never use `forwardRef`.

### Preventing Infinite Loops

- `MicrosoftWebhookService` checks if email sender = inbox owner
- If so: fetch message, check `X-Dealwire-Sent` header (we add this to our analysis replies). If present → skip (our reply). If absent → user reply, enqueue to SQS as `user-reply-command` for the Email Command Agent pipeline (never the deal pipeline)

### Unified Agent (Web + Email)

- Same agent powers web chat and email replies. Extract from chat route into shared `DealwireAgentService`.
- Write tools: update_always_skip, update_deal_criteria, update_buy_box. No forward_deal_to.
- **Agent must understand:** alwaysSkip = skip entirely (not a deal, no analysis, no move); dealCriteria = yes/no evaluation (no = moved to Passed Deals).

### Deduplication

- In-memory cache of processed message IDs
- Prevents duplicate processing from Graph notification retries

### Error Resilience

- Subscription operations wrapped in try/catch
- Failed operations logged but don't crash user creation flow

### Orphaned Subscription Cleanup

- Before creating new subscription, lists existing ones
- Deletes any that aren't in our database (stale from previous deploys)
