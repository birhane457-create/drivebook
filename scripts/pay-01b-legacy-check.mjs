#!/usr/bin/env node
/**
 * PAY-01-B: Legacy Account Population Check
 * 
 * Queries production database + Stripe to detect:
 * 1. Providers with stripeAccountId but mismatched/missing Stripe metadata
 * 2. Stripe accounts without metadata.providerId
 * 3. Account type mismatches (not Express)
 * 
 * This determines whether simple fail-closed check is safe,
 * or if migration/reconciliation is needed first.
 */

import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover',
});

async function checkLegacyAccounts() {
  console.log('PAY-01-B: Legacy Account Population Check\n');
  console.log('='.repeat(60));

  // Step 1: Find all providers with Stripe accounts
  const providersWithStripe = await prisma.provider.findMany({
    where: {
      stripeAccountId: { not: null },
    },
    select: {
      id: true,
      name: true,
      stripeAccountId: true,
      approvalStatus: true,
      payoutMethod: true,
    },
  });

  console.log(`\n✅ Found ${providersWithStripe.length} providers with stripeAccountId\n`);

  if (providersWithStripe.length === 0) {
    console.log('✅ No providers with Stripe accounts - nothing to check');
    return {
      total: 0,
      mismatched: [],
      missingMetadata: [],
      wrongType: [],
      valid: [],
    };
  }

  // Step 2: Verify each account against Stripe
  const results = {
    total: providersWithStripe.length,
    mismatched: [],
    missingMetadata: [],
    wrongType: [],
    valid: [],
    stripeErrors: [],
  };

  for (const provider of providersWithStripe) {
    try {
      // Retrieve Stripe account
      const account = await stripe.accounts.retrieve(provider.stripeAccountId);

      // Check 1: Account type
      if (account.type !== 'express') {
        results.wrongType.push({
          providerId: provider.id,
          providerName: provider.name,
          stripeAccountId: provider.stripeAccountId,
          accountType: account.type,
          issue: `Account type is '${account.type}', expected 'express'`,
        });
        continue;
      }

      // Check 2: Metadata existence
      if (!account.metadata || !account.metadata.providerId) {
        results.missingMetadata.push({
          providerId: provider.id,
          providerName: provider.name,
          stripeAccountId: provider.stripeAccountId,
          metadata: account.metadata,
          issue: 'Missing metadata.providerId',
        });
        continue;
      }

      // Check 3: Metadata match
      if (account.metadata.providerId !== provider.id) {
        results.mismatched.push({
          providerId: provider.id,
          providerName: provider.name,
          stripeAccountId: provider.stripeAccountId,
          dbProviderId: provider.id,
          stripeProviderId: account.metadata.providerId,
          issue: `Metadata mismatch: DB=${provider.id}, Stripe=${account.metadata.providerId}`,
        });
        continue;
      }

      // All checks passed
      results.valid.push({
        providerId: provider.id,
        providerName: provider.name,
        stripeAccountId: provider.stripeAccountId,
        accountType: account.type,
        metadataProviderId: account.metadata.providerId,
      });

    } catch (err) {
      results.stripeErrors.push({
        providerId: provider.id,
        providerName: provider.name,
        stripeAccountId: provider.stripeAccountId,
        error: err.message,
        issue: 'Failed to retrieve Stripe account',
      });
    }
  }

  // Step 3: Report results
  console.log('\n📊 RESULTS:');
  console.log('='.repeat(60));
  console.log(`Total providers checked: ${results.total}`);
  console.log(`✅ Valid (correct binding): ${results.valid.length}`);
  console.log(`⚠️  Missing metadata: ${results.missingMetadata.length}`);
  console.log(`⚠️  Mismatched providerId: ${results.mismatched.length}`);
  console.log(`⚠️  Wrong account type: ${results.wrongType.length}`);
  console.log(`❌ Stripe API errors: ${results.stripeErrors.length}`);

  // Step 4: Detail problematic accounts
  if (results.missingMetadata.length > 0) {
    console.log('\n⚠️  MISSING METADATA:');
    console.log('='.repeat(60));
    results.missingMetadata.forEach((item) => {
      console.log(`Provider: ${item.providerName} (${item.providerId})`);
      console.log(`  Stripe Account: ${item.stripeAccountId}`);
      console.log(`  Issue: ${item.issue}`);
      console.log(`  Current Metadata: ${JSON.stringify(item.metadata)}\n`);
    });
  }

  if (results.mismatched.length > 0) {
    console.log('\n⚠️  MISMATCHED PROVIDER IDS:');
    console.log('='.repeat(60));
    results.mismatched.forEach((item) => {
      console.log(`Provider: ${item.providerName} (${item.providerId})`);
      console.log(`  Stripe Account: ${item.stripeAccountId}`);
      console.log(`  DB providerId: ${item.dbProviderId}`);
      console.log(`  Stripe metadata.providerId: ${item.stripeProviderId}`);
      console.log(`  Issue: ${item.issue}\n`);
    });
  }

  if (results.wrongType.length > 0) {
    console.log('\n⚠️  WRONG ACCOUNT TYPE:');
    console.log('='.repeat(60));
    results.wrongType.forEach((item) => {
      console.log(`Provider: ${item.providerName} (${item.providerId})`);
      console.log(`  Stripe Account: ${item.stripeAccountId}`);
      console.log(`  Account Type: ${item.accountType} (expected 'express')`);
      console.log(`  Issue: ${item.issue}\n`);
    });
  }

  if (results.stripeErrors.length > 0) {
    console.log('\n❌ STRIPE API ERRORS:');
    console.log('='.repeat(60));
    results.stripeErrors.forEach((item) => {
      console.log(`Provider: ${item.providerName} (${item.providerId})`);
      console.log(`  Stripe Account: ${item.stripeAccountId}`);
      console.log(`  Error: ${item.error}\n`);
    });
  }

  // Step 5: Remediation recommendation
  console.log('\n📋 REMEDIATION RECOMMENDATION:');
  console.log('='.repeat(60));

  const problematicCount = 
    results.missingMetadata.length + 
    results.mismatched.length + 
    results.wrongType.length;

  if (problematicCount === 0 && results.stripeErrors.length === 0) {
    console.log('✅ SAFE TO IMPLEMENT FAIL-CLOSED CHECK');
    console.log('   All accounts have correct metadata binding.');
    console.log('   No migration required.\n');
  } else {
    console.log('⚠️  MIGRATION REQUIRED BEFORE FAIL-CLOSED CHECK');
    console.log(`   ${problematicCount} account(s) need reconciliation.`);
    console.log('   Options:');
    console.log('   1. Update Stripe metadata for missing/mismatched accounts');
    console.log('   2. Block payouts for problematic accounts until fixed');
    console.log('   3. Create manual reconciliation workflow\n');
  }

  return results;
}

// Run check
checkLegacyAccounts()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Check failed:', err);
    process.exit(1);
  });
