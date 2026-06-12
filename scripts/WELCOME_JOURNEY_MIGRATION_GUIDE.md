# Welcome Journey — Production DB Migration Guide

## What Changed

| Change | Already Migrated? | Action Needed |
|--------|-------------------|---------------|
| `users.welcome_completed_at` | ✅ Yes (0018_production_schema_sync.sql) | Decide what to do with existing users |
| `class_templates.is_welcome_journey` | ✅ Yes (0018_production_schema_sync.sql) | Nothing — existing classes default to `false` |
| `welcome_journey_requests` table | ❌ NO | **Create it now** |
| `welcome_request_status` enum | N/A | Using `varchar(20)` instead — no enum needed |

## ⚠️ CRITICAL DECISION: Existing Users

The `welcome_completed_at` column is `NULL` for **every existing user**. The app treats `NULL` = **unwelcomed** = locked out of normal booking & membership purchases.

### Choose ONE option before running the migration:

| Studio State | Recommended Option | Why |
|--------------|-------------------|-----|
| **Live studio** with existing students | **Option A** — mark ALL existing users welcomed | They already know the studio; forcing them into Welcome Journey breaks their experience |
| **Live studio**, want to be strict | **Option B** — mark only past attendees as welcomed | Users who never attended still need intro; users who attended are unlocked |
| **Brand new** system, zero real students | **Option C** — leave as-is | New signups will naturally flow through Welcome Journey |

## Step-by-Step VPS Commands

### 1. SSH into your VPS and open psql

```bash
ssh root@YOUR_VPS_IP
su - postgres
psql -d your_db_name
```

### 2. Run the migration

```sql
\i /path/to/pilatesOS/scripts/migrate-welcome-journey.sql
```

Or copy-paste the contents of `migrate-welcome-journey.sql` directly.

**Important:** After running the migration, go back and **uncomment your chosen Option (A, B, or C)** and run that `UPDATE` statement.

### 3. Run verification

```sql
\i /path/to/pilatesOS/scripts/verify-welcome-journey.sql
```

Read every section's "Expected" output. If any section shows red flags, fix before continuing.

### 4. Post-migration setup (manual)

After the DB is migrated, you **must** do these in the admin panel or DB:

1. **Create a Welcome Journey credit package** if it doesn't exist:
   - Name: exactly `Welcome Journey`
   - Category: `session`
   - Credits: `1`
   - Price: whatever you charge for the intro session
   - Must be `is_active = true`

2. **Create at least 1 Welcome Journey class template**:
   - Any name (e.g., "Welcome Session", "Intro 1:1")
   - Check **"Is Welcome Journey"** toggle
   - Credit type: `private_session`
   - Duration / capacity / cost as appropriate

3. **Schedule future sessions** from that template:
   - Without scheduled sessions, admin has nothing to offer unwelcomed users

### 5. Quick smoke test

```sql
-- Should return 1 row:
SELECT * FROM "credit_packages" WHERE "name" = 'Welcome Journey';

-- Should return >= 1 row:
SELECT * FROM "class_templates" WHERE "is_welcome_journey" = true AND "is_active" = true;

-- Should return >= 1 row:
SELECT * FROM "class_sessions" cs
JOIN "class_templates" ct ON cs."template_id" = ct."id"
WHERE ct."is_welcome_journey" = true AND cs."starts_at" > NOW() AND cs."status" = 'scheduled';
```

## If Something Goes Wrong

**Rollback the new table only** (columns from 0018 cannot be rolled back without full DB restore):

```sql
DROP TABLE IF EXISTS "welcome_journey_requests" CASCADE;
```

To temporarily disable Welcome Journey gating for all users:

```sql
UPDATE "users" SET "welcome_completed_at" = NOW() WHERE "welcome_completed_at" IS NULL;
```

## Verification Checklist

- [ ] `welcome_journey_requests` table exists with correct columns
- [ ] Indexes `welcome_requests_user_id_idx` and `welcome_requests_status_idx` exist
- [ ] All existing users have appropriate `welcome_completed_at` value
- [ ] `Welcome Journey` credit package exists with `category = 'session'`
- [ ] At least 1 active class template has `is_welcome_journey = true`
- [ ] At least 1 future scheduled session exists for that template
- [ ] No unwelcomed user has existing non-welcome bookings (V13)
