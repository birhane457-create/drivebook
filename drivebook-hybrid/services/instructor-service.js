'use strict';

/**
 * instructor-service.js
 *
 * Resolves which instructor owns a given Twilio/Vapi phone number.
 * Called on every incoming call to determine whether it is a dedicated
 * instructor line or the general DriveBook line.
 *
 * Previously used DriveBookAPIClient (drivebook-api-client.js) as an
 * intermediary  that client is now archived. The lookup is inlined here
 * directly using axios, consistent with the rest of the proxy layer.
 */

const axios = require('axios');
const db = require('./database-service');
const { phoneSchema } = require('../utils/validators');
const config = require('../utils/config');
const logger = require('../utils/logger');

/**
 * Find the instructor who owns the given Twilio/Vapi line (the dialled number).
 * Queries the main DriveBook app first, falls back to the local SQLite cache
 * if the main app is unreachable.
 *
 * Returns the instructor object, or null if no instructor owns that number.
 *
 * @param {string} phone  E.164 or Australian format dialled number
 * @returns {Promise<object|null>}
 */
async function findInstructorByPhone(phone) {
  const start = Date.now();

  // Validate and normalise the phone number before using it
  const parsed = phoneSchema.safeParse(phone);
  if (!parsed.success) {
    logger.logWarning('Invalid phone format in instructor lookup', { phone });
    return null;
  }
  const normalized = parsed.data;

  //  1. Query main DriveBook app 
  try {
    logger.logInfo('Querying DriveBook API for instructor by voice line', { phone: normalized });

    const response = await axios.get(
      `${config.DRIVEBOOK_BASE_URL}/api/voice/instructors/lookup`,
      {
        params: { phone: normalized },
        headers: {
          'x-api-key': config.DRIVEBOOK_API_KEY,
          'User-Agent': 'DriveBook-Hybrid/1.0',
        },
        timeout: config.PROXY_TIMEOUT_MS,
        validateStatus: (status) => status < 500, // don't throw on 4xx
      }
    );

    const ms = Date.now() - start;

    if (response.status === 200 && response.data) {
      logger.logInfo('Instructor found via DriveBook API', { phone: normalized, ms });
      // Cache locally for resilience
      cacheInstructor(response.data).catch((err) =>
        logger.logWarning('Failed to cache instructor', { err: err.message })
      );
      return response.data;
    }

    if (response.status === 404) {
      logger.logInfo('Instructor not found in DriveBook (no dedicated line)', { phone: normalized, ms });
      return null;
    }

    logger.logWarning('Unexpected status from instructor lookup', { status: response.status, ms });
  } catch (err) {
    logger.logWarning('DriveBook API unreachable  checking local cache', { err: err.message });
  }

  //  2. Local SQLite cache fallback 
  try {
    const cached = await db.prisma.instructor.findFirst({
      where: { phone: normalized },
    });

    if (cached) {
      logger.logInfo('Instructor found in local cache', {
        phone: normalized,
        ms: Date.now() - start,
      });
      return {
        id: cached.id,
        name: cached.name,
        phone: cached.phone,
        hourlyRate: cached.hourlyRate,
        serviceAreas: cached.serviceAreas,
        fromCache: true,
      };
    }
  } catch (err) {
    logger.logError(err, { context: 'instructor-cache-lookup' });
  }

  logger.logInfo('Instructor not found', { phone: normalized, ms: Date.now() - start });
  return null;
}

/**
 * Upsert instructor into local SQLite for offline resilience.
 * Non-critical  errors are caught and logged by the caller.
 *
 * @param {object} instructor
 */
async function cacheInstructor(instructor) {
  await db.prisma.instructor.upsert({
    where: { id: instructor.id },
    update: { updatedAt: new Date() },
    create: {
      id: instructor.id,
      phone: instructor.phone,
      name: instructor.name,
      hourlyRate: instructor.hourlyRate ?? 0,
      copilotAgentEndpoint: instructor.copilotAgentEndpoint ?? '',
      baseLatitude: instructor.baseLatitude ?? 0,
      baseLongitude: instructor.baseLongitude ?? 0,
      serviceRadiusKm: instructor.serviceRadiusKm ?? 20,
    },
  });
  logger.logDebug('Instructor cached locally', { id: instructor.id });
}

module.exports = { findInstructorByPhone, cacheInstructor };