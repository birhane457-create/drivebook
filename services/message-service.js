const db = require('./database-service');
const smsService = require('./sms-service');
const logger = require('../utils/logger');
const config = require('../utils/config');

// Simple in-memory rate limiter: { phone: { count, windowStart } }
const rateMap = new Map();

function allowedToMessage(phone) {
  const now = Date.now();
  const windowMs = config.MESSAGE_RATE_WINDOW_HOURS * 60 * 60 * 1000;
  const entry = rateMap.get(phone) || { count: 0, windowStart: now };
  if (now - entry.windowStart > windowMs) {
    entry.count = 0;
    entry.windowStart = now;
  }
  if (entry.count >= config.MESSAGE_RATE_LIMIT) return false;
  entry.count += 1;
  rateMap.set(phone, entry);
  return true;
}

async function takeVoiceMessage(callerNumber, callerName, message) {
  if (!message || message.length < 10) throw new Error('Message too short');
  if (!allowedToMessage(callerNumber)) throw new Error('Rate limit exceeded');
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