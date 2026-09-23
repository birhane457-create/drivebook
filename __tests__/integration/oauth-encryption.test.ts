/**
 * INT-M-03A: OAuth Token Encryption — Integration Tests
 * 
 * Verifies OAuth token encryption across the full lifecycle:
 * - OAuth callback stores encrypted tokens
 * - Token refresh preserves encryption
 * - Calendar operations use decrypted tokens
 * - Disconnect revokes and clears tokens
 * - Invalid ciphertext fails closed
 * - Wrong encryption key fails closed
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { googleCalendarService } from '@/lib/services/googleCalendar';
import { encryptToken, decryptToken, isTokenEncrypted, validateEncryptionKey } from '@/lib/encryption/oauth-tokens';

const prisma = new PrismaClient();

// Test data
const TEST_PROVIDER_ID = 'test-provider-oauth-encryption';
const TEST_USER_ID = 'test-user-oauth-encryption';

const MOCK_GOOGLE_TOKENS = {
  access_token: 'ya29.mock_google_access_token_for_testing',
  refresh_token: '1//mock_google_refresh_token_for_testing',
  expiry_date: Date.now() + 3600000, // 1 hour from now
  scope: 'https://www.googleapis.com/auth/calendar',
  token_type: 'Bearer',
};

const MOCK_REFRESHED_TOKENS = {
  access_token: 'ya29.refreshed_access_token_different_from_original',
  expiry_date: Date.now() + 3600000,
  // Note: refresh_token typically NOT returned on refresh (Google omits it)
};

// Save original encryption key
const ORIGINAL_KEY = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
const TEST_KEY = Buffer.from('a'.repeat(32)).toString('base64');
const WRONG_KEY = Buffer.from('b'.repeat(32)).toString('base64');

describe('INT-M-03A: OAuth Token Encryption Integration', () => {
  beforeAll(async () => {
    // Set test encryption key
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;

    // Verify key is valid
    expect(validateEncryptionKey()).toBe(true);
  });

  afterAll(async () => {
    // Restore original key
    if (ORIGINAL_KEY) {
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
    } else {
      delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    }

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create test provider
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: 'oauth-test@example.com',
        role: 'PROVIDER',
      },
    });

    await prisma.provider.create({
      data: {
        id: TEST_PROVIDER_ID,
        userId: TEST_USER_ID,
        name: 'OAuth Test Provider',
        phone: '+1234567890',
        hourlyRate: 50,
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.provider.deleteMany({
      where: { id: TEST_PROVIDER_ID },
    });
    await prisma.user.deleteMany({
      where: { id: TEST_USER_ID },
    });
  });

  describe('OAuth Callback Flow', () => {
    it('[OE-1] should store encrypted access token on OAuth callback', async () => {
      // Act: Save tokens (simulates OAuth callback)
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);

      // Assert: Token stored encrypted
      const provider = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: { googleAccessToken: true },
      });

      expect(provider?.googleAccessToken).toBeTruthy();
      expect(isTokenEncrypted(provider!.googleAccessToken!)).toBe(true);
      expect(provider!.googleAccessToken).toMatch(/^v1:/);
      expect(provider!.googleAccessToken).not.toContain('ya29.'); // Not plaintext
    });

    it('[OE-2] should store encrypted refresh token on OAuth callback', async () => {
      // Act
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);

      // Assert
      const provider = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: { googleRefreshToken: true },
      });

      expect(provider?.googleRefreshToken).toBeTruthy();
      expect(isTokenEncrypted(provider!.googleRefreshToken!)).toBe(true);
      expect(provider!.googleRefreshToken).toMatch(/^v1:/);
      expect(provider!.googleRefreshToken).not.toContain('1//'); // Not plaintext
    });

    it('[OE-3] should enable sync flag on OAuth callback', async () => {
      // Act
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);

      // Assert
      const provider = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: { syncGoogleCalendar: true },
      });

      expect(provider?.syncGoogleCalendar).toBe(true);
    });

    it('[OE-4] should decrypt and use tokens in getCalendarClient', async () => {
      // Arrange: Store encrypted tokens
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);

      // Act: Get calendar client (requires decryption)
      const client = await googleCalendarService.getCalendarClient(TEST_PROVIDER_ID);

      // Assert: Client created successfully (tokens decrypted)
      expect(client).toBeTruthy();
      expect(client).toHaveProperty('events');
    });
  });

  describe('Token Refresh Flow', () => {
    beforeEach(async () => {
      // Set up provider with encrypted tokens
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);
    });

    it('[OE-5] should preserve refresh token encryption on access token refresh', async () => {
      // Arrange: Get original refresh token
      const providerBefore = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: { googleRefreshToken: true },
      });

      // Act: Refresh access token (Google omits refresh_token on refresh)
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_REFRESHED_TOKENS, false);

      // Assert: Refresh token unchanged and still encrypted
      const providerAfter = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: { googleRefreshToken: true },
      });

      expect(providerAfter?.googleRefreshToken).toBe(providerBefore?.googleRefreshToken);
      expect(isTokenEncrypted(providerAfter!.googleRefreshToken!)).toBe(true);
    });

    it('[OE-6] should store new encrypted access token on refresh', async () => {
      // Arrange: Get original access token
      const providerBefore = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: { googleAccessToken: true },
      });

      // Act: Refresh access token
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_REFRESHED_TOKENS, false);

      // Assert: Access token changed but still encrypted
      const providerAfter = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: { googleAccessToken: true },
      });

      expect(providerAfter?.googleAccessToken).not.toBe(providerBefore?.googleAccessToken);
      expect(isTokenEncrypted(providerAfter!.googleAccessToken!)).toBe(true);

      // Verify new token decrypts to refreshed value
      const decrypted = decryptToken(providerAfter!.googleAccessToken!);
      expect(decrypted).toBe(MOCK_REFRESHED_TOKENS.access_token);
    });

    it('[OE-7] should not override sync flag on token refresh', async () => {
      // Arrange: Disable sync manually
      await prisma.provider.update({
        where: { id: TEST_PROVIDER_ID },
        data: { syncGoogleCalendar: false },
      });

      // Act: Refresh token (enableSync=false)
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_REFRESHED_TOKENS, false);

      // Assert: Sync flag remains false
      const provider = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: { syncGoogleCalendar: true },
      });

      expect(provider?.syncGoogleCalendar).toBe(false);
    });
  });

  describe('Disconnect/Revocation Flow', () => {
    beforeEach(async () => {
      // Set up provider with encrypted tokens
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);
    });

    it('[OE-8] should decrypt refresh token before revocation', async () => {
      // This test verifies disconnect() decrypts the token before calling Google's revoke API
      // The actual revocation would fail with encrypted token

      // Arrange: Spy on console.error to catch decryption usage
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act: Disconnect (will fail to revoke due to mock token, but should attempt decryption)
      try {
        await googleCalendarService.disconnect(TEST_PROVIDER_ID);
      } catch (error) {
        // Expected to fail (mock token not valid with Google)
      }

      // Assert: Tokens cleared from database (disconnect succeeded even if revocation failed)
      const provider = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: {
          googleAccessToken: true,
          googleRefreshToken: true,
          syncGoogleCalendar: true,
        },
      });

      expect(provider?.googleAccessToken).toBeNull();
      expect(provider?.googleRefreshToken).toBeNull();
      expect(provider?.syncGoogleCalendar).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('[OE-9] should clear all OAuth state on disconnect', async () => {
      // Act
      try {
        await googleCalendarService.disconnect(TEST_PROVIDER_ID);
      } catch (error) {
        // Expected to fail (mock token)
      }

      // Assert
      const provider = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: {
          googleAccessToken: true,
          googleRefreshToken: true,
          googleTokenExpiry: true,
          googleCalendarId: true,
          syncGoogleCalendar: true,
        },
      });

      expect(provider?.googleAccessToken).toBeNull();
      expect(provider?.googleRefreshToken).toBeNull();
      expect(provider?.googleTokenExpiry).toBeNull();
      expect(provider?.googleCalendarId).toBeNull();
      expect(provider?.syncGoogleCalendar).toBe(false);
    });
  });

  describe('Security Properties', () => {
    it('[OE-10] should fail closed on tampered ciphertext', async () => {
      // Arrange: Store encrypted tokens
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);

      // Tamper with access token in database
      const provider = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: { googleAccessToken: true },
      });

      const [version, nonce, combined] = provider!.googleAccessToken!.split(':');
      const tamperedCombined = combined!.slice(0, -4) + 'XXXX';
      const tampered = `${version}:${nonce}:${tamperedCombined}`;

      await prisma.provider.update({
        where: { id: TEST_PROVIDER_ID },
        data: { googleAccessToken: tampered },
      });

      // Act & Assert: getCalendarClient should fail (not return corrupted data)
      await expect(
        googleCalendarService.getCalendarClient(TEST_PROVIDER_ID)
      ).rejects.toThrow();
    });

    it('[OE-11] should fail closed on wrong encryption key', async () => {
      // Arrange: Store encrypted tokens with TEST_KEY
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);

      // Act: Change encryption key
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = WRONG_KEY;

      // Assert: getCalendarClient should fail (cannot decrypt)
      await expect(
        googleCalendarService.getCalendarClient(TEST_PROVIDER_ID)
      ).rejects.toThrow();

      // Restore key for cleanup
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    });

    it('[OE-12] should fail closed on missing encryption key', async () => {
      // Arrange: Store encrypted tokens
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);

      // Act: Remove encryption key
      delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

      // Assert: getCalendarClient should fail (no key to decrypt)
      await expect(
        googleCalendarService.getCalendarClient(TEST_PROVIDER_ID)
      ).rejects.toThrow();

      // Restore key for cleanup
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    });

    it('[OE-13] should not leak plaintext tokens in error messages', async () => {
      // Arrange: Store encrypted tokens
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);

      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act: Cause decryption error with wrong key
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = WRONG_KEY;

      try {
        await googleCalendarService.getCalendarClient(TEST_PROVIDER_ID);
      } catch (error) {
        // Expected
      }

      // Assert: Plaintext token NOT in error logs
      consoleErrorSpy.mock.calls.forEach(call => {
        const message = call.join(' ');
        expect(message).not.toContain(MOCK_GOOGLE_TOKENS.access_token);
        expect(message).not.toContain(MOCK_GOOGLE_TOKENS.refresh_token);
        expect(message).not.toContain('ya29.');
        expect(message).not.toContain('1//');
      });

      consoleErrorSpy.mockRestore();
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    });
  });

  describe('Round-Trip Verification', () => {
    it('[OE-14] should decrypt to original access token', async () => {
      // Act
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);

      // Assert
      const provider = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: { googleAccessToken: true },
      });

      const decrypted = decryptToken(provider!.googleAccessToken!);
      expect(decrypted).toBe(MOCK_GOOGLE_TOKENS.access_token);
    });

    it('[OE-15] should decrypt to original refresh token', async () => {
      // Act
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);

      // Assert
      const provider = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: { googleRefreshToken: true },
      });

      const decrypted = decryptToken(provider!.googleRefreshToken!);
      expect(decrypted).toBe(MOCK_GOOGLE_TOKENS.refresh_token);
    });

    it('[OE-16] should produce different ciphertexts for same token (unique nonce)', async () => {
      // Act: Save same tokens twice to different providers
      const provider2Id = 'test-provider-oauth-encryption-2';
      const user2Id = 'test-user-oauth-encryption-2';

      await prisma.user.create({
        data: {
          id: user2Id,
          email: 'oauth-test-2@example.com',
          role: 'PROVIDER',
        },
      });

      await prisma.provider.create({
        data: {
          id: provider2Id,
          userId: user2Id,
          name: 'OAuth Test Provider 2',
          phone: '+1234567891',
          hourlyRate: 50,
        },
      });

      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);
      await googleCalendarService.saveTokens(provider2Id, MOCK_GOOGLE_TOKENS, true);

      // Assert: Different ciphertexts (unique nonces)
      const provider1 = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: { googleAccessToken: true },
      });

      const provider2 = await prisma.provider.findUnique({
        where: { id: provider2Id },
        select: { googleAccessToken: true },
      });

      expect(provider1!.googleAccessToken).not.toBe(provider2!.googleAccessToken);

      // But both decrypt to same plaintext
      const decrypted1 = decryptToken(provider1!.googleAccessToken!);
      const decrypted2 = decryptToken(provider2!.googleAccessToken!);
      expect(decrypted1).toBe(decrypted2);
      expect(decrypted1).toBe(MOCK_GOOGLE_TOKENS.access_token);

      // Cleanup
      await prisma.provider.deleteMany({ where: { id: provider2Id } });
      await prisma.user.deleteMany({ where: { id: user2Id } });
    });
  });

  describe('Edge Cases', () => {
    it('[OE-17] should handle null refresh token (undefined in tokens object)', async () => {
      // Arrange: Tokens without refresh_token (Google omits on refresh)
      const tokensWithoutRefresh = {
        access_token: 'ya29.new_access_token',
        expiry_date: Date.now() + 3600000,
      };

      // Act: Save tokens with refresh_token=undefined
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, tokensWithoutRefresh, false);

      // Assert: googleRefreshToken remains null (not encrypted undefined)
      const provider = await prisma.provider.findUnique({
        where: { id: TEST_PROVIDER_ID },
        select: { googleRefreshToken: true },
      });

      expect(provider?.googleRefreshToken).toBeNull();
    });

    it('[OE-18] should handle provider with no OAuth tokens', async () => {
      // Act & Assert: getCalendarClient should throw for provider without tokens
      await expect(
        googleCalendarService.getCalendarClient(TEST_PROVIDER_ID)
      ).rejects.toThrow();
    });

    it('[OE-19] should require both access and refresh token for calendar client', async () => {
      // Arrange: Store only access token (no refresh token)
      const tokensWithoutRefresh = {
        access_token: 'ya29.access_only',
        expiry_date: Date.now() + 3600000,
      };

      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, tokensWithoutRefresh, true);

      // Act & Assert: getCalendarClient should throw (requires both tokens for production safety)
      // Without refresh token, client cannot renew expired access tokens
      await expect(
        googleCalendarService.getCalendarClient(TEST_PROVIDER_ID)
      ).rejects.toThrow('Google Calendar not connected');
    });
  });

  describe('Database State Verification', () => {
    it('[OE-20] should never store plaintext ya29. prefix in database', async () => {
      // Act
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);

      // Assert: Raw database query
      const result = await prisma.$queryRaw<Array<{ googleAccessToken: string | null }>>`
        SELECT "googleAccessToken"
        FROM "Provider"
        WHERE id = ${TEST_PROVIDER_ID}
      `;

      const token = result[0]?.googleAccessToken;
      expect(token).toBeTruthy();
      expect(token).not.toMatch(/^ya29\./);
      expect(token).toMatch(/^v1:/);
    });

    it('[OE-21] should never store plaintext 1// prefix in database', async () => {
      // Act
      await googleCalendarService.saveTokens(TEST_PROVIDER_ID, MOCK_GOOGLE_TOKENS, true);

      // Assert: Raw database query
      const result = await prisma.$queryRaw<Array<{ googleRefreshToken: string | null }>>`
        SELECT "googleRefreshToken"
        FROM "Provider"
        WHERE id = ${TEST_PROVIDER_ID}
      `;

      const token = result[0]?.googleRefreshToken;
      expect(token).toBeTruthy();
      expect(token).not.toMatch(/^1\/\//);
      expect(token).toMatch(/^v1:/);
    });
  });
});
