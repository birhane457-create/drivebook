const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing Financial Ledger...\n');
  
  // Count existing entries
  const count = await prisma.financialLedger.count();
  console.log(`Found ${count} existing ledger entries`);
  
  if (count === 0) {
    console.log('Ledger is already empty');
    await prisma.$disconnect();
    return;
  }
  
  // Confirm deletion
  console.log('\n⚠️  WARNING: This will DELETE ALL ledger entries!');
  console.log('This is safe for test data migration, but NEVER do this in production.');
  console.log('\nDeleting in 3 seconds...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Delete all ledger entries
  const result = await prisma.financialLedger.deleteMany({});
  
  console.log(`✅ Deleted ${result.count} ledger entries`);
  console.log('\nLedger is now empty. Ready for clean migration.');
  console.log('\nRun: node scripts/migrate-test-data-to-ledger.js');
  
  await prisma.$disconnect();
}

main().catch(console.error);
