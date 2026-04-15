// Rate limiter - uses in-memory for now, Redis can be added later
// For production with Redis, set REDIS_URL env var

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const memoryRateLimits = new Map<
  string,
  { count: number; resetTime: number }
>();

export const rateLimitConfigs: Record<string, RateLimitConfig> = {
  sms: { windowMs: 60 * 1000, maxRequests: 50 },
  payment: { windowMs: 60 * 1000, maxRequests: 10 },
  api: { windowMs: 60 * 1000, maxRequests: 100 },
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
};

export function checkRateLimit(
  identifier: string,
  type: keyof typeof rateLimitConfigs = "api",
): { allowed: boolean; remaining: number; resetIn: number } {
  const config = rateLimitConfigs[type];
  const key = `${type}:${identifier}`;
  const now = Date.now();

  let record = memoryRateLimits.get(key);

  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + config.windowMs };
    memoryRateLimits.set(key, record);
  }

  const remaining = Math.max(0, config.maxRequests - record.count);
  const allowed = record.count < config.maxRequests;

  if (allowed) {
    record.count++;
  }

  return {
    allowed,
    remaining,
    resetIn: Math.max(0, record.resetTime - now),
  };
}

export function getRateLimitHeaders(
  type: keyof typeof rateLimitConfigs = "api",
  identifier: string,
) {
  const { remaining, resetIn } = checkRateLimit(identifier, type);
  return {
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset-In": Math.ceil(resetIn / 1000).toString(),
  };
}

setInterval(
  () => {
    const now = Date.now();
    memoryRateLimits.forEach((value, key) => {
      if (now > value.resetTime) {
        memoryRateLimits.delete(key);
      }
    });
  },
  5 * 60 * 1000,
);
