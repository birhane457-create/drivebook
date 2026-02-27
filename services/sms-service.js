const Twilio = require('twilio');
const config = require('../utils/config');
const logger = require('../utils/logger');

const client = Twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);

function normalizeAustralian(phone) {
  if (!phone) return phone;
  // naive normalization: replace leading 04 with +614
  if (phone.startsWith('04')) return phone.replace(/^0/, '+61');
  return phone;
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

module.exports = { sendBookingConfirmation };
