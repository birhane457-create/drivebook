/**
 * Delete Test Bookings and Transactions
 * 
 * This script deletes test bookings and their transactions,
 * and refunds the credits back to the wallet.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteTestBookings() {
  console.log('\n🗑️  Deleting Test Bookings and Transactions\n');

  try {
    // Get test user
    const user = await prisma.user.findFirst({
      where: { email: 'admin@church.org' }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', user.email);

    // Get wallet
    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: user.id }
    });

    if (!wallet) {
      console.log('❌ Wallet not found');
      return;
    }

    console.log('\n💳 Current Wallet Status:');
    console.log('   Total Paid:', `$${wallet.totalPaid.toFixed(2)}`);
    console.log('   Total Spent:', `$${wallet.totalSpent.toFixed(2)}`);
    console.log('   Credits Remaining:', `$${wallet.creditsRemaining.toFixed(2)}`);

    // Get all bookings for this user
    const bookings = await prisma.booking.findMany({
      where: {
        userId: user.id,
        status: { in: ['CONFIRMED', 'PENDING'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n📅 Found ${bookings.length} active bookings to delete:`);
    
    let totalRefund = 0;
    bookings.forEach((booking, index) => {
      console.log(`\n   ${index + 1}. Booking ID: ${booking.id}`);
      console.log(`      Date: ${booking.startTime.toLocaleDateString()}`);
      console.log(`      Time: ${booking.startTime.toLocaleTimeString()}`);
      console.log(`      Price: $${booking.price.toFixed(2)}`);
      console.log(`      Status: ${booking.status}`);
      totalRefund += booking.price;
    });

    console.log(`\n💰 Total Refund Amount: $${totalRefund.toFixed(2)}`);

    // Get DEBIT transactions
    const debitTransactions = await prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
        type: 'DEBIT',
        status: 'COMPLETED'
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n💸 Found ${debitTransactions.length} DEBIT transactions to delete:`);
    
    let totalDebitAmount = 0;
    debitTransactions.forEach((tx, index) => {
      console.log(`\n   ${index + 1}. Transaction ID: ${tx.id}`);
      console.log(`      Amount: $${tx.amount.toFixed(2)}`);
      console.log(`      Description: ${tx.description}`);
      console.log(`      Date: ${tx.createdAt.toLocaleString()}`);
      totalDebitAmount += tx.amount;
    });

    console.log(`\n💸 Total DEBIT Amount: $${totalDebitAmount.toFixed(2)}`);

    // Confirm deletion
    console.log('\n⚠️  WARNING: This will:');
    console.log(`   1. Delete ${bookings.length} bookings`);
    console.log(`   2. Delete ${debitTransactions.length} DEBIT transactions`);
    console.log(`   3. Refund $${totalRefund.toFixed(2)} to wallet`);
    console.log(`   4. Update wallet: totalSpent from $${wallet.totalSpent.toFixed(2)} to $${(wallet.totalSpent - totalDebitAmount).toFixed(2)}`);
    console.log(`   5. Update wallet: creditsRemaining from $${wallet.creditsRemaining.toFixed(2)} to $${(wallet.creditsRemaining + totalRefund).toFixed(2)}`);

    console.log('\n🔄 Processing deletion...\n');

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      // Delete bookings
      const deletedBookings = await tx.booking.deleteMany({
        where: {
          userId: user.id,
          status: { in: ['CONFIRMED', 'PENDING'] }
        }
      });
      console.log(`✅ Deleted ${deletedBookings.count} bookings`);

      // Delete DEBIT transactions
      const deletedTransactions = await tx.walletTransaction.deleteMany({
        where: {
          walletId: wallet.id,
          type: 'DEBIT',
          status: 'COMPLETED'
        }
      });
      console.log(`✅ Deleted ${deletedTransactions.count} DEBIT transactions`);

      // Update wallet
      const updatedWallet = await tx.clientWallet.update({
        where: { id: wallet.id },
        data: {
          totalSpent: wallet.totalSpent - totalDebitAmount,
          creditsRemaining: wallet.creditsRemaining + totalRefund
        }
      });
      console.log(`✅ Updated wallet`);
      console.log(`   New Total Spent: $${updatedWallet.totalSpent.toFixed(2)}`);
      console.log(`   New Credits Remaining: $${updatedWallet.creditsRemaining.toFixed(2)}`);
    });

    // Verify deletion
    const remainingBookings = await prisma.booking.count({
      where: {
        userId: user.id,
        status: { in: ['CONFIRMED', 'PENDING'] }
      }
    });

    const remainingDebitTransactions = await prisma.walletTransaction.count({
      where: {
        walletId: wallet.id,
        type: 'DEBIT',
        status: 'COMPLETED'
      }
    });

    console.log('\n✅ Verification:');
    console.log(`   Remaining Bookings: ${remainingBookings}`);
    console.log(`   Remaining DEBIT Transactions: ${remainingDebitTransactions}`);

    // Get updated wallet
    const finalWallet = await prisma.clientWallet.findUnique({
      where: { userId: user.id }
    });

    console.log('\n💳 Final Wallet Status:');
    console.log('   Total Paid:', `$${finalWallet.totalPaid.toFixed(2)}`);
    console.log('   Total Spent:', `$${finalWallet.totalSpent.toFixed(2)}`);
    console.log('   Credits Remaining:', `$${finalWallet.creditsRemaining.toFixed(2)}`);

    console.log('\n✅ Deletion complete! Ready for fresh testing.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

deleteTestBookings();
