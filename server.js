const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { randomUUID } = require('crypto');
const config = require('./utils/config');
const logger = require('./utils/logger');
const { PrismaClient } = require('@prisma/client');

const voiceRouter = require('./routes/voice-webhook');
const bookingRouter = require('./routes/booking-api');
const instructorRouter = require('./routes/instructor-api');

const app = express();
const prisma = new PrismaClient();

// Security: Configure CORS properly
const corsOptions = {
  origin: config.ALLOWED_ORIGINS || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' })); // Limit payload size
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

app.use('/api/voice', voiceRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/instructor', instructorRouter);

// Enhanced health check with database verification
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'ok', 
      uptime: process.uptime(),
      database: 'connected',
      timestamp: new Date().toISOString()
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

// Serve docs folder (static preview)
app.use('/docs', express.static(path.join(__dirname, 'docs')));

// Serve homepage preview at root path
app.get('/HOMEPAGE.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'HOMEPAGE.html'));
});

// Root endpoint - API documentation
app.get('/', (req, res) => {
  res.json({
    name: 'drivebook-hybrid',
    version: '1.0.0',
    description: 'AI voice receptionist microservice for DriveBook',
    endpoints: {
      health: 'GET /api/health',
      voice_incoming: 'POST /api/voice/incoming',
      voice_voicemail: 'POST /api/voice/voicemail',
      booking_create: 'POST /api/bookings',
      instructor_lookup: 'GET /api/instructor/lookup?phone={phone}'
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

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'See GET / for API documentation' });
});

// Error handler with better logging
app.use((err, req, res, next) => {
  const errorContext = {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  };
  
  logger.logError(err, errorContext);
  
  const status = err.status || 500;
  const message = config.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message;
    
  res.status(status).json({ 
    error: message,
    requestId: req.requestId
  });
});

// Only start server if not in Vercel serverless environment
if (process.env.VERCEL !== '1') {
  const server = app.listen(config.PORT, () => {
    logger.logInfo(`Server running on port ${config.PORT}`);
    logger.logInfo('Registered routes: /api/voice, /api/bookings, /api/health');
  });

  // Graceful shutdown with database cleanup
  const shutdown = async () => {
    logger.logInfo('Shutting down server...');
    
    server.close(async () => {
      try {
        // Close database connections
        await prisma.$disconnect();
        logger.logInfo('Database connections closed');
        logger.logInfo('Server closed');
        process.exit(0);
      } catch (error) {
        logger.logError(error, { context: 'shutdown' });
        process.exit(1);
      }
    });
    
    // Force shutdown after 10 seconds
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
  process.on('unhandledRejection', (reason, promise) => {
    logger.logError(new Error('Unhandled Rejection'), { reason, promise });
    shutdown();
  });
}

module.exports = app;
