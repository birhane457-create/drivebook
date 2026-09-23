/**
 * INT-M-03A: OAuth Token Encryption — Unit Tests
 * 
 * Tests encryption/decryption of Google OAuth tokens before storage.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptToken, decryptToken, isTokenEncrypted, validateEncryptionKey } from '../oauth-tokens';

// Test encryption key (32 bytes base64-encoded)
const TEST_KEY = Buffer.from('a'.repeat(32)).toString('base64');
const ORIGINAL_KEY = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

describe('INT-M-03A: OAuth Token Encryption', () => {
  beforeEach(() => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    // Restore original key
    if (ORIGINAL_KEY) {
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
    } else {
      delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    }
  });

  describe('encryptToken()', () => {
    it('should encrypt plaintext Google access token', () => {
      const plaintext = 'ya29.a0AfH6SMBx_mock_google_access_token_example';
      const encrypted = encryptToken(plaintext);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toMatch(/^v1:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/);
    });

    it('should encrypt plaintext Google refresh token', () => {
      const plaintext = '1//0gXYZ_mock_google_refresh_token_example';
      const encrypted = encryptToken(plaintext);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toMatch(/^v1:/);
    });

    it('should produce different ciphertext for same plaintext (unique nonce)', () => {
      const plaintext = 'ya29.test_token';
      
      const encrypted1 = encryptToken(plaintext);
      const encrypted2 = encryptToken(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decryptToken(encrypted1)).toBe(plaintext);
      expect(decryptToken(encrypted2)).toBe(plaintext);
    });

    it('should handle null token', () => {
      expect(encryptToken(null)).toBeNull();
    });

    it('should handle undefined token', () => {
      expect(encryptToken(undefined)).toBeNull();
    });

    it('should handle empty string', () => {
      expect(encryptToken('')).toBe('');
    });

    it('should throw if encryption key not configured', () => {
      delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

      expect(() => encryptToken('ya29.test')).toThrow(
        '[INT-M-03A] OAUTH_TOKEN_ENCRYPTION_KEY not configured'
      );
    });

    it('should throw if encryption key wrong size', () => {
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.from('short').toString('base64');

      expect(() => encryptToken('ya29.test')).toThrow(
        /Encryption key must be exactly 32 bytes/
      );
    });
  });

  describe('decryptToken()', () => {
    it('should decrypt encrypted token', () => {
      const plaintext = 'ya29.test_access_token';
      const encrypted = encryptToken(plaintext);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should return null for null ciphertext', () => {
      expect(decryptToken(null)).toBeNull();
    });

    it('should return null for undefined ciphertext', () => {
      expect(decryptToken(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(decryptToken('')).toBeNull();
    });

    it('should return null for invalid format (missing parts)', () => {
      const invalid = 'v1:only_two_parts';
      expect(decryptToken(invalid)).toBeNull();
    });

    it('should return null for invalid format (extra parts)', () => {
      const invalid = 'v1:part1:part2:part3:extra';
      expect(decryptToken(invalid)).toBeNull();
    });

    it('should return null for unsupported version', () => {
      const unsupported = 'v2:AAAAbW9jawo=:AAAAbW9jawo=';
      expect(decryptToken(unsupported)).toBeNull();
    });

    it('should return null for invalid base64 nonce', () => {
      const invalid = 'v1:invalid!!!:AAAAbW9jawo=';
      expect(decryptToken(invalid)).toBeNull();
    });

    it('should return null for tampered ciphertext (auth tag fail)', () => {
      const plaintext = 'ya29.test_token';
      const encrypted = encryptToken(plaintext);
      
      // Tamper with ciphertext part
      const [version, nonce, combined] = encrypted!.split(':');
      const tamperedCombined = combined!.slice(0, -4) + 'XXXX';
      const tampered = `${version}:${nonce}:${tamperedCombined}`;

      expect(decryptToken(tampered)).toBeNull();
    });

    it('should return null for wrong encryption key', () => {
      const plaintext = 'ya29.test_token';
      const encrypted = encryptToken(plaintext);

      // Change key
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.from('b'.repeat(32)).toString('base64');

      expect(decryptToken(encrypted)).toBeNull();
    });
  });

  describe('isTokenEncrypted()', () => {
    it('should detect encrypted token (v1 prefix)', () => {
      const plaintext = 'ya29.test';
      const encrypted = encryptToken(plaintext);

      expect(isTokenEncrypted(encrypted)).toBe(true);
    });

    it('should detect plaintext Google access token (ya29. prefix)', () => {
      expect(isTokenEncrypted('ya29.a0AfH6SMBx...')).toBe(false);
    });

    it('should detect plaintext Google refresh token (1// prefix)', () => {
      expect(isTokenEncrypted('1//0gXYZ...')).toBe(false);
    });

    it('should treat null as not encrypted', () => {
      expect(isTokenEncrypted(null)).toBe(false);
    });

    it('should treat undefined as not encrypted', () => {
      expect(isTokenEncrypted(undefined)).toBe(false);
    });

    it('should treat empty string as not encrypted', () => {
      expect(isTokenEncrypted('')).toBe(false);
    });

    it('should treat unknown format as not encrypted (safe default)', () => {
      // Unknown token format should be treated as plaintext to trigger re-encryption
      expect(isTokenEncrypted('unknown_token_format')).toBe(false);
    });
  });

  describe('validateEncryptionKey()', () => {
    it('should return true for valid key', () => {
      expect(validateEncryptionKey()).toBe(true);
    });

    it('should return false if key not configured', () => {
      delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
      expect(validateEncryptionKey()).toBe(false);
    });

    it('should return false if key wrong size', () => {
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.from('short').toString('base64');
      expect(validateEncryptionKey()).toBe(false);
    });
  });

  describe('Format Specification', () => {
    it('should use v1 version prefix', () => {
      const encrypted = encryptToken('ya29.test');
      expect(encrypted).toMatch(/^v1:/);
    });

    it('should use 3-part format (version:nonce:ciphertext+tag)', () => {
      const encrypted = encryptToken('ya29.test');
      const parts = encrypted!.split(':');
      
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('v1');
      expect(parts[1]).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 nonce
      expect(parts[2]).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 ciphertext+tag
    });

    it('should use 12-byte nonce (16 base64 chars)', () => {
      const encrypted = encryptToken('ya29.test');
      const [, nonceB64] = encrypted!.split(':');
      const nonce = Buffer.from(nonceB64, 'base64');

      expect(nonce.length).toBe(12); // 96 bits
    });

    it('should include 16-byte auth tag in ciphertext part', () => {
      const plaintext = 'ya29.short'; // 10 chars
      const encrypted = encryptToken(plaintext);
      const [,, combinedB64] = encrypted!.split(':');
      const combined = Buffer.from(combinedB64, 'base64');

      // Combined = ciphertext + 16-byte auth tag
      // Ciphertext length ~= plaintext length (AES is block cipher but GCM is streaming)
      expect(combined.length).toBeGreaterThanOrEqual(16); // At least auth tag
    });
  });

  describe('Round-trip Encryption', () => {
    const testCases = [
      { label: 'Short token', value: 'ya29.abc' },
      { label: 'Long token', value: 'ya29.' + 'x'.repeat(500) },
      { label: 'Special chars', value: 'ya29.token/with+special=chars' },
      { label: 'Unicode', value: 'ya29.token_with_émojis_🔒' },
      { label: 'Newlines', value: 'ya29.token\nwith\nnewlines' },
    ];

    testCases.forEach(({ label, value }) => {
      it(`should handle ${label}`, () => {
        const encrypted = encryptToken(value);
        const decrypted = decryptToken(encrypted);

        expect(decrypted).toBe(value);
      });
    });
  });

  describe('Security Properties', () => {
    it('should not leak plaintext in error messages', () => {
      const plaintext = 'ya29.secret_token_should_not_appear_in_logs';
      
      // Cause decryption error with wrong key
      const encrypted = encryptToken(plaintext);
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.from('b'.repeat(32)).toString('base64');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = decryptToken(encrypted);

      expect(result).toBeNull();
      
      // Verify plaintext NOT in any console.error call
      consoleSpy.mock.calls.forEach(call => {
        const message = call.join(' ');
        expect(message).not.toContain(plaintext);
        expect(message).not.toContain('secret_token');
      });

      consoleSpy.mockRestore();
    });

    it('should fail closed on tampered ciphertext (not return garbage)', () => {
      const plaintext = 'ya29.valid_token';
      const encrypted = encryptToken(plaintext);
      
      // Tamper with ciphertext
      const [version, nonce, combined] = encrypted!.split(':');
      const tamperedCombined = combined!.slice(0, -4) + 'XXXX';
      const tampered = `${version}:${nonce}:${tamperedCombined}`;

      const result = decryptToken(tampered);

      // Must return null (fail closed), not corrupted plaintext
      expect(result).toBeNull();
    });
  });
});
