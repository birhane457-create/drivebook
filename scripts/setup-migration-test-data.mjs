#!/usr/bin/env node
/**
 * INT-M-03A: Migration Test Data Setup
 * 
 * Creates test providers with plaintext OAuth tokens for migration testing.
 * Simulates pre-migration database state.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_PROVIDERS = [
  {
    id: 'migration-test-provider-1',
    userId: 'migration-test-user-1',
    email: 'migration-test-1@example.com',
    name: 'Migration Test Provider 1',
    googleAccessToken: 'ya29.mock_plaintext_access_token_provider_1',
    googleRefreshToken: '1//mock_plaintext_refresh_token_provider_1',
  },
  {
    id: 'migration-test-provider-2',
    userId: 'migration-test-user-2',
    email: 'migration-test-2@example.com',
    name: 'Migration Test Provider 2',
    googleAccessToken: 'ya29.mock_plaintext_access_token_provider_2',
    googleRefreshToken: '1//mock_plaintext_refresh_token_provider_2',
  },
  {
    id: 'migration-test-provider-3',
    userId: 'migration-test-user-3',
    email: 'migration-test-3@example.com',
    name: 'Migration Test Provider 3 (No Tokens)',
    googleAccessToken: null,
    googleRefreshToken: null,
  },
];

async function setupTestData() {
  console.log('[INT-M-03A] Setting up migration test data...\n');

  for (const provider of TEST_PROVIDERS) {
    // Create user
    await prisma.user.upsert({
      where: { id: provider.userId },
      create: {
        id: provider.userId,
        email: provider.email,
        role: 'PROVIDER',
      },
      update: {},
    });

    // Create provider with plaintext OAuth tokens
    await prisma.provider.upsert({
      where: { id: provider.id },
      create: {
        id: provider.id,
        userId: provider.userId,
        name: provider.name,
        phone: '+1234567890',
        hourlyRate: 50,
        googleAccessToken: provider.googleAccessToken,
        googleRefreshToken: provider.googleRefreshToken,
        googleTokenExpiry: provider.googleAccessToken ? new Date(Date.now() + 3600000) : null,
        syncGoogleCalendar: provider.googleAccessToken ? true : false,
      },
      update: {
        googleAccessToken: provider.googleAccessToken,
        googleRefreshToken: provider.googleRefreshToken,
        googleTokenExpiry: provider.googleAccessToken ? new Date(Date.now() + 3600000) : null,
        syncGoogleCalendar: provider.googleAccessToken ? true : false,
      },
    });

    console.log(`✅ Created/updated: ${provider.name}`);
    if (provider.googleAccessToken) {
      console.log(`   Access token: ${provider.googleAccessToken.substring(0, 20)}...`);
      console.log(`   Refresh token: ${provider.googleRefreshToken.substring(0, 20)}...`);
    } else {
      console.log(`   No OAuth tokens`);
    }
  }

  console.log(`\n✅ Test data setup complete`);
  console.log(`   Providers with plaintext tokens: 2`);
  console.log(`   Providers without tokens: 1`);
}

async function main() {
  try {
    await setupTestData();
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
