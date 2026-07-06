/**
 * Main App Proxy
 *
 * Forwards AI/voice service API calls to the main DriveBook application.
 *
 * FIX (June 19, 2026): The original file required '../generated-client-js/dist/index.js'
 * which does not exist (directory is 'generated-client', TypeScript source only, no dist).
 * This caused the voice service to crash on startup — no calls could be handled.
 *
 * All routes now use direct axios proxy calls (consistent with proxyRequest() already
 * in this file). The generated client is not needed at runtime.
 */

const express = require('express');
const axios = require('axios');
const { randomUUID } = require('crypto');
const config = require('../utils/config');
const logger = require('../utils/logger');
const voiceSession = require('../services/voice-session-service');
const smsService = require('../services/sms-service');

const router = express.Router();

function buildTargetUrl(req, targetPath) {
  const url = new URL(`${config.DRIVEBOOK_BASE_URL}${targetPath}`);
  Object.entries(req.query || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, item));
    } else if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });
  return url.toString();
}

// P1-8 FIX: Explicit allowlist — never forward authorization, x-forwarded-for, or
// internal trust headers the main app might act on.
const ALLOWED_FORWARD_HEADERS = new Set([
  'content-type',
  'idempotency-key',
  'x-verification-token',
  'x-request-id',
  'accept',
  'accept-language',
  'x-twilio-signature',
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
  // Always set x-forwarded-for from the actual socket IP, never from caller-supplied header
  headers['x-forwarded-for'] = req.socket?.remoteAddress || req.ip || 'unknown';
  if (req.requestId) headers['x-request-id'] = req.requestId;
  // Authenticate to the main app as the voice service
  if (config.DRIVEBOOK_API_KEY) headers['x-api-key'] = config.DRIVEBOOK_API_KEY;
  return headers;
}

async function proxyRequest(req, res, targetPath) {
  try {
    const targetUrl = buildTargetUrl(req, targetPath);
    const headers = buildForwardHeaders(req);

    let data;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (req.body && Object.keys(req.body).length > 0) {
        data = req.body;
        if (!headers['content-type']) headers['content-type'] = 'application/json';
      }
    }

    logger.logInfo('Proxying request to main app', {
      requestId: req.requestId,
      method: req.method,
      targetUrl,
    });

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers,
      data,
      validateStatus: () => true,
      // FIX #9: Explicit timeout — Twilio's TwiML timeout is 10s, give backend 8s.
      timeout: 8000,
    });

    const contentType = response.headers?.['content-type'] || '';
    res.status(response.status);
    if (contentType.includes('application/json')) {
      return res.json(response.data);
    }
    return res.send(
      typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    );
  } catch (error) {
    logger.logError(error, { requestId: req.requestId, path: targetPath });
    return res.status(502).json({ error: 'Failed to proxy request to main app' });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/health', (req, res) => proxyRequest(req, res, '/api/health'));

// Voice line instructor lookup — resolves which instructor owns a dialled Twilio number
// Called by voice-webhook.js on every incoming call to determine line type
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

/**
 * POST /public/bookings/bulk
 *
 * Creates a booking and immediately sends a payment SMS so the customer
 * gets the payment link even if the call drops.
 * Also persists a voice session for 10-min call-back recovery.
 */
router.post('/public/bookings/bulk', async (req, res) => {
  try {
    const targetUrl = buildTargetUrl(req, '/api/public/bookings/bulk');
    const headers = buildForwardHeaders(req);
    if (!headers['content-type']) headers['content-type'] = 'application/json';

    const idempotencyKey = req.headers['idempotency-key'] || req.headers['Idempotency-Key'];
    // Gap 4 fix: auto-generate Idempotency-Key if not supplied — prevents duplicate bookings on retry
    headers['idempotency-key'] = idempotencyKey || randomUUID();

    logger.logInfo('Proxying booking creation', { requestId: req.requestId, targetUrl });

    const response = await axios({
      method: 'POST',
      url: targetUrl,
      headers,
      data: req.body,
      validateStatus: () => true,
      timeout: 8000,
    });

    // Gap 4: SMS only sent for normal bookings (isShortNotice=false, checkoutUrl present)
    // Short-notice bookings return status PENDING with no checkoutUrl — instructor must approve first
    const phone = req.body?.accountHolderPhone;
    const data = response.data;
    if (data && data.checkoutUrl && phone && !data.isShortNotice) {
      const msg = `Your DriveBook lesson is reserved for 10 minutes. Complete payment here: ${data.checkoutUrl}`;
      smsService.sendSms(phone, msg).catch((smsErr) =>
        logger.logError(smsErr, { requestId: req.requestId, context: 'booking-creation-sms' })
      );

      // Persist voice session so a call-back within 10 min triggers recovery
      if (data.bookingId) {
        voiceSession.saveSession(phone, {
          lastAction: 'BOOKING_CREATED',
          bookingId: data.bookingId,
          checkoutUrl: data.checkoutUrl,
          instructorId: req.body?.instructorId || null,
          instructorName: req.body?._resolvedInstructorName || null,
        });
      }
    } else if (data && data.isShortNotice && data.bookingId && phone) {
      // Gap 2: Short-notice booking — save session without checkoutUrl, await instructor approval
      logger.logInfo('Short-notice booking created — awaiting instructor approval', {
        requestId: req.requestId,
        bookingId: data.bookingId,
      });
      voiceSession.saveSession(phone, {
        lastAction: 'AWAITING_APPROVAL',
        bookingId: data.bookingId,
        instructorId: req.body?.instructorId || null,
        instructorName: req.body?._resolvedInstructorName || null,
      });
    }

    return res.status(response.status).json(data);
  } catch (error) {
    logger.logError(error, { requestId: req.requestId, path: '/public/bookings/bulk' });
    return res.status(502).json({ error: 'Failed to proxy request to main app' });
  }
});

router.get('/bookings/lookup', (req, res) =>
  proxyRequest(req, res, '/api/bookings/lookup')
);

router.post('/verifications/otp', async (req, res) => {
  // M5 fix: persist AWAITING_OTP session so call-back recovery knows the context
  const phone = req.body?.phone;
  const purpose = req.body?.purpose; // 'cancel' | 'reschedule'
  if (phone && purpose) {
    voiceSession.saveSession(phone, {
      lastAction: 'AWAITING_OTP',
      otpPurpose: purpose,
    }).catch(() => {}); // non-fatal
  }
  return proxyRequest(req, res, '/api/verifications/otp');
});

router.post('/verifications/otp/confirm', (req, res) =>
  proxyRequest(req, res, '/api/verifications/otp/confirm')
);

//  Sub-routes registered BEFORE generic :id to prevent shadowing 

router.post('/public/bookings/:id/cancel', (req, res) => {
  // Gap 21: auto-generate Idempotency-Key for cancel to prevent double-cancel on retry
  req.headers['idempotency-key'] = req.headers['idempotency-key'] || randomUUID();
  return proxyRequest(req, res, `/api/public/bookings/${req.params.id}/cancel`);
});

router.post('/public/bookings/:id/reschedule', (req, res) => {
  // Gap 21: auto-generate Idempotency-Key for reschedule to prevent double-reschedule on retry
  req.headers['idempotency-key'] = req.headers['idempotency-key'] || randomUUID();
  return proxyRequest(req, res, `/api/public/bookings/${req.params.id}/reschedule`);
});

// Gap 8: payment status polling  lean endpoint, use canPay field directly
router.get('/public/bookings/:id/payment-status', (req, res) =>
  proxyRequest(req, res, `/api/public/bookings/${req.params.id}/payment-status`)
);

// Gap 9: booking timeline — human-readable events for AI to read aloud
router.get('/public/bookings/:id/timeline', (req, res) =>
  proxyRequest(req, res, `/api/public/bookings/${req.params.id}/timeline`)
);

// Generic booking detail  after sub-routes so it does not shadow them
router.get('/public/bookings/:id', (req, res) =>
  proxyRequest(req, res, `/api/public/bookings/${req.params.id}`)
);

// Gap 1: cancellation policy  call BEFORE cancelling to get exact refund amount
router.get('/bookings/:id/cancellation-policy', (req, res) =>
  proxyRequest(req, res, `/api/bookings/${req.params.id}/cancellation-policy`)
);

module.exports = router;