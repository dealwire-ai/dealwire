# Analyzer

AI-powered real estate deal analysis platform. Monitors connected Outlook inboxes for deal-related emails, analyzes them using AI, and provides automated summaries and go/no-go decisions.

## Structure

| Directory | Description | Deployed To |
|-----------|-------------|-------------|
| `apps/api` | NestJS 11 backend | Railway |
| `apps/web` | Next.js 16 frontend | Vercel |

## Quick Start

```bash
# Install dependencies
pnpm install

# Run both apps
pnpm dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## How It Works

1. **User connects Outlook** via Clerk OAuth
2. **Microsoft Graph subscription** created for inbox
3. **New email arrives** → Graph sends webhook notification
4. **Deal detection** filters out non-deal emails
5. **PDF extraction** pulls text from attachments
6. **AI summarizes** deal with key metrics
7. **AI decides** yes/no based on client criteria
8. **Reply sent** to user in same email thread
9. **"No" deals** moved to "Passed Deals" folder

## Environment Variables

See `.cursorrules` for complete list. Key ones:

```env
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...
OPENAI_API_KEY=sk-...
API_BASE_URL=https://your-domain.com
MICROSOFT_WEBHOOK_SECRET=your-secret
```

## Client Preferences

Edit `apps/api/src/data/preferences.json` to configure per-client:

- `deal_criteria` - AI evaluates deals against these requirements
- `logo_url`, `company_name`, `brand_color` - Email branding
- `passedFolderName` - Folder for rejected deals

## Deployment

```bash
# Build both apps
pnpm build

# Run migrations (API)
cd apps/api && pnpm exec prisma migrate deploy
```
