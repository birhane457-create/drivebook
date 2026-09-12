const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixIdempotencyNulls() {
  console.log('🔧 Fixing null idempotencyKey values...\n');
  
  try {
    // Find all transactions with null idempotencyKey
    const transactions = await prisma.walletTransaction.findMany({
      where: {
        idempotencyKey: null
      }
    });
    
    console.log(`Found ${transactions.length} transactions with null idempotencyKey\n`);
    
    // Update each with a unique key
    for (const tx of transactions) {
      const uniqueKey = `legacy_${tx.id}_${Date.now()}`;
      await prisma.walletTransaction.update({
        where: { id: tx.id },
        data: { idempotencyKey: uniqueKey }
      });
      console.log(`✓ Updated transaction ${tx.id}`);
    }
    
    console.log(`\n✅ Fixed ${transactions.length} transactions`);
    console.log('Now you can run: npx prisma db push');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixIdempotencyNulls();
