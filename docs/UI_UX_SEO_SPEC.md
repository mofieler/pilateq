# UI_UX_&_SEO_SPEC.md — Pilates OS
> **Version:** 1.0.0 | **Scope:** Design System, Component Architecture, SEO
> This spec governs all frontend decisions. Deviations require ADR approval.

---

## 1. Design Philosophy

**Ethos:** "Studio-Grade Calm" — the UI should feel like walking into a premium boutique studio.
Think FORM Swim, YogaSix website, and Apple Health app: intentional whitespace,
typographic hierarchy, zero visual noise. Every element earns its place.

**Three Words:** Minimal. Intentional. Alive.

**Anti-patterns to avoid:**
- Excessive animations (no spinners for every transition)
- Color overload (two brand colors max in any single view)
- Dense information architecture (cards over tables on mobile)
- Generic SaaS aesthetics (no blue rounded everything)

---

## 2. Design Tokens (Tailwind v4 Configuration)

```css
/* src/styles/globals.css — Tailwind v4 Theme Tokens */
@theme {
  /* ── Typography ─────────────────────────────────────────────── */
  --font-sans: 'Inter Variable', system-ui, sans-serif;
  --font-display: 'Playfair Display', Georgia, serif;

  /* ── Color Palette ──────────────────────────────────────────── */

  /* Neutrals (Primary Canvas) */
  --color-stone-50:   #FAFAF8;     /* Page background */
  --color-stone-100:  #F4F4F0;     /* Card background */
  --color-stone-200:  #E8E8E2;     /* Borders, dividers */
  --color-stone-400:  #A8A89A;     /* Placeholder text */
  --color-stone-600:  #6B6B5F;     /* Secondary text */
  --color-stone-900:  #1A1A18;     /* Primary text */

  /* Brand (Use sparingly — one accent per screen) */
  --color-sage-400:   #8FAF8A;     /* Primary accent — calm, natural */
  --color-sage-500:   #6E9268;     /* Primary accent hover */
  --color-sage-50:    #F2F7F1;     /* Accent backgrounds */

  /* Functional */
  --color-error:      #C4533A;
  --color-success:    #4A8C5C;
  --color-warning:    #C49A3A;
  --color-info:       #3A7CC4;

  /* ── Spacing Scale ──────────────────────────────────────────── */
  --spacing-xs:   4px;
  --spacing-sm:   8px;
  --spacing-md:   16px;
  --spacing-lg:   24px;
  --spacing-xl:   40px;
  --spacing-2xl:  64px;
  --spacing-3xl:  96px;

  /* ── Border Radius ──────────────────────────────────────────── */
  --radius-sm:    6px;
  --radius-md:    12px;
  --radius-lg:    20px;
  --radius-full:  9999px;

  /* ── Shadows ────────────────────────────────────────────────── */
  --shadow-card:  0 1px 3px rgba(26,26,24,0.06), 0 4px 12px rgba(26,26,24,0.04);
  --shadow-modal: 0 8px 40px rgba(26,26,24,0.12);

  /* ── Typography Scale ───────────────────────────────────────── */
  --text-xs:    12px;   /* Captions, labels */
  --text-sm:    14px;   /* Body small, metadata */
  --text-base:  16px;   /* Body */
  --text-lg:    18px;   /* Lead text */
  --text-xl:    20px;   /* H4 */
  --text-2xl:   24px;   /* H3 */
  --text-3xl:   30px;   /* H2 */
  --text-4xl:   38px;   /* H1 */
  --text-5xl:   52px;   /* Hero */
}
```

---

## 3. Atomic Design Component Map

```
ATOMS (smallest indivisible units — in /src/components/ui/)
├── Button
│   variants: primary | secondary | ghost | destructive | link
│   sizes: sm | md | lg
│   states: default | loading | disabled
│
├── Badge
│   variants: default | success | warning | error | outline
│   → Used for: booking status, credit type labels, class type tags
│
├── Avatar
│   sizes: xs (24px) | sm (32px) | md (40px) | lg (64px)
│   fallback: initials on sage background
│
├── Input / Textarea
│   states: default | focused | error | disabled
│   always includes visible label (no placeholder-only forms)
│
├── Skeleton
│   shapes: text | circle | rectangle | card
│   → Used universally for loading states (no spinners on page load)
│
├── VibeTag (custom atom)
│   pill-shaped, icon + label
│   e.g.: 🎵 Chill House | 🔥 High Intensity | 💧 Reformer
│
└── CreditBubble (custom atom)
    Shows credit type + count with colored dot indicator
    standard → stone, premium → sage, vip → gold


MOLECULES (compositions of atoms — in /src/components/shared/)
├── ClassInfoRow
│   = Avatar (instructor) + Name + VibeTag[] + Duration + Intensity
│
├── BookingStatusBadge
│   = Badge + icon (confirmed/cancelled/attended/waitlisted)
│
├── CreditBalanceDisplay
│   = CreditBubble[] side-by-side for all active credit types
│
├── CountdownTimer
│   = Clock icon + live countdown text
│   → Used in: waitlist offer acceptance, cancellation window
│
├── SpotAvailability
│   = Progress-style bar + "X spots left" text
│   Color: sage (>50%) → warning (<20%) → error (full)
│
├── WaiverConsentBlock
│   = Scrollable text + Checkbox + "Sign" Button
│
└── InstructorVibeCard
    = Avatar (lg) + Name + Spotify embed (playlist preview)
    + Intensity level indicator + specialty tags


ORGANISMS (full feature sections — in /src/modules/*/components/)
├── BookingCalendar (src/modules/booking/components/)
│   = Week/Day toggle + ClassSessionCard grid
│   Mobile: Horizontal date scroll + vertical class list
│   Desktop: 7-day grid with time-based layout
│
├── ClassSessionCard
│   = Class name + InstructorVibeCard (collapsed) + SpotAvailability
│   + time/duration + CreditBubble cost + Book/Waitlist CTA
│   States: available | nearly-full | full | cancelled | booked-by-user
│
├── BookingConfirmModal
│   = Class summary + CreditBalanceDisplay (after deduction preview)
│   + WaiverConsentBlock (Phase 2, only on first booking)
│   + CancellationPolicyBanner + Confirm Button
│
├── CancellationPolicyBanner
│   Contextual — shows one of:
│   ✅ "Cancel for free up to 24h before"   (>24h remaining)
│   ⚡ "Grace period available (1 use)"     (<24h, mercy available)
│   ⚠️ "Late cancellation — no refund"      (<24h, mercy used)
│
├── AdminClassTable (src/modules/classes/components/)
│   = shadcn DataTable + row actions (edit/cancel/view bookings)
│   + bulk operations + search/filter bar
│
├── UserDashboard (src/modules/users/components/)
│   = GreetingHeader + StreakCounter + upcoming BookingList
│   + CreditBalanceDisplay + quick Book CTA
│
├── VODLibrary (src/modules/vod/components/)
│   = Filter sidebar (difficulty/instructor/tags) + VideoCard grid
│   + progress indicators on watched videos
│
└── WaitlistPromotionBanner
    Full-screen overlay when user has an active waitlist offer
    = Class summary + CountdownTimer (15 min) + Confirm/Decline CTAs
    Urgency design: sage border + pulsing badge


TEMPLATES (page-level layouts — in /src/app/**/)
├── DashboardLayout     — Sidebar + main content area
├── AuthLayout          — Centered card, no navigation
├── AdminLayout         — Top nav + sidebar + content
└── PublicLayout        — Marketing header + footer
```

---

## 4. Mobile-First Breakpoint Strategy

```
Base (≥375px):  Single column, bottom nav bar, card-based UI
sm   (≥640px):  Two-column cards, expanded spacing
md   (≥768px):  Sidebar visible, grid layouts
lg   (≥1024px): Full desktop layout, multi-panel views
xl   (≥1280px): Maximum content width (1200px) centered
```

**BookingCalendar behavior:**
- `base`: Horizontal date scroller (swipeable) → vertical class list below
- `md+`: Two-column week view with time slots

**Interaction principles:**
- Tap targets minimum 44×44px on all interactive elements
- Swipe gestures for date navigation (use `touch-action: pan-x`)
- No hover-only states — all hover states must have equivalent focus/active states

---

## 5. Component State & Loading Patterns

```typescript
// PATTERN: Server Component fetches data, Client Component handles interaction
// src/app/(dashboard)/book/page.tsx

export default async function BookPage() {
  const sessions = await getUpcomingSessions(); // Server-side fetch
  return <BookingCalendar initialSessions={sessions} />;
  //     ^ Client Component — handles date switching with optimistic UI
}

// LOADING PATTERN: Always use Skeleton, never spinner on initial load
// src/app/(dashboard)/book/loading.tsx
export default function BookingLoading() {
  return (
    <div className="space-y-4">
      <Skeleton variant="rectangle" className="h-12 w-full" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} variant="card" className="h-32 w-full" />
      ))}
    </div>
  );
}

// ERROR PATTERN: Contextual inline errors, not full page replacements
// src/app/(dashboard)/book/error.tsx
'use client';
export default function BookingError({ error, reset }: ErrorPageProps) {
  return (
    <EmptyState
      icon="calendar-x"
      title="Couldn't load classes"
      description="Please try again or contact support."
      action={{ label: 'Try again', onClick: reset }}
    />
  );
}
```

---

## 6. Animation Principles

Use CSS transitions only. No JavaScript-driven animations on primary flows.

```css
/* Standard transition — all interactive elements */
.interactive {
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Enter animations — use sparingly for modals and drawers */
@keyframes slide-up {
  from { transform: translateY(8px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}

/* Reduced motion — always respect user preference */
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

Allowed animations: modal enter/exit, toast slide-in, skeleton shimmer, tab indicator.
Forbidden: page transitions, list item staggering, parallax, autoplay anything.

---

## 7. Meta CAPI Server-Side Event Mapping

### Event Definitions

| User Action | Event Name | Priority | Required Properties |
|---|---|---|---|
| View class detail page | `ViewContent` | High | `content_ids`, `content_type: 'product'`, hashed PII |
| Open credit packages page | `InitiateCheckout` | High | `value`, `currency`, `num_items: 1` |
| Complete Stripe payment | `Purchase` | Critical | `value`, `currency`, `transaction_id` |
| Create account | `CompleteRegistration` | Medium | hashed `em`, `registration_method` |
| Book first class | `Schedule` | High | `content_ids: [sessionId]` |
| Search class schedule | `Search` | Low | `search_string` |

### Implementation Reference

```typescript
// src/modules/marketing/services/meta-capi.service.ts

import crypto from 'crypto';
import type { NextRequest } from 'next/server';

const GRAPH_API_VERSION = 'v19.0';
const GRAPH_API_ENDPOINT = `https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.META_PIXEL_ID}/events`;

type PiiData = {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
};

type MetaCapiEvent = {
  eventName: string;
  eventSourceUrl: string;
  customData?: Record<string, unknown>;
  userData: PiiData;
  request: NextRequest;
};

export const metaCapiService = {
  /**
   * Hash PII for Meta CAPI.
   * All PII must be SHA-256 hashed, lowercase trimmed, before transmission.
   */
  hashPii(value: string): string {
    return crypto
      .createHash('sha256')
      .update(value.toLowerCase().trim())
      .digest('hex');
  },

  /**
   * Dispatch a server-side event to Meta Conversions API.
   * Always call this after the primary action completes — non-blocking.
   */
  async dispatchEvent(event: MetaCapiEvent): Promise<void> {
    const { eventName, eventSourceUrl, customData, userData, request } = event;

    const hashedUserData: Record<string, string> = {};
    if (userData.email) hashedUserData.em = metaCapiService.hashPii(userData.email);
    if (userData.phone) hashedUserData.ph = metaCapiService.hashPii(userData.phone);
    if (userData.firstName) hashedUserData.fn = metaCapiService.hashPii(userData.firstName);
    if (userData.lastName) hashedUserData.ln = metaCapiService.hashPii(userData.lastName);

    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_source_url: eventSourceUrl,
          action_source: 'website',
          user_data: {
            ...hashedUserData,
            client_user_agent: request.headers.get('user-agent') ?? '',
            client_ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] ?? '',
            fbp: request.cookies.get('_fbp')?.value,
            fbc: request.cookies.get('_fbc')?.value,
          },
          custom_data: customData ?? {},
        },
      ],
      // Remove in production!
      ...(process.env.META_TEST_EVENT_CODE && {
        test_event_code: process.env.META_TEST_EVENT_CODE,
      }),
    };

    try {
      const response = await fetch(
        `${GRAPH_API_ENDPOINT}?access_token=${process.env.META_CAPI_ACCESS_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Meta CAPI dispatch failed', { eventName, error });
      }
    } catch (err) {
      // Non-blocking — log and continue. Never let CAPI errors affect UX.
      console.error('Meta CAPI network error', { err, eventName });
    }
  },

  // Convenience wrappers
  async purchaseEvent(
    request: NextRequest,
    userData: PiiData,
    amountCents: number,
    currency: string,
    transactionId: string,
  ) {
    await metaCapiService.dispatchEvent({
      eventName: 'Purchase',
      eventSourceUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success`,
      customData: {
        value: amountCents / 100,
        currency: currency.toUpperCase(),
        transaction_id: transactionId,
        content_type: 'product',
      },
      userData,
      request,
    });
  },

  async viewContentEvent(
    request: NextRequest,
    userData: PiiData,
    sessionId: string,
    className: string,
  ) {
    await metaCapiService.dispatchEvent({
      eventName: 'ViewContent',
      eventSourceUrl: `${process.env.NEXT_PUBLIC_APP_URL}/book/${sessionId}`,
      customData: {
        content_ids: [sessionId],
        content_type: 'product',
        content_name: className,
      },
      userData,
      request,
    });
  },
};
```

---

## 8. SEO Architecture

### Static Pages

| Page | Title Pattern | Description Pattern |
|---|---|---|
| Home | `{Studio Name} — Pilates Studio` | Unique studio description |
| Book | `Book a Class — {Studio Name}` | "Browse and book Pilates classes..." |
| VOD | `On-Demand Pilates — {Studio Name}` | "Stream Pilates workouts anytime..." |
| Admin | (noindex) | — |

### Dynamic Pages

```typescript
// src/app/(dashboard)/book/[sessionId]/page.tsx

export async function generateMetadata(
  { params }: { params: { sessionId: string } }
): Promise<Metadata> {
  const session = await getClassSession(params.sessionId);

  if (!session) return { title: 'Class Not Found' };

  return {
    title: `${session.className} with ${session.instructorName} — ${formatDate(session.startsAt)}`,
    description: `${session.classType} Pilates class with ${session.instructorName}. 
      ${session.durationMinutes} minutes · ${session.spotsRemaining} spots remaining. 
      Book now at ${STUDIO_NAME}.`,
    openGraph: {
      title: `${session.className} — ${STUDIO_NAME}`,
      description: session.description ?? '',
      images: [{ url: session.instructorAvatarUrl ?? '/og-default.jpg' }],
      type: 'website',
    },
    alternates: {
      canonical: `${APP_URL}/book/${session.id}`,
    },
    robots: { index: true, follow: true },
  };
}
```

### JSON-LD Injection Pattern

```typescript
// src/app/(dashboard)/book/[sessionId]/page.tsx — bottom of component

function ClassSessionJsonLd({ session }: { session: ClassSessionWithDetails }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: session.className,
    description: session.description,
    startDate: session.startsAt.toISOString(),
    endDate: session.endsAt.toISOString(),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: session.isOnline
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': session.isOnline ? 'VirtualLocation' : 'Place',
      name: session.location ?? STUDIO_NAME,
    },
    organizer: {
      '@type': 'Organization',
      name: STUDIO_NAME,
      url: APP_URL,
    },
    performer: {
      '@type': 'Person',
      name: session.instructorName,
    },
    offers: {
      '@type': 'Offer',
      price: String(session.creditCost),
      priceCurrency: 'EUR',
      availability:
        session.spotsRemaining > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut',
      url: `${APP_URL}/book/${session.id}`,
      validFrom: new Date().toISOString(),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
```

### Sitemap

```typescript
// src/app/sitemap.ts
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sessions = await getUpcomingPublicSessions();
  const videos = await getPublishedVodVideos();

  return [
    { url: APP_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${APP_URL}/book`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${APP_URL}/vod`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    ...sessions.map((s) => ({
      url: `${APP_URL}/book/${s.id}`,
      lastModified: s.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...videos.map((v) => ({
      url: `${APP_URL}/vod/${v.slug}`,
      lastModified: v.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
```

---

## 9. Accessibility Standards (WCAG 2.1 AA)

- All interactive elements reachable via keyboard (`Tab` → `Space`/`Enter`)
- Color contrast ratio: minimum 4.5:1 for body text, 3:1 for large text
- ARIA labels on all icon-only buttons
- Focus rings: visible on all elements, `2px solid var(--color-sage-500)`
- Screen reader announcements for: booking confirmations, errors, loading states
- `prefers-reduced-motion` respected for all animations (see §6)
- Form error messages linked via `aria-describedby`, not just color

```typescript
// Example: accessible icon button
<button
  type="button"
  aria-label="Cancel booking for Morning Reformer Flow"
  className="focus:ring-2 focus:ring-sage-500 focus:outline-none rounded-sm"
  onClick={handleCancel}
>
  <XIcon className="h-4 w-4" aria-hidden="true" />
</button>
```

---

## 10. Performance Budget

| Metric | Target | Tool |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.0s | Lighthouse |
| FID / INP | < 100ms | Chrome DevTools |
| CLS (Cumulative Layout Shift) | < 0.05 | Lighthouse |
| First-party JS bundle | < 150KB (gzipped) | `next build` analysis |
| API response time (p95) | < 400ms | Axiom |
| Time to First Byte (TTFB) | < 600ms | WebPageTest |

**Strategies to hit targets:**
- RSC by default — only `'use client'` when state/effects required
- `next/image` for all images with explicit `width` + `height`
- VOD assets via CDN, never from Next.js server
- `React.lazy` + `Suspense` for admin-only heavy components
- DB query analysis with `EXPLAIN ANALYZE` on any query touching > 1000 rows
