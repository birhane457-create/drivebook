/**
 * Voice Session Recovery Service
 *
 * Stores the last in-progress booking action per phone number so that if a
 * call drops mid-flow, the caller can ring back and the AI immediately
 * resumes from where they left off.
 *
 * Storage strategy (auto-detected at startup):
 *
 *   Redis (REDIS_URL env var set):
 *     - Sessions survive container restarts and horizontal scaling
 *     - TTL enforced natively by Redis  no cleanup interval needed
 *     - Required for multi-instance deployments (Railway, Render, Fly.io)
 *
 *   In-process Map (fallback when REDIS_URL is unset):
 *     - Zero dependencies, correct for single-instance deployments
 *     - Sessions lost on restart  booking expires silently after TTL
 *     - Acceptable for development and initial launch
 *
 * The public API (saveSession / getSession / clearSession) is identical in
 * both modes. Swap storage by setting REDIS_URL  no other code changes needed.
 *
 * Session schema:
 * {
 *   phoneNumber:   "+61412345678",   // normalised E.164
 *   lastAction:    "BOOKING_CREATED" | "PAYMENT_LINK_SENT" | "AWAITING_OTP"
 *                  | "AWAITING_RESCHEDULE" | "AWAITING_CANCEL" | "COMPLETED",
 *   bookingId:     "bkg_abc123",
 *   checkoutUrl:   "https://...",
 *   instructorId:  "inst_xyz",
 *   instructorName:"Debesay",
 *   expiresAt:     1234567890000,   // epoch ms (Map mode only; Redis uses TTL)
 * }
 */

'use strict';

const logger = require('../utils/logger');

//  Configuration 
// SESSION_TTL is tied to the Stripe checkout window (10 min by default).
// Override via SESSION_TTL_SECONDS env var without a code deploy.
const SESSION_TTL_SEC = parseInt(process.env.SESSION_TTL_SECONDS || '600', 10);
const SESSION_TTL_MS  = SESSION_TTL_SEC * 1000;
const REDIS_KEY_PREFIX = 'voice:session:';

//  Metrics counters (lightweight in-process observability) 
// These are read by getMetrics() which can be exposed on a health/debug endpoint.
const metrics = {
  saves:          0,  // total saveSession calls
  gets:           0,  // total getSession calls
  clears:         0,  // total clearSession calls
  hits:           0,  // getSession calls that returned a live session
  misses:         0,  // getSession calls that returned null
  redisFallbacks: 0,  // operations that fell back to Map due to Redis being unavailable
  redisErrors:    0,  // Redis operation errors (GET/SET/DEL failures)
};

//  Storage backend 

let redisClient = null;
let usingRedis  = false;

function initRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.logInfo('[VoiceSession] REDIS_URL not set  using in-process Map (single-instance mode)');
    return;
  }

  try {
    const Redis = require('ioredis');
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      enableReadyCheck: true,
      // ioredis will attempt reconnection automatically.
      // retryStrategy controls the backoff between attempts.
      retryStrategy: (times) => {
        if (times > 10) {
          // After 10 failed reconnects, give up. The 'close' event will fire.
          return null;
        }
        return Math.min(times * 200, 3000); // up to 3s between retries
      },
    });

    // Fires on first connect and on every successful reconnect
    client.on('ready', () => {
      redisClient = client;
      usingRedis  = true;
      logger.logInfo('[VoiceSession] Redis connected  sessions are persistent across restarts', {
        storageMode: 'redis',
      });
    });

    // Fires on every connection error (including transient errors during reconnect).
    // We log at warning level  ioredis will keep retrying automatically.
    // We do NOT permanently null redisClient here because the 'ready' event
    // will re-enable it once the connection is restored.
    client.on('error', (err) => {
      metrics.redisErrors++;
      logger.logWarning('[VoiceSession] Redis connection error  operations will use Map until reconnected', {
        error: err.message,
        code: err.code,
        redisErrors: metrics.redisErrors,
      });
      // Temporarily mark as unavailable so in-flight operations fall back to Map.
      // 'ready' will set this back to true on reconnection.
      usingRedis = false;
    });

    // Fires when ioredis has exhausted all retries and gives up permanently.
    // At this point the process needs attention  log at error level.
    client.on('close', () => {
      redisClient = null;
      usingRedis  = false;
      logger.logError(new Error('[VoiceSession] Redis connection permanently closed  all sessions now use in-process Map only'), {
        context: 'redis-close',
        impact: 'Session recovery will not survive container restarts until Redis is restored and the service restarted',
      });
    });

    // Reconnect attempt logging (at debug level  noisy but useful in staging)
    client.on('reconnecting', (delay) => {
      logger.logInfo('[VoiceSession] Redis reconnecting', { delayMs: delay });
    });

  } catch (err) {
    logger.logError(err, { context: 'redis-init', message: 'ioredis not available  using in-process Map' });
  }
}

// Initialise on module load
initRedis();

//  In-process Map fallback 
/** @type {Map<string, Object>} */
const sessionMap = new Map();

// Sweep expired entries every 60 seconds.
// unref() prevents this timer from keeping the process alive in test environments.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  let swept = 0;
  for (const [phone, session] of sessionMap.entries()) {
    if (session.expiresAt <= now) {
      sessionMap.delete(phone);
      swept++;
    }
  }
  if (swept > 0) {
    logger.logInfo('[VoiceSession] Map cleanup swept expired sessions', {
      swept,
      remaining: sessionMap.size,
    });
  }
}, 60 * 1000);

if (cleanupTimer.unref) cleanupTimer.unref();

//  Phone normalisation 

/**
 * Normalise an Australian phone number to E.164 (+614...).
 * Handles: 04xx, +614xx, 614xx (no leading +), numbers with spaces/dashes.
 * Non-Australian numbers are returned unchanged.
 * @param {string} phone
 * @returns {string}
 */
function normalisePhone(phone) {
  if (!phone) return phone;
  const original = phone.trim();
  const hasPlus = original.startsWith('+');
  const digits = original.replace(/\D/g, '');
  // Australian mobile: 04xx  +614xx
  if (digits.startsWith('04')) return '+61' + digits.slice(1);
  // Already E.164 with country code: 614xx → +614xx
  if (digits.startsWith('614')) return '+' + digits;
  // Had a leading + but unknown country code — preserve it
  if (hasPlus) return '+' + digits;
  // Fallback: return digits only
  return digits;
}

//  Redis storage operations 

async function redisGet(phone) {
  try {
    const raw = await redisClient.get(REDIS_KEY_PREFIX + phone);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    metrics.redisErrors++;
    logger.logError(err, { context: 'redis-get', phone: '[REDACTED]' });
    return null;
  }
}

async function redisSet(phone, data) {
  try {
    await redisClient.set(
      REDIS_KEY_PREFIX + phone,
      JSON.stringify(data),
      'EX', SESSION_TTL_SEC
    );
  } catch (err) {
    metrics.redisErrors++;
    logger.logError(err, { context: 'redis-set', phone: '[REDACTED]' });
    throw err; // re-throw so saveSession can fall back to Map
  }
}

async function redisDel(phone) {
  try {
    await redisClient.del(REDIS_KEY_PREFIX + phone);
  } catch (err) {
    metrics.redisErrors++;
    logger.logError(err, { context: 'redis-del', phone: '[REDACTED]' });
  }
}

//  Public API 

/**
 * Save or update the session for a caller.
 * In Redis mode: resets the TTL on every call (extends the window).
 * In Map mode: updates expiresAt.
 *
 * Falls back to Map if Redis is temporarily unavailable.
 *
 * @param {string} phoneNumber
 * @param {Partial<{
 *   lastAction: string,
 *   bookingId: string,
 *   checkoutUrl: string,
 *   instructorId: string,
 *   instructorName: string,
 * }>} data
 */
async function saveSession(phoneNumber, data) {
  const key = normalisePhone(phoneNumber);
  const now = Date.now();
  metrics.saves++;

  if (usingRedis && redisClient) {
    try {
      const existing = await redisGet(key) || {};
      await redisSet(key, {
        ...existing,
        ...data,
        phoneNumber: key,
        createdAt: existing.createdAt || now,
      });
      logger.logInfo('[VoiceSession] Session saved to Redis', {
        lastAction: data.lastAction,
        storageMode: 'redis',
      });
      return;
    } catch {
      // Redis write failed  fall through to Map as safety net
      metrics.redisFallbacks++;
      logger.logWarning('[VoiceSession] Redis write failed  falling back to Map for this save', {
        lastAction: data.lastAction,
      });
    }
  } else if (process.env.REDIS_URL) {
    // Redis was configured but is temporarily unavailable
    metrics.redisFallbacks++;
  }

  // Map fallback
  const existing = sessionMap.get(key) || {};
  sessionMap.set(key, {
    ...existing,
    ...data,
    phoneNumber: key,
    expiresAt: now + SESSION_TTL_MS,
    createdAt: existing.createdAt || now,
  });
  logger.logInfo('[VoiceSession] Session saved to Map', { lastAction: data.lastAction });
}

/**
 * Retrieve a live (non-expired) session for a caller.
 * Returns null if no session exists or the session has expired.
 *
 * @param {string} phoneNumber
 * @returns {Promise<Object|null>}
 */
async function getSession(phoneNumber) {
  const key = normalisePhone(phoneNumber);
  metrics.gets++;

  if (usingRedis && redisClient) {
    const session = await redisGet(key);
    if (session) {
      metrics.hits++;
    } else {
      metrics.misses++;
    }
    return session;
  }

  // Map fallback
  const session = sessionMap.get(key);
  if (!session) {
    metrics.misses++;
    return null;
  }
  if (session.expiresAt <= Date.now()) {
    sessionMap.delete(key);
    metrics.misses++;
    return null;
  }
  metrics.hits++;
  return session;
}

/**
 * Delete the session for a caller.
 *
 * @param {string} phoneNumber
 */
async function clearSession(phoneNumber) {
  const key = normalisePhone(phoneNumber);
  metrics.clears++;

  if (usingRedis && redisClient) {
    await redisDel(key);
    return;
  }
  sessionMap.delete(key);
}

/**
 * Return how many minutes ago the session was created.
 *
 * @param {Object} session  returned by getSession()
 * @returns {number} minutes since session was first created
 */
function minutesAgo(session) {
  if (session.createdAt) {
    const elapsed = Date.now() - session.createdAt;
    return Math.round((elapsed / 60000) * 10) / 10;
  }
  // Legacy fallback: Map sessions saved before createdAt was added
  if (session.expiresAt) {
    const remaining = session.expiresAt - Date.now();
    const elapsed = SESSION_TTL_MS - remaining;
    return Math.round((elapsed / 60000) * 10) / 10;
  }
  return 0;
}

/**
 * Build the recovery context string for the Vapi assistant.
 * Called when a caller rings back mid-flow to resume where they left off.
 *
 * @param {Object} session
 * @returns {string}
 */
function buildRecoveryPrompt(session) {
  const mins = minutesAgo(session);
  const name = session.instructorName || 'your instructor';
  const timeStr = mins > 0 ? `about ${mins} minute${mins !== 1 ? 's' : ''} ago` : 'just before';

  if (session.lastAction === 'BOOKING_CREATED' || session.lastAction === 'PAYMENT_LINK_SENT') {
    return (
      `Welcome back. I can see you were booking a lesson with ${name} ` +
      `${timeStr}. ` +
      `I've resent your payment link to this number. ` +
      `Would you like me to do anything else?`
    );
  }

  if (session.lastAction === 'AWAITING_OTP') {
    const purposeStr = session.otpPurpose === 'reschedule' ? 'reschedule your lesson' : 'cancel your booking';
    return (
      `Welcome back. You were in the middle of verifying your identity to ${purposeStr} ` +
      `${timeStr}. ` +
      `The previous code may have expired  would you like me to send a new one?`
    );
  }

  if (session.lastAction === 'AWAITING_APPROVAL') {
    return (
      `Welcome back. Your booking with ${name} is still waiting for their approval ` +
      `${timeStr}. ` +
      `You'll receive an SMS as soon as they confirm. ` +
      `Would you like to cancel and rebook for a different time, or is there anything else I can help with?`
    );
  }

  return (
    `Welcome back. It looks like we were in the middle of something ` +
    `${timeStr}. How can I help you?`
  );
}

/**
 * Return the current storage mode for diagnostics.
 * @returns {'redis' | 'map'}
 */
function getStorageMode() {
  return usingRedis && redisClient ? 'redis' : 'map';
}

/**
 * Return current operational metrics snapshot.
 * Expose on a health or debug endpoint to monitor session service behaviour.
 * @returns {object}
 */
function getMetrics() {
  return {
    ...metrics,
    storageMode: getStorageMode(),
    mapSize: sessionMap.size,
    sessionTtlSeconds: SESSION_TTL_SEC,
    hitRate: metrics.gets > 0
      ? Math.round((metrics.hits / metrics.gets) * 1000) / 10 + '%'
      : 'n/a',
  };
}

// Expose for unit-testing only  do not call from application code
function _getMapSizeForTest() {
  return sessionMap.size;
}

module.exports = {
  saveSession,
  getSession,
  clearSession,
  minutesAgo,
  buildRecoveryPrompt,
  normalisePhone,
  getStorageMode,
  getMetrics,
  _getMapSizeForTest,
};