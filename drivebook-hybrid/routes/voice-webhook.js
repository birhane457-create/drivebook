const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const config = require('../utils/config');
const instructorService = require('../services/instructor-service');
const copilotService = require('../services/copilot-service');
const messageService = require('../services/message-service');
const smsService = require('../services/sms-service');
const voiceSession = require('../services/voice-session-service');
const logger = require('../utils/logger');

// Twilio signature validation middleware
const validateTwilioRequest = (req, res, next) => {
  // Skip validation in development/test if configured
  if ((config.NODE_ENV === 'development' || config.NODE_ENV === 'test') && config.SKIP_TWILIO_VALIDATION) {
    logger.logWarning('Skipping Twilio signature validation in development/test');
    return next();
  }

  const twilioSignature = req.headers['x-twilio-signature'];
  // P2-5 FIX: Behind a reverse proxy req.protocol is always 'http' even if the
  // actual request came over HTTPS. Twilio signs using the exact https:// URL,
  // so signature validation fails unless we use x-forwarded-proto.
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const url = `${proto}://${req.get('host')}${req.originalUrl}`;
  
  if (!twilioSignature) {
    logger.logWarning('Missing Twilio signature', { requestId: req.requestId });
    return res.status(403).send('Forbidden: Missing signature');
  }

  const isValid = twilio.validateRequest(
    config.TWILIO_AUTH_TOKEN,
    twilioSignature,
    url,
    req.body
  );

  if (!isValid) {
    logger.logWarning('Invalid Twilio signature', { 
      requestId: req.requestId,
      url,
      signature: twilioSignature 
    });
    return res.status(403).send('Forbidden: Invalid signature');
  }

  next();
};

router.post('/incoming', validateTwilioRequest, async (req, res) => {
  const { From, To } = req.body || {};
  const requestId = req.requestId;
  try {
    if (!From || !To) {
      logger.logWarning('Missing From or To in voice webhook', { requestId });
      return res.status(400).send('Missing required Twilio fields');
    }

    logger.logInfo('Incoming call', { from: From, to: To, requestId });

    // ── Session recovery ─────────────────────────────────────────────────────
    // If the caller has an active session (e.g. their previous call dropped
    // mid-booking), greet them with context and resend their payment link so
    // they don't need to start from scratch.
    const existingSession = await voiceSession.getSession(From);
    const twiml = new twilio.twiml.VoiceResponse();

    if (existingSession) {
      logger.logInfo('Voice session recovery triggered', {
        phone: From,
        lastAction: existingSession.lastAction,
        bookingId: existingSession.bookingId,
        requestId,
      });

      // Resend payment link in the background — non-blocking so TwiML responds fast
      if (
        existingSession.checkoutUrl &&
        (existingSession.lastAction === 'BOOKING_CREATED' ||
          existingSession.lastAction === 'PAYMENT_LINK_SENT')
      ) {
        smsService
          .resendPaymentLink(From, existingSession.checkoutUrl)
          .catch((smsErr) =>
            logger.logError(smsErr, { requestId, context: 'session-recovery-sms' })
          );

        // Mark as resent so we don't flood on subsequent call-backs
        await voiceSession.saveSession(From, { lastAction: 'PAYMENT_LINK_SENT' });
      }

      twiml.say(voiceSession.buildRecoveryPrompt(existingSession));
      return res.type('text/xml').send(twiml.toString());
    }

    // ── Normal call flow ──────────────────────────────────────────────────────
    const instructor = await instructorService.findInstructorByPhone(To);

    if (instructor) {
      // Attempt to connect to Copilot agent
      const agentResponse = await copilotService.connectToCopilotAgent(instructor.id, { callerPhone: From });
      if (agentResponse && agentResponse.type === 'dial') {
        twiml.dial({ callerId: To }, agentResponse.number);
      } else if (agentResponse && agentResponse.type === 'say') {
        twiml.say(agentResponse.text);
      } else {
        // fallback - take message
        twiml.say('The instructor is currently unavailable. Please leave a message after the beep.');
        twiml.record({ maxLength: config.VOICEMAIL_MAX_LENGTH, action: '/api/voice/voicemail' });
      }
    } else {
      twiml.say('We could not find the instructor. Please leave a message after the beep.');
      twiml.record({ maxLength: config.VOICEMAIL_MAX_LENGTH, action: '/api/voice/voicemail' });
    }

    res.type('text/xml').send(twiml.toString());
  } catch (err) {
    logger.logError(err, { requestId });
    res.status(500).send('Server error');
  }
});

// Simple voicemail handler (stores message)
router.post('/voicemail', validateTwilioRequest, async (req, res) => {
  const { RecordingUrl, From } = req.body || {};
  try {
    if (!RecordingUrl || !From) return res.status(400).send('Missing fields');
    await messageService.takeVoiceMessage(From, null, `Voicemail: ${RecordingUrl}`);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Thanks. Your message has been recorded. Goodbye.');
    res.type('text/xml').send(twiml.toString());
  } catch (err) {
    logger.logError(err, { requestId: req.requestId });
    res.status(500).send('Server error');
  }
});

module.exports = router;
