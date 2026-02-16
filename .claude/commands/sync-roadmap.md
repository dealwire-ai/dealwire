---
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
description: Update ROADMAP.md after merging a PR to keep sessions aware of current progress and future direction
---

## Context

- Current ROADMAP.md: !`cat ROADMAP.md 2>/dev/null || echo "(no ROADMAP.md found)"`
- Recent merged PRs (last 10): !`gh pr list --state merged --limit 10 --json number,title,mergedAt,body --jq '.[] | "PR #\(.number): \(.title) (merged \(.mergedAt))\n\(.body)\n---"' 2>/dev/null || echo "(could not fetch PRs)"`
- Recent commits on main (last 20): !`git log --oneline -20 2>/dev/null || echo "(no git log)"`
- What's currently built: !`cat CLAUDE.md 2>/dev/null | head -100 || echo "(no CLAUDE.md)"`

## Your task

Review the recently merged PRs and commits, then update `ROADMAP.md` to accurately reflect the current state of the project. This keeps all future Claude Code sessions aware of what's done, what's in progress, and what's next.

### Steps:

1. **Read the current ROADMAP.md** to understand its structure and what's already tracked
2. **Cross-reference with recent PRs and commits** to identify what was shipped since the last update
3. **Update the roadmap**:
   - Check off (`- [x]`) any items that are now complete
   - Add new completed items if work was done that wasn't previously on the roadmap
   - Reword remaining items if priorities have shifted based on what was built
   - Keep the "What's Built" section current with any new capabilities
   - Add any new roadmap items that emerged from recent work
4. **Preserve the vision and structure** — don't change the overall narrative or phases unless the product direction has genuinely shifted

### Rules:
- **Always update the file** — don't just describe what should change
- **Be specific about what was built** — include concrete technical details, not vague summaries
- **Keep completed items** — don't remove checked items; they serve as a record of progress
- **Date-stamp major milestones** in the "What's Built" section if adding new capabilities
- **Don't inflate progress** — only check off items that are genuinely complete, not partially done
- After updating, show a brief summary of what changed
