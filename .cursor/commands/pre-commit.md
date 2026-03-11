# Pre-Commit Checks

Run lint, test, and build for both backend and frontend before committing.
Stop at the first failure — do NOT continue to subsequent steps if one fails.

## Step 1: Backend lint

```bash
pnpm --filter @dealwire/api lint
```

If lint fails, fix the issues and re-run before proceeding.

## Step 2: Backend tests

```bash
pnpm --filter @dealwire/api test
```

If tests fail, report failures and stop.

## Step 3: Backend build

```bash
pnpm --filter @dealwire/api build
```

If build fails, report errors and stop.

## Step 4: Frontend lint

```bash
pnpm --filter @dealwire/web lint
```

If lint fails, fix the issues and re-run before proceeding.

## Step 5: Frontend build (includes tsc)

```bash
pnpm --filter @dealwire/web build
```

If build fails, report errors and stop.

## Step 6: Summary

Print a short pass/fail summary for each step. If all passed, say the code is ready to commit.
