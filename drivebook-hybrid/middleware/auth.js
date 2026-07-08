'use strict';

const config = require('../utils/config');

/**
 * restrictAccess
 *
 * Allowlist-based access control for the hybrid service.
 * Only routes explicitly listed here are reachable from outside.
 * Everything else returns 403.
 *
 * Vapi tool calls arrive as standard HTTP requests  no special auth header.
 * The x-api-key authenticating this service to the main app is added in
 * buildForwardHeaders() (main-app-proxy.js), not here.
 */
function restrictAccess(req, res, next) {
  // Test environment: allow everything  no network or auth setup needed
  if (config.NODE_ENV === 'test') {
    return next();
  }

  // Health check  always open for monitoring (Railway, UptimeRobot, etc.)
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
 *
 * /docs and /HOMEPAGE.html are protected by restrictAccess (they come after it
 * in the middleware chain in server.js).
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

module.exports = { restrictAccess, hideApiDocs };