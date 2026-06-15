<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:superadmin-studio-invite-conventions -->
# Superadmin & Studio Invite Conventions

## Creating the first superadmin

There is no in-app UI for bootstrapping a superadmin. Use the one-off CLI script:

```bash
npx tsx scripts/create-superadmin.ts <email> "Full Name"
```

- Requires `DATABASE_URL` to be set (the script reads `.env.production`).
- Creates the platform studio (`slug = "platform"`) if it does not exist.
- Prints the generated password once; store it securely.

## `/start` access control

`/start` is the studio-claiming page for new studio owners.

- It is publicly reachable (`PUBLIC_PREFIXES` in `src/middleware.ts`).
- It is **invite-only by default**.
- Self-service signup can be enabled by setting:
  ```
  ALLOW_SELF_SERVICE_SIGNUP=true
  ```
- When self-service is enabled, you can restrict eligible emails by domain:
  ```
  ALLOWED_SIGNUP_DOMAINS=example.com,another.com
  ```
- An invite token (`?invite=<token>`) bypasses the self-service/domain checks.

## Superadmin pages

- All superadmin pages live under `/superadmin/*`.
- They require an authenticated user whose `user.role === 'superadmin'`.
- `src/middleware.ts` blocks non-superadmins with `AccessDenied`.

## Invite token handling

- Raw tokens are 64-character hex strings (32 random bytes).
- Only the **SHA-256 hash** of the token is stored at rest (`src/lib/superadmin/invite-tokens.ts`).
- Tokens are single-use and expire after 7 days.
- Invites can optionally be bound to an email address and/or a reserved studio slug.
- If either binding is set, the claim attempt must match exactly.
<!-- END:superadmin-studio-invite-conventions -->
