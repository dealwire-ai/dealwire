Code review with craftsman's eye. Auto-fix obvious issues, surface real bugs.

## Critical Rules

1. **AUTO-FIX safe obvious issues** - Don't ask permission for no-brainers
2. **HUNT FOR BUGS** - Logic errors, edge cases, race conditions first
3. **WAIT for confirmation** - On BUG/FIX, don't execute until user says "go"
4. **BE CONCISE** - One-line items, choices at END
5. **USE clickable links** - `path/to/file.ts:123` format only

## Categories

| Category | What | Action |
|----------|------|--------|
| **[BUG]** | Logic errors, security, data loss, race conditions | Report, wait |
| **[FIX]** | Type gaps, missing error handling, test gaps, slop | Report, wait |
| **[AUTO]** | Unused imports, dead code, console.log, typos | Fix immediately |
| **[CONSIDER]** | Refactors, style opinions, nice-to-have | Mention only |

### AUTO Criteria (all must be true)

- Zero risk of breaking behavior
- <5 seconds to fix
- No judgment call needed

**AUTO examples:** Unused imports/variables, trailing whitespace, console.log (unless intentional), dead/unreachable code, obvious typos in comments/strings

**NOT AUTO (needs confirmation):** Removing "unused" function (might be used elsewhere), type changes, any logic change, AI slop removal (might be intentional)

## Mindset

**Inheritance Test:** Would I curse the previous author? Understand at 2am?
**Pride Test:** Would I put my name on this?

## Workflow

### Step 0: Determine Scope & Group Files

Auto-detect: conversation changes, staged, or current diff.

```bash
git diff --cached --name-only  # or HEAD
```

Group files by area/dependency. Output: `Found X files in Y batches`

### Step 1: Create Review Plan

**BEFORE reading any file content**, create task list - one task per batch of related files.

### Step 2: Process Each Batch

For each batch:
1. Read diff for batch files only (`git diff --cached -- path/to/files`)
2. Review & categorize issues
3. Auto-fix [AUTO] items immediately
4. Note [BUG]/[FIX]/[CONSIDER] items
5. Mark batch complete

After each batch: `Batch 1 done: AUTO: 2 fixed | BUG: 1 | FIX: 2`

### Step 3: Summary & Options (After All Batches)

```
Total: BUG: X | FIX: X | CONSIDER: X (auto-fixed: Y)

Issues:
1. [BUG] ... - `path:line`
2. [FIX] ... - `path:line`

What to fix?
- a) BUG + FIX [recommended]
- b) BUG only
- c) All including CONSIDER
- d) Custom (e.g., "1,3")
```

**STOP. Wait for selection.**

### Step 4: Execute Fixes

Process fixes batch-by-batch, run linter if applicable.

## Severity Guide

**BUG:** Business logic errors, race conditions, security (injection, XSS, exposed secrets), null/undefined not handled, breaking edge cases

**FIX:** Type safety gaps, unsafe casts, missing error handling, test coverage gaps, AI slop, missing validation

**CONSIDER:** Refactoring opportunities, style preferences, performance micro-optimizations
