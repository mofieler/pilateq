# pilatesOS — Vollständige Coolify-Deployment-Anleitung (aktueller Stand)

> **Gültig für:** Next.js 16.2.4, React 19.2.4, Drizzle ORM, PostgreSQL 18, Auth.js v5, Tailwind v4, shadcn/ui  
> **Letzte Aktualisierung:** 2026-06-11

Diese Anleitung deckt das Deployment von pilatesOS auf einem eigenen VPS mit Coolify ab und berücksichtigt alle letzten Änderungen:

- Self-Service-Signup über `/start`
- GDPR-konforme Account-Löschung und Daten-Export
- Credit-Expiry mit automatischem Sweep
- Multi-Tenant-Rechnungswesen
- Security-Härtung (CSP, CORS, Rate-Limiting, Datei-Upload)
- Migrationen `0000`–`0009`
- Harmonisiertes Design-System

---

## 1. VPS- & Domain-Voraussetzungen

| Ressource | Minimum | Empfohlen |
|---|---|---|
| VPS (Coolify + App) | 4 vCPU, **8 GB RAM**, 80 GB SSD | 4 vCPU, **16 GB RAM**, 120 GB SSD |
| PostgreSQL | 1 vCPU, 2 GB RAM | 2 vCPU, 4 GB RAM (separater Server oder Coolify-Service) |
| PostgreSQL Version | **18** (aktueller Stand Mai 2026) | 18 — für neue Projekte empfohlen |
| Redis | 512 MB RAM | 1 GB RAM (für Rate-Limiting + BullMQ) |
| Domain | `yourplatform.com` + Wildcard `*.yourplatform.com` | TTL 300 während des Setups |

> **⚠️ Wichtig:** Next.js 16 + Turbopack braucht für den Build **mindestens 4 GB RAM**. Wenn Coolify auf dem gleichen Server läuft, sind **8 GB das absolute Minimum**, besser 16 GB. Unter 4 GB Heap bricht der Build mit OOM/SIGKILL ab.

### DNS-Einträge

```
A     @              VPS_IP
A     app            VPS_IP
A     *              VPS_IP      # nur für SaaS/Subdomain-Tenants nötig
CNAME www            yourplatform.com.
```

---

## 2. Coolify installieren

```bash
ssh root@DEINE_VPS_IP
curl -fsSL https://cdn.coolify.io/install.sh | bash
```

1. Coolify-UI öffnen: `http://DEINE_VPS_IP:8000`
2. Admin-Account anlegen
3. Unter **Sources → GitHub** das Repository verbinden

> Sicherheitstipp: Nach dem Setup Coolify-Port 8000 auf deine IP beschränken oder über SSH-Tunnel nutzen.

---

## 3. PostgreSQL als Resource anlegen

1. Coolify → **+ New Resource** → **Database** → **PostgreSQL 18** (falls Coolify PG 18 noch nicht als Template anbietet, Custom Docker Image `postgres:18-alpine` verwenden)
2. Einstellungen:

| Feld | Wert |
|---|---|
| Name | `pilates-os-db` |
| Database | `pilates_os` |
| Username | `pilates_os` |
| Password | Auto-generieren |
| Public access | **OFF** |

3. Nach dem Start die **interne Connection URL** kopieren, z. B.:
   ```
   postgresql://pilates_os:RANDOM_PASSWORD@pilates-os-db:5432/pilates_os
   ```
   
4. **Diese URL als `DATABASE_URL` in Coolify eintragen:**
   - Gehe zu deiner App in Coolify → Tab **Environment Variables**
   - Klicke **+ Add**
   - **Key:** `DATABASE_URL`
   - **Value:** die kopierte URL (z. B. `postgresql://pilates_os:...`)
   - **Build/Runtime:** **Runtime** (sehr wichtig!)
   - **Is Secret:** **ON** (damit das Passwort nicht in Logs sichtbar ist)
   - Speichern
   
   > **Wichtig:** Niemals die `DATABASE_URL` in Git committen oder in `.env.example` mit echten Credentials füllen.

---

## 4. (Optional, empfohlen) Redis anlegen

1. **+ New Resource** → **Database** → **Redis 7**
2. Einstellungen:

| Feld | Wert |
|---|---|
| Name | `pilates-os-redis` |
| Password | Auto-generieren |
| Public access | **OFF** |

3. Interne URL kopieren:
   ```
   redis://default:RANDOM_PASSWORD@pilates-os-redis:6379
   ```
   
4. **Diese URL als `REDIS_URL` in Coolify eintragen:**
   - App → **Environment Variables** → **+ Add**
   - **Key:** `REDIS_URL`
   - **Value:** die kopierte URL
   - **Build/Runtime:** **Runtime**
   - **Is Secret:** **ON**
   - Speichern

---

## 5. Neue App in Coolify anlegen

1. **Projects → + New Project** → z. B. `pilatesOS`
2. **+ New Resource → Application**
3. GitHub-Quelle wählen → Repository `pilatesOS`
4. Branch: `main`
5. Build-Pack: **Dockerfile**

### Build-Einstellungen

| Feld | Wert |
|---|---|
| Base Directory | `/` |
| Dockerfile Path | `./Dockerfile` |
| Build Args | (keine — alles über Env-Variablen) |
| Start Command | (leer lassen, `standalone/server.js` wird vom Dockerfile gestartet) |
| Port | `3000` |
| Healthcheck Path | `/api/health` |
| Healthcheck Port | `3000` |

---

## 6. Dockerfile sicherstellen

Das Multi-Stage-Dockerfile im Projektroot muss in etwa so aussehen:

```dockerfile
# syntax=docker.io/docker/dockerfile:1
FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

> **Hinweis:** Falls der Build mit 4 GB Heap im Container abstürzt, in Coolify mehr RAM zuweisen oder `NODE_OPTIONS="--max-old-space-size=6144"` bzw. `8192` setzen.

---

## 7. Umgebungsvariablen in Coolify

Alle Variablen unter **Environment Variables** der App eintragen. `NEXT_PUBLIC_*`-Variablen müssen als **Build-time** gesetzt werden, alles andere als **Runtime**. Sensitive Werte als **Secret** markieren.

### Wo genau?

Coolify → deine App → Tab **Environment Variables** → **+ Add**

Für jede Variable:
- **Key:** Name der Variable (z. B. `DATABASE_URL`)
- **Value:** Wert
- **Build / Runtime:**
  - `NEXT_PUBLIC_*` → **Build-time**
  - alles andere → **Runtime**
- **Is Secret:**
  - Credentials, Keys, Secrets → **ON**
  - öffentliche URLs, Booleans → **OFF**

> **Hinweis:** `DATABASE_URL` und `REDIS_URL` hast du bereits in Schritt 3 bzw. 4 eingetragen. Hier geht es nur um die restlichen Variablen.

### 7.1 Core (erforderlich für ersten Deploy)

| Variable | Beispiel / Wert | Build/Runtime | Secret |
|---|---|---|---|
| `NODE_ENV` | `production` | Runtime | Nein |
| `DATABASE_URL` | `postgresql://...` (aus Schritt 3) | Runtime | **Ja** |
| `AUTH_SECRET` | `openssl rand -base64 32` | Runtime | **Ja** |
| `AUTH_TRUST_HOST` | `true` | Runtime | Nein |
| `NEXTAUTH_URL` | `https://app.yourplatform.com` | Runtime | Nein |
| `NEXT_PUBLIC_APP_URL` | `https://app.yourplatform.com` | Build | Nein |
| `NEXT_PUBLIC_PLATFORM_DOMAIN` | `yourplatform.com` | Build | Nein |
| `DEFAULT_STUDIO_TIMEZONE` | `Europe/Berlin` | Runtime | Nein |
| `LOG_LEVEL` | `info` | Runtime | Nein |

> **Wichtig:** `AUTH_TRUST_HOST=true` ist nötig, weil Coolify einen Reverse-Proxy (Caddy/Traefik) vor den Container schaltet.

### 7.2 Auth / OAuth

| Variable | Beispiel / Wert | Beschreibung |
|---|---|---|
| `AUTH_GOOGLE_ID` | `...apps.googleusercontent.com` | Optional |
| `AUTH_GOOGLE_SECRET` | `...` | Optional |
| `ALLOW_OAUTH_AUTO_PROVISION` | `false` | `true` nur, wenn Google-Login ohne Einladung Studios anlegen darf |

### 7.3 Self-Service Signup (neu)

| Variable | Beispiel / Wert | Beschreibung |
|---|---|---|
| `ALLOW_SELF_SERVICE_SIGNUP` | `true` | Studio-Claiming über `/start` erlauben |
| `ALLOWED_SIGNUP_DOMAINS` | `yourplatform.com,gmail.com` | Optional: Einschränkung auf Email-Domains |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `...` | Optional: Cloudflare Turnstile Site-Key |
| `TURNSTILE_SECRET_KEY` | `...` | Optional: Cloudflare Turnstile Secret |

### 7.4 Email (Resend)

| Variable | Beispiel / Wert | Beschreibung |
|---|---|---|
| `RESEND_API_KEY` | `re_...` | Ohne diese Variable werden Emails nur geloggt |
| `EMAIL_FROM` | `noreply@yourplatform.com` | Absenderadresse |

### 7.5 Payments (Stripe)

| Variable | Beispiel / Wert | Beschreibung |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Optional |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Optional |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Für `/api/webhooks/stripe` |

### 7.6 Security / CORS / Rate-Limiting

| Variable | Beispiel / Wert | Beschreibung |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://app.yourplatform.com,https://yourplatform.com` | API-CORS-Origins |
| `TRUSTED_PROXY_COUNT` | `1` | Für Coolify/Caddy (Default 1) |
| `EMBED_FRAME_ANCESTORS` | `https://partner1.com https://partner2.com` | Optional: Embed-Allowlist |
| `EMBED_SCHEDULE_CORS_ORIGINS` | `https://partner1.com` | Optional: CORS für Embed API |
| `REDIS_URL` | `redis://...` (aus Schritt 4) | Für verteiltes Rate-Limiting + BullMQ |
| `CRON_SECRET` | `openssl rand -base64 32` | Für alle Cron-Jobs |
| `SETTINGS_ENCRYPTION_KEY` | `openssl rand -hex 32` | Für verschlüsselte Settings (früher `CALENDAR_TOKEN_ENCRYPTION_KEY`) |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` | Optional: Fallback für Kalender-Token |

> **Hinweis:** `SETTINGS_ENCRYPTION_KEY` wird bevorzugt; `CALENDAR_TOKEN_ENCRYPTION_KEY` ist noch als Fallback aktiv.

### 7.7 Tenant / Studio

| Variable | Beispiel / Wert | Beschreibung |
|---|---|---|
| `WAIVER_TEXT` | (mehrzeiliger Text) | Optional: Override für Haftungsausschluss |
| `TENANT_IMAGE_HOSTS` | `images.unsplash.com,cdn.partner.com` | Für `next/image` Remote Patterns |

### 7.8 Monitoring (Sentry)

| Variable | Beispiel / Wert | Beschreibung |
|---|---|---|
| `SENTRY_DSN` | `https://...` | Optional |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://...` | Optional |
| `SENTRY_AUTH_TOKEN` | `sntrys_...` | Nur wenn Sentry aktiv |
| `SENTRY_ORG` | `your-org` |  |
| `SENTRY_PROJECT` | `pilatesos` |  |

### 7.9 Optional / Phase-3-Features

| Variable | Beispiel / Wert | Beschreibung |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | `...` | Für S3-Uploads |
| `AWS_SECRET_ACCESS_KEY` | `...` |  |
| `AWS_REGION` | `eu-central-1` |  |
| `AWS_S3_BUCKET` | `pilates-os-assets` |  |
| `BUNNY_CDN_BASE_URL` | `https://cdn.yourstudio.com` | Für Video-CDN |
| `META_PIXEL_ID` | `...` | Meta CAPI |
| `META_CAPI_ACCESS_TOKEN` | `...` |  |

---

## 8. PostgreSQL 16 → 18: Auswirkungen auf pilatesOS

Laut offizieller PostgreSQL-Dokumentation ist **18.4** (Mai 2026) die aktuelle stabile Version, Support bis **14. November 2030**. PostgreSQL 19 befindet sich in der Beta.

### Wichtige Änderungen von PG 16 → 17 → 18

| Bereich | Änderung | Relevanz für pilatesOS |
|---|---|---|
| **Systemkatalog** | Umbenennung einiger `pg_collation`/`pg_database`/`pg_attribute` Spalten | **Keine** — wir nutzen keinen direkten Systemkatalog-Zugriff |
| **Monitoring-Views** | `pg_stat_bgwriter`, `pg_stat_wal`, `pg_stat_io` Spalten geändert/entfernt | **Keine** — wir lesen diese Views nicht aus |
| **`pg_stat_statements`** | Spalten umbenannt (`blk_read_time` → `shared_blk_read_time`) | **Keine** — wir nutzen pg_stat_statements nicht im Code |
| **`interval` Syntax** | `ago` nur noch am Ende erlaubt | **Keine** — wir verwenden keine komplexen interval-Literale |
| **`old_snapshot_threshold`** | Entfernt | **Keine** — nicht verwendet |
| **`db_user_namespace`** | Entfernt | **Keine** — nicht verwendet |
| **`adminpack`** | Entfernt | **Keine** — nicht verwendet |
| **JSON/SQL-JSON** | Neue Funktionen (`JSON_TABLE`, `JSON_EXISTS`, etc.) | **Optional** — wir könnten sie zukünftig nutzen, aktuell nicht nötig |
| **Performance** | Asynchrones I/O, bessere Vacuum-/Index-Performance | **Positiv** — kein Code-Change nötig |
| **Security** | OAuth 2.0-Erweiterungen, verbesserte TLS-Optionen | **Optional** — wir nutzen Auth.js, keine direkte PG-OAuth-Integration |

### Fazit

**Keine Code- oder Migrations-Änderungen in der Geschäftslogik nötig.** pilatesOS verwendet ausschließlich stabile Core-SQL-Features:

- `gen_random_uuid()` — seit PG 13 eingebaut, in PG 18 unverändert
- `pg_advisory_xact_lock(hashtextextended(...))` — `hashtextextended` seit PG 14, in PG 18 stabil
- `jsonb`, `timestamp with time zone`, `CHECK`-Constraints, `ENUMs`, `RETURNING`, `ON CONFLICT` — alles Core-SQL

### Upgrade-Empfehlung

- **Neue Deployments:** direkt PostgreSQL 18 verwenden
- **Bestehende Produktions-DBs:** vor dem Major-Upgrade immer ein Backup + Staging-Test machen; Migrationen `0000`–`0009` sind mit PG 16–18 kompatibel
- **Coolify:** falls das Template "PostgreSQL 18" noch nicht verfügbar ist, Custom Docker Image `postgres:18-alpine` verwenden

---

## 9. Migrationen ausführen

> **Wichtig:** Niemals die Dateien in `src/db/migrations/archived/` anwenden!

### 8.1 Für frische Datenbank (empfohlen)

Coolify → App → **Pre-deployment Command**:

```bash
pnpm db:migrate
```

Alternativ manuell im Coolify-Terminal:

```bash
node_modules/.bin/drizzle-kit migrate
```

Aktiver Migrationssatz (kompatibel mit PostgreSQL 16–18, explizit validiert unter PG 18 empfohlen):

- `0000_initial_schema.sql`
- `0001_add_audit_logs.sql`
- `0002_credit_purchases_granted_at.sql`
- `0003_credit_purchases_invoice_unique.sql`
- `0007_add_studios_created_by_user_id.sql`
- `0008_studio_id_not_null.sql`
- `0009_credit_expires_at.sql`

Prüfen:

```bash
cat src/db/migrations/meta/_journal.json | grep -E '"tag"|"000[0-9]'
```

Es müssen Einträge für `0000` bis `0009` vorhanden sein.

### 8.2 Für bestehende Produktions-DB

Vor `0008_studio_id_not_null.sql` prüfen:

```sql
SELECT COUNT(*) FROM users WHERE studio_id IS NULL;
SELECT COUNT(*) FROM credit_packages WHERE studio_id IS NULL;
SELECT COUNT(*) FROM purchases WHERE studio_id IS NULL;
```

Falls > 0: entweder backfillen oder Migration anpassen. **Vorher immer ein Backup machen.**

---

## 9. Cron-Jobs in Coolify einrichten

Unter **Scheduling** der App oder als separate Coolify-Cron-Jobs:

| Cron | Endpoint | Methode | Header |
|---|---|---|---|
| `0 6 * * *` | `https://app.yourplatform.com/api/cron/expiry-sweep` | POST | `Authorization: Bearer <CRON_SECRET>` |
| `0 * * * *` | `https://app.yourplatform.com/api/cron/membership-credit-grant` | POST | `Authorization: Bearer <CRON_SECRET>` |
| `*/15 * * * *` | `https://app.yourplatform.com/api/cron/welcome-journey-sweep` | POST | `Authorization: Bearer <CRON_SECRET>` |
| `*/5 * * * *` | `https://app.yourplatform.com/api/cron/calendar-sync` | POST | `Authorization: Bearer <CRON_SECRET>` |

---

## 10. Stripe Webhook konfigurieren

1. Stripe Dashboard → Webhooks
2. Endpoint URL: `https://app.yourplatform.com/api/webhooks/stripe`
3. Events: `checkout.session.completed`, `checkout.session.expired`
4. Secret als `STRIPE_WEBHOOK_SECRET` setzen

---

## 11. DNS für Multi-Tenant (SaaS-Modus)

Für SaaS mit Subdomains:

```
A     @              VPS_IP
A     *              VPS_IP
A     app            VPS_IP
```

Coolify erstellt automatisch SSL für `app.yourplatform.com`. Für Wildcard-Subdomains (`*.yourplatform.com`) ein Wildcard-Zertifikat konfigurieren.

Die Tenant-Auflösung basiert auf `NEXT_PUBLIC_PLATFORM_DOMAIN`. Wenn ein Benutzer `paquita.yourplatform.com` öffnet, wird die Subdomain `paquita` als Studio-Slug aufgelöst.

---

## 12. First-Run nach Deployment

1. `https://app.yourplatform.com/start` öffnen
2. Studio-Name, Slug, Admin-Email, Passwort eingeben
3. Email-Verifizierung abwarten (oder falls Resend nicht konfiguriert: Email in Logs prüfen)
4. `/onboarding` durchlaufen:
   - Identity
   - Branding
   - Business Model
   - Payments
   - Class Catalog
   - Review (Häkchen "Sample data" empfohlen)
5. Auf `/admin` landen
6. Admin Setup Checklist abarbeiten:
   - Instructors
   - Templates
   - Credit Packages
   - Sessions
   - Payment Providers
   - Waiver

> **Hinweis:** Rechnungen können erst generiert werden, wenn die Studio-Identity in den Admin-Settings vollständig ist (Name, Adresse, Steuernummer, Finanzamt, Bankdaten).

---

## 13. Security-Checklist nach Deploy

- [ ] VPS-Firewall (`ufw`): nur 22, 80, 443 erlauben
- [ ] SSH: Passwort-Auth deaktivieren, nur Key-Auth
- [ ] fail2ban aktivieren
- [ ] Coolify-Admin-Passwort stark + 2FA
- [ ] PostgreSQL hat **Public access = OFF**
- [ ] Redis hat **Public access = OFF**
- [ ] `AUTH_TRUST_HOST=true` gesetzt
- [ ] `ALLOWED_ORIGINS` enthält die Produktionsdomain
- [ ] `CRON_SECRET` ist ein kryptographisch sicherer Zufallswert
- [ ] `SETTINGS_ENCRYPTION_KEY` ist 32 Bytes (hex/base64) und identisch auf allen Umgebungen
- [ ] Backups in Coolify aktiviert (täglich, 14 Tage Retention)
- [ ] HSTS-Header wird ausgeliefert (`curl -I https://app.yourplatform.com | grep Strict-Transport-Security`)
- [ ] CSP-Header enthalten Nonce (`curl -I https://app.yourplatform.com | grep Content-Security-Policy`)

---

## 14. Troubleshooting

### Build bricht mit OOM ab

- In Coolify mehr RAM zuweisen
- `NODE_OPTIONS="--max-old-space-size=6144"` oder `8192`
- Alternativ: Build auf größerem Server laufen lassen und Image pushen

### Middleware-Deprecation-Warnung

- Akzeptieren für MVP; `src/middleware.ts` läuft absichtlich als Node.js-Runtime
- Langfristig auf Next.js `proxy`-Konzept migrieren

### Rechnungen können nicht generiert werden

- Studio-Identity in `/admin/settings/general` vollständig ausfüllen
- Bankdaten in `/admin/settings/payments` hinterlegen
- `InvoiceIdentityIncompleteError` verschwindet danach

### Emails kommen nicht an

- `RESEND_API_KEY` prüfen
- Resend-Domain verifiziert?
- Ohne Key werden Emails nur geloggt (Coolify → Logs)

### Tenant-Auflösung funktioniert nicht

- `NEXT_PUBLIC_PLATFORM_DOMAIN` muss Base-Domain sein (ohne `app.`)
- Wildcard-DNS korrekt?
- `ALLOWED_ORIGINS` muss die aktuelle Domain enthalten

### Migration schlägt fehl

- `_journal.json` prüfen: muss Einträge für `0000`–`0009` haben
- Nie `archived/` anwenden
- Bei bestehender DB vor `0008` auf NULL-Werte prüfen
- PostgreSQL-Version prüfen: pilatesOS läuft mit PG 16–18, empfohlen wird PG 18 — vor dem Upgrade einer bestehenden Prod-DB ein Backup + Staging-Test machen

### Rate-Limiting blockiert alle

- `TRUSTED_PROXY_COUNT` anpassen:
  - Direkt: `0`
  - Coolify/Caddy: `1`
  - Cloudflare → Coolify: `2`

---

## 15. Wichtige Dateien für Referenz

| Datei | Zweck |
|---|---|
| `src/middleware.ts` | Auth-/Locale-/Tenant-Middleware (Node.js-Runtime) |
| `src/lib/security/security-headers.ts` | CSP + CORS + Security-Header |
| `src/lib/security/embed-headers.ts` | frame-ancestors für `/embed` |
| `src/app/api/health/route.ts` | Coolify-Healthcheck |
| `src/db/index.ts` | PostgreSQL-Pool mit Timeouts |
| `src/modules/onboarding/actions/claimStudio.actions.ts` | Self-Service-Signup |
| `src/modules/users/actions/deleteAccount.action.ts` | GDPR-Löschung |
| `src/modules/billing/services/invoiceNumber.service.ts` | Concurrency-sichere Rechnungsnummern |
| `src/lib/invoice/invoice.generator.tsx` | Multi-tenant PDF-Rechnungen |
| `src/db/migrations/meta/_journal.json` | Migrations-Status |

---

**Zusammenfassung:** pilatesOS ist technisch bereit für Coolify. Die kritischen Blocker (SaaS-Onboarding, Tenant-Isolation, Credit-Expiry, GDPR, Rechnungswesen, Security) sind geschlossen. Das Hauptaugenmerk beim Deployment liegt auf **ausreichend RAM für den Build** und der korrekten Konfiguration der neuen Self-Service-/Security-Variablen.
