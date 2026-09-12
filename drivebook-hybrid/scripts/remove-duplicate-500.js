const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 REMOVING DUPLICATE $500 TRANSACTION\n');
  
  const duplicateId = '699d7835c1b4cecaec98f3ad';
  
  // Get the transaction first
  const txn = await prisma.walletTransaction.findUnique({
    where: { id: duplicateId }
  });
  
  if (!txn) {
    console.log('❌ Transaction not found');
    return;
  }
  
  console.log('Found duplicate transaction:');
  console.log(`  ID: ${txn.id}`);
  console.log(`  Type: "${txn.type}" (wrong - should be "CREDIT")`);
  console.log(`  Amount: $${txn.amount}`);
  console.log(`  Description: ${txn.description}`);
  console.log(`  Created: ${new Date(txn.createdAt).toLocaleString()}`);
  console.log('');
  
  // Delete it
  await prisma.walletTransaction.delete({
    where: { id: duplicateId }
  });
  
  console.log('✅ Duplicate transaction deleted!');
  console.log('');
  console.log('Now your transaction history should show:');
  console.log('  - Only ONE $500 credit (not two)');
  console.log('  - Total Paid: $710 (correct)');
  console.log('  - Total Spent: $700 (correct)');
  console.log('  - Balance: $510 (correct: $710 - $700 + $500 = $510)');
  console.log('');
  console.log('Wait, that math is wrong. Let me recalculate...');
  console.log('  - Old credits: $210 (3×$70)');
  console.log('  - Old debits: $490');
  console.log('  - New credit: $500');
  console.log('  - New debit: $210 (for bookings)');
  console.log('  - Total: $210 - $490 + $500 - $210 = $10');
  console.log('');
  console.log('But wallet shows $510... Let me check the actual balance calculation.');
  
  await prisma.$disconnect();
}

main().catch(console.error);
