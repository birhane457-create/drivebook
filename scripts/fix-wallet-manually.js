/**
 * Manually Fix Wallet Balance
 * 
 * This script manually updates the wallet to reflect the actual bookings
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixWallet() {
  console.log('\n🔧 Manually Fixing Wallet Balance\n');

  try {
    const user = await prisma.user.findFirst({
      where: { email: 'admin@church.org' }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: user.id }
    });

    if (!wallet) {
      console.log('❌ Wallet not found');
      return;
    }

    console.log('💳 Current Wallet:');
    console.log('   Total Paid:', `$${wallet.totalPaid.toFixed(2)}`);
    console.log('   Total Spent:', `$${wallet.totalSpent.toFixed(2)}`);
    console.log('   Credits Remaining:', `$${wallet.creditsRemaining.toFixed(2)}`);

    // Get all DEBIT transactions
    const debitTransactions = await prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
        type: 'DEBIT',
        status: 'COMPLETED'
      }
    });

    const totalDebits = debitTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    console.log(`\n💸 Total DEBIT transactions: $${totalDebits.toFixed(2)}`);

    // Calculate correct values
    const correctTotalSpent = totalDebits;
    const correctCreditsRemaining = wallet.totalPaid - correctTotalSpent;

    console.log('\n✅ Correct Values Should Be:');
    console.log('   Total Spent:', `$${correctTotalSpent.toFixed(2)}`);
    console.log('   Credits Remaining:', `$${correctCreditsRemaining.toFixed(2)}`);

    // Update wallet
    const updated = await prisma.clientWallet.update({
      where: { id: wallet.id },
      data: {
        totalSpent: correctTotalSpent,
        creditsRemaining: correctCreditsRemaining
      }
    });

    console.log('\n✅ Wallet Updated:');
    console.log('   Total Spent:', `$${updated.totalSpent.toFixed(2)}`);
    console.log('   Credits Remaining:', `$${updated.creditsRemaining.toFixed(2)}`);

    console.log('\n🎉 Wallet fixed! Refresh your browser to see the updated balance.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixWallet();
