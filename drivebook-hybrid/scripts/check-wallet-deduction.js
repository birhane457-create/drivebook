/**
 * Check Wallet Deduction Issue
 * 
 * This script checks if wallet credits are being deducted properly
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWalletDeduction() {
  console.log('\n💰 Checking Wallet Deduction Issue\n');

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

    // Get all bookings
    const bookings = await prisma.booking.findMany({
      where: {
        userId: user.id,
        status: { in: ['CONFIRMED', 'PENDING'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n📅 Found ${bookings.length} active bookings`);

    // Calculate total booking cost
    let totalBookingCost = 0;
    bookings.forEach((booking, index) => {
      console.log(`\n   ${index + 1}. Booking ID: ${booking.id}`);
      console.log(`      Date: ${booking.startTime.toLocaleDateString()}`);
      console.log(`      Time: ${booking.startTime.toLocaleTimeString()}`);
      console.log(`      Price: $${booking.price.toFixed(2)}`);
      console.log(`      Status: ${booking.status}`);
      console.log(`      Created: ${booking.createdAt.toLocaleString()}`);
      totalBookingCost += booking.price;
    });

    console.log(`\n📊 Total Booking Cost: $${totalBookingCost.toFixed(2)}`);

    // Get wallet transactions
    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log(`\n💸 Recent Wallet Transactions (last 10):`);
    transactions.forEach((tx, index) => {
      console.log(`\n   ${index + 1}. Transaction ID: ${tx.id}`);
      console.log(`      Type: ${tx.type}`);
      console.log(`      Amount: $${tx.amount.toFixed(2)}`);
      console.log(`      Description: ${tx.description}`);
      console.log(`      Status: ${tx.status}`);
      console.log(`      Date: ${tx.createdAt.toLocaleString()}`);
    });

    // Analysis
    console.log('\n\n🔍 ANALYSIS:');
    console.log('─────────────────────────────────────────');
    
    const expectedSpent = wallet.totalSpent;
    const actualBookingCost = totalBookingCost;
    
    console.log(`Expected Total Spent: $${expectedSpent.toFixed(2)}`);
    console.log(`Actual Booking Cost: $${actualBookingCost.toFixed(2)}`);
    
    if (Math.abs(expectedSpent - actualBookingCost) > 0.01) {
      console.log('\n⚠️  MISMATCH DETECTED!');
      console.log(`   Difference: $${Math.abs(expectedSpent - actualBookingCost).toFixed(2)}`);
      
      if (expectedSpent < actualBookingCost) {
        console.log('   ❌ Wallet was NOT deducted for some bookings!');
        console.log(`   Missing deductions: $${(actualBookingCost - expectedSpent).toFixed(2)}`);
      } else {
        console.log('   ⚠️  Wallet was deducted more than booking cost');
      }
    } else {
      console.log('\n✅ Wallet deductions match booking costs');
    }

    // Check if credits remaining is correct
    const expectedRemaining = wallet.totalPaid - wallet.totalSpent;
    console.log(`\nExpected Remaining: $${expectedRemaining.toFixed(2)}`);
    console.log(`Actual Remaining: $${wallet.creditsRemaining.toFixed(2)}`);
    
    if (Math.abs(expectedRemaining - wallet.creditsRemaining) > 0.01) {
      console.log('⚠️  Credits remaining calculation is incorrect!');
    } else {
      console.log('✅ Credits remaining is correct');
    }

    // Count DEBIT transactions
    const debitTransactions = transactions.filter(tx => tx.type === 'DEBIT');
    console.log(`\n📝 DEBIT Transactions: ${debitTransactions.length}`);
    console.log(`📝 Active Bookings: ${bookings.length}`);
    
    if (debitTransactions.length < bookings.length) {
      console.log(`\n❌ PROBLEM FOUND: ${bookings.length - debitTransactions.length} bookings have NO transaction record!`);
      console.log('   This means wallet was NOT deducted for these bookings.');
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkWalletDeduction();
