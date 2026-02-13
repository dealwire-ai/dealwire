# Analyzer - AI-Powered Real Estate Deal Analysis Platform

## Overview
Analyzer is a monorepo that provides automated real estate deal analysis. When users connect their Microsoft Outlook account, the system monitors their inbox for deal-related emails (teasers, offering memorandums, etc.), extracts and analyzes the content using AI, and replies with a structured summary and go/no-go decision based on client-specific criteria.

## Architecture

### Monorepo Structure
- `apps/web` - Next.js 16 frontend (React 19, Tailwind 4)
- `apps/api` - NestJS 11 backend

### Commands (from root)
- `pnpm dev` - Run both frontend and backend
- `pnpm build` - Build both apps

### Ports
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### Deployment
- Frontend: Vercel (root dir: apps/web)
- Backend: Railway (root dir: apps/api, uses Dockerfile)

### Package naming
- Frontend: `@analyzer/web`
- Backend: `@analyzer/api`

---

## Backend Architecture (`apps/api`)

### Core Email Processing Flow

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

4. **Deal Summary** (`DealSummaryService`)
   - Uses AI to generate structured summary of the deal
   - Extracts key metrics: price, cap rate, NOI, location, property type, etc.
   - Applies client-specific criteria for emphasis

5. **Deal Decision** (`DealDecisionService`)
   - AI evaluates deal against client's HARD REQUIREMENTS
   - Returns yes/no decision with reasoning
   - Criteria are non-negotiable (e.g., "New York only" means NJ = automatic no)

6. **Reply via Graph** (`MicrosoftGraphService.replyInThreadToSelf`)
   - Creates reply draft, sets recipient to user's own email
   - Sends reply in same conversation thread
   - Prevents infinite loops by skipping self-sent emails

7. **Folder Organization**
   - "No" decisions: email is moved to configurable folder (default: "Passed Deals")
   - "Yes" decisions: email stays in inbox with analysis reply

---

## Key Services

### Microsoft Module (`src/module/microsoft.module.ts`)

| Service | Purpose |
|---------|---------|
| `MicrosoftGraphService` | Microsoft Graph API calls: get messages, attachments, create/send replies, manage folders |
| `MicrosoftSubscriptionService` | Create/renew/delete Graph subscriptions, stored in DB |
| `MicrosoftWebhookService` | Handle incoming Graph notifications, orchestrate processing pipeline |
| `MicrosoftRenewalSchedulerService` | Cron job (every 12 hours) to renew expiring subscriptions |

### AI Module (`src/module/ai.module.ts`)

| Service | Purpose |
|---------|---------|
| `DealDetectionService` | Quick deal vs. non-deal classification |
| `DealSummaryService` | Generate structured deal summary |
| `DealDecisionService` | Yes/no decision based on client criteria |

### Email Module (`src/module/email.module.ts`)

| Service | Purpose |
|---------|---------|
| `EmailProcessingService` | Extract text from emails and PDFs |
| `EmailSenderService` | Send emails via Resend (fallback, not primary) |
| `EmailTemplateService` | Format HTML email with branding |

### Webhook Module (`src/module/webhook.module.ts`)

| Controller | Purpose |
|------------|---------|
| `ClerkWebhookController` | Handle Clerk user lifecycle events |
| `MicrosoftWebhookController` | Handle Microsoft Graph notifications |
| `ResendWebhookController` | Handle Resend email events (legacy) |

### Other Services

| Service | Purpose |
|---------|---------|
| `ClerkWebhookService` | User creation → create Graph subscription; User deletion → cleanup |
| `ScreeningPreferencesService` | Load screening preferences from database (ScreeningPreferences table) |
| `PrismaService` | Database access (PostgreSQL via Supabase) |

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

## Database Schema (Prisma)

Any time make changes to the Prisma schema, generate a dev migration using cd apps/api && npx prisma migrate dev

## Environment Variables

### Required for API

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection (Supabase pooler) |
| `DIRECT_URL` | Direct PostgreSQL connection (for migrations) |
| `CLERK_SECRET_KEY` | Clerk backend SDK |
| `CLERK_WEBHOOK_SECRET` | Verify Clerk webhooks |
| `OPENAI_API_KEY` | AI services |
| `RESEND_API_KEY` | Email sending (fallback) |
| `API_BASE_URL` | Production URL (https://api.deals.frontstep.ai) |
| `MICROSOFT_WEBHOOK_SECRET` | Graph webhook clientState validation |
| `FRONTEND_URL` | Frontend origin for CORS (http://localhost:3000 or production URL) |
| `REQUIRE_AUTH` | Optional. Set to `true` to require Clerk JWT on protected routes even when not in production (default: auth required only when `NODE_ENV === 'production'`) |
| `ENABLE_SQS` | Optional. Set to `true` to enable SQS consumer in development (default: only enabled in production) |

### Required for Frontend

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key for frontend |
| `NEXT_PUBLIC_API_URL` | Backend API URL (http://localhost:3001 or production URL) |
| `CLERK_SECRET_KEY` | Clerk secret key for server-side operations |

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
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { AuthUser } from '../decorator/auth-user.decorator';

@Controller('your-resource')
@UseGuards(ClerkAuthGuard)
export class YourController {
  @Get()
  async list(@AuthUser('organizationId') organizationId: string | null) {
    // IMPORTANT: Always check organizationId and throw 403 if null
    if (!organizationId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }

    // Query scoped to user's organization
    return this.service.findMany({ organizationId });
  }

  @Get(':id')
  async getOne(
    @AuthUser('organizationId') organizationId: string | null,
    @Param('id') id: string,
  ) {
    if (!organizationId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }

    const resource = await this.service.findOne(id);

    // CRITICAL: Verify resource belongs to user's org
    if (resource.organizationId !== organizationId) {
      throw new HttpException('Resource not found', HttpStatus.NOT_FOUND);
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

### Frontend API Clients

**For Server Components:**
```typescript
import { apiClient } from '@/lib/api';

export default async function MyPage() {
  const data = await apiClient('/your-resource');
  // apiClient automatically includes Clerk JWT token
  return <div>...</div>;
}
```

**For Client Components:**
```typescript
'use client';
import { useApi } from '@/hooks/use-api';

export default function MyComponent() {
  const { apiCall } = useApi();

  useEffect(() => {
    apiCall('/your-resource').then(setData);
  }, []);

  return <div>...</div>;
}
```

**Both clients:**
- Automatically include `Authorization: Bearer <jwt>` header
- Handle token refresh via Clerk
- Throw errors on non-200 responses
- Use `NEXT_PUBLIC_API_URL` env var (defaults to `http://localhost:3001`)

### CORS Configuration

CORS is configured in `apps/api/src/main.ts`:
```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
});
```

Required env var in `apps/api/.env`:
```bash
FRONTEND_URL=http://localhost:3000  # or https://yourapp.vercel.app in prod
```

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

### Preventing Infinite Loops
- `MicrosoftWebhookService` checks if email sender = inbox owner
- If so: fetch message, check `X-Analyzer-Sent` header (we add this to our analysis replies). If present → skip (our reply). If absent → user reply, enqueue to SQS as `user-reply-command` for the Email Command Agent pipeline (never the deal pipeline)

### Unified Agent (Web + Email)
- Same agent powers web chat and email replies. Extract from chat route into shared `AnalyzerAgentService`.
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

---

## Development Tips

1. **Testing email flow**: Send email to user's Outlook, watch Railway logs
2. **Preferences not loading?**: Check snake_case vs camelCase mapping
3. **Subscription not working?**: Verify `API_BASE_URL` is HTTPS
4. **Replies not threaded?**: Must use Graph API's `createReply` endpoint
5. **Migrations**: Run manually or deploy triggers `prisma migrate deploy`
6. **API won't start?**: SQS is disabled by default in dev. No AWS credentials needed locally.
7. **Testing auth locally**: Use curl without token (allowed in dev), or set `REQUIRE_AUTH=true` to test full flow
8. **CORS issues?**: Verify `FRONTEND_URL` in API .env matches your frontend origin

---

## Testing Philosophy

### Unit Test Guidelines

Unit tests should be **simple, readable, and focused on core functionality**. More tests is not necessarily better - prioritize quality over quantity.

**Required Format:**
- Use **Arrange/Act/Assert** pattern with explicit comments:
  ```typescript
  it('should do something', async () => {
    // Arrange
    // ... setup code ...

    // Act
    // ... execute code ...

    // Assert
    // ... verify results ...
  });
  ```

**Principles:**
1. **Simplicity first**: Tests should be easy to read and understand at a glance
2. **Cover important edge cases**: Focus on critical paths and error scenarios
3. **Avoid over-testing**: Don't test implementation details or trivial code
4. **Clear test names**: Test names should clearly describe what is being tested
5. **One assertion per concept**: Group related assertions, but keep tests focused

**What to Test:**
- Core business logic and important workflows
- Error handling and edge cases
- Integration points between services
- Critical decision points (e.g., deal detection, S3 upload decisions)

**What NOT to Test:**
- Simple getters/setters
- Trivial utility functions
- Framework/library code
- Implementation details that don't affect behavior

After adding tests you must always verify that they are passing.
