# Pilates OS — Coolify VPS Deployment Plan

**Generated:** 2026-05-05
**Target:** Single VPS running Coolify, deploying Pilates OS as a Dockerised Next.js 16 app with PostgreSQL 18 (and optional Redis).

This is a step-by-step checklist. Work top to bottom. Anything in `code blocks` is something you paste verbatim. Anything in **bold UPPERCASE** is something you have to fill in (domain, secrets, etc.).

---

## Part 1 — Prerequisites (do these before touching code)

### 1.1 VPS sizing
For 10–100 active students:
- **Minimum:** 2 vCPU, 4 GB RAM, 40 GB SSD
- **Recommended:** 4 vCPU, 8 GB RAM, 80 GB SSD
- Hetzner CPX21 / Hetzner CX22 / DigitalOcean Premium 4GB all fit.

### 1.2 Domain + DNS
You need:
- `app.yourstudio.com` (or whatever brand subdomain) → A record pointing to VPS IP
- `*.yourstudio.com` wildcard A record → same VPS IP (only required if you implement multi-tenant subdomains, otherwise skip)

Set TTL to 300s while testing, raise to 3600s once stable.

### 1.3 Coolify itself
Install Coolify on the VPS following the official one-liner: `curl -fsSL https://cdn.coolify.io/install.sh | bash`. After install, log into the Coolify UI at `http://VPS_IP:8000` and create your team.

### 1.4 GitHub source connection
In Coolify → Sources → connect GitHub. Grant Coolify access to the `pilatesOS` repo so it can read the Dockerfile and pull on push.

---

## Part 2 — Code changes required before first deploy

These are the **deployment-related** subset of the items in [MVP_GAPS.md](MVP_GAPS.md). Even if you skip the security fixes for a private beta, the items in this section are mandatory or the build will fail.

### 2.1 Ensure `output: 'standalone'` in `next.config.ts`

The repository already contains the production-ready `next.config.ts`. It includes `output: 'standalone'`, Sentry build-time wrapping, `serverExternalPackages`, a Turbopack root override, image `remotePatterns`, long-lived cache headers for logos, and CSP headers for static assets. **Do not overwrite it with a minimal snippet.**

If you are reviewing it before deploy, the deployment-relevant parts look like this:

```typescript
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer', 'postgres'],
  output: 'standalone',
  turbopack: {
    // Prevents Next.js from incorrectly inferring `website/` as the workspace root.
    root: process.cwd(),
  },
  compress: true,
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.unsplash.com' },
      // Add tenant image hosts via TENANT_IMAGE_HOSTS if needed.
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: '*.bunny.net' },
      { protocol: 'https', hostname: '*.cloudfront.net' },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
  assetPrefix: process.env.ASSET_PREFIX || '',
  reactStrictMode: true,
  poweredByHeader: false,
  // ... asset cache headers ...
};

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
};

export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
```

Only change `assetPrefix` or image `remotePatterns` if your CDN or domain setup requires it.

### 2.2 Healthcheck route — `src/app/api/health/route.ts`

The hardened healthcheck is already committed. It pings PostgreSQL with `SELECT 1`, logs DB failures via `pino`, and returns structured JSON:

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import logger from '@/lib/logger';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);

    return NextResponse.json({
      status: 'ok',
      ts: new Date().toISOString(),
      checks: {
        database: 'ok',
      },
    }, { status: 200 });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'Health check database failure',
    );

    return NextResponse.json({
      status: 'error',
      ts: new Date().toISOString(),
      checks: {
        database: 'error',
      },
    }, { status: 503 });
  }
}
```

Use this as Coolify's **Health check path** (`/api/health`, port `3000`) and as the Dockerfile `HEALTHCHECK` endpoint.

### 2.3 Pin Node + pnpm in `package.json`

Add to `package.json`:

```json
"engines": {
  "node": ">=20.0.0",
  "pnpm": ">=9.0.0"
},
"packageManager": "pnpm@10.33.2"
```

### 2.4 Add a Dockerfile at the project root

```dockerfile
# syntax=docker/dockerfile:1.7

# ── deps ───────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── builder ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ── runner ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs \
 && adduser -S -u 1001 -G nodejs nextjs

# Migrations + drizzle-kit live in node_modules; we need them at runtime
# only if we run migrations on container start. Recommended path: run
# migrations as a one-shot Coolify "Pre-deployment Command" instead.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

### 2.5 Add a `.dockerignore`

```
node_modules
.next
.env*
.git
.github
.vscode
.claude
*.md
tests
playwright-report
test-results
```

### 2.6 Add `public/robots.txt`

```
User-agent: *
Disallow: /admin
Disallow: /api
Allow: /
```

### 2.7 Commit and push

```powershell
git add next.config.ts Dockerfile .dockerignore package.json src/app/api/health public/robots.txt
git commit -m "chore: add deployment infra (Dockerfile, healthcheck, standalone build)"
git push origin main
```

---

## Part 3 — Coolify infrastructure setup

### 3.1 Create the PostgreSQL service

Coolify UI → **+ New Resource** → **Database** → **PostgreSQL 18** (falls Coolify PG 18 noch nicht als Template anbietet, Custom Docker Image `postgres:18-alpine` verwenden).

| Field | Value |
|---|---|
| Name | `pilates-os-db` |
| Database name | `pilates_os` |
| Username | `pilates_os` |
| Password | (auto-generate, copy to a secrets vault) |
| Port | leave default (random internal) |
| Public access | **OFF** (only the app should reach it) |

After creation, grab the **internal connection URL** — Coolify shows it as something like `postgres://pilates_os:GENERATED_PW@pilates-os-db:5432/pilates_os`. **Copy this.** This becomes `DATABASE_URL`.

### 3.2 (Optional) Create the Redis service

Skip this for the first deploy unless you've implemented BullMQ. If you want it ready:

Coolify UI → **+ New Resource** → **Database** → **Redis 7**.

| Field | Value |
|---|---|
| Name | `pilates-os-redis` |
| Password | (auto-generate) |
| Public access | **OFF** |

Internal URL becomes `redis://default:GENERATED_PW@pilates-os-redis:6379`. Copy → `REDIS_URL`.

### 3.3 Create the application

Coolify UI → **+ New Resource** → **Application** → **Public Repository** (or your private GitHub source).

| Field | Value |
|---|---|
| Repository | `https://github.com/yourname/pilatesOS` |
| Branch | `main` |
| Build pack | **Dockerfile** |
| Dockerfile location | `./Dockerfile` |
| Port | `3000` |
| Health check path | `/api/health` |
| Health check port | `3000` |

Don't deploy yet. We need env vars first.

---

## Part 4 — Environment variables — exactly what goes where

All values below go into Coolify → your application → **Environment Variables**. Use **Build-time** for things Next.js bakes into the bundle (the `NEXT_PUBLIC_*` ones), and **Runtime** for everything else. Mark anything sensitive as **Is Secret = ON** (Coolify masks it in logs).

### 4.1 Required for first deploy

| Variable | Value | Type | Secret |
|---|---|---|---|
| `NODE_ENV` | `production` | Runtime | No |
| `DATABASE_URL` | from §3.1 | Runtime | **Yes** |
| `AUTH_SECRET` | generate: `openssl rand -base64 32` | Runtime | **Yes** |
| `AUTH_TRUST_HOST` | `true` | Runtime | No |
| `NEXTAUTH_URL` | `https://app.yourstudio.com` | Runtime | No |
| `NEXT_PUBLIC_APP_URL` | `https://app.yourstudio.com` | Build-time | No |

> `AUTH_TRUST_HOST=true` is required because Coolify puts a reverse proxy in front of your container. Without it, Auth.js v5 will reject the requests as host-mismatch.

### 4.2 Generate `AUTH_SECRET` on Windows

In PowerShell:
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 } | ForEach-Object { [byte]$_ }))
```
Or via SSH on the VPS: `openssl rand -base64 32`. Save the output.

### 4.3 Optional now, required later

| Variable | When you need it |
|---|---|
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Only if Google OAuth is on. From Google Cloud Console → OAuth client. Authorized redirect URI = `https://app.yourstudio.com/api/auth/callback/google`. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Once you wire up Stripe (Phase 2 per [MVP_GAPS.md](MVP_GAPS.md)). |
| `RESEND_API_KEY`, `EMAIL_FROM` | Once you wire up email. |
| `REDIS_URL` | Once BullMQ is in use. |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | The moment you finish MVP-13. Do this on day 1 — silent prod errors are not acceptable. |
| `ALLOWED_ORIGINS` | Comma-separated list of origins allowed for `/api/*` CORS. Default is `http://localhost:3000` — set to `https://app.yourstudio.com` in production. |

### 4.4 Variables you can leave unset for MVP

`AWS_*`, `BUNNY_CDN_BASE_URL`, `META_*`, `META_TEST_EVENT_CODE` — used only by Phase 3 features. Leaving them empty does not crash the app (the env validator marks them optional).

---

### 4.5 Rate Limiting & `TRUSTED_PROXY_COUNT`

Rate limiting for login, register, forgot-password, purchases, and booking cancellation relies on the client IP. Coolify/Caddy adds **one reverse-proxy hop** in front of the container, so `TRUSTED_PROXY_COUNT` defaults to `1` in production.

| Environment | Typical value | Why |
|---|---|---|
| Local dev (no proxy) | `0` | Browser connects directly to Next.js. |
| Coolify production | `1` | Caddy → container. |
| Cloudflare → Coolify | `2` | Cloudflare → Caddy → container. |

If rate limiting appears to block everyone after deploy, raise or lower `TRUSTED_PROXY_COUNT` to match your actual proxy chain. Set it in Coolify → application → **Environment Variables** as a runtime variable.

---

## Part 5 — Database initialisation

This is a one-time setup. Do it after the first deploy starts but before you point users at the app.

### 5.1 Database Migrations

Active migrations live in `src/db/migrations/`. The `archived/` subdirectory contains superseded history and **must never be applied**.

#### Fresh production database

Apply the active sequence in order:

1. `0000_initial_schema.sql`
2. `0001_add_audit_logs.sql`
3. `0002_credit_purchases_granted_at.sql`
4. `0003_credit_purchases_invoice_unique.sql`
5. `0007_add_studios_created_by_user_id.sql`
6. `0008_studio_id_not_null.sql`

You can run them with the pre-deployment command (recommended):

```sh
pnpm db:migrate
```

Or manually inside the Coolify terminal:

```sh
node_modules/.bin/drizzle-kit migrate
```

#### Existing database

If the database already has production data, check `src/db/migrations/meta/_journal.json` first and apply **only** migrations that are not already recorded in the journal. Do not re-apply `0000` or any `archived/` migration. When in doubt, back up the database before running migrations.

> **Recommended:** set `pnpm db:migrate` as a Coolify **Pre-deployment Command** so every deploy applies only pending migrations before swapping containers.

### 5.2 Seed (only on a fresh database, not after every deploy)

Either through the Coolify terminal:

```sh
pnpm db:seed
```

Or run once locally with the production `DATABASE_URL` temporarily set in `.env.local`. **Do not** add `pnpm db:seed` to the pre-deployment command — it wipes data on every deploy ([scripts/seed.ts:33-40](scripts/seed.ts) deletes all rows first).

### 5.3 Verify

From the Coolify terminal:
```sh
node -e "require('postgres')(process.env.DATABASE_URL)\`SELECT count(*) FROM users\`.then(r => console.log(r))"
```

You should see 6 (admin + 2 instructors + 3 students).

---

## Part 6 — Domain, SSL, and routing

### 6.1 Attach the domain
Coolify UI → application → **Domains** → add `https://app.yourstudio.com`.

Coolify auto-provisions a Let's Encrypt cert via Traefik. Wait for the green padlock indicator (usually < 30s).

### 6.2 Force HTTPS
Coolify → application → **General** → **Force HTTPS** = ON.

### 6.3 Verify
```powershell
curl.exe -I https://app.yourstudio.com/api/health
```
Should return `200 OK` with `{ "status": "ok" }`.

```powershell
curl.exe -I https://app.yourstudio.com | Select-String "Strict-Transport-Security"
```
Should show HSTS header (added by [security-headers.ts](src/lib/security/security-headers.ts) once MVP-2 is fixed).

---

## Part 7 — Security activation checklist on the VPS

Things you turn on **outside** the application code, after deploy.

- [ ] **VPS firewall (ufw):** allow 22 (SSH), 80, 443. Drop everything else. SSH in and run:
  ```sh
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw default deny incoming
  ufw enable
  ```
- [ ] **SSH:** disable password auth, key-only. `/etc/ssh/sshd_config`: `PasswordAuthentication no`, `PermitRootLogin prohibit-password`. Reload: `systemctl reload sshd`.
- [ ] **fail2ban:** `apt install fail2ban`, enable the `sshd` jail.
- [ ] **Coolify itself:** in Coolify settings, set a strong admin password and enable 2FA. Restrict the Coolify dashboard port (8000) to a single IP via ufw, or close it entirely and use SSH tunnelling: `ssh -L 8000:localhost:8000 user@vps`.
- [ ] **Database not exposed:** confirm in Coolify that `pilates-os-db` has **Public access = OFF**. Try `psql postgres://...@your.vps.ip:5432/pilates_os` from your laptop — it must fail.
- [x] **App-level security headers:** CSP is built per-request with a real nonce, HSTS is set in production, and `X-Frame-Options`/`Referrer-Policy`/`Permissions-Policy` are active. Verify with the curl commands above.
- [ ] **Auth `AUTH_TRUST_HOST=true`** is set (§4.1).
- [ ] **`ALLOWED_ORIGINS`** is set to your real domain, not `localhost`.
- [x] **Rate limiting** is wired on login, register, forgot-password, credit-purchases, and booking-cancel endpoints.
- [x] **Sentry** is installed and will receive events once `SENTRY_DSN`/`SENTRY_AUTH_TOKEN` are set. Trigger a deliberate `throw` from a debug route to confirm in the Sentry UI.
- [ ] **Backups:** Coolify → `pilates-os-db` → enable automated backups, daily, retention 14 days, push to S3 if you have it (otherwise local).
- [ ] **HTTPS-only cookies:** Auth.js v5 sets `__Secure-` cookie prefix automatically when `NEXTAUTH_URL` is `https://`. Double-check by inspecting cookies in DevTools after login.

---

## Part 8 — First-deploy checklist (concrete sequence)

Tick in order. Don't skip ahead.

1. [ ] All MVP-1 to MVP-8 items in [MVP_GAPS.md](MVP_GAPS.md) are merged to `main`.
2. [ ] `pnpm typecheck` passes locally.
3. [ ] `pnpm build` passes locally with the new `next.config.ts`.
4. [ ] `docker build -t pilates-os-test .` builds successfully.
5. [ ] VPS provisioned, Coolify installed, GitHub source connected.
6. [ ] Postgres service created in Coolify, `DATABASE_URL` copied to a vault.
7. [ ] Application created in Coolify pointing at the GitHub repo.
8. [ ] Env vars from §4.1 set; `AUTH_SECRET` generated and saved.
9. [ ] Pre-deployment command set to `pnpm db:migrate`.
10. [ ] First deploy triggered. Watch logs in Coolify until "Ready in Xms".
11. [ ] `curl https://app.yourstudio.com/api/health` returns 200.
12. [ ] Open Coolify terminal, run `pnpm db:seed` (one time only).
13. [ ] Visit `https://app.yourstudio.com/login`, log in as `admin@pilatesos.com` / `password123`.
14. [ ] **Immediately change the admin password** via the admin profile page (or directly in the DB).
15. [ ] Smoke test the four critical flows manually:
    - register a new student
    - admin marks a pending purchase as paid → credit appears in student's balance
    - student books a class → credit deducted, session bookedCount incremented
    - student cancels >24h ahead → credit refunded
16. [ ] Run through the Part 7 security checklist.
17. [ ] Set up monitoring: Coolify alerts on container down, Sentry on errors.
18. [ ] Tell beta users.

---

## Part 9 — Post-deploy ops

### Updating the app
Push to `main` → Coolify auto-builds → migrations run via pre-deployment hook → zero-downtime swap. If something breaks, Coolify keeps the previous container; click **Rollback** in the UI.

### Reading logs
Coolify → application → **Logs**. For DB queries you'll need to enable Drizzle logger (off by default in [src/db/index.ts](src/db/index.ts) — flip with an env var when debugging).

### Database backups
Coolify auto-backups → restore via UI. Test the restore at least once before you need it.

### Manual DB access for emergencies
Coolify → `pilates-os-db` → **Terminal**:
```sh
psql -U pilates_os -d pilates_os
```

### Rollback
Coolify → application → **Deployments** → click any previous successful deploy → **Redeploy this version**. Migrations are not auto-rolled-back — never write a migration that drops a column you still need to roll back to.

---

## Part 10 — Open questions / decisions to make before deploy

Document the answers in your runbook before going live:

1. **Multi-tenant?** Are you deploying for one studio (`app.yourstudio.com`) or multiple (`paquita.pilatesos.com`, `studio2.pilatesos.com`, …)? The latter requires the middleware-level subdomain routing work that's currently in the backlog.
2. **Stripe?** Stripe path is gated behind a "Coming Soon" badge. If you want it for MVP, MVP-9-ish work + a webhook handler is needed.
3. **Email?** Acceptable to launch a closed beta with no transactional email? If yes, document this gap on the beta sign-up page so users know to check the dashboard.
4. **Who is on call?** Pick one human, give them Sentry + Coolify access, agree on response time.
5. **Data residency?** Hetzner EU vs DO US — pick once, hard to migrate later.
