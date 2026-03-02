const db = require('./database-service');
const smsService = require('./sms-service');
const logger = require('../utils/logger');
const config = require('../utils/config');

// Database-based rate limiting per caller number
async function allowedToMessage(phone) {
  const windowMs = config.MESSAGE_RATE_WINDOW_HOURS * 60 * 60 * 1000;
  const windowStart = new Date(Date.now() - windowMs);

  const count = await db.prisma.message.count({
    where: {
      callerNumber: phone,
      timestamp: { gte: windowStart }
    }
  });

  return count < config.MESSAGE_RATE_LIMIT;
}

async function takeVoiceMessage(callerNumber, callerName, message) {
  if (!message || message.length < 10) throw new Error('Message too short');

  const allowed = await allowedToMessage(callerNumber);
  if (!allowed) throw new Error('Rate limit exceeded');

  const record = await db.prisma.message.create({
    data: { callerNumber, callerName, message, status: 'new' }
  });
  // Optionally notify instructor via SMS (best-effort)
  // In a real system we'd look up the instructor; here we skip
  try {
    // placeholder: send to admin or instructor if known
    // smsService.sendBookingConfirmation(adminPhone, { ... })
  } catch (err) {
    logger.logWarning('Failed to send notification SMS', { err });
  }
  return { success: true, id: record.id };
}

module.exports = { takeVoiceMessage };