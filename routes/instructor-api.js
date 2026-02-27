const express = require('express');
const router = express.Router();
const instructorService = require('../services/instructor-service');

router.get('/lookup', async (req, res) => {
  const { phone } = req.query;
  try {
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const instructor = await instructorService.findInstructorByPhone(phone);
    if (!instructor) return res.status(404).json({ error: 'Not found' });
    res.json(instructor);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
