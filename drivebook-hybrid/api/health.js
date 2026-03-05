// Vercel serverless function for health check
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = async (req, res) => {
  try {
    // Verify database connection
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'ok',
      service: 'drivebook-voice-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'error',
      service: 'drivebook-voice-api',
      timestamp: new Date().toISOString(),
      database: 'disconnected'
    });
  }
};
