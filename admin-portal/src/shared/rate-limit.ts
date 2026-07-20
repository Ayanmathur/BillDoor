/**
 * BillDoor — Rate Limiting
 * 
 * SECURITY: All auth endpoints, public endpoints, and 
 * computationally expensive Server Actions MUST be rate-limited.
 * 
 * Uses in-memory sliding window for MVP (no Redis dependency).
 * Upgrade to Upstash Redis when scaling beyond single instance.
 * 
 * Extract true client IP from x-forwarded-for header
 * (Server Actions don't expose raw request object).
 */

// ============================================================
// Sliding window rate limiter (in-memory)
// ============================================================
interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes to prevent memory leak
const CLEANUP_INTERVAL = 5 * 60 * 1000;

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      // Remove entries with no recent timestamps
      entry.timestamps = entry.timestamps.filter((t) => now - t < 600_000);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
}

export interface RateLimitConfig {
  /** Unique prefix for this limiter (e.g. 'auth:login', 'review:submit') */
  prefix: string;
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Seconds until the window resets */
  resetInSeconds: number;
}

/**
 * Check rate limit for a given identifier (IP or user ID).
 * 
 * @param config - Rate limit configuration
 * @param identifier - IP address or user ID
 * @returns Whether the request is allowed
 */
export function checkRateLimit(
  config: RateLimitConfig,
  identifier: string
): RateLimitResult {
  const key = `${config.prefix}:${identifier}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const windowStart = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const resetInSeconds = Math.ceil((oldestInWindow + windowMs - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetInSeconds: Math.max(resetInSeconds, 1),
    };
  }

  // Allow the request
  entry.timestamps.push(now);
  return {
    success: true,
    remaining: config.maxRequests - entry.timestamps.length,
    resetInSeconds: Math.ceil(windowMs / 1000),
  };
}

// ============================================================
// Pre-defined rate limit configs for each endpoint type
// ============================================================

/** Auth endpoints: strict limits (§2 password reset, login) */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  prefix: 'auth',
  maxRequests: 5,
  windowSeconds: 60, // 5 attempts per minute
};

/** Password reset: very strict (§2 — rate-limit both paths) */
export const PASSWORD_RESET_RATE_LIMIT: RateLimitConfig = {
  prefix: 'auth:reset',
  maxRequests: 3,
  windowSeconds: 300, // 3 attempts per 5 minutes
};

/** License key activation: moderate */
export const ACTIVATION_RATE_LIMIT: RateLimitConfig = {
  prefix: 'auth:activate',
  maxRequests: 5,
  windowSeconds: 300, // 5 attempts per 5 minutes
};

/** Public review submission: prevent spam */
export const REVIEW_RATE_LIMIT: RateLimitConfig = {
  prefix: 'review:submit',
  maxRequests: 10,
  windowSeconds: 60, // 10 reviews per minute per IP
};

/** AI review generation: prevent cost abuse (§4 — cap regenerations) */
export const AI_GENERATION_RATE_LIMIT: RateLimitConfig = {
  prefix: 'ai:generate',
  maxRequests: 5,
  windowSeconds: 300, // 5 generations per 5 minutes
};

/** Bill creation: moderate */
export const BILL_RATE_LIMIT: RateLimitConfig = {
  prefix: 'bill:create',
  maxRequests: 30,
  windowSeconds: 60, // 30 bills per minute
};

/** General API: catch-all */
export const API_RATE_LIMIT: RateLimitConfig = {
  prefix: 'api',
  maxRequests: 100,
  windowSeconds: 60, // 100 requests per minute
};

// ============================================================
// IP extraction utility
// 
// Server Actions don't expose the raw request object.
// Extract true client IP from x-forwarded-for header.
// ============================================================

/**
 * Extract client IP from Next.js headers.
 * Must be called inside a Server Action or Route Handler.
 * 
 * @param headersFn - The headers() function from next/headers
 * @returns Client IP address or 'unknown'
 */
export async function getClientIp(
  headersFn: () => Promise<Headers>
): Promise<string> {
  const headers = await headersFn();
  
  // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2"
  // The first one is the real client IP
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  // Fallback headers
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}

/**
 * Extract User-Agent string from Next.js headers.
 * Must be called inside a Server Action or Route Handler.
 * 
 * @param headersFn - The headers() function from next/headers
 * @returns User-Agent string or 'unknown'
 */
export async function getUserAgent(
  headersFn: () => Promise<Headers>
): Promise<string> {
  const headers = await headersFn();
  return headers.get('user-agent') || 'unknown';
}

// ============================================================
// Response helpers for rate-limited endpoints
// ============================================================

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetInSeconds),
    'Retry-After': result.success ? '' : String(result.resetInSeconds),
  };
}
