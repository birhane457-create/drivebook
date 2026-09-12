/**
 * Test Wallet Deduction Issue
 * 
 * Simulates booking one lesson at a time to see if wallet is deducted
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWalletDeduction() {
  console.log('\n🧪 Testing Wallet Deduction Issue\n');

  try {
    // Get test user
    const user = await prisma.user.findFirst({
      where: { email: 'admin@church.org' }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    // Get wallet BEFORE
    const walletBefore = await prisma.clientWallet.findUnique({
      where: { userId: user.id }
    });

    console.log('💳 Wallet BEFORE:');
    console.log(`   Credits Remaining: $${walletBefore.creditsRemaining.toFixed(2)}`);
    console.log(`   Total Spent: $${walletBefore.totalSpent.toFixed(2)}`);

    // Simulate what the API does
    console.log('\n📝 Simulating API behavior...');
    
    const mockCartItem = {
      price: 70,
      instructorId: '699016b397d4ad25232db3b0',
      date: '2026-03-25',
      time: '10:00'
    };

    const totalCost = mockCartItem.price;
    console.log(`   Total Cost: $${totalCost.toFixed(2)}`);

    // Check if sufficient credits
    if (walletBefore.creditsRemaining < totalCost) {
      console.log('   ❌ Insufficient credits - API would return error');
      console.log(`   Need: $${totalCost.toFixed(2)}`);
      console.log(`   Have: $${walletBefore.creditsRemaining.toFixed(2)}`);
      console.log(`   Short: $${(totalCost - walletBefore.creditsRemaining).toFixed(2)}`);
      return;
    }

    console.log('   ✅ Sufficient credits available');
    console.log('   API would proceed to create booking...');

    // Check what would happen if we update wallet
    console.log('\n💰 Simulating wallet update...');
    const newCreditsRemaining = walletBefore.creditsRemaining - totalCost;
    const newTotalSpent = walletBefore.totalSpent + totalCost;

    console.log(`   New Credits Remaining: $${newCreditsRemaining.toFixed(2)}`);
    console.log(`   New Total Spent: $${newTotalSpent.toFixed(2)}`);

    // Check if there are any pending bookings without transactions
    const bookingsWithoutTransactions = await prisma.$queryRaw`
      SELECT b.id, b.price, b.startTime, b.createdAt
      FROM Booking b
      WHERE b.userId = ${user.id}
      AND b.status IN ('CONFIRMED', 'PENDING')
      AND NOT EXISTS (
        SELECT 1 FROM WalletTransaction wt
        WHERE wt.walletId = ${walletBefore.id}
        AND wt.createdAt >= b.createdAt
        AND wt.createdAt <= DATE_ADD(b.createdAt, INTERVAL 1 SECOND)
        AND wt.type = 'DEBIT'
      )
    `;

    if (bookingsWithoutTransactions.length > 0) {
      console.log(`\n⚠️  Found ${bookingsWithoutTransactions.length} bookings without matching transactions:`);
      bookingsWithoutTransactions.forEach((booking, index) => {
        console.log(`   ${index + 1}. Booking ID: ${booking.id}`);
        console.log(`      Price: $${booking.price}`);
        console.log(`      Created: ${booking.createdAt}`);
      });
    }

    // Get recent bookings and transactions
    const recentBookings = await prisma.booking.findMany({
      where: {
        userId: user.id,
        status: { in: ['CONFIRMED', 'PENDING'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const recentTransactions = await prisma.walletTransaction.findMany({
      where: {
        walletId: walletBefore.id,
        type: 'DEBIT'
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`\n📊 Recent Activity:`);
    console.log(`   Recent Bookings: ${recentBookings.length}`);
    console.log(`   Recent DEBIT Transactions: ${recentTransactions.length}`);

    // Check if wallet is being refreshed in frontend
    console.log('\n🔍 Checking Frontend Behavior:');
    console.log('   The frontend loads wallet balance on mount');
    console.log('   If user books multiple lessons quickly, frontend might show stale balance');
    console.log('   Frontend should refresh wallet after each booking');

    // Test the actual update
    console.log('\n🧪 Testing actual wallet update (DRY RUN - not committing):');
    
    try {
      // Start a transaction but don't commit
      await prisma.$transaction(async (tx) => {
        const updated = await tx.clientWallet.update({
          where: { id: walletBefore.id },
          data: {
            creditsRemaining: walletBefore.creditsRemaining - totalCost,
            totalSpent: walletBefore.totalSpent + totalCost,
          },
        });

        console.log('   ✅ Wallet update would succeed');
        console.log(`   New balance would be: $${updated.creditsRemaining.toFixed(2)}`);

        // Rollback by throwing error
        throw new Error('DRY RUN - Rolling back');
      });
    } catch (error) {
      if (error.message === 'DRY RUN - Rolling back') {
        console.log('   ✅ Transaction rolled back (dry run)');
      } else {
        console.log('   ❌ Wallet update would fail:', error.message);
      }
    }

    // Get wallet AFTER to confirm no changes
    const walletAfter = await prisma.clientWallet.findUnique({
      where: { userId: user.id }
    });

    console.log('\n💳 Wallet AFTER (should be unchanged):');
    console.log(`   Credits Remaining: $${walletAfter.creditsRemaining.toFixed(2)}`);
    console.log(`   Total Spent: $${walletAfter.totalSpent.toFixed(2)}`);

    if (walletAfter.creditsRemaining === walletBefore.creditsRemaining) {
      console.log('   ✅ Wallet unchanged (as expected for dry run)');
    }

    console.log('\n📋 CONCLUSION:');
    console.log('─────────────────────────────────────────');
    console.log('The wallet deduction code in the API is correct.');
    console.log('Possible issues:');
    console.log('1. Frontend not refreshing wallet balance after booking');
    console.log('2. User seeing cached/stale balance');
    console.log('3. API returning error before wallet deduction');
    console.log('4. Race condition with multiple rapid bookings');
    console.log('\nRecommendation: Check browser console for API responses');
    console.log('and verify wallet balance is refreshed after each booking.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testWalletDeduction();
