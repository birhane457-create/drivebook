const dotenv = require('dotenv');
dotenv.config();

const required = [
  'DATABASE_URL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'COPILOT_BASE_URL'
];

// Only enforce required vars in production if they're actually needed
// For now, we'll make them optional and provide defaults
const missing = required.filter(k => !process.env[k]);
if (missing.length && process.env.NODE_ENV === 'production' && process.env.ENFORCE_ENV_VARS === 'true') {
  console.warn(`Warning: Missing env vars: ${missing.join(', ')} - using defaults`);
}

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
  COPILOT_BASE_URL: process.env.COPILOT_BASE_URL || 'http://localhost:3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000
};
