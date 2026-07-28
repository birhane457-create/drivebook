'use strict';

const express = require('express');
const router  = express.Router();
const { bookingSchema } = require('../utils/validators');
const prisma = require('../utils/prisma'); // use shared Prisma directly — no db.prisma indirection
const smsService = require('../services/sms-service');
const logger = require('../utils/logger');

// ── SMS retry helper ───────────────────────────────────────────────────────────
// Retries on transient send failures (network blip, Twilio 429, etc.).
// Does NOT retry if the previous attempt succeeded — confirmation is idempotent.
async function sendSmsWithRetry(phone, data, maxRetries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await smsService.sendBookingConfirmation(phone, data);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt))); // 500ms, 1000ms
      }
    }
  }
  throw lastErr;
}

// ── POST / ─────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const requestId = req.requestId;

  // Idempotency: if the caller sends an Idempotency-Key header and a booking with
  // that key already exists, return the existing booking rather than creating a duplicate.
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['Idempotency-Key'] || null;
  if (idempotencyKey) {
    try {
      const existing = await prisma.booking.findFirst({
        where: { idempotencyKey },
        select: { id: true },
      });
      if (existing) {
        logger.logInfo('Returning existing booking (idempotency hit)', { requestId, idempotencyKey });
        return res.status(200).json({ bookingId: existing.id, alreadyProcessed: true });
      }
    } catch (err) {
      // Non-fatal: if the lookup fails, continue with normal creation.
      // The booking may be created twice on a retry, which is acceptable for
      // the local legacy endpoint (the main app deduplicates via its own key).
      logger.logWarning('Idempotency check failed — continuing without dedup', {
        requestId,
        error: err.message,
      });
    }
  }

  try {
    const parse = bookingSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.errors });
    }

    const { instructorId, clientName, clientPhone, date, time, duration } = parse.data;
    // vehicleType is optional at the schema level — default to AUTO if not provided
    const vehicleType = (req.body.vehicleType || 'AUTO').toUpperCase();

    // Availability check: exact date+time match (the local schema stores time as a string).
    // This prevents a duplicate booking at the same slot; the main app enforces
    // full interval overlap checking for the production booking flow.
    const conflict = await prisma.booking.findFirst({
      where: { instructorId, date, time },
    });
    if (conflict) {
      return res.status(409).json({ error: 'Instructor unavailable at that time' });
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        instructorId,
        clientName,
        clientPhone,
        vehicleType,
        date,
        time,
        duration,
        ...(idempotencyKey && { idempotencyKey }),
      },
    });

    // Resolve instructor name for the SMS (best-effort — failure does not fail the request)
    let instructorName = 'your instructor';
    try {
      const instructor = await prisma.instructor.findUnique({
        where: { id: instructorId },
        select: { name: true },
      });
      if (instructor?.name) instructorName = instructor.name;
    } catch (lookupErr) {
      logger.logWarning('Failed to look up instructor name for SMS', {
        requestId, instructorId, error: lookupErr.message,
      });
    }

    // Send SMS confirmation — non-blocking with retry, errors logged but not surfaced
    sendSmsWithRetry(clientPhone, {
      phone: clientPhone,
      date,
      time,
      instructorName,
      bookingId: booking.id,
    }).catch((err) => logger.logError(err, { requestId, context: 'sms-confirmation' }));

    return res.status(201).json({ bookingId: booking.id });
  } catch (err) {
    logger.logError(err, { requestId });
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
