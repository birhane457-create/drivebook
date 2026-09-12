// Vercel serverless function for Twilio voice webhook
const express = require('express');
const voiceRouter = require('../routes/voice-webhook');
const logger = require('../utils/logger');

const app = express();
app.use(express.urlencoded({ extended: false }));

// Twilio voice route
app.post('/', async (req, res) => {
  try {
    // Handle voice webhook
    const handler = voiceRouter.stack.find(layer => layer.route && layer.route.path === '/');
    if (handler) {
      return handler.handle(req, res);
    }
    res.status(404).json({ error: 'Voice webhook not found' });
  } catch (error) {
    logger.logError(error, { context: 'voice-serverless' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = app;
