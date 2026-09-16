#!/usr/bin/env node
/**
 * SUB-22 Step 1: Production Duplicate-Data Check
 * 
 * Queries the database to identify:
 * 1. Duplicate Subscription rows per provider
 * 2. Duplicate stripeSubscriptionId values
 * 3. Current database constraints on Subscription.stripeSubscriptionId
 * 4. Production state summary
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDuplicateSubscriptions() {
  console.log('='.repeat(80));
  console.log('SUB-22 STEP 1: PRODUCTION DUPLICATE-DATA CHECK');
  console.log('='.repeat(80));
  console.log();

  try {
    // 1. Check for multiple active subscriptions per provider
    console.log('1. CHECKING FOR MULTIPLE ACTIVE SUBSCRIPTIONS PER PROVIDER');
    console.log('-'.repeat(80));
    
    const activeSubsPerProvider = await prisma.$queryRaw`
      SELECT 
        "providerId",
        COUNT(*) as subscription_count,
        array_agg(id) as subscription_ids,
        array_agg(status) as statuses,
        array_agg("stripeSubscriptionId") as stripe_sub_ids
      FROM "Subscription"
      WHERE status IN ('ACTIVE', 'TRIAL', 'PAST_DUE')
      GROUP BY "providerId"
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC;
    `;

    if (activeSubsPerProvider.length === 0) {
      console.log('✅ No providers with multiple active subscriptions found');
    } else {
      console.log(`⚠️  Found ${activeSubsPerProvider.length} provider(s) with multiple active subscriptions:`);
      activeSubsPerProvider.forEach((row, idx) => {
        console.log(`\n  Provider ${idx + 1}:`);
        console.log(`    Provider ID: ${row.providerId}`);
        console.log(`    Subscription count: ${row.subscription_count}`);
        console.log(`    Subscription IDs: ${JSON.stringify(row.subscription_ids)}`);
        console.log(`    Statuses: ${JSON.stringify(row.statuses)}`);
        console.log(`    Stripe Sub IDs: ${JSON.stringify(row.stripe_sub_ids)}`);
      });
    }

    console.log();
    console.log();

    // 2. Check for duplicate stripeSubscriptionId values
    console.log('2. CHECKING FOR DUPLICATE stripeSubscriptionId VALUES');
    console.log('-'.repeat(80));

    const duplicateStripeIds = await prisma.$queryRaw`
      SELECT 
        "stripeSubscriptionId",
        COUNT(*) as occurrence_count,
        array_agg(id) as subscription_ids,
        array_agg("providerId") as provider_ids,
        array_agg(status) as statuses
      FROM "Subscription"
      WHERE "stripeSubscriptionId" IS NOT NULL
      GROUP BY "stripeSubscriptionId"
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC;
    `;

    if (duplicateStripeIds.length === 0) {
      console.log('✅ No duplicate stripeSubscriptionId values found');
    } else {
      console.log(`⚠️  Found ${duplicateStripeIds.length} stripeSubscriptionId value(s) used by multiple rows:`);
      duplicateStripeIds.forEach((row, idx) => {
        console.log(`\n  Duplicate ${idx + 1}:`);
        console.log(`    Stripe Subscription ID: ${row.stripeSubscriptionId}`);
        console.log(`    Occurrence count: ${row.occurrence_count}`);
        console.log(`    Subscription IDs: ${JSON.stringify(row.subscription_ids)}`);
        console.log(`    Provider IDs: ${JSON.stringify(row.provider_ids)}`);
        console.log(`    Statuses: ${JSON.stringify(row.statuses)}`);
      });
    }

    console.log();
    console.log();

    // 3. Check overall subscription state distribution
    console.log('3. SUBSCRIPTION STATE DISTRIBUTION');
    console.log('-'.repeat(80));

    const stateDistribution = await prisma.$queryRaw`
      SELECT 
        status,
        COUNT(*) as count,
        COUNT(CASE WHEN "stripeSubscriptionId" IS NOT NULL THEN 1 END) as with_stripe_id,
        COUNT(CASE WHEN "stripeSubscriptionId" IS NULL THEN 1 END) as without_stripe_id
      FROM "Subscription"
      GROUP BY status
      ORDER BY count DESC;
    `;

    console.log('\nSubscription Status Summary:');
    stateDistribution.forEach(row => {
      console.log(`  ${row.status.padEnd(15)}: ${row.count.toString().padStart(4)} total, ${row.with_stripe_id.toString().padStart(4)} with Stripe ID, ${row.without_stripe_id.toString().padStart(4)} without`);
    });

    console.log();
    console.log();

    // 4. Check for providers with both TRIAL and ACTIVE subscriptions
    console.log('4. CHECKING FOR PROVIDERS WITH BOTH TRIAL AND ACTIVE SUBSCRIPTIONS');
    console.log('-'.repeat(80));

    const mixedStatuses = await prisma.$queryRaw`
      SELECT 
        "providerId",
        array_agg(DISTINCT status) as statuses,
        COUNT(*) as subscription_count,
        array_agg(id) as subscription_ids
      FROM "Subscription"
      GROUP BY "providerId"
      HAVING COUNT(DISTINCT status) > 1 AND array_agg(status)::text[] && ARRAY['TRIAL', 'ACTIVE']::text[]
      ORDER BY COUNT(*) DESC;
    `;

    if (mixedStatuses.length === 0) {
      console.log('✅ No providers with both TRIAL and ACTIVE subscriptions found');
    } else {
      console.log(`⚠️  Found ${mixedStatuses.length} provider(s) with both TRIAL and ACTIVE subscriptions:`);
      mixedStatuses.forEach((row, idx) => {
        console.log(`\n  Provider ${idx + 1}:`);
        console.log(`    Provider ID: ${row.providerId}`);
        console.log(`    Statuses: ${JSON.stringify(row.statuses)}`);
        console.log(`    Subscription count: ${row.subscription_count}`);
        console.log(`    Subscription IDs: ${JSON.stringify(row.subscription_ids)}`);
      });
    }

    console.log();
    console.log();

    // 5. Check for NULL stripeCustomerId in subscriptions with stripeSubscriptionId
    console.log('5. CHECKING FOR INCONSISTENT STRIPE CUSTOMER ID');
    console.log('-'.repeat(80));

    const inconsistentCustomerId = await prisma.$queryRaw`
      SELECT 
        id,
        "providerId",
        status,
        "stripeSubscriptionId",
        "stripeCustomerId"
      FROM "Subscription"
      WHERE "stripeSubscriptionId" IS NOT NULL 
        AND "stripeCustomerId" IS NULL;
    `;

    if (inconsistentCustomerId.length === 0) {
      console.log('✅ All subscriptions with stripeSubscriptionId have stripeCustomerId');
    } else {
      console.log(`⚠️  Found ${inconsistentCustomerId.length} subscription(s) with stripeSubscriptionId but no stripeCustomerId:`);
      inconsistentCustomerId.forEach((row, idx) => {
        console.log(`\n  Subscription ${idx + 1}:`);
        console.log(`    ID: ${row.id}`);
        console.log(`    Provider ID: ${row.providerId}`);
        console.log(`    Status: ${row.status}`);
        console.log(`    Stripe Subscription ID: ${row.stripeSubscriptionId}`);
      });
    }

    console.log();
    console.log();

    // 6. Summary statistics
    console.log('6. OVERALL STATISTICS');
    console.log('-'.repeat(80));

    const totalSubs = await prisma.subscription.count();
    const withStripeId = await prisma.subscription.count({
      where: { stripeSubscriptionId: { not: null } }
    });
    const uniqueProviders = await prisma.subscription.groupBy({
      by: ['providerId']
    });

    console.log(`Total subscriptions: ${totalSubs}`);
    console.log(`Subscriptions with Stripe ID: ${withStripeId}`);
    console.log(`Subscriptions without Stripe ID: ${totalSubs - withStripeId}`);
    console.log(`Unique providers: ${uniqueProviders.length}`);
    console.log(`Average subscriptions per provider: ${(totalSubs / uniqueProviders.length).toFixed(2)}`);

    console.log();
    console.log('='.repeat(80));
    console.log('DUPLICATE CHECK COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error during duplicate check:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkDuplicateSubscriptions()
  .then(() => {
    console.log('\n✅ Check completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error.message);
    process.exit(1);
  });
