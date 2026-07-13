const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
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
// We acknowledge with 200 and log the event type for diagnostics.
app.post('/', (req, res) => {
  const eventType = req.body?.message?.type || req.body?.type || 'unknown';
  const callId    = req.body?.message?.call?.id || req.body?.call?.id || 'unknown';
  logger.logInfo('[VAPI Event]', { eventType, callId, requestId: req.requestId });

  // assistant-request: Vapi asks "which assistant should handle this call?"
  // Must respond with {} (empty object) to tell Vapi to use the phone number's
  // linked assistant. Any other response (including {"received":true}) may
  // cause Vapi to treat this as an error and trigger the fallback destination.
  if (eventType === 'assistant-request') {
    return res.json({});
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
