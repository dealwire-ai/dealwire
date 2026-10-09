# JK (Jordan Karlik) — Notes & Meeting History

## Overview

Jordan Karlik is an advisor and active user of Analyzer. JK provides ongoing product feedback and strategic input during weekly check-ins.

## Where to Find Information

### Google Drive

Meeting notes and docs live in this shared Drive folder:
https://drive.google.com/drive/folders/1rftzIg8IFv4HKBicB9410-jF6RcvSiAl

Use the `gdrive` CLI to access files:

```bash
# List files in the JK folder
gdrive files list --parent 1rftzIg8IFv4HKBicB9410-jF6RcvSiAl

# Export the weekly check-ins doc (find it first, then export by file ID)
gdrive files export <fileId> /tmp/jk-checkins.txt
```

### Granola Meetings

Weekly check-in transcripts and notes are available via Granola MCP tools:

- `mcp__claude_ai_Granola__list_meetings` — find meetings with JK
- `mcp__claude_ai_Granola__get_meeting_transcript` — get full transcript of a specific check-in
- `mcp__claude_ai_Granola__query_granola_meetings` — search across meetings for specific topics discussed with JK

## Screening Preferences Meeting (2026-10-09)

Decisions from the screening preferences review. Config applied to `org_3Ap6kgg5BJHR1YA8YLxKPr6l7Kk` (see GitHub issue #439).

**Always skip (deterministic `skipKeywords`, email left in inbox, never processed):**

- NNN / triple net (word for word)
- Single tenant
- Hotels: anything with a key count ("120-key", "150 keys")
- Mass marketing blasts: "call for offers", "tour dates"
- Closing announcements: "just closed"

**Always No (bucket criteria, moved to Passed Deals, shown in digest):**

- Office unless the materials explicitly state conversion potential (suburban office is always No)
- Flex space (office/industrial hybrid)
- Medical anything
- Industrial under 100,000 SF
- Retail unless development potential

**Still Yes:** residential development/redevelopment, cash-flowing multifamily (40 to 400 units), BTR, development sites, industrial 100,000+ SF, office with explicit conversion potential.

**Open questions for JK:** does the Long Island under-40-unit exception still stand? Should wrong-type deals (NNN, hotels, medical) be moved to Passed Deals and counted in the digest, or skipped and left in the inbox?
