/**
 * Voice Session Recovery Service
 *
 * Stores the last in-progress booking action per phone number so that if a
 * Twilio call drops mid-flow, the caller can ring back and the AI immediately
 * resumes from where they left off.
 *
 * Storage strategy (auto-detected at startup):
 *
 *   Redis (REDIS_URL env var set):
 *     - Sessions survive container restarts and horizontal scaling
 *     - TTL enforced natively by Redis — no cleanup interval needed
 *     - Required for multi-instance deployments (Railway, Render, Fly.io)
 *
 *   In-process Map (fallback when REDIS_URL is unset):
 *     - Zero dependencies, correct for single-instance deployments
 *     - Sessions lost on restart — booking expires silently after 10 min
 *     - Acceptable for development and initial launch
 *
 * The public API (saveSession / getSession / clearSession) is identical in
 * both modes. Swap storage by setting REDIS_URL — no other code changes needed.
 *
 * Session schema:
 * {
 *   phoneNumber:   "+61412345678",   // normalised E.164
 *   lastAction:    "BOOKING_CREATED" | "PAYMENT_LINK_SENT" | "AWAITING_OTP"
 *                  | "AWAITING_RESCHEDULE" | "AWAITING_CANCEL" | "COMPLETED",
 *   bookingId:     "bkg_abc123",
 *   checkoutUrl:   "https://…",
 *   instructorId:  "inst_xyz",
 *   instructorName:"Debesay",
 *   expiresAt:     1234567890000,   // epoch ms (Map mode only; Redis uses TTL)
 * }
 */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const SESSION_TTL_MS  = 10 * 60 * 1000; // 10 minutes
const SESSION_TTL_SEC = 600;             // Redis TTL in seconds
const REDIS_KEY_PREFIX = 'voice:session:';

// ── Storage backend ───────────────────────────────────────────────────────────

let redisClient = null;
let usingRedis  = false;

function initRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('[VoiceSession] REDIS_URL not set — using in-process Map (single-instance mode)');
    return;
  }

  try {
    const Redis = require('ioredis');
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      enableReadyCheck: true,
    });

    client.on('ready', () => {
      redisClient = client;
      usingRedis  = true;
      console.log('[VoiceSession] Redis connected — sessions are persistent across restarts');
    });

    client.on('error', (err) => {
      console.error('[VoiceSession] Redis error — falling back to in-process Map:', err.message);
      redisClient = null;
      usingRedis  = false;
    });
  } catch (err) {
    console.error('[VoiceSession] ioredis not available — using in-process Map:', err.message);
  }
}

// Initialise on module load
initRedis();

// ── In-process Map fallback ───────────────────────────────────────────────────
/** @type {Map<string, Object>} */
const sessionMap = new Map();

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [phone, session] of sessionMap.entries()) {
    if (session.expiresAt <= now) sessionMap.delete(phone);
  }
}, 60 * 1000);

if (cleanupTimer.unref) cleanupTimer.unref();

// ── Phone normalisation ───────────────────────────────────────────────────────

/**
 * Normalise an Australian phone number to E.164 (+614…).
 * Handles: 04xx, +614xx, 614xx (no leading +), numbers with spaces/dashes.
 * Non-Australian numbers are returned unchanged.
 * @param {string} phone
 * @returns {string}
 */
function normalisePhone(phone) {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('614')) return '+' + digits;
  if (digits.startsWith('04'))  return '+61' + digits.slice(1);
  if (phone.startsWith('+'))    return phone;
  return phone;
}

// ── Storage operations ────────────────────────────────────────────────────────

async function redisGet(phone) {
  try {
    const raw = await redisClient.get(REDIS_KEY_PREFIX + phone);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('[VoiceSession] Redis GET failed:', err.message);
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
    console.error('[VoiceSession] Redis SET failed:', err.message);
  }
}

async function redisDel(phone) {
  try {
    await redisClient.del(REDIS_KEY_PREFIX + phone);
  } catch (err) {
    console.error('[VoiceSession] Redis DEL failed:', err.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Save or update the session for a caller.
 * In Redis mode: resets the TTL on every call (extends the window).
 * In Map mode: updates expiresAt.
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

  if (usingRedis && redisClient) {
    const existing = await redisGet(key) || {};
    await redisSet(key, {
      ...existing,
      ...data,
      phoneNumber: key,
      // Preserve original createdAt so minutesAgo() measures from call start,
      // not from the last saveSession() call (e.g. PAYMENT_LINK_SENT update).
      createdAt: existing.createdAt || now,
    });
    return;
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

  if (usingRedis && redisClient) {
    return redisGet(key);
  }

  // Map fallback
  const session = sessionMap.get(key);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessionMap.delete(key);
    return null;
  }
  return session;
}

/**
 * Delete the session for a caller.
 *
 * @param {string} phoneNumber
 */
async function clearSession(phoneNumber) {
  const key = normalisePhone(phoneNumber);
  if (usingRedis && redisClient) {
    await redisDel(key);
    return;
  }
  sessionMap.delete(key);
}

/**
 * Return how many minutes ago the session was last updated.
 * In Redis mode we don't store the save timestamp, so we approximate
 * using the remaining TTL (TTL remaining = SESSION_TTL_SEC - age).
 *
 * @param {Object} session  — returned by getSession()
 * @returns {number}  minutes since session was saved
 */
function minutesAgo(session) {
  // Use createdAt if present — works in both Redis and Map modes
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
  // Redis session with no timestamp — cannot calculate, return 0
  return 0;
}

/**
 * Build the Twilio read-back string for session recovery.
 *
 * @param {Object} session
 * @returns {string}
 */
function buildRecoveryPrompt(session) {
  const mins = minutesAgo(session);
  const name = session.instructorName || 'your instructor';
  const timeStr = mins > 0 ? `about ${mins} minute${mins !== 1 ? 's' : ''} ago` : 'just before';

  // Payment link sent — voice-webhook.js already checked payment status before calling this.
  // If we reach here, payment is still pending (not succeeded, not expired).
  if (session.lastAction === 'BOOKING_CREATED' || session.lastAction === 'PAYMENT_LINK_SENT') {
    return (
      `Welcome back. I can see you were booking a lesson with ${name} ` +
      `${timeStr}. ` +
      `I've resent your payment link to this number. ` +
      `Would you like me to do anything else?`
    );
  }

  // Mid-OTP drop: caller hung up while waiting for verification code.
  // The previous OTP may have expired — offer to send a fresh one.
  if (session.lastAction === 'AWAITING_OTP') {
    const purposeStr = session.otpPurpose === 'reschedule' ? 'reschedule your lesson' : 'cancel your booking';
    return (
      `Welcome back. You were in the middle of verifying your identity to ${purposeStr} ` +
      `${timeStr}. ` +
      `The previous code may have expired — would you like me to send a new one?`
    );
  }

  // Short-notice booking awaiting instructor approval — no payment link exists yet.
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

// Expose for unit-testing only — do not call from application code
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
  _getMapSizeForTest,
};
