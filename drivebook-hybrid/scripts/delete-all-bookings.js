/**
 * Delete ALL Bookings for User
 * 
 * This script deletes ALL bookings (regardless of how they were created)
 * and ALL wallet transactions, then resets wallet to show only paid amount.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAllBookings() {
  console.log('\n🗑️  Deleting ALL Bookings and Resetting Wallet\n');

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

    // Get client
    const client = await prisma.client.findFirst({
      where: { userId: user.id }
    });

    if (!client) {
      console.log('❌ Client not found');
      return;
    }

    console.log('✅ Client found:', client.id);

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

    // Get ALL bookings (by userId OR clientId)
    const allBookings = await prisma.booking.findMany({
      where: {
        OR: [
          { userId: user.id },
          { clientId: client.id }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n📅 Found ${allBookings.length} total bookings:`);
    
    let totalBookingValue = 0;
    allBookings.forEach((booking, index) => {
      console.log(`\n   ${index + 1}. Booking ID: ${booking.id}`);
      console.log(`      Date: ${booking.startTime.toLocaleDateString()}`);
      console.log(`      Time: ${booking.startTime.toLocaleTimeString()}`);
      console.log(`      Price: $${booking.price.toFixed(2)}`);
      console.log(`      Status: ${booking.status}`);
      console.log(`      Created By: ${booking.createdBy || 'unknown'}`);
      console.log(`      User ID: ${booking.userId}`);
      console.log(`      Client ID: ${booking.clientId || 'none'}`);
      totalBookingValue += booking.price;
    });

    console.log(`\n💰 Total Booking Value: $${totalBookingValue.toFixed(2)}`);

    // Get ALL wallet transactions
    const allTransactions = await prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.id
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n💸 Found ${allTransactions.length} total transactions:`);
    
    let totalDebit = 0;
    let totalCredit = 0;
    
    allTransactions.forEach((tx, index) => {
      console.log(`\n   ${index + 1}. Transaction ID: ${tx.id}`);
      console.log(`      Type: ${tx.type}`);
      console.log(`      Amount: $${tx.amount.toFixed(2)}`);
      console.log(`      Description: ${tx.description}`);
      console.log(`      Status: ${tx.status}`);
      console.log(`      Date: ${tx.createdAt.toLocaleString()}`);
      
      if (tx.type === 'DEBIT' || tx.type === 'debit') {
        totalDebit += tx.amount;
      } else if (tx.type === 'CREDIT' || tx.type === 'credit') {
        totalCredit += tx.amount;
      }
    });

    console.log(`\n💸 Total DEBIT: $${totalDebit.toFixed(2)}`);
    console.log(`💸 Total CREDIT: $${totalCredit.toFixed(2)}`);

    // Confirm deletion
    console.log('\n⚠️  WARNING: This will:');
    console.log(`   1. Delete ALL ${allBookings.length} bookings`);
    console.log(`   2. Delete ALL ${allTransactions.length} wallet transactions`);
    console.log(`   3. Reset wallet to: totalSpent = $0.00`);
    console.log(`   4. Reset wallet to: creditsRemaining = totalPaid ($${wallet.totalPaid.toFixed(2)})`);

    console.log('\n🔄 Processing deletion...\n');

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      // Delete ALL bookings
      const deletedBookings = await tx.booking.deleteMany({
        where: {
          OR: [
            { userId: user.id },
            { clientId: client.id }
          ]
        }
      });
      console.log(`✅ Deleted ${deletedBookings.count} bookings`);

      // Delete ALL wallet transactions
      const deletedTransactions = await tx.walletTransaction.deleteMany({
        where: {
          walletId: wallet.id
        }
      });
      console.log(`✅ Deleted ${deletedTransactions.count} wallet transactions`);

      // Reset wallet to show only paid amount
      const updatedWallet = await tx.clientWallet.update({
        where: { id: wallet.id },
        data: {
          totalSpent: 0,
          creditsRemaining: wallet.totalPaid
        }
      });
      console.log(`✅ Reset wallet`);
      console.log(`   New Total Spent: $${updatedWallet.totalSpent.toFixed(2)}`);
      console.log(`   New Credits Remaining: $${updatedWallet.creditsRemaining.toFixed(2)}`);
    });

    // Verify deletion
    const remainingBookings = await prisma.booking.count({
      where: {
        OR: [
          { userId: user.id },
          { clientId: client.id }
        ]
      }
    });

    const remainingTransactions = await prisma.walletTransaction.count({
      where: {
        walletId: wallet.id
      }
    });

    console.log('\n✅ Verification:');
    console.log(`   Remaining Bookings: ${remainingBookings}`);
    console.log(`   Remaining Transactions: ${remainingTransactions}`);

    // Get updated wallet
    const finalWallet = await prisma.clientWallet.findUnique({
      where: { userId: user.id }
    });

    console.log('\n💳 Final Wallet Status:');
    console.log('   Total Paid:', `$${finalWallet.totalPaid.toFixed(2)}`);
    console.log('   Total Spent:', `$${finalWallet.totalSpent.toFixed(2)}`);
    console.log('   Credits Remaining:', `$${finalWallet.creditsRemaining.toFixed(2)}`);

    console.log('\n✅ Complete cleanup! Everything deleted and wallet reset.\n');
    console.log('🎉 You now have a completely clean slate for testing!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllBookings();
