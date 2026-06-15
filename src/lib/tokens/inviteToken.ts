import crypto from 'crypto';

const TOKEN_BYTES = 32;

export interface InviteTokenResult {
  token: string;
  tokenHash: string;
}

/**
 * Generate a cryptographically-random studio invite token and its SHA-256 hash.
 *
 * The plaintext token is returned to the caller exactly once (for the email
 * link). Only the hash is persisted so a DB leak cannot reveal usable tokens.
 */
export function generateInviteToken(): InviteTokenResult {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashInviteToken(token);
  return { token, tokenHash };
}

/**
 * Hash a plaintext invite token for lookup in the database.
 */
export function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
