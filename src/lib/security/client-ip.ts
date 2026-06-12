/**
 * Resolve the real client IP from forwarded headers without trusting them blindly.
 *
 * Why this exists: code that calls `headers.get('x-forwarded-for').split(',')[0]`
 * is trivially spoofable — an attacker just sends `X-Forwarded-For: 1.1.1.1`
 * and every IP-keyed bucket (rate limit, audit log) thinks the request came
 * from a different fake IP per request. That defeats the limiter entirely.
 *
 * How XFF actually works: each proxy in the chain APPENDS the peer IP it saw
 * to the header. So with one trusted reverse proxy in front of the app, the
 * rightmost entry is the IP that proxy saw as its peer — i.e. the real client
 * (or, if there are more upstream proxies we trust, the N-th from the right).
 * Earlier entries are attacker-controlled and must be discarded.
 *
 * Configuration:
 *   TRUSTED_PROXY_COUNT — number of trusted reverse proxy hops in front of the
 *   app. Default 1 so container deployments behind a single reverse proxy
 *   (Coolify/Caddy/Traefik) work out of the box.
 *     0: do not trust XFF at all. Use x-real-ip if present, otherwise a fixed
 *        bucket so the limiter still has SOMETHING to key on.
 *     1: typical Coolify/Caddy deploy — one proxy hop. Take the last XFF entry.
 *     N: take the entry at position `length - N` from the XFF list.
 */

const TRUSTED_BUCKET = 'untrusted';

function parseHopCount(): number {
  const raw = process.env.TRUSTED_PROXY_COUNT;
  // Default 1: Coolify/Caddy typically adds one trusted proxy hop in front of the app.
  // Override via TRUSTED_PROXY_COUNT when running without a reverse proxy (set to 0)
  // or behind additional proxies (set to the actual hop count).
  if (!raw) return 1;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

function readXffEntry(forwarded: string | null, hopCount: number): string | null {
  if (!forwarded || hopCount < 1) return null;
  const entries = forwarded
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (entries.length === 0) return null;
  // Take the entry the most-trusted proxy actually observed as its peer.
  // hopCount=1 → last entry; hopCount=2 → second-to-last; etc.
  const idx = entries.length - hopCount;
  return entries[idx] ?? null;
}

type HeaderLike = { get(name: string): string | null };

export function resolveClientIP(headers: HeaderLike): string {
  const hopCount = parseHopCount();
  const xffIp = readXffEntry(headers.get('x-forwarded-for'), hopCount);
  if (xffIp) return xffIp;

  // x-real-ip is set by Caddy/Nginx/Coolify from the actual connection peer
  // and is not appended by the client. Trust it only if we have at least one
  // trusted proxy hop configured (otherwise the request hit Next.js directly
  // and the header is whatever the client wrote).
  if (hopCount >= 1) {
    const realIp = headers.get('x-real-ip');
    if (realIp) return realIp;
  }

  return TRUSTED_BUCKET;
}
