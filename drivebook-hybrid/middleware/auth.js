const config = require('../utils/config');

/**
 * Middleware to restrict access to voice service
 * Only allows:
 * 1. Twilio webhooks (validated signature)
 * 2. Health check endpoint (for monitoring)
 */
function restrictAccess(req, res, next) {
  // Allow health check
  if (req.path === '/api/health') {
    return next();
  }

  // Allow Twilio webhooks (signature will be validated in route)
  if (req.path.startsWith('/api/voice') || req.path.startsWith('/api/bookings') || req.path.startsWith('/api/instructor')) {
    return next();
  }

  // Block all other access
  res.status(403).json({ 
    error: 'Forbidden',
    message: 'This service is not publicly accessible'
  });
}

/**
 * Middleware to hide API documentation from public
 */
function hideApiDocs(req, res, next) {
  // Block root endpoint that shows API docs
  if (req.path === '/' && req.method === 'GET') {
    // Only show docs if request has valid API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === config.INTERNAL_API_KEY) {
      return next();
    }
    
    // Otherwise return minimal response
    return res.status(200).json({ 
      status: 'ok',
      message: 'Voice service is running'
    });
  }
  next();
}

module.exports = { restrictAccess, hideApiDocs };
