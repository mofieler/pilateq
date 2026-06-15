import crypto from 'crypto';

const TOKEN_BYTES = 32;

/**
 * Generate a cryptographically secure invite token and its SHA-256 hash.
 * The raw token is returned to be placed in the invite URL/email.
 * Only the hash should ever be persisted in the database.
 */
export function generateStudioInviteToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const hash = hashInviteToken(raw);
  return { raw, hash };
}

/**
 * Hash a raw invite token for database lookups.
 *
 * Security note: We intentionally use plain SHA-256 here rather than a keyed
 * HMAC. The tokens are 32 bytes of cryptographically secure random data
 * (256 bits of entropy), so they are unguessable by construction. SHA-256 is
 * a one-way, collision-resistant hash that is sufficient for looking up such
 * high-entropy secrets. Adding an HMAC with `INVITE_TOKEN_SECRET` would not
 * materially increase security for random tokens, but it would introduce an
 * operational risk: if the secret is ever missing or rotated, every existing
 * pending invite would fail validation because its stored hash would no
 * longer match. For these reasons we keep the implementation simple and
 * secret-independent.
 */
export function hashInviteToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
