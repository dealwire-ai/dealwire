# Open a PR

Important: Steps 2 and 3 require `required_permissions: ['all']` because:
- Pre-commit hooks need access to global npm/node paths outside the workspace
- `gh` CLI has TLS certificate issues in sandboxed mode

## Critical Rules

**NEVER include PII (Personally Identifiable Information) in:**
- Commit messages
- PR titles or descriptions
- Branch names
- File paths or names mentioned in commits/PRs
- Any text that will be publicly visible

PII includes: names, email addresses, phone numbers, physical addresses, usernames, account IDs, API keys, tokens, passwords, or any other sensitive personal data.

## Step 1: Check state (ONE command)

```bash
git branch --show-current && git status -s && git diff HEAD --stat
```

- **Always create a new branch for each PR** unless you're already on the correct branch for the current changes.
- If on `main` OR if the current branch doesn't match the work you're committing: create a branch using the appropriate prefix:
  - `feat/<description>` - new features
  - `fix/<description>` - bug fixes
  - `chore/<description>` - maintenance, refactoring, etc.

```bash
git checkout -b feat/<description>
```

Note: `git checkout -b` requires `required_permissions: ['git_write']`

## Step 2: Commit + Push (`required_permissions: ['all']`)

If uncommitted changes exist:

**If staged files exist** (respect user's selection):
```bash
git commit -m "<msg>" && git push
```

**If unstaged files exist** (add specific files, NOT `git add .`):
```bash
git add <file1> <file2> ... && git commit -m "<msg>" && git push
```

## Step 3: Create PR (`required_permissions: ['all']`)

**Format:**
```
<feature_area>: <Title> (80 chars max)

<TLDR> (1-2 sentences)

- bullet 1
- bullet 2
```

**Note:** When creating the PR body, populate the template sections:
- **Description**: Use the TLDR and bullets from above
- **Type of Change**: Check the appropriate box
- **Changes Made**: List key changes
- **Testing**: Describe testing done (e.g., "All unit tests pass", "Manual testing completed")
- **Related Issues**: Link any related issues using `Closes #123` or `Fixes #456`

**Template format for body:**
```markdown
## Description

<TLDR and bullets here>

## Type of Change

- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] 💥 Breaking change
- [ ] 📝 Documentation update
- [ ] 🔧 Refactoring
- [ ] ⚡ Performance improvement
- [ ] 🧪 Test updates
- [ ] 🔨 Build/config changes

## Changes Made

- <bullet 1>
- <bullet 2>

## Testing

- [x] Unit tests added/updated
- [x] All existing tests pass
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Related Issues

Closes #<issue_number>
```

**Without skip-review:**
```bash
gh pr create --title "<title>" --body "<formatted_body_with_template>"
```

**With skip-review** (user says "skip review", "#skipreview", etc.):
```bash
gh pr create --title "<title>" --body "<formatted_body_with_template>" && gh pr comment $(gh pr view --json number -q .number) --body "#skipreview"
```

**Note:** GitHub will automatically use `.github/pull_request_template.md` when creating PRs through the web UI. For CLI, format the body using the template structure above.

Display the returned PR URL as a markdown link on its own line, formatted as: `[PR #<number>](<url>)` so it's clickable.
Display the name of the branch you created.


You also have access to the github MCP server if it helps to see other issues, PRs, or commits.