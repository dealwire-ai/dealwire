---
allowed-tools: Bash, mcp__railway__list-deployments, mcp__railway__get-logs, mcp__railway__list-services, mcp__railway__list-projects
description: Merge the current branch's PR once all checks pass, then monitor Railway deployment.
---

Merge the current branch's PR once all checks pass, then monitor the Railway deployment to confirm it lands cleanly.

## Workflow

### Step 1: Find the PR

```bash
gh pr view --json number,title,state,statusCheckRollup,url
```

If no PR exists for the current branch, stop and tell the user.

### Step 2: Wait for checks

Poll check status every 30 seconds until all checks have completed:

```bash
gh pr checks
```

- If all checks pass, proceed to merge
- If any check fails, stop, show the failing check(s), and ask the user what to do
- Max wait: 10 minutes. If checks are still pending after 10 minutes, stop and tell the user.

### Step 3: Merge

```bash
gh pr merge --squash --delete-branch
```

Report the merged PR URL.

### Step 4: Monitor Railway Deployment

After merge, monitor the Railway deployment triggered by the push to main.

1. **Find the service**: Use `mcp__railway__list-projects` and `mcp__railway__list-services` to locate the `dealwire-api` service.

2. **Poll for the new deployment**: Use `mcp__railway__list-deployments` to find the latest deployment. Wait up to 30 seconds after merge for it to appear if needed.

3. **Wait for deployment to complete**: Poll deployment status every 30 seconds using `mcp__railway__list-deployments`. Max wait: 5 minutes.
   - **SUCCESS** — Report that the deployment is live.
   - **FAILED/CRASHED** — Fetch build logs using `mcp__railway__get-logs` and show them to the user. If the logs mention Prisma migration errors, flag it specifically and remind the user of the recovery pattern: add `prisma migrate resolve --rolled-back <migration-name>` to the start script, push, then remove it after successful deploy.
   - **TIMEOUT** — If still deploying after 5 minutes, tell the user it's still in progress and they should check the Railway dashboard.

### Output

Report both:

- The merged PR (number, title, URL)
- The Railway deployment result (success, failure with logs, or timeout)
