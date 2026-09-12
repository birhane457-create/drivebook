const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateExistingIdempotency() {
  console.log('🔧 Updating existing wallet transactions...\n');
  
  try {
    // Use raw MongoDB query to update null values
    const result = await prisma.$runCommandRaw({
      update: 'WalletTransaction',
      updates: [
        {
          q: { idempotencyKey: null },
          u: [
            {
              $set: {
                idempotencyKey: {
                  $concat: [
                    'legacy_',
                    { $toString: '$_id' },
                    '_',
                    { $toString: Date.now() }
                  ]
                }
              }
            }
          ],
          multi: true
        }
      ]
    });
    
    console.log('✅ Update result:', result);
    console.log('\nNow you can run: npx prisma db push');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateExistingIdempotency();
