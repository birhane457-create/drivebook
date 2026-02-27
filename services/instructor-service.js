const { getDriveBookClient } = require('./drivebook-api-client');
const db = require('./database-service');
const { phoneSchema } = require('../utils/validators');
const logger = require('../utils/logger');

const driveBook = getDriveBookClient();

async function findInstructorByPhone(phone) {
  const start = Date.now();
  const parsed = phoneSchema.safeParse(phone);
  if (!parsed.success) {
    logger.logWarning('Invalid phone format in instructor lookup');
    return null;
  }
  const normalized = parsed.data;
  
  try {
    // Try DriveBook API first
    logger.logInfo('Querying DriveBook API for instructor', { phone: normalized });
    const instructor = await driveBook.findInstructorByPhone(normalized);
    const ms = Date.now() - start;
    
    if (instructor) {
      logger.logInfo('Instructor found via DriveBook API', { phone: normalized, ms });
      // Cache locally
      cacheInstructor(instructor);
      return instructor;
    }
    
    logger.logInfo('Instructor not found in DriveBook', { phone: normalized, ms });
  } catch (err) {
    logger.logWarning('DriveBook API error, checking cache', { err: err.message });
    // Fall back to local cache
  }

  // Check local SQLite cache
  try {
    const cached = await db.prisma.instructor.findFirst({
      where: { phone: normalized }
    });
    
    if (cached) {
      logger.logInfo('Instructor found in local cache', { phone: normalized, ms: Date.now() - start });
      return {
        id: cached.id,
        name: cached.name,
        hourlyRate: cached.hourlyRate,
        serviceAreas: cached.serviceAreas,
        copilotAgentEndpoint: cached.copilotAgentEndpoint,
        fromCache: true
      };
    }
  } catch (err) {
    logger.logError(err, { context: 'Cache lookup failed' });
  }
  
  logger.logInfo('Instructor not found', { phone: normalized, ms: Date.now() - start });
  return null;
}

// Cache instructor locally for resilience
async function cacheInstructor(instructor) {
  try {
    await db.prisma.instructor.upsert({
      where: { id: instructor.id },
      update: { updatedAt: new Date() },
      create: {
        id: instructor.id,
        phone: instructor.phone,
        name: instructor.name,
        hourlyRate: instructor.hourlyRate,
        copilotAgentEndpoint: instructor.copilotAgentEndpoint || '',
        baseLatitude: instructor.baseLatitude || 0,
        baseLongitude: instructor.baseLongitude || 0,
        serviceRadiusKm: instructor.serviceRadiusKm || 20
      }
    });
    logger.logDebug('Instructor cached', { id: instructor.id });
  } catch (err) {
    logger.logWarning('Failed to cache instructor', { id: instructor.id, err: err.message });
  }
}

module.exports = { findInstructorByPhone, cacheInstructor };