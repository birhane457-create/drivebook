/**
 * Vitest Test Setup
 * Global configuration and mocks for receipt system tests
 */

import { beforeAll, afterAll, vi } from 'vitest';

// Mock environment variables
beforeAll(() => {
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '1025';
  process.env.SMTP_USER = 'test';
  process.env.SMTP_PASS = 'test';
  process.env.ADMIN_EMAIL = 'admin@test.com';
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
});

afterAll(() => {
  vi.clearAllMocks();
});
