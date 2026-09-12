/**
 * Config Validation Tests
 *
 * Verifies that the startup configuration guards work correctly.
 * The most important guard: DRIVEBOOK_BASE_URL must not be a localhost URL
 * in production — that was the root cause of all voice calls silently failing.
 *
 * Uses jest.resetModules() to re-require config.js with different env vars
 * for each test, ensuring guards are evaluated fresh each time.
 *
 * Run with: npm test -- config.test.js
 */

'use strict';

// Save originals so we can restore them after each test
const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  // Restore all env vars and reset module registry
  Object.keys(process.env).forEach((k) => delete process.env[k]);
  Object.assign(process.env, ORIGINAL_ENV);
  jest.resetModules();
});

// Helper: set a minimal valid production env, then override specific keys
function setProductionEnv(overrides = {}) {
  process.env.NODE_ENV            = 'production';
  process.env.DATABASE_URL        = 'mongodb://test-host/db';
  process.env.DRIVEBOOK_BASE_URL  = 'https://drivebook.com.au';
  process.env.DRIVEBOOK_API_KEY   = 'real-api-key-32chars-xxxxxxxxxx';
  process.env.INTERNAL_API_KEY    = 'real-internal-key-32chars-xxxxxx';
  process.env.VAPI_WEBHOOK_SECRET = 'real-webhook-secret-64chars-xxxxx';
  Object.assign(process.env, overrides);
}

// ── Production localhost guard ────────────────────────────────────────────────

describe('Config — production localhost guard', () => {

  test('throws when DRIVEBOOK_BASE_URL is localhost in production', () => {
    setProductionEnv({ DRIVEBOOK_BASE_URL: 'http://localhost:3000' });

    expect(() => require('../utils/config')).toThrow(/localhost/);
  });

  test('throws when DRIVEBOOK_BASE_URL is 127.0.0.1 in production', () => {
    setProductionEnv({ DRIVEBOOK_BASE_URL: 'http://127.0.0.1:3000' });

    expect(() => require('../utils/config')).toThrow(/127\.0\.0\.1|localhost/);
  });

  test('does not throw when DRIVEBOOK_BASE_URL is the real Vercel URL', () => {
    setProductionEnv({ DRIVEBOOK_BASE_URL: 'https://drivebook.com.au' });

    expect(() => require('../utils/config')).not.toThrow();
  });

  test('does not throw in development even with localhost URL', () => {
    process.env.NODE_ENV            = 'development';
    process.env.DATABASE_URL        = 'mongodb://localhost/db';
    process.env.DRIVEBOOK_BASE_URL  = 'http://localhost:3000';
    process.env.DRIVEBOOK_API_KEY   = 'dev-voice-key-change-in-production';
    process.env.INTERNAL_API_KEY    = 'generate-with-openssl-rand-hex-32';
    process.env.VAPI_WEBHOOK_SECRET = 'generate-with-openssl-rand-hex-32';

    expect(() => require('../utils/config')).not.toThrow();
  });

  test('does not throw in test environment', () => {
    process.env.NODE_ENV           = 'test';
    process.env.DATABASE_URL       = 'mongodb://localhost/test';
    process.env.DRIVEBOOK_BASE_URL = 'http://localhost:3000';

    expect(() => require('../utils/config')).not.toThrow();
  });

});

// ── Timeout defaults ──────────────────────────────────────────────────────────

describe('Config — proxy timeout defaults', () => {

  test('PROXY_TIMEOUT_MS defaults to 15000', () => {
    process.env.NODE_ENV     = 'test';
    process.env.DATABASE_URL = 'mongodb://localhost/test';
    delete process.env.PROXY_TIMEOUT_MS;

    const config = require('../utils/config');
    expect(config.PROXY_TIMEOUT_MS).toBe(15000);
  });

  test('custom PROXY_TIMEOUT_MS is respected', () => {
    process.env.NODE_ENV        = 'test';
    process.env.DATABASE_URL    = 'mongodb://localhost/test';
    process.env.PROXY_TIMEOUT_MS = '20000';

    const config = require('../utils/config');
    expect(config.PROXY_TIMEOUT_MS).toBe(20000);
  });

  test('PROXY_GET_RETRIES defaults to 2', () => {
    process.env.NODE_ENV     = 'test';
    process.env.DATABASE_URL = 'mongodb://localhost/test';
    delete process.env.PROXY_GET_RETRIES;

    const config = require('../utils/config');
    expect(config.PROXY_GET_RETRIES).toBe(2);
  });

  test('REQUEST_TIMEOUT defaults to 30000', () => {
    process.env.NODE_ENV     = 'test';
    process.env.DATABASE_URL = 'mongodb://localhost/test';
    delete process.env.REQUEST_TIMEOUT;

    const config = require('../utils/config');
    expect(config.REQUEST_TIMEOUT).toBe(30000);
  });

});

// ── Base URL export ───────────────────────────────────────────────────────────

describe('Config — DRIVEBOOK_BASE_URL export', () => {

  test('exports the configured URL', () => {
    process.env.NODE_ENV           = 'test';
    process.env.DATABASE_URL       = 'mongodb://localhost/test';
    process.env.DRIVEBOOK_BASE_URL = 'https://drivebook.com.au';

    const config = require('../utils/config');
    expect(config.DRIVEBOOK_BASE_URL).toBe('https://drivebook.com.au');
  });

  test('falls back to localhost:3000 when not set (non-production)', () => {
    process.env.NODE_ENV     = 'test';
    process.env.DATABASE_URL = 'mongodb://localhost/test';
    delete process.env.DRIVEBOOK_BASE_URL;

    const config = require('../utils/config');
    expect(config.DRIVEBOOK_BASE_URL).toBe('http://localhost:3000');
  });

});
