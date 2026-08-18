/**
 * Rate Limiting Middleware for High-Risk Admin Routes
 * 
 * Uses Upstash Redis for distributed rate limiting across serverless functions.
 * Falls back to in-memory rate limiting in development or when Redis is unavailable.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

// ── Configuration ─────────────────────────────────────────────────────────────

const RATE_LIMITS = {
  // Financial operations
  PAYOUT_PROCESSING: { requests: 10, window: '1 h' },      // 10 payouts per hour
  SUBSCRIPTION_OVERRIDE: { requests: 20, window: '1 h' },  // 20 overrides per hour
  WALLET_CREDIT: { requests: 30, window: '1 h' },          // 30 credits per hour
  WALLET_DEDUCT: { requests: 30, window: '1 h' },          // 30 debits per hour
  
  // High-impact operations
  INSTRUCTOR_APPROVAL: { requests: 50, window: '1 h' },    // 50 approvals per hour
  INSTRUCTOR_SUSPEND: { requests: 20, window: '1 h' },     // 20 suspensions per hour
  BOOKING_CANCEL: { requests: 100, window: '1 h' },        // 100 cancellations per hour
  BOOKING_DELETE: { requests: 20, window: '1 h' },         // 20 deletions per hour
  
  // Settings and configuration
  PRICING_UPDATE: { requests: 5, window: '1 h' },          // 5 pricing changes per hour
  SETTINGS_UPDATE: { requests: 10, window: '1 h' },        // 10 settings updates per hour
  
  // Default for other admin routes
  DEFAULT_ADMIN: { requests: 100, window: '15 m' },        // 100 requests per 15 minutes
} as const

export type RateLimitType = keyof typeof RATE_LIMITS

// ── Rate Limiter Instances ────────────────────────────────────────────────────

let redis: Redis | null = null
const rateLimiters = new Map<RateLimitType, Ratelimit>()

// Initialize Redis connection (lazy)
function getRedis(): Redis | null {
  if (redis) return redis
  
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  
  if (!url || !token) {
    console.warn('⚠️  Rate limiting: Redis not configured, using in-memory fallback (not recommended for production)')
    return null
  }
  
  try {
    redis = new Redis({ url, token })
    return redis
  } catch (error) {
    console.error('Failed to initialize Redis for rate limiting:', error)
    return null
  }
}

// Get or create rate limiter for a specific type
function getRateLimiter(type: RateLimitType): Ratelimit {
  if (rateLimiters.has(type)) {
    return rateLimiters.get(type)!
  }
  
  const config = RATE_LIMITS[type]
  const redisInstance = getRedis()
  
  const limiter = redisInstance
    ? new Ratelimit({
        redis: redisInstance,
        limiter: Ratelimit.slidingWindow(config.requests, config.window),
        analytics: true,
        prefix: `rl:admin:${type.toLowerCase()}`,
      })
    : new Ratelimit({
        redis: Redis.fromEnv(), // Will use in-memory if env vars not set
        limiter: Ratelimit.slidingWindow(config.requests, config.window),
        analytics: false,
        prefix: `rl:admin:${type.toLowerCase()}`,
      })
  
  rateLimiters.set(type, limiter)
  return limiter
}

// ── Main Rate Limit Function ──────────────────────────────────────────────────

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

/**
 * Check rate limit for a user/identifier
 * 
 * @param identifier - Unique identifier (userId, IP, session ID)
 * @param type - Type of operation being rate limited
 * @returns Rate limit result with success status and metadata
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType
): Promise<RateLimitResult> {
  try {
    const limiter = getRateLimiter(type)
    const result = await limiter.limit(identifier)
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    }
  } catch (error) {
    console.error(`Rate limit check failed for ${type}:`, error)
    // On error, allow the request but log it
    return {
      success: true,
      limit: RATE_LIMITS[type].requests,
      remaining: -1,
      reset: Date.now() + 3600000, // 1 hour from now
    }
  }
}

/**
 * Middleware wrapper for API routes
 * Returns a 429 response if rate limit exceeded
 */
export async function withRateLimit(
  identifier: string,
  type: RateLimitType,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const result = await checkRateLimit(identifier, type)
  
  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many ${type.toLowerCase().replace(/_/g, ' ')} requests. Please try again later.`,
        limit: result.limit,
        remaining: result.remaining,
        reset: new Date(result.reset).toISOString(),
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.reset.toString(),
          'Retry-After': result.retryAfter?.toString() || '3600',
        },
      }
    )
  }
  
  // Add rate limit headers to successful responses
  const response = await handler()
  response.headers.set('X-RateLimit-Limit', result.limit.toString())
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', result.reset.toString())
  
  return response
}

// ── In-Memory Fallback (Development) ──────────────────────────────────────────

interface InMemoryEntry {
  count: number
  resetAt: number
}

const inMemoryStore = new Map<string, InMemoryEntry>()

/**
 * Simple in-memory rate limiter for development
 * NOT suitable for production (resets on deploy, not shared across instances)
 */
export async function checkRateLimitInMemory(
  identifier: string,
  type: RateLimitType
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[type]
  const key = `${type}:${identifier}`
  const now = Date.now()
  
  // Parse window (e.g., "1 h" -> 3600000ms, "15 m" -> 900000ms)
  const windowMs = parseWindow(config.window)
  
  let entry = inMemoryStore.get(key)
  
  // Reset if window expired
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs }
    inMemoryStore.set(key, entry)
  }
  
  // Check limit
  if (entry.count >= config.requests) {
    return {
      success: false,
      limit: config.requests,
      remaining: 0,
      reset: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    }
  }
  
  // Increment counter
  entry.count++
  
  return {
    success: true,
    limit: config.requests,
    remaining: config.requests - entry.count,
    reset: entry.resetAt,
  }
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)\s*([hms])$/)
  if (!match) return 3600000 // Default 1 hour
  
  const value = parseInt(match[1])
  const unit = match[2]
  
  switch (unit) {
    case 'h': return value * 60 * 60 * 1000
    case 'm': return value * 60 * 1000
    case 's': return value * 1000
    default: return 3600000
  }
}

// Clean up expired entries every 5 minutes
if (typeof window === 'undefined') { // Server-side only
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of inMemoryStore.entries()) {
      if (entry.resetAt <= now) {
        inMemoryStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

// ── Helper: Get Identifier from Session ───────────────────────────────────────

/**
 * Extract rate limit identifier from session
 * Uses userId + IP for better security
 */
export function getRateLimitIdentifier(
  userId: string,
  request?: Request
): string {
  let ip = 'unknown'
  
  if (request) {
    // Try to get real IP from headers (Vercel, Cloudflare, etc.)
    ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
         request.headers.get('x-real-ip') ||
         'unknown'
  }
  
  return `${userId}:${ip}`
}

// ── Export Configured Limiters ────────────────────────────────────────────────

/**
 * Pre-configured rate limit wrappers for common operations
 */
export const RateLimiters = {
  payoutProcessing: (id: string, handler: () => Promise<NextResponse>) =>
    withRateLimit(id, 'PAYOUT_PROCESSING', handler),
    
  subscriptionOverride: (id: string, handler: () => Promise<NextResponse>) =>
    withRateLimit(id, 'SUBSCRIPTION_OVERRIDE', handler),
    
  walletCredit: (id: string, handler: () => Promise<NextResponse>) =>
    withRateLimit(id, 'WALLET_CREDIT', handler),
    
  walletDeduct: (id: string, handler: () => Promise<NextResponse>) =>
    withRateLimit(id, 'WALLET_DEDUCT', handler),
    
  instructorApproval: (id: string, handler: () => Promise<NextResponse>) =>
    withRateLimit(id, 'INSTRUCTOR_APPROVAL', handler),
    
  instructorSuspend: (id: string, handler: () => Promise<NextResponse>) =>
    withRateLimit(id, 'INSTRUCTOR_SUSPEND', handler),
    
  bookingCancel: (id: string, handler: () => Promise<NextResponse>) =>
    withRateLimit(id, 'BOOKING_CANCEL', handler),
    
  bookingDelete: (id: string, handler: () => Promise<NextResponse>) =>
    withRateLimit(id, 'BOOKING_DELETE', handler),
    
  pricingUpdate: (id: string, handler: () => Promise<NextResponse>) =>
    withRateLimit(id, 'PRICING_UPDATE', handler),
    
  settingsUpdate: (id: string, handler: () => Promise<NextResponse>) =>
    withRateLimit(id, 'SETTINGS_UPDATE', handler),
    
  // Convenience methods that match common use cases
  financialOperations: async (req: Request, session: any) => {
    if (!session?.user?.id) return null
    const identifier = getRateLimitIdentifier(session.user.id, req)
    const result = await checkRateLimit(identifier, 'WALLET_CREDIT')
    if (!result.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter: result.retryAfter },
        { status: 429, headers: { 'Retry-After': result.retryAfter?.toString() || '3600' } }
      )
    }
    return null
  },
  
  highImpactOperations: async (req: Request, session: any) => {
    if (!session?.user?.id) return null
    const identifier = getRateLimitIdentifier(session.user.id, req)
    const result = await checkRateLimit(identifier, 'INSTRUCTOR_APPROVAL')
    if (!result.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter: result.retryAfter },
        { status: 429, headers: { 'Retry-After': result.retryAfter?.toString() || '3600' } }
      )
    }
    return null
  },
  
  settingsChanges: async (req: Request, session: any) => {
    if (!session?.user?.id) return null
    const identifier = getRateLimitIdentifier(session.user.id, req)
    const result = await checkRateLimit(identifier, 'SETTINGS_UPDATE')
    if (!result.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter: result.retryAfter },
        { status: 429, headers: { 'Retry-After': result.retryAfter?.toString() || '3600' } }
      )
    }
    return null
  },
}
