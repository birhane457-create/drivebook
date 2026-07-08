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

      // ── Payment status check before recovery ──────────────────────────────
      // If the caller previously created a booking and is ringing back,
      // check whether Stripe already confirmed payment before offering to
      // resend the payment link. The AI must never bypass payment — it only
      // reads the status that Stripe and the webhook have already set.
      // Status transitions are server-side only: PENDING_PAYMENT → CONFIRMED
      // happens exclusively via the Stripe webhook, never via this service.
      if (
        existingSession.bookingId &&
        existingSession.checkoutUrl &&
        (existingSession.lastAction === 'BOOKING_CREATED' ||
          existingSession.lastAction === 'PAYMENT_LINK_SENT')
      ) {
        try {
          // Extract paymentToken from stored checkoutUrl (?token=<uuid>)
          const urlObj = new URL(existingSession.checkoutUrl);
          const paymentToken = urlObj.searchParams.get('token');

          if (paymentToken) {
            const base = config.DRIVEBOOK_BASE_URL || 'http://localhost:3000';
            const apiKey = config.DRIVEBOOK_API_KEY || '';
            const statusUrl = `${base}/api/public/bookings/${existingSession.bookingId}/payment-status?token=${paymentToken}`;

            const fetchFn = global.fetch || require('node-fetch');
            const statusRes = await fetchFn(statusUrl, {
              headers: { 'x-api-key': apiKey },
              signal: AbortSignal.timeout(4000),
            });

            if (statusRes.ok) {
              const statusData = await statusRes.json();
              logger.logInfo('Payment status on session recovery', {
                bookingId: existingSession.bookingId,
                paymentStatus: statusData.paymentStatus,
                requestId,
              });

              // Payment already succeeded — clear the session and confirm to caller.
              // The AI does NOT change status — it only reads what Stripe already set.
              if (statusData.paymentStatus === 'succeeded') {
                await voiceSession.clearSession(From);
                twiml.say(
                  'Welcome back. Good news — your payment went through and your booking is confirmed. ' +
                  'You should receive an SMS confirmation shortly. Is there anything else I can help with?'
                );
                return res.type('text/xml').send(twiml.toString());
              }

              // Payment expired — slot was automatically released by the cleanup cron.
              // Offer to start fresh. Do NOT attempt to reinstate the old booking.
              if (statusData.paymentStatus === 'expired') {
                await voiceSession.clearSession(From);
                twiml.say(
                  'Welcome back. Unfortunately the payment window closed before payment was received, ' +
                  'so the slot was released. I can start a new booking for you — ' +
                  'would you like to try the same time, or would you prefer a different slot?'
                );
                return res.type('text/xml').send(twiml.toString());
              }
            }
          }
        } catch (statusErr) {
          // Non-fatal — if we can't check payment status, fall through to normal recovery
          logger.logWarning('Could not check payment status on session recovery', {
            bookingId: existingSession.bookingId,
            err: statusErr.message,
            requestId,
          });
        }

        // Payment still pending  resend the payment link so the caller can complete it.
        // The booking status will only change when Stripe fires the webhook.
        // Gemini concern 3: speak a filler phrase immediately so caller hears activity.
        // The twiml.say call below executes before the async SMS send.
        twiml.say('Just a moment  checking your booking now.');
        smsService
          .resendPaymentLink(From, existingSession.checkoutUrl)
          .catch((smsErr) =>
            logger.logError(smsErr, { requestId, context: 'session-recovery-sms' })
          );

        await voiceSession.saveSession(From, { lastAction: 'PAYMENT_LINK_SENT' });
      }

      twiml.say(voiceSession.buildRecoveryPrompt(existingSession));
      return res.type('text/xml').send(twiml.toString());
    }

    // ── Normal call flow ──────────────────────────────────────────────────────
    const instructor = await instructorService.findInstructorByPhone(To);

    if (instructor) {
      // DEDICATED LINE: specific instructor owns this number
      logger.logInfo('Dedicated instructor line', { instructorId: instructor.id, requestId });
      const agentResponse = await copilotService.connectToCopilotAgent(instructor.id, { callerPhone: From });
      if (agentResponse && agentResponse.type === 'dial') {
        twiml.dial({ callerId: To }, agentResponse.number);
      } else if (agentResponse && agentResponse.type === 'say') {
        twiml.say(agentResponse.text);
      } else {
        twiml.say(`You've reached ${instructor.name}'s booking line. Please leave a message after the beep.`);
        twiml.record({ maxLength: config.VOICEMAIL_MAX_LENGTH, action: '/api/voice/voicemail' });
      }
    } else {
      // GENERAL LINE: shared DriveBook number, no specific instructor
      logger.logInfo('General DriveBook line', { dialledNumber: To, requestId });
      const agentResponse = await copilotService.connectToCopilotAgent(null, { callerPhone: From, lineType: 'general' });
      if (agentResponse && agentResponse.type === 'say') {
        twiml.say(agentResponse.text);
      } else {
        twiml.say('Hi, thanks for calling DriveBook. How can I help you today?');
      }
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
