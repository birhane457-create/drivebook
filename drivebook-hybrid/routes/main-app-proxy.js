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

function buildForwardHeaders(req) {
  const headers = {};
  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (!value) return;
    const lowerKey = key.toLowerCase();
    if (['host', 'content-length', 'connection'].includes(lowerKey)) return;
    headers[key] = value;
  });

  headers['x-forwarded-for'] = req.headers['x-forwarded-for'] || req.ip;
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
