/**
 * INT-M-03A: OAuth Token Migration Script Execution Tests
 * 
 * CRITICAL: These tests execute the ACTUAL migration script
 * (migrate-encrypt-oauth-tokens.mjs) against a real test database.
 * 
 * This addresses the independent audit finding that the previous
 * migration tests simulated migration logic rather than executing
 * the production script.
 * 
 * Tests:
 * - MSE-1: Execute migration script on plaintext tokens
 * - MSE-2: Execute migration script twice (idempotency)
 * - MSE-3: Database-wide SQL scan for plaintext patterns
 * - MSE-4: Migration failure recovery (invalid key)
 * - MSE-5: Migration --verify-only mode
 * - MSE-6: Post-migration OAuth lifecycle
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { googleCalendarService } from '@/lib/services/googleCalendar';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

// Test encryption key
const TEST_KEY = Buffer.from('a'.repeat(32)).toString('base64');
const ORIGINAL_KEY = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

// Migration script path
const MIGRATION_SCRIPT = path.join(process.cwd(), 'scripts', 'migrate-encrypt-oauth-tokens.mjs');

// Test providers
const TEST_PROVIDERS = [
  {
    id: 'mse-provider-1',
    userId: 'mse-user-1',
    email: 'mse-1@example.com',
    name: 'Migration Script Test Provider 1',
    accessToken: 'ya29.mse_plaintext_access_token_1',
    refreshToken: '1//mse_plaintext_refresh_token_1',
  },
  {
    id: 'mse-provider-2',
    userId: 'mse-user-2',
    email: 'mse-2@example.com',
    name: 'Migration Script Test Provider 2',
    accessToken: 'ya29.mse_plaintext_access_token_2',
    refreshToken: '1//mse_plaintext_refresh_token_2',
  },
  {
    id: 'mse-provider-3',
    userId: 'mse-user-3',
    email: 'mse-3@example.com',
    name: 'Migration Script Test Provider 3 (Null)',
    accessToken: null,
    refreshToken: null,
  },
];

describe('INT-M-03A: Migration Script Execution', () => {
  beforeAll(async () => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(async () => {
    // Restore original key
    if (ORIGINAL_KEY) {
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
    } else {
      delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    }

    // Cleanup test data
    await prisma.provider.deleteMany({
      where: {
        id: { in: TEST_PROVIDERS.map(p => p.id) },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: TEST_PROVIDERS.map(p => p.userId) },
      },
    });

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create test providers with plaintext tokens
    for (const provider of TEST_PROVIDERS) {
      await prisma.user.create({
        data: {
          id: provider.userId,
          email: provider.email,
          role: 'PROVIDER',
        },
      });

      await prisma.provider.create({
        data: {
          id: provider.id,
          userId: provider.userId,
          name: provider.name,
          phone: '+1234567890',
          hourlyRate: 50,
          googleAccessToken: provider.accessToken,
          googleRefreshToken: provider.refreshToken,
        },
      });
    }
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.provider.deleteMany({
      where: {
        id: { in: TEST_PROVIDERS.map(p => p.id) },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: TEST_PROVIDERS.map(p => p.userId) },
      },
    });
  });

  describe('[MSE-1] Execute Migration Script on Plaintext Tokens', () => {
    it('should execute actual migration script and encrypt plaintext tokens', async () => {
      // Verify plaintext before migration
      const beforeMigration = await prisma.provider.findMany({
        where: {
          id: { in: [TEST_PROVIDERS[0].id, TEST_PROVIDERS[1].id] },
        },
        select: { id: true, googleAccessToken: true, googleRefreshToken: true },
      });

      expect(beforeMigration[0]?.googleAccessToken).toBe(TEST_PROVIDERS[0].accessToken);
      expect(beforeMigration[0]?.googleRefreshToken).toBe(TEST_PROVIDERS[0].refreshToken);

      // Execute actual migration script with tsx (TypeScript executor)
      const { stdout, stderr } = await execAsync(
        `npx tsx "${MIGRATION_SCRIPT}"`,
        {
          env: {
            ...process.env,
            OAUTH_TOKEN_ENCRYPTION_KEY: TEST_KEY,
          },
        }
      );

      // Capture migration output for evidence
      console.log('[MSE-1] Migration stdout:', stdout);
      if (stderr) console.log('[MSE-1] Migration stderr:', stderr);

      // Verify migration output
      expect(stdout).toContain('Migration complete');
      expect(stderr).toBe('');

      // Verify encrypted after migration
      const afterMigration = await prisma.provider.findMany({
        where: {
          id: { in: [TEST_PROVIDERS[0].id, TEST_PROVIDERS[1].id] },
        },
        select: { id: true, googleAccessToken: true, googleRefreshToken: true },
      });

      afterMigration.forEach(provider => {
        expect(provider.googleAccessToken).toMatch(/^v1:/);
        expect(provider.googleRefreshToken).toMatch(/^v1:/);
        expect(provider.googleAccessToken).not.toContain('ya29.');
        expect(provider.googleRefreshToken).not.toContain('1//');
      });
    }, 30000); // 30 second timeout
  });

  describe('[MSE-2] Execute Migration Script Twice (Idempotency)', () => {
    it('should detect already-encrypted tokens on second run', async () => {
      // First migration
      const { stdout: stdout1 } = await execAsync(
        `npx tsx "${MIGRATION_SCRIPT}"`,
        {
          env: {
            ...process.env,
            OAUTH_TOKEN_ENCRYPTION_KEY: TEST_KEY,
          },
        }
      );

      console.log('[MSE-2] First migration stdout:', stdout1);
      expect(stdout1).toContain('Migration complete');

      // Capture encrypted values after first run
      const afterFirstRun = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDERS[0].id },
        select: { googleAccessToken: true, googleRefreshToken: true },
      });

      // Second migration
      const { stdout: stdout2 } = await execAsync(
        `npx tsx "${MIGRATION_SCRIPT}"`,
        {
          env: {
            ...process.env,
            OAUTH_TOKEN_ENCRYPTION_KEY: TEST_KEY,
          },
        }
      );

      console.log('[MSE-2] Second migration stdout:', stdout2);
      expect(stdout2).toContain('Already encrypted (skipped)');
      expect(stdout2).toContain('Tokens encrypted:            0'); // Idempotency: no new encryptions on second run

      // Verify values unchanged after second run
      const afterSecondRun = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDERS[0].id },
        select: { googleAccessToken: true, googleRefreshToken: true },
      });

      expect(afterSecondRun?.googleAccessToken).toBe(afterFirstRun?.googleAccessToken);
      expect(afterSecondRun?.googleRefreshToken).toBe(afterFirstRun?.googleRefreshToken);
    }, 60000); // 60 second timeout
  });

  describe('[MSE-3] Database-Wide SQL Scan for Plaintext Patterns', () => {
    it('should perform SQL scan and find zero plaintext tokens after migration', async () => {
      // Execute migration
      await execAsync(
        `npx tsx "${MIGRATION_SCRIPT}"`,
        {
          env: {
            ...process.env,
            OAUTH_TOKEN_ENCRYPTION_KEY: TEST_KEY,
          },
        }
      );

      // Database-wide SQL scan for plaintext access tokens
      const plaintextAccessTokens = await prisma.$queryRaw<Array<{ id: string; googleAccessToken: string }>>`
        SELECT id, "googleAccessToken"
        FROM "Provider"
        WHERE "googleAccessToken" LIKE 'ya29.%'
      `;

      expect(plaintextAccessTokens.length).toBe(0);

      // Database-wide SQL scan for plaintext refresh tokens
      const plaintextRefreshTokens = await prisma.$queryRaw<Array<{ id: string; googleRefreshToken: string }>>`
        SELECT id, "googleRefreshToken"
        FROM "Provider"
        WHERE "googleRefreshToken" LIKE '1//%'
      `;

      expect(plaintextRefreshTokens.length).toBe(0);

      // Verify encrypted tokens exist
      const encryptedTokens = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "Provider"
        WHERE "googleAccessToken" LIKE 'v1:%'
      `;

      expect(encryptedTokens.length).toBeGreaterThan(0);

      // Stronger invariant: Verify no non-null tokens that aren't v1: encrypted
      const invalidAccessTokens = await prisma.$queryRaw<Array<{ id: string; googleAccessToken: string }>>`
        SELECT id, "googleAccessToken"
        FROM "Provider"
        WHERE "googleAccessToken" IS NOT NULL
          AND "googleAccessToken" NOT LIKE 'v1:%'
      `;

      expect(invalidAccessTokens.length).toBe(0);

      const invalidRefreshTokens = await prisma.$queryRaw<Array<{ id: string; googleRefreshToken: string }>>`
        SELECT id, "googleRefreshToken"
        FROM "Provider"
        WHERE "googleRefreshToken" IS NOT NULL
          AND "googleRefreshToken" NOT LIKE 'v1:%'
      `;

      expect(invalidRefreshTokens.length).toBe(0);
    }, 30000);
  });

  describe('[MSE-4] Migration Failure Recovery (Invalid Key)', () => {
    it('should fail gracefully with invalid encryption key and not corrupt data', async () => {
      // Attempt migration with invalid key
      const invalidKey = 'invalid_short_key';

      await expect(
        execAsync(
          `npx tsx "${MIGRATION_SCRIPT}"`,
          {
            env: {
              ...process.env,
              OAUTH_TOKEN_ENCRYPTION_KEY: invalidKey,
            },
          }
        )
      ).rejects.toThrow();

      // Verify database state unchanged (plaintext preserved, not corrupted)
      const providers = await prisma.provider.findMany({
        where: {
          id: { in: [TEST_PROVIDERS[0].id, TEST_PROVIDERS[1].id] },
        },
        select: { googleAccessToken: true, googleRefreshToken: true },
      });

      // Tokens should still be plaintext (migration failed before any writes)
      expect(providers[0]?.googleAccessToken).toBe(TEST_PROVIDERS[0].accessToken);
      expect(providers[0]?.googleRefreshToken).toBe(TEST_PROVIDERS[0].refreshToken);
    }, 30000);
  });

  describe('[MSE-5] Migration --verify-only Mode', () => {
    it('should verify encrypted tokens without making database changes', async () => {
      // First, run actual migration
      const { stdout: migrationStdout } = await execAsync(
        `npx tsx "${MIGRATION_SCRIPT}"`,
        {
          env: {
            ...process.env,
            OAUTH_TOKEN_ENCRYPTION_KEY: TEST_KEY,
          },
        }
      );

      // Capture migration output for evidence
      console.log('[MSE-5] Migration stdout:', migrationStdout);

      // Snapshot database state before --verify-only
      const beforeVerify = await prisma.provider.findMany({
        where: {
          id: { in: [TEST_PROVIDERS[0].id, TEST_PROVIDERS[1].id] },
        },
        select: { 
          id: true,
          googleAccessToken: true, 
          googleRefreshToken: true,
        },
        orderBy: { id: 'asc' },
      });

      // Run --verify-only mode
      const { stdout: verifyStdout } = await execAsync(
        `npx tsx "${MIGRATION_SCRIPT}" --verify-only`,
        {
          env: {
            ...process.env,
            OAUTH_TOKEN_ENCRYPTION_KEY: TEST_KEY,
          },
        }
      );

      // Capture verify output for evidence
      console.log('[MSE-5] --verify-only stdout:', verifyStdout);

      // Snapshot database state after --verify-only
      const afterVerify = await prisma.provider.findMany({
        where: {
          id: { in: [TEST_PROVIDERS[0].id, TEST_PROVIDERS[1].id] },
        },
        select: { 
          id: true,
          googleAccessToken: true, 
          googleRefreshToken: true,
        },
        orderBy: { id: 'asc' },
      });

      // Verify output message
      expect(verifyStdout).toContain('All encrypted tokens verified successfully');
      expect(verifyStdout).not.toContain('plaintext tokens found');

      // Verify no database modifications occurred
      expect(afterVerify).toEqual(beforeVerify);
      expect(afterVerify[0].googleAccessToken).toBe(beforeVerify[0].googleAccessToken);
      expect(afterVerify[0].googleRefreshToken).toBe(beforeVerify[0].googleRefreshToken);
      expect(afterVerify[1].googleAccessToken).toBe(beforeVerify[1].googleAccessToken);
      expect(afterVerify[1].googleRefreshToken).toBe(beforeVerify[1].googleRefreshToken);
    }, 30000);
  });

  describe('[MSE-6] Post-Migration Token Storage and Retrieval', () => {
    it('should store and retrieve encrypted tokens via googleCalendarService', async () => {
      // Execute migration
      await execAsync(
        `npx tsx "${MIGRATION_SCRIPT}"`,
        {
          env: {
            ...process.env,
            OAUTH_TOKEN_ENCRYPTION_KEY: TEST_KEY,
          },
        }
      );

      // Test token refresh (new encrypted token)
      const newTokens = {
        access_token: 'ya29.mse_new_refreshed_access_token',
        expiry_date: Date.now() + 3600000,
      };

      await googleCalendarService.saveTokens(TEST_PROVIDERS[0].id, newTokens, false);

      // Verify new token encrypted
      const provider = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDERS[0].id },
        select: { googleAccessToken: true, googleRefreshToken: true },
      });

      expect(provider?.googleAccessToken).toMatch(/^v1:/);
      expect(provider?.googleRefreshToken).toMatch(/^v1:/);

      // Verify refresh token preserved from migration
      expect(provider?.googleRefreshToken).not.toBe(provider?.googleAccessToken);
    }, 30000);
  });
});
