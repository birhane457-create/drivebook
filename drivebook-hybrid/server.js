'use strict';

const express    = require('express');
const path       = require('path');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const axios      = require('axios');
const { randomUUID } = require('crypto');
const config     = require('./utils/config');
const logger     = require('./utils/logger');
const prisma     = require('./utils/prisma');
const { httpAgent, httpsAgent } = require('./utils/agents'); // shared keep-alive agents

const bookingRouter      = require('./routes/booking-api');
const instructorRouter   = require('./routes/instructor-api');
const mainAppProxyRouter = require('./routes/main-app-proxy');
const { restrictAccess, hideApiDocs, verifyVapiSecret, ipRateLimit } = require('./middleware/auth');
const voiceSession = require('./services/voice-session-service');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: config.ALLOWED_ORIGINS || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200,
};

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));
// 10 MB: VAPI tool-call payloads include full transcripts (~95 KB per event).
// 1 MB was rejecting large calls mid-conversation.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
// tiny format in production to reduce log volume; combined in dev for debugging
app.use(morgan(config.NODE_ENV === 'production' ? 'tiny' : 'combined'));

// ── Request ID ────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ── Request timeout ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  req.setTimeout(config.REQUEST_TIMEOUT, () => {
    logger.logWarning('Request timeout', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
    });
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

// ═════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK — registered BEFORE security middleware so monitoring tools
// (Railway, UptimeRobot, etc.) are never blocked by verifyVapiSecret.
// ═════════════════════════════════════════════════════════════════════════════
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const metrics = typeof voiceSession.getMetrics === 'function' ? voiceSession.getMetrics() : {};
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      database: 'connected',
      timestamp: new Date().toISOString(),
      sessions: metrics.count || 0,
    });
  } catch (error) {
    logger.logError(error, { context: 'health-check' });
    res.status(503).json({
      status: 'error',
      uptime: process.uptime(),
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SECURITY PERIMETER — applied AFTER health check
// ═════════════════════════════════════════════════════════════════════════════
app.use(hideApiDocs);
app.use(verifyVapiSecret);
app.use(ipRateLimit);
app.use(restrictAccess);

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════
app.use('/api/bookings',   bookingRouter);
app.use('/api/instructor', instructorRouter);
app.use('/api',            mainAppProxyRouter);

// ── Static docs ───────────────────────────────────────────────────────────────
app.use('/docs', express.static(path.join(__dirname, 'docs')));
app.get('/HOMEPAGE.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'HOMEPAGE.html'));
});

// ═════════════════════════════════════════════════════════════════════════════
// VAPI WEBHOOK WITH TOOL DISPATCH
//
// VAPI sends ALL call events as POST / to serverUrl.
// Event types handled here:
//   assistant-request  → return { assistantId } or {} to use linked assistant
//   tool-calls         → dispatch to main DriveBook app via axios
//   everything else    → acknowledge with { received: true }
// ═════════════════════════════════════════════════════════════════════════════

const TOOL_DISPATCH = {
  // ── Instructor search ──
  getInstructorRecommendations: { method: 'GET',  targetPath: '/api/instructors/recommendations' },
  findInstructors:              { method: 'GET',  targetPath: '/api/instructors/recommendations' },
  searchInstructorsByLocation:  { method: 'GET',  targetPath: '/api/instructors/search' },
  // ── Packages & availability ──
  getPackages:                  { method: 'GET',  targetPath: '/api/packages' },
  getAvailableSlots:            { method: 'GET',  targetPath: '/api/availability/slots' },
  checkAvailability:            { method: 'POST', targetPath: '/api/availability' },
  // ── Location ──
  validateLocation:             { method: 'POST', targetPath: '/api/locations/validate' },
  checkServiceArea:             { method: 'GET',  targetPath: '/api/public/check-service-area' },
  // ── Booking lifecycle ──
  createBooking:                { method: 'POST', targetPath: '/api/public/bookings/bulk' },
  lookupBookings:               { method: 'GET',  targetPath: '/api/bookings/lookup' },
  getPublicBooking:             { method: 'GET',  targetPath: '/api/public/bookings/:id' },
  getBookingTimeline:           { method: 'GET',  targetPath: '/api/public/bookings/:id/timeline' },
  getPaymentStatus:             { method: 'GET',  targetPath: '/api/public/bookings/:id/payment-status' },
  getPaymentSummary:            { method: 'GET',  targetPath: '/api/public/bookings/:id/payment-status' },
  getCancellationPolicy:        { method: 'GET',  targetPath: '/api/bookings/:id/cancellation-policy' },
  cancelBooking:                { method: 'POST', targetPath: '/api/public/bookings/:id/cancel' },
  rescheduleBooking:            { method: 'POST', targetPath: '/api/public/bookings/:id/reschedule' },
  // ── Identity verification (OTP) ──
  sendOtp:                      { method: 'POST', targetPath: '/api/verifications/otp' },
  confirmOtp:                   { method: 'POST', targetPath: '/api/verifications/otp/confirm' },
  // ── Instructor lookup ──
  lookupInstructor:             { method: 'GET',  targetPath: '/api/voice/instructors/lookup' },
  // ── Internal ──
  healthCheck:                  { method: 'GET',  targetPath: '/api/health' },
};

async function dispatchToolCall(req, res, toolName, args) {
  const dispatch = TOOL_DISPATCH[toolName];
  if (!dispatch) {
    logger.logWarning('[VAPI tool-call] Unknown tool', { toolName, requestId: req.requestId });
    return res.status(400).json({ error: `Unknown tool: ${toolName}` });
  }

  // Resolve :id placeholder — never leak route params into query/body
  const id = args.id || args.bookingId || null;
  const resolvedPath = id ? dispatch.targetPath.replace(':id', id) : dispatch.targetPath;
  const baseUrl = config.DRIVEBOOK_BASE_URL.replace(/\/$/, '');
  let targetUrl = `${baseUrl}${resolvedPath}`;

  // GET: append args as query params, excluding route-level id fields
  if (dispatch.method === 'GET' && Object.keys(args).length > 0) {
    const qs = Object.entries(args)
      .filter(([k, v]) => v !== undefined && v !== null && k !== 'id' && k !== 'bookingId')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) targetUrl += `?${qs}`;
  }

  // POST: send args as JSON body, stripping route-level id fields
  let bodyData;
  if (dispatch.method !== 'GET') {
    const { id: _id, bookingId: _bookingId, ...cleanArgs } = args; // eslint-disable-line no-unused-vars
    bodyData = cleanArgs;
  }

  logger.logInfo('[VAPI tool-call] Dispatching', {
    toolName,
    method: dispatch.method,
    targetUrl: targetUrl.replace(/\?.*/, '?[params]'), // mask query values from logs
    requestId: req.requestId,
  });

  const headers = {
    'content-type': 'application/json',
    'x-forwarded-for': req.socket?.remoteAddress || req.ip || 'unknown',
    'x-request-id': req.requestId,
  };
  if (config.DRIVEBOOK_API_KEY)   headers['x-api-key']     = config.DRIVEBOOK_API_KEY;
  if (config.VAPI_WEBHOOK_SECRET) headers['x-vapi-secret'] = config.VAPI_WEBHOOK_SECRET;

  try {
    const response = await axios({
      method: dispatch.method,
      url: targetUrl,
      headers,
      data: bodyData,
      validateStatus: () => true,
      timeout: config.PROXY_TIMEOUT_MS || 15000,
      httpAgent,
      httpsAgent,
    });

    const contentType = response.headers?.['content-type'] || '';
    res.status(response.status);

    if (contentType.includes('application/json') && typeof response.data === 'object' && response.data !== null) {
      // Only inject summary if upstream hasn't already included one
      const outputData = (response.status >= 200 && response.status < 300)
        ? { ...response.data, summary: response.data.summary || 'The request completed successfully.' }
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

  // VAPI asks which assistant should handle this call.
  // Return assistantId if configured, otherwise {} to use the phone number's linked assistant.
  if (eventType === 'assistant-request') {
    return res.json(config.VAPI_ASSISTANT_ID ? { assistantId: config.VAPI_ASSISTANT_ID } : {});
  }

  // VAPI is invoking a tool. Validate the tool name then dispatch.
  if (eventType === 'tool-calls') {
    const toolCall = req.body?.message?.toolCalls?.[0];
    const toolName = toolCall?.function?.name;

    if (!toolName) {
      logger.logWarning('[VAPI tool-call] Missing tool name in payload', { requestId: req.requestId });
      return res.status(400).json({ error: 'Missing tool name in tool-call payload' });
    }

    let args = toolCall?.function?.arguments || {};
    if (typeof args === 'string') {
      try { args = JSON.parse(args); } catch { args = {}; }
    }

    return dispatchToolCall(req, res, toolName, args);
  }

  // All other lifecycle events (call-start, call-end, speech-update, transcript, status-update, hang)
  res.json({ received: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROOT & 404
// ═════════════════════════════════════════════════════════════════════════════
app.get('/', (req, res) => {
  res.json({
    name: 'drivebook-hybrid',
    version: '1.0.0',
    description: 'AI voice receptionist microservice for DriveBook',
    endpoints: {
      health:        'GET  /api/health',
      vapi_webhook:  'POST /',
      proxy:         'GET/POST /api/* → proxied to main DriveBook app',
    },
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.logError(err, {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
  });
  const status  = err.status || 500;
  const message = config.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
  res.status(status).json({ error: message, requestId: req.requestId });
});

// ═════════════════════════════════════════════════════════════════════════════
// SERVER (Railway / Docker / local — skipped on Vercel)
// ═════════════════════════════════════════════════════════════════════════════
if (process.env.VERCEL !== '1') {
  const server = app.listen(config.PORT, () => {
    logger.logInfo(`Server running on port ${config.PORT}`);
    logger.logInfo('Routes: /api/health (unguarded), /api/bookings, /api/instructor, /api (proxy), POST /');
  });

  const shutdown = async () => {
    logger.logInfo('Shutting down...');
    server.close(async () => {
      try {
        await prisma.$disconnect();
        logger.logInfo('Database disconnected');
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
  process.on('SIGINT',  shutdown);
  process.on('uncaughtException',  (error)  => { logger.logError(error, { context: 'uncaughtException' });  shutdown(); });
  process.on('unhandledRejection', (reason) => { logger.logError(new Error('Unhandled Rejection'), { reason }); shutdown(); });
}

module.exports = app;
