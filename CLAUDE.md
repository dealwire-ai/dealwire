# Analyzer - AI-Powered Real Estate Deal Analysis Platform

## Overview

Analyzer is an **agentic platform for private market asset analysis** — starting with commercial real estate but designed to extend to businesses, funds, and other private market assets.

### What This Is

This is NOT a traditional SaaS application. Analyzer is an **agentic layer** — software that works autonomously through integrations (email, APIs, data sources) rather than through a web dashboard. The frontend exists for configuration and visibility, but the core value is delivered through:

- **Email integration**: Monitoring inboxes, analyzing incoming deals, replying with structured analysis
- **Data enrichment**: Pulling property data from APIs, public records, government sites, and other sources to build deep asset intelligence
- **Autonomous workflows**: Agents that understand context, make decisions, and take actions without requiring a user to click through a UI

### Vision

Build the ultimate private market analyst — an AI system with access to deep property/asset data that can autonomously process deal flow, enrich it with external data, and surface actionable intelligence through the channels people already use (email, messaging, etc.).

### Guiding Principles

1. **Agentic-first**: Every feature should work autonomously. If it requires a user to open a dashboard and click buttons, rethink the approach. The agent should do the work and communicate results through integrations.
2. **Data depth over breadth**: Rich, accurate property/asset data is the moat. Invest in data quality — source from APIs, public records, and scraping where needed.
3. **Integration-native**: Meet users where they are (Outlook, email, future channels). Don't force them into yet another app.
4. **Not just real estate**: Architecture decisions should account for extending to other private market asset classes (businesses, funds, etc.) — avoid hard-coding real estate assumptions where possible.
5. **Replace SaaS, don't rebuild it**: Don't replicate CRM/pipeline/dashboard patterns from legacy software. Build the intelligent layer that makes those tools unnecessary.

### Current Capabilities

When users connect their Microsoft Outlook account, the system monitors their inbox for deal-related emails (teasers, offering memorandums, etc.), extracts and analyzes the content using AI, and replies with a structured summary, deal narrative, action card (links to documents, deal rooms, broker intel), and go/no-go decision based on client-specific criteria. For promising deals, it also drafts relationship-aware broker reply emails. A scheduled digest surfaces all screened deals with inline action links.

The platform also includes a **tax lien / distressed property intelligence** layer: ingests NYC public data (tax lien sale lists, PLUTO property records, HPD violations) via Socrata SODA API, computes distress scores (0-100), and surfaces results in a filterable parcel table at `/public-data/parcels` with CSV export and agent chat tools. Gated behind the `parcels` feature flag (org-level).

See `docs/ROADMAP.md` for current product priorities and feature roadmap. Check it before proposing new features to ensure alignment with the current phase.

See `docs/PUBLIC_DATA_PLATFORM.md` for the public data ingestion architecture. Read it before working on data sources, adapters, property data, ingestion pipelines, or anything in the data enrichment layer.

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

### Railway

Railway MCP tools (`mcp__railway__*`) are available for deployments, logs, and service management.

**Important:** The Railway CLI must be linked to a service before you can list deployments or get logs. The workspace path is always `apps/api`:

```bash
# Link the service (required once per session if not already linked)
# Use mcp__railway__link-service with workspacePath=/Users/isaac/projects/analyzer/apps/api, serviceName=analyzer-api

# Then use MCP tools:
# mcp__railway__list-deployments — check deployment status
# mcp__railway__get-logs — build/deploy logs (pass logType: "build" or "deploy")
# mcp__railway__list-variables — check env vars
# mcp__railway__set-variables — set env vars
```

- Service name: `analyzer-api`
- Deploys automatically on push to `main`
- Start script runs `prisma migrate deploy && node dist/src/main.js`
- Prod DB uses port 5432 (direct Supabase URL), never 6543 (pooler) for migrations

### Package naming
- Frontend: `@analyzer/web`
- Backend: `@analyzer/api`

---

### Documentation Map

All project instructions live in `CLAUDE.md` (this file). `.cursorrules` points here — do not duplicate rules there.

#### Architecture & Development

| Document | Location | Purpose |
|----------|----------|---------|
| **Backend** | `/docs/BACKEND.md` | Services, email flow, auth, patterns, env vars |
| **Frontend** | `/docs/FRONTEND.md` | API clients, CORS, env vars |
| **Testing** | `/docs/TESTING.md` | Unit test philosophy, format, guidelines |
| **Development** | `/docs/DEVELOPMENT.md` | Troubleshooting, migrations, local dev tips |

#### Product & Business

| Document | Location | Purpose |
|----------|----------|---------|
| **ROADMAP.md** | `/docs/ROADMAP.md` | Current product priorities and feature roadmap |
| **Boutique Hotel Opportunity** | `/docs/BOUTIQUE_HOTEL_OPPORTUNITY.md` | Minas Terlidis / Bohopo lead — hotel acquisition sourcing vertical |
| **Tax Lien Platform** | `/docs/TAX_LIEN_PLATFORM.md` | Tax lien data platform — domain knowledge, features, architecture, commercial terms |
| **Tax Lien Notes** | `/docs/TAX_LIEN_NOTES.md` | Tax lien research, proposals, Google Drive folder |
| **JK Notes** | `/docs/JK_NOTES.md` | Jordan Karlik meeting notes, Google Drive folder, Granola transcripts |

#### Infrastructure & Reference

| Document | Location | Purpose |
|----------|----------|---------|
| **Public Data Platform** | `/docs/PUBLIC_DATA_PLATFORM.md` | Architecture for public property data ingestion |
| **Desktop Deep Link** | `/docs/DESKTOP_DEEP_LINK.md` | MAPI entry ID fetch + `outlook:` protocol for desktop Outlook deep links in digest |
| **Clerk Auth Setup** | `/docs/CLERK_AUTH_SETUP.md` | Clerk authentication implementation details |
| **Grafana Setup** | `/docs/GRAFANA_SETUP.md` | Monitoring/observability setup guide |
| **Prisma Schema** | `/apps/api/prisma/schema.prisma` | Database schema (source of truth for data model) |
| **API .env.example** | `/apps/api/.env.example` | Required environment variables for backend |

---

## Database Schema (Prisma)

Any time make changes to the Prisma schema, generate a dev migration using cd apps/api && npx prisma migrate dev

---

## Keeping Docs Up to Date

After implementing any feature, API change, or architectural change — update the relevant doc(s) in `/docs/` to reflect the new reality. Don't leave docs describing a state that no longer exists.

| Change type | Update |
|-------------|--------|
| New or modified API endpoints | `TAX_LIEN_PLATFORM.md` (public data) or `BACKEND.md` |
| New services, adapters, or architectural patterns | Relevant domain doc |
| New or changed env vars | `apps/api/.env.example` + `BACKEND.md` |
| Prisma schema changes | Note in `BACKEND.md` if it affects documented data model |
| Roadmap item completed | Mark `[x]` in `ROADMAP.md` |
| New feature added | Add to "What's Built" section in `ROADMAP.md` |

---

## Git & PRs

### Commit Messages

Use **Conventional Commits** format: `type: short description`

- **Types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`
- Imperative mood ("add" not "added"), lowercase, no period, under 72 chars
- Body (optional): blank line after subject, explain **why** not what

### PR Titles

Same `type: description` format as commits. Keep under 70 chars — use the description body for details.

### PR Structure

Break changes into separate, logical commits — each group of related changes should be its own commit rather than one big commit for the whole PR.
