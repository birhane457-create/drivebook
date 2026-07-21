'use strict';

const config = require('../utils/config');

// ── Per-IP rate limiting ──────────────────────────────────────────────────────
// Gap 21 fix: limits are now applied via Redis when REDIS_URL is configured,
// so they are enforced per-IP across ALL Railway instances rather than
// per-container. Falls back to the in-process Map when Redis is unavailable
// (same pattern used by voice-session-service.js).
//
// Algorithm: sliding-window counter using a Redis INCR + EXPIRE approach.
// - On first hit within the window: SET key 1 EX windowSeconds (atomic via Lua)
// - On subsequent hits: INCR the key (TTL already set by first hit)
// - Key format: rl:ip:<ip>  — namespaced to avoid collisions with session keys

const IP_RATE_LIMIT    = 60;       // max requests per window
const IP_RATE_WINDOW_S = 60;       // 1 minute (seconds, for Redis EX)
const IP_RATE_WINDOW_MS = IP_RATE_WINDOW_S * 1000;

// ── Redis client (shared singleton, lazy-initialised) ────────────────────────
// We deliberately do NOT import voice-session-service.js here to avoid a
// circular dependency. Instead we create our own ioredis client using the
// same REDIS_URL, but only if ioredis is available and the URL is configured.

let redisClient     = null;
let redisReady      = false;

function initRateLimitRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return; // no Redis configured — use in-process Map

  try {
    const Redis = require('ioredis');
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
      enableReadyCheck: true,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 300, 2000)),
      keyPrefix: 'rl:', // namespace: rl:ip:<ip>
    });

    client.on('ready', () => {
      redisClient = client;
      redisReady  = true;
    });

    client.on('error', () => {
      redisReady = false; // fall back to Map until reconnected
    });

    client.on('ready', () => { redisReady = true; }); // re-enable on reconnect

    client.on('close', () => {
      redisClient = null;
      redisReady  = false;
    });
  } catch {
    // ioredis not installed or Redis URL invalid — in-process Map is the fallback
  }
}

initRateLimitRedis();

// ── Redis sliding-window check (atomic Lua) ───────────────────────────────────
// Returns true if the request is allowed, false if rate limit exceeded.
// Uses INCR + EXPIRE: the first INCR within a window sets TTL; subsequent
// INCRs just increment the counter. If count > limit, reject.

const INCR_AND_EXPIRE_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

async function checkRedisRateLimit(ip) {
  try {
    const key = `ip:${ip}`; // keyPrefix 'rl:' prepended by ioredis → 'rl:ip:<ip>'
    const count = await redisClient.eval(
      INCR_AND_EXPIRE_SCRIPT,
      1,           // numkeys
      key,         // KEYS[1]
      IP_RATE_WINDOW_S  // ARGV[1] — TTL in seconds
    );
    return count <= IP_RATE_LIMIT;
  } catch {
    // Redis eval failed — fail open (allow request) to avoid blocking legitimate traffic
    return true;
  }
}

// ── In-process Map fallback (single-instance or Redis unavailable) ────────────
const ipRequestMap = new Map(); // ip → [timestamp, ...]

// Sweep stale entries every 5 minutes to prevent memory growth
const sweepTimer = setInterval(() => {
  const cutoff = Date.now() - IP_RATE_WINDOW_MS;
  for (const [ip, timestamps] of ipRequestMap.entries()) {
    const recent = timestamps.filter(t => t > cutoff);
    if (recent.length === 0) {
      ipRequestMap.delete(ip);
    } else {
      ipRequestMap.set(ip, recent);
    }
  }
}, 5 * 60_000);
if (sweepTimer.unref) sweepTimer.unref();

function checkMapRateLimit(ip) {
  const now = Date.now();
  const cutoff = now - IP_RATE_WINDOW_MS;
  const timestamps = (ipRequestMap.get(ip) || []).filter(t => t > cutoff);
  timestamps.push(now);
  ipRequestMap.set(ip, timestamps);
  return timestamps.length <= IP_RATE_LIMIT;
}

/**
 * verifyVapiSecret
 *
 * Verifies that inbound Vapi tool calls carry the correct x-vapi-secret header.
 *
 * Configure in Vapi Dashboard → Assistant → Server URL → Secret.
 * Set VAPI_WEBHOOK_SECRET in the hybrid .env to the same value.
 *
 * If VAPI_WEBHOOK_SECRET is not set (unset/empty), verification is skipped with
 * a warning — allowing development without the secret while requiring it in prod.
 * The config.js startup check will warn in dev and hard-fail in production if the
 * var is missing or still set to a placeholder.
 *
 * Only applied to Vapi tool-call routes — health check is excluded.
 */
function verifyVapiSecret(req, res, next) {
  // Skip for health check — monitoring tools don't carry Vapi headers
  if (req.path === '/api/health') return next();

  // Skip for legacy local endpoints — these are internal, not Vapi tool calls
  if (req.path.startsWith('/api/bookings') || req.path.startsWith('/api/instructor')) {
    return next();
  }

  const secret = config.VAPI_WEBHOOK_SECRET;

  if (!secret) {
    // Not configured — log a warning but allow through (dev-friendly, blocked in prod by config)
    if (config.NODE_ENV === 'production') {
      // Config already hard-fails at startup if secret is missing in prod,
      // but add a runtime safety net here too
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'VAPI_WEBHOOK_SECRET not configured on this service',
      });
    }
    return next();
  }

  const provided = req.headers['x-vapi-secret']
    || (() => {
      // Also accept Bearer token from Authorization header
      // (VAPI Credential system sends: Authorization: Bearer <secret>)
      const auth = req.headers['authorization'] || '';
      return auth.startsWith('Bearer ') ? auth.slice(7) : null;
    })();

  if (!provided || provided !== secret) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing x-vapi-secret header',
    });
  }

  next();
}

/**
 * ipRateLimit
 *
 * Rejects requests from IPs that exceed IP_RATE_LIMIT requests per minute.
 * Uses Redis when configured (cross-instance, correct for multi-container
 * Railway deployments). Falls back to in-process Map for single-instance
 * or when Redis is temporarily unavailable.
 *
 * Applied after verifyVapiSecret so auth failures don't consume rate limit budget.
 */
function ipRateLimit(req, res, next) {
  if (config.NODE_ENV === 'test') return next();

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';

  if (redisReady && redisClient) {
    // Async Redis path
    checkRedisRateLimit(ip).then(allowed => {
      if (!allowed) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please wait before retrying.',
        });
      }
      next();
    }).catch(() => next()); // fail open on unexpected error
  } else {
    // Synchronous in-process Map path (single-instance or Redis unavailable)
    if (!checkMapRateLimit(ip)) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please wait before retrying.',
      });
    }
    next();
  }
}

/**
 * restrictAccess
 *
 * Allowlist-based access control for the hybrid service.
 * Only routes explicitly listed here are reachable from outside.
 * Everything else returns 403.
 *
 * Vapi tool calls arrive as standard HTTP requests — no special auth header
 * beyond x-vapi-secret (handled above). The x-api-key authenticating this
 * service to the main app is added in buildForwardHeaders() (main-app-proxy.js).
 */
function restrictAccess(req, res, next) {
  // Test environment: allow everything — no network or auth setup needed
  if (config.NODE_ENV === 'test') {
    return next();
  }

  // Health check — always open for monitoring (Railway, UptimeRobot, etc.)
  if (req.path === '/api/health') {
    return next();
  }

  // Legacy local booking and instructor lookup endpoints
  if (
    req.path.startsWith('/api/bookings') ||
    req.path.startsWith('/api/instructor')
  ) {
    return next();
  }

  // Internal docs — gated by hideApiDocs (INTERNAL_API_KEY) not by this middleware
  if (req.path.startsWith('/docs') || req.path === '/HOMEPAGE.html') {
    return next();
  }

  // Vapi server event webhook  VAPI POSTs call lifecycle events (start, end, status)
  // to serverUrl (the root of the hybrid service). These are verified by verifyVapiSecret
  // before reaching here. Return 200 to acknowledge; we can process events as needed.
  if (req.path === '/' && req.method === 'POST') {
    return next();
  }

  // Vapi tool call endpoints  all go through main-app-proxy
  if (
    req.path.startsWith('/api/locations')    ||
    req.path.startsWith('/api/instructors')  ||
    req.path.startsWith('/api/availability') ||
    req.path.startsWith('/api/packages')     ||
    req.path.startsWith('/api/public')       ||
    req.path.startsWith('/api/verifications')
  ) {
    return next();
  }

  res.status(403).json({
    error: 'Forbidden',
    message: 'This service is not publicly accessible',
  });
}

/**
 * hideApiDocs
 *
 * The root GET / endpoint returns full API documentation only when the caller
 * provides a valid INTERNAL_API_KEY. All other callers get a minimal heartbeat.
 */
function hideApiDocs(req, res, next) {
  if (req.path !== '/' || req.method !== 'GET') {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  const internalKey = config.INTERNAL_API_KEY;

  // Guard: if INTERNAL_API_KEY is empty (misconfigured), never expose docs
  if (internalKey && apiKey === internalKey) {
    return next();
  }

  return res.status(200).json({
    status: 'ok',
    message: 'Voice service is running',
  });
}

module.exports = { restrictAccess, hideApiDocs, verifyVapiSecret, ipRateLimit };