const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const { randomUUID } = require('crypto');
const config = require('./utils/config');
const logger = require('./utils/logger');
// Fix #1: Use shared Prisma client  prevents duplicate connection pools
const prisma = require('./utils/prisma');

const bookingRouter = require('./routes/booking-api');
const instructorRouter = require('./routes/instructor-api');
const mainAppProxyRouter = require('./routes/main-app-proxy');
const { restrictAccess, hideApiDocs, verifyVapiSecret, ipRateLimit } = require('./middleware/auth');
const voiceSession = require('./services/voice-session-service');

const app = express();
// Harden: remove X-Powered-By header (helmet does not remove this automatically)
app.disable('x-powered-by');
// Fix #2: Trust first proxy hop so req.ip reflects real client IP for rate limiting
app.set('trust proxy', 1);

// Security: Configure CORS properly
const corsOptions = {
  origin: config.ALLOWED_ORIGINS || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
// Twilio fallback parsed body config left intact for backward payload parsing compatibility
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(morgan('combined'));

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// Request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(config.REQUEST_TIMEOUT, () => {
    logger.logWarning('Request timeout', {
      requestId: req.requestId,
      method: req.method,
      path: req.path
    });
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

// NOTE: /api/voice/* routes removed -- Vapi now owns the phone call entirely.
// Vapi calls this service's proxy endpoints directly as tool calls.

// =========================================================================
// 1. SECURITY PERIMETER (Applied strictly to all subsequent endpoints)
// =========================================================================
app.use(hideApiDocs);
// Verify Vapi tool calls carry the correct shared secret (x-vapi-secret header).
// Skipped for health check and legacy local endpoints.
// No-ops in dev when VAPI_WEBHOOK_SECRET is unset; hard-fails in production.
app.use(verifyVapiSecret);
// Per-IP rate limit: 60 requests/minute. Defence-in-depth before forwarding to main app.
app.use(ipRateLimit);
app.use(restrictAccess);

// =========================================================================
// 2. EXPLICIT SPECIFIC MICROSERVICE ROUTES (Evaluated first)
// =========================================================================
app.use('/api/bookings', bookingRouter);
app.use('/api/instructor', instructorRouter);

// Enhanced health check with database verification
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      database: 'connected',
      timestamp: new Date().toISOString(),
      session: voiceSession.getMetrics(),
    });
  } catch (error) {
    logger.logError(error, { context: 'health-check' });
    res.status(503).json({
      status: 'error',
      uptime: process.uptime(),
      database: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// =========================================================================
// 3. CATCH-ALL ROUTE PROXY (Evaluated only if no specific routes above match)
// =========================================================================
app.use('/api', mainAppProxyRouter);

// =========================================================================
// 4. STATIC FILES & DOCUMENTATION (Protected by restrictAccess & hideApiDocs)
// =========================================================================
app.use('/docs', express.static(path.join(__dirname, 'docs')));
app.get('/HOMEPAGE.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'HOMEPAGE.html'));
});

// VAPI server event webhook — VAPI POSTs call lifecycle events (call-start, call-end,
// status-update, hang, speech-update) to serverUrl which is the root of this service.
// All inbound POST / requests arrive here after passing verifyVapiSecret.
//
// TOOL CALL DISPATCH TABLE
// Maps VAPI operationId → { method, targetPath }
// VAPI sends ALL tool calls as POST / with message.type = 'tool-calls'.
// We resolve the real HTTP method + path and forward via axios to the main app.
const TOOL_DISPATCH = {
  getInstructorRecommendations: { method: 'GET',  targetPath: '/api/instructors/recommendations' },
  findInstructors:              { method: 'GET',  targetPath: '/api/instructors/recommendations' },
  searchInstructorsByLocation:  { method: 'GET',  targetPath: '/api/instructors/search' },
  getPackages:                  { method: 'GET',  targetPath: '/api/packages' },
  getAvailableSlots:            { method: 'GET',  targetPath: '/api/availability/slots' },
  checkAvailability:            { method: 'POST', targetPath: '/api/availability' },
  validateLocation:             { method: 'POST', targetPath: '/api/locations/validate' },
  createBooking:                { method: 'POST', targetPath: '/api/public/bookings/bulk' },
  lookupBookings:               { method: 'GET',  targetPath: '/api/bookings/lookup' },
  sendOtp:                      { method: 'POST', targetPath: '/api/verifications/otp' },
  confirmOtp:                   { method: 'POST', targetPath: '/api/verifications/otp/confirm' },
  getPaymentStatus:             { method: 'GET',  targetPath: '/api/public/bookings/:id/payment-status' },
  getPaymentSummary:            { method: 'GET',  targetPath: '/api/public/bookings/:id/payment-status' },
  getPublicBooking:             { method: 'GET',  targetPath: '/api/public/bookings/:id' },
  getBookingTimeline:           { method: 'GET',  targetPath: '/api/public/bookings/:id/timeline' },
  getCancellationPolicy:        { method: 'GET',  targetPath: '/api/bookings/:id/cancellation-policy' },
  cancelBooking:                { method: 'POST', targetPath: '/api/public/bookings/:id/cancel' },
  rescheduleBooking:            { method: 'POST', targetPath: '/api/public/bookings/:id/reschedule' },
  checkServiceArea:             { method: 'GET',  targetPath: '/api/public/check-service-area' },
  lookupInstructor:             { method: 'GET',  targetPath: '/api/voice/instructors/lookup' },
  healthCheck:                  { method: 'GET',  targetPath: '/api/health' },
};

// Keep-alive agents for the tool-call dispatcher (reused across all tool calls in a session)
const _httpAgent  = new http.Agent({ keepAlive: true, keepAliveMsecs: 30000, maxSockets: 20 });
const _httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 30000, maxSockets: 20 });

async function dispatchToolCall(req, res, toolName, args) {
  const dispatch = TOOL_DISPATCH[toolName];
  if (!dispatch) {
    logger.logWarning('[VAPI tool-call] Unknown tool', { toolName, requestId: req.requestId });
    return res.status(400).json({ error: `Unknown tool: ${toolName}` });
  }

  // Resolve :id placeholder from args
  const id = args.id || args.bookingId || null;
  let targetPath = id ? dispatch.targetPath.replace(':id', id) : dispatch.targetPath;

  // Build the full upstream URL
  const baseUrl = config.DRIVEBOOK_BASE_URL.replace(/\/$/, '');
  let targetUrl = `${baseUrl}${targetPath}`;

  // For GET requests, append args as query params
  if (dispatch.method === 'GET' && Object.keys(args).length > 0) {
    const qs = Object.entries(args)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) targetUrl += `?${qs}`;
  }

  logger.logInfo('[VAPI tool-call] Dispatching', {
    toolName,
    method: dispatch.method,
    targetUrl: targetUrl.replace(/\?.*/, '?[params]'), // mask query for logs
    requestId: req.requestId,
  });

  const headers = {
    'content-type': 'application/json',
    'x-forwarded-for': req.socket?.remoteAddress || req.ip || 'unknown',
    'x-request-id': req.requestId,
  };
  if (config.DRIVEBOOK_API_KEY)      headers['x-api-key']      = config.DRIVEBOOK_API_KEY;
  if (config.VAPI_WEBHOOK_SECRET)    headers['x-vapi-secret']  = config.VAPI_WEBHOOK_SECRET;

  try {
    const response = await axios({
      method: dispatch.method,
      url: targetUrl,
      headers,
      data: dispatch.method !== 'GET' ? args : undefined,
      validateStatus: () => true,
      timeout: config.PROXY_TIMEOUT_MS || 15000,
      httpAgent: _httpAgent,
      httpsAgent: _httpsAgent,
    });

    const contentType = response.headers?.['content-type'] || '';
    res.status(response.status);

    if (contentType.includes('application/json') && typeof response.data === 'object' && response.data !== null) {
      const outputData = (response.status >= 200 && response.status < 300 && !response.data.summary)
        ? { ...response.data, summary: 'The request completed successfully.' }
        : { ...response.data };
      return res.json(outputData);
    }
    return res.send(typeof response.data === 'string' ? response.data : JSON.stringify(response.data));
  } catch (error) {
    logger.logError(error, { requestId: req.requestId, toolName, targetUrl });
    return res.status(502).json({ error: 'Tool call failed — upstream error' });
  }
}

app.post('/', async (req, res) => {
  const eventType = req.body?.message?.type || req.body?.type || 'unknown';
  const callId    = req.body?.message?.call?.id || req.body?.call?.id || 'unknown';
  logger.logInfo('[VAPI Event]', { eventType, callId, requestId: req.requestId });

  // assistant-request: VAPI asks which assistant to use.
  // Respond {} to use the phone number's linked assistant.
  if (eventType === 'assistant-request') {
    return res.json({});
  }

  // tool-calls: VAPI is invoking a tool. Dispatch it to the main app.
  if (eventType === 'tool-calls') {
    const toolCall = req.body?.message?.toolCalls?.[0];
    const toolName = toolCall?.function?.name;

    // Extract and parse tool arguments
    let args = toolCall?.function?.arguments || {};
    if (typeof args === 'string') {
      try { args = JSON.parse(args); } catch { args = {}; }
    }

    return dispatchToolCall(req, res, toolName, args);
  }

  // All other lifecycle events (call-start, call-end, status-update, etc.)
  res.json({ received: true });
});


// Root endpoint - minimal public response (full details gated by INTERNAL_API_KEY in hideApiDocs)
app.get('/', (req, res) => {
  res.json({
    name: 'drivebook-hybrid',
    version: '1.0.0',
    description: 'AI voice receptionist microservice for DriveBook',
    endpoints: {
      health: 'GET /api/health',
      legacy_booking_helper: 'POST /api/bookings',
      legacy_instructor_lookup: 'GET /api/instructor/lookup?phone={phone}',
      ai_proxy: 'GET/POST /api/* -> proxied to main DriveBook app'
    },
    docs: {
      integration: './INTEGRATION_GUIDE.md',
      architecture: './ARCHITECTURE.md',
      deployment: './DEPLOYMENT.md',
      ai_system: './AI_SYSTEM_GUIDE.md',
      quick_reference: './QUICK_REFERENCE.md'
    }
  });
});

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'See GET / for API documentation' });
});

// Error handler
app.use((err, req, res, _next) => {
  logger.logError(err, {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  const status = err.status || 500;
  const message = config.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
  res.status(status).json({ error: message, requestId: req.requestId });
});

// Long-running server (Railway / Docker / local) 
if (process.env.VERCEL !== '1') {
  const server = app.listen(config.PORT, () => {
    logger.logInfo(`Server running on port ${config.PORT}`);
    logger.logInfo('Registered routes: /api/bookings, /api/instructor, /api/health, /api (proxy)');
  });

  const shutdown = async () => {
    logger.logInfo('Shutting down server...');
    server.close(async () => {
      try {
        await prisma.$disconnect();
        logger.logInfo('Database connections closed');
        process.exit(0);
      } catch (error) {
        logger.logError(error, { context: 'shutdown' });
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.logError(new Error('Forced shutdown after timeout'));
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('uncaughtException', (error) => {
    logger.logError(error, { context: 'uncaughtException' });
    shutdown();
  });
  process.on('unhandledRejection', (reason) => {
    logger.logError(new Error('Unhandled Rejection'), { reason });
    shutdown();
  });
}

module.exports = app;
