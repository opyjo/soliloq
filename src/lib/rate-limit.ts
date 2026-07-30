type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, RateLimitBucket>();
const WINDOW_MS = 60_000;
const REQUEST_LIMIT = 10;
const MAX_BUCKETS = 10_000;

export function consumeRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + WINDOW_MS }
      : existing;

  bucket.count += 1;
  buckets.set(key, bucket);

  if (buckets.size > MAX_BUCKETS) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
    while (buckets.size > MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (typeof oldestKey !== "string") break;
      buckets.delete(oldestKey);
    }
  }

  return {
    allowed: bucket.count <= REQUEST_LIMIT,
    limit: REQUEST_LIMIT,
    remaining: Math.max(0, REQUEST_LIMIT - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}
