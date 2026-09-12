const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔥 COMPLETE SYSTEM RESET\n');
  console.log('This will delete:');
  console.log('  - All bookings');
  console.log('  - All wallet transactions');
  console.log('  - All old transactions');
  console.log('  - All ledger entries');
  console.log('  - Reset wallet balance to $500');
  console.log('\n' + '='.repeat(70));
  console.log('Starting in 3 seconds...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const userId = '69996e3ab3895e34697953a8'; // admin@church.org
  
  console.log('Step 1: Deleting all bookings...');
  const deletedBookings = await prisma.booking.deleteMany({
    where: { userId: userId }
  });
  console.log(`  ✅ Deleted ${deletedBookings.count} bookings\n`);
  
  console.log('Step 2: Deleting all wallet transactions...');
  const wallet = await prisma.clientWallet.findUnique({
    where: { userId: userId }
  });
  
  if (wallet) {
    const deletedWalletTxns = await prisma.walletTransaction.deleteMany({
      where: { walletId: wallet.id }
    });
    console.log(`  ✅ Deleted ${deletedWalletTxns.count} wallet transactions\n`);
  }
  
  console.log('Step 3: Deleting all old transactions...');
  const deletedTransactions = await prisma.transaction.deleteMany({
    where: {
      booking: {
        userId: userId
      }
    }
  });
  console.log(`  ✅ Deleted ${deletedTransactions.count} old transactions\n`);
  
  console.log('Step 4: Deleting all ledger entries...');
  const deletedLedger = await prisma.financialLedger.deleteMany({
    where: { userId: userId }
  });
  console.log(`  ✅ Deleted ${deletedLedger.count} ledger entries\n`);
  
  console.log('Step 5: Resetting wallet to $500...');
  await prisma.clientWallet.update({
    where: { userId: userId },
    data: {
      balance: 500,
      totalPaid: 0,
      totalSpent: 0,
      creditsRemaining: 0
    }
  });
  console.log(`  ✅ Wallet reset to $500\n`);
  
  console.log('Step 6: Creating initial wallet transaction...');
  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'CREDIT',
      amount: 500,
      description: 'Initial wallet credit',
      status: 'completed'
    }
  });
  console.log(`  ✅ Created initial $500 credit transaction\n`);
  
  console.log('Step 7: Creating initial ledger entry...');
  await prisma.financialLedger.create({
    data: {
      debitAccount: 'PLATFORM_BANK',
      creditAccount: `CLIENT_WALLET:${userId}`,
      amount: 500,
      description: 'Initial wallet credit',
      idempotencyKey: `initial-credit-${userId}-${Date.now()}`,
      userId: userId,
      createdBy: 'SYSTEM'
    }
  });
  console.log(`  ✅ Created initial ledger entry\n`);
  
  console.log('='.repeat(70));
  console.log('✅ RESET COMPLETE!\n');
  console.log('Your wallet now has:');
  console.log('  - Balance: $500');
  console.log('  - 0 bookings');
  console.log('  - 1 transaction (initial $500 credit)');
  console.log('  - Clean ledger');
  console.log('\nYou can now start fresh with proper dual-write working!');
  
  await prisma.$disconnect();
}

main().catch(console.error);
