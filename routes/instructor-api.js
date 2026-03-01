const express = require('express');
const router = express.Router();
const instructorService = require('../services/instructor-service');
const logger = require('../utils/logger');
const { phoneSchema } = require('../utils/validators');

router.get('/lookup', async (req, res) => {
  const requestId = req.requestId;
  const { phone } = req.query;

  try {
    if (!phone) {
      return res.status(400).json({ error: 'phone required' });
    }

    // Validate and normalise phone number
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid phone format' });
    }

    const instructor = await instructorService.findInstructorByPhone(parsed.data);
    if (!instructor) return res.status(404).json({ error: 'Not found' });

    res.json(instructor);
  } catch (err) {
    logger.logError(err, { requestId, phone });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
