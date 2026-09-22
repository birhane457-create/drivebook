/**
 * Vitest Test Setup
 * Sets test environment variables at module scope
 * MUST run before any Prisma client imports
 */

// CRITICAL: Set test database URL BEFORE any imports
// This prevents accidental production database access during tests
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:testpass@localhost:5433/drivebook_test';

// Set default env vars for tests
process.env.SMTP_HOST    = process.env.SMTP_HOST    ?? 'localhost';
process.env.SMTP_PORT    = process.env.SMTP_PORT    ?? '1025';
process.env.SMTP_USER    = process.env.SMTP_USER    ?? 'test';
process.env.SMTP_PASS    = process.env.SMTP_PASS    ?? 'test';
process.env.ADMIN_EMAIL  = process.env.ADMIN_EMAIL  ?? 'admin@test.com';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
