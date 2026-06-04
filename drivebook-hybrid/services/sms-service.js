const Twilio = require('twilio');
const config = require('../utils/config');
const logger = require('../utils/logger');

const client = Twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);

// P2-10 FIX: Normalise Australian numbers robustly.
// Handles: 04xx, +614xx, 614xx (no leading +), and numbers with spaces/dashes.
// Non-Australian numbers are returned unchanged.
function normalizeAustralian(phone) {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('614')) return '+' + digits;   // 61412345678 → +61412345678
  if (digits.startsWith('04')) return '+61' + digits.slice(1); // 0412345678 → +61412345678
  // International or already E.164 — return with + prefix if digits only
  if (phone.startsWith('+')) return phone;
  return phone; // leave unchanged (could be international)
}

async function sendBookingConfirmation(phoneNumber, bookingDetails) {
  const to = normalizeAustralian(phoneNumber);
  const body = `Booking confirmed with ${bookingDetails.instructorName} on ${bookingDetails.date} at ${bookingDetails.time}. Booking ID: ${bookingDetails.bookingId}`;
  let attempts = 0;
  while (attempts < 2) {
    try {
      attempts += 1;
      const msg = await client.messages.create({
        from: config.TWILIO_PHONE_NUMBER,
        to,
        body
      });
      logger.logInfo('SMS sent', { to, sid: msg.sid });
      return { success: true, sid: msg.sid };
    } catch (err) {
      logger.logWarning('SMS send failed', { attempt: attempts, err: err.message });
      if (attempts >= 2) {
        logger.logError(err);
        return { success: false, error: err.message };
      }
    }
  }
}

/**
 * Generic single SMS send — used by main-app-proxy for payment link delivery
 * and by voice-webhook for session recovery resend.
 *
 * @param {string} phoneNumber  destination (normalised internally)
 * @param {string} message      body text
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
async function sendSms(phoneNumber, message) {
  const to = normalizeAustralian(phoneNumber);
  try {
    const msg = await client.messages.create({
      from: config.TWILIO_PHONE_NUMBER,
      to,
      body: message,
    });
    logger.logInfo('SMS sent', { to, sid: msg.sid });
    return { success: true, sid: msg.sid };
  } catch (err) {
    logger.logError(err, { to });
    return { success: false, error: err.message };
  }
}

/**
 * Resend a payment link for a pending booking (voice session recovery).
 *
 * @param {string} phoneNumber
 * @param {string} checkoutUrl
 * @returns {Promise<{success: boolean}>}
 */
async function resendPaymentLink(phoneNumber, checkoutUrl) {
  const body =
    `Your DriveBook payment link is still active. Complete your booking here: ${checkoutUrl}`;
  return sendSms(phoneNumber, body);
}

module.exports = { sendBookingConfirmation, sendSms, resendPaymentLink };
