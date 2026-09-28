import { PrismaClient } from '@prisma/client';

// Use the EXACT database URL from .env (not DIRECT_URL)
// CREDENTIALS REDACTED PER SEC-CRED-01 - Get from secure password manager
const DATABASE_URL = "postgresql://<REDACTED_USER>:<REDACTED_PASSWORD>@db.ikhqphbbilrocsghjyda.supabase.co:5432/postgres?sslmode=require";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function checkSchema() {
  try {
    console.log(`\nConnecting to: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
    
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Subscription' 
        AND column_name IN ('lastWebhookEventId', 'lastWebhookEventTimestamp')
      ORDER BY column_name;
    `;
    
    console.log('\n=== Subscription webhook columns in TEST database ===');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.length === 0) {
      console.log('\n❌ CRITICAL: Webhook watermark columns DO NOT EXIST in test/production database!');
      console.log('   The schema.prisma has these fields but they were never migrated to the database.');
      console.log('\n   REQUIRED ACTION: Run database migration or ALTER TABLE commands');
    } else if (result.length === 2) {
      console.log('\n✅ Both webhook watermark columns exist in database');
    } else {
      console.log(`\n⚠️  WARNING: Only ${result.length} of 2 webhook columns exist`);
    }
  } catch (error) {
    console.error('\n❌ Error checking schema:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
