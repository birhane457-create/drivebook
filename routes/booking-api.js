const express = require('express');
const router = express.Router();
const { bookingSchema } = require('../utils/validators');
const db = require('../services/database-service');
const smsService = require('../services/sms-service');
const logger = require('../utils/logger');

router.post('/', async (req, res) => {
  const requestId = req.requestId;
  try {
    const parse = bookingSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors });
    const { instructorId, clientName, clientPhone, date, time, duration } = parse.data;

    // Check availability (simple example)
    const conflict = await db.prisma.booking.findFirst({
      where: { instructorId, date, time }
    });
    if (conflict) return res.status(409).json({ error: 'Instructor unavailable' });

    const booking = await db.prisma.booking.create({
      data: { instructorId, clientName, clientPhone, date, time, duration }
    });

    // send SMS confirmation (async, don't block)
    smsService.sendBookingConfirmation(clientPhone, {
      phone: clientPhone,
      date,
      time,
      instructorName: `Instructor ${instructorId}`,
      bookingId: booking.id
    }).catch(err => logger.logError(err, { requestId }));

    res.status(201).json({ bookingId: booking.id });
  } catch (err) {
    logger.logError(err, { requestId });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
