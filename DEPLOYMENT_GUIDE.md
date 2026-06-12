# Pilates OS — Complete Deployment Guide

**Last Updated:** 2026-05-08  
**Framework:** Next.js 16 | **Database:** PostgreSQL 18 | **Deployment:** Coolify (VPS)

---

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [All Environment Variables (Complete List)](#all-environment-variables-complete-list)
3. [Where to Get Each Value](#where-to-get-each-value)
4. [Coolify Production Setup](#coolify-production-setup)
5. [Database Migrations](#database-migrations)
6. [Verification Checklist](#verification-checklist)

---

## Local Development Setup

### Step 1: Clone & Install

```bash
git clone <your-repo>
cd pilatesOS
pnpm install
```

### Step 2: Create `.env.local`

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

### Step 3: Fill in Development Values

Edit `.env.local` and set these minimum values:

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Database (local PostgreSQL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/pilates_os

# Auth (generate random secret)
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_GOOGLE_ID=optional-for-dev
AUTH_GOOGLE_SECRET=optional-for-dev

# Redis (optional for dev, uses in-memory fallback)
REDIS_URL=redis://localhost:6379

# Trusted proxy (0 for direct connection)
TRUSTED_PROXY_COUNT=0

# Turnstile (optional for dev, disable if no keys)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Email (optional for dev, mocks in dev mode)
RESEND_API_KEY=optional-for-dev
EMAIL_FROM=noreply@yourstudio.com

# Other optional for dev (Stripe, S3, Sentry, etc.)
# Can be left empty and will be skipped
```

### Step 4: Start Dev Server

```bash
pnpm dev
```

Visit `http://localhost:3000` — you're ready to develop.

---

## All Environment Variables (Complete List)

### Tier 1: CRITICAL (Must Have)

| Variable | Description | Type | Example |
|----------|-------------|------|---------|
| `NEXT_PUBLIC_APP_URL` | Your app domain | public | `http://localhost:3000` |
| `NODE_ENV` | Environment mode | string | `development` or `production` |
| `DATABASE_URL` | PostgreSQL connection | secret | `postgresql://user:pass@host:5432/db` |
| `AUTH_SECRET` | Auth.js signing key | secret | 32-byte base64 string |

### Tier 2: HIGH PRIORITY (Security + Core Features)

| Variable | Description | Type | Example |
|----------|-------------|------|---------|
| `REDIS_URL` | Rate limiting & queues | secret | `redis://localhost:6379` |
| `TRUSTED_PROXY_COUNT` | Reverse proxy hops | number | `1` (usually) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare CAPTCHA key | public | Turnstile site key |
| `TURNSTILE_SECRET_KEY` | Cloudflare CAPTCHA secret | secret | Turnstile secret key |
| `AUTH_GOOGLE_ID` | Google OAuth client | public | `xxx.apps.googleusercontent.com` |
| `AUTH_GOOGLE_SECRET` | Google OAuth secret | secret | Random string from Google |

### Tier 3: MEDIUM PRIORITY (Payments + Email)

| Variable | Description | Type | Example |
|----------|-------------|------|---------|
| `STRIPE_SECRET_KEY` | Stripe payments | secret | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks | secret | `whsec_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client key | public | `pk_live_...` or `pk_test_...` |
| `RESEND_API_KEY` | Email service | secret | `re_...` |
| `EMAIL_FROM` | Email sender address | string | `noreply@yourstudio.com` |

### Tier 4: OPTIONAL (File Storage + Analytics)

| Variable | Description | Type | Example |
|----------|-------------|------|---------|
| `AWS_ACCESS_KEY_ID` | S3 uploads | secret | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | S3 uploads | secret | AWS secret key |
| `AWS_REGION` | S3 region | string | `eu-central-1` |
| `AWS_S3_BUCKET` | S3 bucket name | string | `pilates-os-assets` |
| `BUNNY_CDN_BASE_URL` | CDN URL | public | `https://cdn.yourstudio.com` |
| `META_PIXEL_ID` | Meta pixel ID | string | Your pixel ID |
| `META_CAPI_ACCESS_TOKEN` | Meta CAPI token | secret | Your access token |
| `META_TEST_EVENT_CODE` | Meta test mode (dev only) | string | Leave empty in prod |
| `SENTRY_DSN` | Error tracking | secret | Your Sentry DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | Error tracking (public) | public | Your Sentry DSN |

---

## Where to Get Each Value

### `AUTH_SECRET` — Generate Locally

```bash
openssl rand -base64 32
```

Copy the output and paste into `.env.local` or Coolify.

### `REDIS_URL` — Three Options

#### Option 1: Local Redis (Development Only)
```bash
# Install Redis locally
# macOS: brew install redis
# Ubuntu: sudo apt-get install redis-server
# Windows: https://github.com/microsoftarchive/redis/releases

# Start Redis
redis-server

# Use this URL:
REDIS_URL=redis://localhost:6379
```

#### Option 2: Coolify on Same VPS (Production)
If you have Redis running on the same VPS:
```
REDIS_URL=redis://localhost:6379
```

#### Option 3: External Redis Service
If using a managed Redis service (e.g., Redis Labs, Upstash):
```
REDIS_URL=redis://:password@host:port
```

**For dev:** Leave empty to use in-memory fallback (single-instance only)  
**For prod:** Must set to actual Redis URL

### `TRUSTED_PROXY_COUNT` — Check Your Infrastructure

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       v
┌─────────────────────────────────────┐
│  Cloudflare / CDN / Reverse Proxy    │  ← Count hops here
└──────┬──────────────────────────────┘
       │
       v
┌─────────────────────────────────────┐
│  nginx / Load Balancer (optional)    │  ← Count hops here
└──────┬──────────────────────────────┘
       │
       v
┌─────────────────────────────────────┐
│  Your Next.js App (Coolify)          │
└─────────────────────────────────────┘
```

**Set `TRUSTED_PROXY_COUNT` to the number of hops:**
- **0** = Direct connection (no proxy)
- **1** = One proxy (e.g., Cloudflare → app)
- **2** = Two proxies (e.g., Cloudflare → nginx → app)

For **Coolify on a VPS with Cloudflare**: use `1`  
For **Coolify on a VPS without proxy**: use `0`

### `AUTH_GOOGLE_ID` & `AUTH_GOOGLE_SECRET` — Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. **Create a new project** (or select existing):
   - Top left → "Select a Project" → "New Project"
   - Name: "Pilates OS"
   - Click "Create"
3. **Enable OAuth 2.0 Consent Screen:**
   - Left sidebar → "APIs & Services" → "OAuth consent screen"
   - User Type: "External" → "Create"
   - Fill in: App name, User support email, Developer email
   - Scopes: No scopes needed for credentials
   - Click "Save & Continue"
4. **Create OAuth 2.0 Client ID:**
   - Left sidebar → "Credentials"
   - "Create Credentials" → "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Name: "Pilates OS"
   - **Authorized redirect URIs:** Add these:
     - `http://localhost:3000/api/auth/callback/google` (dev)
     - `https://yourdomain.com/api/auth/callback/google` (prod)
   - Click "Create"
   - Copy **Client ID** and **Client Secret**

Paste into:
```
AUTH_GOOGLE_ID=<Client ID>
AUTH_GOOGLE_SECRET=<Client Secret>
```

### `NEXT_PUBLIC_TURNSTILE_SITE_KEY` & `TURNSTILE_SECRET_KEY` — Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Left sidebar → "Turnstile"
3. Click "Add site"
   - Site name: "Pilates OS" (or your domain)
   - Domains: `localhost`, `yourdomain.com`
   - Mode: "Managed" (recommended)
   - Widget Mode: "Invisible" (recommended)
   - Click "Create"
4. Copy **Site Key** and **Secret Key**

Paste into:
```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<Site Key>
TURNSTILE_SECRET_KEY=<Secret Key>
```

### `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. **Get API Keys:**
   - Left sidebar → "Developers" → "API keys"
   - Copy **Secret key** (starts with `sk_test_` or `sk_live_`)
   - Copy **Publishable key** (starts with `pk_test_` or `pk_live_`)
3. **Get Webhook Secret:**
   - Left sidebar → "Webhooks"
   - Click "Add endpoint"
   - Endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events to send:
     - `checkout.session.completed`
     - `payment_intent.failed`
   - Click "Add endpoint"
   - Copy **Signing secret** (starts with `whsec_`)

Paste into:
```
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

### `RESEND_API_KEY` — Resend Email Service

1. Go to [Resend](https://resend.com)
2. Sign up or log in
3. Left sidebar → "API Keys"
4. Copy **API Key** (starts with `re_`)

Paste into:
```
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@yourstudio.com
```

### AWS Credentials (Optional for VOD)

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam)
2. **Create IAM User:**
   - Left sidebar → "Users" → "Create user"
   - User name: "pilates-os"
   - Check "Provide user access to the AWS Management Console"
   - Click "Next"
3. **Attach S3 Policy:**
   - Select "Attach policies directly"
   - Search and select: `AmazonS3FullAccess`
   - Click "Next" → "Create user"
4. **Generate Access Keys:**
   - Click on the user → "Security credentials" tab
   - Under "Access keys" → "Create access key"
   - Use case: "Application running outside AWS"
   - Copy **Access Key ID** and **Secret Access Key**

Paste into:
```
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=eu-central-1
AWS_S3_BUCKET=pilates-os-assets
```

---

## Coolify Production Setup

### Step 1: Create Project in Coolify

1. Log into your **Coolify dashboard** (`https://your-coolify-instance.com`)
2. Click "New Project"
3. Name: "Pilates OS"
4. Click "Create"

### Step 2: Add PostgreSQL Database

1. Within the project, click "Add Service"
2. Select "PostgreSQL"
3. Fill in:
   - Name: `pilates-db`
   - Database: `pilates_os`
   - Username: `pilates_user`
   - Password: (generate strong password)
4. Click "Create"
5. Note the **connection string** (Coolify shows it on the service page):
   ```
   postgresql://pilates_user:password@localhost:5432/pilates_os
   ```

### Step 3: Add Redis (for rate limiting)

1. Within the project, click "Add Service"
2. Select "Redis"
3. Fill in:
   - Name: `pilates-redis`
   - Password: (generate strong password)
4. Click "Create"
5. Note the **Redis URL**:
   ```
   redis://default:password@localhost:6379
   ```

### Step 4: Deploy Next.js App

1. Within the project, click "Add Service"
2. Select "Docker Compose" or "GitHub" (recommended)
3. If GitHub:
   - Connect your GitHub repo
   - Select the branch (e.g., `main`)
   - Coolify auto-detects Next.js
4. Configure build settings:
   - Build command: `pnpm build`
   - Start command: `pnpm start`
   - Node version: 20+

### Step 5: Add Environment Variables in Coolify

In the Next.js service settings, find the **Environment Variables** section.

Add all variables from the list above. **Key ones:**

```
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production

DATABASE_URL=postgresql://pilates_user:password@localhost:5432/pilates_os
AUTH_SECRET=<your-generated-secret>
AUTH_GOOGLE_ID=<from Google Cloud>
AUTH_GOOGLE_SECRET=<from Google Cloud>

REDIS_URL=redis://default:password@localhost:6379
TRUSTED_PROXY_COUNT=1

NEXT_PUBLIC_TURNSTILE_SITE_KEY=<from Cloudflare>
TURNSTILE_SECRET_KEY=<from Cloudflare>

STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@yourstudio.com

# Optional: AWS, Meta, Sentry
```

### Step 6: Deploy

1. Click "Deploy" in Coolify
2. Wait for build to complete (~5 minutes)
3. Verify app is running: `https://yourdomain.com`

---

## Database Migrations

After deployment, you must run the **database migration for the waivers table** (required for new security features).

### Option 1: Via Drizzle Kit (Recommended)

Connect to your production database and run:

```bash
# From your local machine (with production DATABASE_URL in .env.local):
pnpm db:migrate

# Or if using Drizzle Studio for quick verification:
pnpm db:studio
```

### Option 2: Manual SQL in Coolify

1. In Coolify, open your PostgreSQL service
2. Click "Database" → "Connect" (or use psql CLI)
3. Run the migration SQL manually:

```sql
-- Migration: Add waivers table for legal liability records
CREATE TABLE IF NOT EXISTS "waivers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "waiver_version" varchar(32) NOT NULL,
  "signed_name" varchar(255) NOT NULL,
  "signed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" varchar(64),
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "waivers_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "waivers_user_id_idx" ON "waivers" ("user_id");
CREATE INDEX IF NOT EXISTS "waivers_signed_at_idx" ON "waivers" ("signed_at");
```

### Verify Migration Success

Check that the table exists:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'waivers';
```

Should return one row with `waivers`.

---

## Verification Checklist

After deployment, verify everything works:

### Local Development
- [ ] `pnpm install` succeeds
- [ ] `.env.local` has all required variables
- [ ] `pnpm dev` starts without errors
- [ ] `http://localhost:3000` loads
- [ ] Login/register page renders
- [ ] Google OAuth button shows (if keys set)
- [ ] Turnstile CAPTCHA widget shows (if keys set)
- [ ] Can create account successfully
- [ ] Waivers table migration ran (`pnpm db:studio`)

### Production (Coolify)

- [ ] Build completes without errors
- [ ] App is accessible at `https://yourdomain.com`
- [ ] Login page loads
- [ ] Rate limiting works (try 100 requests in rapid succession to `/register`, should be blocked)
- [ ] Turnstile CAPTCHA works on registration
- [ ] Email sending works (check Resend logs)
- [ ] Stripe webhook is receiving events (Stripe Dashboard → Webhooks → Check events)
- [ ] Database migrations are applied

### Testing Production Environment

```bash
# Test rate limiting (should return 429 after 100 requests)
for i in {1..150}; do curl https://yourdomain.com; done

# Test Turnstile integration
# Go to https://yourdomain.com/register
# Try to submit form without Turnstile = blocked
# Complete Turnstile, then submit = works

# Test email
# Create account, check your email inbox (Resend logs show if sent)

# Check Redis connection
# Coolify dashboard → Redis service → Status should show "Running"
```

---

## Troubleshooting

### Database Connection Failed
```
error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:** Verify `DATABASE_URL` is correct. In Coolify, it's usually `postgresql://user:pass@db-service:5432/dbname`, not `localhost`.

### Redis Connection Timeout
```
Error: Redis connection timeout
```
**Solution:** Rate limiter falls back to in-memory (dev). Set `REDIS_URL` in production, or disable by leaving it empty (single-instance only).

### Turnstile Not Working
```
Error: Invalid Turnstile token
```
**Solution:** 
1. Check site key matches your domain in Cloudflare Turnstile dashboard
2. Verify `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are set
3. Test in Turnstile dashboard directly

### Stripe Webhook Not Firing
```
Webhook status: Failed (no events received)
```
**Solution:**
1. Verify webhook URL is correct: `https://yourdomain.com/api/webhooks/stripe`
2. Check `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
3. Test webhook manually in Stripe Dashboard → Webhooks → "Send test event"

### Email Not Sending
```
Resend error: Missing API key
```
**Solution:**
1. Verify `RESEND_API_KEY` is set in Coolify environment
2. Check Resend dashboard for API key (should start with `re_`)
3. Verify `EMAIL_FROM` matches verified sender in Resend

---

## Security Notes

- **Never commit `.env.local`** — it's in `.gitignore`
- **Rotate secrets regularly** — especially `AUTH_SECRET` and `STRIPE_WEBHOOK_SECRET`
- **Use `sk_live_` keys in production, `sk_test_` in development** — Stripe will warn if reversed
- **Keep Redis password strong** — it holds rate-limit and session data
- **Enable Cloudflare DDoS protection** — Turnstile + Cloudflare WAF = strong defense
- **Monitor rate limiting logs** — if many 429 responses, investigate suspicious activity

---

## Questions?

Refer to CLAUDE.md for architecture details or check relevant service files in `src/lib/` for implementation specifics.
