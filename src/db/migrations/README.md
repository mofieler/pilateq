# PilatesOS Database Migrations

This directory contains the active migration SQL files for the PilatesOS PostgreSQL database.

## Active migrations

Files in this directory are applied to deployments in the order recorded in `meta/_journal.json`.

The current active sequence is:

1. `0000_initial_schema.sql`
2. `0001_add_audit_logs.sql`
3. `0002_credit_purchases_granted_at.sql`
4. `0003_credit_purchases_invoice_unique.sql`
5. `0007_add_studios_created_by_user_id.sql`
6. `0008_studio_id_not_null.sql`

Numbers `0004`–`0006` are intentionally skipped in the active sequence: the schema changes they represented were already folded into the consolidated initial schema or are covered by later active migrations. This keeps the active set minimal for new deployments. Existing production databases that previously applied archived migrations `0004`–`0006` should not re-apply them.

## `archived/` directory

The `archived/` subdirectory contains superseded migration files. These migrations are part of the project's history but **must not be applied to new deployments**. The active migration sequence in this directory already incorporates their effects (for example, the initial schema migration rolls up earlier incremental changes).

Do not delete files from `archived/`, and do not move archived migrations back into this directory without explicit approval.

## Deployment checklist

### Fresh database deploy

- [ ] Provision an empty PostgreSQL database.
- [ ] Set `DATABASE_URL` and run `pnpm db:migrate` (or `node_modules/.bin/drizzle-kit migrate`).
- [ ] Confirm `_journal.json` shows migrations `0000`, `0001`, `0002`, `0003`, `0007`, `0008` as applied.
- [ ] Run `pnpm db:seed` once if seed data is required.
- [ ] Verify the app starts and `/api/health` returns `database: ok`.

### Existing database deploy

- [ ] Back up the database before any migration run.
- [ ] Check `src/db/migrations/meta/_journal.json` against the production journal table to identify only the missing migrations.
- [ ] Apply **only** the missing active migrations; never re-run `0000` or any file from `archived/`.
- [ ] Verify application logs and `/api/health` after deploy.

## Local development

Use `pnpm db:migrate` to bring a local database up to date. Use `pnpm db:studio` to inspect tables and relationships.
