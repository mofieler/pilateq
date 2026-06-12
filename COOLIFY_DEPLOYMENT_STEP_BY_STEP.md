# Pilates OS — Step-by-Step Coolify Deployment Guide

> **Goal:** Deploy Pilates OS to your own VPS using Coolify, with PostgreSQL, optional Redis, SSL, and automatic deploys on every `git push`.
> **Skill level:** Beginner-friendly. You only need basic DNS knowledge and a GitHub account.

---

## 📋 What You Need Before You Start

| Thing | Why You Need It | Example |
|---|---|---|
| **VPS** (virtual private server) | Where Coolify and your app run | Hetzner CPX21, DigitalOcean 4GB, etc. |
| **Domain name** | So users can reach your app with HTTPS | `yourstudio.com` |
| **GitHub account + repo** | Coolify pulls the code from there | `github.com/yourname/pilatesOS` |
| **An hour of time** | First deploy has many small steps | — |

### Recommended VPS Size

For a single Pilates studio with up to a few hundred students:

- **Minimum:** 2 vCPU, 4 GB RAM, 40 GB SSD
- **Recommended:** 4 vCPU, 8 GB RAM, 80 GB SSD
- **OS:** Ubuntu 22.04 LTS or Debian 12

---

## 🌍 Step 1 — Buy Domain & Point DNS to Your VPS

1. Buy a domain from any registrar (Cloudflare, Namecheap, Hetzner, etc.).
2. In your DNS settings, create these records:

| Type | Name | Target / Value | TTL |
|---|---|---|---|
| A | `@` (root) | Your VPS IP | 300 |
| A | `app` | Your VPS IP | 300 |
| A | `www` | Your VPS IP | 300 |

> **Example:** If your domain is `yourstudio.com` and VPS IP is `123.456.78.90`, create:
> - `yourstudio.com` → 123.456.78.90
> - `app.yourstudio.com` → 123.456.78.90
> - `www.yourstudio.com` → 123.456.78.90

3. Wait 5–10 minutes, then check with:
   ```bash
   ping app.yourstudio.com
   ```
   It should show your VPS IP.

---

## 🖥️ Step 2 — Install Coolify on the VPS

1. SSH into your VPS:
   ```bash
   ssh root@YOUR_VPS_IP
   ```

2. Run the official Coolify installer:
   ```bash
   curl -fsSL https://cdn.coolify.io/install.sh | bash
   ```

3. When it finishes, it prints a URL like:
   ```
   http://YOUR_VPS_IP:8000
   ```
   Open it in your browser.

4. Create your Coolify admin account (email + strong password).

> **Security tip:** After setup, restrict port 8000 to your home IP only, or access Coolify through an SSH tunnel. This guide keeps it simple; you can harden later.

---

## 🔗 Step 3 — Connect GitHub to Coolify

Coolify needs permission to read your repository.

1. In Coolify, click **Sources** in the left menu.
2. Click **+ Add GitHub App**.
3. Choose **GitHub App (recommended)** or **GitHub OAuth**.
4. Follow the popup: authorize Coolify, select which repositories it can access.
5. Make sure your `pilatesOS` repository is selected.
6. Save.

---

## 🗄️ Step 4 — Create the PostgreSQL Database

1. In Coolify, click **+ New Resource**.
2. Choose **Database**.
3. Choose **PostgreSQL 18** (falls Coolify PG 18 noch nicht als Template anbietet, Custom Docker Image `postgres:18-alpine` verwenden).
4. Fill in the form:

| Field | What to enter | Example |
|---|---|---|
| **Name** | A label for you | `pilates-os-db` |
| **Database** | Database name | `pilates_os` |
| **Username** | Database user | `pilates_os` |
| **Password** | Click **Generate** or type your own | Save this in a password manager! |
| **Port** | Leave default (random internal port) | — |
| **Public access** | **OFF** | Very important |

5. Click **Start**.
6. After it starts, open the database resource and copy the **internal connection URL**. It looks like:
   ```
   postgresql://pilates_os:RANDOM_PASSWORD@pilates-os-db:5432/pilates_os
   ```
   Save this — it becomes your `DATABASE_URL`.

---

## 🧠 Step 5 — (Optional) Create Redis

Redis is used for rate limiting and background queues. For a first deploy you can skip it and use the in-memory fallback, but Redis is recommended for production.

1. **+ New Resource** → **Database** → **Redis 7**.
2. Fill in:

| Field | Value |
|---|---|
| **Name** | `pilates-os-redis` |
| **Password** | Generate or type |
| **Public access** | **OFF** |

3. Copy the internal URL, e.g.:
   ```
   redis://default:RANDOM_PASSWORD@pilates-os-redis:6379
   ```
   This becomes `REDIS_URL`.

---

## 🚀 Step 6 — Create the Application in Coolify

1. **+ New Resource** → **Application**.
2. Choose **GitHub App** (or public repository).
3. Select your repository: `yourname/pilatesOS`.
4. Select branch: `main`.
5. Coolify should auto-detect the `Dockerfile`.
6. Fill in:

| Field | Value |
|---|---|
| **Build Pack** | Dockerfile |
| **Dockerfile Path** | `./Dockerfile` |
| **Port** | `3000` |
| **Health Check Path** | `/api/health` |
| **Health Check Port** | `3000` |

7. **Do NOT deploy yet.** Click **Save**.

---

## 🔐 Step 7 — Add Environment Variables

Go to your application in Coolify → tab **Environment Variables**.

Add each variable. For sensitive values, turn on **Is Secret** so Coolify hides it in logs.

### 7.1 Critical — add these first

| Variable | Value | Build or Runtime | Secret? |
|---|---|---|---|
| `NODE_ENV` | `production` | Runtime | No |
| `DATABASE_URL` | `postgresql://pilates_os:...` from Step 4 | Runtime | **Yes** |
| `AUTH_SECRET` | Generate: `openssl rand -base64 32` | Runtime | **Yes** |
| `AUTH_TRUST_HOST` | `true` | Runtime | No |
| `NEXT_PUBLIC_APP_URL` | `https://app.yourstudio.com` | **Build-time** | No |
| `NEXT_PUBLIC_PLATFORM_DOMAIN` | `yourstudio.com` | **Build-time** | No |

> **Important:** `NEXT_PUBLIC_*` variables must be set as **Build-time** variables because Next.js bakes them into the client bundle during `pnpm build`.
>
> **Important:** `DATABASE_URL`, `AUTH_SECRET`, etc. must be **Runtime** variables. Do NOT put them as build args — they could leak in Docker layer history.

### 7.2 How to generate `AUTH_SECRET`

On your VPS:
```bash
openssl rand -base64 32
```
Copy the output and paste it as the value.

On Windows PowerShell you can also use:
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 } | ForEach-Object { [byte]$_ }))
```

### 7.3 Security & proxy

| Variable | Value | Why |
|---|---|---|
| `TRUSTED_PROXY_COUNT` | `1` | Coolify has one reverse proxy (Traefik) in front of your app. |
| `AUTH_COOKIE_DOMAIN` | leave empty | Auth.js uses the current hostname. Only set this if you use subdomains and want cross-subdomain sessions. |

### 7.4 Optional: Google OAuth

Only if you want "Sign in with Google".

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID.
2. Add authorized redirect URI:
   ```
   https://app.yourstudio.com/api/auth/callback/google
   ```
3. Copy Client ID and Secret.

| Variable | Value | Secret? |
|---|---|---|
| `AUTH_GOOGLE_ID` | your-client-id.apps.googleusercontent.com | Yes |
| `AUTH_GOOGLE_SECRET` | your-secret | Yes |

### 7.5 Optional: Stripe payments

Only if you want online payments.

| Variable | Value | Secret? |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` or `sk_test_...` | Yes |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Yes |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` or `pk_test_...` | No, but **Build-time** |

> Stripe webhooks: In Stripe Dashboard → Webhooks, add endpoint `https://app.yourstudio.com/api/webhooks/stripe` and select the events your app expects.

### 7.6 Optional: Email (Resend)

For transactional emails (booking confirmations, etc.).

| Variable | Value | Secret? |
|---|---|---|
| `RESEND_API_KEY` | `re_...` | Yes |
| `EMAIL_FROM` | `noreply@yourstudio.com` | No |

> You must verify your domain in Resend before sending.

### 7.7 Optional: Redis

If you created Redis in Step 5:

| Variable | Value | Secret? |
|---|---|---|
| `REDIS_URL` | `redis://default:...` from Step 5 | Yes |

### 7.8 Optional: Cloudflare Turnstile (captcha)

| Variable | Value | Build/Runtime |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | site key from Cloudflare | Build-time |
| `TURNSTILE_SECRET_KEY` | secret key from Cloudflare | Runtime, Secret |

### 7.9 Optional: Sentry error tracking

| Variable | Value |
|---|---|
| `SENTRY_DSN` | your DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | same DSN, Build-time |

### 7.10 Optional: Google Calendar sync

| Variable | Value | Secret? |
|---|---|---|
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` | Yes |
| `CRON_SECRET` | any random string | Yes |

### 7.11 Optional: AWS S3 / Bunny.net storage

Leave empty for MVP. Used only for video uploads.

| Variable | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | ... |
| `AWS_SECRET_ACCESS_KEY` | ... |
| `AWS_REGION` | `eu-central-1` |
| `AWS_S3_BUCKET` | ... |
| `BUNNY_CDN_BASE_URL` | `https://cdn.yourstudio.com` |

---

## 🗃️ Step 8 — Set Up Database Migrations

We want migrations to run automatically every time you deploy.

1. In your Coolify application, go to the **General** tab.
2. Find **Pre-deployment Command**.
3. Enter:
   ```bash
   pnpm db:migrate
   ```
4. Save.

This runs `drizzle-kit migrate` inside the container before the new version goes live.

---

## 🌐 Step 9 — Add Your Domain & SSL

1. In your application, go to the **Domains** tab.
2. Click **+ Add Domain**.
3. Enter:
   ```
   https://app.yourstudio.com
   ```
4. Coolify will automatically request a free Let's Encrypt certificate.
5. Wait until you see a green checkmark / padlock next to the domain (usually under 1 minute).
6. Turn on **Force HTTPS** in the application settings if you see the option.

---

## ▶️ Step 10 — Deploy!

1. Click the **Deploy** button in Coolify.
2. Watch the **Deployment Logs**.
3. Wait until you see something like:
   ```
   Ready in 1234ms
   ```
4. Open `https://app.yourstudio.com/api/health` in your browser.
   You should see:
   ```json
   {"status":"ok","ts":"...","checks":{"database":"ok"}}
   ```

If you see `ok`, the app is running and connected to the database.

---

## 🌱 Step 11 — Seed the Database (One Time Only)

After first successful deploy, you need some initial data (admin user, sample settings, etc.).

1. In Coolify, open your application.
2. Click the **Terminal** tab (opens a shell inside the running container).
3. Run:
   ```bash
   pnpm db:seed
   ```
4. Wait for it to finish.

> ⚠️ **Only run this once on a fresh database.** Do NOT add it to the pre-deployment command — it would reset data on every deploy.

---

## 🔑 Step 12 — First Login & Change Password

1. Visit `https://app.yourstudio.com/login`.
2. Log in with the default admin credentials from the seed script (check `scripts/seed.ts` for the exact email/password, usually something like `admin@pilatesos.com` / `password123`).
3. **Immediately change the admin password** in the admin profile.

---

## ✅ Step 13 — Quick Smoke Test

Test these flows before telling anyone about the app:

1. **Register a new student** at `/register`.
2. **Create a credit package** in `/admin/credits`.
3. **As the student, buy credits** at `/credits`.
4. **As admin, mark the purchase as paid** → student's balance should increase.
5. **Create a class** in `/admin/classes`.
6. **Student books the class** → balance decreases.
7. **Student cancels >24h before** → balance refunded.

If all of these work, you are live.

---

## 🔒 Step 14 — Security Checklist (Do This Soon)

On your VPS via SSH:

```bash
# Firewall: only allow SSH, HTTP, HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw enable

# SSH: disable password login, use keys only
nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
# Set: PermitRootLogin prohibit-password
systemctl reload sshd

# Install fail2ban
apt install fail2ban -y
systemctl enable fail2ban
systemctl start fail2ban
```

In Coolify:

- [ ] Database has **Public access = OFF**.
- [ ] Redis has **Public access = OFF**.
- [ ] `AUTH_SECRET` is set and secret.
- [ ] `DATABASE_URL` is secret.
- [ ] Automated backups are enabled for PostgreSQL.

---

## 🔄 Step 15 — How Updates Work

After the first deploy, updating is automatic:

1. Push your code to GitHub `main` branch.
2. Coolify detects the push and starts a new build.
3. Pre-deployment command runs `pnpm db:migrate`.
4. New container starts.
5. Coolify swaps traffic to the new container (zero-downtime).

If something breaks, go to **Deployments** in Coolify and click **Redeploy** on the previous successful version.

---

## 🆘 Common Problems & Fixes

### Build fails with "This version of pnpm requires Node.js ..."

Make sure the Dockerfile uses `node:20-alpine` or newer. The current `Dockerfile` already does this.

### App starts but health check fails

Check the logs. Usually:
- `DATABASE_URL` is wrong, or
- the database is not started yet, or
- `AUTH_TRUST_HOST=true` is missing.

### Login redirects to localhost or wrong domain

- `NEXT_PUBLIC_APP_URL` must be `https://app.yourstudio.com` (build-time var).
- `AUTH_TRUST_HOST=true` must be set.
- Domain in Coolify must be `https://app.yourstudio.com`.

### Emails not sending

- `RESEND_API_KEY` and `EMAIL_FROM` must be set.
- Domain must be verified in Resend.
- In dev mode the app may mock emails — in production it tries to send for real.

### "Studio not found" after onboarding

Make sure the admin user has a `studioId` assigned and the studio status is `active`. You can check in the Coolify terminal:

```bash
node -e "require('postgres')(process.env.DATABASE_URL)\`SELECT id, slug, status FROM studios\`.then(r => console.log(r))"
```

---

## 📁 Files You Should Have in Your Repo Before Deploy

Make sure these files are committed and pushed to GitHub:

- `Dockerfile`
- `.dockerignore`
- `next.config.ts` (with `output: 'standalone'`)
- `src/app/api/health/route.ts`
- `public/robots.txt`
- `drizzle.config.ts`
- `src/db/migrations/0000_initial_schema.sql`
- `package.json` (with engines and packageManager)
- `pnpm-lock.yaml`
- `.env.example` (without real secrets)

---

## 📝 TL;DR — Minimal Variables for First Deploy

If you want to go live as fast as possible, set only these:

```env
NODE_ENV=production
DATABASE_URL=postgresql://pilates_os:PASSWORD@pilates-os-db:5432/pilates_os
AUTH_SECRET=GENERATED_SECRET
AUTH_TRUST_HOST=true
NEXT_PUBLIC_APP_URL=https://app.yourstudio.com
NEXT_PUBLIC_PLATFORM_DOMAIN=yourstudio.com
TRUSTED_PROXY_COUNT=1
```

Add Stripe, Google OAuth, Redis, Resend, Sentry later.

---

**You're done!** 🎉 Your Pilates OS instance should now be running at `https://app.yourstudio.com`.
