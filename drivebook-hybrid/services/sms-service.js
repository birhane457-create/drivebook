'use strict';

/**
 * sms-service.js
 *
 * Thin wrapper around the Twilio Messages API.
 * Used by main-app-proxy for payment link delivery and session recovery resend.
 *
 * Phone normalisation is delegated to voice-session-service.normalisePhone
 * (single source of truth for E.164 formatting).
 */

const config = require('../utils/config');
const logger = require('../utils/logger');
const { normalisePhone } = require('./voice-session-service');

//  Lazy Twilio client 
// Initialised on first use, not at module load. This prevents the Twilio
// constructor from throwing during tests and startup when credentials may
// not be set yet.
let _twilioClient = null;

function getTwilioClient() {
  if (_twilioClient) return _twilioClient;
  if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN) {
    throw new Error(
      'Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.'
    );
  }
  const Twilio = require('twilio');
  _twilioClient = Twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN, {
    // autoRetry: SDK-level retry on Twilio HTTP 429s (rate limiting).
    // Complements our own retry loop which handles general network failures.
    autoRetry: true,
    maxRetries: 3,
    // keepAlive: reuse TLS connections across requests  reduces overhead for
    // long-running services sending multiple SMS per call session.
    keepAlive: true,
  });
  return _twilioClient;
}

//  Core send with retry 
/**
 * Send a single SMS with one automatic retry on failure.
 *
 * @param {string} phoneNumber  destination  normalised internally to E.164
 * @param {string} message      body text
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
async function sendSms(phoneNumber, message) {
  const to = normalisePhone(phoneNumber);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const msg = await getTwilioClient().messages.create({
        from: config.TWILIO_PHONE_NUMBER,
        to,
        body: message,
      });
      logger.logInfo('SMS sent', { to, sid: msg.sid, attempt });
      return { success: true, sid: msg.sid };
    } catch (err) {
      logger.logWarning('SMS send attempt failed', { attempt, to, error: err.message });
      if (attempt === 2) {
        logger.logError(err, { context: 'sms-send-final-failure', to });
        // Expose Twilio error code + HTTP status so callers can distinguish
        // invalid number / auth failure / rate limit / carrier rejection
        // without parsing the error message string.
        return {
          success: false,
          error: err.message,
          code: err.code,       // Twilio error code (e.g. 21211 = invalid number)
          status: err.status,   // HTTP status from Twilio API (e.g. 400, 429)
          retryAvailable: true, // callers (and Vapi AI) can offer to retry
        };
      }
      // Brief pause before retry
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

//  Higher-level helpers 

/**
 * Send booking confirmation SMS.
 * Called by booking-api.js after a local SQLite booking is created.
 *
 * @param {string} phoneNumber
 * @param {{ instructorName: string, date: string, time: string, bookingId: string }} bookingDetails
 */
async function sendBookingConfirmation(phoneNumber, bookingDetails) {
  const body =
    `Booking confirmed with ${bookingDetails.instructorName} on ${bookingDetails.date} ` +
    `at ${bookingDetails.time}. Booking ID: ${bookingDetails.bookingId}`;
  return sendSms(phoneNumber, body);
}

/**
 * Resend a payment link for a pending booking (voice session recovery).
 *
 * @param {string} phoneNumber
 * @param {string} checkoutUrl
 */
async function resendPaymentLink(phoneNumber, checkoutUrl) {
  const body =
    `Your DriveBook payment link is still active. Complete your booking here: ${checkoutUrl}`;
  return sendSms(phoneNumber, body);
}

module.exports = { sendSms, sendBookingConfirmation, resendPaymentLink };