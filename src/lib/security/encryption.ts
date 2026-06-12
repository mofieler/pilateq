/**
 * Generic AES-256-GCM encryption for sensitive data at rest.
 *
 * Used for:
 * - Studio payment provider credentials
 * - External API keys stored in studio_settings.encrypted_credentials
 * - Other secrets that must not be stored in plaintext
 *
 * Ciphertext format: base64(iv:authTag:ciphertext)
 *
 * Key rotation: changing SETTINGS_ENCRYPTION_KEY renders existing ciphertext
 * undecryptable. Store the key in your secret manager and back it up.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY ?? process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'SETTINGS_ENCRYPTION_KEY (or fallback CALENDAR_TOKEN_ENCRYPTION_KEY) env var is missing. ' +
        'Generate one with: openssl rand -base64 32',
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `SETTINGS_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). ` +
        'Regenerate with: openssl rand -base64 32',
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted secret blob');
  }
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
  }
  if (tag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${tag.length}`);
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plaintext.toString('utf8');
}

/**
 * Encrypt all string values in a credentials record.
 */
export function encryptCredentials(credentials: Record<string, string>): Record<string, string> {
  const encrypted: Record<string, string> = {};
  for (const [key, value] of Object.entries(credentials)) {
    encrypted[key] = encryptSecret(value);
  }
  return encrypted;
}

/**
 * Decrypt all string values in a credentials record.
 */
export function decryptCredentials(credentials: Record<string, string>): Record<string, string> {
  const decrypted: Record<string, string> = {};
  for (const [key, value] of Object.entries(credentials)) {
    decrypted[key] = decryptSecret(value);
  }
  return decrypted;
}
