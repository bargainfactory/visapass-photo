/**
 * Lightweight in-memory rate limiter for the API routes.
 *
 * IMPORTANT — serverless caveat: on Vercel each function instance has its own
 * memory, so this throttles a burst that hits a single WARM instance but is not
 * a globally-consistent limit. It's meaningfully better than nothing (stops a
 * single client hammering a warm lambda, protects the Stripe API quota under
 * ordinary abuse) but for a hard, distributed guarantee swap `hit()` for a
 * shared store — Upstash Ratelimit or Vercel KV:
 *
 *   import { Ratelimit } from '@upstash/ratelimit';
 *   import { Redis } from '@upstash/redis';
 *   const rl = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(15, '1 m') });
 *   const { success } = await rl.limit(key);
 *
 * The route call sites stay identical — only this module changes.
 */
interface Bucket {
  count: number;
  reset: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000; // backstop against unbounded growth

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (0 when allowed). */
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Opportunistic prune of expired buckets when the map gets large.
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) if (now >= b.reset) buckets.delete(k);
  }

  const b = buckets.get(key);
  if (!b || now >= b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
  }
  b.count++;
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client IP from the standard proxy headers (Vercel sets these). */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  );
}
