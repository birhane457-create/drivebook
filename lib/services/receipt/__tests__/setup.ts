/**
 * Vitest Test Setup
 * Sets test environment variables at module scope
 */

// Set default env vars for tests
process.env.SMTP_HOST    = process.env.SMTP_HOST    ?? 'localhost';
process.env.SMTP_PORT    = process.env.SMTP_PORT    ?? '1025';
process.env.SMTP_USER    = process.env.SMTP_USER    ?? 'test';
process.env.SMTP_PASS    = process.env.SMTP_PASS    ?? 'test';
process.env.ADMIN_EMAIL  = process.env.ADMIN_EMAIL  ?? 'admin@test.com';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
