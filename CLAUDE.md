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
| `CLERK_AUTH_SETUP.md`  | Clerk auth flow diagram + files modified (see BACKEND.md for detailed patterns)                                               |
| `DESKTOP_DEEP_LINK.md` | MAPI entry ID fetch + `outlook:` protocol for desktop Outlook deep links in digest                                            |
| `API_REFERENCE.md`     | Complete REST API endpoint reference                                                                                          |

#### `docs/product/` — Product & Features

| Document                  | Purpose                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `ROADMAP.md`              | Current product priorities and feature roadmap                                                                                 |
| `TODO.md`                 | Active task list across workstreams                                                                                            |
| `UNDERWRITING.md`         | Acquisition underwriting — implementation status (top) + full plan. Email trigger → extract → pro forma fill + Excel delivery. |
| `PUBLIC_DATA_PLATFORM.md` | Architecture for public property data ingestion                                                                                |
| `TAX_LIEN_PLATFORM.md`    | Tax lien data platform — domain knowledge, features, architecture, commercial terms                                            |

#### `docs/clients/` — Client-Specific Notes

| Document                        | Client         | Purpose                                                        |
| ------------------------------- | -------------- | -------------------------------------------------------------- |
| `JK_NOTES.md`                   | Jordan Karlik  | Meeting notes, Google Drive folder, Granola transcripts        |
| `TAX_LIEN_NOTES.md`             | Daniel Gabay   | Tax lien research, proposals, Google Drive folder              |
| `BOUTIQUE_HOTEL_OPPORTUNITY.md` | Minas Terlidis | Bohopo lead — hotel acquisition sourcing vertical              |
| `DOLAN_DEMO.md`                 | Thomas Dolan   | DD\|HA demo script — Forever Wild guest intelligence           |
| `SPREADSHEET_ASSESSMENT.md`     | Daniel Gabay   | PropertyShark spreadsheet assessment for lis pendens ingestion |

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

### Branch Hygiene

Before starting any new work, **always fetch and update `main`**:

```bash
git fetch origin main
git checkout main && git pull origin main
```

Then create a new feature branch off the updated `main`. Never branch off a stale `main` or off another feature branch unless intentional. This prevents PRs from carrying commits that already landed on `main`.

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

## GitHub Issues & Project Board

**Org:** `dealwire-ai` | **Repo:** `dealwire-ai/dealwire` | **Project board:** `Dealwire` (project #9)

All task tracking lives in GitHub Issues on the project board. Do not track work in markdown TODO files — use issues.

### Labels

| Type      | Labels                                                                                       |
| --------- | -------------------------------------------------------------------------------------------- |
| Domain    | `feat`, `fix`, `chore`, `infra`, `data`, `email`, `underwriting`, `frontend`, `api`          |
| Client    | `client:jk` (Jordan Karlik), `client:gabay` (Daniel Gabay), `client:bohopo` (Minas Terlidis) |
| Priority  | `priority:high`, `priority:low`                                                              |
| Structure | `epic` (groups related issues into a workstream)                                             |

### Creating issues

Always assign issues to the project board and apply relevant labels (at minimum: one domain label, one client label if client-specific). If context exists in a doc or Drive file, link to it instead of duplicating it.

**Conciseness is critical.** Issue titles should be short and scannable. Issue bodies should be a few tight bullet points at most — no paragraphs, no preamble, no restating the title. If the context is already in a linked doc, don't summarize it in the issue. Prefer 3 bullets over 3 sentences. Less is more.

**When creating issues under an epic, you MUST link them as sub-issues immediately after creation.** Do not create child issues without linking them — orphaned issues break the project board's progress tracking. See [Linking sub-issues to epics](#linking-sub-issues-to-epics) below.

```bash
# Standard issue
gh issue create --repo dealwire-ai/dealwire \
  --title "feat: lis pendens alert pipeline" \
  --label "feat,data,client:gabay,priority:high" \
  --project "Dealwire" \
  --body "Description here"

# Epic (parent issue that groups related work)
gh issue create --repo dealwire-ai/dealwire \
  --title "epic: tax lien platform phase 3" \
  --label "epic,data,client:gabay" \
  --project "Dealwire" \
  --body "## Scope\n\nDescription of the workstream."
```

### Linking sub-issues to epics

**This is mandatory.** Every issue created under an epic MUST be linked as a native sub-issue immediately after creation. This is not optional — without it, the epic's progress tracking on the project board is broken.

Use the GraphQL API to create native parent/child relationships:

```bash
# 1. Get node IDs for the epic and child issue
gh api graphql -f query='query {
  repository(owner: "dealwire-ai", name: "dealwire") {
    parent: issue(number: EPIC_NUMBER) { id }
    child: issue(number: CHILD_NUMBER) { id }
  }
}'

# 2. Link child as a sub-issue of the epic
gh api graphql -f query='mutation {
  addSubIssue(input: {
    issueId: "PARENT_NODE_ID",
    subIssueId: "CHILD_NODE_ID"
  }) { issue { number } }
}'
```

**Checklist when creating issues under an epic:**

1. Create the issue with `gh issue create`
2. Get node IDs for both the epic and the new issue
3. Run `addSubIssue` mutation to link them
4. Never skip step 2-3 — do it in the same workflow, not "later"

Do NOT use "Part of #N" text in issue bodies — use native sub-issues instead.

### Querying issues for context

Before starting work on a ticket, pull its full context:

```bash
# Read a specific issue (description, labels, comments, linked PRs)
gh issue view 123 --repo dealwire-ai/dealwire --comments

# List all open issues for a client
gh issue list --repo dealwire-ai/dealwire --label "client:gabay"

# List all sub-issues of an epic
gh api graphql -f query='query {
  repository(owner: "dealwire-ai", name: "dealwire") {
    issue(number: 123) {
      subIssues(first: 50) { nodes { number title state } }
    }
  }
}'

# List high-priority work
gh issue list --repo dealwire-ai/dealwire --label "priority:high"

# List issues by domain
gh issue list --repo dealwire-ai/dealwire --label "underwriting"
```

### Linking PRs to issues

Reference related issues in the PR body with `Relates to #<number>`. Do NOT use closing keywords (`Closes`, `Fixes`, `Resolves`) — issues should be closed manually when the work is verified, not auto-closed on merge.

### Workflow

1. **Pick or create an issue** — check the board first, create if needed
2. **Branch from issue** — `git checkout -b feat/123-short-description`
3. **Work + commit** — reference the issue number in commits when relevant
4. **PR linked to issue** — `Relates to #123` in the PR body
5. **Merge** — issue auto-closes, board updates

### Client context

Each client has a `client:*` label and a notes file in `docs/clients/`. When working on a client-specific issue, read the client notes file for context (meeting history, Drive folders, preferences, domain knowledge).

| Client         | Label           | Notes file                                   | Domain doc                          |
| -------------- | --------------- | -------------------------------------------- | ----------------------------------- |
| Jordan Karlik  | `client:jk`     | `docs/clients/JK_NOTES.md`                   | `docs/product/UNDERWRITING.md`      |
| Daniel Gabay   | `client:gabay`  | `docs/clients/TAX_LIEN_NOTES.md`             | `docs/product/TAX_LIEN_PLATFORM.md` |
| Minas Terlidis | `client:bohopo` | `docs/clients/BOUTIQUE_HOTEL_OPPORTUNITY.md` | —                                   |

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

---

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`.
