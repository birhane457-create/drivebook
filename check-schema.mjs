import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSchema() {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Subscription' 
        AND column_name IN ('lastWebhookEventId', 'lastWebhookEventTimestamp')
      ORDER BY column_name;
    `;
    
    console.log('Subscription webhook columns in database:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.length === 0) {
      console.log('\n❌ ERROR: Webhook watermark columns DO NOT EXIST in database!');
    } else if (result.length === 2) {
      console.log('\n✅ Both webhook watermark columns exist in database');
    } else {
      console.log(`\n⚠️  WARNING: Only ${result.length} of 2 webhook columns exist`);
    }
  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
