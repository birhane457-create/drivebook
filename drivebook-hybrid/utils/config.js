'use strict';

const dotenv = require('dotenv');
dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest       = NODE_ENV === 'test';

//  Always required (every environment) 
const alwaysRequired = ['DATABASE_URL'];

const missingAlways = alwaysRequired.filter((k) => !process.env[k]);
if (missingAlways.length) {
  const msg = `Missing required env vars: ${missingAlways.join(', ')}`;
  if (isProduction) {
    throw new Error(msg);
  } else if (!isTest) {
    console.warn(`WARNING: ${msg}\n   Some features may not work correctly.`);
  }
}

//  Security-critical: required in production, warned in development 
// These vars either authenticate this service to external systems (DRIVEBOOK_API_KEY,
// TWILIO_*) or protect internal endpoints (INTERNAL_API_KEY).
// Known development defaults must never reach production  fail fast here.
const securityRequired = [
  'DRIVEBOOK_API_KEY',
  'INTERNAL_API_KEY',
];

// SMS vars are security-critical only when Twilio is actually configured.
// If TWILIO_ACCOUNT_SID is set, the other two must also be set.
const twilioEnabled = !!process.env.TWILIO_ACCOUNT_SID;
if (twilioEnabled) {
  securityRequired.push('TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER');
}

// Detect development placeholder values  same effect as missing
const DEV_PLACEHOLDERS = new Set([
  'dev-voice-key-change-in-production',
  'dev-key-change-in-production',
  'generate-with-openssl-rand-hex-32',
  'your-twilio-auth-token',
  'your-direct-line-secret-key',
]);

const insecure = securityRequired.filter((k) => {
  const val = process.env[k];
  return !val || DEV_PLACEHOLDERS.has(val);
});

if (insecure.length) {
  const msg = `Security-critical env vars are missing or set to development placeholders: ${insecure.join(', ')}`;
  if (isProduction) {
    // Hard fail  do not start with insecure defaults in production
    throw new Error(`[config] ${msg}`);
  } else if (!isTest) {
    console.warn(`WARNING: [config] ${msg}`);
    console.warn('   These must be real values before deploying to production.');
  }
}

//  Stale Copilot vars warning 
// If someone accidentally sets these (e.g. copied old .env), warn clearly.
if (!isTest && process.env.COPILOT_DIRECT_LINE_SECRET) {
  console.warn(
    'WARNING: [config] COPILOT_DIRECT_LINE_SECRET is set but Copilot Studio has been replaced by Vapi. ' +
    'Remove this var from your environment.'
  );
}

//  Export 
module.exports = {
  NODE_ENV,
  PORT: process.env.PORT || 3000,

  //  Database 
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',

  //  Main DriveBook app connection 
  DRIVEBOOK_BASE_URL: process.env.DRIVEBOOK_BASE_URL || 'http://localhost:3000',
  DRIVEBOOK_API_KEY:  process.env.DRIVEBOOK_API_KEY  || '',

  //  Twilio (SMS) 
  TWILIO_ACCOUNT_SID:      process.env.TWILIO_ACCOUNT_SID      || '',
  TWILIO_AUTH_TOKEN:       process.env.TWILIO_AUTH_TOKEN        || '',
  TWILIO_PHONE_NUMBER:     process.env.TWILIO_PHONE_NUMBER      || '',
  SKIP_TWILIO_VALIDATION:  process.env.SKIP_TWILIO_VALIDATION === 'true',

  //  Vapi (AI voice) 
  VAPI_API_KEY:      process.env.VAPI_API_KEY      || '',
  VAPI_ASSISTANT_ID: process.env.VAPI_ASSISTANT_ID || '',

  //  Security 
  // INTERNAL_API_KEY gates access to /docs and the root API endpoint.
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || '',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001'],

  //  Proxy & timeouts 
  REQUEST_TIMEOUT:   parseInt(process.env.REQUEST_TIMEOUT    || '30000', 10),
  PROXY_TIMEOUT_MS:  parseInt(process.env.PROXY_TIMEOUT_MS   || '8000',  10),
  PROXY_GET_RETRIES: parseInt(process.env.PROXY_GET_RETRIES  || '2',     10),

  //  Session 
  // SESSION_TTL_SECONDS is also read directly by voice-session-service.js
  // via process.env (it loads before config is required).
  SESSION_TTL_SECONDS: parseInt(process.env.SESSION_TTL_SECONDS || '600', 10),

  //  Rate limiting 
  MESSAGE_RATE_LIMIT:        parseInt(process.env.MESSAGE_RATE_LIMIT        || '5', 10),
  MESSAGE_RATE_WINDOW_HOURS: parseInt(process.env.MESSAGE_RATE_WINDOW_HOURS || '1', 10),

  //  Misc voice config 
  VOICEMAIL_MAX_LENGTH: parseInt(process.env.VOICEMAIL_MAX_LENGTH || '120', 10),
};