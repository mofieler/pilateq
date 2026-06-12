# Pilates OS — MVP Gap Analysis & Pre-Deploy Plan

**Generated:** 2026-05-05  
**Last updated:** 2026-06-11 (post "Complete SaaS Hardening")

**Scope:** Everything needed to ship MVP to Coolify (single-VPS Pilates studio test deployment).

> **Status update:** Every item that was originally flagged as *🔴 Block deploy* or *⚠️ Important* has been implemented and hardened. The remaining work is Phase 2 product growth (Stripe webhooks, async workers, VOD, etc.).

---

## Post-Hardening Notes

The following hardening changes landed since the original audit and are now part of the codebase:

- **Tenant isolation** — `studioId` is non-nullable on the core tables and is enforced in service-layer queries; admin actions resolve the studio from the authenticated user.
- **CORS** — API routes set `Access-Control-Allow-Origin` only for origins listed in `ALLOWED_ORIGINS`; credentials are allowed.
- **Security headers** — CSP is built per-request with a real nonce, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in production are all set in middleware via `src/lib/security/security-headers.ts`.
- **Database migrations** — Active migrations live in `src/db/migrations/`; archived migrations must never be applied. See `src/db/migrations/README.md` for fresh vs. existing database guidance.
- **Connection pool** — `src/db/index.ts` uses `postgres.js` with `max: 10` and statement/lock timeouts configured in `src/constants/DATABASE_CONFIG.ts`.
- **Pagination** — List endpoints enforce limits/offsets and cap page sizes to avoid unbounded queries.
- **Audit log** — `src/lib/security/audit-system.ts` persists to the `audit_logs` table (migration `0001_add_audit_logs.sql`) instead of being a console-only stub.

---

## 🟢 Defer to Phase 2 — not needed for MVP launch

| Item | Reason it can wait |
|---|---|
| Stripe checkout + webhook | Pay-at-studio covers the MVP. Stripe is marked "Coming Soon" in the UI already ([credits/page.tsx](src/app/(dashboard)/credits/page.tsx)). Do this once you have ≥10 paying students. |
| BullMQ + Redis worker | Make waitlist promotion synchronous in `cancelBooking` for MVP. Add async worker only when you regularly hit class capacity. |
| Admin students view | Admin can still see purchases + bookings. Per-student profile page is a nice-to-have. |
| VOD module (S3/Bunny) | Phase 3 per CLAUDE.md. Don't pay for storage you're not using. |
| Streaks + badges (gamification) | Phase 3. |
| Meta CAPI + sitemap.ts | Phase 3 SEO/marketing. |
| Robots.txt | `public/robots.txt` already blocks `/admin` and `/api`. |

---

## ✅ Resolved / Completed

### Block-deploy items

| ID | Item | Status |
|---|---|---|
| MVP-1 | `CancelBookingButton` no longer uses `mock-user-id`; it calls `cancelBookingAction` directly and uses `useTransition()` for pending state. | ✅ Implemented |
| MVP-2 | CSP nonce is interpolated correctly in `src/lib/security/security-headers.ts` / `src/lib/security/embed-headers.ts`. | ✅ Implemented |
| MVP-3 | Login and register server actions are rate-limited (`src/lib/security/server-action-rate-limiter.ts`) using the client IP. | ✅ Implemented |
| MVP-4 | `updateCreditPurchaseAction` grants credits atomically when a pending pay-at-studio purchase is marked `paid`. | ✅ Implemented |
| MVP-5 | Waiver gate is enforced in `createBookingAction` (`WAIVER_REQUIRED`); the `/waiver` page stores the signed flag, IP, timestamp and version. | ✅ Implemented |
| MVP-6 | `src/app/api/health/route.ts` returns 200 with DB `SELECT 1` check, or 503 on DB failure. | ✅ Implemented |
| MVP-7 | `Dockerfile` is present at the repo root and builds the standalone output. | ✅ Implemented |
| MVP-8 | `next.config.ts` is configured with `output: 'standalone'`, Sentry wrapping, Turbopack root override, image `remotePatterns`, asset caching headers, etc. | ✅ Implemented |

### Important items

| ID | Item | Status |
|---|---|---|
| MVP-9 | Audit log now persists to the `audit_logs` table (`src/lib/security/audit-system.ts`). | ✅ Implemented |
| MVP-10 | `/api/credit-purchases` and `/api/bookings/cancel` validate request bodies with Zod and return 400 on failure. | ✅ Implemented |
| MVP-11 | `next.config.ts` declares image `remotePatterns` and instructor avatars use Next.js `<Image>`. | ✅ Implemented |
| MVP-12 | Structured logging via `pino` (`src/lib/logger.ts`) is used across production code paths. | ✅ Implemented |
| MVP-13 | Sentry is installed (`@sentry/nextjs`, `src/instrumentation.ts`, build-time source-map upload when `SENTRY_AUTH_TOKEN` is set). | ✅ Implemented |
| MVP-14 | Resend email integration is wired (`src/lib/email/_base.ts`, `src/lib/email/resend.ts`) and sends purchase confirmations, booking confirmations, and class-cancellation notices. | ✅ Implemented |

---

## What is already solid — don't touch

- ✓ Database schema, indexes, FK policies (RESTRICT on financial tables)
- ✓ Drizzle migrations are committed (active set through `0008_studio_id_not_null.sql`)
- ✓ Cancellation service: 24h rule, first-time mercy, atomic refund — fully working
- ✓ Booking service: `FOR UPDATE` lock, duplicate prevention, atomic credit debit
- ✓ Connection pool (`max: 10`) is correctly sized for MVP
- ✓ Auth.js v5 setup is secure (bcrypt, JWT, role guards in middleware)
- ✓ Soft-delete enforcement on users
- ✓ Server vs client component split is correct
- ✓ Bundle size — modular imports, no lodash, tree-shakeable lucide-react
- ✓ No N+1 queries detected — eager loading is explicit
