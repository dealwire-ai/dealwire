Create a Prisma migration for the current schema changes.

1. Run `cd apps/api && npx prisma migrate dev --name $ARGUMENTS` where $ARGUMENTS is the migration name (snake_case description of the change).
2. Read the generated SQL file in `apps/api/prisma/migrations/` — find the most recently created one.
3. Review the SQL for these unsafe patterns and flag them:
   - `CREATE INDEX` without `CONCURRENTLY` — locks the table, dangerous on large tables
   - `DROP COLUMN` or `DROP TABLE` — requires expand-and-contract pattern if app still references it
   - `ALTER COLUMN ... SET NOT NULL` on an existing column — will fail if any rows have NULL
   - `ALTER COLUMN ... TYPE` that changes the data type — may require explicit USING clause
4. Report:
   - What the migration does in plain English
   - Whether it's safe to run directly in production or requires special handling
   - The exact migration file path for reference
