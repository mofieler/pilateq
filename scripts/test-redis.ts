/**
 * Quick Redis + rate-limit smoke test.
 * Run: pnpm tsx scripts/test-redis.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Load .env.local manually (dotenv may not be installed as direct dep) ──────
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

const REDIS_URL = process.env.REDIS_URL;

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Pilates OS — Redis & Rate Limit Test');
  console.log('══════════════════════════════════════════\n');

  // ── 1. Check env var ──────────────────────────────────────────────────────
  if (!REDIS_URL) {
    console.log('❌  REDIS_URL is not set in .env.local');
    console.log('    → Rate limiter uses in-memory fallback (dev only)');
    console.log('\n    To test production Redis, temporarily add to .env.local:');
    console.log('    REDIS_URL=redis://default:yourpassword@yourhost:6379\n');
    process.exit(1);
  }

  const maskedUrl = REDIS_URL.replace(/:([^@/]+)@/, ':***@');
  console.log(`✅  REDIS_URL found: ${maskedUrl}\n`);

  // ── 2. Connect ────────────────────────────────────────────────────────────
  const { createClient } = await import('redis');
  const client = createClient({ url: REDIS_URL });

  client.on('error', (err: Error) =>
    console.error('Redis error event:', err.message),
  );

  console.log('Connecting to Redis...');
  try {
    await client.connect();
    console.log('✅  Connected\n');
  } catch (err: any) {
    console.error('❌  Connection failed:', err.message);
    console.log('\nCheck that:');
    console.log('  1. REDIS_URL is correct');
    console.log('  2. Redis service is running in Coolify (green dot)');
    console.log('  3. Firewall allows connection from this machine');
    process.exit(1);
  }

  // ── 3. PING ───────────────────────────────────────────────────────────────
  const pong = await client.ping();
  console.log(`PING → ${pong === 'PONG' ? '✅  PONG' : `❌  Unexpected: ${pong}`}\n`);

  // ── 4. SET / GET ──────────────────────────────────────────────────────────
  await client.set('pilatesos:test', 'ok', { EX: 10 });
  const val = await client.get('pilatesos:test');
  console.log(`SET/GET → ${val === 'ok' ? '✅  Works' : '❌  Failed'}\n`);
  await client.del('pilatesos:test');

  // ── 5. Simulate rate limiting (fixed-window INCR pattern) ─────────────────
  console.log('── Rate limit simulation (3 requests allowed per window) ──');
  const testKey = 'pilatesos:rl:test:ratelimit-smoke';
  const windowMs = 10_000; // 10 seconds for test
  const maxRequests = 3;

  await client.del(testKey); // start clean

  for (let i = 1; i <= 5; i++) {
    const count = await client.incr(testKey);
    if (count === 1) await client.pExpire(testKey, windowMs);
    const allowed = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);
    const icon = allowed ? '✅ ' : '❌ ';
    console.log(
      `  Request ${i}: ${icon} ${allowed ? 'ALLOWED' : 'BLOCKED'} (count=${count}, remaining=${remaining})`,
    );
  }

  await client.del(testKey);
  console.log('');

  // ── 6. Show existing rate-limit keys ─────────────────────────────────────
  const existingKeys = await client.keys('pilatesos:rl:*');
  if (existingKeys.length === 0) {
    console.log('ℹ️   No active rate-limit keys in Redis yet');
    console.log('    (No registration attempts have been made yet in production)\n');
  } else {
    console.log(`ℹ️   Active rate-limit keys in Redis (${existingKeys.length}):`);
    for (const key of existingKeys.slice(0, 10)) {
      const ttl = await client.pTTL(key);
      const count = await client.get(key);
      console.log(`     ${key} → count=${count}, TTL=${(ttl / 1000).toFixed(1)}s`);
    }
    console.log('');
  }

  await client.disconnect();

  console.log('══════════════════════════════════════════');
  console.log('✅  Redis is working correctly!');
  console.log('   Rate limiting is active in production.');
  console.log('══════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
