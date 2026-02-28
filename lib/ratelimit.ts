import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate Limiting Service
 * Prevents abuse by limiting requests per time window
 * 
 * Setup:
 * 1. Create free account at https://upstash.com
 * 2. Create Redis database
 * 3. Add to .env:
 *    UPSTASH_REDIS_REST_URL=https://...
 *    UPSTASH_REDIS_REST_TOKEN=...
 */

// Check if Upstash is configured
const isConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL && 
  process.env.UPSTASH_REDIS_REST_TOKEN
);

// Create Redis client (or null if not configured)
const redis = isConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

/**
 * In-memory fallback for development (when Upstash not configured)
 * WARNING: This is NOT production-safe! Use Upstash in production.
 */
class InMemoryRateLimiter {
  private requests: Map<string, number[]> = new Map();

  async limit(identifier: string, maxRequests: number, windowMs: number) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get existing requests for this identifier
    const existing = this.requests.get(identifier) || [];
    
    // Filter out old requests outside the window
    const recentRequests = existing.filter(time => time > windowStart);
    
    // Check if limit exceeded
    if (recentRequests.length >= maxRequests) {
      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        reset: Math.min(...recentRequests) + windowMs,
      };
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    
    // Cleanup old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanup(windowStart);
    }
    
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - recentRequests.length,
      reset: now + windowMs,
    };
  }

  private cleanup(before: number) {
    for (const [key, times] of this.requests.entries()) {
      const recent = times.filter(t => t > before);
      if (recent.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recent);
      }
    }
  }
}

const inMemoryLimiter = new InMemoryRateLimiter();

/**
 * Create rate limiter with fallback
 */
function createRateLimiter(requests: number, window: string) {
  if (!redis) {
    console.warn('⚠️  Upstash Redis not configured. Using in-memory rate limiting (NOT production-safe!)');
    console.warn('   Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env');
    
    // Return in-memory limiter
    const windowMs = parseWindow(window);
    return {
      limit: async (identifier: string) => {
        return inMemoryLimiter.limit(identifier, requests, windowMs);
      }
    };
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window as any),
    analytics: true,
  });
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)\s*([smhd])$/);
  if (!match) return 60000; // default 1 minute
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 60000;
  }
}

/**
 * Booking Creation Rate Limit
 * Prevents spam booking creation
 * 10 bookings per minute per instructor
 */
export const bookingRateLimit = createRateLimiter(10, '1 m');

/**
 * Financial Booking Actions Rate Limit
 * For check-in, check-out, cancel, reschedule
 * 10 actions per minute per instructor (prevents automation abuse)
 */
export const bookingActionRateLimit = createRateLimiter(10, '1 m');

/**
 * Webhook Rate Limit
 * Prevents webhook spam and replay attacks
 * 100 webhook requests per minute per IP
 */
export const webhookRateLimit = createRateLimiter(100, '1 m');

/**
 * Bulk Booking Rate Limit
 * More restrictive for bulk operations
 * 5 bulk requests per minute per client
 */
export const bulkBookingRateLimit = createRateLimiter(5, '1 m');

/**
 * Payout Processing Rate Limit
 * Very restrictive for financial operations
 * 5 payout operations per minute per admin
 */
export const payoutRateLimit = createRateLimiter(5, '1 m');

/**
 * Bulk Payout Rate Limit
 * Extremely restrictive for bulk payouts
 * 2 bulk payout operations per minute (platform-wide)
 */
export const bulkPayoutRateLimit = createRateLimiter(2, '1 m');

/**
 * Wallet Operations Rate Limit
 * Prevents wallet manipulation
 * 20 wallet operations per minute per user
 */
export const walletRateLimit = createRateLimiter(20, '1 m');

/**
 * Admin Action Rate Limit
 * General admin actions (approve, reject, suspend)
 * 30 actions per minute per admin
 */
export const adminActionRateLimit = createRateLimiter(30, '1 m');

/**
 * API General Rate Limit
 * General API protection
 * 100 requests per minute per user
 */
export const apiRateLimit = createRateLimiter(100, '1 m');

/**
 * Authentication Rate Limit
 * Prevents brute force attacks
 * 5 login attempts per 15 minutes per IP
 */
export const authRateLimit = createRateLimiter(5, '15 m');

/**
 * Helper to check rate limit and return appropriate response
 * FAIL OPEN: Allow request if rate limiter fails (for non-critical endpoints)
 */
export async function checkRateLimit(
  limiter: any,
  identifier: string
): Promise<{ success: boolean; error?: string; headers?: Record<string, string> }> {
  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    
    const headers = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(reset).toISOString(),
    };
    
    if (!success) {
      const resetDate = new Date(reset);
      const waitSeconds = Math.ceil((resetDate.getTime() - Date.now()) / 1000);
      
      return {
        success: false,
        error: `Rate limit exceeded. Please wait ${waitSeconds} seconds before trying again.`,
        headers,
      };
    }
    
    return { success: true, headers };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // FAIL OPEN - allow the request (for non-critical endpoints)
    console.warn('⚠️  Rate limiter failed, allowing request (fail-open mode)');
    return { success: true };
  }
}

/**
 * STRICT rate limit check - FAIL CLOSED
 * Use for financial and critical operations
 * If rate limiter fails, REJECT the request for safety
 */
export async function checkRateLimitStrict(
  limiter: any,
  identifier: string
): Promise<{ success: boolean; error?: string; headers?: Record<string, string> }> {
  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    
    const headers = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(reset).toISOString(),
    };
    
    if (!success) {
      const resetDate = new Date(reset);
      const waitSeconds = Math.ceil((resetDate.getTime() - Date.now()) / 1000);
      
      return {
        success: false,
        error: `Rate limit exceeded. Please wait ${waitSeconds} seconds before trying again.`,
        headers,
      };
    }
    
    return { success: true, headers };
  } catch (error) {
    console.error('Rate limit check error (strict mode):', error);
    // FAIL CLOSED - reject the request for safety
    console.error('🚨 Rate limiter failed in strict mode, REJECTING request for safety');
    return {
      success: false,
      error: 'Rate limiting service unavailable. Request rejected for safety. Please try again later.',
    };
  }
}

/**
 * Get identifier for rate limiting
 * Uses user ID if available, falls back to IP address
 */
export function getRateLimitIdentifier(
  userId?: string,
  ipAddress?: string | null,
  prefix?: string
): string {
  const id = userId || ipAddress || 'anonymous';
  return prefix ? `${prefix}:${id}` : id;
}
