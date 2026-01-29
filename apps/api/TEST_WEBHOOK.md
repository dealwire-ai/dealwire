# Testing the Webhook Locally

## Prerequisites

1. Make sure your API server is running:
   ```bash
   pnpm --filter @analyzer/api dev
   ```

2. Ensure you have your environment variables set in `.env`:
   - `RESEND_API_KEY` - Your Resend API key
   - `RESEND_WEBHOOK_SECRET` - Your Resend webhook secret (get from Resend dashboard)
   - `OPENAI_API_KEY` - Your OpenAI API key

## Running the Test

The test script sends a mock webhook payload to your local webhook endpoint, simulating what Resend would send when an email is received.

### Basic test (sends to isaac@frontstep.ai):
```bash
pnpm exec tsx test-webhook.ts
```

### Send to a different email:
```bash
pnpm exec tsx test-webhook.ts test123 noah@frontstep.ai
```

### With custom email ID and sender:
```bash
pnpm exec tsx test-webhook.ts my_email_id isaac@frontstep.ai
```

## What the test does:

1. Creates a mock Resend webhook payload with a sample real estate deal
2. Generates valid Svix signature headers for authentication
3. Sends the payload to `http://localhost:3001/webhooks/resend`
4. Your webhook handler will:
   - Verify the signature
   - Extract the email content
   - Look up client preferences based on sender email
   - Generate an AI summary using OpenAI
   - Make a decision (yes/no) based on deal criteria
   - Send a formatted email reply to the sender

## Expected Output

You should see:
1. Console output showing the webhook was processed
2. An email sent to the sender address with the deal summary and decision
3. The email will be branded according to the client preferences stored in the database (ScreeningPreferences table)

## Troubleshooting

### "Connection refused"
- Make sure the API server is running on port 3001
- Run: `pnpm --filter @analyzer/api dev`

### "Invalid webhook signature"
- Check that `RESEND_WEBHOOK_SECRET` in `.env` matches what's in the test script
- For local testing, you can use any test secret (they just need to match)

### "No email received"
- Check the console logs to see if there were errors
- Verify your `RESEND_API_KEY` is valid
- Make sure the sender email's user has an organizationId and that organization has ScreeningPreferences configured in the database

## Client Preferences

The test will use client preferences based on the sender email's organization. Preferences are stored in the `ScreeningPreferences` table in the database, linked to the user's organization via `organizationId`.

To configure preferences:
1. Ensure the user has an `organizationId` set
2. Create or update the `ScreeningPreferences` record for that organization in the database

Preferences include: `dealCriteria`, `companyName`, `brandColor`, `passedFolderName`, and `alwaysSkip`. The organization logo is automatically pulled from the Clerk organization's `imageUrl` field.
