# Public weekly schedule embed

This lets a **marketing site** (WordPress, Webflow, etc.) show the same week view as the logged-in app, **without** exposing booking actions until the user opens the booking app and signs in.

## Recommended approach: iframe + loader script

Industry pattern (Calendly, Eversport-style widgets): host a **small, cacheable page** on the booking app and embed it in an `<iframe>`. The iframe posts its document height to the parent so the frame does not clip content.

**Why not raw JSON + rebuild the calendar on the marketing site?**

- Duplicates UI and timezone rules.
- Requires CORS allowlists and a second implementation of the week grid.

**Why iframe wins here**

- One source of truth for layout, copy, and “tap to book” behaviour.
- Works with your existing `WeekView` and studio styling.
- Parent page only needs a short script; no React bundle on the marketing site.

## Security checklist

1. **`EMBED_FRAME_ANCESTORS`** (Coolify / `.env`): space-separated origins allowed to frame `/embed/*`. Example:

   `https://www.your-studio.de https://your-studio.de`

   Defaults in code are `'self'` plus localhost in development; **always set this in production** for your real marketing origins.

2. **`EMBED_SCHEDULE_CORS_ORIGINS`** (optional): comma-separated origins allowed to call `GET /api/embed/schedule` from JavaScript. If unset, the API reflects the request `Origin` or uses `*` (read-only public JSON). Tighten this if you build a custom JSON client on a known domain.

3. **Click targets**: class taps open the booking app in a new tab with `login?callbackUrl=/book?date=…` so users land in auth then booking.

## Snippet A — Loader script (auto height)

Replace `https://YOUR-APP` with your deployed `NEXT_PUBLIC_APP_URL` host.

```html
<div id="studio-schedule"></div>
<script
  src="https://YOUR-APP/embed-schedule-loader.js"
  data-base-url="https://YOUR-APP"
  data-target="studio-schedule"
  async
></script>
```

Optional: `data-week="2026-05-19"` opens the week that contains that date. `data-target="my-container"` mounts into `#my-container`.

The loader listens for `postMessage` with `{ type: 'embed-resize', height }` only from the booking app origin.

## Snippet B — Plain iframe (fixed min-height)

```html
<iframe
  src="https://YOUR-APP/embed/schedule"
  title="Weekly class schedule"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
  style="width:100%;border:0;min-height:560px;background:#faf9f7;border-radius:12px"
></iframe>
```

Add your own `postMessage` listener if you want dynamic height without the loader.

## URLs

| Path | Purpose |
|------|---------|
| `/embed/schedule` | Server-rendered week calendar (public). Query `?date=yyyy-MM-dd` selects the week. |
| `/api/embed/schedule` | JSON for custom integrations (`?week=yyyy-MM-dd` optional). |

## UX notes

- **`loading="lazy"`** defers iframe work until near viewport.
- **New tab for booking** avoids trapping logged-in users inside a small frame.
- **Resize messages** use `targetOrigin '*'` from the iframe; the **parent** must filter by `event.origin` (the loader does this).
