# Development Tips

1. **Testing email flow (E2E)**: Send a test deal email to a monitored Outlook inbox to trigger the full pipeline:
   ```bash
   cd apps/api && pnpm send-test-email imlevine@outlook.com
   ```
   This sends a realistic deal email via Resend → arrives in Outlook → Graph webhook fires → deal detection → screening → reply. Watch Railway logs or local server output. The verified Resend sending domain is `mail.deals.frontstep.ai`.
2. **Preferences not loading?**: Check snake_case vs camelCase mapping
3. **Subscription not working?**: Verify `API_BASE_URL` is HTTPS
4. **Replies not threaded?**: Must use Graph API's `createReply` endpoint
5. **Migrations (local)**: `cd apps/api && npx prisma migrate dev`
6. **Migrations (prod)**: Must use the **direct** Supabase URL (port 5432, no pgbouncer). Run from `apps/api`:
   ```bash
   DATABASE_URL="postgresql://postgres.icujkrafywivakbfrerg:<PASSWORD>@aws-1-us-east-1.pooler.supabase.com:5432/postgres" \
   DIRECT_URL="postgresql://postgres.icujkrafywivakbfrerg:<PASSWORD>@aws-1-us-east-1.pooler.supabase.com:5432/postgres" \
   pnpm db:migrate:prod
   ```
   **Never** use the pooler URL (port 6543) for migrations — it will hang.
7. **API won't start?**: SQS is disabled by default in dev. No AWS credentials needed locally.
8. **Testing auth locally**: Use curl without token (allowed in dev), or set `REQUIRE_AUTH=true` to test full flow
9. **CORS issues?**: Verify `FRONTEND_URL` in API .env matches your frontend origin
