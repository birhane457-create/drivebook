/**
 * Verify that a FRESH Prisma Client instance can see the webhook columns
 * This bypasses any cached client instances
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn']
});

async function testFreshClient() {
  try {
    console.log('\n=== Testing FRESH Prisma Client (no cache) ===\n');
    
    // Try to create a test subscription with webhook fields
    const testData = {
      providerId: 'test-provider-id-' + Date.now(),
      stripeCustomerId: 'cus_test',
      tier: 'PRO',
      status: 'ACTIVE',
      monthlyAmount: 49,
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      lastWebhookEventId: 'evt_test_123',
      lastWebhookEventTimestamp: Math.floor(Date.now() / 1000)
    };
    
    console.log('Attempting to create Subscription with webhook fields...');
    console.log('Data:', JSON.stringify(testData, null, 2));
    
    // This will fail if Prisma Client doesn't know about these fields
    const subscription = await prisma.subscription.create({
      data: testData
    });
    
    console.log('\n✅ SUCCESS! Fresh Prisma Client CAN use webhook columns');
    console.log('Created subscription ID:', subscription.id);
    
    // Clean up
    await prisma.subscription.delete({ where: { id: subscription.id } });
    console.log('Test data cleaned up');
    
    return true;
  } catch (error) {
    console.error('\n❌ FAILED! Fresh Prisma Client CANNOT use webhook columns');
    console.error('Error:', error.message);
    
    if (error.code === 'P2022') {
      console.error('\nDiagnosis: The generated Prisma Client does NOT include webhook columns');
      console.error('This means "npx prisma generate" was run BEFORE the schema had these fields');
      console.error('\nRequired fix: Delete node_modules/.prisma and regenerate');
    }
    
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

testFreshClient().then(success => {
  process.exit(success ? 0 : 1);
});
