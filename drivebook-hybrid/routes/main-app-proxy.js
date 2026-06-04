const express = require('express');
const axios = require('axios');
const config = require('../utils/config');
const logger = require('../utils/logger');

// Generated JS client (built): use dist index for runtime integration
const DriveBookClient = require('../generated-client-js/dist/index.js');
const ApiClient = DriveBookClient.ApiClient;
const AvailabilityApi = DriveBookClient.AvailabilityApi;
const InstructorsApi = DriveBookClient.InstructorsApi;
const PackagesApi = DriveBookClient.PackagesApi;
const BookingsApi = DriveBookClient.BookingsApi;
const VerificationsApi = DriveBookClient.VerificationsApi;
const SystemApi = DriveBookClient.SystemApi;

// Configure client to point at the configured DriveBook base URL and set service auth
ApiClient.instance.basePath = `${config.DRIVEBOOK_BASE_URL.replace(/\/$/, '')}/api`;
// Use bearer-style header with the internal service API key
ApiClient.instance.authentications.BearerAuth.apiKey = config.DRIVEBOOK_API_KEY;
ApiClient.instance.authentications.BearerAuth.apiKeyPrefix = 'Bearer';

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

// P1-8 FIX: Use an explicit allowlist of headers to forward rather than a denylist.
// Forwarding all headers blindly lets a caller inject x-forwarded-for, authorization,
// x-internal-user-id, or any header the main app trusts from "internal" sources.
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

  // Always set x-forwarded-for from the actual socket IP, never from a header the caller supplied
  headers['x-forwarded-for'] = req.socket?.remoteAddress || req.ip || 'unknown';
  if (req.requestId) {
    headers['x-request-id'] = req.requestId;
  }
  return headers;
}

async function proxyRequest(req, res, targetPath) {
  try {
    const targetUrl = buildTargetUrl(req, targetPath);
    const headers = buildForwardHeaders(req);
    const options = {
      method: req.method,
      headers,
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (req.body && Object.keys(req.body).length > 0) {
        options.body = JSON.stringify(req.body);
        if (!headers['content-type']) {
          options.headers['Content-Type'] = 'application/json';
        }
      }
    }

    logger.logInfo('Proxying request to main app', {
      requestId: req.requestId,
      method: req.method,
      targetUrl,
    });

    const axiosOptions = {
      method: req.method,
      url: targetUrl,
      headers: options.headers,
      data: options.body ? JSON.parse(options.body) : undefined,
      validateStatus: () => true,
      responseType: 'text',
      // FIX #9: Explicit timeout so slow upstream calls don't hang Twilio sessions.
      // Twilio's own TwiML timeout is 10s — give the backend 8s to respond.
      timeout: 8000,
    };

    const response = await axios(axiosOptions);
    const contentType = (response.headers && (response.headers['content-type'] || response.headers['Content-Type'])) || '';
    const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    res.status(response.status);
    if (contentType.includes('application/json')) {
      try {
        return res.json(JSON.parse(responseText));
      } catch (err) {
        return res.send(responseText);
      }
    }

    return res.send(responseText);
  } catch (error) {
    logger.logError(error, { requestId: req.requestId, path: targetPath });
    return res.status(502).json({ error: 'Failed to proxy request to main app' });
  }
}

// Public AI routes forwarded to main app
router.get('/health', (req, res) => {
  const api = new SystemApi();
  api.healthCheck((err, data, response) => {
    if (err) {
      logger.logError(err, { requestId: req.requestId });
      return res.status(response && response.status ? response.status : 502).json({ error: err.message || err });
    }
    return res.status(response && response.status ? response.status : 200).json(data);
  });
});

router.post('/locations/validate', (req, res) => proxyRequest(req, res, '/api/locations/validate'));

router.get('/instructors/recommendations', (req, res) => {
  const { location, vehicleType, language, budget, experienceLevel, limit } = req.query;
  const api = new InstructorsApi();
  api.getInstructorRecommendations(location, { vehicleType, language, budget, experienceLevel, limit }, (err, data, response) => {
    if (err) {
      logger.logError(err, { requestId: req.requestId });
      return res.status(response && response.status ? response.status : 502).json({ error: err.message || err });
    }
    return res.status(response && response.status ? response.status : 200).json(data);
  });
});

router.get('/instructors/search', (req, res) => {
  const { location } = req.query;
  const api = new InstructorsApi();
  api.searchInstructorsByLocation(location, (err, data, response) => {
    if (err) {
      logger.logError(err, { requestId: req.requestId });
      return res.status(response && response.status ? response.status : 502).json({ error: err.message || err });
    }
    return res.status(response && response.status ? response.status : 200).json(data);
  });
});

router.get('/packages', (req, res) => {
  const { instructorId } = req.query;
  const api = new PackagesApi();
  api.getPackages(instructorId, (err, data, response) => {
    if (err) {
      logger.logError(err, { requestId: req.requestId });
      return res.status(response && response.status ? response.status : 502).json({ error: err.message || err });
    }
    return res.status(response && response.status ? response.status : 200).json(data);
  });
});

router.get('/availability/slots', (req, res) => {
  const { instructorId, date, duration } = req.query;
  const api = new AvailabilityApi();
  api.getAvailableSlots(instructorId, date, { duration }, (err, data, response) => {
    if (err) {
      logger.logError(err, { requestId: req.requestId });
      return res.status(response && response.status ? response.status : 502).json({ error: err.message || err });
    }
    return res.status(response && response.status ? response.status : 200).json(data);
  });
});

router.post('/availability', (req, res) => {
  const { instructorId, date, duration } = req.query;
  const api = new AvailabilityApi();
  api.checkAvailability(instructorId, date, duration, { body: req.body }, (err, data, response) => {
    if (err) {
      logger.logError(err, { requestId: req.requestId });
      return res.status(response && response.status ? response.status : 502).json({ error: err.message || err });
    }
    return res.status(response && response.status ? response.status : 200).json(data);
  });
});

router.post('/public/bookings/bulk', (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['Idempotency-Key'];
  const api = new BookingsApi();
  api.createBooking(req.body, idempotencyKey, (err, data, response) => {
    if (err) {
      logger.logError(err, { requestId: req.requestId });
      return res.status(response && response.status ? response.status : 502).json({ error: err.message || err });
    }

    // FIX #4: Send payment link SMS immediately at booking creation time.
    // This is independent of whether the voice call stays connected.
    // Without this, a call disconnect after booking creation means the caller
    // never receives their payment URL and the booking expires silently.
    const phone = req.body && req.body.accountHolderPhone;
    if (data && data.checkoutUrl && phone) {
      const smsService = require('../services/sms-service');
      const msg = `Your DriveBook lesson is reserved for 10 minutes. Complete payment here: ${data.checkoutUrl}`;
      smsService.sendSms(phone, msg).catch((smsErr) => {
        logger.logError(smsErr, { requestId: req.requestId, context: 'booking-creation-sms' });
      });

      // SPRINT 3: Persist voice session so a call-back within 10 minutes triggers
      // recovery instead of starting a fresh booking flow.
      if (data.bookingId) {
        const voiceSession = require('../services/voice-session-service');
        const instructorId =
          (req.body && req.body.instructorId) || null;
        // instructorName may be resolved earlier by the AI; pass it if available
        const instructorName =
          (req.body && req.body._resolvedInstructorName) || null;
        voiceSession.saveSession(phone, {
          lastAction: 'BOOKING_CREATED',
          bookingId: data.bookingId,
          checkoutUrl: data.checkoutUrl,
          instructorId,
          instructorName,
        });
      }
    }

    return res.status(response && response.status ? response.status : 200).json(data);
  });
});

router.get('/bookings/lookup', (req, res) => {
  const { phone } = req.query;
  const api = new BookingsApi();
  api.lookupBookings(phone, (err, data, response) => {
    if (err) {
      logger.logError(err, { requestId: req.requestId });
      return res.status(response && response.status ? response.status : 502).json({ error: err.message || err });
    }
    return res.status(response && response.status ? response.status : 200).json(data);
  });
});

router.post('/verifications/otp', (req, res) => {
  const api = new VerificationsApi();
  api.sendOtp(req.body, (err, data, response) => {
    if (err) {
      logger.logError(err, { requestId: req.requestId });
      return res.status(response && response.status ? response.status : 502).json({ error: err.message || err });
    }
    return res.status(response && response.status ? response.status : 200).json(data);
  });
});

router.post('/verifications/otp/confirm', (req, res) => {
  const api = new VerificationsApi();
  api.confirmOtp(req.body, (err, data, response) => {
    if (err) {
      logger.logError(err, { requestId: req.requestId });
      return res.status(response && response.status ? response.status : 502).json({ error: err.message || err });
    }
    return res.status(response && response.status ? response.status : 200).json(data);
  });
});

router.get('/public/bookings/:id', (req, res) => proxyRequest(req, res, `/api/public/bookings/${req.params.id}`));

router.post('/public/bookings/:id/cancel', (req, res) => {
  const verificationToken = req.headers['x-verification-token'];
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['Idempotency-Key'];
  const api = new BookingsApi();
  api.cancelBooking(req.params.id, verificationToken, idempotencyKey, req.body, (err, data, response) => {
    if (err) {
      logger.logError(err, { requestId: req.requestId });
      return res.status(response && response.status ? response.status : 502).json({ error: err.message || err });
    }
    return res.status(response && response.status ? response.status : 200).json(data);
  });
});

router.post('/public/bookings/:id/reschedule', (req, res) => {
  const verificationToken = req.headers['x-verification-token'];
  const api = new BookingsApi();
  api.rescheduleBooking(req.params.id, req.body, verificationToken, (err, data, response) => {
    if (err) {
      logger.logError(err, { requestId: req.requestId });
      return res.status(response && response.status ? response.status : 502).json({ error: err.message || err });
    }
    return res.status(response && response.status ? response.status : 200).json(data);
  });
});

module.exports = router;
