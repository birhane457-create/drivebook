const express = require('express');
const fetch = global.fetch || require('node-fetch');
const config = require('../utils/config');
const logger = require('../utils/logger');

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

    const response = await fetch(targetUrl, options);
    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text();

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
router.post('/locations/validate', (req, res) => proxyRequest(req, res, '/api/locations/validate'));
router.get('/instructors/recommendations', (req, res) => proxyRequest(req, res, '/api/instructors/recommendations'));
router.get('/instructors/search', (req, res) => proxyRequest(req, res, '/api/instructors/search'));
router.get('/packages', (req, res) => proxyRequest(req, res, '/api/packages'));
router.get('/availability/slots', (req, res) => proxyRequest(req, res, '/api/availability/slots'));
router.post('/availability', (req, res) => proxyRequest(req, res, '/api/availability'));
router.post('/public/bookings/bulk', (req, res) => proxyRequest(req, res, '/api/public/bookings/bulk'));
router.get('/bookings/lookup', (req, res) => proxyRequest(req, res, '/api/bookings/lookup'));
router.post('/verifications/otp', (req, res) => proxyRequest(req, res, '/api/verifications/otp'));
router.post('/verifications/otp/confirm', (req, res) => proxyRequest(req, res, '/api/verifications/otp/confirm'));
router.post('/public/bookings/:id/cancel', (req, res) => proxyRequest(req, res, `/api/public/bookings/${req.params.id}/cancel`));
router.post('/public/bookings/:id/reschedule', (req, res) => proxyRequest(req, res, `/api/public/bookings/${req.params.id}/reschedule`));

module.exports = router;
