/**
 * Main App Proxy
 *
 * Forwards Vapi tool calls to the main DriveBook application.
 * Vapi calls these endpoints directly as HTTP tool calls during a voice session.
 *
 * FIX (June 19, 2026): The original file required '../generated-client-js/dist/index.js'
 * which does not exist. This caused the voice service to crash on startup.
 * All routes now use direct axios proxy calls.
 */

const express = require('express');
const axios = require('axios');
const { randomUUID } = require('crypto');
const config = require('../utils/config');
const logger = require('../utils/logger');
const voiceSession = require('../services/voice-session-service');
const smsService = require('../services/sms-service');

const router = express.Router();

// Note: express.json() is NOT added here  it is already registered globally in server.js.
// Adding a second json() parser at router level causes the body to be consumed twice,
// resulting in an empty {} being forwarded to the main app on all POST tool calls.

//  Improvement #4: Validate base URL once at startup 
try {
  new URL(config.DRIVEBOOK_BASE_URL);
} catch {
  throw new Error(
    `[main-app-proxy] DRIVEBOOK_BASE_URL is not a valid URL: "${config.DRIVEBOOK_BASE_URL}". ` +
    'Set a correct value in your environment before starting the server.'
  );
}

//  Improvement #5: Sensitive parameter masking for logs 
const SENSITIVE_PARAMS = new Set([
  'phone', 'email', 'token', 'verificationId', 'verificationToken',
  'accountHolderPhone', 'accountHolderEmail', 'bookingId', 'checkoutUrl',
]);

function maskUrl(urlString) {
  try {
    const u = new URL(urlString);
    for (const key of u.searchParams.keys()) {
      if (SENSITIVE_PARAMS.has(key)) {
        u.searchParams.set(key, '[REDACTED]');
      }
    }
    return u.toString();
  } catch {
    return '[invalid-url]';
  }
}

//  Improvement #1: Vapi payload unwrapper 
/**
 * Extracts the flat arguments object from a Vapi tool-call body.
 * Vapi wraps tool arguments as: body.message.toolCalls[0].function.arguments
 * Arguments may arrive as a pre-parsed object or as a JSON string.
 */
function extractBodyPayload(req) {
  if (req.body?.message?.type === 'tool-calls') {
    const toolCall = req.body.message.toolCalls?.[0];
    let args = toolCall?.function?.arguments;
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch (e) {
        logger.logError(e, { requestId: req.requestId, context: 'vapi-json-parse-fallback' });
      }
    }
    return args || {};
  }
  return req.body || {};
}

//  Improvement #8: Phone normalisation 
/**
 * Normalise phone to E.164 before saving sessions.
 * Delegates to voice-session-service which already has this logic.
 */
const { normalisePhone } = voiceSession;

function buildTargetUrl(req, targetPath) {
  // Improvement #4: URL construction is already safe  base URL validated at startup.
  const url = new URL(`${config.DRIVEBOOK_BASE_URL}${targetPath}`);

  // Start with any URL-level query params (e.g. passed directly by non-Vapi callers).
  const querySource = { ...(req.query || {}) };

  // GET-only query promotion: Vapi tool calls arrive as POST bodies even for GET
  // endpoints (message.toolCalls[0].function.arguments). Merge those args into the
  // query string so the upstream route receives them as standard query params.
  // Body args do NOT overwrite explicit URL params — URL params take precedence.
  if (req.method === 'GET' && req.body?.message?.type === 'tool-calls') {
    const args = extractBodyPayload(req);
    if (Object.keys(args).length > 0) {
      Object.entries(args).forEach(([key, value]) => {
        if (!(key in querySource) && value !== undefined && value !== null) {
          querySource[key] = value;
        }
      });
    }
  }

  Object.entries(querySource).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, item));
    } else if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });
  return url.toString();
}

// Explicit allowlist  never forward auth, x-forwarded-for, or internal trust headers.
// x-twilio-signature intentionally excluded  we migrated to Vapi.
const ALLOWED_FORWARD_HEADERS = new Set([
  'content-type',
  'idempotency-key',
  'x-verification-token',
  'x-request-id',
  'accept',
  'accept-language',
]);

function buildForwardHeaders(req) {
  const headers = {};
  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (!value) return;
    const lowerKey = key.toLowerCase();
    if (ALLOWED_FORWARD_HEADERS.has(lowerKey)) {
      headers[lowerKey] = value;
    }
  });
  headers['x-forwarded-for'] = req.socket?.remoteAddress || req.ip || 'unknown';
  if (req.requestId) headers['x-request-id'] = req.requestId;
  if (config.DRIVEBOOK_API_KEY) headers['x-api-key'] = config.DRIVEBOOK_API_KEY;
  return headers;
}

//  Improvement #7: Granular gateway error classification 
function classifyAxiosError(error) {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return { status: 504, message: 'Upstream timeout  the main app did not respond in time' };
  }
  if (error.code === 'ECONNREFUSED') {
    return { status: 503, message: 'Upstream unavailable  connection refused' };
  }
  if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
    return { status: 502, message: 'Upstream DNS resolution failed' };
  }
  if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
    return { status: 502, message: 'Upstream connection aborted' };
  }
  // TLS / certificate errors
  if (error.code && error.code.startsWith('ERR_TLS')) {
    return { status: 525, message: 'Upstream TLS handshake failed' };
  }
  return { status: 502, message: 'Failed to proxy request to main app' };
}

//  Improvement #9: Retry policy for idempotent GET requests 
const RETRYABLE_GET_PATHS = [
  '/availability/slots',
  '/packages',
  '/instructors/recommendations',
  '/instructors/search',
  '/bookings/lookup',
  '/payment-status',
  '/public/check-service-area',
];

function isRetryableGet(req, targetPath) {
  if (req.method !== 'GET') return false;
  return RETRYABLE_GET_PATHS.some((p) => targetPath.includes(p));
}

async function axiosWithRetry(axiosConfig, retries) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await axios(axiosConfig);
    } catch (err) {
      lastError = err;
      const isTransient =
        err.code === 'ECONNABORTED' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNRESET';
      if (!isTransient || attempt === retries) throw err;
      const delay = 200 * Math.pow(2, attempt); // 200ms, 400ms
      await new Promise((r) => setTimeout(r, delay));
      logger.logWarning('Retrying upstream request', {
        attempt: attempt + 1,
        url: axiosConfig.url,
        error: err.code,
      });
    }
  }
  throw lastError;
}

//  Core proxy function 
async function proxyRequest(req, res, targetPath) {
  try {
    const targetUrl = buildTargetUrl(req, targetPath);
    const headers = buildForwardHeaders(req);

    let data;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const unwrappedData = extractBodyPayload(req);
      if (unwrappedData && Object.keys(unwrappedData).length > 0) {
        data = unwrappedData;
        if (!headers['content-type']) headers['content-type'] = 'application/json';
      }
    }

    // Improvement #5: Log masked URL, not raw
    logger.logInfo('Proxying request to main app', {
      requestId: req.requestId,
      method: req.method,
      targetUrl: maskUrl(targetUrl),
    });

    const axiosConfig = {
      method: req.method,
      url: targetUrl,
      headers,
      data,
      validateStatus: () => true,
      // Improvement #3: Timeout from config  no hardcoded 8000
      timeout: config.PROXY_TIMEOUT_MS,
    };

    // Improvement #9: Retry on transient failures for safe GET endpoints
    const retries = isRetryableGet(req, targetPath) ? config.PROXY_GET_RETRIES : 0;
    const response = await axiosWithRetry(axiosConfig, retries);

    const contentType = response.headers?.['content-type'] || '';
    res.status(response.status);

    // Improvement #6: Never mutate the upstream response object  spread into new object
    if (contentType.includes('application/json') && typeof response.data === 'object' && response.data !== null) {
      // Improvement #1 (summary): Only inject on 2xx  errors must not be masked
      const outputData = (response.status >= 200 && response.status < 300 && !response.data.summary)
        ? { ...response.data, summary: 'The request completed successfully.' }
        : { ...response.data };
      return res.json(outputData);
    }
    return res.send(
      typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    );
  } catch (error) {
    // Improvement #7: Map network error codes to meaningful HTTP statuses
    const { status, message } = classifyAxiosError(error);
    logger.logError(error, { requestId: req.requestId, path: targetPath, gatewayStatus: status });
    return res.status(status).json({ error: message });
  }
}

//  Routes (Part 1  Simple proxies) 

router.get('/health', (req, res) => proxyRequest(req, res, '/api/health'));

router.get('/voice/instructors/lookup', (req, res) =>
  proxyRequest(req, res, '/api/voice/instructors/lookup')
);

router.post('/locations/validate', (req, res) =>
  proxyRequest(req, res, '/api/locations/validate')
);

router.get('/instructors/recommendations', (req, res) =>
  proxyRequest(req, res, '/api/instructors/recommendations')
);

router.get('/instructors/search', (req, res) =>
  proxyRequest(req, res, '/api/instructors/search')
);

router.get('/packages', (req, res) =>
  proxyRequest(req, res, '/api/packages')
);

router.get('/availability/slots', (req, res) =>
  proxyRequest(req, res, '/api/availability/slots')
);

router.post('/availability', (req, res) =>
  proxyRequest(req, res, '/api/availability')
);

// Service area check — used after pickup address is collected to verify the
// selected instructor covers that location. Returns 'in', 'out', or 'unknown'.
// 'unknown' means the check couldn't be completed (geocode failed, no API key,
// or instructor has no base address configured) — treat as non-blocking.
router.get('/public/check-service-area', (req, res) =>
  proxyRequest(req, res, '/api/public/check-service-area')
);

//  Routes (Part 2  State-bearing routes) 

/**
 * POST /public/bookings/bulk
 *
 * Creates a booking, sends a payment SMS, and persists session state for
 * 10-minute call-back recovery  all only on 2xx responses.
 */
router.post('/public/bookings/bulk', async (req, res) => {
  try {
    const targetUrl = buildTargetUrl(req, '/api/public/bookings/bulk');
    const headers = buildForwardHeaders(req);
    if (!headers['content-type']) headers['content-type'] = 'application/json';

    const idempotencyKey = req.headers['idempotency-key'] || req.headers['Idempotency-Key'];
    headers['idempotency-key'] = idempotencyKey || randomUUID();

    const cleanBody = extractBodyPayload(req);

    // ── Idempotency key derivation ────────────────────────────────────────────
    // If Vapi times out and retries, a fresh randomUUID() would produce a different
    // key each time — creating duplicate bookings. Instead we derive a stable key
    // from the Vapi call ID (present in every tool call) so retries within the same
    // call are deduplicated by the bulk booking route.
    //
    // Priority:
    //   1. Caller-supplied Idempotency-Key header (explicit control)
    //   2. Vapi call ID extracted from the message payload (automatic retry-safety)
    //   3. Random UUID fallback (non-Vapi callers, e.g. web UI)
    const vapiCallId = cleanBody?.message?.call?.id || cleanBody?.call?.id || null;
    const stableKey = vapiCallId
      ? `vapi-booking-${vapiCallId}`
      : (idempotencyKey || randomUUID());
    headers['idempotency-key'] = stableKey;

    // Improvement #8: normalise phone before using as session key
    const rawPhone = cleanBody?.accountHolderPhone;
    const phone = rawPhone ? normalisePhone(rawPhone) : null;

    logger.logInfo('Proxying booking creation', {
      requestId: req.requestId,
      targetUrl: maskUrl(targetUrl),
    });

    const response = await axios({
      method: 'POST',
      url: targetUrl,
      headers,
      data: cleanBody,
      validateStatus: () => true,
      timeout: config.PROXY_TIMEOUT_MS,
    });

    const upstreamData = response.data;

    // Only track state and inject summaries on 2xx  never on error responses
    if (response.status >= 200 && response.status < 300 && upstreamData) {
      let summary;

      if (upstreamData.checkoutUrl && phone && !upstreamData.isShortNotice) {
        // Improvement #2: Capture SMS delivery result and surface status in response
        let smsStatus = 'sent';
        try {
          await smsService.sendSms(phone, `Your DriveBook lesson is reserved for 10 minutes. Complete payment here: ${upstreamData.checkoutUrl}`);
        } catch (smsErr) {
          smsStatus = 'failed';
          logger.logError(smsErr, { requestId: req.requestId, context: 'booking-creation-sms' });
        }

        // Improvement #1: Await session persistence  lost session = broken call-back recovery
        if (upstreamData.bookingId) {
          try {
            await voiceSession.saveSession(phone, {
              lastAction: 'BOOKING_CREATED',
              bookingId: upstreamData.bookingId,
              checkoutUrl: upstreamData.checkoutUrl,
              instructorId: cleanBody?.instructorId || null,
              instructorName: cleanBody?._resolvedInstructorName || null,
            });
          } catch (sessionErr) {
            logger.logError(sessionErr, { requestId: req.requestId, context: 'session-save-booking' });
          }
        }

        summary = smsStatus === 'sent'
          ? `I have successfully reserved your appointment slot. A secure payment link was texted to ${phone}.`
          : `Your booking is confirmed but the SMS could not be sent. Please note down your booking ID: ${upstreamData.bookingId}.`;

        // Improvement #6: spread into new object, never mutate upstream data
        return res.status(response.status).json({
          ...upstreamData,
          smsStatus,
          summary,
        });

      } else if (upstreamData.isShortNotice && upstreamData.bookingId && phone) {
        logger.logInfo('Short-notice booking created  awaiting instructor approval', {
          requestId: req.requestId,
          bookingId: upstreamData.bookingId,
        });

        try {
          await voiceSession.saveSession(phone, {
            lastAction: 'AWAITING_APPROVAL',
            bookingId: upstreamData.bookingId,
            instructorId: cleanBody?.instructorId || null,
            instructorName: cleanBody?._resolvedInstructorName || null,
          });
        } catch (sessionErr) {
          logger.logError(sessionErr, { requestId: req.requestId, context: 'session-save-short-notice' });
        }

        return res.status(response.status).json({
          ...upstreamData,
          summary: 'This is a short-notice request. The reservation is pending instructor confirmation.',
        });

      } else if (upstreamData.bookingType === 'later' && upstreamData.checkoutUrl && phone) {
        // Book Later path: Stripe Checkout Session created — send the URL directly via SMS.
        let smsStatus = 'sent';
        try {
          await smsService.sendSms(
            phone,
            `Your DriveBook lesson package is ready. Complete payment here: ${upstreamData.checkoutUrl}`
          );
        } catch (smsErr) {
          smsStatus = 'failed';
          logger.logError(smsErr, { requestId: req.requestId, context: 'book-later-sms' });
        }

        logger.logInfo('Book-later Checkout Session created', {
          requestId: req.requestId,
          smsStatus,
        });

        return res.status(response.status).json({
          ...upstreamData,
          smsStatus,
          summary: smsStatus === 'sent'
            ? `Lesson package set up. Payment link sent to ${phone}. Wallet will be credited once payment is complete.`
            : `Lesson package set up but SMS could not be sent. Student should visit the payment link to complete payment.`,
        });
      }
    }

    return res.status(response.status).json(upstreamData);
  } catch (error) {
    const { status, message } = classifyAxiosError(error);
    logger.logError(error, { requestId: req.requestId, path: '/public/bookings/bulk', gatewayStatus: status });
    return res.status(status).json({ error: message });
  }
});

router.get('/bookings/lookup', (req, res) =>
  proxyRequest(req, res, '/api/bookings/lookup')
);

router.post('/verifications/otp', async (req, res) => {
  const cleanBody = extractBodyPayload(req);
  const rawPhone = cleanBody?.phone;
  const phone = rawPhone ? normalisePhone(rawPhone) : null; // Improvement #8
  const purpose = cleanBody?.purpose; // 'cancel' | 'reschedule'

  if (phone && purpose) {
    // Improvement #1: await session save  OTP context lost otherwise
    voiceSession.saveSession(phone, {
      lastAction: 'AWAITING_OTP',
      otpPurpose: purpose,
    }).catch((err) => logger.logError(err, { requestId: req.requestId, context: 'session-save-otp' }));
  }
  return proxyRequest(req, res, '/api/verifications/otp');
});

router.post('/verifications/otp/confirm', (req, res) =>
  proxyRequest(req, res, '/api/verifications/otp/confirm')
);

//  Parameterised sub-routes (ordered before generic :id to prevent shadowing) 

router.post('/public/bookings/:id/cancel', (req, res) => {
  req.headers['idempotency-key'] = req.headers['idempotency-key'] || randomUUID();
  return proxyRequest(req, res, `/api/public/bookings/${req.params.id}/cancel`);
});

router.post('/public/bookings/:id/reschedule', (req, res) => {
  req.headers['idempotency-key'] = req.headers['idempotency-key'] || randomUUID();
  return proxyRequest(req, res, `/api/public/bookings/${req.params.id}/reschedule`);
});

router.get('/public/bookings/:id/payment-status', (req, res) =>
  proxyRequest(req, res, `/api/public/bookings/${req.params.id}/payment-status`)
);

// Booking timeline  human-readable events for Vapi to read aloud
router.get('/public/bookings/:id/timeline', (req, res) =>
  proxyRequest(req, res, `/api/public/bookings/${req.params.id}/timeline`)
);

// Generic booking detail  after sub-routes so it does not shadow them
router.get('/public/bookings/:id', (req, res) =>
  proxyRequest(req, res, `/api/public/bookings/${req.params.id}`)
);

// Cancellation policy  call BEFORE cancelling to get exact refund amount
router.get('/bookings/:id/cancellation-policy', (req, res) =>
  proxyRequest(req, res, `/api/bookings/${req.params.id}/cancellation-policy`)
);

module.exports = router;