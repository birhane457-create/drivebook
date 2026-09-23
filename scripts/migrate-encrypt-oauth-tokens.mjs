#!/usr/bin/env node
/**
 * INT-M-03A: OAuth Token Encryption Migration
 * 
 * Encrypts existing plaintext Google OAuth tokens in the Provider table.
 * 
 * Safety Properties:
 * - Idempotent: Running twice does not double-encrypt
 * - Per-provider atomic: Each provider update is atomic
 * - Restartable: Migration can be safely rerun after partial completion
 * - Fail-closed: Encryption errors do not write plaintext back
 * - Key validation: Aborts before modifying records if key invalid
 * - No token disclosure: Tokens never printed in output/errors
 * - Verification: Confirms encrypted values decrypt successfully
 * 
 * Note: The migration processes providers individually (not in a single
 * global transaction). This design allows partial progress and safe restart
 * if the migration is interrupted. Each individual provider update is atomic.
 * 
 * Fields Encrypted:
 * - googleAccessToken
 * - googleRefreshToken
 * 
 * Usage:
 *   node scripts/migrate-encrypt-oauth-tokens.mjs [--dry-run] [--verify-only]
 * 
 * Options:
 *   --dry-run       Report what would be encrypted without modifying database
 *   --verify-only   Only verify existing encrypted tokens decrypt successfully
 */

import { PrismaClient } from '@prisma/client';
import { encryptToken, decryptToken, isTokenEncrypted, validateEncryptionKey } from '../lib/encryption/oauth-tokens.ts';

const prisma = new PrismaClient();

// Parse command-line flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerifyOnly = args.includes('--verify-only');

// Migration accounting
const stats = {
  scanned: 0,
  encrypted: 0,
  alreadyEncrypted: 0,
  nullOrEmpty: 0,
  failed: 0,
  verified: 0,
  verificationFailed: 0,
};

/**
 * Validate encryption key before starting migration.
 * Prevents partial migration with invalid key.
 */
function validateKey() {
  console.log('[INT-M-03A] Validating encryption key...');
  
  if (!validateEncryptionKey()) {
    console.error('❌ [INT-M-03A] Encryption key validation failed');
    console.error('   OAUTH_TOKEN_ENCRYPTION_KEY must be set and exactly 32 bytes (256 bits)');
    console.error('   Generate key: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
    process.exit(1);
  }
  
  console.log('✅ [INT-M-03A] Encryption key valid\n');
}

/**
 * Encrypt provider's OAuth tokens if plaintext.
 * Returns updated token values or null if no change needed.
 * 
 * @param {Object} provider - Provider record with OAuth tokens
 * @returns {Object|null} - Updated tokens or null if no change
 */
function encryptProviderTokens(provider) {
  const updates = {};
  let needsUpdate = false;

  // Encrypt googleAccessToken if plaintext
  if (provider.googleAccessToken) {
    if (isTokenEncrypted(provider.googleAccessToken)) {
      stats.alreadyEncrypted++;
    } else {
      try {
        updates.googleAccessToken = encryptToken(provider.googleAccessToken);
        needsUpdate = true;
      } catch (error) {
        console.error(`❌ [Provider ${provider.id}] Failed to encrypt googleAccessToken: ${error.message}`);
        stats.failed++;
        return null; // Fail-closed: do not write plaintext back
      }
    }
  } else {
    stats.nullOrEmpty++;
  }

  // Encrypt googleRefreshToken if plaintext
  if (provider.googleRefreshToken) {
    if (isTokenEncrypted(provider.googleRefreshToken)) {
      if (!needsUpdate) {
        stats.alreadyEncrypted++;
      }
    } else {
      try {
        updates.googleRefreshToken = encryptToken(provider.googleRefreshToken);
        needsUpdate = true;
      } catch (error) {
        console.error(`❌ [Provider ${provider.id}] Failed to encrypt googleRefreshToken: ${error.message}`);
        stats.failed++;
        return null; // Fail-closed: do not write plaintext back
      }
    }
  } else {
    if (!updates.googleAccessToken) {
      stats.nullOrEmpty++;
    }
  }

  return needsUpdate ? updates : null;
}

/**
 * Verify encrypted token decrypts successfully.
 * 
 * @param {string} token - Encrypted token
 * @param {string} fieldName - Field name for logging
 * @param {string} providerId - Provider ID for logging
 * @returns {boolean} - True if decryption successful
 */
function verifyEncryptedToken(token, fieldName, providerId) {
  if (!token) {
    return true; // Null/empty is valid
  }

  if (!isTokenEncrypted(token)) {
    console.error(`❌ [Provider ${providerId}] ${fieldName} not encrypted (plaintext detected)`);
    return false;
  }

  const decrypted = decryptToken(token);
  
  if (!decrypted) {
    console.error(`❌ [Provider ${providerId}] ${fieldName} decryption failed`);
    return false;
  }

  // Verify it looks like a Google token
  const isAccessToken = decrypted.startsWith('ya29.');
  const isRefreshToken = decrypted.startsWith('1//');
  
  if (!isAccessToken && !isRefreshToken) {
    console.error(`❌ [Provider ${providerId}] ${fieldName} decrypted but format invalid (not a Google token)`);
    return false;
  }

  return true;
}

/**
 * Migrate all providers with OAuth tokens.
 */
async function migrateProviders() {
  console.log('[INT-M-03A] Fetching providers with OAuth tokens...\n');

  // Find providers with any OAuth token set
  const providers = await prisma.provider.findMany({
    where: {
      OR: [
        { googleAccessToken: { not: null } },
        { googleRefreshToken: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      syncGoogleCalendar: true,
    },
  });

  console.log(`Found ${providers.length} providers with OAuth tokens\n`);

  if (providers.length === 0) {
    console.log('✅ No providers to migrate\n');
    return;
  }

  // Process each provider
  for (const provider of providers) {
    stats.scanned++;

    const updates = encryptProviderTokens(provider);

    if (updates) {
      // Need to encrypt this provider's tokens
      if (isDryRun) {
        console.log(`[DRY RUN] Would encrypt tokens for provider ${provider.id} (${provider.name})`);
        stats.encrypted++;
      } else {
        try {
          await prisma.provider.update({
            where: { id: provider.id },
            data: updates,
          });
          
          console.log(`✅ Encrypted tokens for provider ${provider.id} (${provider.name})`);
          stats.encrypted++;
        } catch (error) {
          console.error(`❌ [Provider ${provider.id}] Database update failed: ${error.message}`);
          stats.failed++;
        }
      }
    }
  }
}

/**
 * Verify all encrypted tokens decrypt successfully.
 */
async function verifyEncryptedTokens() {
  console.log('[INT-M-03A] Verifying encrypted OAuth tokens...\n');

  const providers = await prisma.provider.findMany({
    where: {
      OR: [
        { googleAccessToken: { not: null } },
        { googleRefreshToken: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      googleAccessToken: true,
      googleRefreshToken: true,
    },
  });

  console.log(`Found ${providers.length} providers with OAuth tokens\n`);

  for (const provider of providers) {
    let providerValid = true;

    if (provider.googleAccessToken) {
      const valid = verifyEncryptedToken(
        provider.googleAccessToken,
        'googleAccessToken',
        provider.id
      );
      
      if (!valid) {
        providerValid = false;
        stats.verificationFailed++;
      }
    }

    if (provider.googleRefreshToken) {
      const valid = verifyEncryptedToken(
        provider.googleRefreshToken,
        'googleRefreshToken',
        provider.id
      );
      
      if (!valid) {
        providerValid = false;
        stats.verificationFailed++;
      }
    }

    if (providerValid) {
      stats.verified++;
    }
  }
}

/**
 * Print migration statistics.
 */
function printStats() {
  console.log('\n' + '='.repeat(60));
  console.log('INT-M-03A: OAuth Token Encryption Migration Summary');
  console.log('='.repeat(60));
  
  if (isVerifyOnly) {
    console.log(`Providers verified:          ${stats.verified}`);
    console.log(`Verification failures:       ${stats.verificationFailed}`);
    
    if (stats.verificationFailed > 0) {
      console.log('\n❌ Verification failed - some tokens cannot be decrypted');
      process.exit(1);
    } else {
      console.log('\n✅ All encrypted tokens verified successfully');
    }
  } else {
    console.log(`Providers scanned:           ${stats.scanned}`);
    console.log(`Tokens encrypted:            ${stats.encrypted}`);
    console.log(`Already encrypted (skipped): ${stats.alreadyEncrypted}`);
    console.log(`Null/empty (skipped):        ${stats.nullOrEmpty}`);
    console.log(`Failed:                      ${stats.failed}`);
    
    if (isDryRun) {
      console.log('\n[DRY RUN] No database changes made');
    } else if (stats.failed > 0) {
      console.log('\n⚠️  Migration completed with failures - review errors above');
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully');
    }
  }
  
  console.log('='.repeat(60) + '\n');
}

/**
 * Main migration entry point.
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('INT-M-03A: OAuth Token Encryption Migration');
  console.log('='.repeat(60) + '\n');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No database changes will be made\n');
  }

  if (isVerifyOnly) {
    console.log('🔍 VERIFY-ONLY MODE - Only checking encrypted tokens\n');
  }

  try {
    // Step 1: Validate encryption key
    validateKey();

    // Step 2: Either verify or migrate
    if (isVerifyOnly) {
      await verifyEncryptedTokens();
    } else {
      await migrateProviders();
      
      // Step 3: Verify encrypted tokens decrypt successfully
      if (!isDryRun && stats.encrypted > 0) {
        console.log('\n[INT-M-03A] Verifying newly encrypted tokens...\n');
        await verifyEncryptedTokens();
      }
    }

    // Step 4: Print summary
    printStats();

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
main();
