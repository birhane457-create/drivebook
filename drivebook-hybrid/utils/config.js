const dotenv = require('dotenv');
dotenv.config();

// Only DATABASE_URL is truly required - others have sensible defaults
const required = ['DATABASE_URL'];

const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  const message = `Missing required env vars: ${missing.join(', ')}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  } else {
    console.warn(`⚠️  WARNING: ${message}`);
    console.warn('   Some features may not work correctly.');
  }
}

// Warn about missing optional but important variables
const recommended = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'COPILOT_BASE_URL'
];

const missingRecommended = recommended.filter(k => !process.env[k]);
if (missingRecommended.length && process.env.NODE_ENV !== 'test') {
  console.warn(`⚠️  Missing recommended env vars: ${missingRecommended.join(', ')}`);
  console.warn('   Voice service features may not work correctly.');
}

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
  COPILOT_BASE_URL: process.env.COPILOT_BASE_URL || 'http://localhost:3001',
  DRIVEBOOK_BASE_URL: process.env.DRIVEBOOK_BASE_URL || 'http://localhost:3000',
  DRIVEBOOK_API_KEY: process.env.DRIVEBOOK_API_KEY || 'dev-voice-key-change-in-production',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'http://localhost:3001'],
  SKIP_TWILIO_VALIDATION: process.env.SKIP_TWILIO_VALIDATION === 'true',
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
  
  // Voice service configuration
  VOICEMAIL_MAX_LENGTH: parseInt(process.env.VOICEMAIL_MAX_LENGTH || '120', 10),
  COPILOT_TIMEOUT_MS: parseInt(process.env.COPILOT_TIMEOUT_MS || '5000', 10),
  MESSAGE_RATE_LIMIT: parseInt(process.env.MESSAGE_RATE_LIMIT || '5', 10),
  MESSAGE_RATE_WINDOW_HOURS: parseInt(process.env.MESSAGE_RATE_WINDOW_HOURS || '1', 10),
  
  // Security: Internal API key for accessing service documentation
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || 'dev-key-change-in-production',
};
