import type { NextRequest } from 'next/server';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 100,
};

const STRICT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 20,
};

const rateLimitStore = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

function getClientIdentifier(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
  return ip;
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(
  req: NextRequest,
  config: RateLimitConfig = DEFAULT_CONFIG,
): RateLimitResult {
  cleanupExpiredEntries();
  
  const clientId = getClientIdentifier(req);
  const pathname = new URL(req.url).pathname;
  const key = `${clientId}:${pathname}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetAt <= now) {
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: entry.resetAt,
    };
  }
  
  entry.count += 1;
  const allowed = entry.count <= config.maxRequests;
  
  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

export function checkStrictRateLimit(req: NextRequest): RateLimitResult {
  return checkRateLimit(req, STRICT_CONFIG);
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}
