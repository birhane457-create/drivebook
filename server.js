const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { randomUUID } = require('crypto');
const config = require('./utils/config');
const logger = require('./utils/logger');

const voiceRouter = require('./routes/voice-webhook');
const bookingRouter = require('./routes/booking-api');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

app.use('/api/voice', voiceRouter);
app.use('/api/bookings', bookingRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
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

// Error handler
app.use((err, req, res, next) => {
  logger.logError(err, { requestId: req.requestId });
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

const server = app.listen(config.PORT, () => {
  logger.logInfo(`Server running on port ${config.PORT}`);
  logger.logInfo('Registered routes: /api/voice, /api/bookings, /api/health');
});

// Graceful shutdown
const shutdown = () => {
  logger.logInfo('Shutting down server...');
  server.close(() => {
    logger.logInfo('Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
