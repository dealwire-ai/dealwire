# Dealwire - AI-Powered Real Estate Deal Analysis Platform

## Overview

Dealwire is an **agentic platform for private market asset analysis** — starting with commercial real estate but designed to extend to businesses, funds, and other private market assets.

### What This Is

This is NOT a traditional SaaS application. Dealwire is an **agentic layer** — software that works autonomously through integrations (email, APIs, data sources) rather than through a web dashboard. The frontend exists for configuration and visibility, but the core value is delivered through:

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

See `docs/product/ROADMAP.md` for current product priorities and feature roadmap. Check it before proposing new features to ensure alignment with the current phase.

See `docs/product/PUBLIC_DATA_PLATFORM.md` for the public data ingestion architecture. Read it before working on data sources, adapters, property data, ingestion pipelines, or anything in the data enrichment layer.

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

- Frontend: Railway (service: dealwire-web, root dir: apps/web)
- Backend: Railway (service: dealwire-api, root dir: apps/api, uses Dockerfile)

### Railway

Railway MCP tools (`mcp__railway__*`) are available for deployments, logs, and service management.

**Project:** `dealwire` (contains two services: `dealwire-api` and `dealwire-web`)

**Important:** The Railway CLI must be linked to a service before you can list deployments or get logs. Use the workspace path for the relevant service:

```bash
# API service — workspacePath=/Users/isaac/projects/dealwire/apps/api, serviceName=dealwire-api
# Web service — workspacePath=/Users/isaac/projects/dealwire/apps/web, serviceName=dealwire-web

# Then use MCP tools:
# mcp__railway__list-deployments — check deployment status
# mcp__railway__get-logs — build/deploy logs (pass logType: "build" or "deploy")
# mcp__railway__list-variables — check env vars
# mcp__railway__set-variables — set env vars
```

- Both services deploy automatically on push to `main`
- Start script runs `prisma migrate deploy && node dist/src/main.js`
- Prod DB uses port 5432 (direct Supabase URL), never 6543 (pooler) for migrations
- Before deploying: verify `rootDirectory` is set correctly per service, peer deps are resolved, and all tsconfig base files are present
- After merging, always check deployment logs to confirm a successful deploy

### Package naming

- Frontend: `@dealwire/web`
- Backend: `@dealwire/api`

---

### Documentation Map

All project instructions live in `CLAUDE.md` (this file). `.cursorrules` points here — do not duplicate rules there.

#### `docs/technical/` — Engineering & Infrastructure

| Document               | Purpose                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `SUBSYSTEMS.md`        | **Codebase map** — what each subsystem does, key service files, data flow, env vars. Read this before touching any subsystem. |
| `ARCHITECTURE.md`      | ASCII system architecture diagram                                                                                             |
| `BACKEND.md`           | Services, email flow, auth, patterns, env vars                                                                                |
| `FRONTEND.md`          | API clients, CORS, env vars                                                                                                   |
| `TESTING.md`           | Unit test philosophy, format, guidelines                                                                                      |
| `DEVELOPMENT.md`       | Troubleshooting, migrations, local dev tips                                                                                   |
| `GRAFANA_SETUP.md`     | Monitoring/observability setup guide                                                                                          |
| `CLERK_AUTH_SETUP.md`  | Clerk authentication implementation details                                                                                   |
| `DESKTOP_DEEP_LINK.md` | MAPI entry ID fetch + `outlook:` protocol for desktop Outlook deep links in digest                                            |

#### `docs/product/` — Product & Features

| Document                  | Purpose                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `ROADMAP.md`              | Current product priorities and feature roadmap                                                                                 |
| `TODO.md`                 | Active task list across workstreams                                                                                            |
| `UNDERWRITING.md`         | Acquisition underwriting — implementation status (top) + full plan. Email trigger → extract → pro forma fill + Excel delivery. |
| `PUBLIC_DATA_PLATFORM.md` | Architecture for public property data ingestion                                                                                |
| `TAX_LIEN_PLATFORM.md`    | Tax lien data platform — domain knowledge, features, architecture, commercial terms                                            |

#### `docs/clients/` — Client-Specific Notes

| Document                        | Client         | Purpose                                                 |
| ------------------------------- | -------------- | ------------------------------------------------------- |
| `JK_NOTES.md`                   | Jordan Karlik  | Meeting notes, Google Drive folder, Granola transcripts |
| `TAX_LIEN_NOTES.md`             | Daniel Gabay   | Tax lien research, proposals, Google Drive folder       |
| `BOUTIQUE_HOTEL_OPPORTUNITY.md` | Minas Terlidis | Bohopo lead — hotel acquisition sourcing vertical       |

#### Reference (not in docs/)

| Document                         | Purpose                                          |
| -------------------------------- | ------------------------------------------------ |
| `/apps/api/prisma/schema.prisma` | Database schema (source of truth for data model) |
| `/apps/api/.env.example`         | Required environment variables for backend       |

---

## Database Schema (Prisma)

Any time make changes to the Prisma schema, generate a dev migration using cd apps/api && npx prisma migrate dev

---

## Keeping Docs Up to Date

After implementing any feature, API change, or architectural change — update the relevant doc(s) in `/docs/` to reflect the new reality. Don't leave docs describing a state that no longer exists.

| Change type                                       | Update                                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| New or modified API endpoints                     | `docs/product/TAX_LIEN_PLATFORM.md` (public data) or `docs/technical/BACKEND.md` |
| New services, adapters, or architectural patterns | Relevant domain doc                                                              |
| New or changed env vars                           | `apps/api/.env.example` + `docs/technical/BACKEND.md`                            |
| Prisma schema changes                             | Note in `docs/technical/BACKEND.md` if it affects documented data model          |
| Roadmap item completed                            | Mark `[x]` in `docs/product/ROADMAP.md`                                          |
| New feature added                                 | Add to "What's Built" section in `docs/product/ROADMAP.md`                       |
| New subsystem or major service refactor           | Update `docs/technical/SUBSYSTEMS.md`                                            |

---

## General Guidelines

- When asked to research or explore a specific directory/project, confirm the exact path before starting. Do not default to the current project directory.
- Before diagnosing a bug or proposing a fix, read the relevant service/guard/middleware/module code first. Do not assume the root cause — wrong initial diagnoses (auth guard resolving wrong org, hardcoded dark backgrounds misread as dark mode bugs) have been a recurring source of wasted cycles.
- When the user specifies a preferred approach or solution, implement that. Do not substitute an alternative unless explicitly asked. If you think a different approach is better, flag it briefly — but default to what the user asked for.
- Before starting any multi-step task or feature that touches multiple systems, confirm the scope and boundaries. If the request is ambiguous (e.g. "add Clerk" — globally or project-scoped?), ask before writing any code.

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

### Before Creating a PR

Before pushing commits or opening a PR:

1. Check that the branch is not already merged (`gh pr view --json state` or `git branch -r`). Never push fix commits to a branch whose PR has already been merged.
2. Run CI checks locally: `npx tsc --noEmit`, `pnpm lint`, and `pnpm test`. Fix all failures before pushing — pre-existing type/lint errors and hardcoded test defaults have repeatedly blocked CI.

---

## Tech Stack

This project uses **TypeScript** throughout — **NestJS 11** on the backend, **Next.js 16 / React 19** on the frontend, **Prisma ORM** with **Supabase Postgres**. Always verify field names against the actual Prisma schema (`apps/api/prisma/schema.prisma`) before writing queries or any code that references DB columns. Do not assume a field exists — read the schema first.

### NestJS Module Checklist

When adding or modifying a NestJS module, verify:

- Every service used inside the module is listed in `providers: []`
- Every service needed by other modules is listed in `exports: []`
- `PrismaService` is in `providers` for any module that touches the DB (missing this causes startup crashes)
- Any external module (e.g. `SqsModule`, `BullModule`) is only exported if other modules actually import it — unconditional exports cause crashes if the dep isn't configured

---

## Code Quality

This is a TypeScript codebase. When making code changes, always verify the changes compile (`npx tsc --noEmit`) before considering the task complete. If tests exist, run them. If test configuration is broken, note it clearly rather than spending excessive time debugging the test runner.

---

## Frontend / CSS

When making theme or styling changes, **search the entire codebase exhaustively** (grep/glob across all files) for every occurrence of the affected value(s) before making any edits. List all files that need updating, then change them all in one pass. Partial replacements across the frontend have caused multiple revision cycles — do not stop after finding a few matches.

---

## Deployment Reminders

After deploying code changes that affect data ingestion or processing pipelines, remind the user that ingestion may need to be re-triggered for existing records to reflect the changes.
