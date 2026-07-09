'use strict';

const config = require('../utils/config');

// ── Per-IP rate limiting (in-process, no Redis dependency) ───────────────────
// Limits how many requests any single IP can make per minute across all proxy
// routes. This is a defense-in-depth measure — the main app has its own rate
// limits per endpoint, but the proxy needs its own to prevent forwarding floods.
//
// Uses a simple sliding-window map. Not cluster-safe (fine for single-instance
// Railway/Render deployments). For multi-instance, replace with a Redis counter.
const IP_RATE_LIMIT = 60;       // max requests per window
const IP_RATE_WINDOW_MS = 60_000; // 1 minute
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

function checkIpRateLimit(ip) {
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

  const provided = req.headers['x-vapi-secret'];
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
 * Applied after verifyVapiSecret so auth failures don't consume rate limit budget.
 */
function ipRateLimit(req, res, next) {
  if (config.NODE_ENV === 'test') return next();

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (!checkIpRateLimit(ip)) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please wait before retrying.',
    });
  }

  next();
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

  // Vapi tool call endpoints — all go through main-app-proxy
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