/**
 * INT-M-03A: OAuth Token Encryption
 * 
 * Encrypts Google OAuth access/refresh tokens before storing in database.
 * Prevents plaintext token exposure in database dumps, backups, and logs.
 * 
 * Cryptographic Specification:
 * - Algorithm: AES-256-GCM (authenticated encryption)
 * - Key: 256-bit random key from OAUTH_TOKEN_ENCRYPTION_KEY environment variable
 * - Nonce: 12 random bytes per encryption (96 bits, standard for GCM)
 * - Auth tag: 16 bytes (128 bits)
 * - Format: v1:<base64(nonce)>:<base64(ciphertext+tag)>
 * 
 * Version Prefix:
 * - v1: Initial format (12-byte nonce, AES-256-GCM)
 * - Future versions enable key rotation and format changes
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const NONCE_LENGTH = 12;      // 96 bits (standard for GCM)
const AUTH_TAG_LENGTH = 16;   // 128 bits
const VERSION = 'v1';

/**
 * Get encryption key from environment variable.
 * Validates key is exactly 32 bytes (256 bits).
 * 
 * @throws Error if key not configured or wrong size
 */
function getEncryptionKey(): Buffer {
  const key = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('[INT-M-03A] OAUTH_TOKEN_ENCRYPTION_KEY not configured');
  }

  const keyBuffer = Buffer.from(key, 'base64');
  
  if (keyBuffer.length !== 32) {
    throw new Error(
      `[INT-M-03A] Encryption key must be exactly 32 bytes (256 bits), got ${keyBuffer.length} bytes`
    );
  }

  return keyBuffer;
}

/**
 * Encrypt OAuth token using AES-256-GCM.
 * 
 * Format: v1:<base64(nonce)>:<base64(ciphertext+tag)>
 * 
 * @param plaintext - OAuth token (access or refresh)
 * @returns Encrypted token with version prefix, or original if empty
 */
export function encryptToken(plaintext: string | null | undefined): string | null {
  // Pass through null/undefined/empty values
  if (plaintext === null || plaintext === undefined) {
    return null;
  }
  
  if (plaintext === '') {
    return '';
  }

  const key = getEncryptionKey();
  const nonce = crypto.randomBytes(NONCE_LENGTH); // Unique per encryption

  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Combine ciphertext + auth tag
  const combined = Buffer.concat([encrypted, authTag]);

  // Format: v1:<nonce>:<ciphertext+tag>
  return `${VERSION}:${nonce.toString('base64')}:${combined.toString('base64')}`;
}

/**
 * Decrypt OAuth token encrypted with encryptToken().
 * 
 * @param ciphertext - Encrypted token with version prefix
 * @returns Decrypted plaintext token, or null if invalid
 */
export function decryptToken(ciphertext: string | null | undefined): string | null {
  // Pass through null/empty values
  if (!ciphertext) {
    return null;
  }

  try {
    // Parse format: v1:<nonce>:<ciphertext+tag>
    const parts = ciphertext.split(':');
    
    if (parts.length !== 3) {
      console.error('[INT-M-03A] Invalid ciphertext format: expected 3 parts, got', parts.length);
      return null;
    }

    const [version, nonceB64, combinedB64] = parts;

    // Verify version
    if (version !== VERSION) {
      console.error('[INT-M-03A] Unsupported encryption version:', version);
      return null;
    }

    const key = getEncryptionKey();
    const nonce = Buffer.from(nonceB64, 'base64');
    const combined = Buffer.from(combinedB64, 'base64');

    // Validate nonce length
    if (nonce.length !== NONCE_LENGTH) {
      console.error('[INT-M-03A] Invalid nonce length:', nonce.length);
      return null;
    }

    // Extract ciphertext and auth tag
    if (combined.length < AUTH_TAG_LENGTH) {
      console.error('[INT-M-03A] Combined data too short for auth tag');
      return null;
    }

    const encrypted = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);

    // Decrypt
    const decipher = crypto.createDecipheriv(ALGORITHM, key, nonce);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (error: any) {
    // Authentication tag verification failed or other decryption error
    console.error('[INT-M-03A] Token decryption failed:', error.message);
    return null;
  }
}

/**
 * Detect if token is already encrypted vs plaintext.
 * 
 * Google OAuth tokens have predictable formats:
 * - Access token: starts with "ya29." (Google's access token prefix)
 * - Refresh token: starts with "1//" (Google's refresh token prefix)
 * 
 * Encrypted tokens start with "v1:" version prefix.
 * 
 * @param token - Token to inspect
 * @returns true if encrypted, false if plaintext or null
 */
export function isTokenEncrypted(token: string | null | undefined): boolean {
  if (!token) {
    return false;
  }

  // Encrypted tokens have version prefix
  if (token.startsWith(`${VERSION}:`)) {
    return true;
  }

  // Google OAuth tokens are plaintext
  if (token.startsWith('ya29.') || token.startsWith('1//')) {
    return false;
  }

  // Unknown format — treat as plaintext to be safe
  // (Better to re-encrypt than fail to decrypt)
  return false;
}

/**
 * Validate encryption key format without throwing.
 * Used for startup checks and migration validation.
 * 
 * @returns true if key is valid, false otherwise
 */
export function validateEncryptionKey(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}
