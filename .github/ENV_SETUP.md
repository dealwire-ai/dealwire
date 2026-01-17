# Setting Up Environment Variables in GitHub Actions

This guide explains how to add environment variables (secrets) to your GitHub repository for use in CI/CD workflows.

## How to Add Secrets

1. **Go to your repository on GitHub**
2. **Navigate to Settings** → **Secrets and variables** → **Actions**
3. **Click "New repository secret"**
4. **Enter the secret name and value**
5. **Click "Add secret"**

## Required Secrets for CI

The following secrets are used in the CI workflow. For tests, dummy values can be used since all external services are mocked:

### Required (with dummy values acceptable for tests)

- `DATABASE_URL` - PostgreSQL connection string (can be dummy for tests: `postgresql://dummy:dummy@localhost:5432/dummy`)
- `OPENAI_API_KEY` - OpenAI API key (can be dummy for tests: `dummy-key-for-tests`)
- `CLERK_SECRET_KEY` - Clerk secret key (can be dummy for tests: `dummy-clerk-key`)
- `CLERK_WEBHOOK_SECRET` - Clerk webhook secret (can be dummy for tests: `dummy-webhook-secret`)

### Optional (only needed for actual deployments)

- `RESEND_API_KEY` - Resend API key
- `RESEND_WEBHOOK_SECRET` - Resend webhook secret
- `AWS_ACCESS_KEY_ID` - AWS access key for S3/SQS
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for S3/SQS
- `MICROSOFT_WEBHOOK_SECRET` - Microsoft Graph webhook secret
- `API_BASE_URL` - Production API URL
- `METRICS_USERNAME` - Metrics endpoint username
- `METRICS_PASSWORD` - Metrics endpoint password

## Using Secrets in Workflows

Secrets are accessed in workflow files using:
```yaml
env:
  MY_SECRET: ${{ secrets.MY_SECRET }}
```

The workflow file (`.github/workflows/ci.yml`) includes fallback dummy values for tests, so secrets are optional for CI. However, if you want to use real values (for integration tests), add them as secrets.

## Security Notes

- **Never commit secrets to the repository**
- Secrets are encrypted and only visible to repository administrators
- Secrets are masked in workflow logs (they appear as `***`)
- Use repository secrets for values that should be available to all workflows
- Use environment secrets for values specific to deployment environments
