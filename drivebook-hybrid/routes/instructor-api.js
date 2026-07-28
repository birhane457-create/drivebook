'use strict';

const express = require('express');
const router  = express.Router();
const instructorService = require('../services/instructor-service');
const logger = require('../utils/logger');
const { phoneSchema } = require('../utils/validators');

// ── Lightweight TTL cache ──────────────────────────────────────────────────────
// Instructor lookups are read-heavy and the data changes rarely (phone numbers
// are provisioned once). A 5-minute in-process cache eliminates redundant DB
// hits on every call while keeping data fresh enough for all practical purposes.
//
// Single-instance only — if horizontal scaling is added, replace with Redis.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const lookupCache  = new Map(); // phone → { data, expiresAt }

function cacheGet(key) {
  const entry = lookupCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    lookupCache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data) {
  lookupCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── GET /lookup ────────────────────────────────────────────────────────────────
router.get('/lookup', async (req, res) => {
  const requestId = req.requestId;
  const { phone } = req.query;

  try {
    if (!phone) {
      return res.status(400).json({ error: 'phone parameter is required' });
    }

    // Validate and normalise the phone number before using it as a cache key or DB query
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid phone format' });
    }
    const normalisedPhone = parsed.data;

    // Cache hit — return immediately without hitting the DB or upstream API
    const cached = cacheGet(normalisedPhone);
    if (cached) {
      logger.logInfo('Instructor lookup cache hit', { requestId });
      return res.json({ ...cached, fromCache: true });
    }

    // Cache miss — delegate to instructor-service (queries main app, falls back to local cache)
    const instructor = await instructorService.findInstructorByPhone(normalisedPhone);
    if (!instructor) {
      return res.status(404).json({ error: 'Instructor not found' });
    }

    // Store in local TTL cache for subsequent calls
    cacheSet(normalisedPhone, instructor);

    return res.json(instructor);
  } catch (err) {
    logger.logError(err, { requestId, phone });
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
