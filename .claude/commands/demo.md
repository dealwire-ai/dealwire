Build a preview demo for a prospective client. Walk through all 5 phases sequentially — do not skip steps.

## Phase 1: Gather Context (Automated)

1. Ask for the **client name and company** (if not provided as an argument: `$ARGUMENTS`)
2. Check `docs/clients/` for existing client notes — read any matching files
3. Search Granola for meetings mentioning the client:
   - Use `mcp__claude_ai_Granola__query_granola_meetings` or `mcp__claude_ai_Granola__list_meetings` to find relevant meetings
   - Use `mcp__claude_ai_Granola__get_meeting_transcript` to pull full transcripts from any matches
4. Search Gmail for email threads with the client:
   - Use `mcp__claude_ai_Gmail__gmail_search_messages` to find threads (search by name, company, email domain)
   - Use `mcp__claude_ai_Gmail__gmail_read_thread` to read full conversations from top results
5. Present a summary of what you found: key facts, domain, relationship stage, stated needs

If Granola or Gmail tools fail or return nothing, note it and move on — the interview phase will fill gaps.

## Phase 2: Interview the User

Conduct a focused interview to understand the client and what to showcase. Adapt questions based on what you already learned in Phase 1 — don't re-ask things that are already clear. Ask **2-3 questions at a time** using `AskUserQuestion`, not a wall of questions. Adapt follow-ups based on answers.

### About the client:

- What does this person/company actually do? (if not clear from context)
- What's their current workflow for the problem we're solving?
- What's their decision-making style? (data-driven, relationship-driven, visual, etc.)
- What would specifically impress THIS person? What do they care about?

### About the demo:

- What's the single thing you want them to walk away thinking?
- What data/signals matter most in their domain?
- Are there specific metrics, scores, or rankings that would resonate?
- Any specific example entities to include? (e.g., real hotel names, real properties, real companies they'd recognize)
- Should the demo feel like a dashboard, a report, a feed, or something else?

### About the pitch:

- What stage is the relationship at? (cold intro, warm lead, follow-up from meeting)
- Is this a screen recording or a live walkthrough?
- Who specifically is watching? (their role, what they care about)
- Any existing products/tools they use that we should reference or contrast against?

## Phase 3: Design the Demo

From gathered context + interview answers, produce a **demo brief** covering:

- **Client profile**: Who they are, what they do, their business model
- **Pain points**: What's manual/broken that we can showcase automating
- **Demo thesis**: The single hook that will impress them
- **Data model**: What columns, metrics, scores make sense for their domain
- **AI analyst prompt**: System prompt tuned to their criteria (modeled on the Bohopo demo's system prompt)
- **Suggested data**: What synthetic data to generate (entity types, scoring logic, value distributions)
- **Page structure**: Stats bar KPIs, table columns, filter controls, chat suggestions

Present the brief to the user and get explicit approval before generating code.

## Phase 4: Generate the Demo

After approval, generate these files:

### 1. Demo page data file

Create `apps/web/src/app/(app)/demos/<slug>/data.ts` with:

- TypeScript interface for the entity type
- Exported array of synthetic data (150-200 records)
- Use realistic names, values, and distributions appropriate to the domain

### 2. Demo page

Create `apps/web/src/app/(app)/demos/<slug>/page.tsx` following the Bohopo reference implementation at `apps/web/src/app/(app)/demos/bohopo/page.tsx`:

- `"use client"` directive
- `DashboardPageShell` wrapper
- Client-branded header (name, tagline, live indicator)
- Filter controls relevant to the domain
- Stats bar with 4 KPIs
- Sortable data table with domain-specific columns
- Score/signal badges with red/yellow/green thresholds
- AI analyst chat section using `/api/chat` with domain-specific system prompt
- Suggestion chips with domain-relevant starter questions
- Footer with "powered by dealwire" branding

### 3. Update demo registry

Add an entry to `apps/web/src/app/(app)/demos/config.ts`

### 4. Demo script

Create `docs/clients/<CLIENT>_DEMO.md` with:

- Client context summary (from Phase 1 + 2)
- Demo flow: step-by-step walkthrough script
- Key talking points per section
- Anticipated questions and answers
- Lines to have ready for the call

## Phase 5: Verify

1. Run `npx tsc --noEmit` from `apps/web/` to verify the page compiles
2. Run `pnpm lint` from root to check for lint errors
3. Confirm the demo entry appears in `apps/web/src/app/(app)/demos/config.ts`
4. Remind user to test locally with `pnpm dev` and navigate to `/demos/<slug>`
5. Suggest committing with: `feat: add <client> demo`
