# Environment Variables — Quick Reference

**Print this page or bookmark for quick copy-paste during setup.**

---

## Development Minimum (.env.local)

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/pilates_os
AUTH_SECRET=<openssl rand -base64 32>
REDIS_URL=
TRUSTED_PROXY_COUNT=0
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
RESEND_API_KEY=optional-for-dev
EMAIL_FROM=noreply@yourstudio.com
```

---

## Production Full Setup (Coolify)

### Tier 1: CRITICAL
```bash
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/pilates_os
AUTH_SECRET=<openssl rand -base64 32>
```

### Tier 2: SECURITY + AUTH
```bash
REDIS_URL=redis://user:pass@host:6379
TRUSTED_PROXY_COUNT=1
AUTH_GOOGLE_ID=xxx.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=from-google-cloud-console
NEXT_PUBLIC_TURNSTILE_SITE_KEY=from-cloudflare-turnstile
TURNSTILE_SECRET_KEY=from-cloudflare-turnstile
WAIVER_TEXT=optional-custom-liability-waiver-text
EMBED_FRAME_ANCESTORS="https://www.partnerstudio.com https://embed.partner.com"
```

### Tier 3: PAYMENTS + EMAIL
```bash
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@yourstudio.com
```

### Tier 4: OPTIONAL
```bash
AWS_ACCESS_KEY_ID=from-aws-iam
AWS_SECRET_ACCESS_KEY=from-aws-iam
AWS_REGION=eu-central-1
AWS_S3_BUCKET=pilates-os-assets
BUNNY_CDN_BASE_URL=https://cdn.yourstudio.com
META_PIXEL_ID=your-pixel-id
META_CAPI_ACCESS_TOKEN=your-access-token
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=sntrys_xxx
SENTRY_ORG=your-sentry-org
SENTRY_PROJECT=pilates-os
```

---

## Where to Get Values (One-Liners)

| Variable | Source | Command/Link |
|----------|--------|--------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/pilates_os` |
| `AUTH_SECRET` | Generate locally | `openssl rand -base64 32` |
| `REDIS_URL` | Local or cloud Redis | `redis://localhost:6379` |
| `TRUSTED_PROXY_COUNT` | Count your proxies | `1` for Cloudflare + app |
| `AUTH_GOOGLE_ID` | [Google Cloud](https://console.cloud.google.com) | OAuth 2.0 Client ID |
| `AUTH_GOOGLE_SECRET` | [Google Cloud](https://console.cloud.google.com) | OAuth 2.0 Client Secret |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | [Cloudflare Turnstile](https://dash.cloudflare.com) | Site Key |
| `TURNSTILE_SECRET_KEY` | [Cloudflare Turnstile](https://dash.cloudflare.com) | Secret Key |
| `STRIPE_SECRET_KEY` | [Stripe Dashboard](https://dashboard.stripe.com) | API Keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | [Stripe Webhooks](https://dashboard.stripe.com) | Webhooks → Signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | [Stripe Dashboard](https://dashboard.stripe.com) | API Keys → Publishable key |
| `RESEND_API_KEY` | [Resend](https://resend.com) | API Keys |
| `SENTRY_AUTH_TOKEN` | [Sentry Auth Tokens](https://sentry.io/settings/auth-tokens/) | Build-time source-map upload |
| `SENTRY_ORG` | [Sentry Settings](https://sentry.io/settings/) | Organization slug |
| `SENTRY_PROJECT` | [Sentry Projects](https://sentry.io/projects/) | Project slug |
| `WAIVER_TEXT` | Legal / studio admin | Full text of the liability waiver shown on `/waiver` |
| `EMBED_FRAME_ANCESTORS` | Partner sites list | Space-separated origins allowed to embed `/embed/*` routes |
| `AWS_ACCESS_KEY_ID` | [AWS IAM](https://console.aws.amazon.com/iam) | User Access Keys |
| `AWS_SECRET_ACCESS_KEY` | [AWS IAM](https://console.aws.amazon.com/iam) | User Access Keys |

---

## Testing Checklist

```bash
# 1. Local dev works
pnpm install
cp .env.example .env.local
# ... fill .env.local ...
pnpm dev
# Visit http://localhost:3000 ✓

# 2. Database migration runs
pnpm db:migrate
pnpm db:studio  # Verify 'waivers' table exists ✓

# 3. Production build succeeds
pnpm build
pnpm start
# Visit http://localhost:3000 ✓

# 4. Stripe webhook configured
# Stripe Dashboard → Webhooks → Add endpoint
# URL: https://yourdomain.com/api/webhooks/stripe
# Events: checkout.session.completed, payment_intent.failed ✓

# 5. Rate limiting works
# Spam register endpoint, should get 429 after limit ✓

# 6. Email sends
# Create account, check inbox for verification email ✓
```

---

## Common Mistakes

| ❌ Wrong | ✓ Correct | Why |
|---------|-----------|-----|
| Leave `DATABASE_URL` empty | Set to real PostgreSQL URL | App won't start without DB |
| Use `localhost:5432` in prod | Use service hostname (from Coolify) | Coolify services don't use localhost |
| Forget `TRUSTED_PROXY_COUNT` | Set to number of proxies (1 for Cloudflare) | Wrong IP detection breaks rate limiting |
| Use test Stripe keys in prod | Use `sk_live_` and `pk_live_` keys | Transactions won't work, charges won't go through |
| Commit `.env.local` to git | Add to `.gitignore` (already done) | Exposes secrets publicly |
| Forget waivers migration | Run `pnpm db:migrate` | Waiver signing breaks in production |
| Leave `REDIS_URL` empty in prod | Set to actual Redis instance | Rate limiting returns to in-memory (single instance) |

---

## One-Time Setup Commands

```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Initialize PostgreSQL locally (macOS)
brew install postgresql@16
brew services start postgresql@16

# Initialize Redis locally (macOS)
brew install redis
brew services start redis

# Test PostgreSQL connection
psql postgresql://postgres:password@localhost:5432/pilates_os -c "SELECT 1;"

# Test Redis connection
redis-cli ping
# Should return: PONG
```

---

## Coolify Deployment Steps (TL;DR)

1. **Create project** in Coolify
2. **Add PostgreSQL service** → note connection string
3. **Add Redis service** → note Redis URL
4. **Add Next.js service** from GitHub
5. **Set environment variables** in Coolify UI:
   - Paste all values from "Production Full Setup" above
6. **Deploy** → wait 5-10 minutes
7. **Run migration**: `pnpm db:migrate` (or manual SQL)
8. **Verify**: Visit `https://yourdomain.com` ✓

---

## Emergency: Reset Everything

```bash
# If database is corrupted, start fresh:

# 1. Drop database (⚠️ destructive)
dropdb pilates_os
createdb pilates_os

# 2. Rerun migration
pnpm db:migrate

# 3. Reseed data (if you have seed script)
pnpm db:seed

# 4. Verify
pnpm db:studio
```

---

**Keep this file as your reference during setup. Most questions have answers here.**
