# CLAUDE.md — Pilates OS: Project Bible
**Version:** 1.2.0 | **Status:** Active | **Architect:** Senior Lead

This document is the single source of truth for all AI-assisted development sessions.
Read this file **completely** before writing any code.

**Patch v1.2.0 Changes (Next.js 16 migration):**
- [FIX-6] Framework upgraded from Next.js 15 → Next.js 16 (latest stable). App Router,
  Server Actions, RSC patterns are unchanged. ESLint updated to v9 with flat config
  (`eslint.config.mjs`). Async request APIs (`cookies()`, `headers()`, `params`,
  `searchParams`) remain async — this was introduced in Next.js 15 and continues in 16.
  Read `node_modules/next/dist/docs/` for any further breaking changes before coding.

**Patch v1.1.0 Changes:**
- [FIX-1] Soft-delete rules added. Hard deletes on `users` are prohibited.
- [FIX-2] Timezone-aware timestamp rule added to coding standards.
- [FIX-3] FK delete policy rules added — `RESTRICT` required on all financial tables.
- [FIX-4] Cursor-based pagination rule added — `offset` pagination is prohibited.
- [FIX-5] Stripe idempotency requirement added to webhook standards.

---

## Table of Contents
1. Project Overview
2. Tech Stack
3. Project Structure Map
4. Naming & Coding Standards
5. Phase Roadmap & CLI Instructions
6. Tech Stack Commands
7. Environment Variables
8. Key Architectural Decisions
9. AI Collaboration Rules

---

## 1. Project Overview

Pilates OS is a full-stack studio management platform built for boutique Pilates studios. It combines booking, billing, retention, VOD streaming, and marketing into a single, resource-efficient application deployable on a single VPS via Coolify.

### Core Business Rules (Never Violate)

- A booking can be cancelled for a full credit refund if done >24 hours before class.
- A student's first late cancellation ever is forgiven ("First-Time Mercy").
- If an instructor cancels a class, all booked students receive an automatic full refund.
- Credits are deducted atomically — never double-spend, never negative balance.
- Waitlist promotion is FIFO with a 15-minute acceptance window.

### Data Integrity Rules (Never Violate — Added v1.1.0)

- **[FIX-1] Never hard-delete a user with financial history.** Use soft-delete (`deleted_at`). All user queries MUST include `WHERE deleted_at IS NULL` unless intentionally querying deleted users (e.g., admin audit views).
- **[FIX-2] All timestamps MUST be timezone-aware.** Never write `timestamp('col')` without `{ withTimezone: true, mode: 'date' }`. Ambiguous timestamps cause scheduling bugs across studio timezones.
- **[FIX-3] Never add `onDelete: 'cascade'` to financial or booking tables.** Use `RESTRICT` for user-linked financial tables (`bookings`, `credit_balances`, `credit_transactions`, `stripe_transactions`, `waivers`, `waitlist_entries`, `vod_progress`, `user_badges`, `guest_passes.created_by`). Use `SET NULL` for nullable references. Auth tables (`accounts`, `sessions`) are exempt — they are session data, not financial records.
- **[FIX-4] Never use offset-based pagination on transaction history or any high-volume table.** Use cursor-based pagination (see §4.5).
- **[FIX-5] All Stripe webhook credit operations MUST pass `stripeCheckoutSessionId` to `creditService.addCredits()`.** The idempotency guard depends on it.

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router) | RSC, Server Actions, built-in API routes |
| Language | TypeScript 5+ (strict mode) | Full type safety across all layers |
| Database | PostgreSQL 18 | Relational integrity, JSONB for metadata |
| ORM | Drizzle ORM | Lightweight, type-safe, direct SQL control |
| Auth | Auth.js v5 (next-auth) | Session management, social + credentials |
| Payments | Stripe | Subscriptions, one-time, webhooks |
| Email | Resend + React Email | Transactional, template-driven |
| File Storage | AWS S3 / Bunny.net CDN | VOD assets, user uploads |
| Background Jobs | BullMQ + Redis | Waitlist promotion, email queues |
| Deployment | Coolify (VPS) | Self-hosted PaaS, Docker-based |
| Styling | Tailwind CSS v4 | Utility-first, design tokens |
| UI Primitives | shadcn/ui (Radix) | Accessible, unstyled base components |
| State (Client) | Zustand | Minimal client state only |
| Forms | React Hook Form + Zod | Type-safe validation |
| Testing | Vitest + Playwright | Unit + E2E |
| Monitoring | Sentry + Axiom | Error tracking + structured logging |

### Next.js 16 — Critical API Notes [FIX-6]

- **Async request APIs:** `cookies()`, `headers()`, `params`, and `searchParams` are **async** in all Server Components, Route Handlers, and Server Actions. Always `await` them:
  ```typescript
  // ✓ CORRECT
  const cookieStore = await cookies();
  const { id } = await params;

  // ✗ WRONG — synchronous access throws in Next.js 15+/16
  const cookieStore = cookies();
  ```
- **ESLint 9 flat config:** The project uses `eslint.config.mjs` (not `.eslintrc.json`). Do not create legacy `.eslintrc` files.
- **Turbopack:** `next dev` uses Turbopack by default in Next.js 16. The `--turbo` flag is no longer needed.
- Before writing any Next.js-specific code, check `node_modules/next/dist/docs/` for breaking changes.

---

## 3. Project Structure Map

```
pilates-os/
├── CLAUDE.md                     # ← You are here
├── AGENTS.md                     # Next.js 16 agent rules — read before coding
├── ARCHITECTURE_MASTERPLAN.md
├── .env.local
├── .env.example
├── next.config.ts
├── drizzle.config.ts
├── vitest.config.ts
│
├── public/
│   └── assets/
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── book/page.tsx
│   │   │   ├── schedule/page.tsx
│   │   │   ├── credits/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   └── vod/
│   │   │       ├── page.tsx
│   │   │       └── [slug]/page.tsx
│   │   ├── (admin)/
│   │   │   ├── layout.tsx
│   │   │   ├── classes/page.tsx
│   │   │   ├── students/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   ├── stripe/route.ts
│   │   │   │   └── resend/route.ts
│   │   │   └── cron/
│   │   │       └── waitlist-promotion/route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx              # Landing page
│   │
│   ├── modules/                  # ← DOMAIN MODULES (Core Pattern)
│   │   │
│   │   ├── booking/
│   │   │   ├── actions/
│   │   │   │   ├── createBooking.action.ts
│   │   │   │   ├── cancelBooking.action.ts
│   │   │   │   └── rescheduleBooking.action.ts
│   │   │   ├── services/
│   │   │   │   ├── booking.service.ts
│   │   │   │   ├── cancellation.service.ts
│   │   │   │   └── availability.service.ts
│   │   │   ├── components/
│   │   │   │   ├── BookingCalendar.tsx
│   │   │   │   ├── ClassCard.tsx
│   │   │   │   ├── BookingConfirmModal.tsx
│   │   │   │   └── CancellationPolicyBanner.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useBookingFlow.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── billing/
│   │   │   ├── actions/
│   │   │   │   ├── purchaseCredits.action.ts
│   │   │   │   └── createCheckoutSession.action.ts
│   │   │   ├── services/
│   │   │   │   ├── credit.service.ts
│   │   │   │   ├── stripe.service.ts
│   │   │   │   └── invoice.service.ts
│   │   │   ├── components/
│   │   │   │   ├── CreditBalance.tsx
│   │   │   │   ├── PricingCard.tsx
│   │   │   │   └── TransactionHistory.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── classes/
│   │   │   ├── actions/
│   │   │   │   ├── createClass.action.ts
│   │   │   │   ├── updateClass.action.ts
│   │   │   │   └── cancelClass.action.ts
│   │   │   ├── services/
│   │   │   │   └── class.service.ts
│   │   │   ├── components/
│   │   │   │   ├── ClassForm.tsx
│   │   │   │   ├── InstructorCard.tsx
│   │   │   │   └── VibeIndicator.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── waitlist/
│   │   │   ├── actions/
│   │   │   │   └── joinWaitlist.action.ts
│   │   │   ├── services/
│   │   │   │   └── waitlist.service.ts
│   │   │   ├── components/
│   │   │   │   └── WaitlistBadge.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── users/
│   │   │   ├── actions/
│   │   │   │   ├── updateProfile.action.ts
│   │   │   │   └── signWaiver.action.ts
│   │   │   ├── services/
│   │   │   │   ├── user.service.ts
│   │   │   │   └── waiver.service.ts
│   │   │   ├── components/
│   │   │   │   ├── UserProfileCard.tsx
│   │   │   │   ├── WaiverModal.tsx
│   │   │   │   └── AvatarUploader.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── vod/
│   │   │   ├── actions/
│   │   │   │   ├── uploadVideo.action.ts
│   │   │   │   └── trackProgress.action.ts
│   │   │   ├── services/
│   │   │   │   ├── vod.service.ts
│   │   │   │   └── s3.service.ts
│   │   │   ├── components/
│   │   │   │   ├── VideoPlayer.tsx
│   │   │   │   ├── VODLibrary.tsx
│   │   │   │   └── VideoCard.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── gamification/
│   │   │   ├── services/
│   │   │   │   ├── streak.service.ts
│   │   │   │   └── badge.service.ts
│   │   │   ├── components/
│   │   │   │   ├── StreakCounter.tsx
│   │   │   │   └── BadgeGrid.tsx
│   │   │   └── types.ts
│   │   │
│   │   └── marketing/
│   │       ├── services/
│   │       │   ├── meta-capi.service.ts
│   │       │   └── abandoned-cart.service.ts
│   │       └── types.ts
│   │
│   ├── db/
│   │   ├── index.ts              # DB connection singleton
│   │   ├── schema/
│   │   │   ├── index.ts          # Re-exports all schemas
│   │   │   ├── users.schema.ts
│   │   │   ├── classes.schema.ts
│   │   │   ├── bookings.schema.ts
│   │   │   ├── credits.schema.ts
│   │   │   ├── waitlist.schema.ts
│   │   │   ├── waivers.schema.ts
│   │   │   ├── transactions.schema.ts
│   │   │   └── vod.schema.ts
│   │   └── migrations/
│   │
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── auth.config.ts
│   │   │   └── auth.ts
│   │   ├── queue/
│   │   │   ├── queue.ts          # BullMQ setup
│   │   │   └── workers/
│   │   │       ├── waitlist.worker.ts
│   │   │       └── email.worker.ts
│   │   ├── email/
│   │   │   ├── resend.ts
│   │   │   └── templates/
│   │   │       ├── BookingConfirmed.tsx
│   │   │       ├── ClassCancelled.tsx
│   │   │       ├── WaitlistPromotion.tsx
│   │   │       └── CreditRefund.tsx
│   │   ├── stripe/
│   │   │   └── stripe.ts
│   │   ├── s3/
│   │   │   └── s3.ts
│   │   └── utils/
│   │       ├── date.utils.ts
│   │       ├── currency.utils.ts
│   │       └── cn.ts
│   │
│   ├── components/               # Shared / Atomic UI
│   │   ├── ui/                   # shadcn primitives
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   └── shared/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── EmptyState.tsx
│   │
│   ├── hooks/                    # Global shared hooks
│   │   ├── useSession.ts
│   │   └── useToast.ts
│   │
│   ├── constants/
│   │   ├── BOOKING_RULES.ts      # 24h window, mercy logic constants
│   │   ├── CREDIT_PACKAGES.ts
│   │   └── CLASS_TYPES.ts
│   │
│   └── types/
│       └── globals.d.ts
│
└── tests/
    ├── unit/
    │   ├── cancellation.service.test.ts
    │   ├── credit.service.test.ts
    │   └── waitlist.service.test.ts
    └── e2e/
        ├── booking-flow.spec.ts
        └── admin-class-mgmt.spec.ts
```

---

## 4. Naming & Coding Standards

### 4.1 File & Folder Naming

| Type | Convention | Example |
|---|---|---|
| React Component | `PascalCase.tsx` | `BookingCalendar.tsx` |
| Service File | `kebab-case.service.ts` | `cancellation.service.ts` |
| Server Action | `camelCase.action.ts` | `createBooking.action.ts` |
| Hook | `camelCase.ts` with `use` prefix | `useBookingFlow.ts` |
| Schema | `kebab-case.schema.ts` | `bookings.schema.ts` |
| Utility | `kebab-case.utils.ts` | `date.utils.ts` |
| Constants file | `SCREAMING_SNAKE_CASE.ts` | `BOOKING_RULES.ts` |
| Folders | `kebab-case` | `user-profile/` |
| Test files | Mirror source + `.test.ts` | `credit.service.test.ts` |

### 4.2 Code Conventions

```typescript
// CONSTANTS — SCREAMING_SNAKE_CASE
export const CANCELLATION_WINDOW_HOURS = 24;
export const WAITLIST_ACCEPTANCE_WINDOW_MINUTES = 15;

// TYPES & INTERFACES — PascalCase, descriptive
interface BookingCreationParams {
  userId: string;
  classId: string;
  creditType: CreditType;
}

// FUNCTIONS — camelCase, verb-first, single responsibility
async function calculateRefundAmount(booking: Booking): Promise<number> { ... }

// REACT COMPONENTS — PascalCase, no logic, thin
export function BookingCard({ booking }: { booking: Booking }) {
  return <div>...</div>; // UI only, no business logic here
}

// SERVER ACTIONS — thin wrappers around services
'use server';
export async function cancelBookingAction(bookingId: string) {
  const session = await getServerSession();
  if (!session) throw new Error('Unauthorized');
  // ← DELEGATE to service immediately
  return cancellationService.cancel(bookingId, session.user.id);
}

// ✗ NEVER — put business logic in a component or action
export async function cancelBookingAction(bookingId: string) {
  const booking = await db.query...
  const hoursDiff = differenceInHours(booking.startTime, new Date());
  if (hoursDiff < 24) { /* penalty logic */ }
  // ← This belongs in cancellationService.cancel()
}
```

### 4.3 Service Layer Pattern

Every domain service must follow this structure:

```typescript
// src/modules/booking/services/cancellation.service.ts
import { db } from '@/db';
import { bookings, creditTransactions } from '@/db/schema';
import { CANCELLATION_WINDOW_HOURS } from '@/constants/BOOKING_RULES';

// Services export a plain object of async functions
export const cancellationService = {
  async cancel(bookingId: string, userId: string): Promise<CancellationResult> {
    // 1. Validate
    // 2. Apply business rules
    // 3. Execute DB transaction
    // 4. Trigger side effects (email, queue job)
    // 5. Return result
  }
};
```

### 4.4 TypeScript Rules

- `tsconfig.json` must have `"strict": true`.
- No `any` types — use `unknown` + type guards if needed.
- All DB query results must be typed via Drizzle's inferred types.
- All Server Action params must be validated with Zod before processing.
- Use `satisfies` operator for config objects where type widening is needed.

### 4.5 Pagination Rule — Cursor-Based Only [FIX-4]

**Never use `offset`-based pagination on any table that grows over time.**

`offset` is broken for real-time data: if a new row is inserted between page 1 and page 2, every subsequent row shifts by one, causing duplicates and skips.

**Always use cursor-based pagination:**

```typescript
// ✓ CORRECT — cursor-based
async function getTransactionHistory(
  userId: string,
  limit = 20,
  cursor?: Date,          // ← last item's createdAt from previous page
): Promise<{ data: CreditTransaction[]; nextCursor: Date | null }> {
  const rows = await db
    .select()
    .from(creditTransactions)
    .where(
      cursor
        ? and(eq(creditTransactions.userId, userId), lt(creditTransactions.createdAt, cursor))
        : eq(creditTransactions.userId, userId),
    )
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit + 1); // Fetch one extra to detect next page

  const hasNextPage = rows.length > limit;
  const data = hasNextPage ? rows.slice(0, limit) : rows;
  const nextCursor = hasNextPage ? data[data.length - 1].createdAt : null;
  return { data, nextCursor };
}

// ✗ NEVER — offset-based on growing tables
async function getTransactionHistory(userId: string, limit = 20, offset = 0) {
  return db.select().from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .limit(limit)
    .offset(offset); // ← Produces incorrect results under concurrent inserts
}
```

Applies to: `credit_transactions`, `bookings`, `stripe_transactions`, `vod_progress`, any admin list view that may have real-time inserts.

### 4.6 Soft-Delete Pattern [FIX-1]

The `users` table has a `deleted_at TIMESTAMPTZ` column. All non-admin queries against `users` must filter it out:

```typescript
import { isNull } from 'drizzle-orm';

// ✓ CORRECT
const activeUsers = await db
  .select()
  .from(users)
  .where(and(eq(users.role, 'student'), isNull(users.deletedAt)));

// ✗ NEVER — silently includes soft-deleted users
const allUsers = await db.select().from(users).where(eq(users.role, 'student'));
```

To soft-delete a user:

```typescript
await db
  .update(users)
  .set({ deletedAt: new Date(), updatedAt: new Date() })
  .where(eq(users.id, userId));
```

**Hard deletes on the `users` table are permanently prohibited.** The `ON DELETE RESTRICT` FK constraints on financial tables enforce this at the database level, but it is also a code convention.

### 4.7 Timestamp Convention [FIX-2]

Every `timestamp()` column MUST use timezone options:

```typescript
// ✓ CORRECT — timezone-aware
createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
startsAt:  timestamp('starts_at',  { withTimezone: true, mode: 'date' }).notNull(),

// ✗ NEVER — ambiguous timezone
createdAt: timestamp('created_at').notNull().defaultNow(),
```

This applies without exception to every table in every schema file.

### 4.8 Stripe Webhook Idempotency [FIX-5]

All Stripe webhook handlers that call `creditService.addCredits()` MUST pass the `stripeCheckoutSessionId`:

```typescript
// src/app/api/webhooks/stripe/route.ts
case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session;

  const result = await creditService.addCredits({
    userId: session.metadata.userId,
    creditType: session.metadata.creditType as CreditType,
    amount: Number(session.metadata.creditsAmount),
    packageId: session.metadata.packageId,
    stripeCheckoutSessionId: session.id, // ← REQUIRED — idempotency key
  });

  // DUPLICATE_PAYMENT means the webhook was already processed.
  // Return 200 to Stripe so it stops retrying.
  if (!result.success && result.code === 'DUPLICATE_PAYMENT') {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
```

The `stripe_transactions` record for the session MUST be created in `'pending'` state during `stripe.service.createCheckout()`, before the webhook fires. The idempotency guard in `addCredits()` depends on this record existing.

---

## 5. Phase Roadmap & CLI Instructions

Each task below is a discrete unit of work for a Claude Code session. Start a new session for each numbered task. Reference this file at the start of every session.

### PHASE 1 — Core Vitality
**Goal:** A working booking system with auth, database, and admin panel.

```
PHASE 1 TASK LIST:
─────────────────────────────────────────────────────────────────
[x] 1.1  Project Bootstrap
         Next.js 16 (App Router, TypeScript strict, Tailwind v4),
         lucide-react, shadcn/ui (New York, Slate), shadcn components:
         button, badge, input, label, skeleton. Module folder structure
         created under src/modules/.

[ ] 1.2  Database Schema & Connection
         Prompt: "Implement the full Drizzle ORM schema from FULL_SCHEMA.ts into
         src/db/schema/. Ensure ALL timestamps use { withTimezone: true, mode: 'date' }.
         Ensure financial tables use onDelete: 'restrict'. Add deletedAt to users.
         Create the drizzle.config.ts and db/index.ts connection singleton
         using a connection pool (max: 10)."

[ ] 1.3  Auth System
         Prompt: "Implement Auth.js v5 with credentials provider (email/password
         with bcrypt) and Google OAuth. Protect dashboard routes with
         middleware. Store sessions in the database using the Drizzle adapter."

[ ] 1.4  DB Migrations & Seed
         Prompt: "Run the initial Drizzle migration. Create a seed script at
         scripts/seed.ts that populates: 2 instructors, 5 class templates,
         3 credit packages, and 1 admin user."

[ ] 1.5  Booking Calendar (Student)
         Prompt: "Build the mobile-first BookingCalendar component. Fetch available
         classes from the server. Show class type, instructor, spots left,
         and vibe tags. On select, show BookingConfirmModal which calls
         createBooking.action.ts."

[ ] 1.6  Cancellation Engine
         Prompt: "Implement cancellationService in src/modules/booking/services/.
         Apply the 24h rule, first-time mercy check, and credit refund
         using an atomic DB transaction. Write unit tests in
         tests/unit/cancellation.service.test.ts."

[ ] 1.7  Admin Panel — Class Management
         Prompt: "Build the admin /classes page with a data table (shadcn DataTable).
         Implement createClass, updateClass, and cancelClass server actions.
         Cancelling a class must trigger automatic refunds for all bookings
         via creditService.refundAll()."

[ ] 1.8  User Dashboard
         Prompt: "Build the student dashboard showing: upcoming bookings, credit
         balance, booking history (cursor-based pagination), and streak counter
         (placeholder for Phase 3). All user queries must filter deleted_at IS NULL."
─────────────────────────────────────────────────────────────────
```

### PHASE 2 — Professionalization
**Goal:** Payment processing, transactional email, waitlists, waivers, and guest passes.

```
PHASE 2 TASK LIST:
─────────────────────────────────────────────────────────────────
[ ] 2.1  Stripe Integration
         Prompt: "Implement Stripe checkout for credit package purchases. Create
         the /api/webhooks/stripe route handler. On checkout.session.completed,
         call creditService.addCredits() with stripeCheckoutSessionId for idempotency.
         The stripe_transactions record must be created as 'pending' during checkout
         creation. Handle payment_intent.failed."

[ ] 2.2  Email System
         Prompt: "Set up Resend with React Email. Create email templates:
         BookingConfirmed, BookingCancelled, ClassCancelledByInstructor,
         WaitlistPromoted, CreditRefundIssued. Wire them into the relevant
         service calls using a fire-and-forget async pattern."

[ ] 2.3  Waitlist System
         Prompt: "Implement waitlistService. When a class is full, offer to join
         the waitlist. On a cancellation, run promoteNextInLine() which
         sends a WaitlistPromoted email with a 15-minute deep link to confirm.
         Use a BullMQ delayed job to expire the offer. Ensure confirmOffer()
         fetches the entry FOR UPDATE inside the transaction to prevent
         double-confirmation race conditions."

[ ] 2.4  Digital Waiver Flow
         Prompt: "On first booking, intercept with a WaiverModal. On sign, call
         signWaiver.action.ts which records the signature, IP, and timestamp
         in the waivers table. Block booking completion until signed."

[ ] 2.5  Guest Pass System
         Prompt: "Implement guest_passes table and guest pass logic. Admin can
         generate single-use passes. Passes can be redeemed at booking
         instead of spending credits."
─────────────────────────────────────────────────────────────────
```

### PHASE 3 — Growth & VOD
**Goal:** Video library, analytics, gamification, and SEO.

```
PHASE 3 TASK LIST:
─────────────────────────────────────────────────────────────────
[ ] 3.1  VOD Library
         Prompt: "Build the VOD module. Admin can upload to S3 via presigned URLs.
         Videos are served via Bunny.net CDN. Students with active membership
         can stream. Track progress in vod_progress table."

[ ] 3.2  Gamification Engine
         Prompt: "Implement streakService and badgeService. A streak increments
         when a student attends a class within 7 days of their last.
         Award badges at milestones: 5, 10, 25, 50 classes. Display in
         the student dashboard."

[ ] 3.3  Meta CAPI Dispatcher
         Prompt: "Implement meta-capi.service.ts. Fire server-side events for:
         ViewContent (class detail), InitiateCheckout (billing page),
         Purchase (post-payment). Hash all PII before sending. Load
         pixel ID and access token from env vars."

[ ] 3.4  SEO Dynamic Pages
         Prompt: "Add generateMetadata to class detail and VOD pages. Create
         JSON-LD Schema.org markup (Event for classes, VideoObject for VOD).
         Add a sitemap.ts and robots.ts in the app directory."
─────────────────────────────────────────────────────────────────
```

---

## 6. Tech Stack Commands

```bash
# ── Development ──────────────────────────────────────────────
pnpm dev            # Start dev server with Turbopack (default in Next.js 16)

# ── Build & Production ───────────────────────────────────────
pnpm build          # Production build
pnpm start          # Start production server

# ── Type Checking & Linting ──────────────────────────────────
pnpm typecheck      # tsc --noEmit
pnpm lint           # next lint (ESLint 9 flat config via eslint.config.mjs)
pnpm lint:fix       # next lint --fix
pnpm format         # Prettier

# ── Database (Drizzle) ───────────────────────────────────────
pnpm db:generate    # Generate migration files
pnpm db:migrate     # Apply migrations to DB
pnpm db:push        # Push schema directly (dev only)
pnpm db:studio      # Open Drizzle Studio (DB GUI)
pnpm db:seed        # Run seed script

# ── Testing ──────────────────────────────────────────────────
pnpm test           # Vitest (unit tests)
pnpm test:watch     # Vitest watch mode
pnpm test:e2e       # Playwright E2E
pnpm test:coverage  # Coverage report

# ── Queue (BullMQ / Redis) ───────────────────────────────────
pnpm queue:ui       # Bull Board dashboard (dev)

# ── Docker / Coolify ─────────────────────────────────────────
docker compose up -d   # Start local stack (DB + Redis)
docker compose down    # Stop stack
```

`package.json` scripts section:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write .",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx scripts/seed.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:coverage": "vitest run --coverage",
    "queue:ui": "tsx scripts/queue-ui.ts"
  }
}
```

---

## 7. Environment Variables

```bash
# .env.example — Copy to .env.local and fill in values

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pilates_os

# Auth
AUTH_SECRET=          # openssl rand -base64 32
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Resend (Email)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourstudio.com

# AWS S3 / Bunny.net
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=eu-central-1
AWS_S3_BUCKET=pilates-os-assets
BUNNY_CDN_BASE_URL=https://cdn.yourstudio.com

# Redis (BullMQ)
REDIS_URL=redis://localhost:6379

# Meta CAPI
META_PIXEL_ID=
META_CAPI_ACCESS_TOKEN=
META_TEST_EVENT_CODE=   # For testing only, remove in production

# Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

---

## 8. Key Architectural Decisions

**ADR-001: Modular Monolith over Microservices**
Decision: All modules live in one Next.js application.
Rationale: Single VPS deployment, shared DB, zero network latency between modules. Modules are logically separated; can be extracted to microservices later without major refactoring.

**ADR-002: Server Actions over API Routes (for mutations)**
Decision: Use Next.js Server Actions for all data mutations.
Rationale: Eliminates boilerplate API layers, enables RSC data flow, automatic revalidation.
Exception: Stripe webhooks and Meta CAPI must use API Routes (external callers).

**ADR-003: Drizzle ORM over Prisma**
Decision: Drizzle for all DB access.
Rationale: Zero-overhead abstraction, 100% TypeScript inference, no Rust binary, significantly lower memory footprint critical for VPS constraints.

**ADR-004: BullMQ for Deferred Jobs**
Decision: BullMQ (Redis) for waitlist promotion and email queues.
Rationale: Waitlist offer expiry requires precise delayed execution that cron jobs cannot provide. Redis is already available on the VPS for session caching.

**ADR-005: External Assets (No Next.js Image Optimization for VOD)**
Decision: All video and large media served from Bunny.net CDN.
Rationale: Next.js image optimization is CPU-intensive. CDN offloads bandwidth and encoding entirely from the VPS. Use `<video>` tag directly with CDN URLs.

**ADR-006: Soft-Delete on Users [FIX-1]**
Decision: `users` table has a `deleted_at TIMESTAMPTZ` column. Hard deletes are prohibited.
Rationale: Users are linked to financial records (`bookings`, `credit_transactions`, `stripe_transactions`, `waivers`) via `ON DELETE RESTRICT` FKs. A hard delete would be blocked at the DB level anyway. Soft-delete provides an audit trail and allows account recovery.

**ADR-007: RESTRICT FK Policy on Financial Tables [FIX-3]**
Decision: All user-linked financial tables use `ON DELETE RESTRICT`, not `CASCADE`.
Rationale: Silent cascade deletes on financial records are an audit and compliance risk. Any deletion of a user with financial history must be an explicit, intentional operation (soft-delete), not a side effect of an unrelated delete. Auth tables (`accounts`, `sessions`) are exempt.

**ADR-008: Cursor-Based Pagination [FIX-4]**
Decision: All paginated queries on growing tables use cursor-based pagination.
Rationale: Offset-based pagination produces incorrect results (duplicate rows, skipped rows) when new records are inserted between page fetches. The credit transaction ledger is an append-only table where this scenario is frequent. Cursor-based pagination using `createdAt` is stable and performant with the existing `(user_id, created_at)` composite index.

**ADR-009: Stripe Webhook Idempotency [FIX-5]**
Decision: `creditService.addCredits()` performs an idempotency check using `stripeCheckoutSessionId` via `FOR UPDATE` on `stripe_transactions` before any balance mutation.
Rationale: Stripe guarantees at-least-once delivery for webhooks. Without an idempotency guard, a retry would double-credit the user's balance. The `DUPLICATE_PAYMENT` error code signals to the webhook handler that it should return HTTP 200 (not 5xx) so Stripe stops retrying.

**ADR-010: Next.js 16 as Framework Version [FIX-6]**
Decision: Project uses Next.js 16 (latest stable as of project init, 2026-05).
Rationale: Latest stable release with continued App Router improvements. All async request API patterns introduced in Next.js 15 are enforced. ESLint 9 flat config (`eslint.config.mjs`) replaces legacy `.eslintrc`. Turbopack is the default dev bundler.

---

## 9. AI Collaboration Rules

These rules govern how Claude Code should behave in every session.

1. **Read `CLAUDE.md` first** in every new session before writing any code.
2. **Read `AGENTS.md`** — it contains Next.js 16 specific warnings that override training data.
3. **Never modify the DB schema** without explicit instruction and a migration plan.
4. **Always create a service for business logic** — never inline it in a component or action.
5. **Use existing utilities** — check `lib/utils/` before writing new helpers.
6. **Write the test alongside the service** — never deliver a service without a test file.
7. **Validate all inputs with Zod** in every Server Action, no exceptions.
8. **No `console.log` in production code** — use the Axiom logger utility.
9. **Every DB mutation is a transaction** — use `db.transaction()` for multi-table writes.
10. **Check the types** — run `pnpm typecheck` before declaring a task complete.
11. **Mobile-first** — every new UI component must render correctly at 375px width first.
12. **[FIX-1] Never hard-delete users** — always soft-delete via `deletedAt`. Filter `isNull(users.deletedAt)` in all active-user queries.
13. **[FIX-2] Always use `{ withTimezone: true, mode: 'date' }` on every timestamp column.** No exceptions, including `expires`, `signedAt`, `offeredAt`, etc.
14. **[FIX-3] Never add `onDelete: 'cascade'` to financial FK columns** (`bookings`, `credit_balances`, `credit_transactions`, `stripe_transactions`, `waivers`, `waitlist_entries`, `vod_progress`, `user_badges`, `guest_passes.created_by`). Use `restrict` or `set null`.
15. **[FIX-4] Never use `offset` pagination on growing tables.** Use cursor-based pagination returning `{ data, nextCursor }`.
16. **[FIX-5] Always pass `stripeCheckoutSessionId` to `creditService.addCredits()`** in Stripe webhook handlers. Never call `addCredits()` from a webhook without the idempotency key.
17. **[FIX-6] Always `await` request APIs** — `cookies()`, `headers()`, `params`, `searchParams` are async in Next.js 16. Never access them synchronously.
