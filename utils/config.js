const dotenv = require('dotenv');
dotenv.config();

const required = [
  'DATABASE_URL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'COPILOT_BASE_URL'
];

const missing = required.filter(k => !process.env[k]);
if (missing.length && process.env.NODE_ENV === 'production') {
  throw new Error(`Missing required env vars: ${missing.join(', ')}`);
}

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
  COPILOT_BASE_URL: process.env.COPILOT_BASE_URL || 'http://localhost:3001',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'http://localhost:3001'],
  SKIP_TWILIO_VALIDATION: process.env.SKIP_TWILIO_VALIDATION === 'true',
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10)
};
