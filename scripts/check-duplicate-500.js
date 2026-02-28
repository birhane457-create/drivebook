const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 CHECKING DUPLICATE $500 ENTRIES\n');
  
  const userId = '69996e3ab3895e34697953a8';
  
  const wallet = await prisma.clientWallet.findUnique({
    where: { userId: userId }
  });
  
  const txns = await prisma.walletTransaction.findMany({
    where: {
      walletId: wallet.id,
      description: { contains: '500.00 credits' }
    },
    orderBy: { createdAt: 'asc' }
  });
  
  console.log(`Found ${txns.length} transactions with "500.00 credits":\n`);
  
  for (const txn of txns) {
    console.log(`Transaction ID: ${txn.id}`);
    console.log(`  Type: "${txn.type}" (should be "CREDIT")`);
    console.log(`  Amount: $${txn.amount}`);
    console.log(`  Description: ${txn.description}`);
    console.log(`  Created: ${new Date(txn.createdAt).toLocaleString()}`);
    console.log('');
  }
  
  // Check if one has wrong type
  const wrongType = txns.find(t => t.type !== 'CREDIT');
  if (wrongType) {
    console.log('⚠️  FOUND ISSUE:');
    console.log(`  Transaction ${wrongType.id} has type "${wrongType.type}" instead of "CREDIT"`);
    console.log('  This is why it shows as negative in the transaction list.');
    console.log('');
    console.log('  To fix: Delete this duplicate transaction');
    console.log(`  Command: await prisma.walletTransaction.delete({ where: { id: '${wrongType.id}' } })`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
