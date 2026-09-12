'use strict';

/**
 * system-prompt-builder.js
 *
 * Composes a lean, intent-aware runtime prompt (~2,000–3,500 words) at the
 * start of every call. Always-included layers are loaded once at startup.
 * The intent module is selected per-call based on detected call intent.
 *
 * Performance: Live instructor context (slots, packages) is cached per
 * instructorId for CONTEXT_CACHE_TTL_MS (default 60s) to keep call-start
 * latency under 800ms and avoid Twilio silence-triggered interruptions.
 */

const fs   = require('fs');
const path = require('path');
const config = require('../utils/config');
const logger = require('../utils/logger');

// ── Load static prompt layers once at module start ────────────────────────────

const ROOT    = path.join(__dirname, '..');
const PROMPTS = path.join(ROOT, 'prompts');

function loadFile(filepath) {
  try {
    return fs.readFileSync(filepath, 'utf8').trim();
  } catch (err) {
    logger.logWarning(`Could not load prompt file ${filepath}: ${err.message}`);
    return '';
  }
}

// Always-included layers
const LAYER_IDENTITY       = loadFile(path.join(PROMPTS, 'identity.md'));
const LAYER_BUSINESS_RULES = loadFile(path.join(PROMPTS, 'business-rules.md'));
const LAYER_STATE_MACHINE  = loadFile(path.join(PROMPTS, 'state-machine.md'));
const LAYER_VOICE_RULES    = loadFile(path.join(PROMPTS, 'voice-rules.md'));
const LAYER_API_ERRORS     = loadFile(path.join(PROMPTS, 'modules', 'api-errors.md'));

// Intent modules — loaded once, selected per call
const INTENT_MODULES = {
  booking:       loadFile(path.join(PROMPTS, 'modules', 'booking.md')),
  cancellation:  loadFile(path.join(PROMPTS, 'modules', 'cancellation.md')),
  reschedule:    loadFile(path.join(PROMPTS, 'modules', 'reschedule.md')),
  lookup:        loadFile(path.join(PROMPTS, 'modules', 'lookup.md')),
  pricing:       loadFile(path.join(PROMPTS, 'modules', 'pricing.md')),
  complaints:    loadFile(path.join(PROMPTS, 'modules', 'complaints.md')),
};

// ── Live context cache ────────────────────────────────────────────────────────
// Caches instructor profile + slots + packages per instructorId.
// TTL: 60 seconds — short enough to reflect schedule changes, long enough
// to serve back-to-back calls on the same instructor line without latency.
// This keeps call-start API time under 800ms (Gemini latency concern).

const CONTEXT_CACHE_TTL_MS = parseInt(process.env.CONTEXT_CACHE_TTL_MS || '60000', 10);

/** @type {Map<string, { data: object, expiresAt: number }>} */
const contextCache = new Map();

function getCached(instructorId) {
  const entry = contextCache.get(instructorId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    contextCache.delete(instructorId);
    return null;
  }
  return entry.data;
}

function setCached(instructorId, data) {
  contextCache.set(instructorId, { data, expiresAt: Date.now() + CONTEXT_CACHE_TTL_MS });
}

// ── Live data fetchers ────────────────────────────────────────────────────────

async function fetchLiveContext(instructorId) {
  // Return cached data if still fresh — avoids latency on back-to-back calls
  const cached = getCached(instructorId);
  if (cached) {
    logger.logInfo('Live context served from cache', { instructorId });
    return cached;
  }

  const base    = config.DRIVEBOOK_BASE_URL || 'http://localhost:3000';
  const apiKey  = config.DRIVEBOOK_API_KEY  || '';
  const headers = { 'x-api-key': apiKey, 'Content-Type': 'application/json' };
  const timeout = parseInt(config.COPILOT_TIMEOUT_MS || '5000', 10);

  async function safeFetch(url) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const fetchFn = global.fetch || require('node-fetch');
      const res = await fetchFn(url, { headers, signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) {
        logger.logWarning(`Live context fetch failed: ${url} → ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (err) {
      clearTimeout(id);
      logger.logWarning(`Live context fetch error: ${url} → ${err.message}`);
      return null;
    }
  }

  const today = new Date().toISOString().split('T')[0];

  const [profileData, slotsData, packagesData] = await Promise.all([
    safeFetch(`${base}/api/instructors/${instructorId}`),
    safeFetch(`${base}/api/availability/slots?instructorId=${instructorId}&date=${today}&duration=60`),
    safeFetch(`${base}/api/packages?instructorId=${instructorId}`),
  ]);

  const result = { profile: profileData, slots: slotsData, packages: packagesData };

  // Store in cache so the next call within 60s serves instantly
  setCached(instructorId, result);

  return result;
}

// ── Context block builder ─────────────────────────────────────────────────────

async function buildContextBlock(instructorId) {
  if (!instructorId) {
    return `[INSTRUCTOR CONTEXT]
Line type: GENERAL — no specific instructor
The caller dialled the shared DriveBook number. You must discover the right instructor during the call.

Next steps:
1. Ask: "Do you have a preferred instructor, or would you like me to find one near you?"
2. If preferred name given: call GET /api/instructors/search?name=
3. If no preference: ask for location, then call GET /api/instructors/recommendations?location=
[END CONTEXT]`;
  }

  const { profile, slots, packages } = await fetchLiveContext(instructorId);

  const name        = profile?.name              || 'the instructor';
  const rate        = profile?.hourlyRate        ? `$${profile.hourlyRate}/hr` : 'rate not available';
  const serviceArea = profile?.serviceAreas      || profile?.baseSuburb || 'area not specified';
  const vehicles    = profile?.vehicleTypes
    ? (Array.isArray(profile.vehicleTypes) ? profile.vehicleTypes.join(', ') : profile.vehicleTypes)
    : 'not specified';
  const languages   = profile?.languages
    ? (Array.isArray(profile.languages) ? profile.languages.join(', ') : profile.languages)
    : 'English';
  const experience  = profile?.yearsExperience   ? `${profile.yearsExperience}+ years` : 'not specified';
  const offersTest  = profile?.offersTestPackage  ? 'Yes' : 'No';
  const testPrice   = profile?.testPackagePrice   ? `$${profile.testPackagePrice}` : 'N/A';

  let slotsText = 'No slots available in the next 7 days.';
  if (slots?.slots && Array.isArray(slots.slots)) {
    const available = slots.slots.filter(s => s.available).slice(0, 3);
    if (available.length > 0) slotsText = available.map(s => s.time).join(', ');
  }

  let packagesText = 'Not available — call GET /api/packages for live rates.';
  if (packages?.packages && Array.isArray(packages.packages)) {
    packagesText = packages.packages
      .map(p => `${p.hours}hrs = $${p.priceWithFee || p.price}`)
      .join(' | ');
  }

  return `[INSTRUCTOR CONTEXT — injected at call start]
Instructor name: ${name}
Hourly rate: ${rate}
Service area: ${serviceArea}
Vehicle types: ${vehicles}
Languages: ${languages}
Years experience: ${experience}
Offers PDA test pack: ${offersTest}${offersTest === 'Yes' ? ` (${testPrice})` : ''}
Today's available slots: ${slotsText}
Package pricing: ${packagesText}
[END CONTEXT]`;
}

// ── Session memory block ──────────────────────────────────────────────────────

function buildSessionBlock(session) {
  if (!session) return null;

  const lines = ['[SESSION MEMORY — caller rang back mid-flow]'];
  if (session.lastAction)    lines.push(`Last action: ${session.lastAction}`);
  if (session.instructorName) lines.push(`Instructor already selected: ${session.instructorName}`);
  if (session.bookingId)     lines.push(`Booking ID in progress: ${session.bookingId}`);
  if (session.checkoutUrl)   lines.push(`Payment link already generated: ${session.checkoutUrl}`);
  lines.push('[END SESSION]');
  lines.push('');
  lines.push('Resume from where the caller left off. Offer to resend the payment link if one exists.');

  return lines.join('\n');
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build the runtime system prompt for this call.
 *
 * @param {string|null} instructorId  — null for general DriveBook line
 * @param {string|null} callerPhone   — E.164 format
 * @param {string}      intent        — 'booking' | 'cancellation' | 'reschedule' |
 *                                      'lookup' | 'pricing' | 'complaints'
 *                                      Defaults to 'booking' (safe fallback for call start
 *                                      before intent is known)
 * @param {Object|null} session       — session object from voice-session-service, or null
 * @returns {Promise<string>}
 */
async function buildSystemPrompt(instructorId, callerPhone, intent = 'booking', session = null) {
  const [contextBlock] = await Promise.all([buildContextBlock(instructorId)]);

  const intentModule = INTENT_MODULES[intent] || INTENT_MODULES.booking;
  const sessionBlock = buildSessionBlock(session);

  const layers = [
    LAYER_IDENTITY,
    '',
    LAYER_BUSINESS_RULES,
    '',
    LAYER_STATE_MACHINE,
    '',
    LAYER_VOICE_RULES,
    '',
    intentModule,
    '',
    LAYER_API_ERRORS,
    '',
    contextBlock,
  ];

  if (sessionBlock) {
    layers.push('');
    layers.push(sessionBlock);
  }

  const prompt = layers.filter(l => l !== null).join('\n');

  logger.logInfo('System prompt built', {
    instructorId,
    callerPhone,
    intent,
    hasSession: !!session,
    promptLength: prompt.length,
    hasLiveContext: !!instructorId,
  });

  return prompt;
}

/**
 * Lightweight version — returns only the live instructor context block.
 * Use to refresh context mid-call without rebuilding the full prompt.
 */
async function buildContextOnly(instructorId) {
  return buildContextBlock(instructorId);
}

module.exports = { buildSystemPrompt, buildContextOnly };
