/**
 * In-process sliding-window rate limiter.
 *
 * Written by hand rather than adding `express-rate-limit` so the hardening does
 * not introduce a runtime dependency. It is applied per procedure in
 * `_core/trpc.ts`, because the public storefront and the admin panel share one
 * `/api/trpc` mount and must not share one budget.
 *
 * Scope caveat: state lives in this process only. Behind more than one instance
 * each replica enforces its own budget, so the effective limit multiplies by the
 * replica count. Move the store to Redis before scaling horizontally.
 */

export type RateLimitDecision = {
  allowed: boolean;
  /** Calls still available in the current window. */
  remaining: number;
  /** Milliseconds until the oldest recorded hit falls out of the window. */
  retryAfterMs: number;
};

export type RateLimiter = {
  check(key: string, now?: number): RateLimitDecision;
  reset(): void;
  /** Tracked key count. Exposed for tests and diagnostics. */
  size(): number;
};

export type RateLimiterOptions = {
  limit: number;
  windowMs: number;
  /**
   * Upper bound on tracked keys. Keys are client-controlled (IP addresses), so
   * an unbounded map would be a memory-exhaustion vector.
   */
  maxKeys?: number;
};

const DEFAULT_MAX_KEYS = 10_000;

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMs, maxKeys = DEFAULT_MAX_KEYS } = options;
  if (limit < 1) throw new Error("Rate limit must allow at least one call");
  if (windowMs < 1) throw new Error("Rate limit window must be positive");

  const hits = new Map<string, number[]>();

  function prune(now: number) {
    const cutoff = now - windowMs;
    // Array.from over .entries() rather than for..of: the project compiles
    // without downlevelIteration, so Map iterators are not directly iterable.
    Array.from(hits.entries()).forEach(([key, timestamps]) => {
      const live = timestamps.filter(timestamp => timestamp > cutoff);
      if (live.length === 0) hits.delete(key);
      else hits.set(key, live);
    });
  }

  function evictOldest() {
    // Cheapest bounded strategy: drop the keys whose most recent hit is oldest.
    const ranked = Array.from(hits.entries())
      .map(([key, timestamps]) => [key, timestamps[timestamps.length - 1] ?? 0] as const)
      .sort((left, right) => left[1] - right[1]);
    ranked.forEach(([key]) => {
      if (hits.size <= maxKeys) return;
      hits.delete(key);
    });
  }

  return {
    check(key, now = Date.now()) {
      const cutoff = now - windowMs;
      const live = (hits.get(key) ?? []).filter(timestamp => timestamp > cutoff);

      if (live.length >= limit) {
        // Rejected calls are not recorded: counting them would keep extending
        // the window forever while an attacker keeps hammering the endpoint.
        hits.set(key, live);
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(1, live[0] + windowMs - now),
        };
      }

      live.push(now);
      hits.set(key, live);

      if (hits.size > maxKeys) {
        prune(now);
        if (hits.size > maxKeys) evictOldest();
      }

      return { allowed: true, remaining: limit - live.length, retryAfterMs: 0 };
    },
    reset() {
      hits.clear();
    },
    size() {
      return hits.size;
    },
  };
}

/**
 * Budgets per client per procedure. Deliberately generous for ordinary shoppers
 * and tight for the endpoints an attacker would grind:
 *
 * - `login`  — the per-account lockout in adminAuth.ts already exists, but it is
 *   per account, so rotating usernames could lock every admin out. This caps the
 *   attempts one address can make at all.
 * - `track`  — order numbers embed a millisecond timestamp, so they are
 *   enumerable; this makes sweeping the space impractical.
 * - `review` — each accepted call can push a 4 MB image into object storage.
 */
export const RATE_LIMITS = {
  adminLogin: { limit: 10, windowMs: 10 * 60 * 1000 },
  // The bootstrap secret is guessable in principle, and the claim window only
  // ever needs a handful of attempts, so it gets a far tighter budget.
  adminSetup: { limit: 5, windowMs: 60 * 60 * 1000 },
  orderCreate: { limit: 12, windowMs: 60 * 60 * 1000 },
  orderTrack: { limit: 20, windowMs: 10 * 60 * 1000 },
  reviewSubmit: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const;

export function formatRetryAfter(retryAfterMs: number) {
  const minutes = Math.ceil(retryAfterMs / 60_000);
  return minutes <= 1 ? "دقيقة واحدة" : `${minutes} دقائق`;
}
