# ARCHITECTURE_MASTERPLAN.md — Pilates OS
**Version:** 1.2.0 | **Type:** System Architecture Reference
Companion to CLAUDE.md. Do not modify without updating CLAUDE.md.

**Patch v1.2.0 Changes:**
- [FIX-6] Framework updated to Next.js 16. System overview diagram updated.
  Async request APIs (`cookies()`, `headers()`, `params`, `searchParams`) remain
  async (introduced in Next.js 15, continues in 16). ESLint 9 flat config applies.

**Patch v1.1.0 Changes:**
- [FIX-1] Soft-delete (`deleted_at`) added to `users` table in ER diagram and text.
- [FIX-2] All timestamps are timezone-aware (`TIMESTAMPTZ`) — noted in schema commentary.
- [FIX-3] Financial/booking `onDelete: CASCADE` changed to `RESTRICT` or `SET NULL` — annotated in ER diagram and service map.
- [FIX-5] Stripe webhook idempotency guard documented in service map and flow diagrams.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PILATES OS SYSTEM                               │
│                                                                         │
│  ┌──────────┐    ┌───────────────────────────────────────────────────┐  │
│  │  Client  │    │              Next.js 16 App                       │  │
│  │ Browser  │◄──►│  RSC + App Router + Server Actions + API Routes   │  │
│  │  Mobile  │    └──────────────────────┬────────────────────────────┘  │
│  └──────────┘                           │                               │
│                         ┌──────────────┼──────────────┐                │
│                         ▼              ▼              ▼                │
│                   ┌────────────┐ ┌───────────┐ ┌──────────────┐       │
│                   │ PostgreSQL │ │   Redis   │ │    BullMQ    │       │
│                   │ (Drizzle)  │ │  (Cache)  │ │   (Queues)   │       │
│                   └────────────┘ └───────────┘ └──────────────┘       │
│                                                                         │
│  External Services:                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │  Stripe  │ │  Resend  │ │  S3 /    │ │   Meta   │ │  Google    │  │
│  │ Payments │ │  Email   │ │ Bunny CDN│ │   CAPI   │ │   OAuth    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ER Diagram — Full Relational Schema

> **[FIX-2] All timestamps in this schema are `TIMESTAMPTZ` (timezone-aware).**
> In Drizzle ORM: `timestamp('col', { withTimezone: true, mode: 'date' })`.
> This applies to every `created_at`, `updated_at`, `starts_at`, `signed_at`, etc.

> **[FIX-1] `users` table has a `deleted_at TIMESTAMPTZ` soft-delete column.**
> Hard deletes are prohibited on users with financial history. Use soft-delete instead.
> All queries returning active users MUST filter `WHERE deleted_at IS NULL`.

> **[FIX-3] Financial table FK policy:**
> `bookings.user_id`, `credit_balances.user_id`, `credit_transactions.user_id`,
> `stripe_transactions.user_id`, `waivers.user_id`, `guest_passes.created_by`,
> `waitlist_entries.user_id` → all use `ON DELETE RESTRICT`.
> Auth tables (`accounts`, `sessions`) retain `ON DELETE CASCADE` as they are
> session data, not financial records.

```
erDiagram
    users {
        uuid        id                   PK
        varchar     email                UK
        varchar     name
        varchar     password_hash
        varchar     phone
        varchar     avatar_url
        enum        role                 "student|instructor|admin"
        boolean     has_signed_waiver
        boolean     first_mercy_used
        integer     total_classes_attended
        integer     current_streak
        integer     longest_streak
        timestamptz streak_last_updated_at
        timestamptz deleted_at           "FIX-1: soft-delete"
        timestamptz created_at
        timestamptz updated_at
    }

    instructors {
        uuid        id          PK
        uuid        user_id     FK "ON DELETE RESTRICT (FIX-3)"
        varchar     bio
        varchar     spotify_playlist_url
        varchar     intensity_level      "low|medium|high|varied"
        varchar[]   specialties
        varchar     avatar_url
        boolean     is_active
        timestamptz created_at
    }

    class_templates {
        uuid        id              PK
        varchar     name
        text        description
        enum        class_type      "private|duo|group|reformer|mat|online"
        integer     duration_minutes
        integer     max_capacity
        integer     credit_cost
        enum        credit_type     "standard|premium|vip"
        uuid        instructor_id   FK "ON DELETE SET NULL"
        varchar[]   vibe_tags
        varchar     location
        boolean     is_active
        timestamptz created_at
    }

    class_sessions {
        uuid        id                  PK
        uuid        template_id         FK "ON DELETE SET NULL"
        uuid        instructor_id       FK "ON DELETE SET NULL"
        timestamptz starts_at           "TIMESTAMPTZ (FIX-2)"
        timestamptz ends_at             "TIMESTAMPTZ (FIX-2)"
        integer     max_capacity
        integer     booked_count
        integer     waitlist_count
        enum        status              "scheduled|in_progress|completed|cancelled"
        text        cancellation_reason
        timestamptz cancelled_at
        uuid        cancelled_by        FK "ON DELETE SET NULL"
        timestamptz created_at
        timestamptz updated_at
    }

    bookings {
        uuid        id                  PK
        uuid        user_id             FK "ON DELETE RESTRICT (FIX-3)"
        uuid        session_id          FK "ON DELETE RESTRICT (FIX-3)"
        enum        status              "confirmed|cancelled|attended|no_show|waitlisted"
        enum        cancellation_type   "user_cancelled|instructor_cancelled|admin_cancelled"
        boolean     mercy_applied
        integer     credits_spent
        enum        credit_type         "standard|premium|vip|guest_pass"
        timestamptz booked_at
        timestamptz cancelled_at
        text        cancellation_reason
        timestamptz created_at
        timestamptz updated_at
    }

    credit_packages {
        uuid        id              PK
        varchar     name
        text        description
        integer     credits_amount
        enum        credit_type     "standard|premium|vip"
        integer     price_cents
        varchar     currency        "usd|eur|gbp"
        integer     validity_days
        boolean     is_active
        integer     sort_order
        timestamptz created_at
    }

    credit_balances {
        uuid        id              PK
        uuid        user_id         FK "ON DELETE RESTRICT (FIX-3)"
        enum        credit_type     "standard|premium|vip"
        integer     balance
        timestamptz expires_at
        timestamptz created_at
        timestamptz updated_at
    }

    credit_transactions {
        uuid        id              PK
        uuid        user_id         FK "ON DELETE RESTRICT (FIX-3)"
        uuid        booking_id      FK "ON DELETE SET NULL"
        uuid        package_id      FK "ON DELETE SET NULL"
        enum        type            "purchase|debit|refund|manual_adjustment|expiry"
        enum        credit_type     "standard|premium|vip"
        integer     amount
        integer     balance_after
        text        description
        uuid        processed_by    FK "ON DELETE SET NULL"
        timestamptz created_at
    }

    stripe_transactions {
        uuid        id                          PK
        uuid        user_id                     FK "ON DELETE RESTRICT (FIX-3)"
        uuid        package_id                  FK "ON DELETE SET NULL"
        varchar     stripe_payment_intent_id    UK
        varchar     stripe_checkout_session_id  UK "FIX-5: idempotency key"
        integer     amount_cents
        varchar     currency
        enum        status                      "pending|succeeded|failed|refunded"
        jsonb       stripe_metadata
        timestamptz created_at
        timestamptz updated_at
    }

    waitlist_entries {
        uuid        id                  PK
        uuid        user_id             FK "ON DELETE RESTRICT (FIX-3)"
        uuid        session_id          FK "ON DELETE RESTRICT (FIX-3)"
        integer     position
        enum        status              "waiting|offered|confirmed|expired|cancelled"
        timestamptz offered_at
        timestamptz offer_expires_at
        timestamptz confirmed_at
        timestamptz created_at
        timestamptz updated_at
    }

    waivers {
        uuid        id                  PK
        uuid        user_id             FK "ON DELETE RESTRICT (FIX-3)"
        varchar     document_version
        text        document_content
        varchar     ip_address
        varchar     user_agent
        timestamptz signed_at           "TIMESTAMPTZ — legal record (FIX-2)"
        timestamptz created_at
    }

    guest_passes {
        uuid        id                      PK
        varchar     code                    UK
        uuid        created_by              FK "ON DELETE RESTRICT (FIX-3)"
        uuid        redeemed_by             FK "ON DELETE SET NULL"
        uuid        redeemed_for_session    FK "ON DELETE SET NULL"
        enum        status                  "active|redeemed|expired"
        timestamptz expires_at
        timestamptz redeemed_at
        timestamptz created_at
        timestamptz updated_at
    }

    vod_videos {
        uuid        id                  PK
        varchar     title
        text        description
        varchar     slug                UK
        varchar     s3_key
        varchar     cdn_url
        varchar     thumbnail_url
        integer     duration_seconds
        integer     file_size_bytes
        enum        status              "processing|published|unlisted|archived"
        varchar[]   tags
        enum        difficulty          "beginner|intermediate|advanced"
        uuid        instructor_id       FK "ON DELETE SET NULL"
        integer     view_count
        jsonb       schema_org_metadata
        timestamptz published_at
        timestamptz created_at
        timestamptz updated_at
    }

    vod_progress {
        uuid        id                  PK
        uuid        user_id             FK "ON DELETE RESTRICT (FIX-3)"
        uuid        video_id            FK "ON DELETE CASCADE"
        integer     watched_seconds
        boolean     completed
        timestamptz last_watched_at
        timestamptz created_at
        timestamptz updated_at
    }

    badges {
        uuid        id              PK
        varchar     name            UK
        text        description
        varchar     icon_url
        enum        trigger_type    "classes_attended|streak|purchases|special"
        integer     trigger_value
        timestamptz created_at
    }

    user_badges {
        uuid        id          PK
        uuid        user_id     FK "ON DELETE RESTRICT (FIX-3)"
        uuid        badge_id    FK "ON DELETE CASCADE"
        timestamptz awarded_at
    }

    users ||--o{ bookings               : "makes (RESTRICT)"
    users ||--o{ credit_balances        : "has (RESTRICT)"
    users ||--o{ credit_transactions    : "has (RESTRICT)"
    users ||--o{ stripe_transactions    : "has (RESTRICT)"
    users ||--o{ waitlist_entries       : "joins (RESTRICT)"
    users ||--o{ waivers                : "signs (RESTRICT)"
    users ||--o{ vod_progress           : "tracks (RESTRICT)"
    users ||--o{ user_badges            : "earns (RESTRICT)"
    users ||--o| instructors            : "can be (RESTRICT)"
    instructors ||--o{ class_templates  : "teaches"
    instructors ||--o{ class_sessions   : "leads"
    class_templates ||--o{ class_sessions : "generates"
    class_sessions ||--o{ bookings        : "has (RESTRICT)"
    class_sessions ||--o{ waitlist_entries : "has (RESTRICT)"
    bookings ||--o{ credit_transactions : "triggers"
    credit_packages ||--o{ credit_transactions  : "referenced by"
    credit_packages ||--o{ stripe_transactions  : "purchased via"
    badges ||--o{ user_badges           : "awarded as"
    vod_videos ||--o{ vod_progress      : "tracked by"
    vod_videos }o--|| instructors       : "created by"
```

---

## 3. Service Layer Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       SERVICE INTERACTION MAP                           │
│                                                                         │
│  SERVER ACTIONS (Thin Layer — Auth + Zod Validation Only)               │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐ │
│  │ createBooking  │  │  cancelBooking   │  │   purchaseCredits       │ │
│  │  .action.ts    │  │   .action.ts     │  │     .action.ts          │ │
│  └───────┬────────┘  └────────┬─────────┘  └────────────┬────────────┘ │
│          │                   │                          │              │
│          ▼                   ▼                          ▼              │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                        DOMAIN SERVICES                              ││
│  │                                                                     ││
│  │  booking.service ──────────────────────► availability.service      ││
│  │       │                     │                                       ││
│  │       ▼                     ▼                                       ││
│  │  cancellation.service ◄──── class.service                          ││
│  │       │                                                             ││
│  │       ▼                                                             ││
│  │  credit.service ◄─────────────────────────────────────────────────  ││
│  │       │                                                             ││
│  │       ▼                                                             ││
│  │  waitlist.service ◄─── (on cancellation, triggers promotion)       ││
│  │       │                                                             ││
│  │       └──────────────► [BullMQ Queue] ──► email.worker             ││
│  │                                               └──► resend.ts       ││
│  │                                                                     ││
│  │  stripe.service  ──► credit.service.addCredits()                   ││
│  │       │               └── [FIX-5] Idempotency check via            ││
│  │       │                   stripeTransactions FOR UPDATE             ││
│  │       │                   before any balance mutation               ││
│  │       └──────────────► meta-capi.service (Purchase event)          ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  DATA LAYER (Drizzle ORM — always within db.transaction() for mutations)│
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  users* │ bookings │ credit_balances │ credit_transactions │ ... │   │
│  │  * queries MUST filter WHERE deleted_at IS NULL (FIX-1)         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Service Responsibilities

| Service | Responsibility | Key Methods |
|---|---|---|
| `booking.service` | Orchestrates booking creation | `createBooking()`, `confirmBooking()` |
| `availability.service` | Reads available spots | `getAvailableSlots()`, `isClassFull()` |
| `cancellation.service` | 24h rule + mercy + refund | `cancel()`, `checkMercyEligibility()` |
| `credit.service` | Atomic credit operations + idempotency | `debit()`, `refund()`, `addCredits()`, `getBalance()`, `getTransactionHistory()` |
| `waitlist.service` | FIFO promotion + expiry | `join()`, `promoteNextInLine()`, `expireOffer()` |
| `class.service` | Class CRUD + instructor cancel | `create()`, `cancel()`, `refundAllBookings()` |
| `stripe.service` | Checkout + webhook processing | `createCheckout()`, `handleWebhook()` |
| `meta-capi.service` | Server-side pixel events | `dispatchEvent()`, `hashPii()` |
| `streak.service` | Streak calculation + awards | `incrementStreak()`, `checkMilestones()` |
| `vod.service` | Video lifecycle + access | `getSignedUrl()`, `trackProgress()` |

---

## 4. Booking Flow — State Machine

```
            ┌─────────────┐
            │   Student   │
            │  Requests   │
            │   Booking   │
            └──────┬──────┘
                   │
       ┌───────────▼───────────┐
       │    Waiver Signed?     │
       └──────┬───────────┬────┘
           No │           │ Yes
              ▼           ▼
        ┌──────────┐  ┌────────────────────┐
        │  Show    │  │   Has Credits?     │
        │  Waiver  │  └───┬────────────┬───┘
        │  Modal   │   No │            │ Yes
        └──────────┘      ▼            ▼
                   ┌──────────┐  ┌─────────────────┐
                   │ Purchase │  │ Class Has Space? │
                   │ Credits  │  └──┬───────────┬───┘
                   └──────────┘  No │           │ Yes
                                    ▼           ▼
                             ┌──────────┐  ┌─────────────┐
                             │  Join    │  │    DEBIT    │
                             │Waitlist? │  │   Credits   │
                             └──────────┘  │  (atomic tx)│
                                           └──────┬──────┘
                                                  │
                                          ┌───────▼──────┐
                                          │  Booking =   │
                                          │  CONFIRMED   │
                                          └───────┬──────┘
                                                  │
                                          ┌───────▼──────┐
                                          │    Send      │
                                          │Confirmation  │
                                          │    Email     │
                                          └─────────────┘
```

---

## 5. Cancellation Engine — Decision Tree

```
cancelBooking(bookingId, userId)
│
├── [GUARD] Is booking.userId === userId? (or admin?) → else: 403
├── [GUARD] Is booking.status === "confirmed"? → else: error
│
├── Calculate hoursUntilClass = differenceInHours(session.startsAt, now)
│   NOTE: startsAt is TIMESTAMPTZ — comparison is always unambiguous (FIX-2)
│
├── hoursUntilClass >= 24?
│   ├── YES → Full Refund, no penalty
│   │         booking.status = "cancelled"
│   │         creditService.refund(booking.creditsSpent)
│   │         → DONE
│   │
│   └── NO → Has user.first_mercy_used === false?
│             ├── YES (mercy available) → Apply mercy
│             │         user.first_mercy_used = true
│             │         Full Refund anyway
│             │         booking.mercy_applied = true
│             │         → Email: "One-time grace applied"
│             │         → DONE
│             │
│             └── NO (mercy used up) → Late cancellation
│                       booking.status = "cancelled"
│                       NO refund issued
│                       → Email: "Late cancellation, credits forfeited"
│                       → DONE
```

---

## 6. Waitlist Confirmation Flow — Race Condition Prevention

```
[FIX-3] BEFORE patch (vulnerable to race condition):
  Thread A: SELECT entry WHERE id=X  →  status='offered'  ─┐
  Thread B: SELECT entry WHERE id=X  →  status='offered'  ─┼── Both proceed!
  Thread A: BEGIN TX → INSERT booking                       │
  Thread B: BEGIN TX → INSERT booking  ← DUPLICATE ────────┘

[FIX-3] AFTER patch (safe):
  Thread A: BEGIN TX → SELECT entry FOR UPDATE WHERE id=X
                        (acquires row lock)
  Thread B: BEGIN TX → SELECT entry FOR UPDATE WHERE id=X
                        (BLOCKS — waits for Thread A)
  Thread A: checks status='offered' → proceeds → commits → status='confirmed'
  Thread B: lock released → reads status='confirmed' → throws INVALID_STATE → rolls back
```

---

## 7. Stripe Webhook Idempotency Flow

```
[FIX-5] Stripe may retry checkout.session.completed if it doesn't receive HTTP 200.
Without a guard, each retry would add credits to the user's balance.

Idempotency guard in creditService.addCredits():

  Webhook fires → stripe.service.handleWebhook()
       │
       └── creditService.addCredits({ ..., stripeCheckoutSessionId })
                │
                └── db.transaction(async tx => {
                      // 1. Lock the stripe transaction record
                      SELECT * FROM stripe_transactions
                        WHERE stripe_checkout_session_id = ?
                        FOR UPDATE;

                      // 2. Check status
                      if (status === 'succeeded') → throw DuplicatePaymentError
                        └── Return { code: 'DUPLICATE_PAYMENT' }
                            → Webhook handler returns HTTP 200 to Stripe
                               (tells Stripe: "received, stop retrying")

                      // 3. First time through → mark succeeded + credit user
                      UPDATE stripe_transactions SET status = 'succeeded';
                      UPDATE credit_balances SET balance = balance + amount;
                      INSERT INTO credit_transactions ...;
                    })

IMPORTANT: The stripe_transactions record MUST be created in 'pending' state
when the checkout session is first created (in stripe.service.createCheckout()).
The idempotency guard depends on this record existing before the webhook fires.
```

---

## 8. Infrastructure Map — Coolify Deployment

```
┌─────────────────────────────────────────────────────────────────────┐
│  VPS (e.g. Hetzner CX21)                                            │
│  2 vCPU, 4GB RAM, Coolify                                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Docker Network                                             │   │
│  │                                                             │   │
│  │  ┌────────────────┐  ┌─────────────┐  ┌────────────────┐  │   │
│  │  │  Next.js App   │  │ PostgreSQL  │  │    Redis       │  │   │
│  │  │   (Node 20)    │◄─►   (Pg 16)  │  │    (7.x)       │  │   │
│  │  │  Port: 3000    │  │ Port: 5432  │  │  Port: 6379    │  │   │
│  │  │  RAM: ~256MB   │  │ RAM: ~512MB │  │  RAM: ~64MB    │  │   │
│  │  └───────┬────────┘  └─────────────┘  └────────────────┘  │   │
│  │          │                                                  │   │
│  └──────────┼───────────────────────────────────────────────── │   │
│             │  Coolify Reverse Proxy (Traefik)                 │   │
│             │  SSL via Let's Encrypt                           │   │
└─────────────┼───────────────────────────────────────────────── │   │
              │                                                   │
              ▼ HTTPS                                             │
        yourstudio.com                                            │
                                                                  │
┌──────────────────────────────────────────────────────────────────┐ │
│  EXTERNAL SERVICES                                               │ │
│                                                                  │ │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌─────────────┐ │ │
│  │  Stripe  │  │  Resend  │  │  AWS S3 /    │  │  Meta CAPI  │ │ │
│  │   API    │  │  Email   │  │  Bunny CDN   │  │  Graph API  │ │ │
│  │ (HTTPS)  │  │ (SMTP+)  │  │  (Assets)    │  │  (Events)   │ │ │
│  └──────────┘  └──────────┘  └──────────────┘  └─────────────┘ │ │
└──────────────────────────────────────────────────────────────────┘ │
```

### Resource Budget (2 vCPU / 4GB RAM VPS)

| Service | RAM Allocation | Notes |
|---|---|---|
| Next.js (Node) | 256MB | RSC reduces client bundle significantly |
| PostgreSQL | 512MB | Tune `shared_buffers=128MB`, `work_mem=4MB` |
| Redis | 64MB | Sessions + BullMQ queues |
| Traefik | 32MB | Coolify-managed |
| OS/Buffer | 512MB | System overhead |
| **Total** | **~1.4GB** | Safe headroom on 4GB VPS |

---

## 9. Meta CAPI Event Mapping

| User Action | Meta Event | Required Fields |
|---|---|---|
| View class detail page | `ViewContent` | `content_ids`, `content_type`, hashed `em`, `ph` |
| Open billing / packages page | `InitiateCheckout` | `value`, `currency`, `num_items` |
| Complete Stripe payment | `Purchase` | `value`, `currency`, `transaction_id` |
| Register account | `CompleteRegistration` | hashed `em` |
| Book first class | `Schedule` | `content_ids` |

All events: `event_source_url`, `client_user_agent`, `client_ip_address` (from request headers).
All PII fields (`em`, `ph`, `fn`, `ln`) must be SHA-256 hashed before transmission.

---

## 10. SEO Schema Structure

```json
// Class Session Page — JSON-LD
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Morning Reformer Flow",
  "startDate": "2025-03-15T09:00:00+01:00",
  "endDate": "2025-03-15T10:00:00+01:00",
  "location": {
    "@type": "Place",
    "name": "Studio Name",
    "address": "123 Studio Street, City"
  },
  "organizer": {
    "@type": "Organization",
    "name": "Studio Name",
    "url": "https://yourstudio.com"
  },
  "performer": {
    "@type": "Person",
    "name": "Instructor Name"
  },
  "offers": {
    "@type": "Offer",
    "price": "15",
    "priceCurrency": "EUR",
    "availability": "https://schema.org/InStock",
    "url": "https://yourstudio.com/book/[session-id]"
  }
}
```

```json
// VOD Video Page — JSON-LD
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "Full Body Pilates — 45 min",
  "description": "...",
  "thumbnailUrl": "https://cdn.yourstudio.com/...",
  "uploadDate": "2025-01-01",
  "duration": "PT45M",
  "contentUrl": "https://cdn.yourstudio.com/...",
  "publisher": {
    "@type": "Organization",
    "name": "Studio Name"
  }
}
```
